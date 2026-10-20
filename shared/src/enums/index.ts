export enum LoanStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  WRITTEN_OFF = 'WRITTEN_OFF',
  RESCHEDULED = 'RESCHEDULED',
}

export enum InterestMethod {
  FLAT = 'FLAT',
  REDUCING_BALANCE = 'REDUCING_BALANCE',
  COMPOUND = 'COMPOUND',
}

export enum RepaymentFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

export enum TransactionType {
  DISBURSEMENT = 'DISBURSEMENT',
  REPAYMENT = 'REPAYMENT',
  FEE = 'FEE',
  PENALTY = 'PENALTY',
  REVERSAL = 'REVERSAL',
}

export enum PaymentChannel {
  CASH = 'CASH',
  MPESA = 'MPESA',
  TIGO_PESA = 'TIGO_PESA',
  AIRTEL_MONEY = 'AIRTEL_MONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum KycDocumentType {
  NIDA = 'NIDA',
  PASSPORT = 'PASSPORT',
  VOTER_ID = 'VOTER_ID',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
}

export enum FeatureKey {
  LOANS = 'module.loans',
  SAVINGS = 'module.savings',
  GROUPS = 'module.groups',
  ACCOUNTING = 'module.accounting',
  REPORTS = 'module.reports',
  CLIENT_PORTAL = 'module.client_portal',
  KYC = 'module.kyc',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  LOAN_OFFICER = 'LOAN_OFFICER',
  CASHIER = 'CASHIER',
  AUDITOR = 'AUDITOR',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TRIAL = 'TRIAL',
  ONBOARDING = 'ONBOARDING',
}

export enum SavingsAccountStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

export enum SavingsTransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  INTEREST = 'INTEREST',
  FEE = 'FEE',
}

export enum InterestFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

export enum GroupType {
  SACCO = 'SACCO',
  SOLIDARITY_GROUP = 'SOLIDARITY_GROUP',
  VILLAGE_BANK = 'VILLAGE_BANK',
}

export enum GroupMemberRole {
  CHAIRPERSON = 'CHAIRPERSON',
  SECRETARY = 'SECRETARY',
  TREASURER = 'TREASURER',
  MEMBER = 'MEMBER',
}

export enum GroupStatus {
  ACTIVE = 'ACTIVE',
  DISSOLVED = 'DISSOLVED',
}

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  VOIDED = 'VOIDED',
}

export enum PaymentRequestStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}
