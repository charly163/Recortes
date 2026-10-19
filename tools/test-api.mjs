/**
 * Smoke test de la API. Requiere el servidor corriendo.
 * Uso: node tools/test-api.mjs
 */
const base = process.env.BASE || 'http://localhost:4317';

function log(ok, label, extra = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`);
  if (!ok) process.exitCode = 1;
}

async function api(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

const state = await api('GET', '/api/state');
log(state.status === 200, 'GET /api/state', `${state.data.categories?.length} carpetas, ${state.data.links?.length} recortes`);

const preview = await api('POST', '/api/preview', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
log(preview.status === 200 && !!preview.data.title, 'POST /api/preview', preview.data.title);
log(!!preview.data.imageToken, 'imagen de vista previa descargada', preview.data.imageExt);

const image = await fetch(`${base}/api/preview-image/${preview.data.imageToken}`);
log(image.ok, 'GET /api/preview-image', image.headers.get('content-type'));

const category = await api('POST', '/api/categories', { name: 'Prueba automática' });
log(category.status === 201, 'POST /api/categories', category.data.category?.name);

const child = await api('POST', '/api/categories', { name: 'Subprueba', parentId: category.data.category.id });
log(child.status === 201, 'POST /api/categories (subcarpeta)', child.data.category?.parentId === category.data.category.id);

const created = await api('POST', '/api/links', {
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: preview.data.title,
  description: preview.data.description,
  siteName: preview.data.siteName,
  platform: preview.data.platform,
  imageUrl: preview.data.imageSource,
  previewToken: preview.data.imageToken,
  categoryId: child.data.category.id,
  note: 'Nota de prueba',
});
log(created.status === 201 && created.data.link?.thumbUrl, 'POST /api/links', created.data.link?.id);

const linkId = created.data.link?.id;
if (linkId) {
  const thumb = await fetch(base + created.data.link.thumbUrl);
  log(thumb.ok && thumb.headers.get('content-type')?.startsWith('image/'), 'GET /api/thumb', thumb.headers.get('content-type'));

  const patched = await api('PATCH', `/api/links/${linkId}`, { title: 'Título editado', categoryId: category.data.category.id });
  log(patched.status === 200 && patched.data.link.title === 'Título editado', 'PATCH /api/links/:id');

  const refreshed = await api('POST', `/api/links/${linkId}/refresh`);
  log(refreshed.status === 200, 'POST /api/links/:id/refresh', refreshed.data.link?.title);

  const deleted = await api('DELETE', `/api/links/${linkId}`);
  log(deleted.status === 200, 'DELETE /api/links/:id');
}

const exported = await api('GET', '/api/export');
log(exported.status === 200 && Array.isArray(exported.data.links), 'GET /api/export', `${exported.data.links?.length} recortes`);

const removed = await api('DELETE', `/api/categories/${category.data.category.id}?links=move`);
log(removed.status === 200, 'DELETE /api/categories (mover)', `links movidos: ${removed.data.movedLinks}`);

const finalState = await api('GET', '/api/state');
log(finalState.status === 200, 'estado final coherente', `${finalState.data.categories.length} carpetas, ${finalState.data.links.length} recortes`);
