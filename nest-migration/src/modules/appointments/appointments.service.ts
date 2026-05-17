import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  unassignedOnly?: boolean;
};

@Injectable()
export class AppointmentService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private parseAppointmentId(id: string): string | UUID {
    try {
      return new UUID(id);
    } catch {
      return id;
    }
  }

  async listProfessionals(tenant: TenantContext) {
    const orgOid = new UUID(String(tenant.organizationId));
    const docs = await this.connection
      .collection<any>('professionals')
      .find({ organization_id: orgOid, status: 'ACTIVE' } as any, { projection: { full_name: 1 } })
      .sort({ full_name: 1 })
      .toArray();
    return (docs ?? []).map((d: any) => ({ id: String(d._id), name: String(d.full_name ?? '') }));
  }

  async findPage(query: FindPageQuery, tenant: TenantContext) {
    const page = Number.isFinite(query.page) ? Math.max(0, query.page) : 0;
    const size = Number.isFinite(query.size) ? Math.min(Math.max(1, query.size), 200) : 50;
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    const filter: Record<string, unknown> = {
      organization_id: new UUID(String(tenant.organizationId)),
    };
    if (tenant.siteId) filter['site_id'] = new UUID(String(tenant.siteId));

    if (query.unassignedOnly) {
      filter['$or'] = [{ professional_id: null }, { professional_id: { $exists: false } }];
    } else if (query.professionalId?.trim()) {
      try {
        filter['professional_id'] = new UUID(query.professionalId.trim());
      } catch {
        filter['professional_id'] = query.professionalId.trim();
      }
    }
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

    const items = (docs ?? []).map((d: any) => {
      const startAt = d.start_at ? new Date(d.start_at).toISOString() : null;
      const endAt = d.end_at ? new Date(d.end_at).toISOString() : null;
      return {
        id: String(d._id),
        startAt,
        endAt,
        start: startAt,
        end: endAt,
        status: d.status ?? AppointmentStatus.REQUESTED,
        reason: d.reason ?? null,
        professionalId: d.professional_id ? String(d.professional_id) : null,
        patientId: d.patient_id ? String(d.patient_id) : null,
        serviceNameSnapshot: d.service_name_snapshot ?? null,
        serviceCategorySnapshot: d.service_category_snapshot ?? null,
      };
    });

    return {
      items,
      page,
      size,
      total,
      hasNext: (page + 1) * size < total,
    };
  }

  async findById(id: string, tenant: TenantContext): Promise<any> {
    const oid = this.parseAppointmentId(id);
    const appointment = await this.connection.collection<any>('appointments').findOne({
      _id: oid,
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
    const oid = this.parseAppointmentId(id);
    await this.connection.collection<any>('appointments').updateOne({ _id: oid } as any, { $set: { status, updated_at: new Date() } });
    return this.connection.collection<any>('appointments').findOne({ _id: oid } as any);
  }

  async claimAppointment(appointmentId: string, professionalId: string, tenant: TenantContext): Promise<any> {
    const apptOid = this.parseAppointmentId(appointmentId);
    let profOid: UUID;
    try {
      profOid = new UUID(professionalId);
    } catch {
      throw new BadRequestException('professionalId must be a valid UUID');
    }

    const orgOid = new UUID(String(tenant.organizationId));
    const filter: Record<string, unknown> = { _id: apptOid, organization_id: orgOid };
    if (tenant.siteId) filter['site_id'] = new UUID(String(tenant.siteId));

    const appt = await this.connection.collection<any>('appointments').findOne(filter as any);
    if (!appt) throw new NotFoundException('Appointment not found');
    if (appt.professional_id) throw new ConflictException('La cita ya tiene un profesional asignado');

    const prof = await this.connection.collection<any>('professionals').findOne({
      _id: profOid,
      organization_id: orgOid,
      status: 'ACTIVE',
    } as any);
    if (!prof) throw new BadRequestException('Profesional no encontrado');

    const startAt = new Date(appt.start_at);
    const endAt = new Date(appt.end_at);
    const overlap = await this.connection.collection<any>('appointments').findOne({
      _id: { $ne: apptOid },
      professional_id: profOid,
      organization_id: orgOid,
      status: { $in: ['REQUESTED', 'CONFIRMED', 'COMPLETED'] },
      start_at: { $lt: endAt },
      end_at: { $gt: startAt },
    } as any);
    if (overlap) throw new ConflictException('El profesional ya tiene otra cita en ese horario');

    await this.connection.collection<any>('appointments').updateOne({ _id: apptOid } as any, {
      $set: { professional_id: profOid, updated_at: new Date() },
    });
    await this.connection.collection<any>('public_bookings').updateMany(
      { appointment_id: apptOid } as any,
      { $set: { professional_id: profOid, updated_at: new Date() } },
    );

    return this.connection.collection<any>('appointments').findOne({ _id: apptOid } as any);
  }
}
