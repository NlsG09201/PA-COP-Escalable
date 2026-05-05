import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { UUID } from 'bson';
import { Connection } from 'mongoose';
import { CreatePatientDto } from './dto/create-patient.dto';
import { TenantContext } from '../tenancy/tenancy.interceptor';

@Injectable()
export class PatientService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async findAll(tenant: TenantContext): Promise<any[]> {
    const match: any = { organization_id: new UUID(String(tenant.organizationId)) };
    if (tenant.siteId) match.site_id = new UUID(String(tenant.siteId));
    return this.connection.collection<any>('patients').find(match).limit(500).toArray();
  }

  async create(dto: CreatePatientDto, tenant: TenantContext): Promise<any> {
    const doc: any = {
      ...dto,
      organization_id: new UUID(String(tenant.organizationId)),
      site_id: tenant.siteId ? new UUID(String(tenant.siteId)) : undefined,
      created_at: new Date(),
      updated_at: new Date(),
      status: 'ACTIVE',
    };

    const res = await this.connection.collection<any>('patients').insertOne(doc);
    return this.connection.collection<any>('patients').findOne({ _id: res.insertedId });
  }
}
