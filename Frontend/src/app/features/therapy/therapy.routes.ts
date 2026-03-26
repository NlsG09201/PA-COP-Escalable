import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal, computed, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import * as echarts from 'echarts';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import {
  TherapyApiService,
  TherapyModule as TherapyMod,
  TherapySession,
  TherapyProgress
} from '../../core/services/therapy-api.service';

interface BreathingConfig {
  name: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdAfter: number;
}

const BREATHING_PATTERNS: Record<string, BreathingConfig> = {
  '4-7-8': { name: 'Relajación 4-7-8', inhale: 4, hold: 7, exhale: 8, holdAfter: 0 },
  'box': { name: 'Respiración Cuadrada', inhale: 4, hold: 4, exhale: 4, holdAfter: 4 }
};

const MODULE_ICONS: Record<string, string> = {
  BREATHING: 'bi-wind',
  JOURNALING: 'bi-journal-text',
  CBT: 'bi-diagram-3',
  MINDFULNESS: 'bi-flower1',
  RELAXATION: 'bi-emoji-smile'
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  BREATHING: 'Ejercicios de respiración guiada para reducir ansiedad y estrés',
  JOURNALING: 'Escritura terapéutica con prompts y análisis emocional',
  CBT: 'Registro de pensamientos y reestructuración cognitiva',
  MINDFULNESS: 'Meditación guiada con atención plena al cuerpo',
  RELAXATION: 'Técnicas de relajación muscular progresiva'
};

const BODY_SECTIONS = [
  'Cabeza y frente', 'Ojos y mejillas', 'Mandíbula y cuello',
  'Hombros', 'Brazos y manos', 'Pecho', 'Abdomen',
  'Espalda baja', 'Caderas', 'Piernas', 'Pies'
];

