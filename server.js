import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { CONFIG, lanUrls, PATHS } from './src/server/config.js';
import { handleApi } from './src/server/api.js';
import { HttpError, json, serveStatic, text } from './src/server/http.js';
import { store } from './src/server/store.js';
import { cleanupPreviewFiles } from './src/server/thumbs.js';

function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ''));
  const right = Buffer.from(String(b ?? ''));
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(req) {
  if (!CONFIG.authUser && !CONFIG.authPass) return true;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded = '';
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const index = decoded.indexOf(':');
  if (index === -1) return false;
  return safeEqual(decoded.slice(0, index), CONFIG.authUser) && safeEqual(decoded.slice(index + 1), CONFIG.authPass);
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  let url;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Pedido inválido');
    return;
  }

  if (!authorized(req)) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Recortes", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end('Necesitás usuario y contraseña para entrar a Recortes.');
    return;
  }

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else if (req.method !== 'GET' && req.method !== 'HEAD') {
      text(res, 405, 'Método no permitido');
    } else if (url.pathname === '/index.html') {
      res.writeHead(302, { Location: '/' });
      res.end();
    } else {
      const served = await serveStatic(req, res, CONFIG.staticDir, url.pathname);
      if (!served) {
        text(res, 404, 'No encontramos esa página.\n\nVolvé a la biblioteca: /');
      }
    }
  } catch (err) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (err instanceof HttpError) {
      json(res, err.status, { error: err.message, details: err.details || null });
      return;
    }
    console.error('[recortes] error inesperado:', err);
    json(res, 500, { error: 'Algo se rompió del lado del servidor. Revisá la consola.' });
  } finally {
    if (process.env.RECORTES_LOG === '1') {
      console.log(`${req.method} ${url.pathname} → ${res.statusCode} (${Date.now() - started} ms)`);
    }
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

async function main() {
  await store.init();
  await cleanupPreviewFiles();
  setInterval(() => {
    cleanupPreviewFiles().catch(() => {});
  }, 30 * 60 * 1000).unref();

  server.listen(CONFIG.port, CONFIG.host, () => {
    const local = `http://localhost:${CONFIG.port}`;
    console.log('\n  Recortes — archivo de links\n');
    console.log(`  Local     ${local}`);
    for (const lan of lanUrls(CONFIG.port)) console.log(`  Red       ${lan.url}  (${lan.name})`);
    console.log(`  Datos     ${PATHS.store}`);
    if (CONFIG.authUser || CONFIG.authPass) console.log('  Acceso    protegido con usuario y contraseña');
    console.log('');
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  El puerto ${CONFIG.port} ya está en uso. Probá con otro: PORT=4400 npm start\n`);
    process.exit(1);
  }
  throw err;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\n  Cerrando Recortes…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1_500).unref();
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar Recortes:', err);
  process.exit(1);
});
