import { BLOCKS, PLACEABLE } from './blocks.js';
import { blockIcon } from './textures.js';

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
  icon(id) { return this.icons[id] ?? (this.icons[id] = blockIcon(this.atlas, id, 48)); }

  renderHotbar(slots, selected) {
    this.hotbarEl.innerHTML = slots.map((s, i) => `
      <div class="slot ${i === selected ? 'sel' : ''}" data-i="${i}">
        ${s && s.id ? `<img src="${this.icon(s.id)}" alt="${BLOCKS[s.id].name}">${this.mode === 'survival' ? `<span class="count">${s.count > 1 ? s.count : ''}</span>` : ''}` : ''}
        <span class="key">${i + 1}</span>
      </div>`).join('');
    const cur = slots[selected];
    this.toast(cur?.id ? BLOCKS[cur.id].name : '', 1200, 'item-name');
  }

  renderHearts(health) {
    const el = this.$('#hearts');
    if (this.mode !== 'survival') { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = Array.from({ length: 10 }, (_, i) => {
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
      <button class="inv-item" data-id="${it.id}" title="${BLOCKS[it.id].name}">
        <img src="${this.icon(it.id)}" alt=""><span>${BLOCKS[it.id].name}${it.n ? ` × ${it.n}` : ''}</span>
      </button>`).join('') : '<p class="muted">Todavía no juntaste bloques. Rompé bloques para conseguirlos.</p>';
    grid.querySelectorAll('.inv-item').forEach((b) => b.addEventListener('click', () => onPick(Number(b.dataset.id))));
  }

  setBreakProgress(p) {
    const el = this.$('#break');
    el.style.display = p > 0 ? 'block' : 'none';
    el.style.setProperty('--p', `${Math.round(p * 360)}deg`);
  }

  debug(text) { this.$('#debug').textContent = text; }
  show(sel, on) { this.$(sel).classList.toggle('open', on); }
}
