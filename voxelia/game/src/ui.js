import { BLOCKS, PLACEABLE } from './blocks.js';
import { blockIcon } from './textures.js';
import { ITEMS, isItem, itemIcon, itemName } from './items.js';
import { RECIPES, CATEGORIES, canCraft, ingredientsFor } from './recipes.js';

// Interfaz en HTML sobre el canvas: barra rápida, vida, inventario, menús, depuración.
export class UI {
  constructor(atlasCanvas, mode) {
    this.atlas = atlasCanvas;
    this.mode = mode;
    this.icons = {};
    for (const id of PLACEABLE) this.icons[id] = blockIcon(atlasCanvas, id, 48);
    this.$ = (s) => document.querySelector(s);
    this.hotbarEl = this.$('#hotbar');
    this.toastTimer = null;
  }
  icon(id) { return this.icons[id] ?? (this.icons[id] = isItem(id) ? itemIcon(id, 48) : blockIcon(this.atlas, id, 48)); }
  name(id) { return itemName(id, BLOCKS); }

  renderHotbar(slots, selected, wearOf = () => null) {
    this.hotbarEl.innerHTML = slots.map((s, i) => {
      const wear = s?.id ? wearOf(s.id) : null;
      // Barra de durabilidad: verde → amarillo → rojo a medida que se gasta.
      const bar = wear !== null && wear > 0 ? `<span class="dura"><i style="width:${Math.round((1 - wear) * 100)}%;background:hsl(${Math.round((1 - wear) * 120)},85%,50%)"></i></span>` : '';
      return `
      <div class="slot ${i === selected ? 'sel' : ''}" data-i="${i}">
        ${s && s.id ? `<img src="${this.icon(s.id)}" alt="${this.name(s.id)}">${this.mode === 'survival' ? `<span class="count">${s.count > 1 ? s.count : ''}</span>` : ''}` : ''}
        ${bar}<span class="key">${i + 1}</span>
      </div>`;
    }).join('');
    const cur = slots[selected];
    this.toast(cur?.id ? this.name(cur.id) : '', 1200, 'item-name');
  }

