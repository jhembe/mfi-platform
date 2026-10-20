import { InterestMethod, RepaymentFrequency } from '@mfi/shared';

export interface ScheduleInput {
  principal: bigint;
  annualRatePct: number;
  termMonths: number;
  frequency: RepaymentFrequency;
  interestMethod: InterestMethod;
  disbursementDate: Date;
}

export interface InstallmentLine {
  installmentNo: number;
  dueDate: Date;
  principalDue: bigint;
  interestDue: bigint;
  feesDue: bigint;
  penaltiesDue: bigint;
  totalDue: bigint;
}

export function generateSchedule(input: ScheduleInput): InstallmentLine[] {
  switch (input.interestMethod) {
    case InterestMethod.FLAT:
      return flatRateSchedule(input);
    case InterestMethod.REDUCING_BALANCE:
    case InterestMethod.COMPOUND:
      return reducingBalanceSchedule(input);
    default:
      throw new Error(`Unsupported interest method: ${String(input.interestMethod)}`);
  }
}

function installmentCount(termMonths: number, freq: RepaymentFrequency): number {
  switch (freq) {
    case RepaymentFrequency.DAILY:     return termMonths * 30;
    case RepaymentFrequency.WEEKLY:    return termMonths * 4;
    case RepaymentFrequency.BIWEEKLY:  return termMonths * 2;
    case RepaymentFrequency.MONTHLY:   return termMonths;
    case RepaymentFrequency.QUARTERLY: return Math.max(1, Math.round(termMonths / 3));
    case RepaymentFrequency.ANNUALLY:  return Math.max(1, Math.round(termMonths / 12));
    default: return termMonths;
  }
}

function periodRate(annualRatePct: number, freq: RepaymentFrequency): number {
  const r = annualRatePct / 100;
  switch (freq) {
    case RepaymentFrequency.DAILY:     return r / 365;
    case RepaymentFrequency.WEEKLY:    return r / 52;
    case RepaymentFrequency.BIWEEKLY:  return r / 26;
    case RepaymentFrequency.MONTHLY:   return r / 12;
    case RepaymentFrequency.QUARTERLY: return r / 4;
    case RepaymentFrequency.ANNUALLY:  return r;
    default: return r / 12;
  }
}

function addPeriods(base: Date, n: number, freq: RepaymentFrequency): Date {
  const d = new Date(base);
  switch (freq) {
    case RepaymentFrequency.DAILY:     d.setDate(d.getDate() + n); break;
    case RepaymentFrequency.WEEKLY:    d.setDate(d.getDate() + n * 7); break;
    case RepaymentFrequency.BIWEEKLY:  d.setDate(d.getDate() + n * 14); break;
    case RepaymentFrequency.MONTHLY:   d.setMonth(d.getMonth() + n); break;
    case RepaymentFrequency.QUARTERLY: d.setMonth(d.getMonth() + n * 3); break;
    case RepaymentFrequency.ANNUALLY:  d.setFullYear(d.getFullYear() + n); break;
  }
  return d;
}

function flatRateSchedule(input: ScheduleInput): InstallmentLine[] {
  const n = installmentCount(input.termMonths, input.frequency);
  const r = periodRate(input.annualRatePct, input.frequency);

  // Total interest on original principal for all periods
  const totalInterest = BigInt(Math.round(Number(input.principal) * r * n));
  const perPrincipal = input.principal / BigInt(n);
  const perInterest = totalInterest / BigInt(n);
  const principalRem = input.principal - perPrincipal * BigInt(n);
  const interestRem = totalInterest - perInterest * BigInt(n);

  return Array.from({ length: n }, (_, i) => {
    const no = i + 1;
    const isLast = no === n;
    const pd = perPrincipal + (isLast ? principalRem : 0n);
    const id = perInterest + (isLast ? interestRem : 0n);
    return {
      installmentNo: no,
      dueDate: addPeriods(input.disbursementDate, no, input.frequency),
      principalDue: pd,
      interestDue: id,
      feesDue: 0n,
      penaltiesDue: 0n,
      totalDue: pd + id,
    };
  });
}

function reducingBalanceSchedule(input: ScheduleInput): InstallmentLine[] {
  const n = installmentCount(input.termMonths, input.frequency);
  const r = periodRate(input.annualRatePct, input.frequency);

  // PMT = P × r / (1 − (1+r)^−n), or P/n when r = 0
  const P = Number(input.principal);
  const pmt = r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));

  let outstanding = P;
  let remainingPrincipal = input.principal;
  const lines: InstallmentLine[] = [];

  for (let i = 1; i <= n; i++) {
    const isLast = i === n;
    let interestDue: bigint;
    let principalDue: bigint;

    if (isLast) {
      interestDue = BigInt(Math.round(Number(remainingPrincipal) * r));
      principalDue = remainingPrincipal;
    } else {
      interestDue = BigInt(Math.round(outstanding * r));
      const rawPrincipal = pmt - Number(interestDue);
      principalDue = BigInt(Math.max(0, Math.round(rawPrincipal)));
      if (principalDue > remainingPrincipal) principalDue = remainingPrincipal;
    }

    outstanding -= Number(principalDue);
    remainingPrincipal -= principalDue;

    lines.push({
      installmentNo: i,
      dueDate: addPeriods(input.disbursementDate, i, input.frequency),
      principalDue,
      interestDue,
      feesDue: 0n,
      penaltiesDue: 0n,
      totalDue: principalDue + interestDue,
    });
  }

  return lines;
}
