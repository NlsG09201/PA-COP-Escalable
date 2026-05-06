import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createWebGLRenderer } from '../../../core/three/create-webgl-renderer';

export type ToothStatus3d = 'HEALTHY' | 'CARIES' | 'RESTORATION' | 'EXTRACTION' | 'TREATMENT';

export interface ToothPose3d {
  rotX: number;
  rotY: number;
  rotZ: number;
  offsetMmX: number;
  offsetMmY: number;
  offsetMmZ: number;
  confidence?: number;
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
  private readonly proceduralRoot = new THREE.Group();
  private readonly glbRoot = new THREE.Group();
  private readonly toothGroups = new Map<string, THREE.Group>();
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;
  private renderingEnabled = true;
  private readonly onContextLost = (ev: Event): void => {
    ev.preventDefault();
    this.renderingEnabled = false;
    cancelAnimationFrame(this.raf);
  };
  private readonly onContextRestored = (): void => {
    this.renderingEnabled = true;
    this.resize();
    this.animateLoop();
  };
  private keyframes: SimulationKeyframe3d[] = [];
  private simulationT = 0;
  private glbLoadToken = 0;
  private wireframeOverlay: THREE.Object3D | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createWebGLRenderer({ canvas });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    this.camera.position.set(0, 18, 48);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 4, 0);

    this.scene.background = new THREE.Color(0xf8fafc);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(20, 40, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    this.scene.add(dir);

    const fill = new THREE.PointLight(0x93c5fd, 0.35, 200, 2);
    fill.position.set(-25, 22, 0);
    this.scene.add(fill);

    const grid = new THREE.GridHelper(80, 40, 0xdee2e6, 0xe9ecef);
    grid.position.y = -6;
    this.scene.add(grid);

    this.root.position.set(0, 0, 0);
    this.scene.add(this.root);
    this.root.add(this.proceduralRoot);
    this.root.add(this.glbRoot);
    this.glbRoot.visible = false;

    this.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
    this.animateLoop();

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
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.disposeTeethMeshes();
    this.clearGlb();
    this.renderer.dispose();
  }

  private animateLoop(): void {
    if (!this.renderingEnabled) return;
    this.raf = requestAnimationFrame(() => this.animateLoop());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
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
      this.proceduralRoot.remove(g);
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
    this.proceduralRoot.add(g);
    this.toothGroups.set(fdi, g);
  }

  private applyPosesFromSimulation(): void {
    const pose = this.interpolatePoses(this.simulationT);
    const opacityFromConfidence = (c: number) =>
      THREE.MathUtils.clamp(0.26 + 0.74 * ((c - 0.22) / 0.63), 0.18, 1);

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

      let opacity = 1;
      let transparent = false;
      if (p && typeof p.confidence === 'number' && !Number.isNaN(p.confidence)) {
        opacity = opacityFromConfidence(p.confidence);
        transparent = opacity < 0.995;
      }
      g.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material.transparent = transparent;
          obj.material.opacity = opacity;
          obj.material.depthWrite = opacity > 0.92;
        }
      });
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
      const next: ToothPose3d = {
        rotX: THREE.MathUtils.lerp(A.rotX, B.rotX, k),
        rotY: THREE.MathUtils.lerp(A.rotY, B.rotY, k),
        rotZ: THREE.MathUtils.lerp(A.rotZ, B.rotZ, k),
        offsetMmX: THREE.MathUtils.lerp(A.offsetMmX, B.offsetMmX, k),
        offsetMmY: THREE.MathUtils.lerp(A.offsetMmY, B.offsetMmY, k),
        offsetMmZ: THREE.MathUtils.lerp(A.offsetMmZ, B.offsetMmZ, k)
      };
      const ac = A.confidence;
      const bc = B.confidence;
      if (ac != null || bc != null) {
        const av = ac ?? bc!;
        const bv = bc ?? ac!;
        next.confidence = THREE.MathUtils.lerp(av, bv, k);
      }
      out[fdi] = next;
    }
    return out;
  }

  private zeroPose(): ToothPose3d {
    return { rotX: 0, rotY: 0, rotZ: 0, offsetMmX: 0, offsetMmY: 0, offsetMmZ: 0 };
  }

  clearGlb(): void {
    this.glbRoot.visible = false;
    this.proceduralRoot.visible = true;

    if (this.wireframeOverlay) {
      this.glbRoot.remove(this.wireframeOverlay);
      this.disposeObject3D(this.wireframeOverlay);
      this.wireframeOverlay = null;
    }

    const children = [...this.glbRoot.children];
    for (const child of children) {
      this.glbRoot.remove(child);
      this.disposeObject3D(child);
    }
  }

  /**
   * Loads a GLB/GLTF model and normalizes it to the scene coordinate system:
   * - auto-orient (heuristic)
   * - center at origin
   * - scale to a consistent max dimension
   * - align to a base Y (so it sits above the grid)
   * - fit camera/orbit target
   */
  async loadGlb(
    glbUrl: string,
    opts?: {
      onProgress?: (percent: number) => void;
      /** Manual Bearer (legacy); prefer fetchBinary desde HttpClient si el interceptor renueva JWT. */
      authToken?: string | null;
      /** Carga binaria (p. ej. HttpClient + jwtInterceptor); evita fetch() bloqueado por CORP/CORS edge cases. */
      fetchBinary?: () => Promise<ArrayBuffer>;
    }
  ): Promise<void> {
    const token = ++this.glbLoadToken;
    // Keep procedural fallback visible while loading.
    this.proceduralRoot.visible = true;
    this.glbRoot.visible = false;
    this.clearGlb();

    const onProgress = opts?.onProgress;
    const authToken = opts?.authToken;
    const fetchBinary = opts?.fetchBinary;

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
      if (!itemsTotal) return;
      const pct = Math.max(0, Math.min(100, (itemsLoaded / itemsTotal) * 100));
      onProgress?.(pct);
    };
    manager.onLoad = () => onProgress?.(100);

    const loader = new GLTFLoader(manager);
    loader.setCrossOrigin('anonymous');

    const parseArrayBuffer = (buf: ArrayBuffer) =>
      new Promise((resolve, reject) => {
        loader.parse(
          buf,
          '',
          (data) => resolve(data),
          (err) => reject(err ?? new Error('GLTF parse failed'))
        );
      });

    const gltf: any = await (async () => {
      if (fetchBinary) {
        onProgress?.(12);
        const buf = await fetchBinary();
        onProgress?.(88);
        return await parseArrayBuffer(buf);
      }
      if (authToken) {
        onProgress?.(8);
        const res = await fetch(glbUrl, {
          headers: { Authorization: `Bearer ${authToken}` },
          mode: 'cors',
          credentials: 'omit'
        });
        if (!res.ok) {
          throw new Error(`GLB ${res.status}`);
        }
        const buf = await res.arrayBuffer();
        onProgress?.(85);
        return await parseArrayBuffer(buf);
      }

      return await new Promise((resolve, reject) => {
        loader.load(
          glbUrl,
          (data) => resolve(data),
          undefined,
          (err) => reject(err)
        );
      });
    })();

    const model: THREE.Object3D | undefined = gltf?.scene ?? gltf?.scenes?.[0];
    if (!model) throw new Error('GLB loaded but no scene found');
    if (token !== this.glbLoadToken) {
      // A newer load was started; dispose what we just loaded and do not mutate the scene.
      this.disposeObject3D(model);
      return;
    }

    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = true;
      obj.receiveShadow = true;

      const assignMaterial = (current: THREE.Material): THREE.Material => {
        const anyMat = current as any;
        // Keep standard/physical materials, but fix texture color spaces for correct PBR.
        if (anyMat?.isMeshStandardMaterial || anyMat?.isMeshPhysicalMaterial) {
          if (anyMat.map?.isTexture) anyMat.map.colorSpace = THREE.SRGBColorSpace;
          if (anyMat.emissiveMap?.isTexture) anyMat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          // Clamp extreme values to keep the look stable across sources.
          if (typeof anyMat.metalness === 'number') anyMat.metalness = Math.min(0.6, Math.max(0, anyMat.metalness));
          if (typeof anyMat.roughness === 'number') anyMat.roughness = Math.min(1, Math.max(0.02, anyMat.roughness));
          return current;
        }

        // Convert common legacy materials to MeshStandardMaterial for consistent lighting.
        if (anyMat?.isMeshPhongMaterial) {
          const phong = anyMat as THREE.MeshPhongMaterial;
          const std = new THREE.MeshStandardMaterial({
            color: phong.color,
            map: phong.map ?? undefined,
            normalMap: phong.normalMap ?? undefined,
            roughnessMap: phong.specularMap ?? undefined,
            emissive: (phong as any).emissive ?? new THREE.Color(0x000000),
            metalness: 0.05,
            roughness: 0.55
          });
          if (std.map?.isTexture) std.map.colorSpace = THREE.SRGBColorSpace;
          return std;
        }

        return current;
      };

      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(assignMaterial);
      } else {
        obj.material = assignMaterial(obj.material);
      }
    });

    // Make it look like the reference: light-gray surface + black wireframe overlay,
    // and (when safe) Subdivision level 1 for smoother quads-like appearance.
    this.applyWireframeSubdivisionLook(model);

    // Put it under glbRoot for deterministic transforms & disposal.
    this.glbRoot.add(model);
    this.normalizeAndFitModel(model);
    this.glbRoot.visible = true;
    this.proceduralRoot.visible = false;
  }

  private applyWireframeSubdivisionLook(model: THREE.Object3D): void {
    // Force a neutral light-gray surface material (so wireframe stands out).
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xe9ecef,
        roughness: 0.65,
        metalness: 0.02,
      });
      obj.material = mat;
    });

    // Create a wireframe overlay group (black lines).
    const overlay = new THREE.Group();
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const geo = obj.geometry;
      if (!geo) return;
      const wf = new THREE.WireframeGeometry(geo);
      const lines = new THREE.LineSegments(
        wf,
        new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 }),
      );
      lines.renderOrder = 999;
      lines.position.copy(obj.position);
      lines.quaternion.copy(obj.quaternion);
      lines.scale.copy(obj.scale);
      overlay.add(lines);
    });

    // Replace any previous overlay
    if (this.wireframeOverlay) {
      this.glbRoot.remove(this.wireframeOverlay);
      this.disposeObject3D(this.wireframeOverlay);
    }
    this.wireframeOverlay = overlay;
    this.glbRoot.add(overlay);
  }

  private normalizeAndFitModel(model: THREE.Object3D): void {
    // Heuristic: if model's Y dimension is tiny compared to X/Z, it may be Z-up.
    const bbox0 = new THREE.Box3().setFromObject(model);
    const size0 = bbox0.getSize(new THREE.Vector3());
    const likelyZUp = size0.y < size0.x * 0.25 && size0.y < size0.z * 0.25;
    if (likelyZUp) model.rotateX(-Math.PI / 2);

    // Compute bbox after orientation correction.
    const bbox1 = new THREE.Box3().setFromObject(model);
    const center1 = bbox1.getCenter(new THREE.Vector3());
    model.position.sub(center1);

    const bbox2 = new THREE.Box3().setFromObject(model);
    const size2 = bbox2.getSize(new THREE.Vector3());
    const maxDim = Math.max(size2.x, size2.y, size2.z);
    const targetMaxDim = 44; // consistent with the procedural arch radius.
    if (maxDim > 1e-6) {
      const scale = targetMaxDim / maxDim;
      model.scale.multiplyScalar(scale);
    }

    const bbox3 = new THREE.Box3().setFromObject(model);
    const baseMinY = -6; // sits nicely above the grid plane.
    model.position.y += baseMinY - bbox3.min.y;

    const finalBbox = new THREE.Box3().setFromObject(model);
    this.fitCameraToBox(finalBbox);
  }

  private fitCameraToBox(bbox: THREE.Box3): void {
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim <= 1e-6) return;

    const center = bbox.getCenter(new THREE.Vector3());
    this.controls.target.copy(center);

    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (maxDim / 2) / Math.tan(fovRad / 2);

    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const pad = 1.35;
    this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(distance * pad));

    // Update clipping planes for the new model scale.
    this.camera.near = Math.max(0.01, distance / 1000);
    this.camera.far = Math.max(200, distance * 50);
    this.camera.updateProjectionMatrix();
  }

  private disposeObject3D(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material?.dispose();
      } else if (child instanceof THREE.LineSegments) {
        (child.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
        const mat = child.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      }
    });
  }
}
