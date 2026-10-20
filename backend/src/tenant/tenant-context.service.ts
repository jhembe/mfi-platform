import { Injectable, Scope } from '@nestjs/common';
import { TenantContext } from '@mfi/shared';

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private context: TenantContext | null = null;

  set(ctx: TenantContext) {
    this.context = ctx;
  }

  get(): TenantContext {
    if (!this.context) {
      throw new Error('TenantContext not initialised for this request');
    }
    return this.context;
  }

  get tenantId(): string {
    return this.get().tenantId;
  }

  get schemaName(): string {
    return this.get().schemaName;
  }

  hasFeature(featureKey: string): boolean {
    return this.get().features.includes(featureKey as never);
  }
}
