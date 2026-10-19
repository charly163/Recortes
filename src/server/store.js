import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG, PATHS } from './config.js';
import { HttpError } from './http.js';

const STORE_VERSION = 1;
const ON_NETLIFY = Boolean(process.env.NETLIFY);
let blobStorePromise;
async function getBlobStore() {
  if (!blobStorePromise) blobStorePromise = import('@netlify/blobs').then(({ getStore }) => getStore({ name: 'recortes-data', consistency: 'strong' }));
  return blobStorePromise;
}

/** Carpetas con las que arranca un archivo vacÃ­o. Se pueden renombrar o borrar. */
const SEED_CATEGORIES = [
  { name: 'Para despuÃ©s', icon: 'clock' },
  { name: 'Cursos y clases', icon: 'book' },
  { name: 'Bases de datos', icon: 'database' },
  { name: 'Herramientas', icon: 'wrench' },
  { name: 'InspiraciÃ³n', icon: 'spark' },
];

const ICONS = new Set([
  'folder', 'clock', 'book', 'database', 'wrench', 'spark', 'code', 'video', 'music',
  'image', 'link', 'star', 'bulb', 'chart', 'cart', 'heart', 'pin',
]);

const MAX_NAME = 60;
const MAX_TITLE = 300;
const MAX_NOTE = 4_000;
const MAX_DESCRIPTION = 1_200;
const MAX_URL = 2_048;

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}

function httpUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new HttpError(400, 'Ese link no es vÃ¡lido. Tiene que empezar con http:// o https://.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Solo se pueden guardar links http o https.');
  }
  if (url.href.length > MAX_URL) throw new HttpError(400, 'El link es demasiado largo.');
  return url;
}

export function domainOf(url) {
  return url.hostname.replace(/^www\./i, '').toLowerCase();
}

function emptyData() {
  const now = new Date().toISOString();
  return {
    version: STORE_VERSION,
    settings: { theme: 'auto' },
    categories: SEED_CATEGORIES.map((seed) => ({
      id: randomUUID(),
      name: seed.name,
      parentId: null,
      icon: seed.icon,
      createdAt: now,
    })),
    links: [],
  };
}

function fileExists(file) {
  return stat(file).then((s) => s.isFile()).catch(() => false);
}

export class Store {
  constructor() {
    this.data = null;
    this.writeChain = Promise.resolve();
  }

