import { IsString, IsOptional, IsNumber, IsEnum, IsPositive, Min, Max, IsBoolean } from 'class-validator';
import { InterestMethod, RepaymentFrequency } from '@mfi/shared';

export class UpdateLoanProductDto {
  @IsString() @IsOptional() name?: string;
  @IsNumber() @IsPositive() @IsOptional() minAmount?: number;
  @IsNumber() @IsPositive() @IsOptional() maxAmount?: number;
  @IsNumber() @Min(1) @IsOptional() minTermMonths?: number;
  @IsNumber() @Min(1) @IsOptional() maxTermMonths?: number;
  @IsEnum(InterestMethod) @IsOptional() interestMethod?: InterestMethod;
  @IsNumber() @Min(0) @Max(999) @IsOptional() interestRate?: number;
  @IsEnum(RepaymentFrequency) @IsOptional() repaymentFrequency?: RepaymentFrequency;
  @IsNumber() @Min(0) @Max(100) @IsOptional() processingFeePercent?: number;
  @IsNumber() @Min(0) @Max(100) @IsOptional() penaltyRatePercent?: number;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
