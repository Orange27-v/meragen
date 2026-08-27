import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException, HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BrandAssetType } from '@prisma/client';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard';
import { BrandService } from './brand.service';
import { StorageService } from '../storage/storage.service';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '../storage/storage.types';

const TYPES = new Set(Object.values(BrandAssetType));

function parseType(value?: string): BrandAssetType | undefined {
  if (!value) return undefined;
  if (!TYPES.has(value as BrandAssetType)) {
    throw new BadRequestException(`Unknown kind. Use one of: ${[...TYPES].join(', ')}`);
  }
  return value as BrandAssetType;
}

@Controller('api/v1/brand')
@UseGuards(AuthGuard)
export class BrandController {
  constructor(
    private readonly brand: BrandService,
    private readonly storage: StorageService,
  ) {}

  /** Everything this account has saved, most-used first. */
  @Get()
  async list(@Req() req: AuthedRequest, @Query('type') type?: string) {
    return { items: await this.brand.list(req.userId!, parseType(type)) };
  }

  @Get(':id')
  async get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.brand.get(req.userId!, id);
  }

  /** Save a brand kit, or a voice profile once MyVoice exists. */
  @Post()
  @HttpCode(200)
  async create(
    @Req() req: AuthedRequest,
    @Body() body: { type?: string; name?: string; vendorReference?: string; metadata?: Record<string, unknown> },
  ) {
    return this.brand.create({
      userId: req.userId!,
      type: parseType(body?.type) ?? BrandAssetType.template,
      name: body?.name ?? '',
      vendorReference: body?.vendorReference,
      metadata: body?.metadata,
    });
  }

  /**
   * Keep a finished generation as a reusable character.
   *
   * One tap from the result screen — anything longer and nobody does it, and
   * the stickiness never accumulates.
   */
  @Post('from-generation')
  @HttpCode(200)
  async fromGeneration(
    @Req() req: AuthedRequest,
    @Body() body: { generationId?: string; name?: string; type?: string },
  ) {
    if (!body?.generationId) throw new BadRequestException('generationId is required');
    return this.brand.saveFromGeneration({
      userId: req.userId!,
      generationId: body.generationId,
      name: body.name ?? 'Untitled',
      type: parseType(body.type),
    });
  }

  /** Upload a face, logo or voice sample directly. */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @HttpCode(200)
  async upload(
    @Req() req: AuthedRequest,
    @Body() body: { type?: string; name?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');

    const contentType = file.mimetype?.split(';')[0] ?? '';
    if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
      throw new BadRequestException('That file type is not supported. Use a JPG, PNG, WEBP, MP4 or MP3.');
    }

    const stored = await this.storage.putUpload(req.userId!, file.buffer, contentType);
    return this.brand.create({
      userId: req.userId!,
      type: parseType(body?.type) ?? BrandAssetType.character,
      name: body?.name ?? file.originalname ?? 'Untitled',
      storageKey: stored.key,
      metadata: { contentType, bytes: file.size },
    });
  }

  @Patch(':id')
  async rename(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { name?: string }) {
    return this.brand.rename(req.userId!, id, body?.name ?? '');
  }

  @Delete(':id')
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.brand.remove(req.userId!, id);
  }
}
