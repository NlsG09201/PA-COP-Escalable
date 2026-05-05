import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { UUID } from 'bson';
import * as crypto from 'crypto';
import { Connection } from 'mongoose';
import { TenantContext } from '../tenancy/tenancy.interceptor';

type ServiceCategory = 'ODONTOLOGIA' | 'PSICOLOGIA';

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

function normalizeCategory(raw: any): ServiceCategory {
  const v = String(raw ?? '').toUpperCase();
  return v === 'PSICOLOGIA' ? 'PSICOLOGIA' : 'ODONTOLOGIA';
}

@Injectable()
export class ServicesService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async list(tenant: TenantContext) {
    return this.queryServices({}, tenant);
  }

  async listByCategory(category: string, tenant: TenantContext) {
    return this.queryServices({ category: normalizeCategory(category) }, tenant);
  }

  async create(input: { name?: string; description?: string; category?: ServiceCategory; price?: number; duration?: number }, tenant: TenantContext) {
    const payload = this.validateUpsert(input);
    const category = normalizeCategory(payload.category);

    const siteUuid = asUuid(tenant.siteId);
    if (!siteUuid) throw new BadRequestException('Tenant site is required');

    const categoryDoc = await this.findServiceCategoryDoc(category, tenant);
    const catalogId = new UUID(crypto.randomUUID());
    const offeringId = new UUID(crypto.randomUUID());

    await this.connection.collection<any>('catalog_services').insertOne({
      _id: catalogId,
      organization_id: new UUID(tenant.organizationId),
      category_id: categoryDoc._id,
      code: this.slugify(payload.name),
      name: payload.name,
      description: payload.description,
      default_duration_minutes: payload.duration ?? null,
      specialty_match_tokens: '',
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await this.connection.collection<any>('service_offerings').insertOne({
      _id: offeringId,
      catalog_service_id: catalogId,
      public_title: payload.name,
      public_description: payload.description,
      base_price: payload.price ?? 0,
      currency: 'COP',
      visible_public: true,
      active: true,
      organization_id: new UUID(tenant.organizationId),
      site_id: siteUuid,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return this.getByOfferingId(offeringId, tenant);
  }

  async update(id: string, input: { name?: string; description?: string; category?: ServiceCategory; price?: number; duration?: number }, tenant: TenantContext) {
    const offeringUuid = asUuid(id);
    if (!offeringUuid) throw new BadRequestException('id must be a UUID');
    const payload = this.validateUpsert(input);
    const category = normalizeCategory(payload.category);

    const offering = await this.connection.collection<any>('service_offerings').findOne({ _id: offeringUuid as any } as any);
    if (!offering) throw new NotFoundException('Service not found');

    const categoryDoc = await this.findServiceCategoryDoc(category, tenant);

    await this.connection.collection<any>('service_offerings').updateOne(
      { _id: offering._id },
      {
        $set: {
          public_title: payload.name,
          public_description: payload.description,
          base_price: payload.price ?? 0,
          updated_at: new Date(),
        },
      },
    );

    if (offering.catalog_service_id) {
      await this.connection.collection<any>('catalog_services').updateOne(
        { _id: offering.catalog_service_id },
        {
          $set: {
            name: payload.name,
            description: payload.description,
            category_id: categoryDoc._id,
            default_duration_minutes: payload.duration ?? null,
            updated_at: new Date(),
          },
        },
      );
    }

    return this.getByOfferingId(offeringUuid, tenant);
  }

  async setActive(id: string, active: boolean, tenant: TenantContext) {
    const offeringUuid = asUuid(id);
    if (!offeringUuid) throw new BadRequestException('id must be a UUID');

    const offering = await this.connection.collection<any>('service_offerings').findOne({ _id: offeringUuid as any } as any);
    if (!offering) throw new NotFoundException('Service not found');

    await this.connection.collection<any>('service_offerings').updateOne({ _id: offering._id }, { $set: { active, updated_at: new Date() } });
    if (offering.catalog_service_id) {
      await this.connection.collection<any>('catalog_services').updateOne({ _id: offering.catalog_service_id }, { $set: { active, updated_at: new Date() } });
    }
    return this.getByOfferingId(offeringUuid, tenant);
  }

  async remove(id: string, tenant: TenantContext) {
    const offeringUuid = asUuid(id);
    if (!offeringUuid) throw new BadRequestException('id must be a UUID');

    const offering = await this.connection.collection<any>('service_offerings').findOne({ _id: offeringUuid as any } as any);
    if (!offering) throw new NotFoundException('Service not found');

    await this.connection.collection<any>('service_offerings').deleteOne({ _id: offering._id });
    if (offering.catalog_service_id) {
      await this.connection.collection<any>('catalog_services').deleteOne({ _id: offering.catalog_service_id });
    }
    return { ok: true };
  }

  private async queryServices(filter: { category?: ServiceCategory }, tenant: TenantContext) {
    const siteUuid = tenant.siteId ? asUuid(tenant.siteId) : undefined;
    const match: any = {
      organization_id: new UUID(tenant.organizationId),
    };
    if (siteUuid) match.site_id = siteUuid;

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: 'catalog_services',
          localField: 'catalog_service_id',
          foreignField: '_id',
          as: 'catalog',
        },
      },
      { $unwind: { path: '$catalog', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'service_categories',
          localField: 'catalog.category_id',
          foreignField: '_id',
          as: 'categoryDoc',
        },
      },
      { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
    ];

    if (filter.category) {
      // Map category by slug/name; keep simple.
      const want = filter.category === 'PSICOLOGIA';
      pipeline.push({
        $match: {
          $expr: {
            $eq: [
              {
                $regexMatch: {
                  input: { $toLower: { $ifNull: ['$categoryDoc.slug', '$categoryDoc.name'] } },
                  regex: 'psic',
                },
              },
              want,
            ],
          },
        },
      });
    }

    pipeline.push({ $sort: { updated_at: -1 } });

    const rows = await this.connection.collection<any>('service_offerings').aggregate(pipeline).toArray();

    return rows.map((r: any) => {
      const categoryGuess = String(r?.categoryDoc?.slug ?? r?.categoryDoc?.name ?? '').toLowerCase().includes('psic') ? 'PSICOLOGIA' : 'ODONTOLOGIA';
      return {
        id: asStringId(r._id),
        name: String(r.public_title ?? r.catalog?.name ?? 'Servicio'),
        description: String(r.public_description ?? r.catalog?.description ?? ''),
        category: categoryGuess,
        price: Number(r.base_price ?? 0),
        duration: r.catalog?.default_duration_minutes == null ? null : Number(r.catalog.default_duration_minutes),
        active: Boolean(r.active ?? true),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
      };
    });
  }

  private validateUpsert(input: any) {
    const name = String(input?.name ?? '').trim();
    const description = String(input?.description ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    if (!description) throw new BadRequestException('description is required');
    const category = normalizeCategory(input?.category);
    const price = input?.price == null ? 0 : Number(input.price);
    const duration = input?.duration == null ? null : Number(input.duration);
    return { name, description, category, price, duration };
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 64);
  }

  private async getByOfferingId(offeringId: UUID, tenant: TenantContext) {
    const list = await this.connection
      .collection<any>('service_offerings')
      .aggregate([
        { $match: { _id: offeringId } as any },
        {
          $lookup: {
            from: 'catalog_services',
            localField: 'catalog_service_id',
            foreignField: '_id',
            as: 'catalog',
          },
        },
        { $unwind: { path: '$catalog', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'service_categories',
            localField: 'catalog.category_id',
            foreignField: '_id',
            as: 'categoryDoc',
          },
        },
        { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    const row = list?.[0];
    if (!row) throw new NotFoundException('Service not found');
    const categoryGuess = String(row?.categoryDoc?.slug ?? row?.categoryDoc?.name ?? '').toLowerCase().includes('psic') ? 'PSICOLOGIA' : 'ODONTOLOGIA';
    return {
      id: asStringId(row._id),
      name: String(row.public_title ?? row.catalog?.name ?? 'Servicio'),
      description: String(row.public_description ?? row.catalog?.description ?? ''),
      category: categoryGuess,
      price: Number(row.base_price ?? 0),
      duration: row.catalog?.default_duration_minutes == null ? null : Number(row.catalog.default_duration_minutes),
      active: Boolean(row.active ?? true),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    };
  }

  private async findServiceCategoryDoc(category: ServiceCategory, tenant: TenantContext) {
    const wantPsych = category === 'PSICOLOGIA';
    const orgUuid = new UUID(tenant.organizationId);
    const docs = await this.connection
      .collection<any>('service_categories')
      .find({ organization_id: orgUuid } as any)
      .toArray();

    const pick = docs.find((d: any) => {
      const hay = String(d.slug ?? d.name ?? '').toLowerCase();
      return wantPsych ? hay.includes('psic') : hay.includes('odonto');
    });

    if (!pick) throw new BadRequestException('service category not found for tenant');
    return pick;
  }
}

