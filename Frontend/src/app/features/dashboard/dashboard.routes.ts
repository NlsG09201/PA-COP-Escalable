import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import * as echarts from 'echarts';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
      <h4 class="mb-0">Dashboard Analitico</h4>
      <div class="d-flex gap-2">
        <input class="form-control form-control-sm" type="date" [(ngModel)]="fromDate" />
        <input class="form-control form-control-sm" type="date" [(ngModel)]="toDate" />
        <select class="form-select form-select-sm" [(ngModel)]="groupBy">
          <option value="DAY">Dia</option>
          <option value="WEEK">Semana</option>
          <option value="MONTH">Mes</option>
          <option value="YEAR">Anio</option>
        </select>
        <button class="btn btn-primary btn-sm" (click)="reload()" [disabled]="loading">Aplicar</button>
      </div>
    </div>

    @if (loadError) {
      <div class="alert alert-danger py-2 mb-3">{{ loadError }}</div>
    }

    <div class="row g-3 mb-2">
      <div class="col-md-3" *ngFor="let card of cards()">
        <div class="card shadow-sm border-0">
          <div class="card-body">
            <div class="text-muted small">{{ card.label }}</div>
            <div class="h5 mb-0">{{ card.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-6"><div class="card shadow-sm border-0"><div class="card-body"><h6 class="mb-3">Evolucion de citas</h6><div #appointmentsChart class="chart-box"></div></div></div></div>
      <div class="col-lg-6"><div class="card shadow-sm border-0"><div class="card-body"><h6 class="mb-3">Ingresos por periodo</h6><div #revenueChart class="chart-box"></div></div></div></div>
      <div class="col-lg-6"><div class="card shadow-sm border-0"><div class="card-body"><h6 class="mb-3">Distribucion por especialidad</h6><div #specialtyChart class="chart-box"></div></div></div></div>
      <div class="col-lg-6"><div class="card shadow-sm border-0"><div class="card-body"><h6 class="mb-3">Rendimiento de medicos</h6><div #doctorChart class="chart-box"></div></div></div></div>
      <div class="col-12"><div class="card shadow-sm border-0"><div class="card-body"><h6 class="mb-3">Heatmap de citas (dia/hora)</h6><div #heatmapChart class="chart-box chart-heatmap"></div></div></div></div>
      <div class="col-12 mt-1"><p class="small text-muted mb-2">Modelo J48 (riesgo / agrupación): agregados en servidor — adecuado para volúmenes de miles de predicciones sin transferir fila a fila.</p></div>
      <div class="col-lg-6"><div class="card shadow-sm border-0"><div class="card-body"><h6 class="mb-3">J48 — distribución de clases</h6><div #j48ClassChart class="chart-box"></div></div></div></div>
      <div class="col-lg-6"><div class="card shadow-sm border-0"><div class="card-body"><h6 class="mb-3">J48 — predicciones por mes (rango aplicado)</h6><div #j48MonthlyChart class="chart-box"></div></div></div></div>
    </div>
  `,
  styles: [`
    .chart-box { width: 100%; height: 300px; }
    .chart-heatmap { height: 360px; }
  `]
})
class DashboardPageComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  @ViewChild('appointmentsChart') private appointmentsChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('revenueChart') private revenueChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('specialtyChart') private specialtyChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('doctorChart') private doctorChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('heatmapChart') private heatmapChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('j48ClassChart') private j48ClassChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('j48MonthlyChart') private j48MonthlyChartRef?: ElementRef<HTMLDivElement>;

  private chartAppointments?: echarts.ECharts;
  private chartRevenue?: echarts.ECharts;
  private chartSpecialty?: echarts.ECharts;
  private chartDoctor?: echarts.ECharts;
  private chartHeatmap?: echarts.ECharts;
  private chartJ48Class?: echarts.ECharts;
  private chartJ48Monthly?: echarts.ECharts;

  protected fromDate = this.asDateInput(new Date(Date.now() - 29 * 86400000));
  protected toDate = this.asDateInput(new Date());
  protected groupBy: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' = 'DAY';
  protected kpis: any = null;
  protected loading = false;
  protected loadError = '';
  protected appointmentsTrend: Array<{ bucket: string; total: number }> = [];
  protected revenueTrend: Array<{ bucket: string; total: number }> = [];
  protected specialties: any[] = [];
  protected doctors: any[] = [];
  private heatmapCells: Array<{ dayOfWeek: number; hourOfDay: number; total: number }> = [];
  private j48Classes: Array<{ label: string; count: number }> = [];
  private j48Monthly: Array<{ bucket: string; total: number }> = [];

  protected readonly cards = computed(() => {
    if (!this.kpis) return [];
    return [
      { label: 'Total citas', value: this.kpis.totalAppointments },
      { label: 'Pacientes activos', value: this.kpis.totalPatientsActive },
      { label: 'Ingresos', value: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(this.kpis.totalRevenueCents ?? 0) },
      { label: 'Cancelacion', value: `${(this.kpis.cancellationRatePct ?? 0).toFixed(1)}%` },
    ];
  });

  ngAfterViewInit(): void {
    this.initCharts();
    void this.reload();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    [
      this.chartAppointments,
      this.chartRevenue,
      this.chartSpecialty,
      this.chartDoctor,
      this.chartHeatmap,
      this.chartJ48Class,
      this.chartJ48Monthly,
    ].forEach((c) => c?.dispose());
  }

  protected async reload(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    const range = this.rangeParams();
    const groupByApi = this.groupBy === 'YEAR' ? 'MONTH' : this.groupBy;
    const withExtra = (extra: Record<string, string>) => {
      let p = range;
      for (const [k, v] of Object.entries(extra)) {
        p = p.set(k, v);
      }
      return p;
    };

    const unwrap = async <T>(label: string, obs: import('rxjs').Observable<T>, fallback: T): Promise<T> => {
      try {
        return await firstValueFrom(obs);
      } catch (err: any) {
        const msg = err?.error?.message ?? err?.message ?? 'Error de red';
        this.loadError = this.loadError ? `${this.loadError}; ${label}: ${msg}` : `${label}: ${msg}`;
        return fallback;
      }
    };

    const [kpis, appt, rev, spec, doc, hm, j48Cls, j48Mo] = await Promise.all([
      unwrap('KPIs', this.http.get<any>(`${API_BASE_URL}/api/analytics/dashboard/kpis`, { params: range }), null),
      unwrap(
        'Citas',
        this.http.get<any>(`${API_BASE_URL}/api/analytics/dashboard/appointments/trend`, {
          params: withExtra({ groupBy: groupByApi }),
        }),
        { series: [] },
      ),
      unwrap(
        'Ingresos',
        this.http.get<any>(`${API_BASE_URL}/api/analytics/dashboard/revenue/trend`, {
          params: withExtra({ groupBy: groupByApi }),
        }),
        { series: [] },
      ),
      unwrap(
        'Especialidades',
        this.http.get<any>(`${API_BASE_URL}/api/analytics/dashboard/specialties/distribution`, { params: range }),
        { specialties: [] },
      ),
      unwrap(
        'Medicos',
        this.http.get<any>(`${API_BASE_URL}/api/analytics/dashboard/doctors/performance`, {
          params: withExtra({ limit: '10' }),
        }),
        { doctors: [] },
      ),
      unwrap(
        'Heatmap',
        this.http.get<any>(`${API_BASE_URL}/api/analytics/dashboard/appointments/heatmap`, { params: range }),
        { cells: [] },
      ),
      unwrap(
        'J48 clases',
        this.http.get<Array<{ label: string; count: number }>>(`${API_BASE_URL}/api/j48/analytics/class-distribution`),
        [] as Array<{ label: string; count: number }>,
      ),
      unwrap(
        'J48 mensual',
        this.http.get<{ series: Array<{ bucket: string; total: number }> }>(
          `${API_BASE_URL}/api/j48/analytics/monthly`,
          { params: range },
        ),
        { series: [] as Array<{ bucket: string; total: number }> },
      ),
    ]);

    this.kpis = kpis;
    this.appointmentsTrend = (appt?.series ?? []).map((x: any) => ({ bucket: x.bucket, total: x.total ?? 0 }));
    this.revenueTrend = (rev?.series ?? []).map((x: any) => ({ bucket: x.bucket, total: x.total ?? 0 }));
    this.specialties = spec?.specialties ?? [];
    this.doctors = doc?.doctors ?? [];
    this.heatmapCells = hm?.cells ?? [];
    this.j48Classes = Array.isArray(j48Cls) ? j48Cls : [];
    this.j48Monthly = j48Mo?.series ?? [];
    this.loading = false;
    this.initCharts();
    this.renderCharts();
  }

  private rangeParams(): HttpParams {
    const from = new Date(`${this.fromDate}T00:00:00.000Z`).toISOString();
    const to = new Date(`${this.toDate}T23:59:59.999Z`).toISOString();
    return new HttpParams().set('from', from).set('to', to);
  }

  private asDateInput(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private initCharts(): void {
    if (this.appointmentsChartRef && !this.chartAppointments) this.chartAppointments = echarts.init(this.appointmentsChartRef.nativeElement);
    if (this.revenueChartRef && !this.chartRevenue) this.chartRevenue = echarts.init(this.revenueChartRef.nativeElement);
    if (this.specialtyChartRef && !this.chartSpecialty) this.chartSpecialty = echarts.init(this.specialtyChartRef.nativeElement);
    if (this.doctorChartRef && !this.chartDoctor) this.chartDoctor = echarts.init(this.doctorChartRef.nativeElement);
    if (this.heatmapChartRef && !this.chartHeatmap) this.chartHeatmap = echarts.init(this.heatmapChartRef.nativeElement);
    if (this.j48ClassChartRef && !this.chartJ48Class) this.chartJ48Class = echarts.init(this.j48ClassChartRef.nativeElement);
    if (this.j48MonthlyChartRef && !this.chartJ48Monthly) this.chartJ48Monthly = echarts.init(this.j48MonthlyChartRef.nativeElement);
  }

  private readonly onResize = () => {
    this.chartAppointments?.resize();
    this.chartRevenue?.resize();
    this.chartSpecialty?.resize();
    this.chartDoctor?.resize();
    this.chartHeatmap?.resize();
    this.chartJ48Class?.resize();
    this.chartJ48Monthly?.resize();
  };

  private renderCharts(): void {
    if (
      !this.chartAppointments ||
      !this.chartRevenue ||
      !this.chartSpecialty ||
      !this.chartDoctor ||
      !this.chartHeatmap ||
      !this.chartJ48Class ||
      !this.chartJ48Monthly
    )
      return;
    this.chartAppointments.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: this.appointmentsTrend.map((x) => x.bucket) },
      yAxis: { type: 'value' },
      series: [{ type: 'line', smooth: true, areaStyle: {}, data: this.appointmentsTrend.map((x) => x.total), color: '#0d6e6a' }],
      grid: { left: 30, right: 15, top: 10, bottom: 30 }
    });
    this.chartRevenue.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: this.revenueTrend.map((x) => x.bucket) },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: this.revenueTrend.map((x) => x.total), itemStyle: { color: '#16a34a' } }],
      grid: { left: 40, right: 15, top: 10, bottom: 30 }
    });
    this.chartSpecialty.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{ type: 'pie', radius: ['45%', '70%'], data: this.specialties.map((s) => ({ name: s.specialty, value: s.appointmentsConfirmed ?? 0 })) }]
    });
    this.chartDoctor.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: this.doctors.map((d) => d.fullName) },
      series: [{ type: 'bar', data: this.doctors.map((d) => d.appointmentsConfirmed ?? 0), itemStyle: { color: '#0891b2' } }],
      grid: { left: 130, right: 15, top: 10, bottom: 20 }
    });
    this.chartHeatmap.setOption({
      tooltip: { position: 'top' },
      xAxis: { type: 'category', data: ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'] },
      yAxis: { type: 'category', data: ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'] },
      visualMap: { min: 0, max: Math.max(1, ...this.heatmapCells.map((x) => x.total)), orient: 'horizontal', left: 'center', bottom: 0 },
      series: [{ type: 'heatmap', data: this.heatmapCells.map((c) => [c.hourOfDay, c.dayOfWeek, c.total]) }],
      grid: { left: 40, right: 15, top: 10, bottom: 40 }
    });
    const j48PieData = this.j48Classes.map((r) => ({ name: String(r.label || '(sin etiqueta)'), value: r.count ?? 0 }));
    this.chartJ48Class.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, type: 'scroll' },
      series: [{ type: 'pie', radius: ['42%', '68%'], data: j48PieData }],
    });
    this.chartJ48Monthly.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: this.j48Monthly.map((x) => x.bucket) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{ type: 'bar', data: this.j48Monthly.map((x) => x.total), itemStyle: { color: '#1e6b9a' } }],
      grid: { left: 40, right: 15, top: 10, bottom: 30 },
    });
  }
}

export const DASHBOARD_ROUTES: Routes = [{ path: '', component: DashboardPageComponent }];
