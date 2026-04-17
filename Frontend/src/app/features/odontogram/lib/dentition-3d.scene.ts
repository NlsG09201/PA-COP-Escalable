import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ToothStatus3d = 'HEALTHY' | 'CARIES' | 'RESTORATION' | 'EXTRACTION' | 'TREATMENT';

export interface ToothPose3d {
  rotX: number;
  rotY: number;
  rotZ: number;
  offsetMmX: number;
  offsetMmY: number;
  offsetMmZ: number;
}

export interface ToothSceneState {
  fdi: string;
  status: ToothStatus3d;
  braces: boolean;
  /** Optional simulated pose (radians / mm) layered on arch layout */
  pose?: ToothPose3d;
}

export interface SimulationKeyframe3d {
  t: number;
  poses: Record<string, ToothPose3d>;
}

const STATUS_COLOR: Record<ToothStatus3d, number> = {
  HEALTHY: 0xf5f5f5,
  CARIES: 0xf08080,
  RESTORATION: 0x4dabf7,
  EXTRACTION: 0xffd43b,
  TREATMENT: 0x63e6be
};

/**
 * Owns a Three.js scene for interactive dentition visualization and orthodontic interpolation.
 */
export class Dentition3dScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly root = new THREE.Group();
  private readonly toothGroups = new Map<string, THREE.Group>();
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;
  private keyframes: SimulationKeyframe3d[] = [];
  private simulationT = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    this.camera.position.set(0, 18, 48);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 4, 0);

    this.scene.background = new THREE.Color(0xf8fafc);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(20, 40, 20);
    this.scene.add(dir);

    const grid = new THREE.GridHelper(80, 40, 0xdee2e6, 0xe9ecef);
    grid.position.y = -6;
    this.scene.add(grid);

    this.root.position.set(0, 0, 0);
    this.scene.add(this.root);

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
    this.resize();
  }

  setKeyframes(kfs: SimulationKeyframe3d[]): void {
    this.keyframes = [...kfs].sort((a, b) => a.t - b.t);
  }

  setSimulationT(t: number): void {
    this.simulationT = THREE.MathUtils.clamp(t, 0, 1);
    this.applyPosesFromSimulation();
  }

  buildArch(teeth: ToothSceneState[]): void {
    this.disposeTeethMeshes();
    const upper = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
    const lower = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
    const byFdi = new Map(teeth.map((t) => [t.fdi, t]));
    upper.forEach((fdi, i) => this.addToothMesh(fdi, byFdi.get(fdi), i, 'upper'));
    lower.forEach((fdi, i) => this.addToothMesh(fdi, byFdi.get(fdi), i, 'lower'));
    this.applyPosesFromSimulation();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.disposeTeethMeshes();
    this.renderer.dispose();
  }

  private resize(): void {
    const w = this.canvas.clientWidth || 640;
    const h = this.canvas.clientHeight || 360;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  }

  private disposeTeethMeshes(): void {
    for (const g of this.toothGroups.values()) {
      this.root.remove(g);
      g.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    this.toothGroups.clear();
  }

  private addToothMesh(fdi: string, state: ToothSceneState | undefined, index: number, row: 'upper' | 'lower'): void {
    const g = new THREE.Group();
    const status = state?.status ?? 'HEALTHY';
    const geo = new THREE.BoxGeometry(2.2, 3.2, 2.6);
    const mat = new THREE.MeshStandardMaterial({
      color: STATUS_COLOR[status],
      metalness: 0.08,
      roughness: 0.45
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    g.add(mesh);

    if (state?.braces) {
      const wire = new THREE.Mesh(
        new THREE.TorusGeometry(1.35, 0.06, 8, 24, Math.PI * 1.1),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.6, roughness: 0.25 })
      );
      wire.rotation.x = Math.PI / 2;
      wire.position.set(0, 0.2, 1.45);
      g.add(wire);
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.45, 0.25),
        new THREE.MeshStandardMaterial({ color: 0xe9ecef, metalness: 0.5, roughness: 0.3 })
      );
      bracket.position.set(0, -0.4, 1.45);
      g.add(bracket);
    }

    const arc = (i: number, total: number) => {
      const mid = (total - 1) / 2;
      const u = (i - mid) / mid;
      const angle = u * 0.95;
      const radius = row === 'upper' ? 22 : 22;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius * (row === 'upper' ? 1 : -1);
      return new THREE.Vector3(x, row === 'upper' ? 8 : -2, z);
    };

    const pos = arc(index, 16);
    g.position.copy(pos);
    g.lookAt(new THREE.Vector3(0, row === 'upper' ? 2 : -4, 0));
    g.userData['baseQuat'] = g.quaternion.clone();
    g.userData['basePos'] = g.position.clone();
    this.root.add(g);
    this.toothGroups.set(fdi, g);
  }

  private applyPosesFromSimulation(): void {
    const pose = this.interpolatePoses(this.simulationT);
    for (const [fdi, g] of this.toothGroups) {
      const baseQ = g.userData['baseQuat'] as THREE.Quaternion | undefined;
      const baseP = g.userData['basePos'] as THREE.Vector3 | undefined;
      if (!baseQ || !baseP) continue;
      const p = pose[fdi];
      g.position.copy(baseP);
      g.quaternion.copy(baseQ);
      if (p) {
        g.position.add(new THREE.Vector3(p.offsetMmX * 0.1, p.offsetMmY * 0.1, p.offsetMmZ * 0.1));
        const e = new THREE.Euler(p.rotX, p.rotY, p.rotZ, 'XYZ');
        g.quaternion.multiply(new THREE.Quaternion().setFromEuler(e));
      }
    }
  }

  private interpolatePoses(t: number): Record<string, ToothPose3d> {
    if (this.keyframes.length === 0) return {};
    if (t <= this.keyframes[0].t) return this.keyframes[0].poses;
    const last = this.keyframes[this.keyframes.length - 1];
    if (t >= last.t) return last.poses;
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      const a = this.keyframes[i];
      const b = this.keyframes[i + 1];
      if (t >= a.t && t <= b.t) {
        const span = Math.max(1e-6, b.t - a.t);
        const k = (t - a.t) / span;
        return this.mergePosesLerp(a.poses, b.poses, k);
      }
    }
    return last.poses;
  }

  private mergePosesLerp(
    from: Record<string, ToothPose3d>,
    to: Record<string, ToothPose3d>,
    k: number
  ): Record<string, ToothPose3d> {
    const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
    const out: Record<string, ToothPose3d> = {};
    for (const fdi of keys) {
      const A = from[fdi] ?? this.zeroPose();
      const B = to[fdi] ?? this.zeroPose();
      out[fdi] = {
        rotX: THREE.MathUtils.lerp(A.rotX, B.rotX, k),
        rotY: THREE.MathUtils.lerp(A.rotY, B.rotY, k),
        rotZ: THREE.MathUtils.lerp(A.rotZ, B.rotZ, k),
        offsetMmX: THREE.MathUtils.lerp(A.offsetMmX, B.offsetMmX, k),
        offsetMmY: THREE.MathUtils.lerp(A.offsetMmY, B.offsetMmY, k),
        offsetMmZ: THREE.MathUtils.lerp(A.offsetMmZ, B.offsetMmZ, k)
      };
    }
    return out;
  }

  private zeroPose(): ToothPose3d {
    return { rotX: 0, rotY: 0, rotZ: 0, offsetMmX: 0, offsetMmY: 0, offsetMmZ: 0 };
  }
}
