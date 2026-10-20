import { IsString, IsNotEmpty, IsNumber, IsEnum, IsPositive, Min, Max } from 'class-validator';
import { InterestMethod, RepaymentFrequency } from '@mfi/shared';

export class CreateLoanProductDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() @IsPositive() minAmount!: number;
  @IsNumber() @IsPositive() maxAmount!: number;
  @IsNumber() @Min(1) minTermMonths!: number;
  @IsNumber() @Min(1) maxTermMonths!: number;
  @IsEnum(InterestMethod) interestMethod!: InterestMethod;
  @IsNumber() @Min(0) @Max(999) interestRate!: number;
  @IsEnum(RepaymentFrequency) repaymentFrequency!: RepaymentFrequency;
  @IsNumber() @Min(0) @Max(100) processingFeePercent!: number;
  @IsNumber() @Min(0) @Max(100) penaltyRatePercent!: number;
}
