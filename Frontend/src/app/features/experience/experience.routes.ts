import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal, computed, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import * as echarts from 'echarts';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import {
  ExperienceApiService,
  SatisfactionSurvey,
  ChurnPrediction,
  PatientExperience,
  SiteMetrics
} from '../../core/services/experience-api.service';

const CHURN_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444'
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-emoji-heart-eyes text-primary"></i> Experiencia del Paciente
        </h4>
      </div>

      <!-- Tabs -->
      <ul class="nav nav-tabs mb-4">
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab() === 'patient'"
                  (click)="activeTab.set('patient')">
            <i class="bi bi-person me-1"></i>Paciente
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" [class.active]="activeTab() === 'site'"
                  (click)="activeTab.set('site'); loadSiteMetrics()">
            <i class="bi bi-graph-up me-1"></i>Métricas del Sitio
          </button>
        </li>
      </ul>

      <!-- Patient tab -->
      @if (activeTab() === 'patient') {
        @if (!patientId()) {
          <div class="alert alert-info d-flex align-items-center gap-2">
            <i class="bi bi-info-circle fs-5"></i>
            Selecciona un paciente para ver su experiencia.
          </div>
        } @else {
          <!-- NPS Survey Card -->
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-body">
              <h6 class="d-flex align-items-center gap-2 mb-3">
                <i class="bi bi-star text-warning"></i>
                Encuesta NPS
              </h6>
              <p class="text-muted small mb-3">¿Qué tan probable es que recomiende nuestros servicios? (0-10)</p>

              <div class="d-flex gap-2 mb-3 flex-wrap justify-content-center">
                @for (n of npsOptions; track n) {
                  <button class="nps-box btn" (click)="selectedNps.set(n)"
                          [class.btn-outline-secondary]="selectedNps() !== n"
                          [class.btn-danger]="selectedNps() === n && n <= 6"
                          [class.btn-warning]="selectedNps() === n && n >= 7 && n <= 8"
                          [class.btn-success]="selectedNps() === n && n >= 9">
                    {{ n }}
                  </button>
                }
              </div>

              <div class="d-flex gap-3 text-center small text-muted mb-3 justify-content-center">
                <span class="text-danger">0-6 Detractor</span>
                <span class="text-warning">7-8 Pasivo</span>
                <span class="text-success">9-10 Promotor</span>
              </div>

              <textarea class="form-control mb-3" rows="3" [(ngModel)]="npsFeedback"
                        placeholder="Cuéntanos más sobre tu experiencia (opcional)..."></textarea>

              <button class="btn btn-primary" (click)="submitSurvey()"
                      [disabled]="selectedNps() === null || submittingSurvey()">
                <span class="spinner-border spinner-border-sm me-1" *ngIf="submittingSurvey()"></span>
                Enviar Encuesta
              </button>

              @if (surveySuccess()) {
                <div class="alert alert-success mt-3 mb-0 py-2">
                  <i class="bi bi-check-circle me-1"></i>Encuesta registrada exitosamente.
                </div>
              }
            </div>
          </div>

          <!-- Experience summary -->
          @if (patientExperience()) {
            <div class="row g-3 mb-4">
              <div class="col-md-4">
                <div class="card border-0 shadow-sm text-center">
                  <div class="card-body">
                    <div class="text-muted small mb-1">NPS Promedio</div>
                    <div class="h2 mb-0" [style.color]="getNpsColor(patientExperience()!.avgNps)">
                      {{ patientExperience()!.avgNps | number:'1.1-1' }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border-0 shadow-sm text-center">
                  <div class="card-body">
                    <div class="text-muted small mb-1">Total Encuestas</div>
                    <div class="h2 mb-0 text-primary">{{ patientExperience()!.surveys?.length ?? 0 }}</div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border-0 shadow-sm text-center">
                  <div class="card-body">
                    <div class="text-muted small mb-1">Riesgo de Abandono</div>
                    <div class="h2 mb-0" [style.color]="getChurnColor(patientExperience()!.churnPrediction?.riskLevel)">
                      {{ patientExperience()!.churnPrediction?.riskLevel ?? 'N/A' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Satisfaction trend chart -->
            <div class="row g-3 mb-4">
              <div class="col-lg-8">
                <div class="card border-0 shadow-sm">
                  <div class="card-body">
                    <h6 class="mb-3">Tendencia de Satisfacción</h6>
                    <div #satisfactionChart style="width: 100%; height: 300px;"></div>
                  </div>
                </div>
              </div>
              <div class="col-lg-4">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body">
                    <h6 class="mb-3 d-flex align-items-center gap-2">
                      <i class="bi bi-exclamation-triangle text-warning"></i>
                      Predicción de Abandono
                    </h6>

                    <!-- Churn gauge -->
                    @if (patientExperience()!.churnPrediction; as churn) {
                      <div class="text-center mb-3">
                        <div class="churn-gauge mx-auto mb-2"
                             [style.--gauge-color]="getChurnColor(churn.riskLevel)"
                             [style.--gauge-pct]="(churn.churnProbability * 100) + '%'">
                          <div class="gauge-inner">
                            <span class="gauge-value">{{ (churn.churnProbability * 100) | number:'1.0-0' }}%</span>
                            <span class="gauge-label">{{ churn.riskLevel }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="mb-3">
                        <p class="small fw-semibold text-muted mb-2">Factores de Riesgo:</p>
                        <ul class="list-unstyled mb-0">
                          @for (f of churn.factors; track f) {
                            <li class="small mb-1 d-flex align-items-start gap-1">
                              <i class="bi bi-dot text-danger fs-5 lh-1"></i>{{ f }}
                            </li>
                          }
                        </ul>
                      </div>
                      <div>
                        <p class="small fw-semibold text-muted mb-2">Acciones Recomendadas:</p>
                        <ul class="list-unstyled mb-0">
                          @for (a of churn.recommendedActions; track a) {
                            <li class="small mb-1 d-flex align-items-start gap-1">
                              <i class="bi bi-check2 text-success"></i>{{ a }}
                            </li>
                          }
                        </ul>
                      </div>
                    } @else {
                      <div class="text-center py-3">
                        <button class="btn btn-outline-warning btn-sm" (click)="predictChurn()"
                                [disabled]="predictingChurn()">
                          <span class="spinner-border spinner-border-sm me-1" *ngIf="predictingChurn()"></span>
                          Predecir Abandono
                        </button>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }

          @if (loadingPatient()) {
            <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
          }
        }
      }

      <!-- Site metrics tab -->
      @if (activeTab() === 'site') {
        @if (loadingSite()) {
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        } @else if (siteMetrics()) {
          <div class="row g-3 mb-4">
            <div class="col-md-3">
              <div class="card border-0 shadow-sm text-center">
                <div class="card-body">
                  <div class="text-muted small">Total Pacientes</div>
                  <div class="h3 mb-0 text-primary">{{ siteMetrics()!.totalPatients }}</div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card border-0 shadow-sm text-center">
                <div class="card-body">
                  <div class="text-muted small">NPS Promedio</div>
                  <div class="h3 mb-0" [style.color]="getNpsColor(siteMetrics()!.avgNps)">
                    {{ siteMetrics()!.avgNps | number:'1.1-1' }}
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card border-0 shadow-sm text-center">
                <div class="card-body">
                  <div class="text-muted small">Tasa de Respuesta</div>
                  <div class="h3 mb-0 text-info">{{ (siteMetrics()!.responseRate * 100) | number:'1.1-1' }}%</div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card border-0 shadow-sm text-center">
                <div class="card-body">
                  <div class="text-muted small">Encuestas Totales</div>
                  <div class="h3 mb-0 text-secondary">{{ totalSurveys() }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="row g-3">
            <div class="col-lg-6">
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <h6 class="mb-3">NPS Score</h6>
                  <div #npsGaugeChart style="width: 100%; height: 300px;"></div>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <h6 class="mb-3">Distribución Riesgo de Abandono</h6>
                  <div #churnPieChart style="width: 100%; height: 300px;"></div>
                </div>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .nps-box { width: 48px; height: 48px; font-weight: 600; font-size: 1.1rem; border-radius: 8px; }
    .churn-gauge {
      width: 140px; height: 140px; border-radius: 50%; position: relative;
      background: conic-gradient(var(--gauge-color) var(--gauge-pct), #e9ecef var(--gauge-pct));
    }
    .gauge-inner {
      position: absolute; inset: 12px; border-radius: 50%;
      background: white; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
    .gauge-value { font-size: 1.5rem; font-weight: 700; line-height: 1; }
    .gauge-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
  `]
})
class ExperiencePageComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly api = inject(ExperienceApiService);

  @ViewChild('satisfactionChart') private satisfactionRef?: ElementRef<HTMLDivElement>;
  @ViewChild('npsGaugeChart') private npsGaugeRef?: ElementRef<HTMLDivElement>;
  @ViewChild('churnPieChart') private churnPieRef?: ElementRef<HTMLDivElement>;

  private chartSatisfaction?: echarts.ECharts;
  private chartNpsGauge?: echarts.ECharts;
  private chartChurnPie?: echarts.ECharts;
  private readonly onResize = () => {
    this.chartSatisfaction?.resize();
    this.chartNpsGauge?.resize();
    this.chartChurnPie?.resize();
  };

  readonly patientId = signal<string | null>(null);
  readonly activeTab = signal<'patient' | 'site'>('patient');
  readonly patientExperience = signal<PatientExperience | null>(null);
  readonly siteMetrics = signal<SiteMetrics | null>(null);
  readonly loadingPatient = signal(false);
  readonly loadingSite = signal(false);
  readonly submittingSurvey = signal(false);
  readonly surveySuccess = signal(false);
  readonly predictingChurn = signal(false);

  readonly selectedNps = signal<number | null>(null);
  npsFeedback = '';
  readonly npsOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  readonly totalSurveys = computed(() => {
    const m = this.siteMetrics();
    return m ? Math.round(m.totalPatients * m.responseRate) : 0;
  });

  private activeSurveyId: string | null = null;

  ngOnInit() {
    this.store.select(selectSelectedPatientId).subscribe(id => {
      this.patientId.set(id ?? null);
      if (id) this.loadPatientData(id);
    });
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize);
    this.chartSatisfaction?.dispose();
    this.chartNpsGauge?.dispose();
    this.chartChurnPie?.dispose();
  }

  private loadPatientData(patientId: string) {
    this.loadingPatient.set(true);
    this.api.getPatientExperience$(patientId).subscribe({
      next: exp => {
        const normalized = { ...exp, surveys: exp?.surveys ?? [] };
        this.patientExperience.set(normalized);
        this.loadingPatient.set(false);
        setTimeout(() => this.renderSatisfactionChart(normalized.surveys), 100);
      },
      error: () => this.loadingPatient.set(false)
    });
  }

  submitSurvey() {
    const pid = this.patientId();
    const nps = this.selectedNps();
    if (!pid || nps === null) return;

    this.submittingSurvey.set(true);
    this.surveySuccess.set(false);

    this.api.sendNpsSurvey$(pid, 'MANUAL').subscribe({
      next: survey => {
        this.api.completeSurvey$(survey.id, nps, this.npsFeedback || undefined).subscribe({
          next: () => {
            this.surveySuccess.set(true);
            this.submittingSurvey.set(false);
            this.selectedNps.set(null);
            this.npsFeedback = '';
            this.loadPatientData(pid);
          },
          error: () => this.submittingSurvey.set(false)
        });
      },
      error: () => this.submittingSurvey.set(false)
    });
  }

  predictChurn() {
    const pid = this.patientId();
    if (!pid) return;
    this.predictingChurn.set(true);
    this.api.predictChurn$(pid).subscribe({
      next: prediction => {
        const exp = this.patientExperience();
        if (exp) {
          this.patientExperience.set({ ...exp, churnPrediction: prediction });
        }
        this.predictingChurn.set(false);
      },
      error: () => this.predictingChurn.set(false)
    });
  }

  loadSiteMetrics() {
    if (this.siteMetrics()) {
      setTimeout(() => this.renderSiteCharts(), 100);
      return;
    }
    this.loadingSite.set(true);
    this.api.getSiteMetrics$().subscribe({
      next: metrics => {
        this.siteMetrics.set(metrics);
        this.loadingSite.set(false);
        setTimeout(() => this.renderSiteCharts(), 100);
      },
      error: () => this.loadingSite.set(false)
    });
  }

  getNpsColor(nps: number): string {
    if (nps >= 9) return '#10b981';
    if (nps >= 7) return '#f59e0b';
    return '#ef4444';
  }

  getChurnColor(level?: string): string {
    return CHURN_COLORS[level ?? ''] ?? '#6b7280';
  }

  private renderSatisfactionChart(surveys: SatisfactionSurvey[]) {
    if (!this.satisfactionRef) return;
    const completed = surveys
      .filter(s => s.npsScore != null && s.completedAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (!this.chartSatisfaction) {
      this.chartSatisfaction = echarts.init(this.satisfactionRef.nativeElement);
    }

    this.chartSatisfaction.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: completed.map(s => new Date(s.createdAt).toLocaleDateString()) },
      yAxis: { type: 'value', min: 0, max: 10 },
      series: [{
        type: 'line', smooth: true, data: completed.map(s => s.npsScore),
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
          { offset: 1, color: 'rgba(16, 185, 129, 0.02)' }
        ])},
        color: '#10b981', lineStyle: { width: 3 },
        markLine: { data: [{ yAxis: 7, label: { formatter: 'Pasivo' } }, { yAxis: 9, label: { formatter: 'Promotor' } }] }
      }],
      grid: { left: 40, right: 15, top: 10, bottom: 30 }
    });
  }

  private renderSiteCharts() {
    const metrics = this.siteMetrics();
    if (!metrics) return;

    if (this.npsGaugeRef) {
      if (!this.chartNpsGauge) this.chartNpsGauge = echarts.init(this.npsGaugeRef.nativeElement);
      this.chartNpsGauge.setOption({
        series: [{
          type: 'gauge', startAngle: 200, endAngle: -20,
          min: 0, max: 10,
          pointer: { show: true, length: '60%' },
          axisLine: {
            lineStyle: {
              width: 20,
              color: [[0.6, '#ef4444'], [0.8, '#f59e0b'], [1, '#10b981']]
            }
          },
          axisTick: { show: false },
          splitLine: { length: 15, lineStyle: { width: 2, color: '#999' } },
          axisLabel: { distance: 25, fontSize: 12 },
          detail: { fontSize: 32, offsetCenter: [0, '40%'], formatter: '{value}', color: 'inherit' },
          data: [{ value: Math.round(metrics.avgNps * 10) / 10, name: 'NPS Score' }]
        }]
      });
    }

    if (this.churnPieRef) {
      if (!this.chartChurnPie) this.chartChurnPie = echarts.init(this.churnPieRef.nativeElement);
      const dist = metrics.churnRiskDistribution;
      this.chartChurnPie.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0 },
        series: [{
          type: 'pie', radius: ['40%', '70%'], padAngle: 3, itemStyle: { borderRadius: 6 },
          data: Object.entries(dist).map(([name, value]) => ({
            name, value,
            itemStyle: { color: CHURN_COLORS[name] ?? '#6b7280' }
          })),
          label: { formatter: '{b}\n{d}%' }
        }]
      });
    }
  }
}

export const EXPERIENCE_ROUTES: Routes = [{ path: '', component: ExperiencePageComponent }];
