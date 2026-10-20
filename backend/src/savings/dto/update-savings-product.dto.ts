import { IsString, IsNumber, Min, Max, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { InterestFrequency } from '@mfi/shared';

export class UpdateSavingsProductDto {
  @IsString() @IsOptional() name?: string;
  @IsNumber() @Min(0) @IsOptional() minBalance?: number;
  @IsNumber() @Min(0) @Max(100) @IsOptional() interestRate?: number;
  @IsEnum(InterestFrequency) @IsOptional() interestFrequency?: InterestFrequency;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
