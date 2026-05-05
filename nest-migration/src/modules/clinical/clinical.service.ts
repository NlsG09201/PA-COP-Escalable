import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClinicalRecord } from './schemas/clinical-record.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';

@Injectable()
export class ClinicalService {
  constructor(
    @InjectModel(ClinicalRecord.name) private recordModel: Model<ClinicalRecord>,
  ) {}

  async getOrCreateRecord(patientId: string, tenant: TenantContext): Promise<ClinicalRecord> {
    let record = await this.recordModel.findOne({
      patientId,
      organizationId: tenant.organizationId,
    }).exec();

    if (!record) {
      record = new this.recordModel({
        patientId,
        organizationId: tenant.organizationId,
        siteId: tenant.siteId,
        entries: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await record.save();
    }
    return record;
  }

  async addEntry(
    patientId: string,
    entryDto: { type: string; note: string },
    tenant: TenantContext,
    user?: { userId?: string; username?: string }
  ): Promise<ClinicalRecord> {
    const record = await this.getOrCreateRecord(patientId, tenant);
    record.entries.push({
      type: String(entryDto.type ?? '').trim() || 'General',
      note: String(entryDto.note ?? '').trim() || 'Registro clinico',
      author_user_id: user?.userId ?? 'unknown',
      author_username: user?.username ?? 'unknown',
      at: new Date(),
    });
    (record as any).updatedAt = new Date();
    return record.save();
  }
}
