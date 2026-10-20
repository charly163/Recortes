# Recortes — documentación funcional y técnica

Actualizada: 20 de octubre de 2026

## Objetivo
Recortes es un archivo digital personal para guardar enlaces de redes sociales y sitios web desde celular o escritorio. Cada recorte puede tener URL, miniatura, título, plataforma, carpeta/subcarpeta y nota. La interfaz está en español de Argentina y usa una estética editorial cálida: papel crema, tinta oscura y bermellón, con temas claro y oscuro.

## Funciones
- Guardar URL HTTP/HTTPS y consultar vista previa.
- Detectar título, dominio, plataforma e imagen cuando la página lo permite.
- Editar título, carpeta y nota; borrar recortes.
- Crear carpetas/subcarpetas con icono, renombrar y cambiar icono.
- Borrar una carpeta moviendo los recortes a la superior o eliminando su contenido.
- Buscar por título, dominio, nota y descripción; filtrar por carpeta y plataforma.
- Importar/exportar datos mediante endpoints JSON existentes.
- Guardar el enlace aunque la red social bloquee la vista previa.

Plataformas reconocidas incluyen YouTube, Instagram, TikTok, X/Twitter, Facebook, LinkedIn, Reddit, GitHub y web genérica.

## Flujo de guardado
1. El usuario pega un enlace en el formulario.
2. POST /api/preview extrae metadatos y prepara una imagen temporal cuando es posible.
3. El usuario ajusta título, carpeta y nota.
4. POST /api/links valida y persiste el registro y su miniatura.
5. El cliente incorpora la respuesta al estado en memoria y renderiza sin volver a descargar la biblioteca entera.

La administración de carpetas usa POST/PATCH/DELETE /api/categories. El servidor restringe el árbol a dos niveles y evita nombres duplicados hermanos.

## Tecnología
- Node.js 20+, módulos ES.
- Servidor HTTP nativo; sin framework.
- Frontend HTML, CSS y JavaScript modular; sin framework ni bundler.
- API REST JSON propia.
- @netlify/blobs para persistencia en Netlify.
- Localmente el estado usa JSON y las imágenes archivos.
- Metadatos Open Graph, Twitter Cards, JSON-LD y oEmbed; preview.js incluye defensas SSRF.
- Sin dependencias de frontend.

## Arquitectura
- static/index.html: shell de la aplicación.
- static/app/app.js: estado cliente, render, formularios, filtros y llamadas API.
- static/app/app.css: layout, tarjetas y selector visual de iconos.
- static/app/icons.js: iconos de interfaz y catálogo de iconos de carpetas.
- static/app/platforms.js: iconos y etiquetas de plataformas.
- src/server/api.js: endpoints REST.
- src/server/store.js: validación, modelo, reglas CRUD y persistencia.
- src/server/preview.js: obtención segura de metadatos.
- src/server/thumbs.js: miniaturas temporales y definitivas.
- netlify/functions/api.mjs: adaptador HTTP a Lambda/Netlify y conexión con Blobs.
- netlify.toml: publicación de static/, Function y rewrite /api/*.

El estado del frontend vive en memoria en app.js. Las mutaciones integran la respuesta del servidor y llaman a render(). La búsqueda se aplica localmente y no envía una solicitud por cada tecla.

## Modelo persistido
- settings.theme: auto, light o dark.
- categories: id UUID, name, parentId opcional, icon y createdAt.
- links: id UUID, url, domain, platform, title, description, siteName, categoryId opcional, note, thumb, createdAt y updatedAt.
El servidor normaliza datos importados, limita los tamaños, valida URLs HTTP/HTTPS, iconos y referencias de categorías.

## API
- GET /api/health: estado de la API.
- GET /api/state: estado completo.
- POST /api/preview con url: metadatos e imageToken temporal.
- GET /api/preview-image/:token: imagen temporal.
- POST /api/links: crea; responde link y warnings.
- PATCH/DELETE /api/links/:id: edita/elimina.
- POST /api/categories: crea con name, parentId e icon.
- PATCH /api/categories/:id: modifica nombre/icono.
- DELETE /api/categories/:id?links=move|delete: borra y devuelve state actualizado.
- PATCH /api/settings: actualiza tema.
- GET /api/export y POST /api/import: backup y restauración.

## Persistencia y ejecución
Local: data/store.json, data/thumbs/ y data/tmp/. Variables: PORT, HOST, RECORTES_DATA, RECORTES_USER y RECORTES_PASS. Puerto por defecto: 4317.
Netlify: netlify.toml publica static/, compila netlify/functions/ con esbuild y enruta /api/* a la Function. Los stores Blobs son recortes-data y recortes-images. Requiere Node.js 20+.
Comandos: npm install, npm start, npm run dev.
tools/test-api.mjs modifica datos; usar solo en una instancia desechable.

## Estado y próximos pasos
Implementado: aplicación, búsqueda, filtros, temas, preview, miniaturas, CRUD de enlaces y carpetas, icon picker, almacenamiento local y Netlify.
- Confirmar en el próximo deploy alta/edición/borrado sin recargar.
- Revisar persistencia tras recarga y escrituras concurrentes entre dispositivos; Blobs edge puede propagar cambios con demora.
- Agregar PWA y recepción desde el menú Compartir.
- Hacer accesible en la interfaz la importación/exportación existente.
- Añadir autenticación si deja de ser un archivo personal.

Al agregar iconos, mantener CATEGORY_ICONS/CATEGORY_ICON_LABELS en static/app/icons.js alineado con ICONS en src/server/store.js.
