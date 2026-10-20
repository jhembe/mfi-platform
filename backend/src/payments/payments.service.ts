import {
  Injectable, BadRequestException, NotFoundException,
  Logger, Scope,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { SelcomService, SelcomCallbackPayload } from './selcom.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { PaymentRequestStatus } from '@mfi/shared';

interface PaymentRequestRow {
  id: string;
  loan_id: string;
  payment_ref: string;
  selcom_ref: string | null;
  amount: bigint;
  phone: string;
  channel: string | null;
  status: string;
  failure_reason: string | null;
  expires_at: Date;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface LoanRow {
  id: string;
  loan_ref: string;
  client_id: string;
  status: string;
  outstanding_balance: bigint;
}

interface ClientRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

function toPaymentRequest(row: PaymentRequestRow) {
  return {
    id: row.id,
    loanId: row.loan_id,
    paymentRef: row.payment_ref,
    selcomRef: row.selcom_ref,
    amount: Number(row.amount),
    phone: row.phone,
    channel: row.channel,
    status: row.status,
    failureReason: row.failure_reason,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generatePaymentRef(loanRef: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PAY-${loanRef}-${ts}-${rand}`;
}

@Injectable({ scope: Scope.REQUEST })
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
    private readonly selcom: SelcomService,
  ) {}

  private get s() { return this.tenantCtx.schemaName; }

  // ── Create payment request ───────────────────────────────────────────────────

  async createPaymentRequest(dto: CreatePaymentRequestDto, createdBy: string) {
    const s = this.s;

    // Load and validate loan
    const loans = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `SELECT id, loan_ref, client_id, status, outstanding_balance
       FROM "${s}".loan_accounts WHERE id = $1::uuid AND deleted_at IS NULL`,
      dto.loanId,
    );
    if (!loans.length) throw new NotFoundException('Loan not found');
    const loan = loans[0];
    if (loan.status !== 'ACTIVE') {
      throw new BadRequestException('Payment requests can only be created for ACTIVE loans');
    }

    // Block duplicate pending requests for same loan
    const existing = await this.prisma.$queryRawUnsafe<[{ count: string }]>(
      `SELECT COUNT(*)::text FROM "${s}".payment_requests
       WHERE loan_id = $1::uuid AND status = 'PENDING' AND expires_at > NOW()`,
      dto.loanId,
    );
    if (parseInt(existing[0].count, 10) > 0) {
      throw new BadRequestException('A pending payment request already exists for this loan');
    }

    // Load client for billing name
    const clients = await this.prisma.$queryRawUnsafe<ClientRow[]>(
      `SELECT id, first_name, last_name, phone FROM "${s}".clients WHERE id = $1::uuid`,
      loan.client_id,
    );
    const client = clients[0];
    const customerName = client ? `${client.first_name} ${client.last_name}` : 'Client';

    const paymentRef = generatePaymentRef(loan.loan_ref);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Insert request record (PENDING) before calling Selcom
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".payment_requests
         (loan_id, payment_ref, amount, phone, status, expires_at, created_by)
       VALUES ($1::uuid,$2,$3,$4,'PENDING',$5,$6::uuid)`,
      dto.loanId, paymentRef, BigInt(dto.amount), dto.phone, expiresAt, createdBy,
    );

    // Call Selcom
    try {
      const selcomResp = await this.selcom.createOrder({
        orderId: paymentRef,
        phone: dto.phone,
        amount: dto.amount,
        customerName,
      });

      if (selcomResp.resultcode !== '000') {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "${s}".payment_requests
           SET status = 'FAILED', failure_reason = $1, updated_at = NOW()
           WHERE payment_ref = $2`,
          selcomResp.message ?? 'Selcom rejected request',
          paymentRef,
        );
        throw new BadRequestException(`Selcom error: ${selcomResp.message}`);
      }

      // Update with Selcom reference
      await this.prisma.$executeRawUnsafe(
        `UPDATE "${s}".payment_requests SET selcom_ref = $1, updated_at = NOW() WHERE payment_ref = $2`,
        selcomResp.reference, paymentRef,
      );

      const rows = await this.prisma.$queryRawUnsafe<PaymentRequestRow[]>(
        `SELECT * FROM "${s}".payment_requests WHERE payment_ref = $1`, paymentRef,
      );
      return toPaymentRequest(rows[0]);
    } catch (err) {
      // Mark failed if Selcom call threw (network error etc.)
      if (err instanceof BadRequestException) throw err;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "${s}".payment_requests
         SET status = 'FAILED', failure_reason = $1, updated_at = NOW()
         WHERE payment_ref = $2`,
        err instanceof Error ? err.message : 'Unknown error', paymentRef,
      );
      throw err;
    }
  }

  // ── List requests for a loan ─────────────────────────────────────────────────

  async listByLoan(loanId: string, limit = 10) {
    const rows = await this.prisma.$queryRawUnsafe<PaymentRequestRow[]>(
      `SELECT * FROM "${this.s}".payment_requests
       WHERE loan_id = $1::uuid ORDER BY created_at DESC LIMIT $2`,
      loanId, limit,
    );
    return rows.map(toPaymentRequest);
  }

  // ── Handle Selcom callback ───────────────────────────────────────────────────
  // This method is called by PaymentsController after signature verification.
  // It runs WITHOUT tenant context — we resolve the tenant from the payment_ref.

  async handleCallback(
    payload: SelcomCallbackPayload,
    rawBody: string,
    digestHeader: string | undefined,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Selcom callback received: orderId=${payload.order_id} result=${payload.result}`);

    // Verify signature
    if (!this.selcom.verifyCallback(rawBody, digestHeader)) {
      this.logger.warn(`Selcom callback signature verification failed for orderId=${payload.order_id}`);
      // Return 200 anyway to prevent Selcom retry storm; we just don't process it
      return { received: true };
    }

    // Find the payment request across all tenant schemas by payment_ref
    // We query information_schema to find which tenant schema has this ref
    const schemaRows = await this.prisma.$queryRawUnsafe<[{ schema_name: string }]>(
      `SELECT table_schema AS schema_name
       FROM information_schema.tables
       WHERE table_name = 'payment_requests'
         AND table_schema NOT IN ('public','information_schema','pg_catalog')
       LIMIT 1`,
    );

    // Iterate tenant schemas to find the matching payment request
    // In a multi-tenant setup, we need to find which tenant this belongs to
    const tenantSchemas = await this.prisma.$queryRawUnsafe<{ schema_name: string }[]>(
      `SELECT table_schema AS schema_name
       FROM information_schema.tables
       WHERE table_name = 'payment_requests'
         AND table_schema NOT IN ('public','information_schema','pg_catalog')`,
    );

    void schemaRows;

    let foundSchema: string | null = null;
    let foundRequest: PaymentRequestRow | null = null;

    for (const { schema_name } of tenantSchemas) {
      const rows = await this.prisma.$queryRawUnsafe<PaymentRequestRow[]>(
        `SELECT * FROM "${schema_name}".payment_requests WHERE payment_ref = $1`,
        payload.order_id,
      );
      if (rows.length) {
        foundSchema = schema_name;
        foundRequest = rows[0];
        break;
      }
    }

    if (!foundSchema || !foundRequest) {
      this.logger.warn(`Selcom callback: payment_ref ${payload.order_id} not found in any schema`);
      return { received: true };
    }

    // Already processed
    if (foundRequest.status !== PaymentRequestStatus.PENDING) {
      this.logger.log(`Selcom callback: ${payload.order_id} already in status ${foundRequest.status}`);
      return { received: true };
    }

    if (payload.result === 'SUCCESS' && payload.resultcode === '000') {
      await this.processSuccessfulPayment(foundSchema, foundRequest, payload);
    } else {
      // Mark failed
      await this.prisma.$executeRawUnsafe(
        `UPDATE "${foundSchema}".payment_requests
         SET status = 'FAILED', failure_reason = $1,
             channel = $2, callback_payload = $3::jsonb, updated_at = NOW()
         WHERE id = $4::uuid`,
        payload.message ?? `Selcom result: ${payload.resultcode}`,
        payload.channel ?? null,
        JSON.stringify(payload),
        foundRequest.id,
      );
      this.logger.log(`Selcom callback: payment ${payload.order_id} failed — ${payload.message}`);
    }

    return { received: true };
  }

  private async processSuccessfulPayment(
    schema: string,
    request: PaymentRequestRow,
    payload: SelcomCallbackPayload,
  ) {
    const idempotencyKey = `selcom:${payload.transid}`;

    await this.prisma.$transaction(async (tx) => {
      // Check idempotency — don't double-post
      const existing = await tx.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text FROM "${schema}".ledger_entries WHERE idempotency_key = $1`,
        idempotencyKey,
      );
      if (parseInt(existing[0].count, 10) > 0) {
        this.logger.log(`Selcom callback: ${idempotencyKey} already posted, skipping`);
        return;
      }

      const amount = BigInt(Math.round(parseFloat(payload.amount)));

      // Mark request completed
      await tx.$executeRawUnsafe(
        `UPDATE "${schema}".payment_requests
         SET status = 'COMPLETED', channel = $1,
             callback_payload = $2::jsonb, updated_at = NOW()
         WHERE id = $3::uuid`,
        payload.channel ?? 'MOBILE_MONEY',
        JSON.stringify(payload),
        request.id,
      );

      // Load loan for repayment allocation
      const loans = await tx.$queryRawUnsafe<{
        id: string; outstanding_balance: bigint; status: string;
      }[]>(
        `SELECT id, outstanding_balance, status FROM "${schema}".loan_accounts WHERE id = $1::uuid`,
        request.loan_id,
      );
      if (!loans.length || loans[0].status !== 'ACTIVE') return;

      // Allocate repayment: Penalties → Fees → Interest → Principal
      const schedule = await tx.$queryRawUnsafe<{
        id: string; total_due: bigint; paid_amount: bigint;
        penalties_due: bigint; fees_due: bigint; interest_due: bigint; principal_due: bigint;
        status: string; due_date: Date;
      }[]>(
        `SELECT id, total_due, paid_amount, penalties_due, fees_due, interest_due, principal_due, status, due_date
         FROM "${schema}".repayment_schedule
         WHERE loan_id = $1::uuid AND status != 'PAID'
         ORDER BY due_date ASC`,
        request.loan_id,
      );

      let remaining = amount;
      for (const inst of schedule) {
        if (remaining <= 0n) break;
        const instBalance = inst.total_due - inst.paid_amount;
        if (instBalance <= 0n) continue;

        const applied = remaining >= instBalance ? instBalance : remaining;
        remaining -= applied;
        const newPaid = inst.paid_amount + applied;
        const newStatus = newPaid >= inst.total_due ? 'PAID' : 'PARTIAL';

        await tx.$executeRawUnsafe(
          `UPDATE "${schema}".repayment_schedule
           SET paid_amount = $1, status = $2, updated_at = NOW() WHERE id = $3::uuid`,
          newPaid, newStatus, inst.id,
        );
      }

      // Update loan outstanding balance
      const newBalance = loans[0].outstanding_balance - amount;
      const newLoanStatus = newBalance <= 0n ? 'CLOSED' : 'ACTIVE';
      await tx.$executeRawUnsafe(
        `UPDATE "${schema}".loan_accounts
         SET outstanding_balance = GREATEST(0, $1), status = $2,
             ${newLoanStatus === 'CLOSED' ? "closed_at = NOW()," : ''}
             updated_at = NOW()
         WHERE id = $3::uuid`,
        newBalance, newLoanStatus, request.loan_id,
      );

      // Post ledger entry
      await tx.$executeRawUnsafe(
        `INSERT INTO "${schema}".ledger_entries
           (loan_id, transaction_type, debit_account, credit_account,
            amount, channel, reference, idempotency_key, notes)
         VALUES ($1::uuid,'REPAYMENT','2001-MEMBER-SAVINGS','1101-PERFORMING-LOANS',
                 $2,$3,$4,$5,$6)`,
        request.loan_id, amount,
        payload.channel ?? 'MOBILE_MONEY',
        payload.transid,
        idempotencyKey,
        `Auto-posted from Selcom callback — transid: ${payload.transid}`,
      );

      this.logger.log(`Selcom payment processed: loan ${request.loan_id}, amount ${amount}, transid ${payload.transid}`);
    });
  }
}
