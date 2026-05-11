import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  Subscription,
  catchError,
  EMPTY,
  finalize,
  firstValueFrom,
  of,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  apiOriginForRequests,
  normalizeInternalGlbDownloadUrl,
  resolveHttpRequestUrl,
  resolveUrlAgainstApiOrigin,
} from '../../core/config/api.config';
import { extractHttpErrorMessage } from '../../core/http/extract-http-error-message';
import { AuthService } from '../../core/services/auth.service';
import { createWebGLRenderer } from '../../core/three/create-webgl-renderer';
import { OdontogramApiService } from '../odontogram/data-access/odontogram-api.service';
import { Ortho3dApiService } from '../odontogram/data-access/ortho-3d-api.service';
import { selectSelectedPatientId } from '../../store/patients.selectors';
import {
  SimulationApiService,
  DentalSimulation,
  ToothTransform,
  SimulationPhase,
} from '../../core/services/simulation-api.service';

const STATUS_COLORS: Record<string, number> = {
  HEALTHY: 0xe8e8e8,
  CARIES: 0xff4444,
  EXTRACTED: 0x999999,
  IMPLANT: 0x888888,
  BRACKET: 0x4488ff,
  ALIGNED: 0xffffff,
};

/** FDI tooth numbering: upper-right 18-11, upper-left 21-28, lower-left 38-31, lower-right 41-48 */
const FDI_CODES: string[] = [
  '18','17','16','15','14','13','12','11',
  '21','22','23','24','25','26','27','28',
  '38','37','36','35','34','33','32','31',
  '41','42','43','44','45','46','47','48',
];

interface ToothMesh {
  code: string;
  mesh: THREE.Mesh;
  label?: THREE.Sprite;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Euler;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h4 class="mb-0 fw-bold">
          <i class="bi bi-badge-3d me-2 text-primary"></i>Simulacion 3D
        </h4>
        @if (!patientId()) {
          <span class="badge text-bg-warning">Seleccione un paciente</span>
        }
      </div>

