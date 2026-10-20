import { InterestMethod, LoanStatus, RepaymentFrequency, TransactionType, PaymentChannel } from '../enums';

export interface LoanProduct {
  id: string;
  name: string;
  minAmount: bigint;
  maxAmount: bigint;
  minTermMonths: number;
  maxTermMonths: number;
  interestMethod: InterestMethod;
  interestRate: number;
  repaymentFrequency: RepaymentFrequency;
  processingFeePercent: number;
  penaltyRatePercent: number;
}

export interface LoanAccount {
  id: string;
  clientId: string;
  productId: string;
  principalAmount: bigint;
  disbursedAmount: bigint;
  outstandingBalance: bigint;
  status: LoanStatus;
  disbursedAt?: Date;
  maturityDate?: Date;
  officerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepaymentScheduleEntry {
  installmentNo: number;
  dueDate: Date;
  principalDue: bigint;
  interestDue: bigint;
  feesDue: bigint;
  totalDue: bigint;
  paidAmount: bigint;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
}

export interface LedgerEntry {
  id: string;
  loanId: string;
  transactionType: TransactionType;
  debitAccount: string;
  creditAccount: string;
  amount: bigint;
  channel: PaymentChannel;
  reference: string;
  idempotencyKey: string;
  createdAt: Date;
}
