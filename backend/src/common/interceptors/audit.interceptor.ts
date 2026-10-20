import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '@mfi/shared';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  private readonly WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!this.WRITE_METHODS.has(request.method)) {
      return next.handle();
    }

    const user = request.user as AuthenticatedUser | undefined;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async () => {
          try {
            await this.prisma.auditLog.create({
              data: {
                tenantId: user?.tenantId ?? null,
                userId: user?.id ?? null,
                action: request.method,
                resource: request.route?.path ?? request.url,
                resourceId: (request.params as Record<string, string>)['id'] ?? null,
                after: request.body as unknown as import('@prisma/client').Prisma.InputJsonValue,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'] ?? null,
              },
            });
          } catch (err) {
            this.logger.error('Audit log write failed', err);
          }
        },
        error: (err: unknown) => {
          this.logger.error(`Request failed after ${Date.now() - startTime}ms`, err);
        },
      }),
    );
  }
}
