import { IsString, IsNotEmpty, IsNumber, Min, Max, IsEnum, IsOptional } from 'class-validator';
import { InterestFrequency } from '@mfi/shared';

export class CreateSavingsProductDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() @Min(0) minBalance!: number;
  @IsNumber() @Min(0) @Max(100) interestRate!: number;
  @IsEnum(InterestFrequency) interestFrequency!: InterestFrequency;
  @IsString() @IsOptional() description?: string;
}
