import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { UUID } from 'bson';
import { Connection } from 'mongoose';
import { AppointmentStatus } from './schemas/appointment.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';

type FindPageQuery = {
  from?: string;
  to?: string;
  page: number;
  size: number;
  professionalId?: string;
  status?: AppointmentStatus;
};

@Injectable()
export class AppointmentService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async findPage(query: FindPageQuery, tenant: TenantContext) {
    const page = Number.isFinite(query.page) ? Math.max(0, query.page) : 0;
    const size = Number.isFinite(query.size) ? Math.min(Math.max(1, query.size), 200) : 50;
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    const filter: Record<string, unknown> = {
      organization_id: new UUID(String(tenant.organizationId)),
    };
    if (tenant.siteId) filter['site_id'] = new UUID(String(tenant.siteId));

    if (query.professionalId?.trim()) filter['professional_id'] = query.professionalId.trim();
    if (query.status) filter['status'] = query.status;
    if (from && !Number.isNaN(from.getTime()) && to && !Number.isNaN(to.getTime())) {
      filter['start_at'] = { $gte: from, $lte: to };
    }

    const total = await this.connection.collection<any>('appointments').countDocuments(filter as any);
    const docs = await this.connection
      .collection<any>('appointments')
      .find(filter as any)
      .sort({ start_at: 1 })
      .skip(page * size)
      .limit(size)
      .toArray();

    const items = (docs ?? []).map((d: any) => ({
      id: String(d._id),
      startAt: d.start_at ? new Date(d.start_at).toISOString() : null,
      endAt: d.end_at ? new Date(d.end_at).toISOString() : null,
      status: d.status ?? AppointmentStatus.REQUESTED,
      reason: d.reason ?? null,
      professionalId: d.professional_id ?? null,
      patientId: d.patient_id ?? null,
      serviceNameSnapshot: d.service_name_snapshot ?? null,
      serviceCategorySnapshot: d.service_category_snapshot ?? null,
    }));

    return {
      items,
      page,
      size,
      total,
      hasNext: (page + 1) * size < total,
    };
  }

  async findById(id: string, tenant: TenantContext): Promise<any> {
    const appointment = await this.connection.collection<any>('appointments').findOne({
      _id: id,
      organization_id: new UUID(String(tenant.organizationId)),
    } as any);
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async create(dto: any, tenant: TenantContext): Promise<any> {
    const doc: any = {
      ...dto,
      organization_id: new UUID(String(tenant.organizationId)),
      site_id: tenant.siteId ? new UUID(String(tenant.siteId)) : undefined,
      status: AppointmentStatus.REQUESTED,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const res = await this.connection.collection<any>('appointments').insertOne(doc);
    return this.connection.collection<any>('appointments').findOne({ _id: res.insertedId });
  }

  async updateStatus(id: string, status: AppointmentStatus, tenant: TenantContext): Promise<any> {
    await this.findById(id, tenant);
    await this.connection.collection<any>('appointments').updateOne({ _id: id } as any, { $set: { status, updated_at: new Date() } });
    return this.connection.collection<any>('appointments').findOne({ _id: id } as any);
  }
}