  renderHearts(health, max = 20) {
    const el = this.$('#hearts');
    if (this.mode !== 'survival') { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = Array.from({ length: Math.ceil(max / 2) }, (_, i) => {
      const v = health - i * 2;
      return `<span class="heart ${v >= 2 ? 'full' : v === 1 ? 'half' : 'empty'}"></span>`;
    }).join('');
  }

  renderAir(air, show) {
    const el = this.$('#bubbles');
    el.style.display = show ? 'flex' : 'none';
    if (show) el.innerHTML = Array.from({ length: 10 }, (_, i) => `<span class="bubble ${i < Math.ceil(air) ? '' : 'pop'}"></span>`).join('');
  }

  toast(text, ms = 2000, id = 'toast') {
    const el = this.$(`#${id}`);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('show', !!text);
    clearTimeout(el._t);
    if (text) el._t = setTimeout(() => el.classList.remove('show'), ms);
  }

  renderInventory(onPick, inventory) {
    const grid = this.$('#inv-grid');
    const items = this.mode === 'survival'
      ? Object.entries(inventory).filter(([, n]) => n > 0).map(([id, n]) => ({ id: Number(id), n }))
      : PLACEABLE.map((id) => ({ id }));
    grid.innerHTML = items.length ? items.map((it) => `
      <button class="inv-item" data-id="${it.id}" title="${this.name(it.id)}">
        <img src="${this.icon(it.id)}" alt=""><span>${this.name(it.id)}${it.n ? ` × ${it.n}` : ''}</span>
      </button>`).join('') : '<p class="muted">Todavía no juntaste bloques. Rompé bloques para conseguirlos.</p>';
    grid.querySelectorAll('.inv-item').forEach((b) => b.addEventListener('click', () => onPick(Number(b.dataset.id))));
  }

  setBreakProgress(p) {
    const el = this.$('#break');
    el.style.display = p > 0 ? 'block' : 'none';
    el.style.setProperty('--p', `${Math.round(p * 360)}deg`);
  }

  // Taller: pestañas por categoría, grilla de recetas y panel de detalle con lo que tenés y lo que falta.
  // opts: { cat, sel, onCat(cat), onSelect(id), onCraft(recipe, veces), maxTimes(recipe) }
  renderCraft(inventory, state, opts) {
    const $ = this.$;
    $('#craft-station').innerHTML = state.nearBench
      ? '<span class="station on">Mesa de trabajo cerca · todas las recetas</span>'
      : '<span class="station">A mano · acercate a una Mesa de trabajo (clic derecho) para herramientas y mejoras</span>';
    $('#craft-tabs').innerHTML = CATEGORIES.map((c) => {
      const n = RECIPES.filter((r) => (c.id === 'all' || r.cat === c.id) && canCraft(r, inventory, state)).length;
      return `<button class="tab ${opts.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${c.name}${n ? `<em>${n}</em>` : ''}</button>`;
    }).join('');
    const list = RECIPES.filter((r) => opts.cat === 'all' || r.cat === opts.cat);
    // Primero lo que se puede fabricar.
    list.sort((a, b) => Number(canCraft(b, inventory, state)) - Number(canCraft(a, inventory, state)));
    const sel = list.find((r) => r.id === opts.sel) ?? list[0];
    const outIcon = (r, big) => (r.special === 'heart' ? `<span class="heart full ${big ? 'big' : 'mid'}"></span>` : `<img src="${this.icon(Number(Object.keys(r.out)[0]))}" alt="">`);
    $('#craft-list').innerHTML = list.map((r) => {
      const ok = canCraft(r, inventory, state);
      const locked = r.mesa && !state.nearBench;
      const qty = r.special ? '' : Object.values(r.out)[0];
      return `<button class="rcard ${ok ? 'ok' : ''} ${locked ? 'locked' : ''} ${sel?.id === r.id ? 'sel' : ''}" data-id="${r.id}" title="${r.name}">
        ${outIcon(r)}${qty > 1 ? `<span class="count">${qty}</span>` : ''}${locked ? '<span class="lock">⚒</span>' : ''}<span class="rname">${r.name}</span></button>`;
    }).join('');
    if (sel) {
      const ok = canCraft(sel, inventory, state);
      const use = ingredientsFor(sel, inventory) ?? sel.in;
      const times = opts.maxTimes(sel);
      const ing = Object.entries(use).map(([id, n]) => {
        const have = inventory[id] ?? 0;
        return `<div class="ing ${have >= n ? 'ok' : 'miss'}"><img src="${this.icon(Number(id))}" alt=""><span>${this.name(Number(id))}</span><b>${have}/${n}</b></div>`;
      }).join('');
      const why = sel.mesa && !state.nearBench ? 'Necesita una Mesa de trabajo cerca.'
        : sel.once && (inventory[Object.keys(sel.out)[0]] ?? 0) > 0 ? 'Ya lo tenés.'
          : sel.special === 'heart' && (state.maxHealth ?? 20) >= 30 ? 'Ya llegaste al máximo de corazones.'
            : !ok ? 'Te faltan materiales.' : '';
      $('#craft-detail').innerHTML = `
        <div class="d-head">${outIcon(sel, true)}<div><h3>${sel.name}${sel.special ? '' : ` ×${Object.values(sel.out)[0]}`}</h3><p>${sel.desc ?? ''}</p></div></div>
        <div class="d-ings"><small>Materiales</small>${ing}</div>
        ${why ? `<p class="why">${why}</p>` : ''}
        <div class="d-actions">
          <button class="mc-btn primary" data-craft="1" ${ok ? '' : 'disabled'}>Fabricar</button>
          ${times > 1 ? `<button class="mc-btn" data-craft="${times}">Fabricar todo (×${times})</button>` : ''}
        </div>`;
      $('#craft-detail').querySelectorAll('[data-craft]').forEach((b) => b.addEventListener('click', () => opts.onCraft(sel, Number(b.dataset.craft))));
    }
    $('#craft-tabs').querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => opts.onCat(b.dataset.cat)));
    $('#craft-list').querySelectorAll('[data-id]').forEach((b) => {
      b.addEventListener('click', () => opts.onSelect(b.dataset.id));
      b.addEventListener('dblclick', () => { const r = RECIPES.find((x) => x.id === b.dataset.id); if (canCraft(r, inventory, state)) opts.onCraft(r, 1); });
    });
  }

  renderMission(status) {
    const el = this.$('#mission');
    if (this.mode !== 'survival') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    if (!status.current) { el.innerHTML = `<b>¡Completaste todas las misiones!</b><small>${status.done}/${status.total} · Seguí explorando y construyendo.</small>`; return; }
    const m = status.current;
    el.innerHTML = `<span class="m-count">Misión ${status.number}/${status.total} · ${status.done} cumplidas</span><b>${m.title}</b><div class="m-bar"><div style="width:${(status.value / m.goal) * 100}%"></div></div><small>${m.hint}</small>`;
  }

  renderStamina(v, show) {
    const el = this.$('#stamina');
    el.style.display = show ? 'block' : 'none';
    if (show) { el.firstElementChild.style.width = `${v}%`; el.classList.toggle('low', v < 20); }
  }

  debug(text) { this.$('#debug').textContent = text; }
  show(sel, on) { this.$(sel).classList.toggle('open', on); }
}
