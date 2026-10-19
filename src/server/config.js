import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.NETLIFY ? process.cwd() : path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

export const CONFIG = {
  root: ROOT,
  staticDir: path.join(ROOT, 'static'),
  dataDir: process.env.RECORTES_DATA
    ? path.resolve(process.env.RECORTES_DATA)
    : path.join(ROOT, 'data'),
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 4317),
  // AutenticaciÃ³n bÃ¡sica opcional (recomendada si la app se expone fuera de la LAN).
  authUser: process.env.RECORTES_USER || '',
  authPass: process.env.RECORTES_PASS || '',
  // Permite guardar links hacia la red local (ej. un servicio propio). Apagado por defecto.
  allowPrivateHosts: process.env.RECORTES_ALLOW_PRIVATE === '1',
  version: '1.0.0',
  limits: {
    htmlBytes: 2_000_000,
    imageBytes: 8_000_000,
    jsonBytes: 1_000_000,
    previewTimeoutMs: 12_000,
    maxRedirects: 4,
  },
};

export const PATHS = {
  store: path.join(CONFIG.dataDir, 'store.json'),
  thumbs: path.join(CONFIG.dataDir, 'thumbs'),
  tmp: path.join(CONFIG.dataDir, 'tmp'),
};

export function lanUrls(port) {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) out.push({ name, url: `http://${net.address}:${port}` });
    }
  }
  return out;
}
