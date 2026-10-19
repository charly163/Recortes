import dns from 'node:dns/promises';
import net from 'node:net';
import { CONFIG } from './config.js';
import { HttpError } from './http.js';

/* ------------------------------------------------------------------ plataformas */

/** Orden importa: el primero que coincide gana. */
const PLATFORM_RULES = [
  ['youtube', /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i],
  ['instagram', /(^|\.)(instagram\.com|instagr\.am|ig\.me)$/i],
  ['tiktok', /(^|\.)(tiktok\.com|tiktokv\.com)$/i],
  ['x', /(^|\.)(x\.com|twitter\.com|t\.co)$/i],
  ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.watch|fb\.me)$/i],
  ['linkedin', /(^|\.)(linkedin\.com|lnkd\.in)$/i],
  ['reddit', /(^|\.)(reddit\.com|redd\.it)$/i],
  ['github', /(^|\.)(github\.com|gist\.github\.com)$/i],
  ['pinterest', /(^|\.)pinterest\.[a-z.]+$/i],
  ['spotify', /(^|\.)(spotify\.com|spoti\.fi)$/i],
  ['soundcloud', /(^|\.)soundcloud\.com$/i],
  ['bandcamp', /(^|\.)bandcamp\.com$/i],
  ['vimeo', /(^|\.)vimeo\.com$/i],
  ['twitch', /(^|\.)twitch\.tv$/i],
  ['telegram', /(^|\.)(t\.me|telegram\.me|telegram\.org)$/i],
  ['threads', /(^|\.)threads\.(net|com)$/i],
  ['bluesky', /(^|\.)bsky\.app$/i],
  ['medium', /(^|\.)(medium\.com|medium\.org)$/i],
  ['substack', /(^|\.)substack\.com$/i],
  ['notion', /(^|\.)(notion\.so|notion\.site)$/i],
  ['figma', /(^|\.)figma\.com$/i],
  ['behance', /(^|\.)behance\.net$/i],
  ['dribbble', /(^|\.)dribbble\.com$/i],
  ['codepen', /(^|\.)codepen\.io$/i],
  ['stackoverflow', /(^|\.)(stackoverflow\.com|stackexchange\.com)$/i],
  ['wikipedia', /(^|\.)wikipedia\.org$/i],
  ['amazon', /(^|\.)amazon\.[a-z.]+$/i],
  ['mercadolibre', /(^|\.)mercadolibre\.[a-z.]+$/i],
  ['docs', /(^|\.)(docs\.google\.com|drive\.google\.com|sheets\.google\.com|slides\.google\.com)$/i],
  ['discord', /(^|\.)(discord\.com|discord\.gg)$/i],
  ['tumblr', /(^|\.)tumblr\.com$/i],
  ['flickr', /(^|\.)flickr\.com$/i],
  ['unsplash', /(^|\.)unsplash\.com$/i],
  ['arxiv', /(^|\.)arxiv\.org$/i],
  ['coursera', /(^|\.)coursera\.org$/i],
  ['udemy', /(^|\.)udemy\.com$/i],
  ['platzi', /(^|\.)platzi\.com$/i],
  ['hackernews', /(^|\.)news\.ycombinator\.com$/i],
];

export function detectPlatform(urlInput) {
  let host;
  try {
    host = new URL(urlInput).hostname;
  } catch {
    return 'web';
  }
  for (const [code, rule] of PLATFORM_RULES) {
    if (rule.test(host)) return code;
  }
  return 'web';
}

export const PLATFORM_CODES = [...PLATFORM_RULES.map(([code]) => code), 'web'];

/* ------------------------------------------------------------------ red segura */

