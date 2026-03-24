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
import { Routes } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
                  <i class="bi bi-plus-circle me-1"></i> Nueva Simulacion
                  Implante
                </button>
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
                @if (activeSim() && activeSim()!.phases.length > 0) {
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
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly store = inject(Store);
  private readonly simApi = inject(SimulationApiService);
  private readonly zone = inject(NgZone);
  private sub?: Subscription;
  private animFrameId = 0;

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

  protected readonly currentPhaseName = () => {
    const sim = this.activeSim();
    const phase = this.currentPhase();
    if (!sim || !sim.phases[phase]) return '';
    return sim.phases[phase].name;
  };

  ngOnInit(): void {
    this.sub = this.store.select(selectSelectedPatientId).subscribe((id) => {
      this.patientId.set(id);
      if (id) this.loadSimulations(id);
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initThreeJs());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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
    this.activeSim.set(sim);
    this.currentPhase.set(0);
    this.rebuildArch(sim.initialState);
    if (sim.phases.length > 0) {
      this.applyPhase(sim.phases[0]);
    }
  }

  protected onPhaseChange(value: number): void {
    this.currentPhase.set(value);
    const sim = this.activeSim();
    if (!sim) return;
    this.animatePhase(value);
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
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    this.animate();
  }

  private readonly onWindowResize = (): void => {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
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
