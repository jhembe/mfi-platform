import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, Scope,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { SavingsProductsService } from './savings-products.service';
import { CreateSavingsAccountDto } from './dto/create-savings-account.dto';
import { TransactionDto } from './dto/transaction.dto';
import { SavingsAccountStatus, SavingsTransactionType } from '@mfi/shared';

interface AccountRow {
  id: string;
  account_ref: string;
  client_id: string;
  product_id: string;
  balance: bigint;
  status: string;
  notes: string | null;
  opened_at: Date;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TxRow {
  id: string;
  account_id: string;
  transaction_type: string;
  amount: bigint;
  balance_after: bigint;
  channel: string;
  reference: string;
  idempotency_key: string;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
}

function toAccountResponse(row: AccountRow) {
  return {
    id: row.id,
    accountRef: row.account_ref,
    clientId: row.client_id,
    productId: row.product_id,
    balance: Number(row.balance),
    status: row.status,
    notes: row.notes,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTxResponse(row: TxRow) {
  return {
    id: row.id,
    accountId: row.account_id,
    transactionType: row.transaction_type,
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    channel: row.channel,
    reference: row.reference,
    idempotencyKey: row.idempotency_key,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function generateAccountRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `SAV-${year}-${rand}`;
}

@Injectable({ scope: Scope.REQUEST })
export class SavingsAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
    private readonly products: SavingsProductsService,
  ) {}

  async open(dto: CreateSavingsAccountDto, openedBy: string) {
    await this.products.findOneRaw(dto.productId);
    const s = this.tenantCtx.schemaName;
    const accountRef = generateAccountRef();
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `INSERT INTO "${s}".savings_accounts
        (account_ref, client_id, product_id, notes)
       VALUES ($1, $2::uuid, $3::uuid, $4)       RETURNING *`,
      accountRef, dto.clientId, dto.productId, dto.notes ?? null,
    );
    void openedBy;
    return toAccountResponse(rows[0]);
  }

  async list(options: { clientId?: string; status?: string; page?: number; limit?: number }) {
    const { clientId, status, page = 1, limit = 20 } = options;
    const s = this.tenantCtx.schemaName;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (clientId) { conditions.push(`client_id = $${idx++}::uuid`); params.push(clientId); }
    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }

    const where = conditions.join(' AND ');
    params.push(limit, offset);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<AccountRow[]>(
        `SELECT * FROM "${s}".savings_accounts WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text FROM "${s}".savings_accounts WHERE ${where}`,
        ...params.slice(0, -2),
      ),
    ]);

    return {
      data: rows.map(toAccountResponse),
      meta: { total: parseInt(countRows[0].count, 10), page, limit },
    };
  }

  async findOne(id: string) {
    return toAccountResponse(await this.findOneRaw(id));
  }

  private async findOneRaw(id: string): Promise<AccountRow> {
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `SELECT * FROM "${s}".savings_accounts WHERE id = $1::uuid AND deleted_at IS NULL`,
      id,
    );
    if (!rows.length) throw new NotFoundException('Savings account not found');
    return rows[0];
  }

  async getStats() {
    const s = this.tenantCtx.schemaName;
    const [activeRows, depositRows, withdrawalRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<[{ count: string; total_balance: string }]>(
        `SELECT COUNT(*)::text AS count, COALESCE(SUM(balance),0)::text AS total_balance
           FROM "${s}".savings_accounts WHERE status = 'ACTIVE' AND deleted_at IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; total: string }]>(
        `SELECT COUNT(*)::text AS count, COALESCE(SUM(amount),0)::text AS total
           FROM "${s}".savings_transactions
          WHERE transaction_type = 'DEPOSIT'
            AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; total: string }]>(
        `SELECT COUNT(*)::text AS count, COALESCE(SUM(amount),0)::text AS total
           FROM "${s}".savings_transactions
          WHERE transaction_type = 'WITHDRAWAL'
            AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')`,
      ),
    ]);

    return {
      activeAccounts: {
        count: parseInt(activeRows[0].count, 10),
        totalBalance: Number(activeRows[0].total_balance),
      },
      depositsThisMonth: {
        count: parseInt(depositRows[0].count, 10),
        total: Number(depositRows[0].total),
      },
      withdrawalsThisMonth: {
        count: parseInt(withdrawalRows[0].count, 10),
        total: Number(withdrawalRows[0].total),
      },
    };
  }

  private async recordTransaction(
    accountId: string,
    type: SavingsTransactionType,
    amount: bigint,
    newBalance: bigint,
    channel: string,
    reference: string,
    idempotencyKey: string,
    notes: string | null,
    createdBy: string | null,
  ) {
    const s = this.tenantCtx.schemaName;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${s}".savings_transactions
        (account_id, transaction_type, amount, balance_after, channel, reference, idempotency_key, notes, created_by)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid)`,
      accountId, type, amount, newBalance, channel, reference, idempotencyKey, notes, createdBy,
    );
  }

  async deposit(id: string, dto: TransactionDto, cashierId: string) {
    const account = await this.findOneRaw(id);
    if (account.status !== SavingsAccountStatus.ACTIVE) {
      throw new BadRequestException(`Cannot deposit to a ${account.status} account`);
    }

    const idempotencyKey = dto.idempotencyKey ?? `dep-${id}-${Date.now()}`;
    const reference = dto.reference ?? idempotencyKey;
    const s = this.tenantCtx.schemaName;

    const existing = await this.prisma.$queryRawUnsafe<[{ id: string }]>(
      `SELECT id FROM "${s}".savings_transactions WHERE idempotency_key = $1`,
      idempotencyKey,
    );
    if (existing.length) throw new ConflictException('Deposit already processed');

    const newBalance = account.balance + BigInt(dto.amount);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "${s}".savings_accounts SET balance = $1, updated_at = NOW() WHERE id = $2::uuid`,
      newBalance, id,
    );

    await this.recordTransaction(
      id, SavingsTransactionType.DEPOSIT, BigInt(dto.amount), newBalance,
      dto.channel, reference, idempotencyKey, dto.notes ?? null, cashierId,
    );

    return this.findOne(id);
  }

  async withdraw(id: string, dto: TransactionDto, cashierId: string) {
    const account = await this.findOneRaw(id);
    if (account.status !== SavingsAccountStatus.ACTIVE) {
      throw new BadRequestException(`Cannot withdraw from a ${account.status} account`);
    }

    const product = await this.products.findOneRaw(account.product_id);
    const minBalance = product.min_balance;
    const available = account.balance - minBalance;

    if (BigInt(dto.amount) > available) {
      throw new BadRequestException(
        `Insufficient funds. Available for withdrawal: ${Number(available)} TZS (min balance: ${Number(minBalance)} TZS)`,
      );
    }

    const idempotencyKey = dto.idempotencyKey ?? `wdr-${id}-${Date.now()}`;
    const reference = dto.reference ?? idempotencyKey;
    const s = this.tenantCtx.schemaName;

    const existing = await this.prisma.$queryRawUnsafe<[{ id: string }]>(
      `SELECT id FROM "${s}".savings_transactions WHERE idempotency_key = $1`,
      idempotencyKey,
    );
    if (existing.length) throw new ConflictException('Withdrawal already processed');

    const newBalance = account.balance - BigInt(dto.amount);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "${s}".savings_accounts SET balance = $1, updated_at = NOW() WHERE id = $2::uuid`,
      newBalance, id,
    );

    await this.recordTransaction(
      id, SavingsTransactionType.WITHDRAWAL, BigInt(dto.amount), newBalance,
      dto.channel, reference, idempotencyKey, dto.notes ?? null, cashierId,
    );

    return this.findOne(id);
  }

  async freeze(id: string) {
    const account = await this.findOneRaw(id);
    if (account.status !== SavingsAccountStatus.ACTIVE) {
      throw new BadRequestException(`Account is already ${account.status}`);
    }
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `UPDATE "${s}".savings_accounts SET status = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING *`,
      SavingsAccountStatus.FROZEN, id,
    );
    return toAccountResponse(rows[0]);
  }

  async unfreeze(id: string) {
    const account = await this.findOneRaw(id);
    if (account.status !== SavingsAccountStatus.FROZEN) {
      throw new BadRequestException('Account is not frozen');
    }
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `UPDATE "${s}".savings_accounts SET status = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING *`,
      SavingsAccountStatus.ACTIVE, id,
    );
    return toAccountResponse(rows[0]);
  }

  async close(id: string) {
    const account = await this.findOneRaw(id);
    if (account.status === SavingsAccountStatus.CLOSED) {
      throw new BadRequestException('Account is already closed');
    }
    if (account.balance > 0n) {
      throw new BadRequestException(
        `Cannot close account with balance of ${Number(account.balance)} TZS. Withdraw all funds first.`,
      );
    }
    const s = this.tenantCtx.schemaName;
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `UPDATE "${s}".savings_accounts
       SET status = $1, closed_at = NOW(), updated_at = NOW()
       WHERE id = $2::uuid RETURNING *`,
      SavingsAccountStatus.CLOSED, id,
    );
    return toAccountResponse(rows[0]);
  }

  async getTransactions(id: string, page = 1, limit = 50) {
    await this.findOneRaw(id);
    const s = this.tenantCtx.schemaName;
    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<TxRow[]>(
        `SELECT * FROM "${s}".savings_transactions WHERE account_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        id, limit, offset,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text FROM "${s}".savings_transactions WHERE account_id = $1`,
        id,
      ),
    ]);

    return {
      data: rows.map(toTxResponse),
      meta: { total: parseInt(countRows[0].count, 10), page, limit },
    };
  }
}
