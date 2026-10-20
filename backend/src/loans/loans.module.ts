import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { SmsModule } from '../sms/sms.module';
import { LoanProductsService } from './loan-products.service';
import { LoanProductsController } from './loan-products.controller';
import { LoanAccountsService } from './loan-accounts.service';
import { LoanAccountsController } from './loan-accounts.controller';

@Module({
  imports: [TenantModule, SmsModule],
  controllers: [LoanProductsController, LoanAccountsController],
  providers: [LoanProductsService, LoanAccountsService],
  exports: [LoanProductsService, LoanAccountsService],
})
export class LoansModule {}
