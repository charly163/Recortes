import { PLATFORM_PATHS } from './platform-icons.js';

/** Etiquetas sobrias: sin colores de marca, sólo nombre y marca. */
export const PLATFORM_LABELS = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  github: 'GitHub',
  pinterest: 'Pinterest',
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  bandcamp: 'Bandcamp',
  vimeo: 'Vimeo',
  twitch: 'Twitch',
  telegram: 'Telegram',
  threads: 'Threads',
  bluesky: 'Bluesky',
  medium: 'Medium',
  substack: 'Substack',
  notion: 'Notion',
  figma: 'Figma',
  behance: 'Behance',
  dribbble: 'Dribbble',
  codepen: 'CodePen',
  stackoverflow: 'Stack Overflow',
  wikipedia: 'Wikipedia',
  amazon: 'Amazon',
  mercadolibre: 'Mercado Libre',
  docs: 'Google Drive',
  discord: 'Discord',
  tumblr: 'Tumblr',
  flickr: 'Flickr',
  unsplash: 'Unsplash',
  arxiv: 'arXiv',
  coursera: 'Coursera',
  udemy: 'Udemy',
  platzi: 'Platzi',
  hackernews: 'Hacker News',
  web: 'Web',
};

/** Plataformas con icono propio disponible. */
const WITH_ICON = new Set(Object.keys(PLATFORM_PATHS));

export function platformLabel(code) {
  return PLATFORM_LABELS[code] || (code ? code[0].toUpperCase() + code.slice(1) : 'Web');
}

export function platformIcon(code, className = 'ic ic--brand') {
  const path = PLATFORM_PATHS[code];
  if (path) {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}" fill="currentColor"/></svg>`;
  }
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5s1.2-6.2 3.6-8.5z"/></svg>`;
}

export function hasPlatformIcon(code) {
  return WITH_ICON.has(code);
}

/** Orden curado para los filtros: primero las redes que más se usan para guardar cosas. */
export const PLATFORM_ORDER = [
  'youtube', 'instagram', 'tiktok', 'x', 'facebook', 'linkedin', 'reddit', 'github',
  'pinterest', 'spotify', 'vimeo', 'twitch', 'threads', 'bluesky', 'telegram', 'medium',
  'substack', 'notion', 'figma', 'behance', 'dribbble', 'codepen', 'stackoverflow',
  'wikipedia', 'soundcloud', 'bandcamp', 'docs', 'amazon', 'mercadolibre', 'discord',
  'tumblr', 'flickr', 'unsplash', 'arxiv', 'coursera', 'udemy', 'platzi', 'hackernews', 'web',
];
