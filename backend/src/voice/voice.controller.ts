import {
  Controller, Get, Post, Body, Query, Req, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { VoiceService } from './voice.service';
import { VoiceLanguage, isVoiceLanguage } from './voice.types';
import { MarginFloorBreachError } from '../pricing/pricing.errors';
import { InsufficientCreditsError } from '../credits/credits.errors';
import { VendorError } from '../vendors/vendor.types';

function parseLanguage(value?: string): VoiceLanguage {
  if (!value || !isVoiceLanguage(value)) {
    throw new BadRequestException('Choose Pidgin, Yorùbá, Igbo or Hausa.');
  }
  return value;
}

@Controller('api/v1/voice')
@UseGuards(AuthGuard)
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  /** What MyVoice can do, and whether it is switched on. */
  @Get()
  status() {
    return {
      available: this.voice.available,
      provider: this.voice.provider.name,
      languages: this.voice.languages(),
    };
  }

  /** Live price for a piece of text, before anything is charged. */
  @Get('quote')
  quote(@Query('text') text?: string, @Query('cloned') cloned?: string) {
    return this.voice.quote(text ?? '', cloned === 'true');
  }

  /**
   * Registers the customer's own voice from a recording.
   *
   * Free — the vendor charges for speech, not registration, and charging for
   * this would stop people trying the one feature that makes them stay.
   */
  @Post('clone')
  @UseInterceptors(FileInterceptor('sample', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @HttpCode(200)
  async clone(
    @Req() req: AuthedRequest,
    @Body() body: { name?: string; language?: string; transcript?: string; consent?: string | boolean },
    @UploadedFile() sample?: Express.Multer.File,
  ) {
    if (!sample) throw new BadRequestException('Record or upload a voice sample.');

    try {
      return await this.voice.cloneVoice({
        userId: req.userId!,
        sample: sample.buffer,
        contentType: sample.mimetype,
        name: body?.name ?? '',
        language: parseLanguage(body?.language),
        transcript: body?.transcript,
        consent: body?.consent === true || body?.consent === 'true',
      });
    } catch (error) {
      throw VoiceController.present(error);
    }
  }

  /** Speaks text, in a preset voice or the customer's own. */
  @Post('speak')
  @HttpCode(200)
  async speak(
    @Req() req: AuthedRequest,
    @Body() body: { text?: string; language?: string; voiceAssetId?: string },
  ) {
    try {
      return await this.voice.speak({
        userId: req.userId!,
        text: body?.text ?? '',
        language: parseLanguage(body?.language),
        voiceAssetId: body?.voiceAssetId,
      });
    } catch (error) {
      throw VoiceController.present(error);
    }
  }

  /** Turns an internal failure into something the customer can act on. */
  private static present(error: unknown): unknown {
    if (error instanceof InsufficientCreditsError) {
      return new BadRequestException({
        error: 'insufficient_credits',
        message: 'Not enough credits for that voiceover. Top up to continue.',
        required: error.required,
        available: error.available,
      });
    }
    if (error instanceof MarginFloorBreachError) {
      return new ServiceUnavailableException({
        error: 'voice_unavailable',
        message: 'Voiceovers are temporarily unavailable.',
      });
    }
    if (error instanceof VendorError) {
      // Credits are already back; say so rather than returning a 500.
      return new BadRequestException({
        error: 'voice_failed',
        message: error.userMessage,
        refunded: true,
      });
    }
    return error;
  }
}
