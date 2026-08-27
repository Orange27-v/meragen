import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { usdToMicros } from '../pricing/money';

export interface CatalogEntry {
  modelId: string;
  category: string;
  costUsdMicros: number;
  dynamicPricing: boolean;
}

/**
 * Reads MuAPI's model catalogue.
 *
 * The catalogue endpoint is public and unauthenticated, which is what makes
 * daily price monitoring cheap enough to actually run.
 */
@Injectable()
export class MuApiCatalogClient {
  private readonly logger = new Logger(MuApiCatalogClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('MUAPI_BASE_URL', 'https://api.muapi.ai');
  }

  async fetchCatalog(): Promise<CatalogEntry[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/models`);
    if (!response.ok) {
      throw new Error(`MuAPI catalogue fetch failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as {
      models: Array<{
        name: string;
        category?: string;
        cost?: number;
        cost_currency?: string;
        dynamic_pricing?: boolean;
      }>;
    };

    const entries: CatalogEntry[] = [];
    for (const model of body.models ?? []) {
      if (typeof model.cost !== 'number' || !model.name) continue;
      if (model.cost_currency && model.cost_currency !== 'USD') {
        this.logger.warn(`Skipping ${model.name}: unexpected currency ${model.cost_currency}`);
        continue;
      }
      entries.push({
        modelId: model.name,
        category: model.category ?? 'unknown',
        costUsdMicros: usdToMicros(model.cost),
        dynamicPricing: model.dynamic_pricing === true,
      });
    }

    this.logger.log(`Fetched ${entries.length} priced models from MuAPI`);
    return entries;
  }
}
