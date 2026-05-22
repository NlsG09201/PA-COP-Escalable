import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { COLOMBIA_SITES_CATALOG } from '../tenancy/colombia-sites.catalog';
import { COP_SERVICE_CATALOG } from './cop-service-catalog';
import { UUID } from 'bson';

const TARGET = 15_000;
const TARGET_35K_PER_AREA = 17_500;
const BATCH = 500;
const MARKER = 'mcp-bulk-15k';
const MARKER_35K = 'mcp-bulk-35k';

type ArffRow = {
  features: Record<string, string | number>;
  classLabel: string;
};

type PatientRow = {
  id_paciente: string;
  departamento: string;
  edad: number;
  genero: string;
  motivo_ingreso: string;
  regimen: string;
};

@Injectable()
export class AtlasBulkSeedService {
  private readonly logger = new Logger(AtlasBulkSeedService.name);

  constructor(@InjectConnection() private readonly mongo: Connection) {}

  async seedBulk15k(opts?: { forzar?: boolean }): Promise<Record<string, unknown>> {
    const orgId = (process.env.APP_BOOTSTRAP_ADMIN_ORG_ID ?? 'be7f4015-67ad-472b-9cf7-aadcd8b0d604').trim();
    if (!orgId) throw new Error('APP_BOOTSTRAP_ADMIN_ORG_ID no configurado');

    const siteByDept = await this.loadSiteByDept(orgId);
    const patientRows = this.resolvePatientRows(TARGET);
    const arffRows = this.resolveArffRows(TARGET);

    const patientsCol = this.mongo.db.collection('patients');
    const j48Col = this.mongo.db.collection('j48_predictions');

    if (opts?.forzar) {
      const d1 = await patientsCol.deleteMany({ ingest_source: MARKER });
      const d2 = await j48Col.deleteMany({ ingest_source: MARKER });
      this.logger.warn(`Limpiados marker ${MARKER}: patients=${d1.deletedCount}, j48=${d2.deletedCount}`);
    }

    const existing = await patientsCol.countDocuments({ ingest_source: MARKER });
    if (existing >= TARGET && !opts?.forzar) {
      const j48Count = await j48Col.countDocuments({ ingest_source: MARKER });
      return {
        ok: true,
        skipped: true,
        patients: existing,
        j48_predictions: j48Count,
        message: `Ya existen ${existing} pacientes con ${MARKER}. Usa forzar=true para reemplazar.`,
      };
    }

    const built: Array<{ patient: Record<string, unknown>; j48: Record<string, unknown> }> = [];
    for (let i = 0; i < TARGET; i++) {
      const row = patientRows[i];
      const patientId = randomUUID();
      const site = this.resolveSite(row.departamento, siteByDept);
      const now = new Date();
      const patient = {
        _id: patientId,
        organization_id: orgId,
        site_id: site?._id ?? null,
        external_code: String(row.id_paciente),
        full_name: `Paciente ${row.id_paciente}`,
        birth_date: this.birthDateFromAge(row.edad),
        gender: this.genderFromRaw(row.genero),
        phone: `+573${String(Math.abs(this.hashCode(row.id_paciente)) % 1_000_000_000).padStart(9, '0')}`,
        email: `paciente.${String(row.id_paciente).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@cop-pacientes.local`,
        status: 'ACTIVE',
        ingest_source: MARKER,
        ingest_motivo: row.motivo_ingreso || null,
        ingest_regimen: row.regimen || null,
        created_at: now,
        updated_at: now,
      };
      const arff = arffRows[i];
      const j48 = this.buildJ48Doc(orgId, site?._id ?? null, patientId, arff, i + 1, now);
      built.push({ patient, j48 });
    }

    let patientsInserted = 0;
    let j48Inserted = 0;

    for (let i = 0; i < built.length; i += BATCH) {
      const chunk = built.slice(i, i + BATCH);
      const pRes = await patientsCol.insertMany(
        chunk.map((c) => c.patient),
        { ordered: false },
      );
      patientsInserted += pRes.insertedCount;
      const jRes = await j48Col.insertMany(
        chunk.map((c) => c.j48),
        { ordered: false },
      );
      j48Inserted += jRes.insertedCount;
      this.logger.log(`Lote ${Math.floor(i / BATCH) + 1}: +${pRes.insertedCount} patients, +${jRes.insertedCount} j48`);
    }

    const totalPatients = await patientsCol.countDocuments({ organization_id: orgId });
    const totalJ48 = await j48Col.countDocuments({ organizationId: orgId });

    return {
      ok: true,
      marker: MARKER,
      patientsInserted,
      j48Inserted,
      patientsTotalOrg: totalPatients,
      j48TotalOrg: totalJ48,
      message: `Insertados ${patientsInserted} pacientes y ${j48Inserted} predicciones J48.`,
    };
  }

