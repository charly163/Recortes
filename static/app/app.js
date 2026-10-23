import { icon, categoryIcon, CATEGORY_ICONS, CATEGORY_ICON_LABELS } from './icons.js';
import { platformIcon, platformLabel, PLATFORM_ORDER } from './platforms.js';

const $ = (s, root = document) => root.querySelector(s);
const state = { data: null, categoryId: null, platform: '', query: '', dialog: null, busy: false };
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => state.data.categories.find(c => c.id === id);
const rootCats = () => state.data.categories.filter(c => !c.parentId);
const children = id => state.data.categories.filter(c => c.parentId === id);
const countFor = id => state.data.links.filter(l => l.categoryId === id || children(id).some(c => c.id === l.categoryId)).length;

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...(opts.body ? {'Content-Type':'application/json'} : {}), ...opts.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
const post = (path, body) => api(path, { method:'POST', body:JSON.stringify(body) });
const patch = (path, body) => api(path, { method:'PATCH', body:JSON.stringify(body) });

function toast(message, error = false) {
  const root = $('#toast-root');
  root.innerHTML = `<div class="toast${error?' toast--error':''}">${icon(error?'alert':'check')}<span>${esc(message)}</span></div>`;
  setTimeout(() => { root.innerHTML = ''; }, 2800);
}

function applyTheme() {
  const pref = state.data?.settings?.theme || localStorage.getItem('recortes-theme') || 'auto';
  const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-toggle').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#theme-toggle').title = dark ? 'Usar tema claro' : 'Usar tema oscuro';
}

function categoryTree(active = state.categoryId) {
  const allCount = state.data.links.length;
  return `<button class="tree-item ${!active?'is-active':''}" data-category="" type="button">${icon('grid')}<span>Todos los recortes</span><small>${allCount}</small></button>` + rootCats().map(c => `<div class="tree-group"><button class="tree-item ${active===c.id?'is-active':''}" data-category="${c.id}" type="button">${categoryIcon(c.icon)}<span>${esc(c.name)}</span><small>${countFor(c.id)}</small></button>${children(c.id).map(ch => `<button class="tree-item tree-item--child ${active===ch.id?'is-active':''}" data-category="${ch.id}" type="button"><span class="tree-dash">↳</span><span>${esc(ch.name)}</span><small>${state.data.links.filter(l=>l.categoryId===ch.id).length}</small></button>`).join('')}</div>`).join('');
}

function renderSidebar() {
  $('#sidebar').innerHTML = `<div class="sidebar-label eyebrow">Biblioteca</div><nav class="tree">${categoryTree()}</nav><div class="sidebar-foot"><button class="btn btn--ghost btn--block" data-action="new-category" type="button">${icon('folder-plus')} Nueva carpeta</button><button class="btn btn--ghost btn--block" data-action="categories" type="button">${icon('pencil')} Administrar carpetas</button></div>`;
}

function renderCategoryOptions() {
  const select = $('#category-filter');
  if (!select) return;
  const current = state.categoryId || '';
  const opts = rootCats().map(c => {
    const count = countFor(c.id);
    const subOpts = children(c.id).map(ch => {
      const chCount = state.data.links.filter(l => l.categoryId === ch.id).length;
      return `<option value="${ch.id}" ${current === ch.id ? 'selected' : ''}>　↳ ${esc(ch.name)} (${chCount})</option>`;
    }).join('');
    return `<option value="${c.id}" ${current === c.id ? 'selected' : ''}>${esc(c.name)} (${count})</option>${subOpts}`;
  }).join('');
  select.innerHTML = `<option value="">Todas las carpetas</option>${opts}`;
  select.value = current;
  select.classList.toggle('is-filtered', Boolean(current));
}

function renderPlatformOptions() {
  const found = new Set(state.data.links.map(l => l.platform));
  const opts = PLATFORM_ORDER.filter(p => found.has(p)).map(p => `<option value="${esc(p)}">${esc(platformLabel(p))}</option>`).join('');
  $('#platform-filter').innerHTML = `<option value="">Todas las plataformas</option>${opts}`;
  $('#platform-filter').value = state.platform;
  $('#platform-filter').classList.toggle('is-filtered', Boolean(state.platform));
}

