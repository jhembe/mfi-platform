import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, Scope,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { LoanProductsService } from './loan-products.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { RecordRepaymentDto } from './dto/record-repayment.dto';
import { generateSchedule } from './schedule.calculator';
import { LoanStatus, InterestMethod, RepaymentFrequency } from '@mfi/shared';
import { SmsService } from '../sms/sms.service';

interface LoanRow {
  id: string;
  loan_ref: string;
  client_id: string;
  product_id: string;
  officer_id: string;
  term_months: number;
  repayment_frequency: string;
  interest_method: string;
  interest_rate: string;
  principal_amount: bigint;
  processing_fee: bigint;
  disbursed_amount: bigint;
  outstanding_balance: bigint;
  status: string;
  notes: string | null;
  applied_at: Date;
  approved_at: Date | null;
  approved_by: string | null;
  disbursed_at: Date | null;
  maturity_date: Date | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ScheduleRow {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: Date;
  principal_due: bigint;
  interest_due: bigint;
  fees_due: bigint;
  penalties_due: bigint;
  total_due: bigint;
  paid_amount: bigint;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface LedgerRow {
  id: string;
  loan_id: string;
  transaction_type: string;
  debit_account: string;
  credit_account: string;
  amount: bigint;
  channel: string;
  reference: string;
  idempotency_key: string;
  notes: string | null;
  created_at: Date;
}

function toLoanResponse(row: LoanRow) {
  return {
    id: row.id,
    loanRef: row.loan_ref,
    clientId: row.client_id,
    productId: row.product_id,
    officerId: row.officer_id,
    termMonths: row.term_months,
    repaymentFrequency: row.repayment_frequency,
    interestMethod: row.interest_method,
    interestRate: parseFloat(row.interest_rate),
    principalAmount: Number(row.principal_amount),
    processingFee: Number(row.processing_fee),
    disbursedAmount: Number(row.disbursed_amount),
    outstandingBalance: Number(row.outstanding_balance),
    status: row.status,
    notes: row.notes,
    appliedAt: row.applied_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    disbursedAt: row.disbursed_at,
    maturityDate: row.maturity_date,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toScheduleResponse(row: ScheduleRow) {
  return {
    id: row.id,
    loanId: row.loan_id,
    installmentNo: row.installment_no,
    dueDate: row.due_date,
    principalDue: Number(row.principal_due),
    interestDue: Number(row.interest_due),
    feesDue: Number(row.fees_due),
    penaltiesDue: Number(row.penalties_due),
    totalDue: Number(row.total_due),
    paidAmount: Number(row.paid_amount),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toLedgerResponse(row: LedgerRow) {
  return {
    id: row.id,
    loanId: row.loan_id,
    transactionType: row.transaction_type,
    debitAccount: row.debit_account,
    creditAccount: row.credit_account,
    amount: Number(row.amount),
    channel: row.channel,
    reference: row.reference,
    idempotencyKey: row.idempotency_key,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function generateLoanRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `LN-${year}-${rand}`;
}

@Injectable({ scope: Scope.REQUEST })
export class LoanAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
    private readonly loanProducts: LoanProductsService,
    private readonly sms: SmsService,
  ) {}

  async create(dto: CreateLoanDto, officerId: string) {
    const product = await this.loanProducts.findOneRaw(dto.productId);

    if (dto.principalAmount < Number(product.min_amount) || dto.principalAmount > Number(product.max_amount)) {
      throw new BadRequestException(
        `Principal must be between ${Number(product.min_amount)} and ${Number(product.max_amount)}`,
      );
    }

    if (dto.termMonths < product.min_term_months || dto.termMonths > product.max_term_months) {
      throw new BadRequestException(
        `Term must be between ${product.min_term_months} and ${product.max_term_months} months`,
      );
    }

    const processingFee = BigInt(
      Math.round(dto.principalAmount * parseFloat(product.processing_fee_percent) / 100),
    );

    const s = this.tenantCtx.schemaName;
    const loanRef = generateLoanRef();

    const rows = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `INSERT INTO "${s}".loan_accounts
        (loan_ref,client_id,product_id,officer_id,
         term_months,repayment_frequency,interest_method,interest_rate,
         principal_amount,processing_fee,notes)
       VALUES ($1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      loanRef, dto.clientId, dto.productId, officerId,
      dto.termMonths, product.repayment_frequency, product.interest_method, product.interest_rate,
      BigInt(dto.principalAmount), processingFee, dto.notes ?? null,
    );
    return toLoanResponse(rows[0]);
  }

  async list(options: { clientId?: string; officerId?: string; status?: string; page?: number; limit?: number }) {
    const { clientId, officerId, status, page = 1, limit = 20 } = options;
    const s = this.tenantCtx.schemaName;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (clientId) { conditions.push(`client_id = $${idx++}::uuid`); params.push(clientId); }
    if (officerId) { conditions.push(`officer_id = $${idx++}::uuid`); params.push(officerId); }
    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }

    const where = conditions.join(' AND ');
    params.push(limit, offset);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<LoanRow[]>(
        `SELECT * FROM "${s}".loan_accounts WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text FROM "${s}".loan_accounts WHERE ${where}`,
        ...params.slice(0, -2),
      ),
    ]);

    return {
      data: rows.map(toLoanResponse),
      meta: { total: parseInt(countRows[0].count, 10), page, limit },
    };
  }

  async findOne(id: string) {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `SELECT * FROM "${s}".loan_accounts WHERE id = $1::uuid AND deleted_at IS NULL`,
      id,
    );
    if (!rows.length) throw new NotFoundException('Loan not found');
    return toLoanResponse(rows[0]);
  }

  private async findOneRaw(id: string): Promise<LoanRow> {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `SELECT * FROM "${s}".loan_accounts WHERE id = $1::uuid AND deleted_at IS NULL`,
      id,
    );
    if (!rows.length) throw new NotFoundException('Loan not found');
    return rows[0];
  }

  async submit(id: string) {
    const loan = await this.findOneRaw(id);
    if (loan.status !== LoanStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit a loan in status ${loan.status}`);
    }
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `UPDATE "${s}".loan_accounts SET status = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING *`,
      LoanStatus.PENDING, id,
    );
    return toLoanResponse(rows[0]);
  }

  async approve(id: string, approverId: string) {
    const loan = await this.findOneRaw(id);
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(`Cannot approve a loan in status ${loan.status}`);
    }
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `UPDATE "${s}".loan_accounts
       SET status = $1, approved_at = NOW(), approved_by = $2::uuid, updated_at = NOW()
       WHERE id = $3::uuid RETURNING *`,
      LoanStatus.APPROVED, approverId, id,
    );
    return toLoanResponse(rows[0]);
  }

