import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateAppConfig } from './config/app-config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MandalsModule } from './mandals/mandals.module';
import { PrismaModule } from './prisma/prisma.module';

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
    HealthModule,
  ],
})
export class AppModule {}
