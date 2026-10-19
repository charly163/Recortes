# Traspaso de producto: Recortes

Fecha: 2026-10-19

## Objetivo

Aplicación personal, en español de Argentina, para guardar enlaces desde celular o web como un archivo de recortes. Cada ficha puede tener miniatura, título, plataforma detectada, categoría/subcategoría y nota. Se busca por texto y se filtra por carpeta o plataforma. Estética editorial cálida: papel crema, tinta, acento bermellón, Fraunces, Inter Tight y JetBrains Mono.

## Tecnología y arquitectura

- Node.js 20+, módulos ES nativos, servidor HTTP sin framework ni dependencias de runtime.
- Frontend estático mobile-first en `static/`, JavaScript modular sin framework.
- API JSON en `src/server/api.js`; reglas de negocio y persistencia en `src/server/store.js`.
- `data/store.json` como almacenamiento local; imágenes en `data/thumbs/`, imágenes temporales en `data/tmp/`.
- `src/server/preview.js` extrae metadatos y/o oEmbed y aplica controles anti-SSRF; `thumbs.js` descarga y valida imágenes.
- Inicio: `npm start`; desarrollo: `npm run dev`; puerto por defecto 4317. Variables principales: `PORT`, `HOST`, `RECORTES_DATA`, `RECORTES_USER`, `RECORTES_PASS`.

## Modelo de datos

`settings.theme` admite `auto`, `light`, `dark`. Las categorías tienen `id`, `name`, `parentId`, `icon`, `createdAt`; el servidor permite dos niveles. Los links incluyen `id`, `url`, `domain`, `platform`, `title`, `description`, `siteName`, `categoryId`, `note`, `thumb`, `createdAt`, `updatedAt`. La API incluye estado, CRUD de links y categorías, vista previa, miniaturas, configuración y respaldo/importación.

## Estado al retomar

- Servidor, API, extracción de previews, almacenamiento, miniaturas y componentes visuales (tokens, fuentes, iconos, CSS) ya existían.
- `static/index.html` era un marcador de posición; no había lógica frontend conectada.
- Se reemplazó el placeholder por una aplicación funcional en `static/app/app.js` y estilos de composición en `static/app/app.css`.
- La interfaz carga estado, muestra tarjetas, búsqueda, filtro de plataforma, selección de carpetas, tema claro/oscuro, formulario de alta con preview, edición de título/carpeta/nota, borrado y creación de categorías/subcategorías.
- El store local encontrado tenía seis categorías y cero links.
- No se verificó ejecución real en navegador/API en esta sesión.

## Próximos pasos sugeridos

1. Iniciar `npm start` y revisar móvil y escritorio; corregir cualquier incompatibilidad visual o de flujo.
2. Probar guardar un link con y sin preview, miniaturas, cambio de categoría, edición y borrado.
3. Añadir manifiesto e iconos PWA y un endpoint `share_target` para compartir desde Android; validar el flujo instalado en dispositivos.
4. Mejorar gestión de carpetas (renombrar, cambiar icono, borrar con opción mover/eliminar) y añadir acciones de exportar/importar en la interfaz.
5. Revisar codificación UTF-8 en archivos heredados y documentar configuración de acceso remoto/backup.

## Contratos API usados

`GET /api/state`; `POST /api/preview` con `{url}`; `GET /api/preview-image/:token`; `POST /api/links`; `PATCH|DELETE /api/links/:id`; `POST /api/categories`; `PATCH|DELETE /api/categories/:id`; `PATCH /api/settings`.
