import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TenancyService } from './tenancy.service';

@Injectable()
export class ColombiaSitesSeedService implements OnModuleInit {
  private readonly logger = new Logger(ColombiaSitesSeedService.name);

  constructor(private readonly tenancy: TenancyService) {}

  async onModuleInit() {
    if (String(process.env.SEED_COLOMBIA_SITES ?? 'true').toLowerCase() === 'false') return;
    try {
      const result = await this.tenancy.syncColombiaCatalog();
      if (result.created > 0) {
        this.logger.log(
          `Sedes Colombia: ${result.created} nuevas (activas: ${result.totalActive}, catálogo: ${result.catalogSize}).`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Seed sedes Colombia omitido (Mongo): ${msg}`);
    }
  }
}
