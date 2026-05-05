/**
 * Core Logic for Orthodontic 3D Visualization and Interaction
 */

let scene, camera, renderer, controls;
let teethObjects = [];
let simulationTimeline = [];
let currentMonth = 0;
let showBrackets = true;

// Configuración inicial de Three.js
function init3D() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    // Asegurar que el contenedor sea visible
    if (container.clientWidth === 0) {
        container.style.width = '100vw';
        container.style.height = '100vh';
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Generación de geometría de diente (Template)
function createToothMesh(data) {
    const group = new THREE.Group();
    
    // Cuerpo del diente (Simulado con un cubo redondeado/esfera escalada)
    const geometry = new THREE.BoxGeometry(data.scale.x, data.scale.y, data.scale.z);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xffffff, 
        specular: 0x111111, 
        shininess: 100 
    });
    const toothBody = new THREE.Mesh(geometry, material);
    group.add(toothBody);

    // Bracket
    const bracketGeom = new THREE.BoxGeometry(data.scale.x * 0.4, data.scale.y * 0.3, 0.5);
    const bracketMat = new THREE.MeshPhongMaterial({ color: 0x888888, metalness: 0.9 });
    const bracket = new THREE.Mesh(bracketGeom, bracketMat);
    bracket.position.z = data.scale.z / 2 + 0.2;
    bracket.name = "bracket";
    group.add(bracket);

    group.position.set(data.pos_3d.x, data.pos_3d.y, data.pos_3d.z);
    group.userData = { id: data.id };
    
    return group;
}

// Llamadas a la API
async function reconstruct() {
    const fileInput = document.getElementById('imageInput');
    if (!fileInput.files[0]) return;

    const status = document.getElementById('statusMsg');
    status.innerText = "Procesando imagen con IA...";

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch('api/reconstruct', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        // Limpiar escena previa
        teethObjects.forEach(obj => scene.remove(obj));
        teethObjects = [];

        // Crear nuevas piezas 3D
        result.data.forEach(toothData => {
            const mesh = createToothMesh(toothData.reconstruction);
            mesh.userData.initial_data = toothData;
            scene.add(mesh);
            teethObjects.push(mesh);
        });

        status.innerText = "Modelo generado con éxito.";
        document.getElementById('simulationControls').style.display = 'block';
        
        // Preparar simulación por defecto (alineación básica)
        prepareDefaultSimulation();

    } catch (err) {
        status.innerText = "Error en reconstrucción: " + err.message;
    }
}

async function prepareDefaultSimulation() {
    const initial_state = teethObjects.map(obj => ({
        id: obj.userData.id,
        pos_3d: obj.position.clone(),
        rot_3d: obj.rotation.toVector3()
    }));

    // Definir objetivos de alineación (centrar dientes en el arco)
    const adjustments = teethObjects.map(obj => ({
        id: obj.userData.id,
        target_x: -obj.position.x * 0.2, // Corregir apiñamiento lateral
        target_y: 0,
        target_z: -obj.position.z * 0.5, // Corregir protrusión
        target_ry: -obj.rotation.y * 1.0 // Corregir rotación
    }));

    const response = await fetch('api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_state, adjustments, months: 12 })
    });
    const result = await response.json();
    simulationTimeline = result.timeline;
}

// Actualizar escena según timeline
document.getElementById('timeline').addEventListener('input', (e) => {
    const month = parseInt(e.target.value);
    document.getElementById('monthVal').innerText = month;
    
    if (simulationTimeline[month]) {
        const frame = simulationTimeline[month];
        frame.teeth.forEach(tData => {
            const mesh = teethObjects.find(obj => obj.userData.id === tData.id);
            if (mesh) {
                mesh.position.set(tData.position.x, tData.position.y, tData.position.z);
                mesh.rotation.set(tData.rotation.x, tData.rotation.y, tData.rotation.z);
            }
        });
    }
});

document.getElementById('reconstructBtn').addEventListener('click', reconstruct);

document.getElementById('compareBtn').addEventListener('click', () => {
    const timeline = document.getElementById('timeline');
    if (timeline.value == 0) {
        timeline.value = 12;
    } else {
        timeline.value = 0;
    }
    timeline.dispatchEvent(new Event('input'));
});

document.getElementById('toggleBrackets').addEventListener('click', () => {
    showBrackets = !showBrackets;
    teethObjects.forEach(obj => {
        const bracket = obj.children.find(c => c.name === "bracket");
        if (bracket) bracket.visible = showBrackets;
    });
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Inicializar
init3D();
