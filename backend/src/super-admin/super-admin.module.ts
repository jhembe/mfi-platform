import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminAuthController } from './super-admin-auth.controller';
import { SuperAdminTenantsController } from './super-admin-tenants.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SuperAdminAuthController, SuperAdminTenantsController],
  providers: [SuperAdminService],
})
export class SuperAdminModule {}
