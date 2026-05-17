import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenancyInterceptor } from './tenancy.interceptor';
import { TenancyService } from './tenancy.service';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { Site, SiteSchema } from './schemas/site.schema';
import { Professional, ProfessionalSchema } from './schemas/professional.schema';
import { PublicTenancyController } from './public-tenancy.controller';
import { SitesAdminController } from './sites-admin.controller';
import { ColombiaSitesSeedService } from './colombia-sites.seed';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: Site.name, schema: SiteSchema },
      { name: Professional.name, schema: ProfessionalSchema },
    ]),
  ],
  controllers: [PublicTenancyController, SitesAdminController],
  providers: [TenancyInterceptor, TenancyService, ColombiaSitesSeedService],
  exports: [TenancyInterceptor, TenancyService],
})
export class TenancyModule {}
