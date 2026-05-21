import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { UUID } from 'bson';
import { Connection } from 'mongoose';
import { CreatePatientDto } from './dto/create-patient.dto';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { buildTenantDocumentMatch, idVariants } from '../tenancy/tenant-query.util';

@Injectable()
export class PatientService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async findAll(tenant: TenantContext): Promise<any[]> {
    const page = await this.findPage(tenant, { page: 0, size: 500 });
    return page.items;
  }

  async findPage(
    tenant: TenantContext,
    opts: { page?: number; size?: number; search?: string },
  ): Promise<{ items: any[]; page: number; size: number; total: number; hasNext: boolean }> {
    const page = Math.max(0, Number(opts.page ?? 0));
    const size = Math.min(500, Math.max(1, Number(opts.size ?? 50)));
    const search = String(opts.search ?? '').trim();

    const clauses: Record<string, unknown>[] = [
      buildTenantDocumentMatch(tenant, { patientsCollection: true }),
    ];
    if (search) {
      const regex = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      clauses.push({
        $or: [{ full_name: regex }, { email: regex }, { phone: regex }, { external_code: regex }],
      });
    }
    const match = clauses.length === 1 ? clauses[0] : { $and: clauses };

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
      items: items.map((p) => this.mapPatientRow(p)),
      page,
      size,
      total,
      hasNext: (page + 1) * size < total,
    };
  }

  private mapPatientRow(p: Record<string, unknown>) {
    const id = String(p._id ?? '');
    return {
      ...p,
      id,
      name: p.full_name,
      full_name: p.full_name,
      document: p.external_code ?? p.document,
      external_code: p.external_code,
      status: p.status ?? 'ACTIVE',
      lastVisit: p.updated_at,
    };
  }

  async create(dto: CreatePatientDto, tenant: TenantContext): Promise<any> {
    const doc: any = {
      ...dto,
      organization_id: idVariants(tenant.organizationId)[0],
      site_id: tenant.siteId ? idVariants(tenant.siteId)[0] : undefined,
      created_at: new Date(),
      updated_at: new Date(),
      status: 'ACTIVE',
    };

    const res = await this.connection.collection<any>('patients').insertOne(doc);
    return this.connection.collection<any>('patients').findOne({ _id: res.insertedId });
  }
}
