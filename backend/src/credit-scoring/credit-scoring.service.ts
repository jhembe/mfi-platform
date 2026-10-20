import { Injectable, Scope, Inject, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

interface ScoreFactor {
  name: string;
  weight: number;
  score: number;
  max: number;
  notes: string;
}

export interface CreditScoreResult {
  loanId: string;
  clientId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: 'APPROVE' | 'REVIEW' | 'DECLINE';
  factors: ScoreFactor[];
  computedAt: string;
}

@Injectable({ scope: Scope.REQUEST })
export class CreditScoringService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REQUEST) private readonly request: Request,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private get schema() {
    return this.tenantCtx.schemaName;
  }

  async computeScore(loanId: string): Promise<CreditScoreResult> {
    const schema = this.schema;

    type LoanRow = {
      id: string; client_id: string; principal_amount: bigint; term_months: number;
      product_id: string; status: string;
    };
    type ClientRow = {
      id: string; date_of_birth: string; occupation: string | null;
      national_id: string | null; first_name: string; last_name: string;
    };
    type KycRow = { verified_at: string | null };
    type HistoryRow = {
      status: string; closed_at: string | null; outstanding_balance: bigint;
      term_months: number; disbursed_at: string | null;
    };
    type GroupRow = { id: string };
    type ProductRow = { max_amount: bigint };
    type MissedRow = { cnt: string };

    const [loans] = await this.prisma.$queryRawUnsafe<LoanRow[]>(
      `SELECT id, client_id, principal_amount, term_months, product_id, status
       FROM "${schema}".loan_accounts WHERE id = $1::uuid AND deleted_at IS NULL`,
      loanId,
    );
    if (!loans) throw new NotFoundException('Loan not found');

    const [client] = await this.prisma.$queryRawUnsafe<ClientRow[]>(
      `SELECT id, date_of_birth, occupation, national_id, first_name, last_name
       FROM "${schema}".clients WHERE id = $1::uuid AND deleted_at IS NULL`,
      loans.client_id,
    );

    const kyc = await this.prisma.$queryRawUnsafe<KycRow[]>(
      `SELECT verified_at FROM "${schema}".kyc_documents WHERE client_id = $1::uuid`,
      loans.client_id,
    );

    const history = await this.prisma.$queryRawUnsafe<HistoryRow[]>(
      `SELECT status, closed_at, outstanding_balance, term_months, disbursed_at
       FROM "${schema}".loan_accounts
       WHERE client_id = $1::uuid AND id != $2::uuid AND deleted_at IS NULL`,
      loans.client_id, loanId,
    );

    const groups = await this.prisma.$queryRawUnsafe<GroupRow[]>(
      `SELECT g.id FROM "${schema}".group_members gm
       JOIN "${schema}".groups g ON g.id = gm.group_id
       WHERE gm.client_id = $1::uuid AND gm.is_active = TRUE AND g.status = 'ACTIVE'`,
      loans.client_id,
    );

    const [product] = await this.prisma.$queryRawUnsafe<ProductRow[]>(
      `SELECT max_amount FROM "${schema}".loan_products WHERE id = $1::uuid`,
      loans.product_id,
    );

    // Count missed payments (overdue installments on previous ACTIVE loans)
    const missedRows = await this.prisma.$queryRawUnsafe<MissedRow[]>(
      `SELECT COUNT(*) as cnt FROM "${schema}".repayment_schedule rs
       JOIN "${schema}".loan_accounts la ON la.id = rs.loan_id
       WHERE la.client_id = $1::uuid AND rs.due_date < NOW() AND rs.status = 'PENDING'
         AND la.status = 'ACTIVE'`,
      loans.client_id,
    );
    const missedCount = parseInt(missedRows[0]?.cnt ?? '0', 10);

    const factors: ScoreFactor[] = [];

    // ── Factor 1: Age (0-15 points) ───────────────────────────────────────────
    const dob = new Date(client.date_of_birth);
    const ageYears = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
    let ageScore = 0;
    let ageNotes = '';
    if (ageYears >= 25 && ageYears <= 55) { ageScore = 15; ageNotes = 'Optimal working age'; }
    else if (ageYears >= 20 && ageYears <= 60) { ageScore = 10; ageNotes = 'Acceptable age range'; }
    else if (ageYears >= 18) { ageScore = 5; ageNotes = 'Age slightly outside optimal range'; }
    else { ageNotes = 'Age below minimum'; }
    factors.push({ name: 'Age', weight: 15, score: ageScore, max: 15, notes: `${ageYears} years old. ${ageNotes}` });

    // ── Factor 2: KYC completeness (0-20 points) ─────────────────────────────
    let kycScore = 0;
    let kycNotes = '';
    const hasNationalId = !!client.national_id;
    const verifiedDocs = kyc.filter(k => k.verified_at).length;
    if (hasNationalId) { kycScore += 10; }
    if (verifiedDocs >= 1) { kycScore += 10; kycNotes = `${verifiedDocs} verified document(s)`; }
    else if (kyc.length > 0) { kycScore += 5; kycNotes = `${kyc.length} document(s) pending verification`; }
    else { kycNotes = 'No documents uploaded'; }
    if (!hasNationalId) kycNotes = 'No national ID. ' + kycNotes;
    factors.push({ name: 'KYC & Identity', weight: 20, score: kycScore, max: 20, notes: kycNotes.trim() });

    // ── Factor 3: Employment (0-15 points) ────────────────────────────────────
    const employed = !!client.occupation;
    const empScore = employed ? 15 : 0;
    factors.push({ name: 'Employment', weight: 15, score: empScore, max: 15, notes: employed ? client.occupation! : 'No occupation recorded' });

    // ── Factor 4: Repayment history (0-30 points) ─────────────────────────────
    let histScore = 15; // start neutral for new borrowers
    let histNotes = 'New borrower — no history';
    if (history.length > 0) {
      const closed = history.filter(h => h.status === 'CLOSED').length;
      const writtenOff = history.filter(h => h.status === 'WRITTEN_OFF').length;
      if (writtenOff > 0) {
        histScore = 0;
        histNotes = `${writtenOff} previously written-off loan(s)`;
      } else if (missedCount > 0) {
        histScore = Math.max(0, 15 - missedCount * 3);
        histNotes = `${missedCount} currently overdue installment(s)`;
      } else if (closed >= 2) {
        histScore = 30;
        histNotes = `${closed} loan(s) repaid in full — excellent history`;
      } else if (closed === 1) {
        histScore = 22;
        histNotes = '1 loan repaid in full';
      } else {
        histScore = 15;
        histNotes = `${history.length} active loan(s) — no missed payments`;
      }
    }
    factors.push({ name: 'Repayment History', weight: 30, score: histScore, max: 30, notes: histNotes });

    // ── Factor 5: Group membership (0-10 points) ──────────────────────────────
    const inGroup = groups.length > 0;
    factors.push({
      name: 'Group Membership', weight: 10, score: inGroup ? 10 : 0, max: 10,
      notes: inGroup ? `Member of ${groups.length} group(s)` : 'Not a group member',
    });

    // ── Factor 6: Loan amount vs product limit (0-10 points) ──────────────────
    const maxAmt = Number(product?.max_amount ?? 1);
    const reqAmt = Number(loans.principal_amount);
    const ratio = reqAmt / maxAmt;
    let amtScore = 0;
    let amtNotes = '';
    if (ratio <= 0.3) { amtScore = 10; amtNotes = 'Loan amount is very conservative'; }
    else if (ratio <= 0.5) { amtScore = 8; amtNotes = 'Loan amount is moderate'; }
    else if (ratio <= 0.75) { amtScore = 5; amtNotes = 'Loan amount is above mid-range'; }
    else { amtScore = 2; amtNotes = 'Loan amount is near the product maximum'; }
    factors.push({ name: 'Amount vs Limit', weight: 10, score: amtScore, max: 10, notes: amtNotes });

    const totalScore = factors.reduce((s, f) => s + f.score, 0);
    const maxScore = factors.reduce((s, f) => s + f.max, 0);
    const pct = Math.round((totalScore / maxScore) * 100);

    const grade = pct >= 80 ? 'A' : pct >= 65 ? 'B' : pct >= 50 ? 'C' : pct >= 35 ? 'D' : 'F';
    const recommendation =
      pct >= 65 ? 'APPROVE' : pct >= 45 ? 'REVIEW' : 'DECLINE';

    return {
      loanId,
      clientId: loans.client_id,
      totalScore,
      maxScore,
      percentage: pct,
      grade,
      recommendation,
      factors,
      computedAt: new Date().toISOString(),
    };
  }
}
