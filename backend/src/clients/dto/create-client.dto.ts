import { IsString, IsEmail, IsOptional, IsEnum, IsDateString, IsNotEmpty } from 'class-validator';

export class CreateClientDto {
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsDateString() dateOfBirth!: string;
  @IsEnum(['MALE', 'FEMALE', 'OTHER']) gender!: 'MALE' | 'FEMALE' | 'OTHER';
  @IsString() @IsNotEmpty() phone!: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsNotEmpty() address!: string;
  @IsString() @IsNotEmpty() ward!: string;
  @IsString() @IsNotEmpty() district!: string;
  @IsString() @IsNotEmpty() region!: string;
  @IsString() @IsOptional() nationalId?: string;
  @IsString() @IsOptional() occupation?: string;
  @IsString() @IsOptional() employer?: string;
  @IsString() @IsOptional() nextOfKinName?: string;
  @IsString() @IsOptional() nextOfKinPhone?: string;
  @IsString() @IsOptional() nextOfKinRelationship?: string;
}