      @if (!patientId()) {
        <div class="alert alert-info d-flex align-items-center gap-2">
          <i class="bi bi-info-circle"></i>
          Seleccione un paciente para visualizar simulaciones dentales.
        </div>
      } @else {
        <div class="row g-4">
          <!-- Controls -->
          <div class="col-lg-3">
            <div class="card border-0 shadow-sm mb-3">
              <div class="card-body">
                <h6 class="card-title mb-3">Nueva Simulacion</h6>
                <button
                  class="btn btn-primary w-100 mb-2"
                  [disabled]="creating()"
                  (click)="createSimulation('ORTHODONTICS')"
                >
                  @if (creating() && creatingType() === 'ORTHODONTICS') {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  <i class="bi bi-arrow-left-right me-1"></i> Nueva Simulacion
                  Ortodoncia
                </button>
                <button
                  class="btn btn-outline-primary w-100"
                  [disabled]="creating()"
                  (click)="createSimulation('IMPLANT')"
                >
                  @if (creating() && creatingType() === 'IMPLANT') {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  <i class="bi bi-plus-circle me-1"></i>                   Nueva Simulacion
                  Implante
                </button>
              </div>
            </div>

            <div class="card border-0 shadow-sm mb-3">
              <div class="card-body">
                <h6 class="card-title mb-2">Modelado 3D desde imagen</h6>
                <p class="text-muted small mb-2">
                  Sube una foto intraoral: el backend llama al proveedor Image→3D (en Docker, un stub devuelve un GLB de demostración;
                  en producción configure Meshy, Tripo, Replicate, etc. vía variables <code>ORTHO_IMAGE_TO_3D_*</code>).
                </p>
                @if (patientPhotoGlbUrl()) {
                  <span class="badge text-bg-success mb-2 d-inline-block">GLB en expediente</span>
                } @else {
                  <span class="badge text-bg-secondary mb-2 d-inline-block">Sin modelo 3D</span>
                }
                <div class="btn-group w-100 mb-2" role="group">
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    [class.active]="viewerMode() === 'procedural'"
                    (click)="setViewerProcedural()"
                  >
                    Vista arcade
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-primary"
                    [class.active]="viewerMode() === 'photo'"
                    [disabled]="!patientPhotoGlbUrl() || photoGlbLoading()"
                    (click)="setViewerPhoto3d()"
                  >
                    Modelo 3D
                  </button>
                </div>
                @if (photoGlbLoading()) {
                  <div class="small text-muted mb-2">
                    <span class="spinner-border spinner-border-sm me-1"></span>
                    Cargando malla...
                  </div>
                }
                <label class="form-label small mb-1">Fotos intraorales</label>
                <input
                  type="file"
                  class="form-control form-control-sm mb-2"
                  accept="image/*"
                  multiple
                  (change)="onPhotoReconFiles($event)"
                />
                <button
                  class="btn btn-sm btn-primary w-100 mb-2"
                  [disabled]="photoReconBusy() || !photoFileCount()"
                  (click)="startPhotoReconstruction()"
                >
                  @if (photoReconBusy()) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Generar / actualizar 3D
                </button>
                @if (photoReconHint()) {
                  <div class="small text-muted">{{ photoReconHint() }}</div>
                }

                <hr class="my-3" />

                <label class="form-label small mb-1">CBCT / DICOM (ZIP)</label>
                <input
                  type="file"
                  class="form-control form-control-sm mb-2"
                  accept=".zip,application/zip"
                  (change)="onDicomZipSelected($event)"
                />
                <button
                  class="btn btn-sm btn-outline-primary w-100 mb-2"
                  [disabled]="dicomReconBusy()"
                  (click)="startDicomReconstruction()"
                >
                  @if (dicomReconBusy()) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Generar 3D desde CBCT
                </button>
                @if (dicomReconHint()) {
                  <div class="small text-muted">{{ dicomReconHint() }}</div>
                }
              </div>
            </div>

            <!-- Simulation List -->
            <div class="card border-0 shadow-sm mb-3">
              <div class="card-body">
                <h6 class="card-title mb-3">Simulaciones</h6>
                @if (loadingList()) {
                  <div class="text-center py-3">
                    <div
                      class="spinner-border spinner-border-sm text-primary"
                    ></div>
                  </div>
                } @else if (simulations().length === 0) {
                  <p class="text-muted small text-center">
                    No hay simulaciones.
                  </p>
                } @else {
                  @for (sim of simulations(); track sim.id) {
                    <div
                      class="sim-item p-2 rounded mb-2"
                      [class.active]="
                        activeSim() && activeSim()!.id === sim.id
                      "
                      (click)="selectSimulation(sim)"
                      role="button"
                    >
                      <div class="fw-semibold small">
                        {{ sim.simulationType }}
                      </div>
                      <small class="text-muted">
                        {{ sim.createdAt | date: 'dd/MM/yyyy' }} •
                        {{ sim.phases.length }} fases •
                        {{ sim.totalDurationMonths }}m
                      </small>
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Phase Info -->
            @if (activeSim() && activeSim()!.phases.length > 0) {
              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <h6 class="card-title mb-3">Fases del Tratamiento</h6>
                  @for (
                    phase of activeSim()!.phases;
                    track phase.phaseNumber
                  ) {
                    <div
                      class="phase-item p-2 rounded mb-2"
                      [class.active]="currentPhase() === phase.phaseNumber"
                    >
                      <div class="d-flex justify-content-between">
                        <strong class="small"
                          >Fase {{ phase.phaseNumber }}</strong
                        >
                        <span class="badge text-bg-info rounded-pill"
                          >{{ phase.durationMonths }}m</span
                        >
                      </div>
                      <div class="small">{{ phase.name }}</div>
                      <small class="text-muted">{{
                        phase.description
                      }}</small>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- 3D Viewer -->
          <div class="col-lg-9">
            <div class="card border-0 shadow-sm">
              <div class="card-body p-0 position-relative">
                <canvas
                  #rendererCanvas
                  class="d-block w-100 rounded"
                  style="height: 520px; background: #1a1a2e"
                ></canvas>

                <!-- Phase Slider -->
                @if (
                  activeSim() &&
                  activeSim()!.phases.length > 0 &&
                  viewerMode() === 'procedural'
                ) {
                  <div
                    class="position-absolute bottom-0 start-0 end-0 p-3"
                    style="background: linear-gradient(transparent, rgba(0,0,0,0.7))"
                  >
                    <div class="d-flex align-items-center gap-3">
                      <span class="text-white small fw-semibold"
                        >Fase {{ currentPhase() }}</span
                      >
                      <input
                        type="range"
                        class="form-range flex-grow-1"
                        [min]="0"
                        [max]="activeSim()!.phases.length - 1"
                        [ngModel]="currentPhase()"
                        (ngModelChange)="onPhaseChange($event)"
                      />
                      <span class="text-white small">{{
                        currentPhaseName()
                      }}</span>
                    </div>
                  </div>
                }

                <!-- Overlay for split view -->
                @if (showSplitView()) {
                  <div
                    class="position-absolute top-0 start-0 w-50 h-100 d-flex align-items-start justify-content-center pt-2"
                    style="pointer-events: none"
                  >
                    <span class="badge text-bg-dark">ANTES</span>
                  </div>
                  <div
                    class="position-absolute top-0 end-0 w-50 h-100 d-flex align-items-start justify-content-center pt-2"
                    style="pointer-events: none"
                  >
                    <span class="badge text-bg-primary">DESPUES</span>
                  </div>
                }
              </div>

              <!-- Toolbar -->
              <div class="card-footer bg-white border-top d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-primary]="viewerMode() === 'procedural'"
                  [class.btn-outline-secondary]="viewerMode() !== 'procedural'"
                  (click)="setViewerProcedural()"
                >
                  Arcade
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-primary]="viewerMode() === 'photo'"
                  [class.btn-outline-secondary]="viewerMode() !== 'photo'"
                  [disabled]="!patientPhotoGlbUrl() || photoGlbLoading()"
                  (click)="setViewerPhoto3d()"
                >
                  GLB foto
                </button>
                <button
                  class="btn btn-sm btn-outline-secondary"
                  (click)="resetCamera()"
                >
                  <i class="bi bi-arrows-move me-1"></i>Reset Camara
                </button>
                <button
                  class="btn btn-sm"
                  [class]="
                    showSplitView()
                      ? 'btn-primary'
                      : 'btn-outline-secondary'
                  "
                  (click)="toggleSplitView()"
                >
                  <i class="bi bi-layout-split me-1"></i>Antes/Despues
                </button>
                <button
                  class="btn btn-sm btn-outline-secondary"
                  (click)="toggleLabels()"
                >
                  <i class="bi bi-tag me-1"></i
                  >{{ showLabels() ? 'Ocultar' : 'Mostrar' }} Codigos
                </button>
              </div>
            </div>

            @if (error()) {
              <div class="alert alert-danger mt-3">{{ error() }}</div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .sim-item,
      .phase-item {
        background: #f8f9fa;
        border: 1px solid transparent;
        transition: all 0.15s;
      }
      .sim-item:hover,
      .phase-item:hover {
        background: #e9ecef;
      }
      .sim-item.active {
        border-color: #0d6efd;
        background: #e8f0fe;
      }
      .phase-item.active {
        border-color: #0dcaf0;
        background: #e0f7fa;
      }
    `,
  ],
})
class SimulationPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: false })
  private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly store = inject(Store);
  private readonly simApi = inject(SimulationApiService);
  private readonly odontogramApi = inject(OdontogramApiService);
  private readonly ortho3dApi = inject(Ortho3dApiService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);
  private sub?: Subscription;
  private animFrameId = 0;
  private glRendering = true;
  private threeJsInitialized = false;
  private webglInitFailed = false;
  private initRetryCount = 0;
  private photoGlbLoadSeq = 0;
  private photoGlbRoot: THREE.Group | null = null;
  private photoReconFiles: File[] = [];

  // Three.js objects
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private toothMeshes: ToothMesh[] = [];
  private gumMesh?: THREE.Mesh;

  // Signals
  protected readonly patientId = signal<string | null>(null);
  protected readonly simulations = signal<DentalSimulation[]>([]);
  protected readonly activeSim = signal<DentalSimulation | null>(null);
  protected readonly loadingList = signal(false);
  protected readonly creating = signal(false);
  protected readonly creatingType = signal<string>('');
  protected readonly error = signal<string | null>(null);
  protected readonly currentPhase = signal(0);
  protected readonly showSplitView = signal(false);
  protected readonly showLabels = signal(true);
  protected readonly viewerMode = signal<'procedural' | 'photo'>('procedural');
  protected readonly patientPhotoGlbUrl = signal<string | null>(null);
  protected readonly photoGlbLoading = signal(false);
  protected readonly photoReconBusy = signal(false);
  protected readonly photoReconHint = signal<string | null>(null);
  protected readonly dicomReconBusy = signal(false);
  protected readonly dicomReconHint = signal<string | null>(null);
  private dicomZip: File | null = null;

  protected readonly currentPhaseName = () => {
    const sim = this.activeSim();
    const phase = this.currentPhase();
    if (!sim || !sim.phases[phase]) return '';
    return sim.phases[phase].name;
  };

  ngOnInit(): void {
    this.sub = this.store.select(selectSelectedPatientId).subscribe((id) => {
      this.patientId.set(id);
      this.photoGlbLoadSeq++;
      this.photoGlbLoading.set(false);
      this.viewerMode.set('procedural');
      this.photoReconHint.set(null);
      this.photoReconFiles = [];
      this.activeSim.set(null);
      this.currentPhase.set(0);
      if (this.threeJsInitialized) {
        this.disposePhotoGlbMesh();
        this.createDefaultArch();
      }

      if (!id) {
        this.simulations.set([]);
        this.patientPhotoGlbUrl.set(null);
        return;
      }

      this.patientPhotoGlbUrl.set(null);
      this.loadSimulations(id);
      this.fetchPatientOdontogramGlb(id);
      this.zone.runOutsideAngular(() => requestAnimationFrame(() => this.initThreeJs()));
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initThreeJs());
  }

  private readonly onCanvasGlLost = (ev: Event): void => {
    ev.preventDefault();
    this.glRendering = false;
    cancelAnimationFrame(this.animFrameId);
    this.animFrameId = 0;
  };

  private readonly onCanvasGlRestore = (): void => {
    this.glRendering = true;
    this.onWindowResize();
    this.animate();
  };

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    const c = this.canvasRef?.nativeElement;
    if (c) {
      c.removeEventListener('webglcontextlost', this.onCanvasGlLost);
      c.removeEventListener('webglcontextrestored', this.onCanvasGlRestore);
    }
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onWindowResize);
    this.controls?.dispose();
    this.disposeScene();
    this.renderer?.dispose();
  }

  protected createSimulation(type: string): void {
    const pid = this.patientId();
    if (!pid) return;
    this.creating.set(true);
    this.creatingType.set(type);
    this.error.set(null);

    this.simApi.createSimulation$(pid, type).subscribe({
      next: (sim) => {
        const runSim$ =
          type === 'ORTHODONTICS'
            ? this.simApi.simulateOrthodontics$(sim.id)
            : this.simApi.simulateImplant$(sim.id, []);

        runSim$.subscribe({
          next: (completed) => {
            this.creating.set(false);
            this.loadSimulations(pid);
            this.selectSimulation(completed);
          },
          error: (err) => {
            this.creating.set(false);
            this.error.set(err?.error?.message ?? 'Error en simulacion');
          },
        });
      },
      error: (err) => {
        this.creating.set(false);
        this.error.set(err?.error?.message ?? 'Error al crear simulacion');
      },
    });
  }

  protected selectSimulation(sim: DentalSimulation): void {
    if (this.viewerMode() === 'photo') {
      this.photoGlbLoadSeq++;
      this.photoGlbLoading.set(false);
      this.disposePhotoGlbMesh();
      this.viewerMode.set('procedural');
    }
    this.activeSim.set(sim);
    this.currentPhase.set(0);
    this.rebuildArch(sim.initialState);
    if (sim.phases.length > 0) {
      this.applyPhase(sim.phases[0]);
    }
  }

  protected onPhaseChange(value: number): void {
    if (this.viewerMode() === 'photo') return;
    this.currentPhase.set(value);
    const sim = this.activeSim();
    if (!sim) return;
    this.animatePhase(value);
  }

  protected setViewerProcedural(): void {
    this.photoGlbLoadSeq++;
    this.viewerMode.set('procedural');
    this.photoGlbLoading.set(false);
    this.disposePhotoGlbMesh();
    if (!this.scene) return;
    const sim = this.activeSim();
    if (sim) {
      this.rebuildArch(sim.initialState);
      const idx = this.currentPhase();
      const ph = sim.phases[idx];
      if (ph) this.applyPhase(ph);
      else if (sim.phases.length > 0) this.applyPhase(sim.phases[0]);
    } else {
      this.createDefaultArch();
    }
  }

  protected setViewerPhoto3d(): void {
    const url = this.patientPhotoGlbUrl();
    if (!url || !this.threeJsInitialized || !this.scene) return;

    this.photoGlbLoadSeq++;
    const seq = this.photoGlbLoadSeq;
    this.viewerMode.set('photo');
    this.photoGlbLoading.set(true);
    this.clearArch();
    this.disposePhotoGlbMesh();

    const glbAbsolute = this.resolveGlbRequestUrl(url);
    const useHttp = this.shouldLoadGlbViaHttp(glbAbsolute);

    void this.loadGlbIntoScene(seq, glbAbsolute, useHttp)
      .then(() => {
        if (seq !== this.photoGlbLoadSeq) return;
        this.photoGlbLoading.set(false);
      })
      .catch(() => {
        if (seq !== this.photoGlbLoadSeq) return;
        this.photoGlbLoading.set(false);
        this.photoReconHint.set('No se pudo cargar el GLB.');
        this.photoGlbLoadSeq++;
        this.viewerMode.set('procedural');
        this.disposePhotoGlbMesh();
        const sim = this.activeSim();
        if (sim) {
          this.rebuildArch(sim.initialState);
          const idx = this.currentPhase();
          const ph = sim.phases[idx];
          if (ph) this.applyPhase(ph);
          else if (sim.phases.length > 0) this.applyPhase(sim.phases[0]);
        } else {
          this.createDefaultArch();
        }
      });
  }

  protected onPhotoReconFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.photoReconFiles = input.files ? Array.from(input.files) : [];
  }

  protected photoFileCount(): number {
    return this.photoReconFiles.length;
  }

  protected onDicomZipSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.dicomZip = input.files?.[0] ?? null;
  }

  protected startDicomReconstruction(): void {
    const pid = this.patientId();
    const zip = this.dicomZip;
    if (!pid || !zip) {
      this.dicomReconHint.set('Seleccione un ZIP DICOM/CBCT.');
      return;
    }
    this.dicomReconBusy.set(true);
    this.dicomReconHint.set(null);

    this.ortho3dApi
      .reconstructDicomAndResolve$(pid, zip)
      .pipe(
        take(1),
        finalize(() => this.dicomReconBusy.set(false)),
        switchMap((job) => {
          if (job.status === 'FAILED') {
            return throwError(() => new Error(job.errorMessage?.trim() || 'Reconstrucción DICOM fallida'));
          }
          return this.odontogramApi.getByPatient$(pid).pipe(take(1));
        }),
        catchError((e: unknown) => {
          this.dicomReconHint.set(extractHttpErrorMessage(e, 'Error de reconstrucción DICOM.'));
          return EMPTY;
        }),
      )
      .subscribe(({ simulation }) => {
        const u = simulation?.glbUrl?.trim() || null;
        this.patientPhotoGlbUrl.set(u);
        if (u) {
          this.dicomReconHint.set('Expediente actualizado (GLB desde CBCT).');
          this.setViewerPhoto3d();
        } else {
          this.dicomReconHint.set('La reconstrucción terminó pero no hay GLB en el expediente.');
        }
      });
  }

  protected startPhotoReconstruction(): void {
    const pid = this.patientId();
    const files = this.photoReconFiles;
    if (!pid || files.length === 0) {
      this.photoReconHint.set('Seleccione al menos una imagen.');
      return;
    }
    this.photoReconBusy.set(true);
    this.photoReconHint.set(null);

    this.ortho3dApi
      .reconstructAndResolve$(pid, files)
      .pipe(
        take(1),
        finalize(() => this.photoReconBusy.set(false)),
        switchMap((job) => {
          if (job.status === 'FAILED') {
            return throwError(() => new Error(job.errorMessage?.trim() || 'Reconstrucción fallida'));
          }
          return this.odontogramApi.getByPatient$(pid).pipe(take(1));
        }),
        catchError((e: unknown) => {
          this.photoReconHint.set(extractHttpErrorMessage(e, 'Error de reconstrucción.'));
          return EMPTY;
        }),
      )
      .subscribe(({ simulation }) => {
        const u = simulation?.glbUrl?.trim() || null;
        this.patientPhotoGlbUrl.set(u);
        if (u) {
          this.photoReconHint.set('Expediente actualizado.');
          this.setViewerPhoto3d();
        } else {
          this.photoReconHint.set(
            'La reconstrucción terminó pero no hay GLB en el expediente.',
          );
        }
      });
  }

  private fetchPatientOdontogramGlb(patientId: string): void {
    this.odontogramApi
      .getByPatient$(patientId)
      .pipe(
        take(1),
        catchError(() =>
          of({ teeth: [], simulation: null } as {
            teeth: unknown[];
            simulation: null;
          }),
        ),
      )
      .subscribe(({ simulation }) => {
        if (this.patientId() !== patientId) return;
        const u = simulation?.glbUrl?.trim() || null;
        this.patientPhotoGlbUrl.set(u);
        if (u) this.tryAutoOpenPatientGlb(patientId);
      });
  }

  /** Si el expediente ya tiene GLB, muestra ese modelo en lugar de la arcade procedural. */
  private tryAutoOpenPatientGlb(forPatientId?: string): void {
    if (!this.threeJsInitialized || !this.patientId()) return;
    if (forPatientId !== undefined && this.patientId() !== forPatientId) return;
    if (!this.patientPhotoGlbUrl()) return;
    if (this.viewerMode() === 'photo') return;
    this.setViewerPhoto3d();
  }

  private resolveGlbRequestUrl(url: string): string {
    return normalizeInternalGlbDownloadUrl(url);
  }

  private shouldLoadGlbViaHttp(glbUrl: string): boolean {
    const base = apiOriginForRequests().replace(/\/$/, '');
    try {
      const u = resolveUrlAgainstApiOrigin(glbUrl);
      const b = new URL(`${base}/`);
      return u.origin === b.origin && u.pathname.includes('/api/ortho/3d/jobs/') && u.pathname.endsWith('/glb');
    } catch {
      return false;
    }
  }

  private async fetchGlbAsArrayBuffer(absoluteUrl: string): Promise<ArrayBuffer> {
    const token = this.auth.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(absoluteUrl, { headers, mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`GLB HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  private async loadGlbIntoScene(seq: number, glbAbsolute: string, useHttp: boolean): Promise<void> {
    const loader = new GLTFLoader();
    const buf = useHttp
      ? await firstValueFrom(
          this.http.get(resolveHttpRequestUrl(glbAbsolute), { responseType: 'arraybuffer' }),
        )
      : await this.fetchGlbAsArrayBuffer(glbAbsolute);

    if (seq !== this.photoGlbLoadSeq) return;

    const gltf = await new Promise<{ scene?: THREE.Object3D; scenes?: THREE.Object3D[] }>(
      (resolve, reject) =>
        loader.parse(
          buf as ArrayBuffer,
          '',
          (data) => resolve(data as { scene?: THREE.Object3D; scenes?: THREE.Object3D[] }),
          (err) => reject(err ?? new Error('GLTF parse failed')),
        ),
    );

    if (seq !== this.photoGlbLoadSeq) return;

    const model = gltf.scene ?? gltf.scenes?.[0];
    if (!model) throw new Error('GLB loaded but no scene found');

    const root = new THREE.Group();
    root.add(model);
    this.photoGlbRoot = root;
    this.scene.add(root);

    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const raw of mats) {
        const anyM = raw as THREE.MeshStandardMaterial & {
          map?: THREE.Texture;
          emissiveMap?: THREE.Texture;
        };
        if (anyM.map?.isTexture) anyM.map.colorSpace = THREE.SRGBColorSpace;
        if (anyM.emissiveMap?.isTexture) anyM.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      }
    });

    this.normalizeGlbModel(model);
  }

  private normalizeGlbModel(model: THREE.Object3D): void {
    const bbox0 = new THREE.Box3().setFromObject(model);
    const size0 = bbox0.getSize(new THREE.Vector3());
    const likelyZUp = size0.y < size0.x * 0.25 && size0.y < size0.z * 0.25;
    if (likelyZUp) model.rotateX(-Math.PI / 2);

    const bbox1 = new THREE.Box3().setFromObject(model);
    const center1 = bbox1.getCenter(new THREE.Vector3());
    model.position.sub(center1);

    const bbox2 = new THREE.Box3().setFromObject(model);
    const size2 = bbox2.getSize(new THREE.Vector3());
    const maxDim = Math.max(size2.x, size2.y, size2.z);
    const targetMaxDim = 44;
    if (maxDim > 1e-6) {
      model.scale.multiplyScalar(targetMaxDim / maxDim);
    }

    const bbox3 = new THREE.Box3().setFromObject(model);
    const baseMinY = -4;
    model.position.y += baseMinY - bbox3.min.y;

    const finalBbox = new THREE.Box3().setFromObject(model);
    this.fitCameraToBoundingBox(finalBbox);
  }

  private fitCameraToBoundingBox(bbox: THREE.Box3): void {
    if (!this.camera || !this.controls) return;
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim <= 1e-6) return;

    const center = bbox.getCenter(new THREE.Vector3());
    this.controls.target.copy(center);

    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (maxDim / 2) / Math.tan(fovRad / 2);
    const pad = 1.35;
    const dir = new THREE.Vector3(0.35, 0.45, 1).normalize();
    this.camera.position.copy(center).add(dir.multiplyScalar(distance * pad));

    this.camera.near = Math.max(0.01, distance / 1000);
    this.camera.far = Math.max(200, distance * 50);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private disposePhotoGlbMesh(): void {
    const root = this.photoGlbRoot;
    this.photoGlbRoot = null;
    if (!root || !this.scene) return;
    this.scene.remove(root);
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          const anyM = m as THREE.MeshStandardMaterial & { map?: THREE.Texture };
          anyM.map?.dispose();
          m.dispose();
        }
      }
    });
  }

