import { HttpHeaders } from '@angular/common/http';

/** Evita el overlay global; la vista muestra su propio estado de carga. */
export const SKIP_GLOBAL_LOADER = { headers: new HttpHeaders({ 'X-Skip-Loader': '1' }) };
