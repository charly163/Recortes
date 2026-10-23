# Recortes 📌 — Archivo Personal de Enlaces

> **Recortes** es un archivo digital personal *mobile-first* para capturar, previsualizar y organizar enlaces de la web y redes sociales (YouTube, Instagram, TikTok, X/Twitter, GitHub, Reddit, artículos, etc.), con estética editorial cálida, extracción inteligente de metadatos, almacenamiento de miniaturas y cero dependencia de bases de datos externas o frameworks pesados.

---

## 📑 Tabla de Contenidos

1. [¿Para qué sirve?](#-para-qué-sirve)
2. [Características Principales](#-características-principales)
3. [Stack Tecnológico](#-stack-tecnológico)
4. [Arquitectura del Sistema](#-arquitectura-del-sistema)
5. [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
6. [Variables de Entorno](#-variables-de-entorno)
7. [Estructura del Proyecto](#-estructura-del-proyecto)
8. [API REST — Referencia de Endpoints](#-api-rest--referencia-de-endpoints)
9. [🤖 Guía de Contexto para Inteligencias Artificiales y Agentes LLM](#-guía-de-contexto-para-inteligencias-artificiales-y-agentes-llm)
    - [Modelo Mental del Proyecto](#modelo-mental-del-proyecto)
    - [Esquema de Datos y Modelo Persistido](#esquema-de-datos-y-modelo-persistido)
    - [Flujo de Scraping y Defensa Anti-SSRF](#flujo-de-scraping-y-defensa-anti-ssrf)
    - [Reglas de Negocio Inmutables](#reglas-de-negocio-inmutables)
    - [Cómo Extender Plataformas e Iconos](#cómo-extender-plataformas-e-iconos)
10. [Roadmap y Pendientes](#-roadmap-y-pendientes)

---

## 🎯 ¿Para qué sirve?

En internet encontramos constantemente artículos, videos educativos, hilos, repositorios o herramientas útiles que guardamos en marcadores desordenados o chats temporales. 

**Recortes** resuelve esto funcionando como una biblioteca personal autocontenida:
- Pegás un enlace (o lo compartís desde el móvil).
- El servidor extrae de inmediato el título, descripción, plataforma y descarga la imagen de portada.
- Podés asignar una carpeta/subcarpeta y anotar comentarios personales.
- Todo tu contenido queda indexado, searchable en tiempo real y con respaldo exportable en un solo archivo JSON.

---

## ✨ Características Principales

- **Detección Automática de Metadatos:** Scraper seguro que analiza Open Graph, Twitter Cards, JSON-LD (`schema.org`) y endpoints oEmbed.
- **Soporte para 38+ Plataformas:** Detección de dominio y asignación automática de logo para plataformas como YouTube, TikTok, Instagram, X (Twitter), GitHub, Spotify, Reddit, LinkedIn, Pinterest, Notion, Figma, Hacker News, Mercado Libre, etc.
- **Guardado Resiliente:** Si una red social bloquea el crawler o requiere inicio de sesión, el enlace se guarda igual y permite completar título e imagen de forma manual.
- **Seguridad Estricta Anti-SSRF:** Bloqueo de IPs privadas (RFC 1918, loopback, link-local, multicast, IPv6 ULA) tanto en la URL original como en cada salto de redirección (`safeFetch`).
- **Gestión de Miniaturas Segura:** Validación del archivo de imagen mediante *magic numbers* (firmas binarias) para evitar ataques de políglotas o archivos disfrazados; soporte de WebP, AVIF, PNG, JPG y GIF.
- **Organización en 2 Niveles:** Carpetas y subcarpetas con iconos personalizables (17 iconos predefinidos) y borrado seguro (con opción de mover enlaces a la carpeta padre o eliminarlos).
- **Frontend Ultraligero y Reactivo:** Interfaz responsiva *mobile-first*, temas Claro, Oscuro y Automático, renderizado directo sin refresco de página completa y búsqueda instantánea local.
- **Arquitectura Híbrida (Local o Serverless):** Funciona como servidor Node.js autónomo en cualquier máquina/servidor o se despliega sin cambios a Netlify Functions persistiendo en **Netlify Blobs**.
- **Seguridad de Acceso:** Soporte nativo para autenticación HTTP Basic segura contra *timing attacks* (`crypto.timingSafeEqual`).
- **Respaldo Completo:** Endpoints integrados para exportar e importar la base completa en formato JSON.

---

## 🛠 Stack Tecnológico

| Capa | Tecnologías | Notas |
| :--- | :--- | :--- |
| **Runtime & Servidor** | **Node.js (>= 20)** | Módulos ES (`type: module`), servidor nativo con `node:http`. Sin Express, Fastify ni dependencias pesadas. |
| **Persistencia Local** | **JSON atómico + Archivos** | `data/store.json` escrito con reemplazo atómico (`rename`), miniaturas en `data/thumbs/`. |
| **Persistencia Serverless**| **Netlify Functions & Blobs** | `@netlify/blobs` para almacenes `recortes-data` (JSON) y `recortes-images` (binarios). |
| **Frontend** | **Vanilla JS (ES2022+), HTML5, CSS3** | Sin React, Vue ni transpiladores. 100% estándar web nativo y modular. |
| **Tipografía y Estilo** | **Fuentes WOFF2 locales** | `Fraunces`, `Inter Tight`, `JetBrains Mono`. Variables y tokens de diseño CSS nativos. |
| **Testing & Herramientas**| **Scripts ES Module nativos** | `tools/test-api.mjs`, `tools/check-preview.mjs`. |

---

## 🏛 Arquitectura del Sistema

```
                  ┌─────────────────────────────────────────┐
                  │          Cliente Web / Mobile           │
                  │   (Vanilla JS, Componentes CSS, HTML)   │
                  └────────────────────┬────────────────────┘
                                       │ HTTP / JSON
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │               Ruteador                  │
                  │     server.js  /  netlify-api.mjs       │
                  │ (HTTP Basic Auth, Static, Error Handler)│
                  └────────────────────┬────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
 ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
 │   src/server/api.js  │   │ src/server/preview.js│   │ src/server/thumbs.js │
 │                      │   │                      │   │                      │
 │ - Endpoints REST     │   │ - Anti-SSRF check    │   │ - Image Sniffing     │
 │ - Normalización      │   │ - safeFetch + DNS    │   │ - Temp Token Cache   │
 │ - Gestión Errores    │   │ - OpenGraph / oEmbed │   │ - Thumb Promotion    │
 └──────────┬───────────┘   └──────────────────────┘   └──────────┬───────────┘
            │                                                     │
            ▼                                                     │
 ┌──────────────────────┐                                         │
 │  src/server/store.js │                                         │
 │                      │                                         │
 │ - CRUD Links/Carpetas│                                         │
 │ - Mutaciones & State │                                         │
 └──────────┬───────────┘                                         │
            │                                                     │
    ┌───────┴───────────────────────┐                             │
    │ Modo Local:                   │ Modo Netlify:               │
    │  - data/store.json            │  - Netlify Blobs            │
    │  - data/thumbs/  ◄────────────┼──  (recortes-data,          │
    │  - data/tmp/                  │     recortes-images)        │
    └───────────────────────────────┴─────────────────────────────┘
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- **Node.js**: versión 20.0.0 o superior (`node -v`).
- **NPM**: versión 10 o superior.

### 1. Clonar el repositorio
```bash
git clone https://github.com/charly163/Recortes.git
cd Recortes
```

### 2. Instalar dependencias
```bash
npm install
```
*(Nota: la única dependencia externa es `@netlify/blobs`, utilizada en entornos serverless).*

### 3. Ejecutar el servidor
- **Modo Producción / Estándar:**
  ```bash
  npm start
  ```
  La aplicación estará disponible en `http://localhost:4317` (y en las direcciones LAN informadas por consola).

- **Modo Desarrollo (con reinicio automático ante cambios):**
  ```bash
  npm run dev
  ```

### 4. Ejecutar pruebas y diagnósticos
- **Probar la API completa con un test de humo:**
  *(Requiere el servidor corriendo)*
  ```bash
  node tools/test-api.mjs
  ```
- **Probar la extracción de preview para una o más URLs:**
  ```bash
  node tools/check-preview.mjs https://github.com https://www.youtube.com/watch?v=dQw4w9WgXcQ
  ```

---

## ⚙ Variables de Entorno

Configurables mediante archivo `.env` o variables de entorno del sistema:

| Variable | Tipo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `PORT` | Número | `4317` | Puerto donde escucha el servidor HTTP local. |
| `HOST` | String | `0.0.0.0` | Host de escucha (`0.0.0.0` expone en LAN, `127.0.0.1` solo local). |
| `RECORTES_DATA` | String | `./data` | Directorio donde se guardan `store.json`, `thumbs/` y `tmp/`. |
| `RECORTES_USER` | String | `""` | Usuario para autenticación HTTP Basic (opcional). |
| `RECORTES_PASS` | String | `""` | Contraseña para autenticación HTTP Basic (opcional). |
| `RECORTES_ALLOW_PRIVATE` | `0` o `1` | `0` | Si es `1`, desactiva el bloqueo SSRF a hosts locales (útil para pruebas en intranet). |
| `RECORTES_LOG` | `0` o `1` | `0` | Si es `1`, imprime cada solicitud HTTP procesada con su tiempo de respuesta. |

---

## 📂 Estructura del Proyecto

```text
Recortes/
├── netlify/
│   └── functions/
│       └── api.mjs             # Adaptador serverless de la API para Netlify + Blobs
├── netlify.toml                # Configuración de build, redirects y rewrites de Netlify
├── package.json                # Metadatos del proyecto y scripts
├── server.js                   # Entrypoint local: servidor HTTP nativo, auth Basic y ruteo
├── src/
│   └── server/
│       ├── api.js              # Manejador de endpoints REST (/api/*)
│       ├── config.js           # Configuración general, constantes y límites
│       ├── http.js             # Utilidades HTTP: parser JSON seguro, headers, servidor estático
│       ├── preview.js          # Motor de scraping, defensas SSRF, oEmbed y Open Graph
│       ├── store.js            # Modelo de datos, persistencia en disco/Blobs y lógica de negocio
│       └── thumbs.js           # Descarga de imágenes, verificación binaria y ciclo de vida de tokens
├── static/                     # Frontend estático servido directamente
│   ├── index.html              # Shell HTML de la aplicación
│   ├── app/
│   │   ├── app.js              # Lógica de la UI, estado reactivo en memoria y llamadas API
│   │   ├── app.css             # Estructura del layout y vistas
│   │   ├── base.css            # Reseteo y estilos base
│   │   ├── components.css      # Estilos de botones, tarjetas, modales y formularios
│   │   ├── fonts.css           # Carga de tipografías locales
│   │   ├── icons.js            # Catálogo SVG de iconos de UI y de carpetas
│   │   ├── platform-icons.js   # Catálogo SVG de marcas y plataformas
│   │   ├── platforms.js        # Mapeo de identificadores y nombres legibles
│   │   └── tokens.css          # Paleta de color, tipografía y espaciado (Design Tokens)
│   ├── fonts/                  # Archivos WOFF2 (Fraunces, Inter Tight, JetBrains Mono)
│   └── __dev/                  # Documentación interna técnica y notas de evolución
└── tools/                      # Scripts de utilidad, pruebas y mantenimiento
    ├── check-preview.mjs       # Herramienta CLI para testear extracción de previews
    ├── fetch-fonts.mjs         # Descarga y actualización de tipografías
    ├── fetch-platform-icons.mjs# Sincronización de iconos de plataformas
    └── test-api.mjs            # Smoke test de integración para endpoints de la API
```

---

## 📡 API REST — Referencia de Endpoints

Todos los endpoints responden en formato `application/json` (salvo imágenes y exportaciones).

### 1. Estado y Configuración
- `GET /api/health`
  - Respuesta: `{ ok: true, version: "1.0.0", uptime: 123 }`
- `GET /api/state`
  - Devuelve el estado completo del sistema: `{ settings, categories, links }`.
- `PATCH /api/settings`
  - Payload: `{ theme: "auto" | "light" | "dark" }`
  - Actualiza el tema visual global.

### 2. Previsualización y Scraping
- `POST /api/preview`
  - Payload: `{ url: "https://ejemplo.com" }`
  - Respuesta:
    ```json
    {
      "url": "https://ejemplo.com",
      "canonicalUrl": "https://ejemplo.com",
      "domain": "ejemplo.com",
      "platform": "web",
      "title": "Título de la página",
      "description": "Descripción extraída...",
      "siteName": "Ejemplo",
      "imageUrl": "https://...",
      "imageToken": "a3f890b21...",
      "imageExt": "jpg",
      "imageSource": "https://...",
      "warnings": []
    }
    ```
- `GET /api/preview-image/:token`
  - Devuelve el binario de la imagen descargada temporalmente asociada a dicho `token`.

### 3. Gestión de Enlaces (Recortes)
- `POST /api/links`
  - Payload:
    ```json
    {
      "url": "https://...",
      "title": "Título opcional",
      "description": "Descripción opcional",
      "siteName": "Nombre del sitio",
      "platform": "youtube",
      "categoryId": "uuid-de-categoria-o-null",
      "note": "Nota personal",
      "previewToken": "token-temporal-previo-si-hubo",
      "imageUrl": "url-alternativa-si-no-hay-token"
    }
    ```
  - Respuesta (201): `{ link: { ... }, warnings: [] }`
- `PATCH /api/links/:id`
  - Payload: Permite actualizar `title`, `note`, `categoryId`, `imageUrl` o `{ removeThumb: true }`.
  - Respuesta: `{ link: { ... } }`
- `POST /api/links/:id/refresh`
  - Fuerza re-scrapear la URL original y actualizar título, descripción y miniatura.
- `DELETE /api/links/:id`
  - Elimina el enlace y borra sus archivos de miniatura asociados del disco o de Blobs.
- `GET /api/thumb/:id`
  - Devuelve la miniatura definitiva persistida del enlace con caché HTTP (`Cache-Control: public, max-age=86400`).

### 4. Gestión de Categorías
- `POST /api/categories`
  - Payload: `{ name: "Desarrollo", icon: "code", parentId: null }`
  - *Nota:* Solo se permiten hasta 2 niveles (si `parentId` no es null, debe apuntar a una categoría raíz).
- `PATCH /api/categories/:id`
  - Payload: `{ name?: "Nuevo nombre", icon?: "wrench" }`
- `DELETE /api/categories/:id?links=move|delete`
  - `links=move`: Mueve los enlaces contenidos a la carpeta superior o a la raíz.
  - `links=delete`: Elimina recursivamente todos los enlaces pertenecientes a esa categoría.

### 5. Respaldo y Mantenimiento
- `GET /api/export`
  - Descarga un archivo JSON con toda la base de datos: `recortes-YYYY-MM-DD.json`.
- `POST /api/import`
  - Restaura la base a partir de un JSON estructurado.
- `POST /api/maintenance/cleanup`
  - Limpia archivos de vista previa temporal que tengan más de 6 horas de antigüedad.

---

## 🤖 Guía de Contexto para Inteligencias Artificiales y Agentes LLM

> **Instrucción para Agentes de Código Autónomos (Antigravity, Cursor, Copilot, Claude):**  
> Si estás leyendo este archivo para modificar, refactorizar o extender Recortes, lee atentamente esta sección. Este proyecto sigue principios estrictos de minimalismo, seguridad y zero-frameworks.

### Modelo Mental del Proyecto
1. **Zero External Runtime Dependencies (Local):** No agregues librerías como Express, Axios, Cheerio, Lodash, React o Tailwind. El proyecto utiliza deliberadamente APIs nativas de Node.js (`node:http`, `node:crypto`, `node:dns`, `node:fs/promises`, `URL`, `fetch`, `AbortController`).
2. **Sin Bundlers en el Frontend:** No intentes añadir Vite, Webpack ni transpiladores a `static/`. Todos los navegadores modernos soportan ES Modules nativos (`<script type="module">`).
3. **Persistencia Dual Transparente:** La variable de entorno `process.env.NETLIFY` determina si el almacenamiento se delega en el sistema de archivos (`data/`) o en `@netlify/blobs`. Cualquier cambio en `store.js` o `thumbs.js` debe respetar ambas ramas.

### Esquema de Datos y Modelo Persistido

La estructura JSON persistida en `data/store.json` o en el blob `store.json`:

```typescript
interface StoreData {
  version: 1;
  settings: {
    theme: 'auto' | 'light' | 'dark';
  };
  categories: Category[];
  links: Link[];
}

interface Category {
  id: string;          // UUID v4
  name: string;        // Max 60 caracteres, normalizado
  parentId: string | null; // Id de carpeta padre. Max profundidad: 2 niveles
  icon: string;        // Debe existir en el Set ICONS
  createdAt: string;   // ISO 8601 Timestamp
}

interface Link {
  id: string;          // UUID v4
  url: string;         // HTTP o HTTPS, max 2048 chars
  domain: string;      // Nombre de host limpio (sin 'www.')
  platform: string;    // Código de plataforma ('youtube', 'github', 'web', etc.)
  title: string;       // Max 300 chars
  description: string; // Max 1200 chars
  siteName: string;    // Nombre del sitio o proveedor
  categoryId: string | null;
  note: string;        // Max 4000 chars
  thumb: {
    file: string;      // Ej: "<id>.webp" o clave Blob
    ext: 'jpg' | 'png' | 'webp' | 'gif' | 'avif';
    source: string;    // URL remota original de donde se obtuvo la imagen
  } | null;
  createdAt: string;   // ISO 8601 Timestamp
  updatedAt: string;   // ISO 8601 Timestamp
}
```

### Flujo de Scraping y Defensa Anti-SSRF
Todo acceso a red externa se realiza en `src/server/preview.js` mediante la función `safeFetch`:
1. **Validación de URL:** Rechaza esquemas que no sean `http:` o `https:`, y URLs con credenciales embebidas (`user:pass@host`).
2. **Resolución DNS y Chequeo de IP:** Resuelve el host con `dns.lookup`. Si la IP pertenece a rangos privados (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `100.64.0.0/10`, IPv6 link-local o ULA), se aborta la conexión con `HttpError(400)`.
3. **Seguimiento Manual de Redirecciones:** `fetch` se ejecuta con `redirect: 'manual'`. En cada cabecera `Location` obtenida, se vuelve a ejecutar la validación DNS y de rango IP contra el nuevo destino (hasta 4 saltos).
4. **Límites de Descarga:** No se procesan respuestas que excedan `CONFIG.limits.htmlBytes` (2 MB para HTML) o `CONFIG.limits.imageBytes` (8 MB para imágenes).
5. **Detección Binaria de Formato:** No confíes en el `Content-Type` devuelto por servidores remotos. La función `sniff()` en `thumbs.js` comprueba las firmas binarias iniciales (`FF D8 FF` para JPEG, `89 50 4E 47` para PNG, `RIFF...WEBP` para WebP, etc.).

### Reglas de Negocio Inmutables
- **Profundidad de Categorías:** Una categoría no puede ser subcategoría de otra subcategoría. Si `parentId` tiene un valor, ese padre debe tener `parentId === null`.
- **Nombres Únicos por Nivel:** Dos carpetas hermanas no pueden tener el mismo nombre (comparación case-insensitive).
- **Manejo de Estado en Frontend (`static/app/app.js`):** El cliente mantiene una copia del estado en memoria (`state = { settings, categories, links }`). **No ejecutes `GET /api/state` tras cada mutación**. La API responde el objeto creado/modificado; el frontend debe insertar o actualizar ese registro en su estado local y llamar a `render()`.
- **Iconos Sincronizados:** Si agregas un nuevo icono, debes registrarlo tanto en el conjunto `ICONS` de `src/server/store.js` como en los catálogos `CATEGORY_ICONS` y `CATEGORY_ICON_LABELS` de `static/app/icons.js`.

### Cómo Extender Plataformas e Iconos

#### 1. Agregar una nueva plataforma
1. Abrí `src/server/preview.js`.
2. En la lista `PLATFORM_RULES`, añade la tupla `['codigo', /regex-dominio/i]`. (El orden importa; las reglas específicas van antes de las genéricas).
3. Abrí `static/app/platforms.js` y agregá la etiqueta visible en `PLATFORM_NAMES`.
4. Abrí `static/app/platform-icons.js` y definí el SVG correspondiente en el objeto exportado.

#### 2. Agregar un nuevo icono de carpeta
1. En `src/server/store.js`, añade la clave al `Set` `ICONS`.
2. En `static/app/icons.js`, añade la etiqueta al objeto `CATEGORY_ICON_LABELS` y el SVG correspondiente a `CATEGORY_ICONS`.

---

## 🗺 Roadmap y Pendientes

- [ ] **PWA & Web Share Target:** Implementar `manifest.webmanifest` y el manejador `share_target` para que en Android/iOS la app aparezca en el menú nativo de "Compartir enlace" del navegador.
- [ ] **Modal de Importación/Exportación en UI:** Actualmente los endpoints `GET /api/export` y `POST /api/import` están listos en el servidor; resta integrar los botones de backup y restauración en el panel de ajustes de la interfaz.
- [ ] **Paginación o Virtual Scrolling:** Para bibliotecas que superen los 1.000 recortes guardados.
- [ ] **Autenticación Multi-usuario:** Si se desea migrar de un archivo personal mono-usuario a una plataforma colaborativa con sesiones JWT o cookies seguras.

---

*Desarrollado con foco en durabilidad, rendimiento nativo y soberanía de datos.*
