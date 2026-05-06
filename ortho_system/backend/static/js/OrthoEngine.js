/** 
 * [MÓDULO MOTOR 3D FRONTEND - THREE.JS]
 * Responsabilidad: Renderizado avanzado, timeline interactivo y simulación de brackets.
 */

class OrthoEngine {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error(`Container ${containerId} not found`);
        
        this.scene = new THREE.Scene();
        this.teeth = new Map(); // FDI/ID -> THREE.Group
        this.timeline = [];
        this.currentMonth = 0;
        this._initScene();
    }

    _initScene() {
        // Look close to the reference: light background with dark wire overlay.
        this.scene.background = new THREE.Color(0xffffff);
        
        const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 15, 60);

        const rendererOpts = [
            { antialias: true, logarithmicDepthBuffer: true, failIfMajorPerformanceCaveat: false, powerPreference: 'default' },
            { antialias: false, logarithmicDepthBuffer: false, failIfMajorPerformanceCaveat: false, powerPreference: 'low-power' },
            { antialias: false, failIfMajorPerformanceCaveat: false }
        ];
        let lastErr;
        for (const opts of rendererOpts) {
            try {
                this.renderer = new THREE.WebGLRenderer(opts);
                break;
            } catch (e) {
                lastErr = e;
                this.renderer = null;
            }
        }
        if (!this.renderer) {
            console.error('WebGL no disponible:', lastErr);
            this.container.innerHTML = '<p style="padding:1rem;color:#c92a2a;font-family:sans-serif;">WebGL no disponible. Active la aceleración por hardware en el navegador o use un equipo sin restricciones RDP/sandbox.</p>';
            return;
        }
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0xffffff, 1);
        this.container.appendChild(this.renderer.domElement);

        // Iluminación suave tipo “studio” (similar al wireframe de referencia)
        const ambient = new THREE.AmbientLight(0xffffff, 0.85);
        const key = new THREE.DirectionalLight(0xffffff, 0.65);
        key.position.set(18, 30, 18);
        key.castShadow = true;
        const fill = new THREE.DirectionalLight(0xffffff, 0.25);
        fill.position.set(-18, 16, -10);
        this.scene.add(ambient, key, fill);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        window.addEventListener('resize', () => this.onResize());
        this._animate();

        // Base gum/arch to look more like an actual jaw mesh.
        this._ensureGumBase();
    }

    _ensureGumBase() {
        if (this.gumBase) return;
        const geo = new THREE.TorusGeometry(18, 4.2, 24, 90, Math.PI * 1.25);
        geo.rotateX(Math.PI / 2);
        geo.rotateZ(Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.7, metalness: 0.02 });
        const gum = new THREE.Mesh(geo, mat);
        gum.position.set(0, -6, 0);
        gum.castShadow = false;
        gum.receiveShadow = true;
        this.scene.add(gum);

        // Wire overlay for gum base
        const wf = new THREE.LineSegments(
            new THREE.WireframeGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 })
        );
        wf.position.copy(gum.position);
        wf.rotation.copy(gum.rotation);
        wf.scale.copy(gum.scale);
        this.scene.add(wf);
        this.gumBase = gum;
        this.gumWire = wf;
    }

    /**
     * Genera la malla dental con materiales PBR y brackets.
     */
    addTooth(data) {
        const group = new THREE.Group();

        // “Tooth-like” geometry: capsule-ish (r128 has no THREE.CapsuleGeometry).
        const w = Math.max(0.8, (data.dimensions?.w ?? 2) / 2);
        const h = Math.max(1.2, (data.dimensions?.h ?? 3) / 2);
        const d = Math.max(0.8, (data.dimensions?.d ?? 2) / 2);
        const toothMat = new THREE.MeshStandardMaterial({
            color: 0xe9ecef,
            roughness: 0.65,
            metalness: 0.02,
        });

        // Build a capsule-like tooth from primitives so it works on three r128.
        const radius = 0.9;
        const bodyLen = 1.6;
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, bodyLen, 20, 1), toothMat);
        cyl.castShadow = true;
        cyl.receiveShadow = true;
        const top = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), toothMat);
        top.position.y = bodyLen / 2;
        top.castShadow = true;
        top.receiveShadow = true;
        const bottom = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.98, 20, 16), toothMat);
        bottom.position.y = -bodyLen / 2;
        bottom.castShadow = true;
        bottom.receiveShadow = true;

        const toothParts = new THREE.Group();
        toothParts.add(cyl, top, bottom);
        toothParts.scale.set(w, h, d);
        group.add(toothParts);

        // Wireframe overlay like the reference image
        const wfMat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 });
        toothParts.traverse((obj) => {
            if (!obj.isMesh) return;
            const wf = new THREE.LineSegments(new THREE.WireframeGeometry(obj.geometry), wfMat);
            wf.renderOrder = 999;
            wf.position.copy(obj.position);
            wf.rotation.copy(obj.rotation);
            wf.scale.copy(obj.scale);
            toothParts.add(wf);
        });

        // Posición y Rotación inicial
        group.position.set(data.pos_3d.x, data.pos_3d.y, data.pos_3d.z);
        group.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
        
        this.teeth.set(data.id, group);
        this.scene.add(group);
        return group;
    }

    _createBracket(toothWidth) {
        const group = new THREE.Group();
        const geometry = new THREE.BoxGeometry(toothWidth * 0.4, toothWidth * 0.3, 0.3);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xaaaaaa, 
            metalness: 1.0, 
            roughness: 0.1 
        });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        
        // Ranura para el arco
        const slotGeo = new THREE.BoxGeometry(toothWidth * 0.5, 0.1, 0.1);
        const slotMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.position.z = 0.15;
        group.add(slot);
        
        return group;
    }

    /**
     * Actualiza la posición de las piezas basada en el timeline.
     */
    setTimelineFrame(month, timeline) {
        if (!timeline || !timeline[month]) return;
        const frame = timeline[month];
        
        frame.teeth.forEach(t => {
            const mesh = this.teeth.get(t.id);
            if (mesh) {
                // Interpolación suave usando GSAP si está disponible, sino directa
                if (window.gsap) {
                    gsap.to(mesh.position, { x: t.position.x, y: t.position.y, z: t.position.z, duration: 0.4 });
                    gsap.to(mesh.rotation, { x: t.rotation.x, y: t.rotation.y, z: t.rotation.z, duration: 0.4 });
                } else {
                    mesh.position.set(t.position.x, t.position.y, t.position.z);
                    mesh.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
                }
            }
        });
        this.currentMonth = month;
    }

    onResize() {
        if (!this.renderer || !this.camera) return;
        this.camera.aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        if (!this.renderer || !this.scene || !this.camera) return;
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    clear() {
        this.teeth.forEach(obj => this.scene.remove(obj));
        this.teeth.clear();
    }
}
