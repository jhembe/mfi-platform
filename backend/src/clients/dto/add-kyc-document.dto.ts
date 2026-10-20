import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { KycDocumentType } from '@mfi/shared';

export class AddKycDocumentDto {
  @IsEnum(KycDocumentType) documentType!: KycDocumentType;
  @IsString() @IsNotEmpty() documentNumber!: string;
}
