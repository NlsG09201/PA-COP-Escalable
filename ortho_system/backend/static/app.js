/**
 * UI Controller for Orthodontic 3D Simulation
 */

let engine;
let currentSimulationTimeline = [];

document.addEventListener('DOMContentLoaded', () => {
    try {
        engine = new OrthoEngine('canvas-container');
    } catch (e) {
        console.error("Failed to initialize OrthoEngine:", e);
    }
});

async function reconstruct() {
    const fileInput = document.getElementById('imageInput');
    if (!fileInput.files[0]) return;

    const status = document.getElementById('statusMsg');
    status.innerText = "Procesando imagen con IA...";
    status.className = "loading";

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const response = await fetch('api/reconstruct', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.status === "success" && result.data.length > 0) {
            engine.clear();

            // Crear nuevas piezas 3D usando el motor
            result.data.forEach(toothData => {
                engine.addTooth(toothData);
            });

            status.innerText = `Modelo generado con éxito (${result.data.length} piezas detectadas).`;
            status.className = "text-success";
            document.getElementById('simulationControls').style.display = 'block';
            
            // Preparar simulación por defecto
            await prepareDefaultSimulation();
            
            // Resetear slider
            const slider = document.getElementById('timeline');
            slider.value = 0;
            document.getElementById('monthVal').innerText = "0";
        } else {
            status.innerText = "No se detectaron piezas claras. Intente con otra imagen.";
            status.className = "text-warning";
        }

    } catch (err) {
        status.innerText = "Error: " + err.message;
        status.className = "text-danger";
    }
}

async function prepareDefaultSimulation() {
    // Extraer estado inicial del motor
    const initial_state = {};
    engine.teeth.forEach((group, id) => {
        initial_state[id] = {
            pos_3d: { x: group.position.x, y: group.position.y, z: group.position.z },
            rot_3d: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z }
        };
    });

    // Definir objetivos (Alineación ideal)
    const adjustments = Object.keys(initial_state).map(id => ({
        id: id,
        target_x: 0,
        target_y: 0,
        target_z: -initial_state[id].pos_3d.z + 5.0, // Aplanar hacia el arco
        target_rx: 0,
        target_ry: -initial_state[id].rot_3d.y, // Corregir rotación
        target_rz: 0
    }));

    try {
        const response = await fetch('api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initial_state, adjustments, months: 18 })
        });
        
        const result = await response.json();
        currentSimulationTimeline = result.timeline;
    } catch (err) {
        console.error("Error preparing simulation:", err);
    }
}

// Event Listeners
document.getElementById('timeline').addEventListener('input', (e) => {
    const month = parseInt(e.target.value);
    document.getElementById('monthVal').innerText = month;
    engine.setTimelineFrame(month, currentSimulationTimeline);
});

document.getElementById('reconstructBtn').addEventListener('click', reconstruct);

document.getElementById('compareBtn').addEventListener('click', () => {
    const slider = document.getElementById('timeline');
    slider.value = slider.value == 0 ? 18 : 0;
    slider.dispatchEvent(new Event('input'));
});
