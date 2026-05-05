import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { UUID } from 'bson';
import * as crypto from 'crypto';
import { Connection } from 'mongoose';
import { TenantContext } from '../tenancy/tenancy.interceptor';

function asUuid(value?: string): UUID | undefined {
  if (!value) return undefined;
  try {
    return new UUID(String(value));
  } catch {
    return undefined;
  }
}

function asStringId(value: any): string {
  if (!value) return '';
  try {
    return typeof value === 'string' ? value : value.toString();
  } catch {
    return String(value);
  }
}

@Injectable()
export class OdontologyService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async listPlansForPatient(patientId: string, tenant: TenantContext) {
    const patientUuid = asUuid(patientId);
    if (!patientUuid) throw new BadRequestException('patientId must be a UUID');

    // Prefer legacy `treatment_plans` if it uses org/site/patient camelCase, otherwise fall back to budgets-based plans.
    const plans = await this.connection
      .collection<any>('treatment_plans')
      .find(
        {
          patientId: patientUuid as any,
          organizationId: new UUID(String(tenant.organizationId)),
        } as any,
      )
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    const mapped = plans.map((p: any) => this.mapTreatmentPlan(p));
    if (mapped.length > 0) return mapped;

    // Fallback to budgets as "plans" so the dashboard has something to render.
    const budgets = await this.connection
      .collection<any>('clinical_budgets')
      .find(
        {
          patient_id: patientUuid as any,
          organization_id: new UUID(String(tenant.organizationId)),
          ...(tenant.siteId ? { site_id: new UUID(String(tenant.siteId)) } : {}),
        } as any,
      )
      .sort({ updated_at: -1 })
      .limit(50)
      .toArray();

    return budgets.map((b: any) => ({
      id: asStringId(b._id),
      patientId: asStringId(b.patient_id),
      name: String(b.name ?? 'Plan de tratamiento'),
      status: (String(b.status ?? 'DRAFT').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'DRAFT') as any,
      createdAt: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString(),
      updatedAt: b.updated_at ? new Date(b.updated_at).toISOString() : new Date().toISOString(),
      steps: [],
    }));
  }

  async suggestPlanForPatient(patientId: string, tenant: TenantContext) {
    const patientUuid = asUuid(patientId);
    if (!patientUuid) throw new BadRequestException('patientId must be a UUID');

    const now = new Date();
    const doc: any = {
      _id: new UUID(crypto.randomUUID()),
      organizationId: new UUID(String(tenant.organizationId)),
      siteId: tenant.siteId ? new UUID(String(tenant.siteId)) : undefined,
      patientId: patientUuid,
      name: `Plan sugerido - ${now.toISOString().slice(0, 10)}`,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
      steps: [
        {
          toothCode: 'GEN',
          description: 'Valoración clínica inicial y plan de tratamiento',
          estimatedCost: 0,
          completed: false,
        },
      ],
    };

    await this.connection.collection<any>('treatment_plans').insertOne(doc);
    return this.mapTreatmentPlan(doc);
  }

  private mapTreatmentPlan(p: any) {
    return {
      id: asStringId(p._id),
      patientId: asStringId(p.patientId),
      name: String(p.name ?? 'Plan de tratamiento'),
      status: (String(p.status ?? 'DRAFT').toUpperCase() as any) ?? 'DRAFT',
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
      steps: Array.isArray(p.steps)
        ? p.steps.map((s: any) => ({
            toothCode: String(s.toothCode ?? 'GEN'),
            description: String(s.description ?? ''),
            estimatedCost: Number(s.estimatedCost ?? 0),
            completed: Boolean(s.completed ?? false),
          }))
        : [],
    };
  }
}

