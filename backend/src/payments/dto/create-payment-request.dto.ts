import { IsUUID, IsNumber, IsPositive, IsString, Matches } from 'class-validator';

export class CreatePaymentRequestDto {
  @IsUUID() loanId!: string;

  @IsNumber() @IsPositive() amount!: number;

  // E.164 format for Tanzania: 255XXXXXXXXX
  @IsString()
  @Matches(/^255[67]\d{8}$/, { message: 'Phone must be in format 255XXXXXXXXX (e.g. 255712345678)' })
  phone!: string;
}