  async init() {
    if (!ON_NETLIFY) {
      await mkdir(CONFIG.dataDir, { recursive: true });
      await mkdir(PATHS.thumbs, { recursive: true });
      await mkdir(PATHS.tmp, { recursive: true });
    }

    let raw = null;
    try {
      raw = ON_NETLIFY ? await (await getBlobStore()).get('store.json', { type: 'text', consistency: 'strong' }) : await readFile(PATHS.store, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    if (raw === null) {
      this.data = emptyData();
      await this.persist();
    } else {
      try {
        this.data = this.normalize(JSON.parse(raw));
      } catch {
        const backup = `${PATHS.store}.corrupto-${Date.now()}`;
        await rename(PATHS.store, backup).catch(() => {});
        this.data = emptyData();
        await this.persist();
      }
    }

    if (!ON_NETLIFY) await this.cleanupTmp();
    return this;
  }

  /** Deja el archivo en un estado seguro aunque venga de una importaciÃ³n o ediciÃ³n manual. */
  normalize(input) {
    const data = {
      version: STORE_VERSION,
      settings: { theme: ['auto', 'light', 'dark'].includes(input?.settings?.theme) ? input.settings.theme : 'auto' },
      categories: [],
      links: [],
    };

    const seenCats = new Set();
    for (const c of Array.isArray(input?.categories) ? input.categories : []) {
      if (!c || typeof c !== 'object') continue;
      const id = typeof c.id === 'string' && /^[a-zA-Z0-9-]{6,64}$/.test(c.id) ? c.id : randomUUID();
      if (seenCats.has(id)) continue;
      seenCats.add(id);
      data.categories.push({
        id,
        name: cleanText(c.name, MAX_NAME) || 'Sin nombre',
        parentId: typeof c.parentId === 'string' ? c.parentId : null,
        icon: ICONS.has(c.icon) ? c.icon : 'folder',
        createdAt: c.createdAt || new Date().toISOString(),
      });
    }

    // SÃ³lo dos niveles: si un padre no existe o ya es hijo, la carpeta queda arriba.
    const byId = new Map(data.categories.map((c) => [c.id, c]));
    for (const c of data.categories) {
      if (!c.parentId) continue;
      const parent = byId.get(c.parentId);
      if (!parent || parent.parentId) c.parentId = null;
      if (parent && parent.id === c.id) c.parentId = null;
    }

    const seenLinks = new Set();
    for (const l of Array.isArray(input?.links) ? input.links : []) {
      if (!l || typeof l !== 'object') continue;
      let url;
      try {
        url = httpUrl(l.url);
      } catch {
        continue;
      }
      const id = typeof l.id === 'string' && /^[a-zA-Z0-9-]{6,64}$/.test(l.id) ? l.id : randomUUID();
      if (seenLinks.has(id)) continue;
      seenLinks.add(id);
      const categoryId = byId.has(l.categoryId) ? l.categoryId : null;
      data.links.push({
        id,
        url: url.href,
        domain: typeof l.domain === 'string' && l.domain ? cleanText(l.domain, 120) : domainOf(url),
        platform: cleanText(l.platform, 24) || 'web',
        title: cleanText(l.title, MAX_TITLE) || domainOf(url),
        description: cleanText(l.description, MAX_DESCRIPTION),
        siteName: cleanText(l.siteName, 80),
        categoryId,
        note: cleanText(l.note, MAX_NOTE),
        thumb: l.thumb && typeof l.thumb.file === 'string' ? {
          file: path.basename(l.thumb.file),
          source: cleanText(l.thumb.source, MAX_URL),
          ext: cleanText(l.thumb.ext, 8),
        } : null,
        createdAt: l.createdAt || new Date().toISOString(),
        updatedAt: l.updatedAt || l.createdAt || new Date().toISOString(),
      });
    }

    data.links.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return data;
  }

  async persist() {
    const snapshot = JSON.stringify(this.data, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      if (ON_NETLIFY) {
        await (await getBlobStore()).set('store.json', snapshot);
      } else {
        const tmp = `${PATHS.store}.${process.pid}.tmp`;
        await writeFile(tmp, snapshot, 'utf8');
        await rename(tmp, PATHS.store);
      }
    });
    return this.writeChain;
  }

  async cleanupTmp() {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    let names = [];
    try {
      names = await readdir(PATHS.tmp);
    } catch {
      return;
    }
    for (const name of names) {
      const file = path.join(PATHS.tmp, name);
      try {
        const info = await stat(file);
        if (info.mtimeMs < cutoff) await unlink(file);
      } catch {
        /* archivo en uso: se ignora */
      }
    }
  }

  // ---------------------------------------------------------------- lectura

  publicLink(link) {
    return {
      ...link,
      thumbUrl: link.thumb
        ? `/api/thumb/${link.id}?v=${encodeURIComponent(link.updatedAt.slice(0, 19))}`
        : null,
    };
  }

  publicCategory(category) {
    return { ...category };
  }

  state() {
    return {
      app: { version: CONFIG.version, name: 'Recortes' },
      settings: { ...this.data.settings },
      categories: this.data.categories.map((c) => this.publicCategory(c)),
      links: this.data.links.map((l) => this.publicLink(l)),
    };
  }

  getLink(id) {
    const link = this.data.links.find((l) => l.id === id);
    if (!link) throw new HttpError(404, 'Ese recorte no existe.');
    return link;
  }

  getCategory(id) {
    const category = this.data.categories.find((c) => c.id === id);
    if (!category) throw new HttpError(404, 'Esa carpeta no existe.');
    return category;
  }

  // ---------------------------------------------------------------- links

  async createLink(input) {
    const url = httpUrl(input.url);
    let categoryId = null;
    if (input.categoryId) {
      this.getCategory(input.categoryId);
      categoryId = input.categoryId;
    }
    const now = new Date().toISOString();
    const link = {
      id: randomUUID(),
      url: url.href,
      domain: domainOf(url),
      platform: cleanText(input.platform, 24) || 'web',
      title: cleanText(input.title, MAX_TITLE) || domainOf(url),
      description: cleanText(input.description, MAX_DESCRIPTION),
      siteName: cleanText(input.siteName, 80),
      categoryId,
      note: cleanText(input.note, MAX_NOTE),
      thumb: null,
      createdAt: now,
      updatedAt: now,
    };
    this.data.links.unshift(link);
    await this.persist();
    return link;
  }

  async updateLink(id, input) {
    const link = this.getLink(id);
    if ('title' in input) {
      const title = cleanText(input.title, MAX_TITLE);
      link.title = title || link.domain;
    }
    if ('note' in input) link.note = cleanText(input.note, MAX_NOTE);
    if ('description' in input) link.description = cleanText(input.description, MAX_DESCRIPTION);
    if ('categoryId' in input) {
      if (input.categoryId) this.getCategory(input.categoryId);
      link.categoryId = input.categoryId || null;
    }
    if (input.url) {
      const url = httpUrl(input.url);
      link.url = url.href;
      link.domain = domainOf(url);
      if (input.platform) link.platform = cleanText(input.platform, 24) || link.platform;
    }
    link.updatedAt = new Date().toISOString();
    await this.persist();
    return link;
  }

  async setThumb(id, thumb) {
    const link = this.getLink(id);
    link.thumb = thumb;
    link.updatedAt = new Date().toISOString();
    await this.persist();
    return link;
  }

  async deleteLink(id) {
    const index = this.data.links.findIndex((l) => l.id === id);
    if (index === -1) throw new HttpError(404, 'Ese recorte no existe.');
    const [link] = this.data.links.splice(index, 1);
    await this.removeThumbFiles(link.id);
    await this.persist();
    return link;
  }

  async removeThumbFiles(id) {
    if (ON_NETLIFY) {
      const blobs = await getBlobStore();
      for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']) await blobs.delete(`thumbs/${id}.${ext}`);
      return;
    }
    const base = path.join(PATHS.thumbs, path.basename(id));
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']) {
      await unlink(base + ext).catch(() => {});
    }
  }

