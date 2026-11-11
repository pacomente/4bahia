import { BLOCKS, PLACEABLE } from './blocks.js';
import { blockIcon } from './textures.js';
import { ITEMS, isItem, itemIcon, itemName } from './items.js';
import { RECIPES, canCraft, ingredientsFor } from './recipes.js';

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

  renderHotbar(slots, selected) {
    this.hotbarEl.innerHTML = slots.map((s, i) => `
      <div class="slot ${i === selected ? 'sel' : ''}" data-i="${i}">
        ${s && s.id ? `<img src="${this.icon(s.id)}" alt="${this.name(s.id)}">${this.mode === 'survival' ? `<span class="count">${s.count > 1 ? s.count : ''}</span>` : ''}` : ''}
        <span class="key">${i + 1}</span>
      </div>`).join('');
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

  // Taller: lista de recetas con ingredientes (tenés / necesitás).
  renderCraft(inventory, state, onCraft) {
    const list = this.$('#craft-list');
    list.innerHTML = RECIPES.map((r, i) => {
      const ok = canCraft(r, inventory, state);
      const use = ingredientsFor(r, inventory) ?? r.in;
      const outId = Number(Object.keys(r.out)[0]);
      const outIcon = r.special === 'heart' ? '' : `<img src="${this.icon(outId)}" alt="">`;
      const ing = Object.entries(use).map(([id, n]) => {
        const have = inventory[id] ?? 0;
        return `<span class="ing ${have >= n ? 'ok' : 'miss'}"><img src="${this.icon(Number(id))}" alt="">${have}/${n}</span>`;
      }).join('');
      const out = r.special === 'heart' ? '<span class="heart full big"></span>' : outIcon;
      const qty = r.special ? '' : ` ×${Object.values(r.out)[0]}`;
      return `<div class="recipe ${ok ? '' : 'locked'}"><div class="r-out">${out}</div><div class="r-body"><b>${r.name}${qty}</b><div class="ings">${ing}</div></div><button class="mc-btn small ${ok ? 'primary' : ''}" data-i="${i}" ${ok ? '' : 'disabled'}>Fabricar</button></div>`;
    }).join('');
    list.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => onCraft(RECIPES[Number(b.dataset.i)])));
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
