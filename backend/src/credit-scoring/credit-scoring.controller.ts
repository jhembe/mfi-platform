import { Controller, Get, Param } from '@nestjs/common';
import { CreditScoringService } from './credit-scoring.service';
import { RequireFeature } from '../common/decorators/feature.decorator';
import { FeatureKey } from '@mfi/shared';

@Controller('credit-scoring')
@RequireFeature(FeatureKey.KYC)
export class CreditScoringController {
  constructor(private readonly service: CreditScoringService) {}

  @Get('loans/:loanId')
  score(@Param('loanId') loanId: string) {
    return this.service.computeScore(loanId);
  }
}
