# Traspaso del proyecto Recortes
Actualizado: 20 de octubre de 2026

## Objetivo
Archivo digital personal mobile-first en español de Argentina para guardar links con vista previa, título, plataforma, nota y carpetas. La documentación detallada está en static/__dev/docs/technical-guide.md.

## Tecnología
Node.js 20+, servidor HTTP nativo y módulos ES, API REST propia, frontend HTML/CSS/JavaScript sin framework. Local usa JSON/archivos; Netlify sirve static/ y ejecuta netlify/functions/api.mjs con @netlify/blobs.

## Estado actual
Alta, preview, miniaturas, edición/borrado de enlaces, búsqueda, filtros, tema claro/oscuro, carpetas y subcarpetas con CRUD y selector de iconos. El cliente integra las respuestas de mutaciones en memoria y no pide todo /api/state tras cada cambio.

## Cambio reciente
Antes de esta corrección cada mutación hacía una lectura completa adicional, con demora y posibilidad de recibir estado edge anterior. Ahora se usa la respuesta de la propia acción y se renderiza inmediatamente. El icon picker se usa al crear y editar carpetas.

## Próximos pasos
1. Confirmar en despliegue Netlify creación, edición y borrado sin recargar.
2. Revisar consistencia tras recargar y entre dispositivos; Blobs edge puede tener propagación eventual.
3. PWA / compartir URLs desde el teléfono.
4. Controles de importación/exportación en la UI.

Archivos clave: static/app/app.js, static/app/app.css, static/app/icons.js, src/server/api.js, src/server/store.js, src/server/preview.js, src/server/thumbs.js, netlify/functions/api.mjs y netlify.toml.
