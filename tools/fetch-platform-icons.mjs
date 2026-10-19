/**
 * Baja los trazos de marca de Simple Icons (CC0) y genera static/app/platform-icons.js.
 * Uso: node tools/fetch-platform-icons.mjs
 * Sólo se ejecuta al agregar una plataforma nueva; el resultado queda versionado.
 */
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'static', 'app', 'platform-icons.js');

// código de plataforma -> slug en simple-icons
const SLUGS = {
  youtube: 'youtube',
  instagram: 'instagram',
  tiktok: 'tiktok',
  x: 'x',
  facebook: 'facebook',
  linkedin: 'linkedin',
  reddit: 'reddit',
  github: 'github',
  pinterest: 'pinterest',
  spotify: 'spotify',
  soundcloud: 'soundcloud',
  bandcamp: 'bandcamp',
  vimeo: 'vimeo',
  twitch: 'twitch',
  telegram: 'telegram',
  threads: 'threads',
  bluesky: 'bluesky',
  medium: 'medium',
  substack: 'substack',
  notion: 'notion',
  figma: 'figma',
  behance: 'behance',
  dribbble: 'dribbble',
  codepen: 'codepen',
  stackoverflow: 'stackoverflow',
  wikipedia: 'wikipedia',
  amazon: 'amazon',
  mercadolibre: 'mercadolibre',
  docs: 'googledrive',
  discord: 'discord',
  tumblr: 'tumblr',
  flickr: 'flickr',
  unsplash: 'unsplash',
  arxiv: 'arxiv',
  coursera: 'coursera',
  udemy: 'udemy',
  platzi: 'platzi',
  hackernews: 'ycombinator',
};

const paths = {};
for (const [code, slug] of Object.entries(SLUGS)) {
  const url = `https://cdn.jsdelivr.net/npm/simple-icons@13/icons/${slug}.svg`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svg = await res.text();
    const d = /<path[^>]*\sd="([^"]+)"/.exec(svg)?.[1];
    if (!d) throw new Error('sin path');
    paths[code] = d;
    console.log(`✓ ${code.padEnd(14)} ${slug.padEnd(14)} ${(d.length / 1024).toFixed(1)} kB`);
  } catch (err) {
    console.log(`✗ ${code.padEnd(14)} ${slug.padEnd(14)} ${err.message}`);
  }
}

const header = `/* Iconos de marca generados con tools/fetch-platform-icons.mjs.
 * Fuente: Simple Icons (simpleicons.org) — CC0 1.0. No editar a mano.
 * Las marcas pertenecen a sus dueños; acá se usan como referencia visual sobria.
 */\n`;
const body = `export const PLATFORM_PATHS = ${JSON.stringify(paths, null, 2)};\n`;
await writeFile(OUT, header + body);
console.log(`\n${Object.keys(paths).length} iconos → static/app/platform-icons.js`);
