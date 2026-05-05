import { Module } from '@nestjs/common';
import { PublicSiteController } from './public-site.controller';
import { PublicSiteService } from './public-site.service';

@Module({
  controllers: [PublicSiteController],
  providers: [PublicSiteService],
})
export class PublicSiteModule {}