function visibleLinks() {
  const q = state.query.trim().toLocaleLowerCase('es');
  return state.data.links.filter(l => {
    const categoryOk = !state.categoryId || l.categoryId === state.categoryId || (byId(state.categoryId) && !byId(state.categoryId).parentId && byId(l.categoryId)?.parentId === state.categoryId);
    const cat = byId(l.categoryId);
    const parentCat = cat?.parentId ? byId(cat.parentId) : null;
    const catText = `${cat ? cat.name : ''} ${parentCat ? parentCat.name : ''}`;
    const text = `${l.title} ${l.domain} ${l.note} ${l.description} ${catText}`.toLocaleLowerCase('es');
    return categoryOk && (!state.platform || l.platform === state.platform) && (!q || text.includes(q));
  });
}

function card(link) {
  const cat = byId(link.categoryId);
  const parent = cat?.parentId ? byId(cat.parentId) : null;
  return `<article class="recorte" data-id="${link.id}">
    <a class="recorte__hit" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">
      <div class="thumb">${link.thumbUrl?`<img src="${esc(link.thumbUrl)}" alt="" loading="lazy">`:`<div class="thumb--empty">${platformIcon(link.platform)}</div>`}</div>
      <div class="recorte__body">
        <div class="platform-line">
          ${platformIcon(link.platform)}
          <span>${esc(platformLabel(link.platform))}</span>
          ${cat?`<span class="recorte__category" data-filter-cat="${cat.id}" title="Filtrar por ${esc(cat.name)}">${esc(parent?parent.name+' / '+cat.name:cat.name)}</span>`:''}
        </div>
        <h3 class="recorte__title">${esc(link.title)}</h3>
        <span class="recorte__domain">${esc(link.domain)}</span>
        ${link.note?`<p class="recorte__note">${esc(link.note)}</p>`:''}
      </div>
    </a>
    <button class="recorte__edit" data-edit="${link.id}" type="button" aria-label="Editar ${esc(link.title)}">${icon('more')}</button>
  </article>`;
}

function render() {
  if (!state.data) return;
  renderSidebar();
  renderCategoryOptions();
  renderPlatformOptions();
  const links = visibleLinks();
  const selected = byId(state.categoryId);
  $('#collection-title').textContent = selected ? selected.name : (state.query ? `Resultados para "${state.query}"` : (state.platform ? platformLabel(state.platform) : 'Todos los recortes'));
  $('#result-count').textContent = `${links.length} ${links.length===1?'recorte':'recortes'}`;
  $('#active-filters').innerHTML = `${selected?`<button class="chip" data-category="">📁 ${esc(selected.name)} ×</button>`:''}${state.platform?`<button class="chip" data-clear-platform="1">◎ ${esc(platformLabel(state.platform))} ×</button>`:''}`;
  $('#cards').innerHTML = links.length ? links.map(card).join('') : `<div class="empty empty--inline"><div class="empty__art">${icon('scissors')}</div><h2 class="empty__title">${state.query||state.platform||selected?'No encontramos recortes':'La carpeta está lista.'}</h2><p class="empty__text">${state.query||state.platform||selected?'Probá con otra búsqueda o filtro.':'Pegá un link y guardá tu primer hallazgo.'}</p>${!state.query&&!state.platform?'<button class="btn btn--accent btn--lg" data-action="add" type="button">＋ Guardar un link</button>':''}</div>`;

  document.querySelectorAll('.bottomnav__item').forEach(btn => {
    if (btn.dataset.nav === 'all') {
      btn.classList.toggle('is-active', !state.categoryId);
    } else if (btn.dataset.action === 'categories') {
      btn.classList.toggle('is-active', Boolean(state.categoryId));
    }
  });
}

function openDialog(html) { $('#overlay-root').innerHTML = `<div class="scrim"><section class="sheet" role="dialog" aria-modal="true">${html}</section></div>`; state.dialog = true; document.body.style.overflow='hidden'; $('.sheet input')?.focus(); }
function closeDialog() { $('#overlay-root').innerHTML=''; state.dialog=false; document.body.style.overflow=''; }