  // ---------------------------------------------------------------- categorÃ­as

  siblingNameTaken(name, parentId, exceptId) {
    const lower = name.toLocaleLowerCase('es');
    return this.data.categories.some(
      (c) => c.id !== exceptId && (c.parentId || null) === (parentId || null)
        && c.name.toLocaleLowerCase('es') === lower,
    );
  }

  async createCategory(input) {
    const name = cleanText(input?.name, MAX_NAME);
    if (!name) throw new HttpError(400, 'PonÃ© un nombre para la carpeta.');
    const parentId = input?.parentId || null;
    if (parentId) {
      const parent = this.getCategory(parentId);
      if (parent.parentId) throw new HttpError(400, 'SÃ³lo se permiten dos niveles: carpeta y subcarpeta.');
    }
    if (this.siblingNameTaken(name, parentId)) throw new HttpError(409, 'Ya hay una carpeta con ese nombre en este nivel.');

    const category = {
      id: randomUUID(),
      name,
      parentId,
      icon: ICONS.has(input?.icon) ? input.icon : 'folder',
      createdAt: new Date().toISOString(),
    };
    this.data.categories.push(category);
    await this.persist();
    return category;
  }

  async updateCategory(id, input) {
    const category = this.getCategory(id);
    if ('name' in input) {
      const name = cleanText(input.name, MAX_NAME);
      if (!name) throw new HttpError(400, 'PonÃ© un nombre para la carpeta.');
      if (this.siblingNameTaken(name, category.parentId, id)) {
        throw new HttpError(409, 'Ya hay una carpeta con ese nombre en este nivel.');
      }
      category.name = name;
    }
    if ('icon' in input && ICONS.has(input.icon)) category.icon = input.icon;
    await this.persist();
    return category;
  }

