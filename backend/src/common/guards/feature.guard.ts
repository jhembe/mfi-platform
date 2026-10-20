import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { FeatureKey } from '@mfi/shared';
import { FEATURE_KEY } from '../decorators/feature.decorator';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeature) return true;

    const req = context.switchToHttp().getRequest<Request & { tenantFeatures?: FeatureKey[] }>();
    const features = req.tenantFeatures ?? [];

if (!features.includes(requiredFeature as FeatureKey)) {
      throw new ForbiddenException('Feature not enabled for this tenant');
    }

    return true;
  }
}
