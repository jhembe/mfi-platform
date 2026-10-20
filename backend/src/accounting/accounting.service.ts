import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, Scope,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/create-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { JournalEntryStatus } from '@mfi/shared';

interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

interface JournalEntryRow {
  id: string;
  entry_ref: string;
  entry_date: Date;
  description: string;
  reference: string | null;
  status: string;
  is_system: boolean;
  created_by: string | null;
  posted_at: Date | null;
  voided_at: Date | null;
  void_reason: string | null;
  created_at: Date;
}

interface JournalLineRow {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit_amount: bigint;
  credit_amount: bigint;
  description: string | null;
}

interface CountRow { count: string }
interface BalanceRow { account_id: string; account_code: string; account_name: string; account_type: string; total_debit: string; total_credit: string }

function toAccount(row: AccountRow) {
  return {
    id: row.id, code: row.code, name: row.name, type: row.type,
    parentId: row.parent_id, description: row.description,
    isActive: row.is_active, isSystem: row.is_system,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function toEntry(row: JournalEntryRow) {
  return {
    id: row.id, entryRef: row.entry_ref, entryDate: row.entry_date,
    description: row.description, reference: row.reference,
    status: row.status, createdBy: row.created_by,
    postedAt: row.posted_at, voidedAt: row.voided_at, voidReason: row.void_reason,
    createdAt: row.created_at,
  };
}

function toLine(row: JournalLineRow) {
  return {
    id: row.id, journalEntryId: row.journal_entry_id, accountId: row.account_id,
    debitAmount: Number(row.debit_amount), creditAmount: Number(row.credit_amount),
    description: row.description,
  };
}

function generateEntryRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `JE-${year}-${rand}`;
}

@Injectable({ scope: Scope.REQUEST })
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private get s() { return this.tenantCtx.schemaName; }

  // ── Chart of Accounts ───────────────────────────────────────────────────────

  async listAccounts(includeInactive = false) {
    const s = this.s;
    const where = includeInactive ? '' : 'WHERE is_active = TRUE';
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `SELECT * FROM "${s}".accounts ${where} ORDER BY code ASC`,
    );
    return rows.map(toAccount);
  }

  async getAccount(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `SELECT * FROM "${this.s}".accounts WHERE id = $1::uuid`, id,
    );
    if (!rows.length) throw new NotFoundException('Account not found');
    return toAccount(rows[0]);
  }

  private async getAccountRaw(id: string): Promise<AccountRow> {
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `SELECT * FROM "${this.s}".accounts WHERE id = $1::uuid`, id,
    );
    if (!rows.length) throw new NotFoundException('Account not found');
    return rows[0];
  }

  async createAccount(dto: CreateAccountDto) {
    const s = this.s;
    const existing = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `SELECT id FROM "${s}".accounts WHERE code = $1`, dto.code,
    );
    if (existing.length) throw new ConflictException(`Account code ${dto.code} already exists`);

    if (dto.parentId) {
      const parent = await this.getAccountRaw(dto.parentId);
      if (parent.type !== dto.type) {
        throw new BadRequestException('Child account type must match parent account type');
      }
    }

    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `INSERT INTO "${s}".accounts (code, name, type, parent_id, description)
       VALUES ($1,$2,$3,$4::uuid,$5) RETURNING *`,
      dto.code, dto.name, dto.type, dto.parentId ?? null, dto.description ?? null,
    );
    return toAccount(rows[0]);
  }

  async updateAccount(id: string, dto: UpdateAccountDto) {
    const acct = await this.getAccountRaw(id);
    if (acct.is_system) throw new BadRequestException('System accounts cannot be modified');

    const s = this.s;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined) { sets.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.description !== undefined) { sets.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(dto.isActive); }

    params.push(id);
    const rows = await this.prisma.$queryRawUnsafe<AccountRow[]>(
      `UPDATE "${s}".accounts SET ${sets.join(', ')} WHERE id = $${idx}::uuid RETURNING *`,
      ...params,
    );
    return toAccount(rows[0]);
  }

  // ── Trial Balance ───────────────────────────────────────────────────────────

  async trialBalance(fromDate?: string, toDate?: string) {
    const s = this.s;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (fromDate) { conditions.push(`jel.created_at >= $${idx++}`); params.push(fromDate); }
    if (toDate) { conditions.push(`jel.created_at <= $${idx++}`); params.push(toDate + 'T23:59:59Z'); }
    const where = conditions.length ? `WHERE je.status = 'POSTED' AND ${conditions.join(' AND ')}` : `WHERE je.status = 'POSTED'`;

    const rows = await this.prisma.$queryRawUnsafe<BalanceRow[]>(
      `SELECT
         a.id AS account_id,
         a.code AS account_code,
         a.name AS account_name,
         a.type AS account_type,
         COALESCE(SUM(jel.debit_amount),0)::text  AS total_debit,
         COALESCE(SUM(jel.credit_amount),0)::text AS total_credit
       FROM "${s}".accounts a
       LEFT JOIN "${s}".journal_entry_lines jel ON jel.account_id = a.id
       LEFT JOIN "${s}".journal_entries je ON je.id = jel.journal_entry_id
       ${where}
       GROUP BY a.id, a.code, a.name, a.type
       HAVING COALESCE(SUM(jel.debit_amount),0) != 0 OR COALESCE(SUM(jel.credit_amount),0) != 0
       ORDER BY a.code ASC`,
      ...params,
    );

    const lines = rows.map(r => ({
      accountId: r.account_id,
      accountCode: r.account_code,
      accountName: r.account_name,
      accountType: r.account_type,
      totalDebit: Number(r.total_debit),
      totalCredit: Number(r.total_credit),
      balance: Number(r.total_debit) - Number(r.total_credit),
    }));

    const totalDebits = lines.reduce((s, l) => s + l.totalDebit, 0);
    const totalCredits = lines.reduce((s, l) => s + l.totalCredit, 0);

    return { lines, totalDebits, totalCredits, balanced: totalDebits === totalCredits };
  }

  // ── Journal Entries ─────────────────────────────────────────────────────────

  async listJournalEntries(options: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = options;
    const s = this.s;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<JournalEntryRow[]>(
        `SELECT * FROM "${s}".journal_entries ${where}
         ORDER BY entry_date DESC, created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::text FROM "${s}".journal_entries ${where}`,
        ...params.slice(0, -2),
      ),
    ]);

    return {
      data: rows.map(toEntry),
      meta: { total: parseInt(countRows[0].count, 10), page, limit },
    };
  }

  async getJournalEntry(id: string) {
    const s = this.s;
    const [rows, lineRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<JournalEntryRow[]>(
        `SELECT * FROM "${s}".journal_entries WHERE id = $1::uuid`, id,
      ),
      this.prisma.$queryRawUnsafe<JournalLineRow[]>(
        `SELECT * FROM "${s}".journal_entry_lines WHERE journal_entry_id = $1::uuid ORDER BY debit_amount DESC`,
        id,
      ),
    ]);
    if (!rows.length) throw new NotFoundException('Journal entry not found');
    return { ...toEntry(rows[0]), lines: lineRows.map(toLine) };
  }

  async createJournalEntry(dto: CreateJournalEntryDto, createdBy: string) {
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException('Journal entry must have at least 2 lines');
    }

    const totalDebits = dto.lines.reduce((s, l) => s + (l.debitAmount || 0), 0);
    const totalCredits = dto.lines.reduce((s, l) => s + (l.creditAmount || 0), 0);
    if (totalDebits !== totalCredits) {
      throw new BadRequestException(
        `Journal entry is not balanced: debits ${totalDebits} ≠ credits ${totalCredits}`,
      );
    }

    const s = this.s;
    const entryRef = generateEntryRef();

    return this.prisma.$transaction(async (tx) => {
      const entryRows = await tx.$queryRawUnsafe<JournalEntryRow[]>(
        `INSERT INTO "${s}".journal_entries
           (entry_ref, entry_date, description, reference, status, created_by, posted_at)
         VALUES ($1,$2,$3,$4,'POSTED',$5::uuid,NOW()) RETURNING *`,
        entryRef, dto.entryDate, dto.description, dto.reference ?? null, createdBy,
      );
      const entry = entryRows[0];

      const lines: JournalLineRow[] = [];
      for (const line of dto.lines) {
        const lineRows = await tx.$queryRawUnsafe<JournalLineRow[]>(
          `INSERT INTO "${s}".journal_entry_lines
             (journal_entry_id, account_id, debit_amount, credit_amount, description)
           VALUES ($1::uuid,$2::uuid,$3,$4,$5) RETURNING *`,
          entry.id, line.accountId,
          BigInt(Math.round(line.debitAmount)),
          BigInt(Math.round(line.creditAmount)),
          line.description ?? null,
        );
        lines.push(lineRows[0]);
      }

      return { ...toEntry(entry), lines: lines.map(toLine) };
    });
  }

  async voidJournalEntry(id: string, reason: string, voidedBy: string) {
    const s = this.s;
    const rows = await this.prisma.$queryRawUnsafe<JournalEntryRow[]>(
      `SELECT * FROM "${s}".journal_entries WHERE id = $1::uuid`, id,
    );
    if (!rows.length) throw new NotFoundException('Journal entry not found');
    if (rows[0].status !== JournalEntryStatus.POSTED) {
      throw new BadRequestException('Only posted entries can be voided');
    }
    if (rows[0].is_system as unknown as boolean) {
      throw new BadRequestException('System-generated entries cannot be voided');
    }

    const updated = await this.prisma.$queryRawUnsafe<JournalEntryRow[]>(
      `UPDATE "${s}".journal_entries
       SET status = 'VOIDED', voided_at = NOW(), void_reason = $1, voided_by = $2
       WHERE id = $3::uuid RETURNING *`,
      reason, voidedBy, id,
    );
    return toEntry(updated[0]);
  }

  async getAccountStatement(accountId: string, fromDate?: string, toDate?: string) {
    const s = this.s;
    await this.getAccountRaw(accountId);

    const conditions = [`jel.account_id = $1`, `je.status = 'POSTED'`];
    const params: unknown[] = [accountId];
    let idx = 2;

    if (fromDate) { conditions.push(`je.entry_date >= $${idx++}`); params.push(fromDate); }
    if (toDate) { conditions.push(`je.entry_date <= $${idx++}`); params.push(toDate); }

    const rows = await this.prisma.$queryRawUnsafe<{
      id: string; entry_date: Date; entry_ref: string; description: string;
      debit_amount: bigint; credit_amount: bigint;
    }[]>(
      `SELECT jel.id, je.entry_date, je.entry_ref, je.description,
              jel.debit_amount, jel.credit_amount
         FROM "${s}".journal_entry_lines jel
         JOIN "${s}".journal_entries je ON je.id = jel.journal_entry_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY je.entry_date ASC, je.created_at ASC`,
      ...params,
    );

    let runningBalance = 0;
    const lines = rows.map(r => {
      const debit = Number(r.debit_amount);
      const credit = Number(r.credit_amount);
      runningBalance += debit - credit;
      return {
        id: r.id, entryDate: r.entry_date, entryRef: r.entry_ref,
        description: r.description, debitAmount: debit, creditAmount: credit,
        runningBalance,
      };
    });

    return { accountId, lines, closingBalance: runningBalance };
  }

  async getStats() {
    const s = this.s;
    const [accountRows, entryRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<[{ total: string; active: string }]>(
        `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE is_active)::text AS active
         FROM "${s}".accounts`,
      ),
      this.prisma.$queryRawUnsafe<[{ posted: string; this_month: string }]>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'POSTED')::text AS posted,
           COUNT(*) FILTER (
             WHERE status = 'POSTED'
               AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
           )::text AS this_month
         FROM "${s}".journal_entries`,
      ),
    ]);
    return {
      totalAccounts: parseInt(accountRows[0].total, 10),
      activeAccounts: parseInt(accountRows[0].active, 10),
      postedEntries: parseInt(entryRows[0].posted, 10),
      entriesThisMonth: parseInt(entryRows[0].this_month, 10),
    };
  }
}
