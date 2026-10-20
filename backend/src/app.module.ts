import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { HealthModule } from './health/health.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { StorageModule } from './storage/storage.module';
import { ClientsModule } from './clients/clients.module';
import { LoansModule } from './loans/loans.module';
import { SavingsModule } from './savings/savings.module';
import { GroupsModule } from './groups/groups.module';
import { AccountingModule } from './accounting/accounting.module';
import { ReportsModule } from './reports/reports.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { CreditScoringModule } from './credit-scoring/credit-scoring.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { SmsModule } from './sms/sms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    MailModule,
    TenantModule,
    AuthModule,
    FeatureFlagsModule,
    HealthModule,
    SuperAdminModule,
    StorageModule,
    ClientsModule,
    LoansModule,
    SavingsModule,
    GroupsModule,
    AccountingModule,
    ReportsModule,
    PaymentsModule,
    UsersModule,
    CreditScoringModule,
    ClientPortalModule,
    SmsModule,
  ],
})
export class AppModule {}
