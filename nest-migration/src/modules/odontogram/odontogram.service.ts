import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Odontogram } from './schemas/odontogram.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';

@Injectable()
export class OdontogramService {
  constructor(
    @InjectModel(Odontogram.name) private odontogramModel: Model<Odontogram>,
  ) {}

  async getOrCreate(patientId: string, tenant: TenantContext): Promise<Odontogram> {
    const odontogram = await this.odontogramModel.findOne({
      patientId,
      organizationId: tenant.organizationId,
      siteId: tenant.siteId,
    }).exec();

    if (odontogram) return odontogram;
    const created = new this.odontogramModel({
      patientId,
      organizationId: tenant.organizationId,
      siteId: tenant.siteId,
      createdAt: new Date(),
      updatedAt: new Date(),
      teeth: {},
      clinicalTeeth: {},
      integrationExtensions: {},
    });
    return created.save();
  }

  async patch(patientId: string, payload: any, tenant: TenantContext): Promise<Odontogram> {
    const o = await this.getOrCreate(patientId, tenant);

    if (payload?.teeth && typeof payload.teeth === 'object') {
      o.teeth = { ...(o.teeth ?? {}), ...payload.teeth };
    }

    if (payload?.clinicalTooth && typeof payload.clinicalTooth === 'object') {
      const ct = payload.clinicalTooth;
      const tooth = String(ct.tooth ?? '').trim();
      if (tooth) {
        const prev = ((o.clinicalTeeth ?? {}) as any)[tooth] ?? {};
        const next = {
          ...prev,
          status: String(ct.status ?? prev.status ?? 'HEALTHY'),
          braces: Boolean(ct.braces),
          damages: Array.isArray(ct.damages) ? ct.damages.map((d: any) => String(d)) : prev.damages ?? [],
          diagnosis: String(ct.diagnosis ?? prev.diagnosis ?? ''),
          treatment: String(ct.treatment ?? prev.treatment ?? ''),
          clinicalObservations: String(ct.clinicalObservations ?? prev.clinicalObservations ?? ''),
          updatedAt: new Date(),
          progressHistory: Array.isArray(prev.progressHistory) ? [...prev.progressHistory] : [],
        };
        if (ct.appendHistory) {
          next.progressHistory.unshift({
            at: new Date(),
            status: next.status,
            diagnosis: next.diagnosis,
            treatment: next.treatment,
            observations: next.clinicalObservations,
          });
          if (next.progressHistory.length > 200) next.progressHistory.length = 200;
        }
        o.clinicalTeeth = { ...(o.clinicalTeeth ?? {}), [tooth]: next };
        o.teeth = { ...(o.teeth ?? {}), [tooth]: next.status };
      }
    }

    if (payload?.simulation && typeof payload.simulation === 'object') {
      o.orthoSimulation = payload.simulation;
    }

    o.updatedAt = new Date();
    return o.save();
  }
}