  protected resetCamera(): void {
    this.camera.position.set(0, 25, 40);
    this.camera.lookAt(0, 0, 0);
    this.controls.reset();
  }

  protected toggleSplitView(): void {
    this.showSplitView.update((v) => !v);
  }

  protected toggleLabels(): void {
    this.showLabels.update((v) => !v);
    for (const tm of this.toothMeshes) {
      if (tm.label) tm.label.visible = this.showLabels();
    }
  }

  // ─── Three.js ──────────────────────────────────────────────

  private initThreeJs(): void {
    if (this.threeJsInitialized || this.webglInitFailed) return;

    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      // Canvas is conditionally rendered when patientId exists.
      // When it's not yet in the DOM, postpone initialization.
      if (this.initRetryCount++ < 10) {
        requestAnimationFrame(() => this.initThreeJs());
      }
      return;
    }
    this.initRetryCount = 0;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    try {
      this.renderer = createWebGLRenderer({ canvas });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.setSize(w, h, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.setClearColor(0x1a1a2e, 1);

      this.scene = new THREE.Scene();

      this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
      this.camera.position.set(0, 25, 40);
      this.camera.lookAt(0, 0, 0);

      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.minDistance = 15;
      this.controls.maxDistance = 80;
      this.controls.target.set(0, 0, 0);

      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      this.scene.add(ambient);

      const dir = new THREE.DirectionalLight(0xffffff, 0.9);
      dir.position.set(10, 20, 15);
      dir.castShadow = true;
      this.scene.add(dir);

      const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
      fill.position.set(-10, 10, -10);
      this.scene.add(fill);

      this.createDefaultArch();

      window.addEventListener('resize', this.onWindowResize);
      canvas.addEventListener('webglcontextlost', this.onCanvasGlLost, false);
      canvas.addEventListener('webglcontextrestored', this.onCanvasGlRestore, false);
      this.threeJsInitialized = true;
      this.animate();
      this.tryAutoOpenPatientGlb();
    } catch (e) {
      this.webglInitFailed = true;
      const msg =
        e instanceof Error
          ? e.message
          : 'WebGL no disponible: active aceleración por hardware o evite RDP/sin GPU.';
      this.zone.run(() => this.error.set(`Vista 3D: ${msg}`));
    }
  }

