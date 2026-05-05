import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization } from './schemas/organization.schema';
import { Site } from './schemas/site.schema';
import { Professional } from './schemas/professional.schema';

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

  async listActiveSites(): Promise<Site[]> {
    return this.siteModel.find({ status: 'ACTIVE' }).exec();
  }

  async findProfessionalsByOrg(orgId: string): Promise<Professional[]> {
    return this.profModel.find({ organization_id: orgId, status: 'ACTIVE' }).exec();
  }
}
