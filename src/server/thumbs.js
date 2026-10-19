import { randomBytes } from 'node:crypto';
import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG, PATHS } from './config.js';
import { safeFetch, readLimited } from './preview.js';

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

const TOKEN_RE = /^[a-f0-9]{16,40}$/;
const ID_RE = /^[a-zA-Z0-9-]{6,64}$/;

/** Detecta el formato real por los primeros bytes (evita guardar HTML disfrazado de imagen). */
function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  const head6 = buf.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return 'avif';
  }
  return null;
}

/**
 * Descarga una imagen con los mismos controles que las páginas (anti-SSRF, tamaño, tiempo).
 * Devuelve null si no se puede usar: la UI muestra un recorte de reemplazo.
 */
export async function downloadImage(imageUrl) {
  if (!imageUrl) return null;
  try {
    const { response, finalUrl } = await safeFetch(imageUrl, {
      timeoutMs: 12_000,
      headers: { Accept: 'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8' },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    const declared = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (declared === 'image/svg+xml' || (declared && !declared.startsWith('image/'))) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    const buffer = await readLimited(response, CONFIG.limits.imageBytes);
    const ext = sniff(buffer) || EXT_BY_MIME[declared];
    if (!ext || !MIME_BY_EXT[ext]) return null;
    return { buffer, ext, contentType: MIME_BY_EXT[ext], source: finalUrl.href };
  } catch {
    return null;
  }
}

/** Guarda la imagen en la carpeta temporal y devuelve un token para mostrarla en el formulario. */
export async function savePreviewImage(imageUrl) {
  const image = await downloadImage(imageUrl);
  if (!image) return null;
  await mkdir(PATHS.tmp, { recursive: true });
  const token = randomBytes(16).toString('hex');
  await writeFile(path.join(PATHS.tmp, `prev-${token}.${image.ext}`), image.buffer);
  return { token, ext: image.ext, source: image.source };
}

export async function findPreviewFile(token) {
  if (!TOKEN_RE.test(token || '')) return null;
  for (const ext of Object.keys(MIME_BY_EXT)) {
    const file = path.join(PATHS.tmp, `prev-${token}.${ext}`);
    try {
      const info = await stat(file);
      if (info.isFile()) return { file, ext };
    } catch {
      /* siguiente extensión */
    }
  }
  return null;
}

/** Mueve la imagen temporaria al archivo definitivo del recorte. */
export async function promotePreviewImage(token, linkId) {
  if (!ID_RE.test(linkId || '')) return null;
  const found = await findPreviewFile(token);
  if (!found) return null;
  await mkdir(PATHS.thumbs, { recursive: true });
  const target = path.join(PATHS.thumbs, `${linkId}.${found.ext}`);
  await rename(found.file, target).catch(async () => {
    // Si el rename falla (archivo bloqueado en Windows) copiamos el contenido.
    const { readFile } = await import('node:fs/promises');
    await writeFile(target, await readFile(found.file));
    await unlink(found.file).catch(() => {});
  });
  return { file: path.basename(target), ext: found.ext };
}

/** Descarga la imagen directo al recorte (cuando no vino de una vista previa). */
export async function saveImageForLink(imageUrl, linkId) {
  if (!ID_RE.test(linkId || '')) return null;
  const image = await downloadImage(imageUrl);
  if (!image) return null;
  await mkdir(PATHS.thumbs, { recursive: true });
  await writeFile(path.join(PATHS.thumbs, `${linkId}.${image.ext}`), image.buffer);
  for (const ext of Object.keys(MIME_BY_EXT)) {
    if (ext !== image.ext) await unlink(path.join(PATHS.thumbs, `${linkId}.${ext}`)).catch(() => {});
  }
  return { file: `${linkId}.${image.ext}`, ext: image.ext, source: image.source };
}

export async function thumbFile(linkId) {
  if (!ID_RE.test(linkId || '')) return null;
  for (const ext of Object.keys(MIME_BY_EXT)) {
    const file = path.join(PATHS.thumbs, `${linkId}.${ext}`);
    try {
      const info = await stat(file);
      if (info.isFile()) return { file, ext, size: info.size, mtimeMs: info.mtimeMs };
    } catch {
      /* siguiente extensión */
    }
  }
  return null;
}

export function mimeForExt(ext) {
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

/** Limpia tokens viejos de vista previa que el usuario nunca guardó. */
export async function cleanupPreviewFiles() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  let names = [];
  try {
    names = await readdir(PATHS.tmp);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith('prev-')) continue;
    const file = path.join(PATHS.tmp, name);
    try {
      const info = await stat(file);
      if (info.mtimeMs < cutoff) await unlink(file);
    } catch {
      /* ignorar */
    }
  }
}