const IPV4_BLOCKS = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv4Blocked(ip) {
  const value = ipv4ToInt(ip);
  if (value === null) return true;
  return IPV4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

function ipv6Blocked(ip) {
  const value = ip.toLowerCase();
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('::ffff:')) {
    const v4 = value.slice(7);
    if (net.isIP(v4) === 4) return ipv4Blocked(v4);
  }
  const first = value.split(':')[0];
  if (!first) return false;
  const hextet = parseInt(first, 16);
  if ((hextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((hextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((hextet & 0xff00) === 0xff00) return true; // multicast
  return false;
}

function hostBlocked(host) {
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (clean === 'localhost' || clean.endsWith('.localhost') || clean.endsWith('.local') || clean.endsWith('.internal')) {
    return true;
  }
  const version = net.isIP(clean);
  if (version === 4) return ipv4Blocked(clean);
  if (version === 6) return ipv6Blocked(clean);
  return false;
}

export async function assertSafeUrl(input) {
  let url;
  try {
    url = input instanceof URL ? input : new URL(String(input));
  } catch {
    throw new HttpError(400, 'El link no es válido.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Sólo se aceptan links http o https.');
  }
  if (url.username || url.password) throw new HttpError(400, 'El link no puede incluir usuario y contraseña.');
  if (!CONFIG.allowPrivateHosts && hostBlocked(url.hostname)) {
    throw new HttpError(400, 'Por seguridad no se pueden leer direcciones de la red local.');
  }
  if (!CONFIG.allowPrivateHosts && !net.isIP(url.hostname.replace(/^\[|\]$/g, ''))) {
    let addresses = [];
    try {
      addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
    } catch {
      throw new HttpError(422, 'No pudimos encontrar ese dominio. Revisá que el link esté bien escrito.');
    }
    if (!addresses.length) throw new HttpError(422, 'No pudimos encontrar ese dominio.');
    if (addresses.some((a) => hostBlocked(a.address))) {
      throw new HttpError(400, 'Por seguridad no se pueden leer direcciones de la red local.');
    }
  }
  return url;
}

/** fetch con redirecciones manuales para validar cada salto (anti-SSRF) y tiempo máximo. */
export async function safeFetch(urlInput, opts = {}) {
  const { headers = {}, timeoutMs = CONFIG.limits.previewTimeoutMs, maxRedirects = CONFIG.limits.maxRedirects } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = urlInput instanceof URL ? urlInput : new URL(String(urlInput));
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      await assertSafeUrl(current);
      const response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.7',
          ...headers,
        },
      });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        if (hop === maxRedirects) throw new HttpError(422, 'El link redirige demasiadas veces.');
        current = new URL(location, current);
        if (current.protocol !== 'http:' && current.protocol !== 'https:') {
          throw new HttpError(422, 'El link redirige a una dirección no permitida.');
        }
        continue;
      }
      return { response, finalUrl: current };
    }
    throw new HttpError(422, 'El link redirige demasiadas veces.');
  } catch (err) {
    if (err.name === 'AbortError') throw new HttpError(504, 'La página tardó demasiado en responder. Probá de nuevo.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function readLimited(response, maxBytes) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new HttpError(413, 'La página es demasiado pesada para leerla.');
  }
  if (!response.body) return '';
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > maxBytes) {
      await response.body.cancel().catch(() => {});
      throw new HttpError(413, 'La página es demasiado pesada para leerla.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function decodeBuffer(buffer, contentType) {
  const charset = /charset=([a-z0-9_-]+)/i.exec(contentType || '')?.[1]?.toLowerCase();
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      return new TextDecoder(charset).decode(buffer);
    } catch {
      /* charset desconocido: seguimos con utf-8 */
    }
  }
  return new TextDecoder('utf-8').decode(buffer);
}

/* ------------------------------------------------------------------ HTML */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—',
  ndash: '–', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  copy: '©', reg: '®', trade: '™', deg: '°', middot: '·', bull: '•', euro: '€', pound: '£',
  times: '×', divide: '÷', loz: '◊', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó',
  uacute: 'ú', ntilde: 'ñ', uuml: 'ü', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó',
  Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü', iexcl: '¡', iquest: '¿', ordm: 'º', ordf: 'ª',
  shy: '', zwj: '', zwnj: '',
};

export function decodeEntities(input) {
  if (!input) return '';
  return String(input).replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, body) => {
    const key = body.toLowerCase();
    if (key.startsWith('#x')) {
      const code = parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? safeFromCodePoint(code) : match;
    }
    if (key.startsWith('#')) {
      const code = parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? safeFromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, body) ? ENTITIES[body]
      : Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : match;
  });
}

function safeFromCodePoint(code) {
  try {
    return String.fromCodePoint(code > 0 && code <= 0x10ffff ? code : 0xfffd);
  } catch {
    return '';
  }
}

