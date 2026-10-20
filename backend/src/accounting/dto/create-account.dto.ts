import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { AccountType } from '@mfi/shared';

export class CreateAccountDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsEnum(AccountType) type!: AccountType;
  @IsUUID() @IsOptional() parentId?: string;
  @IsString() @IsOptional() description?: string;
}

export class UpdateAccountDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