function categorySelect(selected = '') {
  return `<select class="select" name="categoryId"><option value="">Sin carpeta</option>${rootCats().map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''}>${esc(c.name)}</option>${children(c.id).map(ch=>`<option value="${ch.id}" ${selected===ch.id?'selected':''}>　↳ ${esc(ch.name)}</option>`).join('')}`).join('')}</select>`;
}

function addDialog() {
  openDialog(`<div class="sheet__grab"></div><form id="add-form"><header class="sheet__head"><div class="sheet__heading"><span class="sheet__eyebrow">Nuevo recorte</span><h2 class="sheet__title">Guardar un link</h2></div><button class="btn btn--icon btn--ghost" data-close="1" type="button" aria-label="Cerrar">${icon('x')}</button></header><div class="sheet__body"><label class="field"><span class="field__label">URL</span><div class="input-row"><input class="input input--mono" name="url" type="url" placeholder="https://…" required autocomplete="url"><button class="btn btn--outline" id="preview-btn" type="button">Vista previa</button></div></label><div id="preview-result" class="preview-result" hidden></div><label class="field"><span class="field__label">Título</span><input class="input input--title" name="title" placeholder="Se completa al traer la vista previa"></label><label class="field"><span class="field__label">Carpeta</span>${categorySelect(state.categoryId||'')}</label><label class="field"><span class="field__label">Nota personal</span><textarea class="textarea" name="note" placeholder="¿Qué querés recordar?"></textarea></label></div><footer class="sheet__foot"><button class="btn btn--outline" data-close="1" type="button">Cancelar</button><button class="btn btn--accent btn--lg btn--block" type="submit">Guardar recorte</button></footer></form>`);
}

async function getPreview() {
  const form = $('#add-form'); const url = form.elements.url.value.trim(); if (!url) { form.elements.url.focus(); return; }
  const btn = $('#preview-btn'); btn.disabled=true; btn.textContent='Buscando…';
  try {
    const p = await post('/api/preview',{url});
    form.elements.title.value=p.title||'';
    $('#preview-result').hidden=false;
    $('#preview-result').innerHTML=`${p.imageToken?`<img src="/api/preview-image/${p.imageToken}" alt="">`:'<div class="thumb--empty">⌁</div>'}<div><strong>${esc(p.title)}</strong><span>${esc(platformLabel(p.platform))} · ${esc(p.domain)}</span></div>`;
    form.dataset.preview=JSON.stringify(p);
  } catch(e) {
    toast(e.message,true);
  } finally {
    btn.disabled=false;
    btn.textContent='Vista previa';
  }
}

function editDialog(id) {
  const l=state.data.links.find(x=>x.id===id); if(!l)return;
  openDialog(`<div class="sheet__grab"></div><form id="edit-form" data-id="${id}"><header class="sheet__head"><div class="sheet__heading"><span class="sheet__eyebrow">Editar recorte</span><h2 class="sheet__title">Ajustá tu ficha</h2></div><button class="btn btn--icon btn--ghost" data-close="1" type="button" aria-label="Cerrar">${icon('x')}</button></header><div class="sheet__body"><label class="field"><span class="field__label">Título</span><input class="input input--title" name="title" value="${esc(l.title)}" required></label><label class="field"><span class="field__label">Carpeta</span>${categorySelect(l.categoryId||'')}</label><label class="field"><span class="field__label">Nota personal</span><textarea class="textarea" name="note">${esc(l.note||'')}</textarea></label><a class="btn btn--ghost" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${icon('arrow-up-right')} Abrir enlace</a></div><footer class="sheet__foot"><button class="btn btn--danger" id="delete-link" type="button">${icon('trash')} Borrar</button><button class="btn btn--accent btn--lg btn--block" type="submit">Guardar cambios</button></footer></form>`);
}

function manageCategoriesDialog() {
  const allCount = state.data.links.length;
  const isAllActive = !state.categoryId;
  const allRow = `<div class="manage-category ${isAllActive ? 'is-active' : ''}">
    <button class="manage-category__select ${isAllActive ? 'is-active' : ''}" data-select-category="" type="button">
      <span class="manage-category__icon">${icon('grid')}</span>
      <span class="manage-category__name"><strong>Todos los recortes</strong></span>
      <span class="manage-category__count">${allCount}</span>
    </button>
  </div>`;

  const rows = rootCats().map(c => {
    const isRootActive = state.categoryId === c.id;
    const rootRow = `<div class="manage-category ${isRootActive ? 'is-active' : ''}">
      <button class="manage-category__select ${isRootActive ? 'is-active' : ''}" data-select-category="${c.id}" type="button">
        <span class="manage-category__icon">${categoryIcon(c.icon)}</span>
        <span class="manage-category__name">${esc(c.name)}</span>
        <span class="manage-category__count">${countFor(c.id)}</span>
      </button>
      <div class="manage-category__actions">
        <button class="btn btn--icon btn--ghost" data-rename-category="${c.id}" type="button" aria-label="Cambiar nombre de ${esc(c.name)}" title="Editar carpeta">${icon('pencil')}</button>
        <button class="btn btn--icon btn--ghost btn--danger" data-delete-category="${c.id}" type="button" aria-label="Borrar ${esc(c.name)}" title="Borrar carpeta">${icon('trash')}</button>
      </div>
    </div>`;

    const childRows = children(c.id).map(ch => {
      const isChildActive = state.categoryId === ch.id;
      const count = state.data.links.filter(l => l.categoryId === ch.id).length;
      return `<div class="manage-category manage-category--child ${isChildActive ? 'is-active' : ''}">
        <button class="manage-category__select ${isChildActive ? 'is-active' : ''}" data-select-category="${ch.id}" type="button">
          <span class="manage-category__icon tree-dash">↳</span>
          <span class="manage-category__name">${esc(ch.name)}</span>
          <span class="manage-category__count">${count}</span>
        </button>
        <div class="manage-category__actions">
          <button class="btn btn--icon btn--ghost" data-rename-category="${ch.id}" type="button" aria-label="Cambiar nombre de ${esc(ch.name)}" title="Editar carpeta">${icon('pencil')}</button>
          <button class="btn btn--icon btn--ghost btn--danger" data-delete-category="${ch.id}" type="button" aria-label="Borrar ${esc(ch.name)}" title="Borrar carpeta">${icon('trash')}</button>
        </div>
      </div>`;
    }).join('');

    return rootRow + childRows;
  }).join('');

  openDialog(`<div class="sheet__grab"></div>
    <header class="sheet__head">
      <div class="sheet__heading">
        <span class="sheet__eyebrow">Organizar archivo</span>
        <h2 class="sheet__title">Carpetas</h2>
      </div>
      <button class="btn btn--icon btn--ghost" data-close="1" type="button" aria-label="Cerrar">${icon('x')}</button>
    </header>
    <div class="sheet__body">
      <p class="field__hint">Tocá una carpeta para filtrar tus recortes, o usá los botones para editarla o borrarla.</p>
      <div class="manage-category-list">${allRow}${rows || '<p class="empty__text">Todavía no hay carpetas.</p>'}</div>
    </div>
    <footer class="sheet__foot">
      <button class="btn btn--outline" data-close="1" type="button">Listo</button>
      <button class="btn btn--accent btn--lg btn--block" data-action="new-category" type="button">＋ Nueva carpeta</button>
    </footer>`);
}

function iconPicker(selected='folder') {
  return `<div class="field"><span class="field__label">Icono</span><input type="hidden" name="icon" value="${esc(selected)}"><div class="icon-picker">${CATEGORY_ICONS.map(name => `<button class="icon-picker__item ${name===selected?'is-selected':''}" data-category-icon="${name}" type="button" aria-label="${esc(CATEGORY_ICON_LABELS[name])}" aria-pressed="${name===selected}">${categoryIcon(name)}</button>`).join('')}</div></div>`;
}

function renameCategoryDialog(id) {
  const c=byId(id); if(!c)return;
  openDialog(`<div class="sheet__grab"></div><form id="rename-category-form" data-id="${id}"><header class="sheet__head"><div class="sheet__heading"><span class="sheet__eyebrow">Editar carpeta</span><h2 class="sheet__title">Cambiar nombre</h2></div><button class="btn btn--icon btn--ghost" data-close="1" type="button" aria-label="Cerrar">${icon('x')}</button></header><div class="sheet__body"><label class="field"><span class="field__label">Nombre</span><input class="input" name="name" maxlength="60" required value="${esc(c.name)}"></label>${iconPicker(c.icon)}</div><footer class="sheet__foot"><button class="btn btn--outline" data-close="1" type="button">Cancelar</button><button class="btn btn--accent btn--lg btn--block" type="submit">Guardar carpeta</button></footer></form>`);
}

function deleteCategoryDialog(id) {
  const c=byId(id); if(!c)return;
  const subcats=children(id); const affected=state.data.links.filter(l=>l.categoryId===id||subcats.some(ch=>ch.id===l.categoryId)).length;
  openDialog(`<div class="sheet__grab"></div><header class="sheet__head"><div class="sheet__heading"><span class="sheet__eyebrow">Borrar carpeta</span><h2 class="sheet__title">${esc(c.name)}</h2></div><button class="btn btn--icon btn--ghost" data-close="1" type="button" aria-label="Cerrar">${icon('x')}</button></header><div class="sheet__body"><p>Esta carpeta tiene ${subcats.length} subcategorías y ${affected} recortes.</p><p class="field__hint">Podés mover los recortes a la carpeta superior o borrar también los recortes y subcategorías.</p></div><footer class="sheet__foot delete-options"><button class="btn btn--outline" data-close="1" type="button">Cancelar</button><button class="btn btn--outline" data-delete-category-mode="move" data-id="${id}" type="button">Mover recortes</button><button class="btn btn--danger" data-delete-category-mode="delete" data-id="${id}" type="button">Borrar todo</button></footer>`);
}

function categoryDialog(parentId='') {
  openDialog(`<div class="sheet__grab"></div><form id="category-form"><header class="sheet__head"><div class="sheet__heading"><span class="sheet__eyebrow">Organizar archivo</span><h2 class="sheet__title">Nueva carpeta</h2></div><button class="btn btn--icon btn--ghost" data-close="1" type="button" aria-label="Cerrar">${icon('x')}</button></header><div class="sheet__body"><label class="field"><span class="field__label">Nombre</span><input class="input" name="name" maxlength="60" required placeholder="Ej. Bases de datos"></label>${iconPicker()}<label class="field"><span class="field__label">Dentro de</span><select class="select" name="parentId"><option value="">Carpeta principal</option>${rootCats().map(c=>`<option value="${c.id}" ${parentId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><span class="field__hint">Elegí una carpeta para crear una subcategoría.</span></label></div><footer class="sheet__foot"><button class="btn btn--outline" data-close="1" type="button">Cancelar</button><button class="btn btn--accent btn--lg btn--block" type="submit">Crear carpeta</button></footer></form>`);
}