  private readonly onWindowResize = (): void => {
    if (!this.canvasRef || !this.renderer || !this.camera) return;
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private animate = (): void => {
    if (!this.glRendering) return;
    this.animFrameId = requestAnimationFrame(this.animate);
    if (!this.renderer || !this.scene || !this.camera || !this.controls) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Create a procedural dental arch with 32 teeth in FDI positions.
   * Upper arch (16 teeth): quadrants 1 and 2 — arranged in a U opening toward -Z
   * Lower arch (16 teeth): quadrants 3 and 4 — arranged in a U opening toward +Z
   */
  private createDefaultArch(): void {
    this.clearArch();
    const archRadius = 8;

    // Gum base – upper
    this.createGum(archRadius, 2, 0xffa0a0);
    // Gum base – lower
    this.createGum(archRadius, -2, 0xff8888);

    for (let i = 0; i < 32; i++) {
      const code = FDI_CODES[i];
      const isUpper = i < 16;
      const indexInArch = isUpper ? i : i - 16;

      const angle = this.toothAngle(indexInArch, 16);
      const x = archRadius * Math.sin(angle);
      const z = archRadius * Math.cos(angle) * (isUpper ? -1 : 1);
      const y = isUpper ? 2 : -2;

      const isMolar = this.isMolar(code);
      const toothW = isMolar ? 1.2 : 0.8;
      const toothH = isMolar ? 1.8 : 2.2;
      const toothD = isMolar ? 1.2 : 0.7;

      const geometry = new THREE.BoxGeometry(toothW, toothH, toothD, 2, 2, 2);
      this.bevelGeometry(geometry, 0.12);

      const material = new THREE.MeshStandardMaterial({
        color: STATUS_COLORS['HEALTHY'],
        roughness: 0.3,
        metalness: 0.05,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.lookAt(0, y, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const label = this.createLabel(code);
      label.position.set(x, y + (isUpper ? 1.8 : -1.8), z);
      label.visible = this.showLabels();
      this.scene.add(label);

      this.toothMeshes.push({
        code,
        mesh,
        label,
        basePosition: mesh.position.clone(),
        baseRotation: mesh.rotation.clone(),
      });
    }
  }

  private toothAngle(index: number, total: number): number {
    const span = Math.PI * 0.85;
    const start = -span / 2;
    return start + (index / (total - 1)) * span;
  }

  private isMolar(code: string): boolean {
    const num = parseInt(code.charAt(1), 10);
    return num >= 6;
  }

  private bevelGeometry(geo: THREE.BoxGeometry, amount: number): void {
    const pos = geo.attributes['position'] as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const len = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
      if (len > 0) {
        const scale = 1 - amount * (1 - 1 / (1 + len * 0.5));
        v.multiplyScalar(scale);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
  }

  private createGum(radius: number, y: number, color: number): void {
    const shape = new THREE.Shape();
    const segments = 40;
    const span = Math.PI * 0.85;
    const start = -span / 2;

    for (let i = 0; i <= segments; i++) {
      const angle = start + (i / segments) * span;
      const x = radius * Math.sin(angle);
      const z = radius * Math.cos(angle) * (y >= 0 ? -1 : 1);
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    }

    for (let i = segments; i >= 0; i--) {
      const angle = start + (i / segments) * span;
      const innerR = radius - 2;
      const x = innerR * Math.sin(angle);
      const z = innerR * Math.cos(angle) * (y >= 0 ? -1 : 1);
      shape.lineTo(x, z);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 1.2,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.3,
      bevelSegments: 3,
    });

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.0,
      transparent: true,
      opacity: 0.6,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y - 0.6;
    this.scene.add(mesh);
    this.gumMesh = mesh;
  }

  private createLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 16);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85 });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 1, 1);
    return sprite;
  }

