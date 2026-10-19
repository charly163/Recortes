import { CONFIG } from './config.js';
import { HttpError, json, readJson, sendFile } from './http.js';
import { buildPreview, detectPlatform } from './preview.js';
import { store } from './store.js';
import {
  cleanupPreviewFiles,
  findPreviewFile,
  mimeForExt,
  promotePreviewImage,
  saveImageForLink,
  savePreviewImage,
  thumbFile,
} from './thumbs.js';

const ID_RE = /^([a-zA-Z0-9-]{6,64})$/;

function ok(res, payload, status = 200) {
  return json(res, status, payload);
}

async function previewPayload(rawUrl) {
  const preview = await buildPreview(rawUrl);
  let image = null;
  if (preview.imageUrl) image = await savePreviewImage(preview.imageUrl);
  if (!image) {
    if (preview.imageUrl) preview.warnings.push('No pudimos descargar la miniatura, pero el link sirve igual.');
    preview.imageUrl = '';
  }
  return {
    ...preview,
    imageToken: image?.token ?? null,
    imageExt: image?.ext ?? null,
    imageSource: image?.source ?? '',
  };
}

export async function handleApi(req, res, url) {
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/')) return false;
  const method = req.method || 'GET';
  const parts = pathname.split('/').filter(Boolean); // ['api', ...]

  // ------------------------------------------------------------- estado
  if (pathname === '/api/state' && method === 'GET') {
    return ok(res, store.state());
  }

  if (pathname === '/api/health' && method === 'GET') {
    return ok(res, { ok: true, version: CONFIG.version, uptime: Math.round(process.uptime()) });
  }

  if (pathname === '/api/settings' && method === 'PATCH') {
    const body = await readJson(req, 20_000);
    return ok(res, { settings: await store.updateSettings(body) });
  }

  // ------------------------------------------------------------- vista previa
  if (pathname === '/api/preview' && method === 'POST') {
    const body = await readJson(req, 20_000);
    if (!body.url) throw new HttpError(400, 'Falta el link.');
    const preview = await previewPayload(body.url);
    return ok(res, preview);
  }

  if (parts[1] === 'preview-image' && parts[2] && method === 'GET') {
    const found = await findPreviewFile(parts[2]);
    if (!found) throw new HttpError(404, 'La vista previa expiró. Probá de nuevo.');
    await sendFile(req, res, found.file, {
      contentType: mimeForExt(found.ext),
      cacheControl: 'no-store',
    });
    return true;
  }

  if (parts[1] === 'thumb' && parts[2] && method === 'GET') {
    const link = store.data.links.find((l) => l.id === parts[2]);
    const found = link ? await thumbFile(link.id) : await thumbFile(parts[2]);
    if (!found) throw new HttpError(404, 'Sin miniatura.');
    await sendFile(req, res, found.file, {
      contentType: mimeForExt(found.ext),
      cacheControl: 'public, max-age=86400',
    });
    return true;
  }

  // ------------------------------------------------------------- recortes
  if (pathname === '/api/links' && method === 'POST') {
    const body = await readJson(req);
    if (!body.url) throw new HttpError(400, 'Falta el link.');
    let linkUrl;
    try {
      linkUrl = new URL(String(body.url).trim());
    } catch {
      throw new HttpError(400, 'Ese link no es válido.');
    }
    if (linkUrl.protocol !== 'http:' && linkUrl.protocol !== 'https:') {
      throw new HttpError(400, 'Solo se pueden guardar links http o https.');
    }

    const meta = {
      title: body.title || '',
      description: body.description || '',
      siteName: body.siteName || '',
      platform: body.platform || detectPlatform(linkUrl.href),
      imageUrl: body.imageUrl || '',
      warnings: [],
    };

    if (!meta.title || !meta.imageUrl) {
      try {
        const preview = await buildPreview(linkUrl.href);
        meta.title = meta.title || preview.title;
        meta.description = meta.description || preview.description;
        meta.siteName = meta.siteName || preview.siteName;
        meta.platform = body.platform || preview.platform;
        meta.imageUrl = meta.imageUrl || preview.imageUrl;
        meta.warnings = preview.warnings;
      } catch (err) {
        meta.warnings = [err.message || 'No se pudo traer la ficha.'];
      }
    }

    const link = await store.createLink({
      url: linkUrl.href,
      title: meta.title,
      description: meta.description,
      siteName: meta.siteName,
      platform: meta.platform,
      categoryId: body.categoryId || null,
      note: body.note || '',
    });

    let thumb = null;
    if (body.previewToken) {
      thumb = await promotePreviewImage(body.previewToken, link.id);
    }
    if (!thumb && meta.imageUrl) {
      thumb = await saveImageForLink(meta.imageUrl, link.id);
    }
    let saved = link;
    if (thumb) {
      saved = await store.setThumb(link.id, {
        file: thumb.file,
        ext: thumb.ext,
        source: thumb.source || meta.imageUrl || '',
      });
    } else if (meta.warnings.length === 0) {
      meta.warnings.push('Guardado sin miniatura.');
    }

    return ok(res, { link: store.publicLink(saved), warnings: meta.warnings }, 201);
  }

  const linkMatch = /^\/api\/links\/([a-zA-Z0-9-]{6,64})(?:\/(refresh))?$/.exec(pathname);
  if (linkMatch) {
    const id = linkMatch[1];
    if (!ID_RE.test(id)) throw new HttpError(400, 'Id inválido.');

    if (method === 'PATCH' && !linkMatch[2]) {
      const body = await readJson(req);
      if (body.imageUrl) {
        const thumb = await saveImageForLink(body.imageUrl, id);
        if (!thumb) throw new HttpError(422, 'No pudimos descargar esa imagen. Probá con otra URL.');
        await store.setThumb(id, { file: thumb.file, ext: thumb.ext, source: thumb.source || body.imageUrl });
      } else if (body.removeThumb) {
        await store.removeThumbFiles(id);
        await store.setThumb(id, null);
      }
      const link = await store.updateLink(id, body);
      return ok(res, { link: store.publicLink(link) });
    }

    if (method === 'POST' && linkMatch[2] === 'refresh') {
      const link = store.getLink(id);
      const preview = await buildPreview(link.url);
      const updated = await store.updateLink(id, {
        title: preview.title,
        description: preview.description,
      });
      let saved = updated;
      if (preview.imageUrl) {
        const thumb = await saveImageForLink(preview.imageUrl, id);
        if (thumb) {
          saved = await store.setThumb(id, { file: thumb.file, ext: thumb.ext, source: preview.imageUrl });
        }
      }
      return ok(res, { link: store.publicLink(saved), warnings: preview.warnings });
    }

    if (method === 'DELETE') {
      await store.deleteLink(id);
      return ok(res, { ok: true });
    }
  }

  // ------------------------------------------------------------- categorías
  if (pathname === '/api/categories' && method === 'POST') {
    const body = await readJson(req, 20_000);
    const category = await store.createCategory({ name: body.name, parentId: body.parentId, icon: body.icon });
    return ok(res, { category: store.publicCategory(category) }, 201);
  }

  const categoryMatch = /^\/api\/categories\/([a-zA-Z0-9-]{6,64})$/.exec(pathname);
  if (categoryMatch) {
    const id = categoryMatch[1];
    if (method === 'PATCH') {
      const body = await readJson(req, 20_000);
      const category = await store.updateCategory(id, body);
      return ok(res, { category: store.publicCategory(category) });
    }
    if (method === 'DELETE') {
      const mode = url.searchParams.get('links') === 'delete' ? 'delete' : 'move';
      const result = await store.deleteCategory(id, mode);
      return ok(res, { ...result, state: store.state() });
    }
  }

  // ------------------------------------------------------------- respaldo
  if (pathname === '/api/export' && method === 'GET') {
    const data = store.exportData();
    const body = JSON.stringify(data, null, 2);
    const name = `recortes-${new Date().toISOString().slice(0, 10)}.json`;
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
    return true;
  }

  if (pathname === '/api/import' && method === 'POST') {
    const body = await readJson(req, 12_000_000);
    const payload = body && body.data ? body.data : body;
    const result = await store.importData(payload);
    return ok(res, { ...result, state: store.state() });
  }

  if (pathname === '/api/maintenance/cleanup' && method === 'POST') {
    await cleanupPreviewFiles();
    return ok(res, { ok: true });
  }

  throw new HttpError(404, 'Ruta de API desconocida.');
}
