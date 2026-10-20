import { IsString, Matches, MaxLength, MinLength, IsOptional, IsHexColor } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens only',
  })
  slug!: string;

  @IsOptional()
  @IsHexColor()
  brandPrimary?: string;

  @IsOptional()
  @IsHexColor()
  brandSecondary?: string;
}
