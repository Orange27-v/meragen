import { Module } from '@nestjs/common';
import { GenerationProcessor } from './generation.processor';
import { GenerationPoller } from './generation.poller';
import { GenerationsModule } from '../generations/generations.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [GenerationsModule],
  providers: [GenerationProcessor, GenerationPoller, PrismaService],
  exports: [GenerationProcessor, GenerationPoller],
})
export class QueueModule {}