const JOURNAL_PROMPTS = [
  '¿Qué situación te generó malestar hoy?',
  '¿Qué emociones identificas en este momento?',
  '¿Qué pensamientos recurrentes has tenido esta semana?',
  '¿Cuál es un logro reciente que quieres reconocer?',
  '¿Qué te gustaría cambiar de tu día a día?'
];

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container-fluid">
      @if (!patientId()) {
        <div class="alert alert-info d-flex align-items-center gap-2">
          <i class="bi bi-info-circle fs-5"></i>
          Selecciona un paciente para acceder al módulo de terapia.
        </div>
      } @else {
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-heart-pulse text-primary"></i> Módulos Terapéuticos
          </h4>
          <button class="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                  (click)="getRecommendation()" [disabled]="loadingRec()">
            <span class="spinner-border spinner-border-sm" *ngIf="loadingRec()"></span>
            <i class="bi bi-stars" *ngIf="!loadingRec()"></i>
            Recomendación IA
          </button>
        </div>

        <!-- Category filter tabs -->
        <ul class="nav nav-pills mb-4 gap-1">
          <li class="nav-item" *ngFor="let cat of categories">
            <button class="nav-link" [class.active]="activeCategory() === cat"
                    (click)="activeCategory.set(cat)">
              {{ cat === 'ALL' ? 'Todos' : cat }}
            </button>
          </li>
        </ul>

        <!-- Active session panel -->
        @if (activeSession()) {
          <div class="card border-primary shadow mb-4">
            <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <span><i class="bi bi-play-circle me-2"></i>Sesión Activa: {{ activeModuleName() }}</span>
              <div class="d-flex gap-2">
                <button class="btn btn-outline-light btn-sm" (click)="abandonSession()">Abandonar</button>
                <button class="btn btn-light btn-sm" (click)="completeSession()" [disabled]="!canComplete()">
                  <i class="bi bi-check-circle me-1"></i>Completar
                </button>
              </div>
            </div>
            <div class="card-body">
              <!-- Progress bar -->
              <div class="progress mb-3" style="height: 6px;">
                <div class="progress-bar bg-primary" [style.width.%]="sessionProgress()"></div>
              </div>

              <!-- BREATHING exercise -->
              @if (activeModuleCode() === 'BREATHING') {
                <div class="text-center py-4">
                  <div class="mb-3">
                    <select class="form-select form-select-sm w-auto mx-auto" [(ngModel)]="breathingPattern"
                            (ngModelChange)="resetBreathing()">
                      <option value="4-7-8">Relajación 4-7-8</option>
                      <option value="box">Respiración Cuadrada</option>
                    </select>
                  </div>
                  <div class="breathing-container mx-auto mb-3">
                    <svg viewBox="0 0 200 200" class="breathing-svg">
                      <circle cx="100" cy="100" r="30" class="breathing-circle"
                              [class.inhaling]="breathPhase() === 'INHALE'"
                              [class.holding]="breathPhase() === 'HOLD' || breathPhase() === 'HOLD_AFTER'"
                              [class.exhaling]="breathPhase() === 'EXHALE'"
                              [style.--inhale-duration]="currentBreathConfig().inhale + 's'"
                              [style.--hold-duration]="currentBreathConfig().hold + 's'"
                              [style.--exhale-duration]="currentBreathConfig().exhale + 's'" />
                      <text x="100" y="105" text-anchor="middle" class="phase-text">
                        {{ breathPhaseLabel() }}
                      </text>
                    </svg>
                  </div>
                  <div class="fs-1 fw-bold text-primary mb-2">{{ breathTimer() }}</div>
                  <div class="text-muted mb-3">Ciclo {{ breathCycle() }} · {{ currentBreathConfig().name }}</div>
                  <button class="btn btn-primary px-4" *ngIf="!breathingActive()"
                          (click)="startBreathing()">
                    <i class="bi bi-play-fill me-1"></i>Comenzar
                  </button>
                  <button class="btn btn-outline-danger px-4" *ngIf="breathingActive()"
                          (click)="stopBreathing()">
                    <i class="bi bi-pause-fill me-1"></i>Pausar
                  </button>
                </div>
              }

              <!-- JOURNALING exercise -->
              @if (activeModuleCode() === 'JOURNALING') {
                <div class="py-3">
                  <div class="alert alert-light border d-flex align-items-start gap-2 mb-3">
                    <i class="bi bi-lightbulb text-warning fs-5"></i>
                    <div>
                      <strong>Prompt:</strong> {{ currentPrompt() }}
                      <button class="btn btn-link btn-sm p-0 ms-2" (click)="nextPrompt()">Otro prompt</button>
                    </div>
                  </div>
                  <textarea class="form-control mb-2" rows="12" [(ngModel)]="journalText"
                            placeholder="Escribe libremente..."></textarea>
                  <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">{{ journalText.length }} caracteres · {{ wordCount() }} palabras</small>
                    <button class="btn btn-primary btn-sm" (click)="completeSession()"
                            [disabled]="journalText.trim().length < 10">
                      <i class="bi bi-check2-circle me-1"></i>Guardar y Analizar
                    </button>
                  </div>
                </div>
              }

              <!-- CBT thought record -->
              @if (activeModuleCode() === 'CBT') {
                <div class="py-3">
                  <div class="stepper d-flex mb-4 gap-1">
                    @for (step of cbtSteps; track step.key; let i = $index) {
                      <div class="step-item flex-fill text-center" [class.active]="cbtStep() === i"
                           [class.completed]="cbtStep() > i">
                        <div class="step-circle mx-auto mb-1">{{ i + 1 }}</div>
                        <small>{{ step.label }}</small>
                      </div>
                    }
                  </div>
                  <div class="mb-3">
                    <label class="form-label fw-semibold">{{ cbtSteps[cbtStep()].label }}</label>
                    <p class="text-muted small">{{ cbtSteps[cbtStep()].hint }}</p>
                    <textarea class="form-control" rows="4"
                              [ngModel]="cbtData()[cbtSteps[cbtStep()].key]"
                              (ngModelChange)="updateCbtField(cbtSteps[cbtStep()].key, $event)"
                              [placeholder]="cbtSteps[cbtStep()].placeholder"></textarea>
                  </div>
                  <div class="d-flex justify-content-between">
                    <button class="btn btn-outline-secondary btn-sm" (click)="cbtStep.set(cbtStep() - 1)"
                            [disabled]="cbtStep() === 0">
                      <i class="bi bi-arrow-left me-1"></i>Anterior
                    </button>
                    @if (cbtStep() < cbtSteps.length - 1) {
                      <button class="btn btn-primary btn-sm" (click)="cbtStep.set(cbtStep() + 1)"
                              [disabled]="!cbtData()[cbtSteps[cbtStep()].key]?.trim()">
                        Siguiente<i class="bi bi-arrow-right ms-1"></i>
                      </button>
                    } @else {
                      <button class="btn btn-success btn-sm" (click)="completeSession()"
                              [disabled]="!cbtComplete()">
                        <i class="bi bi-check-circle me-1"></i>Completar Registro
                      </button>
                    }
                  </div>
                </div>
              }

              <!-- MINDFULNESS -->
              @if (activeModuleCode() === 'MINDFULNESS') {
                <div class="text-center py-4">
                  <div class="mb-3 text-muted">Escaneo Corporal Guiado</div>
                  <div class="body-sections d-flex flex-column align-items-center gap-2 mb-4">
                    @for (section of bodySections; track section; let i = $index) {
                      <div class="body-section-item px-4 py-2 rounded-pill w-75"
                           [class.bg-primary]="mindfulnessIndex() === i"
                           [class.text-white]="mindfulnessIndex() === i"
                           [class.bg-success-subtle]="mindfulnessIndex() > i"
                           [class.bg-light]="mindfulnessIndex() < i">
                        {{ section }}
                        <i class="bi bi-check-circle ms-2" *ngIf="mindfulnessIndex() > i"></i>
                      </div>
                    }
                  </div>
                  <div class="fs-2 fw-bold text-primary mb-2">{{ mindfulnessTimer() }}s</div>
                  <div class="text-muted mb-3">Sección {{ mindfulnessIndex() + 1 }} de {{ bodySections.length }}</div>
                  <button class="btn btn-primary px-4" *ngIf="!mindfulnessActive()"
                          (click)="startMindfulness()">
                    <i class="bi bi-play-fill me-1"></i>{{ mindfulnessIndex() > 0 ? 'Continuar' : 'Comenzar' }}
                  </button>
                  <button class="btn btn-outline-danger px-4" *ngIf="mindfulnessActive()"
                          (click)="pauseMindfulness()">
                    <i class="bi bi-pause-fill me-1"></i>Pausar
                  </button>
                </div>
              }

              <!-- RELAXATION (generic) -->
              @if (activeModuleCode() === 'RELAXATION') {
                <div class="text-center py-4">
                  <p class="text-muted">Sigue las instrucciones de relajación muscular progresiva.</p>
                  <div class="fs-2 fw-bold text-primary mb-2">{{ relaxationTimer() }}s</div>
                  <button class="btn btn-primary px-4" *ngIf="!relaxationActive()"
                          (click)="startRelaxation()">
                    <i class="bi bi-play-fill me-1"></i>Comenzar
                  </button>
                  <button class="btn btn-outline-danger px-4" *ngIf="relaxationActive()"
                          (click)="pauseRelaxation()">
                    <i class="bi bi-pause-fill me-1"></i>Pausar
                  </button>
                </div>
              }
            </div>
          </div>
        }

        <!-- Module grid -->
        <div class="row g-3 mb-4">
          @for (mod of filteredModules(); track mod.id) {
            <div class="col-md-4 col-lg-3">
              <div class="card h-100 shadow-sm border-0 module-card"
                   [class.border-success]="recommendedIds().has(mod.id)"
                   [class.border-2]="recommendedIds().has(mod.id)"
                   [class.recommended-glow]="recommendedIds().has(mod.id)">
                @if (recommendedIds().has(mod.id)) {
                  <div class="position-absolute top-0 end-0 m-2">
                    <span class="badge bg-success"><i class="bi bi-stars me-1"></i>Recomendado</span>
                  </div>
                }
                <div class="card-body text-center">
                  <div class="module-icon rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                       [style.background]="'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'">
                    <i class="bi {{ getIcon(mod.code) }} text-white fs-3"></i>
                  </div>
                  <h6 class="card-title">{{ mod.name }}</h6>
                  <p class="card-text text-muted small">{{ getDescription(mod.code) }}</p>
                  <div class="d-flex justify-content-between align-items-center mt-2">
                    <span class="badge bg-light text-dark">{{ mod.category }}</span>
                    <span class="text-muted small">{{ mod.durationMin }} min</span>
                  </div>
                </div>
                <div class="card-footer bg-transparent border-0 pb-3 px-3">
                  <button class="btn btn-primary btn-sm w-100" (click)="startSession(mod)"
                          [disabled]="!!activeSession()">
                    <i class="bi bi-play-fill me-1"></i>Iniciar
                  </button>
                </div>
              </div>
            </div>
          }
        </div>

        @if (loading()) {
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
        }

        <!-- Progress dashboard -->
        @if (progress()) {
          <div class="row g-3 mb-4">
            <div class="col-md-3">
              <div class="card border-0 shadow-sm text-center">
                <div class="card-body">
                  <div class="text-muted small">Total Sesiones</div>
                  <div class="h3 mb-0 text-primary">{{ progress()!.totalSessions }}</div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card border-0 shadow-sm text-center">
                <div class="card-body">
                  <div class="text-muted small">Puntuación Media</div>
                  <div class="h3 mb-0 text-success">{{ progress()!.avgScore | number:'1.1-1' }}</div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card border-0 shadow-sm text-center">
                <div class="card-body">
                  <div class="text-muted small">Racha (días)</div>
                  <div class="h3 mb-0 text-warning">{{ progress()!.streakDays }}</div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <div class="card border-0 shadow-sm text-center">
                <div class="card-body">
                  <div class="text-muted small">Categorías</div>
                  <div class="h3 mb-0 text-info">{{ categoryCount() }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-lg-6">
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <h6 class="mb-3">Sesiones por Categoría</h6>
                  <div #categoryChart style="width: 100%; height: 300px;"></div>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <h6 class="mb-3">Sesiones Recientes</h6>
                  <div class="list-group list-group-flush">
                    @for (s of recentSessions(); track s.id) {
                      <div class="list-group-item d-flex justify-content-between align-items-center px-0">
                        <div>
                          <span class="fw-semibold">{{ s.moduleId | slice:0:8 }}</span>
                          <br><small class="text-muted">{{ s.completedAt | date:'short' }}</small>
                        </div>
                        <div class="text-end">
                          <span class="badge" [class]="getScoreBadge(s.score)">
                            {{ s.score ?? '-' }}
                          </span>
                          <br><small class="text-muted">{{ s.status }}</small>
                        </div>
                      </div>
                    }
                    @if (recentSessions().length === 0) {
                      <p class="text-muted text-center py-3 mb-0">Sin sesiones registradas</p>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .module-card { transition: transform 0.2s, box-shadow 0.2s; cursor: default; }
    .module-card:hover { transform: translateY(-4px); box-shadow: 0 8px 25px rgba(0,0,0,.1) !important; }
    .module-icon { width: 64px; height: 64px; }
    .recommended-glow { box-shadow: 0 0 20px rgba(25, 135, 84, 0.3) !important; }

    .breathing-container { width: 220px; height: 220px; }
    .breathing-svg { width: 100%; height: 100%; }
    .breathing-circle {
      fill: rgba(102, 126, 234, 0.2);
      stroke: #667eea;
      stroke-width: 2;
      transform-origin: 100px 100px;
      transition: r 0.3s ease;
    }
    .breathing-circle.inhaling {
      animation: inhale var(--inhale-duration, 4s) ease-in forwards;
    }
    .breathing-circle.holding {
      r: 80;
    }
    .breathing-circle.exhaling {
      animation: exhale var(--exhale-duration, 8s) ease-out forwards;
    }
    @keyframes inhale {
      from { r: 30; fill: rgba(102, 126, 234, 0.15); }
      to   { r: 80; fill: rgba(102, 126, 234, 0.4); }
    }
    @keyframes exhale {
      from { r: 80; fill: rgba(102, 126, 234, 0.4); }
      to   { r: 30; fill: rgba(102, 126, 234, 0.15); }
    }
    .phase-text { font-size: 14px; fill: #4a5568; font-weight: 600; }

    .stepper .step-item { position: relative; }
    .step-circle {
      width: 28px; height: 28px; border-radius: 50%;
      background: #e9ecef; display: flex; align-items: center;
      justify-content: center; font-size: 12px; font-weight: 600;
    }
    .step-item.active .step-circle { background: #0d6efd; color: white; }
    .step-item.completed .step-circle { background: #198754; color: white; }

    .body-section-item { transition: all 0.3s ease; font-size: 0.9rem; }
  `]
})
class TherapyPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly api = inject(TherapyApiService);

  @ViewChild('categoryChart') private categoryChartRef?: ElementRef<HTMLDivElement>;
  private chart?: echarts.ECharts;

  readonly patientId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadingRec = signal(false);
  readonly modules = signal<TherapyMod[]>([]);
  readonly activeCategory = signal('ALL');
  readonly recommendedIds = signal<Set<string>>(new Set());
  readonly activeSession = signal<TherapySession | null>(null);
  readonly activeModule = signal<TherapyMod | null>(null);
  readonly progress = signal<TherapyProgress | null>(null);
  readonly sessions = signal<TherapySession[]>([]);
  readonly error = signal<string | null>(null);

  readonly categories = ['ALL', 'BREATHING', 'JOURNALING', 'CBT', 'MINDFULNESS', 'RELAXATION'];
  readonly bodySections = BODY_SECTIONS;

  readonly filteredModules = computed(() => {
    const cat = this.activeCategory();
    return cat === 'ALL' ? this.modules() : this.modules().filter(m => m.category === cat);
  });

  readonly activeModuleCode = computed(() => this.activeModule()?.code ?? '');
  readonly activeModuleName = computed(() => this.activeModule()?.name ?? '');
  readonly categoryCount = computed(() => {
    const p = this.progress();
    return p ? Object.keys(p.sessionsByCategory).length : 0;
  });
  readonly recentSessions = computed(() =>
    [...this.sessions()]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 10)
  );

  // Breathing state
  breathingPattern = '4-7-8';
  readonly breathPhase = signal<'IDLE' | 'INHALE' | 'HOLD' | 'EXHALE' | 'HOLD_AFTER'>('IDLE');
  readonly breathTimer = signal(0);
  readonly breathCycle = signal(1);
  readonly breathingActive = signal(false);
  private breathInterval: ReturnType<typeof setInterval> | null = null;
  private phaseTimeout: ReturnType<typeof setTimeout> | null = null;

  currentBreathConfig(): BreathingConfig {
    return BREATHING_PATTERNS[this.breathingPattern] ?? BREATHING_PATTERNS['4-7-8'];
  }

  breathPhaseLabel(): string {
    const labels: Record<string, string> = {
      IDLE: 'Listo', INHALE: 'Inhala', HOLD: 'Mantén',
      EXHALE: 'Exhala', HOLD_AFTER: 'Mantén'
    };
    return labels[this.breathPhase()] ?? '';
  }

  // Journaling state
  journalText = '';
  private promptIndex = 0;
  readonly currentPrompt = signal(JOURNAL_PROMPTS[0]);
  readonly wordCount = computed(() => {
    const text = this.journalText.trim();
    return text ? text.split(/\s+/).length : 0;
  });

  // CBT state
  readonly cbtStep = signal(0);
  readonly cbtData = signal<Record<string, string>>({});
  readonly cbtSteps = [
    { key: 'situation', label: 'Situación', hint: '¿Qué ocurrió? Describe el evento concreto.', placeholder: 'Ej: Mi jefe me llamó la atención frente a los compañeros...' },
    { key: 'automatic_thought', label: 'Pensamiento Automático', hint: '¿Qué pensamiento vino a tu mente inmediatamente?', placeholder: 'Ej: "Soy un incompetente, todos piensan que soy tonto"' },
    { key: 'emotion', label: 'Emoción', hint: '¿Qué emoción sentiste y con qué intensidad (0-100)?', placeholder: 'Ej: Vergüenza (85), Tristeza (60)' },
    { key: 'evidence_for', label: 'Evidencia a Favor', hint: '¿Qué evidencia apoya este pensamiento?', placeholder: 'Ej: Cometí un error en el informe...' },
    { key: 'evidence_against', label: 'Evidencia en Contra', hint: '¿Qué evidencia contradice este pensamiento?', placeholder: 'Ej: En la última evaluación obtuve buen puntaje...' },
    { key: 'balanced_thought', label: 'Pensamiento Equilibrado', hint: 'Reformula el pensamiento de manera más realista.', placeholder: 'Ej: Cometí un error pero eso no define mi competencia...' },
    { key: 'outcome_emotion', label: 'Emoción Resultante', hint: '¿Cómo te sientes ahora con el pensamiento equilibrado?', placeholder: 'Ej: Vergüenza (40), Aceptación (50)' }
  ];
  readonly cbtComplete = computed(() => this.cbtSteps.every(s => this.cbtData()[s.key]?.trim()));

  // Mindfulness state
  readonly mindfulnessIndex = signal(0);
  readonly mindfulnessTimer = signal(30);
  readonly mindfulnessActive = signal(false);
  private mindfulnessInterval: ReturnType<typeof setInterval> | null = null;

  // Relaxation state
  readonly relaxationTimer = signal(0);
  readonly relaxationActive = signal(false);
  private relaxationInterval: ReturnType<typeof setInterval> | null = null;

  readonly sessionProgress = computed(() => {
    const code = this.activeModuleCode();
    if (code === 'CBT') return ((this.cbtStep() + 1) / this.cbtSteps.length) * 100;
    if (code === 'MINDFULNESS') return ((this.mindfulnessIndex()) / this.bodySections.length) * 100;
    if (code === 'JOURNALING') return Math.min((this.journalText.length / 500) * 100, 100);
    if (code === 'BREATHING') return Math.min((this.breathCycle() / 8) * 100, 100);
    if (code === 'RELAXATION') return Math.min((this.relaxationTimer() / 300) * 100, 100);
    return 0;
  });

  ngOnInit() {
    this.store.select(selectSelectedPatientId).subscribe(id => {
      this.patientId.set(id ?? null);
      if (id) this.loadData(id);
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderChart(), 300);
  }

  ngOnDestroy() {
    this.clearAllTimers();
    this.chart?.dispose();
  }

  private loadData(patientId: string) {
    this.loading.set(true);
    this.api.getModules$().subscribe({
      next: m => { this.modules.set(m); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.api.getProgress$(patientId).subscribe(p => {
      this.progress.set({ ...p, sessionsByCategory: p?.sessionsByCategory ?? {} });
      setTimeout(() => this.renderChart(), 100);
    });
    this.api.getSessions$(patientId).subscribe(s => this.sessions.set(s));
  }

  getRecommendation() {
    const pid = this.patientId();
    if (!pid) return;
    this.loadingRec.set(true);
    this.api.getRecommendation$(pid).subscribe({
      next: recs => {
        this.recommendedIds.set(new Set(recs.map(r => r.id)));
        this.loadingRec.set(false);
      },
      error: () => this.loadingRec.set(false)
    });
  }

  startSession(mod: TherapyMod) {
    const pid = this.patientId();
    if (!pid) return;
    this.api.startSession$(pid, mod.id).subscribe({
      next: session => {
        this.activeSession.set(session);
        this.activeModule.set(mod);
        this.resetExerciseState();
      },
      error: () => this.error.set('Error al iniciar sesión')
    });
  }

  completeSession() {
    const session = this.activeSession();
    if (!session) return;
    const responses = this.gatherResponses();
    this.api.completeExercise$(session.id, responses).subscribe({
      next: () => {
        this.activeSession.set(null);
        this.activeModule.set(null);
        this.clearAllTimers();
        const pid = this.patientId();
        if (pid) this.loadData(pid);
      },
      error: () => this.error.set('Error al completar sesión')
    });
  }

  abandonSession() {
    const session = this.activeSession();
    if (!session) return;
    this.api.abandonSession$(session.id).subscribe(() => {
      this.activeSession.set(null);
      this.activeModule.set(null);
      this.clearAllTimers();
    });
  }

  canComplete(): boolean {
    const code = this.activeModuleCode();
    if (code === 'JOURNALING') return this.journalText.trim().length >= 10;
    if (code === 'CBT') return this.cbtComplete();
    return true;
  }

  private gatherResponses(): Record<string, unknown> {
    const code = this.activeModuleCode();
    if (code === 'JOURNALING') return { text: this.journalText, wordCount: this.wordCount() };
    if (code === 'CBT') return { ...this.cbtData() };
    if (code === 'BREATHING') return { pattern: this.breathingPattern, cycles: this.breathCycle() };
    if (code === 'MINDFULNESS') return { sectionsCompleted: this.mindfulnessIndex() };
    if (code === 'RELAXATION') return { durationSec: this.relaxationTimer() };
    return {};
  }

  // Breathing methods
  startBreathing() {
    this.breathingActive.set(true);
    this.runBreathCycle();
  }

  stopBreathing() {
    this.breathingActive.set(false);
    this.clearBreathTimers();
    this.breathPhase.set('IDLE');
  }

  resetBreathing() {
    this.stopBreathing();
    this.breathCycle.set(1);
    this.breathTimer.set(0);
  }

  private runBreathCycle() {
    if (!this.breathingActive()) return;
    const cfg = this.currentBreathConfig();
    this.runPhase('INHALE', cfg.inhale, () => {
      this.runPhase('HOLD', cfg.hold, () => {
        this.runPhase('EXHALE', cfg.exhale, () => {
          if (cfg.holdAfter > 0) {
            this.runPhase('HOLD_AFTER', cfg.holdAfter, () => {
              this.breathCycle.set(this.breathCycle() + 1);
              this.runBreathCycle();
            });
          } else {
            this.breathCycle.set(this.breathCycle() + 1);
            this.runBreathCycle();
          }
        });
      });
    });
  }

  private runPhase(phase: 'INHALE' | 'HOLD' | 'EXHALE' | 'HOLD_AFTER', durationSec: number, onDone: () => void) {
    if (!this.breathingActive()) return;
    this.breathPhase.set(phase);
    this.breathTimer.set(durationSec);
    this.clearBreathTimers();
    this.breathInterval = setInterval(() => {
      const t = this.breathTimer() - 1;
      this.breathTimer.set(Math.max(t, 0));
    }, 1000);
    this.phaseTimeout = setTimeout(() => {
      this.clearBreathTimers();
      onDone();
    }, durationSec * 1000);
  }

  private clearBreathTimers() {
    if (this.breathInterval) { clearInterval(this.breathInterval); this.breathInterval = null; }
    if (this.phaseTimeout) { clearTimeout(this.phaseTimeout); this.phaseTimeout = null; }
  }

  // Journaling methods
  nextPrompt() {
    this.promptIndex = (this.promptIndex + 1) % JOURNAL_PROMPTS.length;
    this.currentPrompt.set(JOURNAL_PROMPTS[this.promptIndex]);
  }

  // CBT methods
  updateCbtField(key: string, value: string) {
    this.cbtData.set({ ...this.cbtData(), [key]: value });
  }

  // Mindfulness methods
  startMindfulness() {
    this.mindfulnessActive.set(true);
    this.mindfulnessTimer.set(30);
    this.mindfulnessInterval = setInterval(() => {
      const t = this.mindfulnessTimer() - 1;
      if (t <= 0) {
        const idx = this.mindfulnessIndex() + 1;
        if (idx >= this.bodySections.length) {
          this.pauseMindfulness();
          return;
        }
        this.mindfulnessIndex.set(idx);
        this.mindfulnessTimer.set(30);
      } else {
        this.mindfulnessTimer.set(t);
      }
    }, 1000);
  }

  pauseMindfulness() {
    this.mindfulnessActive.set(false);
    if (this.mindfulnessInterval) { clearInterval(this.mindfulnessInterval); this.mindfulnessInterval = null; }
  }

  // Relaxation methods
  startRelaxation() {
    this.relaxationActive.set(true);
    this.relaxationInterval = setInterval(() => {
      this.relaxationTimer.set(this.relaxationTimer() + 1);
    }, 1000);
  }

  pauseRelaxation() {
    this.relaxationActive.set(false);
    if (this.relaxationInterval) { clearInterval(this.relaxationInterval); this.relaxationInterval = null; }
  }

  private resetExerciseState() {
    this.journalText = '';
    this.promptIndex = 0;
    this.currentPrompt.set(JOURNAL_PROMPTS[0]);
    this.cbtStep.set(0);
    this.cbtData.set({});
    this.breathCycle.set(1);
    this.breathTimer.set(0);
    this.breathPhase.set('IDLE');
    this.breathingActive.set(false);
    this.mindfulnessIndex.set(0);
    this.mindfulnessTimer.set(30);
    this.mindfulnessActive.set(false);
    this.relaxationTimer.set(0);
    this.relaxationActive.set(false);
    this.clearAllTimers();
  }

  private clearAllTimers() {
    this.clearBreathTimers();
    if (this.mindfulnessInterval) { clearInterval(this.mindfulnessInterval); this.mindfulnessInterval = null; }
    if (this.relaxationInterval) { clearInterval(this.relaxationInterval); this.relaxationInterval = null; }
  }

  getIcon(code: string): string { return MODULE_ICONS[code] ?? 'bi-circle'; }
  getDescription(code: string): string { return MODULE_DESCRIPTIONS[code] ?? ''; }

  getScoreBadge(score?: number): string {
    if (score == null) return 'bg-secondary';
    if (score >= 80) return 'bg-success';
    if (score >= 50) return 'bg-warning text-dark';
    return 'bg-danger';
  }

  private renderChart() {
    const p = this.progress();
    if (!this.categoryChartRef || !p) return;
    if (!this.chart) {
      this.chart = echarts.init(this.categoryChartRef.nativeElement);
      window.addEventListener('resize', () => this.chart?.resize());
    }
    const cats = Object.keys(p.sessionsByCategory);
    const vals = Object.values(p.sessionsByCategory);
    this.chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: cats },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: vals, itemStyle: { color: '#667eea', borderRadius: [4, 4, 0, 0] } }],
      grid: { left: 40, right: 15, top: 10, bottom: 30 }
    });
  }
}

export const THERAPY_ROUTES: Routes = [{ path: '', component: TherapyPageComponent }];
