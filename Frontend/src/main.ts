import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/** Tras un deploy en Vercel, chunks viejos fallan; recarga una vez. */
const CHUNK_RELOAD_KEY = 'cop-chunk-reload-v1';
window.addEventListener('unhandledrejection', (event) => {
  const msg = String((event.reason as Error)?.message ?? event.reason ?? '');
  if (
    !msg.includes('Failed to fetch dynamically imported module') &&
    !msg.includes('Loading chunk') &&
    !msg.includes('MIME type')
  ) {
    return;
  }
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
