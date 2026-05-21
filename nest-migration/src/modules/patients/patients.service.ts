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
    const page = await this.findPage(tenant, { page: 0, size: 500 });
    return page.items;
  }

  async findPage(
    tenant: TenantContext,
    opts: { page?: number; size?: number; search?: string; orgWide?: boolean },
  ): Promise<{ items: any[]; page: number; size: number; total: number; hasNext: boolean }> {
    const page = Math.max(0, Number(opts.page ?? 0));
    const size = Math.min(200, Math.max(1, Number(opts.size ?? 50)));
    const search = String(opts.search ?? '').trim();
    const orgId = String(tenant.organizationId);

    const match: Record<string, unknown> = {
      $or: [{ organization_id: orgId }, { organization_id: new UUID(orgId) }],
    };
    if (tenant.siteId && !opts.orgWide) {
      const siteId = String(tenant.siteId);
      match.site_id = { $in: [siteId, new UUID(siteId)] };
    }
    if (search) {
      const regex = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      match.$or = [{ full_name: regex }, { email: regex }, { phone: regex }, { external_code: regex }];
    }

    const col = this.connection.collection<any>('patients');
    const [total, items] = await Promise.all([
      col.countDocuments(match),
      col
        .find(match)
        .sort({ updated_at: -1, full_name: 1 })
        .skip(page * size)
        .limit(size)
        .toArray(),
    ]);

    return {
      items,
      page,
      size,
      total,
      hasNext: (page + 1) * size < total,
    };
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
