import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '@mfi/shared';

export const FEATURE_KEY = 'feature';
export const RequireFeature = (feature: FeatureKey) => SetMetadata(FEATURE_KEY, feature);
