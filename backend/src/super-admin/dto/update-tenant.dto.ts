import { IsString, MaxLength, MinLength, IsOptional, IsHexColor, IsUrl, IsEnum } from 'class-validator';
import { TenantStatus } from '@mfi/shared';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsHexColor()
  brandPrimary?: string;

  @IsOptional()
  @IsHexColor()
  brandSecondary?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