$('#search')?.addEventListener('input', e => {
  state.query = e.target.value;
  render();
  $('#search').focus();
});

$('#category-filter')?.addEventListener('change', e => {
  state.categoryId = e.target.value || null;
  render();
});

$('#platform-filter')?.addEventListener('change', e => {
  state.platform = e.target.value;
  render();
});

$('#theme-toggle')?.addEventListener('click', async () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  const theme = dark ? 'light' : 'dark';
  localStorage.setItem('recortes-theme', theme);
  try {
    await patch('/api/settings', { theme });
    state.data.settings.theme = theme;
  } catch {}
  applyTheme();
});

document.addEventListener('click', async e => {
  const filterCat = e.target.closest('[data-filter-cat]');
  if (filterCat) {
    e.preventDefault();
    e.stopPropagation();
    state.categoryId = filterCat.dataset.filterCat;
    render();
    return;
  }

  const selectCat = e.target.closest('[data-select-category]');
  if (selectCat) {
    state.categoryId = selectCat.dataset.selectCategory || null;
    closeDialog();
    render();
    return;
  }

  const cat = e.target.closest('[data-category]');
  if (cat) {
    state.categoryId = cat.dataset.category || null;
    render();
    return;
  }

  if (e.target.closest('[data-nav="all"]')) {
    state.categoryId = null;
    state.platform = '';
    state.query = '';
    if ($('#search')) $('#search').value = '';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (e.target.closest('[data-clear-platform]')) {
    state.platform = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="add"]')) {
    addDialog();
    return;
  }

  if (e.target.closest('[data-action="new-category"]')) {
    categoryDialog(state.categoryId && byId(state.categoryId) && !byId(state.categoryId).parentId ? state.categoryId : '');
    return;
  }

  if (e.target.closest('[data-action="categories"]')) {
    manageCategoriesDialog();
    return;
  }

  const iconButton = e.target.closest('[data-category-icon]');
  if (iconButton) {
    const form = iconButton.closest('form');
    form.elements.icon.value = iconButton.dataset.categoryIcon;
    form.querySelectorAll('[data-category-icon]').forEach(b => {
      const active = b === iconButton;
      b.classList.toggle('is-selected', active);
      b.setAttribute('aria-pressed', String(active));
    });
    return;
  }

  if (e.target.closest('[data-close]') || e.target.classList.contains('scrim')) {
    closeDialog();
    return;
  }

  const rename = e.target.closest('[data-rename-category]');
  if (rename) {
    renameCategoryDialog(rename.dataset.renameCategory);
    return;
  }

  const removeCat = e.target.closest('[data-delete-category]');
  if (removeCat) {
    deleteCategoryDialog(removeCat.dataset.deleteCategory);
    return;
  }

  const deleteMode = e.target.closest('[data-delete-category-mode]');
  if (deleteMode) {
    const id = deleteMode.dataset.id;
    const mode = deleteMode.dataset.deleteCategoryMode;
    try {
      const result = await api(`/api/categories/${id}?links=${mode}`, { method: 'DELETE' });
      state.data = result.state;
      if (state.categoryId === id || !byId(state.categoryId)) state.categoryId = null;
      closeDialog();
      render();
      toast(mode === 'delete' ? 'Carpeta y recortes borrados' : 'Carpeta borrada; recortes movidos');
    } catch (err) {
      toast(err.message, true);
    }
    return;
  }

  const edit = e.target.closest('[data-edit]');
  if (edit) {
    editDialog(edit.dataset.edit);
    return;
  }

  if (e.target.id === 'preview-btn') {
    getPreview();
    return;
  }

  if (e.target.id === 'delete-link') {
    const f = $('#edit-form');
    if (confirm('¿Borrar este recorte?')) {
      try {
        await api(`/api/links/${f.dataset.id}`, { method: 'DELETE' });
        state.data.links = state.data.links.filter(l => l.id !== f.dataset.id);
        closeDialog();
        render();
        toast('Recorte borrado');
      } catch (err) {
        toast(err.message, true);
      }
    }
  }
});

