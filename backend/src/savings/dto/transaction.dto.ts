import { IsNumber, IsPositive, IsEnum, IsString, IsOptional } from 'class-validator';
import { PaymentChannel } from '@mfi/shared';

export class TransactionDto {
  @IsNumber() @IsPositive() amount!: number;
  @IsEnum(PaymentChannel) channel!: PaymentChannel;
  @IsString() @IsOptional() reference?: string;
  @IsString() @IsOptional() idempotencyKey?: string;
  @IsString() @IsOptional() notes?: string;
}
