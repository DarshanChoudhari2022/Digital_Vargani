import { Module } from '@nestjs/common';
import { VarganiController } from './vargani.controller';
import { VarganiService } from './vargani.service';

@Module({
  controllers: [VarganiController],
  providers: [VarganiService],
})
export class VarganiModule {}
