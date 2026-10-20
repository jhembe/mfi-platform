import { IsEmail, IsString, IsNotEmpty, IsArray, IsEnum, IsOptional, MinLength } from 'class-validator';
import { UserRole } from '@mfi/shared';

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsString() @MinLength(8) password!: string;
  @IsArray() @IsEnum(UserRole, { each: true }) roles!: UserRole[];
}

export class UpdateUserDto {
  @IsString() @IsOptional() firstName?: string;
  @IsString() @IsOptional() lastName?: string;
  @IsArray() @IsEnum(UserRole, { each: true }) @IsOptional() roles?: UserRole[];
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) newPassword!: string;
}