  async reject(id: string) {
    const loan = await this.findOneRaw(id);
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(`Cannot reject a loan in status ${loan.status}`);
    }
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `UPDATE "${s}".loan_accounts SET status = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING *`,
      LoanStatus.DRAFT, id,
    );
    return toLoanResponse(rows[0]);
  }

  async disburse(id: string, dto: DisburseLoanDto, disburserId: string) {
    const loan = await this.findOneRaw(id);
    if (loan.status !== LoanStatus.APPROVED) {
      throw new BadRequestException(`Cannot disburse a loan in status ${loan.status}`);
    }

    const idempotencyKey = dto.idempotencyKey ?? `disburse-${id}-${Date.now()}`;
    const reference = dto.reference ?? idempotencyKey;
    const s = this.tenantCtx.schemaName;

    // Check idempotency
    const existing = await this.prisma.$queryRawUnsafe<LedgerRow[]>(
      `SELECT id FROM "${s}".ledger_entries WHERE idempotency_key = $1`,
      idempotencyKey,
    );
    if (existing.length) throw new ConflictException('Disbursement already processed');

    const disbursedAt = new Date();
    const disbursedAmount = loan.principal_amount;

    // Generate repayment schedule
    const schedule = generateSchedule({
      principal: loan.principal_amount,
      annualRatePct: parseFloat(loan.interest_rate),
      termMonths: loan.term_months,
      frequency: loan.repayment_frequency as RepaymentFrequency,
      interestMethod: loan.interest_method as InterestMethod,
      disbursementDate: disbursedAt,
    });

    const maturityDate = schedule[schedule.length - 1].dueDate;

    // Persist everything in a transaction-like sequence (raw SQL, no Prisma tx for tenant schema)
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${s}".loan_accounts
       SET status = $1, disbursed_at = $2, disbursed_amount = $3,
           outstanding_balance = $3, maturity_date = $4, updated_at = NOW()
       WHERE id = $5::uuid`,
      LoanStatus.ACTIVE, disbursedAt, disbursedAmount, maturityDate, id,
    );

    // Insert schedule rows
    for (const line of schedule) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "${s}".repayment_schedule
          (loan_id,installment_no,due_date,principal_due,interest_due,fees_due,total_due)
         VALUES ($1::uuid,$2,$3,$4,$5,$6,$7)`,
        id, line.installmentNo, line.dueDate,
        line.principalDue, line.interestDue, line.feesDue,
        line.totalDue,
      );
    }

    // Create disbursement ledger entry
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".ledger_entries
        (loan_id,transaction_type,debit_account,credit_account,
         amount,channel,reference,idempotency_key,notes)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9)`,
      id, 'DISBURSEMENT', 'loans_receivable', 'cash_on_hand',
      disbursedAmount, dto.channel, reference, idempotencyKey,
      `Disbursed by ${disburserId}`,
    );

    const result = await this.findOne(id);
    await this.notifyClientDisbursement(loan.client_id, result.loanRef, Number(disbursedAmount));
    return result;
  }

  private async notifyClientDisbursement(clientId: string, loanRef: string, amount: number): Promise<void> {
    const s = this.tenantCtx.schemaName;
    try {
      const rows = await this.prisma.$queryRawUnsafe<[{ phone: string; first_name: string }?]>(
        `SELECT phone, first_name FROM "${s}".clients WHERE id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
        clientId,
      );
      const client = rows[0];
      if (!client) return;
      const formatted = new Intl.NumberFormat('en-TZ').format(amount);
      await this.sms.send(
        client.phone,
        `Habari ${client.first_name}, mkopo wako wa TZS ${formatted} (Kumb: ${loanRef}) umetolewa leo. Asante kwa kuchagua huduma yetu.`,
      );
    } catch {
      // SMS failure must not roll back the disbursement
    }
  }

  async sendRepaymentReminder(loanId: string): Promise<void> {
    const loan = await this.findOneRaw(loanId);
    if (loan.status !== LoanStatus.ACTIVE) return;

    const s = this.tenantCtx.schemaName;
    const clientRows = await this.prisma.$queryRawUnsafe<[{ phone: string; first_name: string }?]>(
      `SELECT phone, first_name FROM "${s}".clients WHERE id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
      loan.client_id,
    );
    const client = clientRows[0];
    if (!client) return;

    const overdueRows = await this.prisma.$queryRawUnsafe<{ due_date: Date; total_due: bigint; paid_amount: bigint }[]>(
      `SELECT due_date, total_due, paid_amount FROM "${s}".repayment_schedule
        WHERE loan_id = $1::uuid AND status IN ('PENDING','PARTIAL','OVERDUE') AND due_date <= CURRENT_DATE
        ORDER BY due_date ASC LIMIT 1`,
      loanId,
    );

    if (overdueRows.length === 0) {
      const nextRows = await this.prisma.$queryRawUnsafe<{ due_date: Date; total_due: bigint }[]>(
        `SELECT due_date, total_due FROM "${s}".repayment_schedule
          WHERE loan_id = $1::uuid AND status IN ('PENDING','PARTIAL') AND due_date > CURRENT_DATE
          ORDER BY due_date ASC LIMIT 1`,
        loanId,
      );
      if (!nextRows.length) return;
      const next = nextRows[0];
      const amt = new Intl.NumberFormat('en-TZ').format(Number(next.total_due));
      const date = new Date(next.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      await this.sms.send(
        client.phone,
        `Habari ${client.first_name}, ukumbusho: malipo ya mkopo wako (${loan.loan_ref}) ya TZS ${amt} yanastahili kulipwa tarehe ${date}. Tafadhali lipa kwa wakati.`,
      );
    } else {
      const overdue = overdueRows[0];
      const remaining = Number(overdue.total_due) - Number(overdue.paid_amount);
      const amt = new Intl.NumberFormat('en-TZ').format(remaining);
      await this.sms.send(
        client.phone,
        `Habari ${client.first_name}, KUMBUSHO: Mkopo wako (${loan.loan_ref}) una malipo ya TZS ${amt} ambayo yamechelewa. Tafadhali lipa haraka ili kuepuka faini.`,
      );
    }
  }

  async getSchedule(id: string) {
    await this.findOne(id);
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<ScheduleRow[]>(
      `SELECT * FROM "${s}".repayment_schedule WHERE loan_id = $1::uuid ORDER BY installment_no ASC`,
      id,
    );
    return rows.map(toScheduleResponse);
  }

  async getLedger(id: string) {
    await this.findOne(id);
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<LedgerRow[]>(
      `SELECT * FROM "${s}".ledger_entries WHERE loan_id = $1::uuid ORDER BY created_at DESC`,
      id,
    );
    return rows.map(toLedgerResponse);
  }

  async recordRepayment(id: string, dto: RecordRepaymentDto, cashierId: string) {
    const loan = await this.findOneRaw(id);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException(`Cannot record repayment on a loan in status ${loan.status}`);
    }

    const idempotencyKey = dto.idempotencyKey ?? `repay-${id}-${Date.now()}`;
    const reference = dto.reference ?? idempotencyKey;
    const s = this.tenantCtx.schemaName;

    const existing = await this.prisma.$queryRawUnsafe<LedgerRow[]>(
      `SELECT id FROM "${s}".ledger_entries WHERE idempotency_key = $1`,
      idempotencyKey,
    );
    if (existing.length) throw new ConflictException('Repayment already recorded');

    let remaining = BigInt(dto.amount);
    const outstandingBalance = loan.outstanding_balance;

    if (remaining > outstandingBalance) {
      throw new BadRequestException(`Repayment amount exceeds outstanding balance of ${Number(outstandingBalance)}`);
    }

    // Get pending/partial installments ordered by due date
    const installments = await this.prisma.$queryRawUnsafe<ScheduleRow[]>(
      `SELECT * FROM "${s}".repayment_schedule
       WHERE loan_id = $1::uuid AND status IN ('PENDING','PARTIAL','OVERDUE')
       ORDER BY installment_no ASC`,
      id,
    );

    // Allocation order: penalties → fees → interest → principal
    for (const inst of installments) {
      if (remaining <= 0n) break;

      const alreadyPaid = inst.paid_amount;
      const penaltiesDue = inst.penalties_due;
      const feesDue = inst.fees_due;
      const interestDue = inst.interest_due;
      const principalDue = inst.principal_due;
      const totalDue = inst.total_due;

      const totalRemaining = totalDue - alreadyPaid;
      if (totalRemaining <= 0n) continue;

      const toApply = remaining > totalRemaining ? totalRemaining : remaining;
      remaining -= toApply;

      const newPaid = alreadyPaid + toApply;
      const newStatus = newPaid >= totalDue ? 'PAID' : 'PARTIAL';

      await this.prisma.$executeRawUnsafe(
        `UPDATE "${s}".repayment_schedule
         SET paid_amount = $1, status = $2, updated_at = NOW()
         WHERE id = $3::uuid`,
        newPaid, newStatus, inst.id,
      );

      // Suppress unused variable warnings for the allocation fields we track but don't yet
      void penaltiesDue; void feesDue; void interestDue; void principalDue;
    }

    const newBalance = outstandingBalance - BigInt(dto.amount);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "${s}".loan_accounts
       SET outstanding_balance = $1,
           status = CASE WHEN $1 = 0 THEN $2 ELSE status END,
           closed_at = CASE WHEN $1 = 0 THEN NOW() ELSE closed_at END,
           updated_at = NOW()
       WHERE id = $3::uuid`,
      newBalance, LoanStatus.CLOSED, id,
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".ledger_entries
        (loan_id,transaction_type,debit_account,credit_account,
         amount,channel,reference,idempotency_key,notes)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9)`,
      id, 'REPAYMENT', 'cash_on_hand', 'loans_receivable',
      BigInt(dto.amount), dto.channel, reference, idempotencyKey,
      dto.notes ?? `Repayment by ${cashierId}`,
    );

    return this.findOne(id);
  }

  async getStats() {
    const s = this.tenantCtx.schemaName;
    const now = new Date();

    const [
      activeRows,
      disbRows,
      collectRows,
      par30Rows,
      par90Rows,
      pendingRows,
      approvedRows,
      clientRows,
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe<[{ count: string; total_balance: string; total_principal: string }]>(
        `SELECT COUNT(*)::text AS count,
                COALESCE(SUM(outstanding_balance),0)::text AS total_balance,
                COALESCE(SUM(principal_amount),0)::text AS total_principal
           FROM "${s}".loan_accounts
          WHERE status = 'ACTIVE' AND deleted_at IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; total: string }]>(
        `SELECT COUNT(*)::text AS count,
                COALESCE(SUM(amount),0)::text AS total
           FROM "${s}".ledger_entries
          WHERE transaction_type = 'DISBURSEMENT'
            AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; total: string }]>(
        `SELECT COUNT(*)::text AS count,
                COALESCE(SUM(amount),0)::text AS total
           FROM "${s}".ledger_entries
          WHERE transaction_type = 'REPAYMENT'
            AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; balance: string }]>(
        `SELECT COUNT(DISTINCT la.id)::text AS count,
                COALESCE(SUM(la.outstanding_balance),0)::text AS balance
           FROM "${s}".loan_accounts la
          WHERE la.status = 'ACTIVE' AND la.deleted_at IS NULL
            AND EXISTS (
              SELECT 1 FROM "${s}".repayment_schedule rs
               WHERE rs.loan_id = la.id
                 AND rs.status IN ('PENDING','PARTIAL','OVERDUE')
                 AND rs.due_date < $1::date - INTERVAL '30 days'
            )`,
        now,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; balance: string }]>(
        `SELECT COUNT(DISTINCT la.id)::text AS count,
                COALESCE(SUM(la.outstanding_balance),0)::text AS balance
           FROM "${s}".loan_accounts la
          WHERE la.status = 'ACTIVE' AND la.deleted_at IS NULL
            AND EXISTS (
              SELECT 1 FROM "${s}".repayment_schedule rs
               WHERE rs.loan_id = la.id
                 AND rs.status IN ('PENDING','PARTIAL','OVERDUE')
                 AND rs.due_date < $1::date - INTERVAL '90 days'
            )`,
        now,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text AS count FROM "${s}".loan_accounts
          WHERE status = 'PENDING' AND deleted_at IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text AS count FROM "${s}".loan_accounts
          WHERE status = 'APPROVED' AND deleted_at IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text AS count FROM "${s}".clients WHERE deleted_at IS NULL`,
      ),
    ]);

    const activeBalance = Number(activeRows[0].total_balance);
    const par30Balance = Number(par30Rows[0].balance);
    const par90Balance = Number(par90Rows[0].balance);

    return {
      activeLoans: {
        count: parseInt(activeRows[0].count, 10),
        totalBalance: activeBalance,
        totalPrincipal: Number(activeRows[0].total_principal),
      },
      disbursementsThisMonth: {
        count: parseInt(disbRows[0].count, 10),
        total: Number(disbRows[0].total),
      },
      collectionsToday: {
        count: parseInt(collectRows[0].count, 10),
        total: Number(collectRows[0].total),
      },
      par30: {
        count: parseInt(par30Rows[0].count, 10),
        balance: par30Balance,
        pct: activeBalance > 0 ? Math.round((par30Balance / activeBalance) * 10000) / 100 : 0,
      },
      par90: {
        count: parseInt(par90Rows[0].count, 10),
        balance: par90Balance,
        pct: activeBalance > 0 ? Math.round((par90Balance / activeBalance) * 10000) / 100 : 0,
      },
      pendingApprovals: parseInt(pendingRows[0].count, 10),
      awaitingDisbursement: parseInt(approvedRows[0].count, 10),
      totalClients: parseInt(clientRows[0].count, 10),
    };
  }

  async getOfficerStats(officerId: string) {
    const s = this.tenantCtx.schemaName;
    const now = new Date();

    const [activeRows, overdueRows, collectRows, pendingRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<[{ count: string; total_balance: string }]>(
        `SELECT COUNT(*)::text AS count,
                COALESCE(SUM(outstanding_balance),0)::text AS total_balance
           FROM "${s}".loan_accounts
          WHERE officer_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
        officerId,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; balance: string }]>(
        `SELECT COUNT(DISTINCT la.id)::text AS count,
                COALESCE(SUM(la.outstanding_balance),0)::text AS balance
           FROM "${s}".loan_accounts la
          WHERE la.officer_id = $1 AND la.status = 'ACTIVE' AND la.deleted_at IS NULL
            AND EXISTS (
              SELECT 1 FROM "${s}".repayment_schedule rs
               WHERE rs.loan_id = la.id
                 AND rs.status IN ('PENDING','PARTIAL','OVERDUE')
                 AND rs.due_date < $2::date
            )`,
        officerId, now,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; total: string }]>(
        `SELECT COUNT(le.id)::text AS count,
                COALESCE(SUM(le.amount),0)::text AS total
           FROM "${s}".ledger_entries le
           JOIN "${s}".loan_accounts la ON la.id = le.loan_id
          WHERE la.officer_id = $1
            AND le.transaction_type = 'REPAYMENT'
            AND le.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')`,
        officerId,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text AS count FROM "${s}".loan_accounts
          WHERE officer_id = $1 AND status = 'PENDING' AND deleted_at IS NULL`,
        officerId,
      ),
    ]);

    return {
      activeLoans: {
        count: parseInt(activeRows[0].count, 10),
        totalBalance: Number(activeRows[0].total_balance),
      },
      overdueLoans: {
        count: parseInt(overdueRows[0].count, 10),
        balance: Number(overdueRows[0].balance),
      },
      collectionsToday: {
        count: parseInt(collectRows[0].count, 10),
        total: Number(collectRows[0].total),
      },
      pendingApprovals: parseInt(pendingRows[0].count, 10),
    };
  }

  async writeOff(id: string, reason: string) {
    const loan = await this.findOneRaw(id);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException(`Cannot write off a loan in status ${loan.status}`);
    }
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `UPDATE "${s}".loan_accounts
       SET status = $1, closed_at = NOW(), notes = COALESCE(notes || E'\\n', '') || $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      LoanStatus.WRITTEN_OFF, `WRITTEN OFF: ${reason}`, id,
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".ledger_entries
        (loan_id,transaction_type,debit_account,credit_account,
         amount,channel,reference,idempotency_key,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      id, 'REVERSAL', 'bad_debt_expense', 'loans_receivable',
      loan.outstanding_balance, 'CASH', `write-off-${id}`, `write-off-${id}-${Date.now()}`,
      `Written off: ${reason}`,
    );

    return toLoanResponse(rows[0]);
  }
}
