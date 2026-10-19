/**
 * Descarga las tipografías de Google Fonts y las deja self-hosted en static/fonts.
 *
 * Uso:  node tools/fetch-fonts.mjs
 *
 * Por qué self-hosted: la app debe abrir rápido y funcionar sin pedirle nada a
 * terceros (privacidad + PWA/offline). El CSS generado queda en
 * static/app/fonts.css y se referencia desde index.html.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS_DIR = join(ROOT, 'static', 'fonts');
const CSS_OUT = join(ROOT, 'static', 'app', 'fonts.css');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const FAMILIES = [
  {
    id: 'fraunces',
    css: 'Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700',
    style: 'both',
    subsets: ['latin', 'latin-ext'],
  },
  {
    id: 'inter-tight',
    css: 'Inter+Tight:wght@400..700',
    style: 'normal',
    subsets: ['latin', 'latin-ext'],
  },
  {
    id: 'jetbrains-mono',
    css: 'JetBrains+Mono:wght@400..600',
    style: 'normal',
    subsets: ['latin', 'latin-ext'],
  },
];

const SUBSET_NAMES = {
  latin: 'latin',
  'latin-ext': 'latin-ext',
};

async function getCss(cssQuery) {
  const url = `https://fonts.googleapis.com/css2?family=${cssQuery}&display=swap&subset=latin,latin-ext`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Google Fonts respondió ${res.status} para ${cssQuery}`);
  return res.text();
}

function parseBlocks(css) {
  const blocks = [];
  const re = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/gi;
  let m;
  while ((m = re.exec(css))) {
    const subset = m[1].toLowerCase();
    const body = m[2];
    const src = /url\((https:\/\/[^)]+\.woff2)\)/.exec(body);
    if (!src) continue;
    const style = /font-style:\s*([a-z]+)/i.exec(body)?.[1] ?? 'normal';
    const weight = /font-weight:\s*([0-9. ]+)/i.exec(body)?.[1]?.trim() ?? '400';
    const range = /unicode-range:\s*([^;]+);/i.exec(body)?.[1]?.trim() ?? '';
    blocks.push({ subset, url: src[1], style, weight, range });
  }
  return blocks;
}

async function main() {
  await mkdir(FONTS_DIR, { recursive: true });
  await mkdir(dirname(CSS_OUT), { recursive: true });

  const faces = [];

  for (const family of FAMILIES) {
    const css = await getCss(family.css);
    const blocks = parseBlocks(css).filter((b) => {
      if (!family.subsets.includes(b.subset)) return false;
      if (family.style !== 'both' && b.style !== 'normal') return false;
      return true;
    });

    for (const block of blocks) {
      const fileName = `${family.id}-${block.subset}${block.style === 'italic' ? '-italic' : ''}.woff2`;
      const res = await fetch(block.url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`No se pudo bajar ${block.url}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(join(FONTS_DIR, fileName), buf);
      const familyName = family.id === 'fraunces' ? 'Fraunces' : family.id === 'inter-tight' ? 'Inter Tight' : 'JetBrains Mono';
      faces.push({
        family: familyName,
        style: block.style,
        weight: block.weight,
        range: block.range,
        file: fileName,
        size: buf.length,
      });
      console.log(`✓ ${fileName}  ${(buf.length / 1024).toFixed(1)} kB  ${block.weight} ${block.style}`);
    }
  }

  const cssOut = [
    '/* Tipografías self-hosted. Generado por tools/fetch-fonts.mjs — no editar a mano. */',
    ...faces.map(
      (f) => `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url('../fonts/${f.file}') format('woff2-variations');
  unicode-range: ${f.range};
}`,
    ),
    '',
  ].join('\n');

  await writeFile(CSS_OUT, cssOut);
  const total = faces.reduce((acc, f) => acc + f.size, 0);
  console.log(`\n${faces.length} archivos · ${(total / 1024).toFixed(0)} kB · CSS en static/app/fonts.css`);
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
