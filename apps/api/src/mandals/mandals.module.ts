import { Module } from '@nestjs/common';
import { MandalsController } from './mandals.controller';
import { MandalsService } from './mandals.service';

@Module({
  controllers: [MandalsController],
  providers: [MandalsService],
})
export class MandalsModule {}
