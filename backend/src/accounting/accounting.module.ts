import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';

@Module({
  imports: [TenantModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
