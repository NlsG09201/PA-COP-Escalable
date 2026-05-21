import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Appointment, AppointmentStatus } from '../appointments/schemas/appointment.schema';
import { Patient } from '../patients/patient.schema';
import { Professional } from '../tenancy/schemas/professional.schema';
import { TenantContext } from '../tenancy/tenancy.interceptor';
import { buildTenantDocumentMatch, idVariants } from '../tenancy/tenant-query.util';

export type GroupBy = 'DAY' | 'WEEK' | 'MONTH';

type DateRange = { from: string; to: string };

@Injectable()
export class AnalyticsDashboardService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
    @InjectModel(Patient.name) private readonly patientModel: Model<Patient>,
    @InjectModel(Professional.name) private readonly professionalModel: Model<Professional>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async kpis(range: DateRange, tenant: TenantContext) {
    const { from, to } = this.parseRange(range);
    const baseMatch = this.tenantMatch(tenant);

    const [totalAppointments, cancelledAppointments, totalPatientsActive, totalRevenueCents] = await Promise.all([
      this.appointmentModel.countDocuments({ ...baseMatch, start_at: { $gte: from, $lte: to } }),
      this.appointmentModel.countDocuments({
        ...baseMatch,
        start_at: { $gte: from, $lte: to },
        status: AppointmentStatus.CANCELLED,
      }),
      this.connection.collection('patients').countDocuments({
        ...this.patientsTenantMatch(tenant),
        status: 'ACTIVE',
      }),
      this.sumPublicPaymentsAmount({ from, to }, tenant),
    ]);

    const cancellationRatePct = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0;

    return {
      totalAppointments,
      totalPatientsActive,
      totalRevenueCents,
      cancellationRatePct,
    };
  }

  async appointmentsTrend(input: DateRange & { groupBy?: GroupBy }, tenant: TenantContext) {
    const { from, to } = this.parseRange(input);
    const groupBy = this.normalizeGroupBy(input.groupBy);
    const baseMatch = this.tenantMatch(tenant);

    const unit = groupBy === 'DAY' ? 'day' : groupBy === 'WEEK' ? 'week' : 'month';

    const series = await this.appointmentModel
      .aggregate([
        { $match: { ...baseMatch, start_at: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateTrunc: { date: '$start_at', unit, timezone: 'UTC' } },
            total: { $sum: 1 },
          },
        },
        { $project: { _id: 0, bucket: { $dateToString: { date: '$_id', format: '%Y-%m-%d', timezone: 'UTC' } }, total: 1 } },
        { $sort: { bucket: 1 } },
      ])
      .exec();

    return { series };
  }

  async revenueTrend(input: DateRange & { groupBy?: GroupBy }, tenant: TenantContext) {
    const { from, to } = this.parseRange(input);
    const groupBy = this.normalizeGroupBy(input.groupBy);

    const unit = groupBy === 'DAY' ? 'day' : groupBy === 'WEEK' ? 'week' : 'month';

    const match = {
      ...this.tenantMatch(tenant),
      status: 'PAID',
      paid_at: { $gte: from, $lte: to },
    };

    const series = await this.connection
      .collection('public_payments')
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateTrunc: { date: '$paid_at', unit, timezone: 'UTC' } },
            total: { $sum: '$amount' },
          },
        },
        { $project: { _id: 0, bucket: { $dateToString: { date: '$_id', format: '%Y-%m-%d', timezone: 'UTC' } }, total: 1 } },
        { $sort: { bucket: 1 } },
      ])
      .toArray();

    return { series };
  }

  async specialtiesDistribution(range: DateRange, tenant: TenantContext) {
    const { from, to } = this.parseRange(range);
    const baseMatch = this.tenantMatch(tenant);

    const specialties = await this.appointmentModel
      .aggregate([
        {
          $match: {
            ...baseMatch,
            start_at: { $gte: from, $lte: to },
            status: { $in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] },
          },
        },
        { $group: { _id: { $ifNull: ['$service_category_snapshot', 'General'] }, appointmentsConfirmed: { $sum: 1 } } },
        { $project: { _id: 0, specialty: '$_id', appointmentsConfirmed: 1 } },
        { $sort: { appointmentsConfirmed: -1, specialty: 1 } },
      ])
      .exec();

    return { specialties };
  }

  async doctorsPerformance(input: DateRange & { limit: number }, tenant: TenantContext) {
    const { from, to } = this.parseRange(input);
    const limit = Number.isFinite(input.limit) && input.limit > 0 ? Math.min(50, Math.floor(input.limit)) : 10;
    const baseMatch = this.tenantMatch(tenant);

    const docsAgg = await this.appointmentModel
      .aggregate([
        {
          $match: {
            ...baseMatch,
            start_at: { $gte: from, $lte: to },
            status: { $in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] },
          },
        },
        { $group: { _id: '$professional_id', appointmentsConfirmed: { $sum: 1 } } },
        { $sort: { appointmentsConfirmed: -1 } },
        { $limit: limit },
      ])
      .exec();

    const professionalIds = docsAgg.map((d) => String(d._id));
    const idList = professionalIds.flatMap((id) => idVariants(id));
    const professionals = await this.professionalModel
      .find({ _id: { $in: idList } }, { full_name: 1 })
      .lean()
      .exec();

    const byId = new Map(professionals.map((p: any) => [String(p._id), p]));

    const doctors = docsAgg.map((d) => {
      const p: any = byId.get(String(d._id));
      return {
        professionalId: String(d._id),
        fullName: p?.full_name ?? String(d._id),
        appointmentsConfirmed: d.appointmentsConfirmed ?? 0,
      };
    });

    return { doctors };
  }

  async appointmentsHeatmap(range: DateRange, tenant: TenantContext) {
    const { from, to } = this.parseRange(range);
    const baseMatch = this.tenantMatch(tenant);

    const cells = await this.appointmentModel
      .aggregate([
        {
          $match: {
            ...baseMatch,
            start_at: { $gte: from, $lte: to },
            status: { $in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] },
          },
        },
        {
          $group: {
            _id: {
              dayOfWeek: { $subtract: [{ $dayOfWeek: '$start_at' }, 1] }, // 0=Sun ... 6=Sat
              hourOfDay: { $hour: '$start_at' },
            },
            total: { $sum: 1 },
          },
        },
        { $project: { _id: 0, dayOfWeek: '$_id.dayOfWeek', hourOfDay: '$_id.hourOfDay', total: 1 } },
        { $sort: { dayOfWeek: 1, hourOfDay: 1 } },
      ])
      .exec();

    return { cells };
  }

  /** Citas, pagos y agregados clínicos: filtro de sede estricto. */
  private tenantMatch(tenant: TenantContext) {
    return buildTenantDocumentMatch(tenant);
  }

  /** Conteo de pacientes activos (bulk puede tener site_id null). */
  private patientsTenantMatch(tenant: TenantContext) {
    return buildTenantDocumentMatch(tenant, { patientsCollection: true });
  }

  private parseRange(range: DateRange): { from: Date; to: Date } {
    if (!range?.from || !range?.to) throw new BadRequestException('from/to query params are required');
    const from = new Date(range.from);
    const to = new Date(range.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new BadRequestException('from/to must be valid ISO dates');
    return { from, to };
  }

  private normalizeGroupBy(groupBy?: GroupBy): GroupBy {
    const v = String(groupBy ?? 'DAY').toUpperCase();
    if (v === 'DAY' || v === 'WEEK' || v === 'MONTH') return v as GroupBy;
    return 'DAY';
  }

  private async sumPublicPaymentsAmount(range: { from: Date; to: Date }, tenant: TenantContext): Promise<number> {
    const match: any = {
      ...this.tenantMatch(tenant),
      status: 'PAID',
      paid_at: { $gte: range.from, $lte: range.to },
    };

    const res = await this.connection
      .collection('public_payments')
      .aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }])
      .toArray();

    return Number(res?.[0]?.total ?? 0);
  }
}

