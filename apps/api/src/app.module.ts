import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { validateAppConfig } from './config/app-config';
import { AuthModule } from './auth/auth.module';
import { ExpensesModule } from './expenses/expenses.module';
import { FestivalsModule } from './festivals/festivals.module';
import { HealthModule } from './health/health.module';
import { MandalsModule } from './mandals/mandals.module';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { TemplatesModule } from './templates/templates.module';
import { VarganiModule } from './vargani/vargani.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['.env.local', '.env'],
      isGlobal: true,
      validate: validateAppConfig,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    MandalsModule,
    FestivalsModule,
    MembersModule,
    VarganiModule,
    ExpensesModule,
    TemplatesModule,
    ReportsModule,
    AuditModule,
    HealthModule,
  ],
})
export class AppModule {}
