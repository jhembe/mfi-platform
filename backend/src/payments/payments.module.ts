import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SelcomService } from './selcom.service';

@Module({
  imports: [TenantModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, SelcomService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
