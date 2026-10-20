import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { SavingsProductsService } from './savings-products.service';
import { SavingsProductsController } from './savings-products.controller';
import { SavingsAccountsService } from './savings-accounts.service';
import { SavingsAccountsController } from './savings-accounts.controller';

@Module({
  imports: [TenantModule],
  controllers: [SavingsProductsController, SavingsAccountsController],
  providers: [SavingsProductsService, SavingsAccountsService],
  exports: [SavingsProductsService, SavingsAccountsService],
})
export class SavingsModule {}
