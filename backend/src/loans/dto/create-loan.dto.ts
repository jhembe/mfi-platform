import { IsString, IsUUID, IsNumber, IsPositive, Min, IsOptional } from 'class-validator';

export class CreateLoanDto {
  @IsUUID() clientId!: string;
  @IsUUID() productId!: string;
  @IsNumber() @IsPositive() principalAmount!: number;
  @IsNumber() @Min(1) termMonths!: number;
  @IsString() @IsOptional() notes?: string;
}
