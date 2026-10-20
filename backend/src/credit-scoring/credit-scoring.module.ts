import { Module } from '@nestjs/common';
import { CreditScoringService } from './credit-scoring.service';
import { CreditScoringController } from './credit-scoring.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [CreditScoringController],
  providers: [CreditScoringService],
  exports: [CreditScoringService],
})
export class CreditScoringModule {}
