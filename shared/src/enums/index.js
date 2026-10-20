"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRequestStatus = exports.JournalEntryStatus = exports.AccountType = exports.GroupStatus = exports.GroupMemberRole = exports.GroupType = exports.InterestFrequency = exports.SavingsTransactionType = exports.SavingsAccountStatus = exports.TenantStatus = exports.UserRole = exports.FeatureKey = exports.KycDocumentType = exports.PaymentChannel = exports.TransactionType = exports.RepaymentFrequency = exports.InterestMethod = exports.LoanStatus = void 0;
var LoanStatus;
(function (LoanStatus) {
    LoanStatus["DRAFT"] = "DRAFT";
    LoanStatus["PENDING"] = "PENDING";
    LoanStatus["APPROVED"] = "APPROVED";
    LoanStatus["ACTIVE"] = "ACTIVE";
    LoanStatus["CLOSED"] = "CLOSED";
    LoanStatus["WRITTEN_OFF"] = "WRITTEN_OFF";
    LoanStatus["RESCHEDULED"] = "RESCHEDULED";
})(LoanStatus || (exports.LoanStatus = LoanStatus = {}));
var InterestMethod;
(function (InterestMethod) {
    InterestMethod["FLAT"] = "FLAT";
    InterestMethod["REDUCING_BALANCE"] = "REDUCING_BALANCE";
    InterestMethod["COMPOUND"] = "COMPOUND";
})(InterestMethod || (exports.InterestMethod = InterestMethod = {}));
var RepaymentFrequency;
(function (RepaymentFrequency) {
    RepaymentFrequency["DAILY"] = "DAILY";
    RepaymentFrequency["WEEKLY"] = "WEEKLY";
    RepaymentFrequency["BIWEEKLY"] = "BIWEEKLY";
    RepaymentFrequency["MONTHLY"] = "MONTHLY";
    RepaymentFrequency["QUARTERLY"] = "QUARTERLY";
    RepaymentFrequency["ANNUALLY"] = "ANNUALLY";
})(RepaymentFrequency || (exports.RepaymentFrequency = RepaymentFrequency = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["DISBURSEMENT"] = "DISBURSEMENT";
    TransactionType["REPAYMENT"] = "REPAYMENT";
    TransactionType["FEE"] = "FEE";
    TransactionType["PENALTY"] = "PENALTY";
    TransactionType["REVERSAL"] = "REVERSAL";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var PaymentChannel;
(function (PaymentChannel) {
    PaymentChannel["CASH"] = "CASH";
    PaymentChannel["MPESA"] = "MPESA";
    PaymentChannel["TIGO_PESA"] = "TIGO_PESA";
    PaymentChannel["AIRTEL_MONEY"] = "AIRTEL_MONEY";
    PaymentChannel["BANK_TRANSFER"] = "BANK_TRANSFER";
})(PaymentChannel || (exports.PaymentChannel = PaymentChannel = {}));
var KycDocumentType;
(function (KycDocumentType) {
    KycDocumentType["NIDA"] = "NIDA";
    KycDocumentType["PASSPORT"] = "PASSPORT";
    KycDocumentType["VOTER_ID"] = "VOTER_ID";
    KycDocumentType["DRIVERS_LICENSE"] = "DRIVERS_LICENSE";
})(KycDocumentType || (exports.KycDocumentType = KycDocumentType = {}));
var FeatureKey;
(function (FeatureKey) {
    FeatureKey["LOANS"] = "module.loans";
    FeatureKey["SAVINGS"] = "module.savings";
    FeatureKey["GROUPS"] = "module.groups";
    FeatureKey["ACCOUNTING"] = "module.accounting";
    FeatureKey["REPORTS"] = "module.reports";
    FeatureKey["CLIENT_PORTAL"] = "module.client_portal";
    FeatureKey["KYC"] = "module.kyc";
})(FeatureKey || (exports.FeatureKey = FeatureKey = {}));
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["TENANT_ADMIN"] = "TENANT_ADMIN";
    UserRole["BRANCH_MANAGER"] = "BRANCH_MANAGER";
    UserRole["LOAN_OFFICER"] = "LOAN_OFFICER";
    UserRole["CASHIER"] = "CASHIER";
    UserRole["AUDITOR"] = "AUDITOR";
})(UserRole || (exports.UserRole = UserRole = {}));
var TenantStatus;
(function (TenantStatus) {
    TenantStatus["ACTIVE"] = "ACTIVE";
    TenantStatus["SUSPENDED"] = "SUSPENDED";
    TenantStatus["TRIAL"] = "TRIAL";
    TenantStatus["ONBOARDING"] = "ONBOARDING";
})(TenantStatus || (exports.TenantStatus = TenantStatus = {}));
var SavingsAccountStatus;
(function (SavingsAccountStatus) {
    SavingsAccountStatus["ACTIVE"] = "ACTIVE";
    SavingsAccountStatus["FROZEN"] = "FROZEN";
    SavingsAccountStatus["CLOSED"] = "CLOSED";
})(SavingsAccountStatus || (exports.SavingsAccountStatus = SavingsAccountStatus = {}));
var SavingsTransactionType;
(function (SavingsTransactionType) {
    SavingsTransactionType["DEPOSIT"] = "DEPOSIT";
    SavingsTransactionType["WITHDRAWAL"] = "WITHDRAWAL";
    SavingsTransactionType["INTEREST"] = "INTEREST";
    SavingsTransactionType["FEE"] = "FEE";
})(SavingsTransactionType || (exports.SavingsTransactionType = SavingsTransactionType = {}));
var InterestFrequency;
(function (InterestFrequency) {
    InterestFrequency["MONTHLY"] = "MONTHLY";
    InterestFrequency["QUARTERLY"] = "QUARTERLY";
    InterestFrequency["ANNUALLY"] = "ANNUALLY";
})(InterestFrequency || (exports.InterestFrequency = InterestFrequency = {}));
var GroupType;
(function (GroupType) {
    GroupType["SACCO"] = "SACCO";
    GroupType["SOLIDARITY_GROUP"] = "SOLIDARITY_GROUP";
    GroupType["VILLAGE_BANK"] = "VILLAGE_BANK";
})(GroupType || (exports.GroupType = GroupType = {}));
var GroupMemberRole;
(function (GroupMemberRole) {
    GroupMemberRole["CHAIRPERSON"] = "CHAIRPERSON";
    GroupMemberRole["SECRETARY"] = "SECRETARY";
    GroupMemberRole["TREASURER"] = "TREASURER";
    GroupMemberRole["MEMBER"] = "MEMBER";
})(GroupMemberRole || (exports.GroupMemberRole = GroupMemberRole = {}));
var GroupStatus;
(function (GroupStatus) {
    GroupStatus["ACTIVE"] = "ACTIVE";
    GroupStatus["DISSOLVED"] = "DISSOLVED";
})(GroupStatus || (exports.GroupStatus = GroupStatus = {}));
var AccountType;
(function (AccountType) {
    AccountType["ASSET"] = "ASSET";
    AccountType["LIABILITY"] = "LIABILITY";
    AccountType["EQUITY"] = "EQUITY";
    AccountType["INCOME"] = "INCOME";
    AccountType["EXPENSE"] = "EXPENSE";
})(AccountType || (exports.AccountType = AccountType = {}));
var JournalEntryStatus;
(function (JournalEntryStatus) {
    JournalEntryStatus["DRAFT"] = "DRAFT";
    JournalEntryStatus["POSTED"] = "POSTED";
    JournalEntryStatus["VOIDED"] = "VOIDED";
})(JournalEntryStatus || (exports.JournalEntryStatus = JournalEntryStatus = {}));
var PaymentRequestStatus;
(function (PaymentRequestStatus) {
    PaymentRequestStatus["PENDING"] = "PENDING";
    PaymentRequestStatus["COMPLETED"] = "COMPLETED";
    PaymentRequestStatus["FAILED"] = "FAILED";
    PaymentRequestStatus["EXPIRED"] = "EXPIRED";
    PaymentRequestStatus["CANCELLED"] = "CANCELLED";
})(PaymentRequestStatus || (exports.PaymentRequestStatus = PaymentRequestStatus = {}));
//# sourceMappingURL=index.js.map