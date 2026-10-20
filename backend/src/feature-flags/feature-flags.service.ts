import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureKey } from '@mfi/shared';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEnabledFeatures(tenantId: string): Promise<FeatureKey[]> {
    const features = await this.prisma.tenantFeature.findMany({
      where: { tenantId, enabled: true },
      select: { featureKey: true },
    });
    return features.map((f) => f.featureKey as FeatureKey);
  }

  async enableFeature(tenantId: string, featureKey: FeatureKey): Promise<void> {
    await this.prisma.tenantFeature.upsert({
      where: { tenantId_featureKey: { tenantId, featureKey } },
      update: { enabled: true, enabledAt: new Date() },
      create: { tenantId, featureKey, enabled: true, enabledAt: new Date() },
    });
  }

  async disableFeature(tenantId: string, featureKey: FeatureKey): Promise<void> {
    await this.prisma.tenantFeature.upsert({
      where: { tenantId_featureKey: { tenantId, featureKey } },
      update: { enabled: false },
      create: { tenantId, featureKey, enabled: false },
    });
  }

  async isEnabled(tenantId: string, featureKey: FeatureKey): Promise<boolean> {
    const feature = await this.prisma.tenantFeature.findUnique({
      where: { tenantId_featureKey: { tenantId, featureKey } },
      select: { enabled: true },
    });
    return feature?.enabled ?? false;
  }
}
