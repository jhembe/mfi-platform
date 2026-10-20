import { IsEnum, IsString, IsOptional } from 'class-validator';
import { PaymentChannel } from '@mfi/shared';

export class DisburseLoanDto {
  @IsEnum(PaymentChannel) channel!: PaymentChannel;
  @IsString() @IsOptional() reference?: string;
  @IsString() @IsOptional() idempotencyKey?: string;
}
