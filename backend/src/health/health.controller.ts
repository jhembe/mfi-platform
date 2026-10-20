import { Controller, Get } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../common/guards/jwt-auth.guard';

@Controller('health')
export class HealthController {
  @Get()
  @SetMetadata(IS_PUBLIC_KEY, true)
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
