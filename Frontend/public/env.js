// En local (`ng serve`) no se fuerza valor: `api.config` usa por defecto http://localhost:8080.
// La imagen Docker sobrescribe este archivo con `window.__env = { API_BASE_URL: '' };` para
// usar el proxy de nginx (/api → gateway) mismo origen :5173.
window.__env = window.__env || {};