  private async loadSiteByDept(orgId: string) {
    const col = this.mongo.db.collection('sites');
    const sites = await col.find({ organization_id: orgId, status: 'ACTIVE' }).toArray();
    const siteByDept = new Map<string, Array<{ _id: string; department: string }>>();
    for (const s of sites) {
      const key = this.normDept(String(s.department ?? ''));
      if (!siteByDept.has(key)) siteByDept.set(key, []);
      siteByDept.get(key)!.push({ _id: String(s._id), department: String(s.department) });
    }
    if (siteByDept.size > 0) return siteByDept;

    for (const row of COLOMBIA_SITES_CATALOG) {
      const key = this.normDept(row.department);
      if (!siteByDept.has(key)) siteByDept.set(key, []);
      siteByDept.get(key)!.push({ _id: randomUUID(), department: row.department });
    }
    return siteByDept;
  }

  private resolvePatientRows(count: number): PatientRow[] {
    const csvCandidates = [
      join(process.cwd(), 'pacientes_colombia_15k.csv'),
      join(process.cwd(), '..', 'pacientes_colombia_15k.csv'),
    ];
    for (const p of csvCandidates) {
      if (existsSync(p)) {
        const rows = this.parseCsv(p);
        if (rows.length >= count) return rows.slice(0, count);
      }
    }
    return this.generatePatientRows(count);
  }

  private resolveArffRows(count: number): ArffRow[] {
    const arffCandidates = [
      join(process.cwd(), 'datasets', 'relapse_risk_j48.arff'),
      join(process.cwd(), '..', 'datasets', 'relapse_risk_j48.arff'),
    ];
    for (const p of arffCandidates) {
      if (existsSync(p)) {
        const rows = this.parseArff(readFileSync(p, 'utf8'));
        if (rows.length >= count) return rows.slice(0, count);
      }
    }
    return this.generateArffRows(count);
  }

