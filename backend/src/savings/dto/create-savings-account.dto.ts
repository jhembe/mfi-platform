import { IsUUID, IsString, IsOptional } from 'class-validator';

export class CreateSavingsAccountDto {
  @IsUUID() clientId!: string;
  @IsUUID() productId!: string;
  @IsString() @IsOptional() notes?: string;
}
