/* Iconografía de interfaz: trazo fino 1.7, 24×24. Las marcas de plataforma viven en
   platform-icons.js (rellenas, un solo color) para que no compitan con el contenido. */

const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  'arrow-left': '<path d="M20 12H4"/><path d="m11 19-7-7 7-7"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  'folder-plus': '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M12 12v6M9 15h6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  book: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v20H7.5A2.5 2.5 0 0 1 5 19.5z"/><path d="M5 16.5h15"/><path d="M9 7h7"/>',
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/><path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
  wrench: '<path d="M15.5 3.5a5 5 0 0 0-4.6 7L4 17.4V20h2.6l6.9-6.9a5 5 0 0 0 7-4.6l-2.9 2.9-2.5-2.5z"/>',
  spark: '<path d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6L5.7 9.8l4.6-1.7z"/><path d="m18.5 15 .7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  code: '<path d="m8.5 8-4.5 4 4.5 4"/><path d="m15.5 8 4.5 4-4.5 4"/>',
  video: '<rect x="3" y="6" width="12.5" height="12" rx="2.5"/><path d="m15.5 12 5.5-3.5v10L15.5 15z"/>',
  music: '<path d="M9 17.5V5.5l10-2v12"/><circle cx="6.8" cy="18" r="2.4"/><circle cx="16.8" cy="16" r="2.4"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m21 15-4.8-4.8L5.5 20"/>',
  link: '<path d="M10.2 13.8a4.5 4.5 0 0 0 6.4 0l2-2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1"/><path d="M13.8 10.2a4.5 4.5 0 0 0-6.4 0l-2 2a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1"/>',
  star: '<path d="m12 3.5 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.7 10.7c.5.4.7 1 .7 1.6V16h6v-.7c0-.6.2-1.2.7-1.6A6 6 0 0 0 12 3z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  cart: '<path d="M3 4h2.2l2.3 11h11L21 7H6"/><circle cx="9.2" cy="19.5" r="1.5"/><circle cx="17.5" cy="19.5" r="1.5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.5a4.1 4.1 0 0 1 7.5 3.1C19.5 15.4 12 20 12 20z"/>',
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5"/>',
  check: '<path d="m4.5 12.5 4.5 4.5L20 6.5"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10.5 11v5M13.5 11v5"/>',
  pencil: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 6.5 3 3"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  filter: '<path d="M3.5 5.5h17l-6.5 7.6V20l-4 1.5v-8.4z"/>',
  sort: '<path d="M4 6.5h9M4 12h6M4 17.5h4"/><path d="M17 5.5v13M14 15.5l3 3 3-3"/>',
  download: '<path d="M12 3.5v11.5"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 20.5h15"/>',
  upload: '<path d="M12 15V3.5"/><path d="m7.5 8 4.5-4.5L16.5 8"/><path d="M4.5 20.5h15"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6"/>',
  install: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M12 6.5v7M9 11l3 3 3-3"/><path d="M10.5 19h3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".9" fill="currentColor" stroke="none"/>',
  alert: '<path d="M12 3.5 21 20H3z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  scissors: '<circle cx="6" cy="7" r="2.4"/><circle cx="6" cy="17" r="2.4"/><path d="M8.2 8.4 20 18M8.2 15.6 20 6"/>',
  paperclip: '<path d="M9 13.5 15.5 7a3.2 3.2 0 0 1 4.5 4.5l-7.5 7.5a5.2 5.2 0 0 1-7.4-7.4l7-7"/>',
  tag: '<path d="M3.5 12V4.5H11l9 9-6.5 6.5z"/><circle cx="7.5" cy="8" r="1.2"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4.5V10h-5.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5s1.2-6.2 3.6-8.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
};

export function icon(name, className = 'ic') {
  const body = PATHS[name] || PATHS.link;
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const CATEGORY_ICONS = ['folder', 'clock', 'book', 'database', 'wrench', 'spark', 'code', 'video', 'music', 'image', 'star', 'bulb', 'chart', 'cart', 'heart', 'pin'];

export const CATEGORY_ICON_LABELS = {
  folder: 'Carpeta',
  clock: 'Para después',
  book: 'Curso o libro',
  database: 'Datos',
  wrench: 'Herramientas',
  spark: 'Inspiración',
  code: 'Código',
  video: 'Video',
  music: 'Música',
  image: 'Imagen',
  star: 'Favorito',
  bulb: 'Idea',
  chart: 'Análisis',
  cart: 'Compra',
  heart: 'Me gusta',
  pin: 'Lugar',
};

export function categoryIcon(name, className = 'ic') {
  return icon(PATHS[name] ? name : 'folder', className);
}
