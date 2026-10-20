import { IsArray, ValidateNested, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { FeatureKey } from '@mfi/shared';

export class FeatureUpdateItemDto {
  @IsEnum(FeatureKey)
  featureKey!: FeatureKey;

  @IsBoolean()
  enabled!: boolean;
}

export class SetFeaturesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureUpdateItemDto)
  features!: FeatureUpdateItemDto[];
}
