import * as THREE from 'three';

type CanvasOpts = { canvas: HTMLCanvasElement };

/**
 * Crea WebGLRenderer con varios perfiles: RDP/VM y "major performance caveat" a veces bloquean el primer intento.
 */
export function createWebGLRenderer(opts: CanvasOpts): THREE.WebGLRenderer {
  const attempts: THREE.WebGLRendererParameters[] = [
    { ...opts, antialias: true, alpha: true, failIfMajorPerformanceCaveat: false, powerPreference: 'default' },
    { ...opts, antialias: false, alpha: true, failIfMajorPerformanceCaveat: false, powerPreference: 'low-power' },
    { ...opts, antialias: false, alpha: true, failIfMajorPerformanceCaveat: false }
  ];

  let lastErr: unknown;
  for (const params of attempts) {
    try {
      return new THREE.WebGLRenderer(params);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(
        'No se pudo crear el contexto WebGL. Revise aceleración hardware en el navegador, evite RDP sin GPU, o use otro navegador.'
      );
}