  /** mode: "move" (mueve links al padre) | "delete" (borra links y subcarpetas). */
  async deleteCategory(id, mode = 'move') {
    const category = this.getCategory(id);
    const children = this.data.categories.filter((c) => c.parentId === id);
    const parentId = category.parentId || null;
    const categoryIds = new Set([category.id, ...children.map((c) => c.id)]);

    let removedLinks = 0;
    let movedLinks = 0;

    if (mode === 'delete') {
      const keep = [];
      for (const link of this.data.links) {
        if (categoryIds.has(link.categoryId)) {
          await this.removeThumbFiles(link.id);
          removedLinks += 1;
        } else {
          keep.push(link);
        }
      }
      this.data.links = keep;
      this.data.categories = this.data.categories.filter((c) => !categoryIds.has(c.id));
    } else {
      // Las subcarpetas suben un nivel y conservan sus recortes; sÃ³lo se reubican los
      // recortes que estaban directamente en la carpeta borrada.
      for (const child of children) child.parentId = parentId;
      for (const link of this.data.links) {
        if (link.categoryId === id) {
          link.categoryId = parentId;
          movedLinks += 1;
        }
      }
      this.data.categories = this.data.categories.filter((c) => c.id !== id);
    }

    await this.persist();
    return { removedCategories: categoryIds.size, removedLinks, movedLinks };
  }

  // ---------------------------------------------------------------- ajustes e import/export

  async updateSettings(input) {
    if (input && ['auto', 'light', 'dark'].includes(input.theme)) this.data.settings.theme = input.theme;
    await this.persist();
    return { ...this.data.settings };
  }

  exportData() {
    return {
      version: STORE_VERSION,
      exportedAt: new Date().toISOString(),
      settings: { ...this.data.settings },
      categories: this.data.categories.map((c) => ({ ...c })),
      links: this.data.links.map((l) => ({
        id: l.id,
        url: l.url,
        domain: l.domain,
        platform: l.platform,
        title: l.title,
        description: l.description,
        siteName: l.siteName,
        categoryId: l.categoryId,
        note: l.note,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        thumb: l.thumb ? { source: l.thumb.source, ext: l.thumb.ext } : null,
      })),
      notice: 'Las imÃ¡genes de las miniaturas no se incluyen en este respaldo.',
    };
  }

  async importData(payload) {
    if (!payload || !Array.isArray(payload.categories) || !Array.isArray(payload.links)) {
      throw new HttpError(400, 'El respaldo no tiene el formato esperado.');
    }
    const backupFile = path.join(CONFIG.dataDir, `store-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await writeFile(backupFile, JSON.stringify(this.data, null, 2), 'utf8').catch(() => {});

    const next = this.normalize(payload);
    // Conservamos miniaturas cuando el archivo sigue en disco.
    for (const link of next.links) {
      if (!link.thumb) continue;
      const candidate = `${link.id}.${link.thumb.ext || 'jpg'}`;
      link.thumb.file = (await fileExists(path.join(PATHS.thumbs, candidate))) ? candidate : null;
      if (!link.thumb.file) link.thumb = null;
    }
    const previousLinks = this.data.links.length;
    this.data = next;
    await this.persist();
    return {
      categories: next.categories.length,
      links: next.links.length,
      replaced: previousLinks,
      backup: path.basename(backupFile),
    };
  }
}

export const store = new Store();



