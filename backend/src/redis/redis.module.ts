import { Global, Module, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const InjectRedis = () => Inject(REDIS_CLIENT);

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis => {
        return new Redis({
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.getOrThrow<string>('REDIS_PASSWORD'),
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
