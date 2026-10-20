import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class PortalRegisterDto {
  @IsString() tenantSlug!: string;
  @IsString() @Matches(/^(\+?255|0)\d{9}$/, { message: 'Phone must be +255XXXXXXXXX, 255XXXXXXXXX, or 0XXXXXXXXX format' }) phone!: string;
  @IsString() @Length(4, 6) pin!: string;
}

export class PortalLoginDto {
  @IsOptional() @IsString() tenantSlug?: string;
  @IsString() @Matches(/^(\+?255|0)\d{9}$/, { message: 'Phone must be +255XXXXXXXXX, 255XXXXXXXXX, or 0XXXXXXXXX format' }) phone!: string;
  @IsString() @Length(4, 6) pin!: string;
}

export class PortalSelectTenantDto {
  @IsString() tenantId!: string;
  @IsString() @Matches(/^(\+?255|0)\d{9}$/, { message: 'Phone must be +255XXXXXXXXX, 255XXXXXXXXX, or 0XXXXXXXXX format' }) phone!: string;
  @IsString() @Length(4, 6) pin!: string;
}