  private rebuildArch(state: Record<string, ToothTransform>): void {
    this.clearArch();
    const archRadius = 8;

    this.createGum(archRadius, 2, 0xffa0a0);
    this.createGum(archRadius, -2, 0xff8888);

    for (let i = 0; i < 32; i++) {
      const code = FDI_CODES[i];
      const isUpper = i < 16;
      const indexInArch = isUpper ? i : i - 16;
      const transform = state[code];

      const angle = this.toothAngle(indexInArch, 16);
      const baseX = archRadius * Math.sin(angle);
      const baseZ = archRadius * Math.cos(angle) * (isUpper ? -1 : 1);
      const baseY = isUpper ? 2 : -2;

      const x = baseX + (transform?.translationX ?? 0);
      const y = baseY + (transform?.translationY ?? 0);
      const z = baseZ + (transform?.translationZ ?? 0);

      const status = transform?.status ?? 'HEALTHY';
      const visible = transform?.visible ?? true;

      const isMolar = this.isMolar(code);
      const toothW = isMolar ? 1.2 : 0.8;
      const toothH = isMolar ? 1.8 : 2.2;
      const toothD = isMolar ? 1.2 : 0.7;

      const geometry = new THREE.BoxGeometry(toothW, toothH, toothD, 2, 2, 2);
      this.bevelGeometry(geometry, 0.12);

      const isExtracted = status === 'EXTRACTED';
      const isImplant = status === 'IMPLANT';
      const material = new THREE.MeshStandardMaterial({
        color: STATUS_COLORS[status] ?? STATUS_COLORS['HEALTHY'],
        roughness: isImplant ? 0.15 : 0.3,
        metalness: isImplant ? 0.8 : 0.05,
        wireframe: isExtracted,
        transparent: isExtracted || !visible,
        opacity: visible ? (isExtracted ? 0.3 : 1) : 0,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      if (transform) {
        mesh.rotation.set(transform.rotationX, transform.rotationY, transform.rotationZ);
      } else {
        mesh.lookAt(0, y, 0);
      }
      mesh.castShadow = true;
      this.scene.add(mesh);

      const label = this.createLabel(code);
      label.position.set(x, y + (isUpper ? 1.8 : -1.8), z);
      label.visible = this.showLabels();
      this.scene.add(label);

      this.toothMeshes.push({
        code,
        mesh,
        label,
        basePosition: new THREE.Vector3(baseX, baseY, baseZ),
        baseRotation: mesh.rotation.clone(),
      });
    }
  }

  private applyPhase(phase: SimulationPhase): void {
    for (const tm of this.toothMeshes) {
      const t = phase.toothStates?.[tm.code];
      if (!t) continue;

      const nx = tm.basePosition.x + t.translationX;
      const ny = tm.basePosition.y + t.translationY;
      const nz = tm.basePosition.z + t.translationZ;
      tm.mesh.position.set(nx, ny, nz);
      tm.mesh.rotation.set(t.rotationX, t.rotationY, t.rotationZ);

      const status = t.status ?? 'HEALTHY';
      const mat = tm.mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(STATUS_COLORS[status] ?? STATUS_COLORS['HEALTHY']);
      mat.wireframe = status === 'EXTRACTED';
      mat.metalness = status === 'IMPLANT' ? 0.8 : 0.05;
      mat.transparent = status === 'EXTRACTED' || !t.visible;
      mat.opacity = t.visible ? (status === 'EXTRACTED' ? 0.3 : 1) : 0;

      if (tm.label) {
        const isUpper = parseInt(tm.code.charAt(0), 10) <= 2;
        tm.label.position.set(nx, ny + (isUpper ? 1.8 : -1.8), nz);
      }
    }
  }

  private animatePhase(phaseIndex: number): void {
    const sim = this.activeSim();
    if (!sim || !sim.phases[phaseIndex]) return;
    this.applyPhase(sim.phases[phaseIndex]);
  }

  private clearArch(): void {
    if (!this.scene) return;
    for (const tm of this.toothMeshes) {
      this.scene.remove(tm.mesh);
      tm.mesh.geometry.dispose();
      (tm.mesh.material as THREE.Material).dispose();
      if (tm.label) {
        this.scene.remove(tm.label);
        (tm.label.material as THREE.SpriteMaterial).map?.dispose();
        tm.label.material.dispose();
      }
    }
    this.toothMeshes = [];
    if (this.gumMesh) {
      this.scene.remove(this.gumMesh);
      this.gumMesh.geometry.dispose();
      (this.gumMesh.material as THREE.Material).dispose();
      this.gumMesh = undefined;
    }
  }

  private disposeScene(): void {
    this.disposePhotoGlbMesh();
    this.clearArch();
    this.scene?.clear();
  }

  private loadSimulations(patientId: string): void {
    this.loadingList.set(true);
    this.simApi.getSimulations$(patientId).subscribe({
      next: (sims) => {
        this.simulations.set(sims);
        this.loadingList.set(false);
      },
      error: () => this.loadingList.set(false),
    });
  }
}

export const SIMULATION_ROUTES: Routes = [
  { path: '', component: SimulationPageComponent },
];
