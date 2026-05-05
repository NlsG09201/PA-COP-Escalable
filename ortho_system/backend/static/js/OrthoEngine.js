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
        this.scene.background = new THREE.Color(0x121212);
        
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 15, 60);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Iluminación PBR (Physically Based Rendering)
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(10, 20, 15);
        directional.castShadow = true;
        this.scene.add(ambient, directional);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        window.addEventListener('resize', () => this.onResize());
        this._animate();
    }

    /**
     * Genera la malla dental con materiales PBR y brackets.
     */
    addTooth(data) {
        const group = new THREE.Group();
        
        // Geometría Anatómica (Esmalte)
        const toothGeom = new THREE.SphereGeometry(1, 32, 32);
        const toothMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            roughness: 0.1, 
            metalness: 0.05, 
            emissive: 0x222222, 
            emissiveIntensity: 0.1 
        });
        
        const tooth = new THREE.Mesh(toothGeom, toothMat);
        // Escala basada en dimensiones reales
        tooth.scale.set(data.dimensions.w/2, data.dimensions.h/2, data.dimensions.d/2);
        tooth.castShadow = true;
        group.add(tooth);

        // Bracket Metálico
        const bracketGroup = this._createBracket(data.dimensions.w);
        bracketGroup.position.z = (data.dimensions.d / 2) + 0.1;
        bracketGroup.name = "bracket";
        group.add(bracketGroup);

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
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    clear() {
        this.teeth.forEach(obj => this.scene.remove(obj));
        this.teeth.clear();
    }
}
