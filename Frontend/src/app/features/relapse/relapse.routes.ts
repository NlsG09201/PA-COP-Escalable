import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import * as echarts from 'echarts';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import {
  RelapseApiService,
  RelapseAlert,
  RiskFactor
} from '../../core/services/relapse-api.service';

const RISK_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444'
};

const RISK_LABELS: Record<string, string> = {
  LOW: 'Bajo',
  MEDIUM: 'Moderado',
  HIGH: 'Alto',
  CRITICAL: 'Crítico'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid">
      @if (!patientId()) {
        <div class="alert alert-info d-flex align-items-center gap-2">
          <i class="bi bi-info-circle fs-5"></i>
          Selecciona un paciente para evaluar el riesgo de recaída.
        </div>
      } @else {
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-shield-exclamation text-primary"></i> Riesgo de Recaída
          </h4>
          <button class="btn btn-primary d-flex align-items-center gap-1"
                  (click)="assessRisk()" [disabled]="assessing()">
            <span class="spinner-border spinner-border-sm" *ngIf="assessing()"></span>
            <i class="bi bi-arrow-clockwise" *ngIf="!assessing()"></i>
            Evaluar Riesgo
          </button>
        </div>

        @if (loading()) {
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        }

        @if (currentAlert()) {
          <div class="row g-4 mb-4">
            <!-- Risk indicator -->
            <div class="col-lg-4">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body text-center py-4">
                  <div class="risk-circle mx-auto mb-3"
                       [style.--risk-color]="getRiskColor(currentAlert()!.riskLevel)"
                       [style.--risk-pct]="currentAlert()!.riskScore + '%'">
                    <div class="risk-inner">
                      <span class="risk-score">{{ currentAlert()!.riskScore | number:'1.0-0' }}</span>
                      <span class="risk-unit">%</span>
                    </div>
                  </div>
                  <div class="risk-level-badge d-inline-block px-4 py-2 rounded-pill fw-bold"
                       [style.background]="getRiskColor(currentAlert()!.riskLevel) + '20'"
                       [style.color]="getRiskColor(currentAlert()!.riskLevel)">
                    Riesgo {{ getRiskLabel(currentAlert()!.riskLevel) }}
                  </div>
                  <p class="text-muted small mt-3 mb-0">
                    Evaluado: {{ currentAlert()!.createdAt | date:'medium' }}
                  </p>
                  @if (!currentAlert()!.acknowledged) {
                    <button class="btn btn-outline-primary btn-sm mt-3"
                            (click)="acknowledge()" [disabled]="acknowledging()">
                      <span class="spinner-border spinner-border-sm me-1" *ngIf="acknowledging()"></span>
                      <i class="bi bi-check2-square me-1" *ngIf="!acknowledging()"></i>
                      Confirmar Revisión
                    </button>
                  } @else {
                    <div class="mt-3">
                      <span class="badge bg-success-subtle text-success">
                        <i class="bi bi-check-circle me-1"></i>Revisado
                      </span>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Contributing factors -->
            <div class="col-lg-4">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                  <h6 class="mb-3 d-flex align-items-center gap-2">
                    <i class="bi bi-diagram-3 text-warning"></i>
                    Factores Contribuyentes
                  </h6>
                  @for (f of currentAlert()!.factors; track f.factor) {
                    <div class="factor-card p-3 rounded mb-2 bg-light">
                      <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-semibold small">{{ f.factor }}</span>
                        <span class="badge bg-secondary-subtle text-secondary">
                          {{ (f.weight * 100) | number:'1.0-0' }}%
                        </span>
                      </div>
                      <div class="progress mb-2" style="height: 5px;">
                        <div class="progress-bar" [style.width.%]="f.weight * 100"
                             [style.background]="getWeightColor(f.weight)"></div>
                      </div>
                      <p class="text-muted small mb-0">{{ f.description }}</p>
                    </div>
                  }
                  @if (currentAlert()!.factors.length === 0) {
                    <p class="text-muted text-center mb-0">Sin factores identificados</p>
                  }
                </div>
              </div>
            </div>

            <!-- Recommended actions -->
            <div class="col-lg-4">
              <div class="card border-0 shadow-sm h-100">
                <div class="card-body">
                  <h6 class="mb-3 d-flex align-items-center gap-2">
                    <i class="bi bi-list-check text-success"></i>
                    Acciones Recomendadas
                  </h6>
                  @for (action of currentAlert()!.actions; track action; let i = $index) {
                    <div class="form-check mb-3">
                      <input class="form-check-input" type="checkbox" [id]="'action-' + i"
                             [(ngModel)]="actionChecks[i]">
                      <label class="form-check-label" [for]="'action-' + i">
                        {{ action }}
                      </label>
                    </div>
                  }
                  @if (currentAlert()!.actions.length === 0) {
                    <p class="text-muted text-center mb-0">Sin acciones recomendadas</p>
                  }
                  @if (currentAlert()!.actions.length > 0) {
                    <div class="mt-3 pt-2 border-top">
                      <small class="text-muted">
                        {{ checkedCount() }} de {{ currentAlert()!.actions.length }} completadas
                      </small>
                      <div class="progress mt-1" style="height: 4px;">
                        <div class="progress-bar bg-success"
                             [style.width.%]="(checkedCount() / currentAlert()!.actions.length) * 100"></div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Risk trend chart -->
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <h6 class="mb-3 d-flex align-items-center gap-2">
              <i class="bi bi-graph-up text-primary"></i>
              Tendencia del Riesgo
            </h6>
            @if (trend().length > 0) {
              <div #trendChart style="width: 100%; height: 350px;"></div>
            } @else if (!loading()) {
              <div class="text-center py-4 text-muted">
                <i class="bi bi-graph-up fs-1 d-block mb-2 opacity-25"></i>
                Sin datos históricos. Evalúa el riesgo para comenzar a generar tendencias.
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .risk-circle {
      width: 180px; height: 180px; border-radius: 50%; position: relative;
      background: conic-gradient(
        var(--risk-color) var(--risk-pct),
        #e9ecef var(--risk-pct)
      );
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .risk-inner {
      position: absolute; inset: 14px; border-radius: 50%;
      background: white; display: flex; align-items: center;
      justify-content: center; flex-direction: row;
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.04);
    }
    .risk-score { font-size: 2.8rem; font-weight: 700; line-height: 1; color: var(--risk-color); }
    .risk-unit { font-size: 1.2rem; font-weight: 600; color: var(--risk-color); margin-top: 8px; }
    .factor-card { transition: background 0.2s; }
    .factor-card:hover { background: #e9ecef !important; }
    .progress { border-radius: 10px; }
    .progress-bar { border-radius: 10px; }
  `]
})
class RelapsePageComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly api = inject(RelapseApiService);

  @ViewChild('trendChart') private trendChartRef?: ElementRef<HTMLDivElement>;
  private chart?: echarts.ECharts;

  readonly patientId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly assessing = signal(false);
  readonly acknowledging = signal(false);
  readonly currentAlert = signal<RelapseAlert | null>(null);
  readonly trend = signal<RelapseAlert[]>([]);

  actionChecks: boolean[] = [];

  readonly checkedCount = computed(() => this.actionChecks.filter(Boolean).length);

  ngOnInit() {
    this.store.select(selectSelectedPatientId).subscribe(id => {
      this.patientId.set(id ?? null);
      if (id) this.loadData(id);
    });
  }

  ngOnDestroy() {
    this.chart?.dispose();
  }

  private loadData(patientId: string) {
    this.loading.set(true);
    this.api.getLatestRisk$(patientId).subscribe({
      next: alert => {
        this.currentAlert.set(alert);
        this.actionChecks = new Array(alert.actions.length).fill(false);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
    this.api.getRiskTrend$(patientId).subscribe({
      next: t => {
        this.trend.set(t);
        setTimeout(() => this.renderTrendChart(), 100);
      }
    });
  }

  assessRisk() {
    const pid = this.patientId();
    if (!pid) return;
    this.assessing.set(true);
    this.api.assessRisk$(pid).subscribe({
      next: alert => {
        this.currentAlert.set(alert);
        this.actionChecks = new Array(alert.actions.length).fill(false);
        this.assessing.set(false);
        this.loadTrend(pid);
      },
      error: () => this.assessing.set(false)
    });
  }

  acknowledge() {
    const alert = this.currentAlert();
    if (!alert) return;
    this.acknowledging.set(true);
    this.api.acknowledgeAlert$(alert.id).subscribe({
      next: updated => {
        this.currentAlert.set(updated);
        this.acknowledging.set(false);
      },
      error: () => this.acknowledging.set(false)
    });
  }

  getRiskColor(level: string): string {
    return RISK_COLORS[level] ?? '#6b7280';
  }

  getRiskLabel(level: string): string {
    return RISK_LABELS[level] ?? level;
  }

  getWeightColor(weight: number): string {
    if (weight >= 0.7) return '#ef4444';
    if (weight >= 0.4) return '#f59e0b';
    return '#10b981';
  }

  private loadTrend(patientId: string) {
    this.api.getRiskTrend$(patientId).subscribe({
      next: t => {
        this.trend.set(t);
        setTimeout(() => this.renderTrendChart(), 100);
      }
    });
  }

  private renderTrendChart() {
    const data = this.trend();
    if (!this.trendChartRef || data.length === 0) return;

    if (!this.chart) {
      this.chart = echarts.init(this.trendChartRef.nativeElement);
      window.addEventListener('resize', () => this.chart?.resize());
    }

    const sorted = [...data].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    this.chart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          const alert = sorted[p.dataIndex];
          return `<b>${p.axisValue}</b><br/>
            Riesgo: ${alert.riskScore}%<br/>
            Nivel: ${this.getRiskLabel(alert.riskLevel)}`;
        }
      },
      xAxis: {
        type: 'category',
        data: sorted.map(a => new Date(a.createdAt).toLocaleDateString()),
        boundaryGap: false
      },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      series: [{
        type: 'line', smooth: true,
        data: sorted.map(a => a.riskScore),
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
            { offset: 1, color: 'rgba(239, 68, 68, 0.02)' }
          ])
        },
        lineStyle: { width: 3, color: '#ef4444' },
        itemStyle: {
          color: (params: any) => {
            const level = sorted[params.dataIndex]?.riskLevel;
            return RISK_COLORS[level] ?? '#ef4444';
          }
        },
        markLine: {
          silent: true,
          data: [
            { yAxis: 25, label: { formatter: 'Bajo', position: 'end' }, lineStyle: { color: '#10b981', type: 'dashed' } },
            { yAxis: 50, label: { formatter: 'Medio', position: 'end' }, lineStyle: { color: '#f59e0b', type: 'dashed' } },
            { yAxis: 75, label: { formatter: 'Alto', position: 'end' }, lineStyle: { color: '#f97316', type: 'dashed' } }
          ]
        }
      }],
      grid: { left: 50, right: 20, top: 15, bottom: 30 }
    });
  }
}

export const RELAPSE_ROUTES: Routes = [{ path: '', component: RelapsePageComponent }];
