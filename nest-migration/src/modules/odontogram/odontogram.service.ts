import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Connection } from 'mongoose';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { buildTenantDocumentMatch, idVariants } from '../tenancy/tenant-query.util';

export type OdontogramDto = {
  patientId: string;
  organizationId: string;
  siteId?: string;
  createdAt?: string;
  updatedAt?: string;
  teeth: Record<string, string>;
  clinicalTeeth: Record<string, unknown>;
  orthoSimulation?: unknown;
  integrationExtensions: Record<string, string>;
};

@Injectable()
export class OdontogramService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private col() {
    return this.connection.collection<Record<string, unknown>>('odontograms');
  }

  private patientMatch(patientId: string, tenant: TenantContext): Record<string, unknown> {
    const pid = String(patientId).trim();
    const patientClause = {
      $or: [
        { patientId: { $in: idVariants(pid) } },
        { patient_id: { $in: idVariants(pid) } },
      ],
    };
    const tenantClause = buildTenantDocumentMatch(tenant);
    return { $and: [tenantClause, patientClause] };
  }

  async getOrCreate(patientId: string, tenant: TenantContext): Promise<OdontogramDto> {
    const existing = await this.col().findOne(this.patientMatch(patientId, tenant));
    if (existing) {
      return this.toDto(existing, patientId, tenant);
    }

    const now = new Date();
    const org = String(tenant.organizationId);
    const site = tenant.siteId ? String(tenant.siteId) : undefined;
    const doc: Record<string, unknown> = {
      _id: randomUUID(),
      patientId: patientId,
      patient_id: patientId,
      organizationId: org,
      organization_id: org,
      siteId: site,
      site_id: site,
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
      teeth: {},
      clinicalTeeth: {},
      clinical_teeth: {},
      integrationExtensions: {},
      integration_extensions: {},
    };

    await this.col().insertOne(doc);
    return this.toDto(doc, patientId, tenant);
  }

  async patch(patientId: string, payload: any, tenant: TenantContext): Promise<OdontogramDto> {
    const current = await this.getOrCreate(patientId, tenant);
    const filter = this.patientMatch(patientId, tenant);
    const $set: Record<string, unknown> = {
      updatedAt: new Date(),
      updated_at: new Date(),
    };

    if (payload?.teeth && typeof payload.teeth === 'object') {
      const mergedTeeth = { ...current.teeth, ...payload.teeth };
      $set.teeth = mergedTeeth;
      current.teeth = mergedTeeth;
    }

    if (payload?.clinicalTooth && typeof payload.clinicalTooth === 'object') {
      const ct = payload.clinicalTooth;
      const tooth = String(ct.tooth ?? '').trim();
      if (tooth) {
        const clinical = { ...current.clinicalTeeth };
        const prev = (clinical[tooth] as Record<string, unknown>) ?? {};
        const next: Record<string, unknown> = {
          ...prev,
          status: String(ct.status ?? prev['status'] ?? 'HEALTHY'),
          braces: Boolean(ct.braces),
          damages: Array.isArray(ct.damages)
            ? ct.damages.map((d: unknown) => String(d))
            : Array.isArray(prev['damages'])
              ? prev['damages']
              : [],
          diagnosis: String(ct.diagnosis ?? prev['diagnosis'] ?? ''),
          treatment: String(ct.treatment ?? prev['treatment'] ?? ''),
          clinicalObservations: String(
            ct.clinicalObservations ?? prev['clinicalObservations'] ?? '',
          ),
          updatedAt: new Date(),
          progressHistory: Array.isArray(prev['progressHistory'])
            ? [...(prev['progressHistory'] as unknown[])]
            : [],
        };
        if (ct.appendHistory) {
          const history = next['progressHistory'] as unknown[];
          history.unshift({
            at: new Date(),
            status: next['status'],
            diagnosis: next['diagnosis'],
            treatment: next['treatment'],
            observations: next['clinicalObservations'],
          });
          if (history.length > 200) history.length = 200;
        }
        clinical[tooth] = next;
        $set.clinicalTeeth = clinical;
        $set.clinical_teeth = clinical;
        current.clinicalTeeth = clinical;
        current.teeth = { ...current.teeth, [tooth]: String(next['status']) };
        $set.teeth = current.teeth;
      }
    }

    if (payload?.simulation && typeof payload.simulation === 'object') {
      $set.orthoSimulation = payload.simulation;
      $set.ortho_simulation = payload.simulation;
      current.orthoSimulation = payload.simulation;
    }

    await this.col().updateOne(filter, { $set });
    const refreshed = await this.col().findOne(filter);
    return this.toDto(refreshed ?? { ...current, ...$set }, patientId, tenant);
  }

  private toDto(
    raw: Record<string, unknown>,
    patientId: string,
    tenant: TenantContext,
  ): OdontogramDto {
    const teethRaw = raw['teeth'];
    const teeth: Record<string, string> =
      teethRaw && typeof teethRaw === 'object' && !Array.isArray(teethRaw)
        ? Object.fromEntries(
            Object.entries(teethRaw as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
          )
        : {};

    const clinicalRaw =
      raw['clinicalTeeth'] ?? raw['clinical_teeth'] ?? {};
    const clinicalTeeth =
      clinicalRaw && typeof clinicalRaw === 'object' && !Array.isArray(clinicalRaw)
        ? (clinicalRaw as Record<string, unknown>)
        : {};

    const org = String(
      raw['organizationId'] ?? raw['organization_id'] ?? tenant.organizationId,
    );
    const siteRaw = raw['siteId'] ?? raw['site_id'] ?? tenant.siteId;
    const site = siteRaw != null && String(siteRaw).trim() !== '' ? String(siteRaw) : undefined;

    return {
      patientId: String(raw['patientId'] ?? raw['patient_id'] ?? patientId),
      organizationId: org,
      siteId: site,
      createdAt: this.iso(raw['createdAt'] ?? raw['created_at']),
      updatedAt: this.iso(raw['updatedAt'] ?? raw['updated_at']),
      teeth,
      clinicalTeeth,
      orthoSimulation: raw['orthoSimulation'] ?? raw['ortho_simulation'],
      integrationExtensions: this.mapExtensions(
        raw['integrationExtensions'] ?? raw['integration_extensions'],
      ),
    };
  }

  private mapExtensions(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    );
  }

  private iso(value: unknown): string | undefined {
    if (value == null) return undefined;
    const d = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
}
