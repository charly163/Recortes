# Guía técnica de continuación

## Estructura

- `server.js`: arranque, autenticación Basic opcional, ruteo HTTP y ciclo de limpieza.
- `src/server/config.js`: rutas, límites, host/puerto y configuración.
- `src/server/http.js`: helpers HTTP, lectura JSON limitada, cabeceras de seguridad y archivos estáticos.
- `src/server/api.js`: endpoints REST.
- `src/server/store.js`: normalización, reglas de categorías, persistencia atómica en JSON e import/export.
- `src/server/preview.js`: detección de plataformas, fetch limitado, parseo de Open Graph/Twitter/JSON-LD, oEmbed y defensa SSRF.
- `src/server/thumbs.js`: descarga, validación por MIME/firma, almacenamiento y limpieza de miniaturas.
- `static/index.html`: shell; `static/app/app.js`: estado/UI y llamadas API; `static/app/app.css`: composición; los CSS restantes definen design system, fuentes e iconos.
- `tools/`: utilidades de comprobación API y vistas previas.

## Flujo de guardado

1. El usuario pega una URL; `POST /api/preview` devuelve metadatos, plataforma y un token temporal para la imagen.
2. El frontend muestra la ficha previa y permite elegir carpeta y escribir nota.
3. `POST /api/links` guarda el recorte. El backend promociona el token temporal o intenta descargar la imagen indicada.
4. `GET /api/state` refresca la biblioteca; `thumbUrl` apunta al endpoint local de miniatura.

La extracción puede fallar porque una red social bloquee solicitudes; el backend conserva la posibilidad de guardar manualmente el link.

## Decisiones y límites actuales

- Categorías limitadas a carpeta y subcarpeta.
- Persistencia local en un JSON; adecuada para una persona y una instancia, no para concurrencia de múltiples servidores/usuarios.
- El tema se persiste en servidor y también en localStorage como respaldo de preferencia.
- El frontend es vanilla JS y reutiliza los iconos y tokens existentes.
- Compartir desde el menú nativo del teléfono todavía no está implementado; requiere manifest PWA con `share_target` y un flujo de recepción de URL.
- La edición de carpetas y la interfaz de importación/exportación son pendientes.

## Comandos

- `npm start`: iniciar servidor.
- `npm run dev`: reiniciar al cambiar archivos del servidor.
- `node tools/test-api.mjs`: smoke test existente (modifica datos; usar una instancia de prueba).
- `node tools/check-preview.mjs <url...>`: inspeccionar previews.

## Criterios para la siguiente iteración

Probar ancho de 360px y escritorio, teclado/foco y estados vacíos; confirmar API contra servidor local; verificar URL con preview bloqueada; incluir manifest/PWA e integrar share target; exponer las funciones de backup y administración de carpetas que ya ofrece la API.

## Netlify

`netlify.toml` publishes `static/`, deploys `netlify/functions/`, and rewrites `/api/*` to the `api` Function. The Function adapts the existing API handler. On Netlify, JSON state is stored in the site-wide `recortes-data` Blobs store and preview/final images in `recortes-images`, so data persists across deploys. Local `npm start` continues to use `data/` on disk. The runtime dependency is `@netlify/blobs`.