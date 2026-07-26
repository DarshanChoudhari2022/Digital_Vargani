import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MandalsController } from './mandals.controller';
import { MandalsService } from './mandals.service';

@Module({
  controllers: [MandalsController],
  imports: [AuthModule],
  providers: [MandalsService],
})
export class MandalsModule {}