function cleanText(value, max = 500) {
  if (!value) return '';
  return decodeEntities(String(value))
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u200b-\u200f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function parseAttributes(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match;
  while ((match = re.exec(tag))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function absoluteUrl(value, base) {
  if (!value) return '';
  const trimmed = decodeEntities(value).trim();
  if (!trimmed || /^data:/i.test(trimmed) || /^javascript:/i.test(trimmed)) return '';
  try {
    const url = new URL(trimmed, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function firstMeta(meta, keys) {
  for (const key of keys) {
    const value = meta.get(key);
    if (value && value.trim()) return value;
  }
  return '';
}

/** JSON-LD: búsqueda superficial de name/headline/image. */
function jsonLdData(html) {
  const out = { title: '', description: '', image: '' };
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    if (out.title && out.description && out.image) break;
    let data;
    try {
      data = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const queue = Array.isArray(data) ? [...data] : [data];
    let guard = 0;
    while (queue.length && guard < 40) {
      guard += 1;
      const node = queue.shift();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) {
        queue.push(...node);
        continue;
      }
      if (!out.title && typeof node.headline === 'string') out.title = node.headline;
      if (!out.title && typeof node.name === 'string') out.title = node.name;
      if (!out.description && typeof node.description === 'string') out.description = node.description;
      if (!out.image) {
        if (typeof node.image === 'string') out.image = node.image;
        else if (Array.isArray(node.image) && typeof node.image[0] === 'string') out.image = node.image[0];
        else if (node.image && typeof node.image.url === 'string') out.image = node.image.url;
        else if (node.thumbnailUrl && typeof node.thumbnailUrl === 'string') out.image = node.thumbnailUrl;
      }
      if (node['@graph']) queue.push(...(Array.isArray(node['@graph']) ? node['@graph'] : [node['@graph']]));
    }
  }
  return out;
}

export function extractMeta(html, baseUrl) {
  const head = html.slice(0, 400_000);
  const meta = new Map();
  for (const match of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase().trim();
    const content = attrs.content ?? attrs.value;
    if (key && content != null && !meta.has(key)) meta.set(key, content);
  }

  let linkImage = '';
  let canonical = '';
  for (const match of head.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const rel = (attrs.rel || '').toLowerCase();
    if (rel.includes('image_src') && !linkImage) linkImage = attrs.href || '';
    if (rel.includes('canonical') && !canonical) canonical = attrs.href || '';
  }

  const jsonLd = jsonLdData(html);
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] || '';

  const title = cleanText(
    firstMeta(meta, ['og:title', 'twitter:title', 'twitter:text:title']) || titleTag || jsonLd.title,
    300,
  );
  const description = cleanText(
    firstMeta(meta, ['og:description', 'twitter:description', 'description']) || jsonLd.description,
    700,
  );
  const siteName = cleanText(firstMeta(meta, ['og:site_name']), 80);
  const imageRaw = firstMeta(meta, [
    'og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src',
    'image', 'thumbnail',
  ]) || linkImage || jsonLd.image;

  return {
    title,
    description,
    siteName,
    image: absoluteUrl(imageRaw, baseUrl),
    canonical: absoluteUrl(canonical, baseUrl),
    locale: firstMeta(meta, ['og:locale']),
  };
}

/* ------------------------------------------------------------------ oEmbed */

const OEMBED = {
  youtube: (u) => `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  vimeo: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  spotify: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  soundcloud: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
};

async function fetchOEmbed(platform, url) {
  const build = OEMBED[platform];
  if (!build) return null;
  try {
    const { response } = await safeFetch(build(url), { timeoutMs: 8_000, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = JSON.parse((await readLimited(response, 512_000)).toString('utf8'));
    return {
      title: cleanText(data.title, 300),
      description: data.author_name ? cleanText(`por ${data.author_name}`, 700) : '',
      image: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '',
      siteName: cleanText(data.provider_name, 80),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ helpers por plataforma */

function youtubeId(url) {
  const host = url.hostname.replace(/^www\./i, '');
  if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] || '';
  if (url.pathname === '/watch') return url.searchParams.get('v') || '';
  const match = /^\/(shorts|embed|live|v)\/([A-Za-z0-9_-]+)/.exec(url.pathname);
  return match ? match[2] : '';
}

function titleFallback(platform, url) {
  const host = url.hostname.replace(/^www\./i, '');
  const segments = url.pathname.split('/').filter(Boolean);
  const pretty = decodeURIComponent(segments[segments.length - 1] || '').replace(/[-_]+/g, ' ').replace(/\.(html?|php|aspx?)$/i, '');
  const byPlatform = {
    instagram: 'Publicación de Instagram',
    tiktok: 'Video de TikTok',
    x: 'Publicación en X',
    facebook: 'Publicación de Facebook',
    linkedin: 'Publicación de LinkedIn',
    reddit: `Hilo en Reddit`,
    pinterest: 'Pin de Pinterest',
    spotify: 'Audio en Spotify',
    vimeo: 'Video en Vimeo',
    twitch: 'Stream en Twitch',
  };
  if (platform === 'x' && segments.length >= 2) return `Publicación de @${segments[0]}`;
  if (byPlatform[platform]) return pretty ? `${byPlatform[platform]}: ${cleanText(pretty, 80)}` : byPlatform[platform];
  if (pretty) return cleanText(`${pretty} · ${host}`, 200);
  return host;
}

/* ------------------------------------------------------------------ preview */

/**
 * Devuelve la ficha de un link: título, descripción, imagen candidata, plataforma y dominio.
 * Nunca lanza por fallas de la página: devuelve lo que se pudo recuperar + advertencias.
 */
export async function buildPreview(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || '').trim());
  } catch {
    throw new HttpError(400, 'Pegá un link completo, con https:// adelante.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Sólo se aceptan links http o https.');
  }
  await assertSafeUrl(url);

  const platform = detectPlatform(url.href);
  const warnings = [];
  const result = {
    url: url.href,
    finalUrl: url.href,
    domain: url.hostname.replace(/^www\./i, '').toLowerCase(),
    platform,
    title: '',
    description: '',
    siteName: '',
    imageUrl: '',
    imageKind: 'none',
    warnings,
  };

  const [pageResult, oembed] = await Promise.allSettled([
    fetchPage(url),
    fetchOEmbed(platform, url.href),
  ]);

  if (oembed.status === 'fulfilled' && oembed.value) {
    result.title = oembed.value.title || '';
    result.siteName = oembed.value.siteName || '';
    result.imageUrl = oembed.value.image || '';
    if (oembed.value.description) result.description = oembed.value.description;
  }

  if (pageResult.status === 'fulfilled' && pageResult.value) {
    const page = pageResult.value;
    result.finalUrl = page.finalUrl;
    result.domain = new URL(page.finalUrl).hostname.replace(/^www\./i, '').toLowerCase();
    const meta = page.meta;
    if (meta.title) result.title = meta.title;
    if (meta.description) result.description = meta.description;
    if (meta.siteName) result.siteName = meta.siteName;
    if (meta.image) {
      result.imageUrl = meta.image;
      result.imageKind = 'og';
    }
    if (page.directImage) {
      result.imageUrl = page.finalUrl;
      result.imageKind = 'direct';
      result.title = result.title || titleFallback(platform, url);
      result.siteName = result.siteName || new URL(page.finalUrl).hostname.replace(/^www\./i, '');
    }
  } else if (pageResult.status === 'rejected') {
    const err = pageResult.reason;
    // Si tenemos ficha por oEmbed (YouTube, TikTok, Vimeo…) seguimos: la página puede bloquearnos.
    if (!result.title) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(422, 'No pudimos leer esa página. Igual podés guardar el link a mano.');
    }
    warnings.push('El sitio bloqueó la lectura de la página, pero recuperamos la ficha por su API.');
  }

  // Miniaturas derivadas para plataformas que las tienen previsibles.
  if (!result.imageUrl && platform === 'youtube') {
    const id = youtubeId(url);
    if (id) {
      result.imageUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      result.imageKind = 'derived';
    }
  }

  // Algunos sitios devuelven el nombre de la red como título ("Instagram", "TikTok"…).
  const GENERIC = new Set(['instagram', 'facebook', 'tiktok', 'x', 'twitter', 'youtube', 'linkedin', 'reddit', 'login', 'log in', 'iniciar sesión']);
  const titleKey = result.title.trim().toLowerCase();
  if (!result.title || GENERIC.has(titleKey) || titleKey === result.domain || titleKey === result.siteName.trim().toLowerCase()) {
    result.title = titleFallback(platform, url);
  }
  if (!result.siteName) result.siteName = new URL(result.finalUrl).hostname.replace(/^www\./i, '');
  if (!result.imageUrl) warnings.push('No encontramos una miniatura automática.');

  result.title = cleanText(result.title, 300) || result.domain;
  result.description = cleanText(result.description, 700);
  result.siteName = cleanText(result.siteName, 80);
  result.imageUrl = absoluteUrl(result.imageUrl, result.finalUrl);

  return result;
}

async function fetchPage(url) {
  const { response, finalUrl } = await safeFetch(url, { headers: { Accept: 'text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5' } });
  if (!response.ok) {
    if (response.status === 404) throw new HttpError(422, 'La página no existe (404).');
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(422, 'Ese sitio no permite leer la vista previa. Igual podés guardar el link.');
    }
    if (response.status === 429) throw new HttpError(429, 'El sitio nos está frenando. Esperá un momento y probá otra vez.');
    throw new HttpError(422, `El sitio respondió ${response.status}. Igual podés guardar el link.`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (/^image\//i.test(contentType)) {
    await response.body?.cancel().catch(() => {});
    return { finalUrl: finalUrl.href, meta: { title: '', description: '', siteName: '', image: '' }, directImage: true };
  }
  if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
    await response.body?.cancel().catch(() => {});
    throw new HttpError(422, 'Ese link no es una página web.');
  }

  const buffer = await readLimited(response, CONFIG.limits.htmlBytes);
  const html = decodeBuffer(buffer, contentType);
  return { finalUrl: finalUrl.href, meta: extractMeta(html, finalUrl.href), directImage: false };
}
