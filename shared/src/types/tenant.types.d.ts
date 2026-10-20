import { FeatureKey, TenantStatus } from '../enums';
export interface Tenant {
    id: string;
    name: string;
    slug: string;
    schemaName: string;
    status: TenantStatus;
    logoUrl?: string;
    brandPrimary?: string;
    brandSecondary?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface TenantFeature {
    id: string;
    tenantId: string;
    featureKey: FeatureKey;
    enabled: boolean;
    enabledAt?: Date;
}
export interface TenantContext {
    tenantId: string;
    schemaName: string;
    features: FeatureKey[];
}
