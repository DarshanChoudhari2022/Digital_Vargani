import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  controllers: [TemplatesController],
  imports: [AuthModule, PrismaModule],
  providers: [TemplatesService],
})
export class TemplatesModule {}