document.addEventListener('submit', async e => {
  if (e.target.id === 'add-form') {
    e.preventDefault();
    if (state.busy) return;
    state.busy = true;
    const f = e.target;
    const p = JSON.parse(f.dataset.preview || '{}');
    const payload = {
      url: f.elements.url.value,
      title: f.elements.title.value,
      categoryId: f.elements.categoryId.value,
      note: f.elements.note.value,
      ...(p.imageToken ? {
        previewToken: p.imageToken,
        imageUrl: p.imageSource,
        description: p.description,
        siteName: p.siteName,
        platform: p.platform,
      } : {}),
    };
    try {
      const result = await post('/api/links', payload);
      state.data.links.unshift(result.link);
      closeDialog();
      state.categoryId = payload.categoryId || null;
      render();
      toast('Link guardado en tu archivo');
    } catch (err) {
      toast(err.message, true);
    } finally {
      state.busy = false;
    }
  }

  if (e.target.id === 'edit-form') {
    e.preventDefault();
    const f = e.target;
    try {
      const result = await patch(`/api/links/${f.dataset.id}`, {
        title: f.elements.title.value,
        categoryId: f.elements.categoryId.value,
        note: f.elements.note.value,
      });
      state.data.links = state.data.links.map(l => l.id === result.link.id ? result.link : l);
      closeDialog();
      render();
      toast('Cambios guardados');
    } catch (err) {
      toast(err.message, true);
    }
  }

  if (e.target.id === 'category-form') {
    e.preventDefault();
    const f = e.target;
    try {
      const result = await post('/api/categories', {
        name: f.elements.name.value,
        parentId: f.elements.parentId.value || null,
        icon: f.elements.icon.value,
      });
      state.data.categories.push(result.category);
      closeDialog();
      render();
      toast('Carpeta creada');
    } catch (err) {
      toast(err.message, true);
    }
  }

  if (e.target.id === 'rename-category-form') {
    e.preventDefault();
    const f = e.target;
    try {
      const result = await patch('/api/categories/' + f.dataset.id, {
        name: f.elements.name.value,
        icon: f.elements.icon.value,
      });
      state.data.categories = state.data.categories.map(c => c.id === result.category.id ? result.category : c);
      render();
      manageCategoriesDialog();
      toast('Carpeta actualizada');
    } catch (err) {
      toast(err.message, true);
    }
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.dialog) closeDialog();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    $('#search')?.focus();
  }
});

async function load() {
  try {
    state.data = await api('/api/state');
    if (!state.data.settings.theme && localStorage.getItem('recortes-theme')) {
      state.data.settings.theme = localStorage.getItem('recortes-theme');
    }
    applyTheme();
    render();
  } catch (e) {
    $('#cards').innerHTML = `<div class="empty empty--inline"><h2 class="empty__title">No pudimos abrir tu archivo.</h2><p class="empty__text">${esc(e.message)}</p><button class="btn btn--outline" onclick="location.reload()">Volver a intentar</button></div>`;
  }
}
load();