  private parseCsv(path: string): PatientRow[] {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    const rows: PatientRow[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('...') || line.startsWith('#')) continue;
      if (i === 0 && line.toLowerCase().includes('id_paciente')) continue;
      const parts = line.split(',');
      if (parts.length < 6) continue;
      rows.push({
        id_paciente: parts[0],
        departamento: parts[2],
        edad: parseInt(parts[4], 10) || 30,
        genero: parts[5],
        motivo_ingreso: parts[6] ?? '',
        regimen: parts[7] ?? '',
      });
    }
    return rows;
  }

  private generatePatientRows(count: number): PatientRow[] {
    const departments = [...new Set(COLOMBIA_SITES_CATALOG.map((s) => s.department))];
    const motivos = ['Enfermedad', 'Accidente', 'Consulta', 'Cirugía', 'Chequeo', 'Emergencia'];
    const rows: PatientRow[] = [];
    for (let n = 1; n <= count; n++) {
      rows.push({
        id_paciente: `P-${String(100000 + n)}`,
        departamento: departments[n % departments.length],
        edad: 1 + (n % 85),
        genero: n % 2 === 0 ? 'F' : 'M',
        motivo_ingreso: motivos[n % motivos.length],
        regimen: n % 3 === 0 ? 'Subsidiado' : 'Contributivo',
      });
    }
    return rows;
  }

  private parseArff(raw: string): ArffRow[] {
    const rows: ArffRow[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('@')) continue;
      const parts = t.split(',').map((p) => p.trim());
      if (parts.length < 9) continue;
      const [gender, age_group, sentiment, wellbeing, anxiety, depression, attendance, days_since_last, classLabel] =
        parts;
      rows.push({
        features: {
          gender,
          age_group,
          sentiment,
          wellbeing,
          anxiety: Number(anxiety),
          depression: Number(depression),
          attendance,
          days_since_last: Number(days_since_last),
        },
        classLabel,
      });
    }
    return rows;
  }

  private generateArffRows(count: number): ArffRow[] {
    const genders = ['M', 'F', 'O'];
    const ageGroups = ['YOUNG_ADULT', 'ADULT', 'SENIOR'];
    const sentiments = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
    const wellbeing = ['HIGH', 'MEDIUM', 'LOW'];
    const attendance = ['REGULAR', 'IRREGULAR'];
    const labels = ['LOW', 'MEDIUM', 'HIGH'];
    const rows: ArffRow[] = [];
    for (let i = 0; i < count; i++) {
      rows.push({
        features: {
          gender: genders[i % 3],
          age_group: ageGroups[i % 3],
          sentiment: sentiments[i % 3],
          wellbeing: wellbeing[i % 3],
          anxiety: Math.round((i % 100) / 100 * 1000) / 1000,
          depression: Math.round(((i * 7) % 100) / 100 * 1000) / 1000,
          attendance: attendance[i % 2],
          days_since_last: (i % 30) + 1,
        },
        classLabel: labels[i % 3],
      });
    }
    return rows;
  }

  private buildJ48Doc(
    orgId: string,
    siteId: string | null,
    patientId: string,
    arff: ArffRow,
    index: number,
    now: Date,
  ) {
    const label = arff.classLabel;
    const p: Record<string, number> = { LOW: 0.05, MEDIUM: 0.15, HIGH: 0.05 };
    p[label] = 0.8;
    const sum = Object.values(p).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(p)) p[k] = Math.round((p[k] / sum) * 1000) / 1000;

    return {
      organizationId: orgId,
      siteId,
      patientId,
      scoredAt: now,
      features: arff.features,
      classLabel: label,
      probabilities: p,
      ingest_source: MARKER,
      ingest_index: index,
      created_at: now,
      updated_at: now,
    };
  }

  private normDept(s: string) {
    return s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  private resolveSite(dept: string, siteByDept: Map<string, Array<{ _id: string; department: string }>>) {
    const key = this.normDept(dept);
    const aliases: Record<string, string> = {
      bogota: 'Bogotá D.C.',
      valle: 'Valle del Cauca',
    };
    const canonical = aliases[key] || dept?.trim();
    const sites = siteByDept.get(this.normDept(canonical));
    if (sites?.length) return sites[Math.floor(Math.random() * sites.length)];
    const all = [...siteByDept.values()].flat();
    return all[Math.floor(Math.random() * all.length)];
  }

  private birthDateFromAge(edad: number) {
    const age = Math.min(100, Math.max(0, edad));
    const y = new Date().getFullYear() - age;
    return new Date(`${y}-06-15T12:00:00.000Z`);
  }

  private genderFromRaw(g: string) {
    const s = String(g ?? '').trim().toUpperCase();
    if (s.startsWith('F')) return 'F';
    if (s.startsWith('M')) return 'M';
    return 'O';
  }

  private hashCode(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
    return h;
  }

  async seedBulk35kAndCatalog(opts?: {
    forzar?: boolean;
    soloCatalogo?: boolean;
    soloPacientes?: boolean;
  }): Promise<Record<string, unknown>> {
    const orgId = (process.env.APP_BOOTSTRAP_ADMIN_ORG_ID ?? 'be7f4015-67ad-472b-9cf7-aadcd8b0d604').trim();
    if (!orgId) throw new Error('APP_BOOTSTRAP_ADMIN_ORG_ID no configurado');

    const patientsCol = this.mongo.db.collection('patients');
    let patientResult: Record<string, unknown> = { skipped: true };

    if (!opts?.soloCatalogo) {
      if (opts?.forzar) {
        await patientsCol.deleteMany({ ingest_source: MARKER_35K });
      }
      const existing = await patientsCol.countDocuments({ ingest_source: MARKER_35K });
      if (existing >= TARGET_35K_PER_AREA * 2 && !opts?.forzar) {
        patientResult = { skipped: true, total: existing };
      } else {
        const siteByDept = await this.loadSiteByDept(orgId);
        const docs: Record<string, unknown>[] = [];
        for (let i = 1; i <= TARGET_35K_PER_AREA; i++) {
          docs.push(this.buildAreaPatient('ODONTOLOGIA', i, orgId, siteByDept));
        }
        for (let i = 1; i <= TARGET_35K_PER_AREA; i++) {
          docs.push(this.buildAreaPatient('PSICOLOGIA', i, orgId, siteByDept));
        }
        let inserted = 0;
        for (let i = 0; i < docs.length; i += BATCH) {
          const chunk = docs.slice(i, i + BATCH);
          const res = await patientsCol.insertMany(chunk, { ordered: false });
          inserted += res.insertedCount;
        }
        const odonto = await patientsCol.countDocuments({
          ingest_source: MARKER_35K,
          clinical_area: 'ODONTOLOGIA',
        });
        const psico = await patientsCol.countDocuments({
          ingest_source: MARKER_35K,
          clinical_area: 'PSICOLOGIA',
        });
        patientResult = { inserted, odonto, psico, total: odonto + psico };
      }
    }

    let catalogResult: Record<string, unknown> = { skipped: true };
    if (!opts?.soloPacientes) {
      catalogResult = await this.seedCatalogServices(orgId, !!opts?.forzar);
    }

    return {
      ok: true,
      marker: MARKER_35K,
      patients: patientResult,
      catalog: catalogResult,
    };
  }

  private buildAreaPatient(
    area: 'ODONTOLOGIA' | 'PSICOLOGIA',
    index: number,
    orgId: string,
    siteByDept: Map<string, Array<{ _id: string; department: string }>>,
  ) {
    const prefix = area === 'ODONTOLOGIA' ? 'ODO' : 'PSI';
    const code = `P-${prefix}-${String(200000 + index)}`;
    const departments = [...new Set(COLOMBIA_SITES_CATALOG.map((s) => s.department))];
    const dept = departments[index % departments.length];
    const site = this.resolveSite(dept, siteByDept);
    const now = new Date();
    const edad = 1 + (index % 85);
    const motivos =
      area === 'ODONTOLOGIA'
        ? ['Consulta', 'Cirugía', 'Chequeo', 'Emergencia', 'Ortodoncia']
        : ['Consulta', 'Terapia', 'Evaluación', 'Crisis', 'Seguimiento'];

    return {
      _id: randomUUID(),
      organization_id: orgId,
      site_id: site?._id ?? null,
      external_code: code,
      full_name: `Paciente ${code}`,
      birth_date: this.birthDateFromAge(edad),
      gender: this.genderFromRaw(index % 2 === 0 ? 'F' : 'M'),
      phone: `+573${String(Math.abs(this.hashCode(code)) % 1_000_000_000).padStart(9, '0')}`,
      email: `paciente.${code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@cop-pacientes.local`,
      status: 'ACTIVE',
      clinical_area: area,
      ingest_source: MARKER_35K,
      ingest_clinical_area: area,
      ingest_motivo: motivos[index % motivos.length],
      ingest_regimen: index % 3 === 0 ? 'Subsidiado' : 'Contributivo',
      created_at: now,
      updated_at: now,
    };
  }

  private async seedCatalogServices(orgId: string, forzar: boolean) {
    const orgUuid = new UUID(orgId);
    const catCol = this.mongo.db.collection('service_categories');
    const catalogCol = this.mongo.db.collection('catalog_services');
    const offeringCol = this.mongo.db.collection('service_offerings');

    if (forzar) {
      await offeringCol.deleteMany({ ingest_source: MARKER_35K });
      await catalogCol.deleteMany({ ingest_source: MARKER_35K });
      await catCol.deleteMany({ ingest_source: MARKER_35K });
    } else {
      const n = await catalogCol.countDocuments({ organization_id: orgUuid, ingest_source: MARKER_35K });
      if (n >= COP_SERVICE_CATALOG.length) {
        return { skipped: true, catalogCount: n };
      }
    }

    const now = new Date();
    const categories = {
      ODONTOLOGIA: {
        _id: new UUID(randomUUID()),
        organization_id: orgUuid,
        slug: 'odontologia',
        name: 'Odontología',
        active: true,
        ingest_source: MARKER_35K,
        created_at: now,
        updated_at: now,
      },
      PSICOLOGIA: {
        _id: new UUID(randomUUID()),
        organization_id: orgUuid,
        slug: 'psicologia',
        name: 'Psicología',
        active: true,
        ingest_source: MARKER_35K,
        created_at: now,
        updated_at: now,
      },
    };

    await catCol.insertMany([categories.ODONTOLOGIA, categories.PSICOLOGIA] as any);

    const siteCol = this.mongo.db.collection('sites');
    const siteDocs = await siteCol
      .find({
        status: 'ACTIVE',
        $or: [{ organization_id: orgId }, { organization_id: orgUuid }],
      })
      .toArray();

    if (!siteDocs.length) throw new Error('No hay sedes activas para service_offerings');

    const catalogDocs: Record<string, unknown>[] = [];
    const offeringDocs: Record<string, unknown>[] = [];

    for (const svc of COP_SERVICE_CATALOG) {
      const catalogId = new UUID(randomUUID());
      catalogDocs.push({
        _id: catalogId,
        organization_id: orgUuid,
        category_id: categories[svc.category]._id,
        code: svc.code,
        name: svc.name,
        description: svc.description,
        default_duration_minutes: svc.durationMinutes,
        specialty_match_tokens: svc.category === 'PSICOLOGIA' ? 'psicologia' : 'odontologia',
        active: true,
        ingest_source: MARKER_35K,
        created_at: now,
        updated_at: now,
      });

      for (const site of siteDocs) {
        let siteId: UUID | string;
        if (site._id instanceof UUID) {
          siteId = site._id;
        } else {
          const sid = String(site._id ?? '').trim();
          try {
            siteId = new UUID(sid);
          } catch {
            siteId = sid;
          }
        }
        offeringDocs.push({
          _id: new UUID(randomUUID()),
          catalog_service_id: catalogId,
          public_title: svc.name,
          public_description: svc.description,
          base_price: svc.basePrice,
          promo_price: svc.promoPrice,
          currency: 'COP',
          visible_public: true,
          active: true,
          organization_id: orgUuid,
          site_id: siteId,
          features: svc.features,
          duration_minutes: svc.durationMinutes,
          ingest_source: MARKER_35K,
          created_at: now,
          updated_at: now,
        });
      }
    }

    await catalogCol.insertMany(catalogDocs as any);
    let offeringsInserted = 0;
    for (let i = 0; i < offeringDocs.length; i += BATCH) {
      const chunk = offeringDocs.slice(i, i + BATCH);
      const res = await offeringCol.insertMany(chunk as any, { ordered: false });
      offeringsInserted += res.insertedCount;
    }

    return {
      categories: 2,
      catalogServices: catalogDocs.length,
      offerings: offeringsInserted,
      sites: siteDocs.length,
    };
  }
}
