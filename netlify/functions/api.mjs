import { handleApi } from '../../src/server/api.js';
import { store } from '../../src/server/store.js';
import { HttpError } from '../../src/server/http.js';

function responseAdapter() {
  return {
    statusCode: 200,
    headers: {},
    body: Buffer.alloc(0),
    headersSent: false,
    writeHead(status, headers = {}) { this.statusCode = status; this.headers = headers; this.headersSent = true; },
    end(body = '') { this.body = Buffer.isBuffer(body) ? body : Buffer.from(String(body)); },
    destroy() {},
  };
}

export const handler = async (event) => {
  try {
    await store.init();
    const path = (event.path || '/').replace(/^\/\.netlify\/functions\/api/, '/api');
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
    const rawBody = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body)) : Buffer.alloc(0);
    const query = event.rawQuery || new URLSearchParams(event.queryStringParameters || {}).toString();
    const req = {
      method: event.httpMethod || 'GET',
      headers,
      async *[Symbol.asyncIterator]() { if (rawBody.length) yield rawBody; },
    };
    const res = responseAdapter();
    await handleApi(req, res, new URL(path + (query ? `?${query}` : ''), `https://${headers.host || 'localhost'}`));
    const binary = !String(res.headers['Content-Type'] || '').includes('json');
    return {
      statusCode: res.statusCode,
      headers: { 'X-Content-Type-Options': 'nosniff', ...res.headers },
      body: binary ? res.body.toString('base64') : res.body.toString('utf8'),
      isBase64Encoded: binary,
    };
  } catch (error) {
    if (error instanceof HttpError) return { statusCode: error.status, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ error: error.message, details: error.details || null }) };
    console.error('[recortes/netlify]', error);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ error: 'Error interno de Recortes.', detail: error.message }) };
  }
};
