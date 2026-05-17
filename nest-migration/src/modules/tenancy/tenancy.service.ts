import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization } from './schemas/organization.schema';
import { Site } from './schemas/site.schema';
import { Professional } from './schemas/professional.schema';
import { COLOMBIA_SITES_CATALOG } from './colombia-sites.catalog';

@Injectable()
export class TenancyService {
  constructor(
    @InjectModel(Organization.name) private orgModel: Model<Organization>,
    @InjectModel(Site.name) private siteModel: Model<Site>,
    @InjectModel(Professional.name) private profModel: Model<Professional>,
  ) {}

  async findOrgById(id: string): Promise<Organization> {
    const org = await this.orgModel.findById(id).exec();
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async findSitesByOrg(orgId: string): Promise<Site[]> {
    return this.siteModel.find({ organization_id: orgId, status: 'ACTIVE' }).exec();
  }

  async listActiveSites(department?: string): Promise<Site[]> {
    const filter: Record<string, unknown> = { status: 'ACTIVE' };
    if (department?.trim()) {
      filter.department = new RegExp(`^${department.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    return this.siteModel.find(filter).sort({ department: 1, name: 1 }).exec();
  }

  async listDepartments(): Promise<string[]> {
    const rows = await this.siteModel
      .distinct('department', { status: 'ACTIVE', department: { $exists: true, $nin: [null, ''] } })
      .exec();
    return (rows as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
  }

  async syncColombiaCatalog(): Promise<{ created: number; totalActive: number; catalogSize: number }> {
    let org = await this.orgModel.findOne({}).exec();
    if (!org) {
      org = await this.orgModel.create({ name: 'COP Nacional', status: 'ACTIVE' } as any);
    }
    const orgId = String(org._id);
    let created = 0;
    for (const row of COLOMBIA_SITES_CATALOG) {
      const exists = await this.siteModel
        .findOne({ organization_id: orgId, name: row.siteName, department: row.department })
        .exec();
      if (exists) continue;
      await this.siteModel.create({
        organization_id: orgId,
        name: row.siteName,
        timezone: 'America/Bogota',
        department: row.department,
        municipality: row.municipality,
        address: `${row.municipality}, ${row.department}, Colombia`,
        status: 'ACTIVE',
      });
      created += 1;
    }
    const totalActive = await this.siteModel.countDocuments({ status: 'ACTIVE' }).exec();
    return { created, totalActive, catalogSize: COLOMBIA_SITES_CATALOG.length };
  }

  async createSite(input: {
    organization_id: string;
    name: string;
    timezone: string;
    department?: string;
    municipality?: string;
    address?: string;
  }): Promise<Site> {
    return this.siteModel.create({
      ...input,
      status: 'ACTIVE',
    });
  }

  async findProfessionalsByOrg(orgId: string): Promise<Professional[]> {
    return this.profModel.find({ organization_id: orgId, status: 'ACTIVE' }).exec();
  }
}
