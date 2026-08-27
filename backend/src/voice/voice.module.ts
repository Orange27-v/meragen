import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';
import { VoicePricing } from './voice.pricing';
import { NineJaLingoVendor } from './ninejalingo.vendor';
import { AuthModule } from '../auth/auth.module';
import { CreditsModule } from '../credits/credits.module';
import { StorageModule } from '../storage/storage.module';
import { BrandModule } from '../brand/brand.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [AuthModule, CreditsModule, StorageModule, BrandModule],
  controllers: [VoiceController],
  providers: [VoiceService, VoicePricing, NineJaLingoVendor, PrismaService],
  exports: [VoiceService],
})
export class VoiceModule {}
