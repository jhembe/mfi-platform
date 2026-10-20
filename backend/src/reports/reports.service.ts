import { Injectable, Scope } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable({ scope: Scope.REQUEST })
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private get s() { return this.tenantCtx.schemaName; }

  // ── Portfolio Report ────────────────────────────────────────────────────────

  async portfolioReport(fromDate?: string, toDate?: string) {
    const s = this.s;
    const dateCond = this.dateCondition('la.created_at', fromDate, toDate);

    const [byProduct, byStatus, parBands] = await Promise.all([
      this.prisma.$queryRawUnsafe<{
        product_name: string;
        count: string;
        total_principal: string;
        total_outstanding: string;
      }[]>(
        `SELECT
           lp.name AS product_name,
           COUNT(la.id)::text AS count,
           COALESCE(SUM(la.principal_amount),0)::text AS total_principal,
           COALESCE(SUM(la.outstanding_balance),0)::text AS total_outstanding
         FROM "${s}".loan_accounts la
         JOIN "${s}".loan_products lp ON lp.id = la.product_id
         WHERE la.deleted_at IS NULL ${dateCond ? 'AND ' + dateCond : ''}
         GROUP BY lp.name ORDER BY total_outstanding DESC`,
      ),
      this.prisma.$queryRawUnsafe<{ status: string; count: string; total_outstanding: string }[]>(
        `SELECT
           status,
           COUNT(*)::text AS count,
           COALESCE(SUM(outstanding_balance),0)::text AS total_outstanding
         FROM "${s}".loan_accounts
         WHERE deleted_at IS NULL ${dateCond ? 'AND ' + dateCond : ''}
         GROUP BY status ORDER BY status`,
      ),
      this.prisma.$queryRawUnsafe<{ band: string; count: string; balance: string }[]>(
        `SELECT band, COUNT(DISTINCT loan_id)::text AS count, COALESCE(SUM(balance),0)::text AS balance
         FROM (
           SELECT la.id AS loan_id, la.outstanding_balance AS balance,
             CASE
               WHEN MAX(rs.due_date) < CURRENT_DATE - INTERVAL '90 days' THEN '90+'
               WHEN MAX(rs.due_date) < CURRENT_DATE - INTERVAL '30 days' THEN '30-90'
               WHEN MAX(rs.due_date) < CURRENT_DATE THEN '1-30'
               ELSE 'current'
             END AS band
           FROM "${s}".loan_accounts la
           JOIN "${s}".repayment_schedule rs ON rs.loan_id = la.id AND rs.status != 'PAID'
           WHERE la.status = 'ACTIVE' AND la.deleted_at IS NULL
           GROUP BY la.id, la.outstanding_balance
         ) sub
         GROUP BY band ORDER BY band`,
      ),
    ]);

    return {
      byProduct: byProduct.map(r => ({
        productName: r.product_name,
        count: parseInt(r.count, 10),
        totalPrincipal: Number(r.total_principal),
        totalOutstanding: Number(r.total_outstanding),
      })),
      byStatus: byStatus.map(r => ({
        status: r.status,
        count: parseInt(r.count, 10),
        totalOutstanding: Number(r.total_outstanding),
      })),
      parBands: parBands.map(r => ({ band: r.band, count: parseInt(r.count, 10), balance: Number(r.balance) })),
    };
  }

  // ── Disbursements Report ────────────────────────────────────────────────────

  async disbursementsReport(fromDate?: string, toDate?: string) {
    const s = this.s;
    const dateCond = this.dateCondition('la.disbursed_at', fromDate, toDate);
    const where = `la.disbursed_at IS NOT NULL AND la.deleted_at IS NULL${dateCond ? ' AND ' + dateCond : ''}`;

    const [daily, byProduct, byChannel] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ day: Date; count: string; amount: string }[]>(
        `SELECT
           DATE_TRUNC('day', la.disbursed_at) AS day,
           COUNT(*)::text AS count,
           COALESCE(SUM(la.disbursed_amount),0)::text AS amount
         FROM "${s}".loan_accounts la
         WHERE ${where}
         GROUP BY day ORDER BY day ASC`,
      ),
      this.prisma.$queryRawUnsafe<{ product_name: string; count: string; amount: string }[]>(
        `SELECT
           lp.name AS product_name,
           COUNT(la.id)::text AS count,
           COALESCE(SUM(la.disbursed_amount),0)::text AS amount
         FROM "${s}".loan_accounts la
         JOIN "${s}".loan_products lp ON lp.id = la.product_id
         WHERE ${where}
         GROUP BY lp.name ORDER BY amount DESC`,
      ),
      this.prisma.$queryRawUnsafe<{ channel: string; count: string; amount: string }[]>(
        `SELECT
           channel,
           COUNT(*)::text AS count,
           COALESCE(SUM(amount),0)::text AS amount
         FROM "${s}".ledger_entries
         WHERE transaction_type = 'DISBURSEMENT'
           ${fromDate ? `AND created_at >= '${fromDate}'` : ''}
           ${toDate ? `AND created_at <= '${toDate}T23:59:59Z'` : ''}
         GROUP BY channel ORDER BY amount DESC`,
      ),
    ]);

    const totalCount = daily.reduce((s, r) => s + parseInt(r.count, 10), 0);
    const totalAmount = daily.reduce((s, r) => s + Number(r.amount), 0);

    return {
      totalCount,
      totalAmount,
      daily: daily.map(r => ({ day: r.day, count: parseInt(r.count, 10), amount: Number(r.amount) })),
      byProduct: byProduct.map(r => ({ productName: r.product_name, count: parseInt(r.count, 10), amount: Number(r.amount) })),
      byChannel: byChannel.map(r => ({ channel: r.channel, count: parseInt(r.count, 10), amount: Number(r.amount) })),
    };
  }

  // ── Collections Report ──────────────────────────────────────────────────────

  async collectionsReport(fromDate?: string, toDate?: string) {
    const s = this.s;
    const dateCond = this.dateCondition('le.created_at', fromDate, toDate);
    const where = `le.transaction_type = 'REPAYMENT'${dateCond ? ' AND ' + dateCond : ''}`;

    const [daily, byChannel, byProduct] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ day: Date; count: string; amount: string }[]>(
        `SELECT
           DATE_TRUNC('day', le.created_at) AS day,
           COUNT(*)::text AS count,
           COALESCE(SUM(le.amount),0)::text AS amount
         FROM "${s}".ledger_entries le
         WHERE ${where}
         GROUP BY day ORDER BY day ASC`,
      ),
      this.prisma.$queryRawUnsafe<{ channel: string; count: string; amount: string }[]>(
        `SELECT
           le.channel,
           COUNT(*)::text AS count,
           COALESCE(SUM(le.amount),0)::text AS amount
         FROM "${s}".ledger_entries le
         WHERE ${where}
         GROUP BY le.channel ORDER BY amount DESC`,
      ),
      this.prisma.$queryRawUnsafe<{ product_name: string; count: string; amount: string }[]>(
        `SELECT
           lp.name AS product_name,
           COUNT(le.id)::text AS count,
           COALESCE(SUM(le.amount),0)::text AS amount
         FROM "${s}".ledger_entries le
         JOIN "${s}".loan_accounts la ON la.id = le.loan_id
         JOIN "${s}".loan_products lp ON lp.id = la.product_id
         WHERE ${where}
         GROUP BY lp.name ORDER BY amount DESC`,
      ),
    ]);

    const totalCount = daily.reduce((s, r) => s + parseInt(r.count, 10), 0);
    const totalAmount = daily.reduce((s, r) => s + Number(r.amount), 0);

    return {
      totalCount,
      totalAmount,
      daily: daily.map(r => ({ day: r.day, count: parseInt(r.count, 10), amount: Number(r.amount) })),
      byChannel: byChannel.map(r => ({ channel: r.channel, count: parseInt(r.count, 10), amount: Number(r.amount) })),
      byProduct: byProduct.map(r => ({ productName: r.product_name, count: parseInt(r.count, 10), amount: Number(r.amount) })),
    };
  }

  // ── Savings Report ──────────────────────────────────────────────────────────

  async savingsReport(fromDate?: string, toDate?: string) {
    const s = this.s;

    // Check if savings tables exist
    const tableCheck = await this.prisma.$queryRawUnsafe<[{ exists: boolean }]>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = 'savings_accounts'
       ) AS exists`,
      s,
    );
    if (!tableCheck[0].exists) return { totalAccounts: 0, totalBalance: 0, byProduct: [], byStatus: [], depositVsWithdrawal: [] };

    const dateCond = this.dateCondition('st.created_at', fromDate, toDate);
    const [summary, byProduct, txSummary] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ status: string; count: string; balance: string }[]>(
        `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(balance),0)::text AS balance
         FROM "${s}".savings_accounts WHERE deleted_at IS NULL
         GROUP BY status`,
      ),
      this.prisma.$queryRawUnsafe<{ product_name: string; count: string; balance: string }[]>(
        `SELECT sp.name AS product_name, COUNT(sa.id)::text AS count, COALESCE(SUM(sa.balance),0)::text AS balance
         FROM "${s}".savings_accounts sa
         JOIN "${s}".savings_products sp ON sp.id = sa.product_id
         WHERE sa.deleted_at IS NULL
         GROUP BY sp.name ORDER BY balance DESC`,
      ),
      this.prisma.$queryRawUnsafe<{ tx_type: string; count: string; amount: string }[]>(
        `SELECT transaction_type AS tx_type, COUNT(*)::text AS count, COALESCE(SUM(amount),0)::text AS amount
         FROM "${s}".savings_transactions st
         WHERE 1=1 ${dateCond ? 'AND ' + dateCond : ''}
         GROUP BY transaction_type`,
      ),
    ]);

    return {
      totalAccounts: summary.reduce((s, r) => s + parseInt(r.count, 10), 0),
      totalBalance: summary.reduce((s, r) => s + Number(r.balance), 0),
      byStatus: summary.map(r => ({ status: r.status, count: parseInt(r.count, 10), balance: Number(r.balance) })),
      byProduct: byProduct.map(r => ({ productName: r.product_name, count: parseInt(r.count, 10), balance: Number(r.balance) })),
      depositVsWithdrawal: txSummary.map(r => ({ type: r.tx_type, count: parseInt(r.count, 10), amount: Number(r.amount) })),
    };
  }

  // ── Client Demographics ─────────────────────────────────────────────────────

  async clientsReport() {
    const s = this.s;
    const [byGender, byRegion, registrationTrend, kycStatus] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ gender: string; count: string }[]>(
        `SELECT gender, COUNT(*)::text FROM "${s}".clients WHERE deleted_at IS NULL GROUP BY gender`,
      ),
      this.prisma.$queryRawUnsafe<{ region: string; count: string }[]>(
        `SELECT region, COUNT(*)::text FROM "${s}".clients WHERE deleted_at IS NULL GROUP BY region ORDER BY count DESC LIMIT 10`,
      ),
      this.prisma.$queryRawUnsafe<{ month: Date; count: string }[]>(
        `SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*)::text
         FROM "${s}".clients WHERE deleted_at IS NULL
         GROUP BY month ORDER BY month DESC LIMIT 12`,
      ),
      this.prisma.$queryRawUnsafe<[{ verified: string; unverified: string; total: string }]>(
        `SELECT
           COUNT(*) FILTER (WHERE id IN (
             SELECT DISTINCT client_id FROM "${s}".kyc_documents WHERE verified_at IS NOT NULL
           ))::text AS verified,
           COUNT(*) FILTER (WHERE id NOT IN (
             SELECT DISTINCT client_id FROM "${s}".kyc_documents WHERE verified_at IS NOT NULL
           ))::text AS unverified,
           COUNT(*)::text AS total
         FROM "${s}".clients WHERE deleted_at IS NULL`,
      ),
    ]);

    return {
      byGender: byGender.map(r => ({ gender: r.gender, count: parseInt(r.count, 10) })),
      byRegion: byRegion.map(r => ({ region: r.region, count: parseInt(r.count, 10) })),
      registrationTrend: registrationTrend.map(r => ({ month: r.month, count: parseInt(r.count, 10) })).reverse(),
      kycStatus: {
        verified: parseInt(kycStatus[0].verified, 10),
        unverified: parseInt(kycStatus[0].unverified, 10),
        total: parseInt(kycStatus[0].total, 10),
      },
    };
  }

  // ── BoT Report ──────────────────────────────────────────────────────────────

  async botReport(fromDate: string, toDate: string) {
    const s = this.s;

    const [portfolio, newLoans, closedLoans, repayments, npl] = await Promise.all([
      this.prisma.$queryRawUnsafe<[{ count: string; outstanding: string; principal: string }]>(
        `SELECT COUNT(*)::text AS count,
                COALESCE(SUM(outstanding_balance),0)::text AS outstanding,
                COALESCE(SUM(principal_amount),0)::text AS principal
         FROM "${s}".loan_accounts
         WHERE status = 'ACTIVE' AND deleted_at IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; amount: string }]>(
        `SELECT COUNT(*)::text AS count, COALESCE(SUM(disbursed_amount),0)::text AS amount
         FROM "${s}".loan_accounts
         WHERE disbursed_at >= $1::timestamptz AND disbursed_at <= $2::timestamptz AND deleted_at IS NULL`,
        fromDate, toDate + 'T23:59:59Z',
      ),
      this.prisma.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text AS count FROM "${s}".loan_accounts
         WHERE status IN ('CLOSED','WRITTEN_OFF') AND closed_at >= $1::timestamptz AND closed_at <= $2::timestamptz`,
        fromDate, toDate + 'T23:59:59Z',
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; amount: string }]>(
        `SELECT COUNT(*)::text AS count, COALESCE(SUM(amount),0)::text AS amount
         FROM "${s}".ledger_entries
         WHERE transaction_type = 'REPAYMENT' AND created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
        fromDate, toDate + 'T23:59:59Z',
      ),
      this.prisma.$queryRawUnsafe<[{ count: string; balance: string }]>(
        `SELECT COUNT(DISTINCT la.id)::text AS count,
                COALESCE(SUM(la.outstanding_balance),0)::text AS balance
         FROM "${s}".loan_accounts la
         WHERE la.status = 'ACTIVE'
           AND EXISTS (
             SELECT 1 FROM "${s}".repayment_schedule rs
             WHERE rs.loan_id = la.id AND rs.status != 'PAID'
               AND rs.due_date < CURRENT_DATE - INTERVAL '90 days'
           )`,
      ),
    ]);

    return {
      reportPeriod: { from: fromDate, to: toDate },
      activePortfolio: {
        loanCount: parseInt(portfolio[0].count, 10),
        outstandingBalance: Number(portfolio[0].outstanding),
        grossLoanPortfolio: Number(portfolio[0].principal),
      },
      newLoans: {
        count: parseInt(newLoans[0].count, 10),
        amount: Number(newLoans[0].amount),
      },
      closedLoans: { count: parseInt(closedLoans[0].count, 10) },
      repayments: {
        count: parseInt(repayments[0].count, 10),
        amount: Number(repayments[0].amount),
      },
      nonPerformingLoans: {
        count: parseInt(npl[0].count, 10),
        balance: Number(npl[0].balance),
        nplRatio: Number(portfolio[0].outstanding) > 0
          ? Math.round((Number(npl[0].balance) / Number(portfolio[0].outstanding)) * 10000) / 100
          : 0,
      },
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private dateCondition(column: string, fromDate?: string, toDate?: string): string {
    const parts: string[] = [];
    if (fromDate) parts.push(`${column} >= '${fromDate}'::timestamptz`);
    if (toDate) parts.push(`${column} <= '${toDate}T23:59:59Z'::timestamptz`);
    return parts.join(' AND ');
  }
}
