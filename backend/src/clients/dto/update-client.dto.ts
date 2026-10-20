import { IsString, IsEmail, IsOptional, IsEnum, IsDateString } from 'class-validator';

export class UpdateClientDto {
  @IsString() @IsOptional() firstName?: string;
  @IsString() @IsOptional() lastName?: string;
  @IsDateString() @IsOptional() dateOfBirth?: string;
  @IsEnum(['MALE', 'FEMALE', 'OTHER']) @IsOptional() gender?: 'MALE' | 'FEMALE' | 'OTHER';
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() ward?: string;
  @IsString() @IsOptional() district?: string;
  @IsString() @IsOptional() region?: string;
  @IsString() @IsOptional() nationalId?: string;
  @IsString() @IsOptional() occupation?: string;
  @IsString() @IsOptional() employer?: string;
  @IsString() @IsOptional() nextOfKinName?: string;
  @IsString() @IsOptional() nextOfKinPhone?: string;
  @IsString() @IsOptional() nextOfKinRelationship?: string;
}
