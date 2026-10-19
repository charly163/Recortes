import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function mimeFor(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

export function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function text(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export async function readJson(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'El cuerpo del pedido es demasiado grande.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON inválido.');
  }
}

export function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

export function withSecurityHeaders(headers = {}) {
  return { ...SECURITY_HEADERS, ...headers };
}

/**
 * Sirve un archivo dentro de `root`. Evita path traversal por construcción.
 * Devuelve true si respondió.
 */
export async function serveStatic(req, res, root, pathname, opts = {}) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'Ruta inválida.');
  }
  if (decoded.includes('\0')) throw new HttpError(400, 'Ruta inválida.');

  let rel = decoded.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';

  const filePath = path.resolve(root, rel);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (filePath !== root && !filePath.startsWith(rootWithSep)) {
    throw new HttpError(403, 'Acceso denegado.');
  }

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return false;
  }
  if (info.isDirectory()) return false;

  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, withSecurityHeaders({ ETag: etag }));
    res.end();
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();
  const immutable = ['.woff2', '.woff', '.png', '.svg', '.ico'].includes(ext) && !pathname.includes('__dev');
  const cacheControl = opts.cacheControl || (immutable ? 'public, max-age=604800' : 'no-cache');

  const headers = withSecurityHeaders({
    'Content-Type': mimeFor(filePath),
    'Content-Length': info.size,
    'Cache-Control': cacheControl,
    ETag: etag,
    'Last-Modified': new Date(info.mtimeMs).toUTCString(),
  });
  if (pathname === '/sw.js') headers['Service-Worker-Allowed'] = '/';

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(filePath).pipe(res);
  return true;
}

export function sendFile(req, res, filePath, { contentType, cacheControl = 'public, max-age=31536000, immutable' } = {}) {
  return stat(filePath).then((info) => {
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, withSecurityHeaders({ ETag: etag }));
      res.end();
      return true;
    }
    const headers = withSecurityHeaders({
      'Content-Type': contentType || mimeFor(filePath),
      'Content-Length': info.size,
      'Cache-Control': cacheControl,
      ETag: etag,
    });
    res.writeHead(200, headers);
    createReadStream(filePath).pipe(res);
    return true;
  });
}
