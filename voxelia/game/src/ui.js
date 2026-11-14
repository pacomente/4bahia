import { BLOCKS, PLACEABLE } from './blocks.js';
import { blockIcon } from './textures.js';
import { ITEMS, isItem, itemIcon, itemName, SLOT_NAMES, armorReduction } from './items.js';
import { RECIPES, CATEGORIES, canCraft, ingredientsFor } from './recipes.js';

// Retrato pixel-art del aldeano (cara, pelo, barba y sombrero) para la ventana de diálogo.
function portrait(look, child, king = false) {
  const c = document.createElement('canvas'); c.width = c.height = 12;
  const g = c.getContext('2d');
  g.fillStyle = look.shirt; g.fillRect(0, 9, 12, 3);
  g.fillStyle = look.skin; g.fillRect(2, 1, 8, 8);
  g.fillStyle = look.hair; g.fillRect(2, 1, 8, 2); g.fillRect(2, 3, 1, 2); g.fillRect(9, 3, 1, 2);
  if (look.hood && !child) { g.fillStyle = look.hatColor; g.fillRect(1, 0, 10, 2); g.fillRect(1, 2, 1, 6); g.fillRect(10, 2, 1, 6); }
  g.fillStyle = '#fff'; g.fillRect(3, 4, 2, 1); g.fillRect(7, 4, 2, 1);
  g.fillStyle = '#3a2a1a'; g.fillRect(4, 4, 1, 1); g.fillRect(7, 4, 1, 1);
  if (look.beard) { g.fillStyle = look.beard; g.fillRect(3, 6, 6, 3); }
  g.fillStyle = '#8a3b2b'; g.fillRect(5, 7, 2, 1);
  if (king) { g.fillStyle = '#e8c040'; g.fillRect(2, 0, 8, 1); g.fillRect(2, -1, 1, 1); g.fillRect(2, 0, 1, 1); for (const x of [2, 5, 6, 9]) g.fillRect(x, 0, 1, 1); g.fillStyle = '#c8352b'; g.fillRect(5, 0, 2, 1); }
  c.className = 'pixel';
  return c;
}

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

  renderInventory(onPick, inventory, eq = null) {
    // Equipo (solo supervivencia): casillas de armadura y escudo, con su desgaste.
    // Personaje con su equipo: casillas a los costados del modelo 3D (en creativo, solo el modelo).
    const slotsL = this.$('#equip-left'); const slotsR = this.$('#equip-right'); const infoEl = this.$('#equip-info');
    slotsL.style.display = slotsR.style.display = eq ? 'flex' : 'none';
    infoEl.innerHTML = eq ? '' : '<small>Modo creativo: todo infinito.</small>';
    if (eq) {
      const slotHtml = (slot) => {
        const id = eq.equip[slot]; const wear = eq.wear(slot);
        return `<button class="eq-slot ${id ? 'on' : ''}" data-slot="${slot}" title="${id ? `${this.name(id)} · clic para sacar` : SLOT_NAMES[slot]}">
          ${id ? `<img src="${this.icon(id)}" alt="">` : `<span class="eq-empty">${SLOT_NAMES[slot]}</span>`}
          ${id && wear > 0 ? `<span class="dura"><i style="width:${Math.round((1 - wear) * 100)}%;background:hsl(${Math.round((1 - wear) * 120)},85%,50%)"></i></span>` : ''}</button>`;
      };
      slotsL.innerHTML = ['head', 'chest', 'legs', 'feet'].map(slotHtml).join('');
      slotsR.innerHTML = slotHtml('offhand');
      infoEl.innerHTML = `<small>Armadura: <b>${eq.points}</b> · frena ${Math.round(armorReduction(eq.points) * 100)}% del daño</small><small>Clic en una armadura o escudo de la lista para ponértelo; clic en la casilla para sacarlo. Escudo: clic derecho sostenido o V.</small>`;
      for (const el of [slotsL, slotsR]) el.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => eq.unequip(b.dataset.slot)));
    }
    const grid = this.$('#inv-grid');
    const items = this.mode === 'survival'
      ? Object.entries(inventory).filter(([, n]) => n > 0).map(([id, n]) => ({ id: Number(id), n }))
      : [...PLACEABLE, ...Object.keys(ITEMS).map(Number)].map((id) => ({ id }));   // creativo: todos los bloques y todos los ítems
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

  // Ventana de un aldeano: retrato, oficio y personalidad, lo que dice, la aldea y sus trueques.
  renderVillager(info, inventory, mode, on) {
    const $ = this.$;
    $('#v-portrait').innerHTML = ''; $('#v-portrait').appendChild(portrait(info.look, info.child, info.king));
    $('#v-name').textContent = info.name;
    $('#v-sub').textContent = [info.profession, info.trait, `Ánimo: ${info.mood}`].filter(Boolean).join(' · ');
    $('#v-village').innerHTML = `${info.levelName} <b>${info.village}</b> (${info.style}) · ${info.pop}/${info.cap} habitantes · ${info.homes} casas${info.building ? ' · <span class="busy">construyendo</span>' : ''} · <i>${info.repText}</i>`
      + (info.economy ? `<div class="v-stock">Economía${info.port ? ' de puerto' : ''}: ${info.economy.cheap.length ? `<span class="cheap">barato: ${info.economy.cheap.join(', ')}</span>` : ''}${info.economy.dear.length ? ` · <span class="dear">caro: ${info.economy.dear.join(', ')}</span>` : ''}${info.economy.imports ? ' · <b>llegó un barco: lo importado está más barato</b>' : ''}</div>` : '')
      + `<div class="v-stock">💰 Bolsa: ${info.silver} de plata${info.treasury !== null && info.treasury !== undefined ? ` · 👑 Tesoro real: ${info.treasury}` : ''}${info.edu ? ` · 📚 Fue ${info.edu} ${info.edu === 1 ? 'vez' : 'veces'} a la escuela` : ''}${info.buildings?.length ? ` · Tiene ${info.buildings.join(', ')}` : ''}</div>`
      + `<div class="v-stock">Reservas: 🍞 ${info.stock.food} · 🪵 ${info.stock.wood} · 🪨 ${info.stock.stone}${info.partner ? ` · Pareja: ${info.partner}` : ''}${info.moodWhy.length ? ` · ${info.moodWhy.join(', ')}` : ''}</div>`;
    $('#v-line').textContent = `“${info.line}”`;
    const silver = inventory[131] ?? 0;
    const items = (obj) => Object.entries(obj).map(([id, n]) => `<span class="ti"><img src="${this.icon(Number(id))}" alt="">${n > 1 ? `×${n}` : ''}<small>${this.name(Number(id))}</small></span>`).join('');
    const coin = `<img class="coin" src="${this.icon(131)}" alt="plata">`;
    // Encargo del rey.
    const q = info.quest;
    $('#v-quest').hidden = !info.king;
    if (info.king) {
      const ready = q && (q.kind === 'deliver' ? (inventory[q.id] ?? 0) >= q.n : q.progress >= q.n);
      $('#v-quest').innerHTML = q ? `<h3 class="v-title">Encargo real</h3><div class="quest"><div>${q.text}<small>${q.kind === 'deliver' ? `Tenés ${inventory[q.id] ?? 0}/${q.n}` : `Zombis: ${q.progress}/${q.n} (de noche, cerca de la aldea)`} · Recompensa: ${q.reward} ${coin}</small></div>
        <button class="mc-btn small ${ready ? 'primary' : ''}" id="q-done" ${ready ? '' : 'disabled'}>Entregar</button></div><small class="muted">Tu rango en el reino: <b>${info.rank}</b></small>` : `<p class="muted">No hay encargos por ahora. Tu rango: <b>${info.rank}</b></p>`;
      $('#q-done')?.addEventListener('click', on.quest);
    }
    // Tienda: compra con plata y venta.
    const shop = info.shop;
    $('#v-shop').hidden = !shop || (!shop.sells.length && !shop.buys.length);
    if (shop) {
      $('#v-shop').innerHTML = `<h3 class="v-title">Tienda <span class="wallet">${coin} ${silver}</span></h3><div class="shop-cols">
        <div><small>Te vende</small>${shop.sells.map((it, i) => `<div class="trade ${!it.locked && (mode !== 'survival' || silver >= it.price) ? 'ok' : ''}">${items({ [it.id]: it.n })}<span class="price">${it.trend === 'up' ? '<i class="tr up">▲</i>' : it.trend === 'down' ? '<i class="tr down">▼</i>' : ''}${it.price} ${coin}</span><button class="mc-btn small" data-buy="${i}" ${it.locked ? 'disabled title="Cuando la aldea crezca"' : ''}>${it.locked ? it.needs : 'Comprar'}</button></div>`).join('') || '<p class="muted">Nada.</p>'}</div>
        <div><small>Te compra</small>${shop.buys.map((b) => `<div class="trade ${(inventory[b.id] ?? 0) > 0 ? 'ok' : ''}">${items({ [b.id]: 1 })}<span class="price">${b.trend === 'up' ? '<i class="tr up">▲</i>' : b.trend === 'down' ? '<i class="tr down">▼</i>' : ''}${b.price} ${coin}</span><button class="mc-btn small" data-sell="${b.id}" ${(inventory[b.id] ?? 0) > 0 ? '' : 'disabled'}>Vender</button><button class="mc-btn small" data-sellall="${b.id}" ${(inventory[b.id] ?? 0) > 1 ? '' : 'disabled'}>Todo (${inventory[b.id] ?? 0})</button></div>`).join('') || '<p class="muted">Nada.</p>'}</div></div>`;
      $('#v-shop').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => on.buy(shop.sells[Number(b.dataset.buy)])));
      $('#v-shop').querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => on.sell(Number(b.dataset.sell), false)));
      $('#v-shop').querySelectorAll('[data-sellall]').forEach((b) => b.addEventListener('click', () => on.sell(Number(b.dataset.sellall), true)));
    }
    // Trueques especiales (reparar, cambiar materiales).
    const has = (req) => mode !== 'survival' || Object.entries(req).every(([id, n]) => (inventory[id] ?? 0) >= n);
    $('#v-trades-title').hidden = !info.trades.length;
    $('#v-trades').innerHTML = info.trades.map((t, i) => `
      <div class="trade ${has(t.give) ? 'ok' : ''}">
        <div class="give">${items(t.give)}</div><span class="arrow">➜</span>
        <div class="get">${t.repair ? '<span class="ti repair">🔧<small>Reparar la herramienta en la mano</small></span>' : items(t.get)}</div>
        <button class="mc-btn small ${has(t.give) ? 'primary' : ''}" data-t="${i}" ${has(t.give) ? '' : 'disabled'}>Cambiar</button>
      </div>`).join('');
    $('#v-trades').querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => on.trade(info.trades[Number(b.dataset.t)])));
    $('#v-donate').hidden = !info.canDonate;
    $('#v-donate').onclick = on.donate;
    $('#v-food').hidden = info.child;
    $('#v-food').onclick = on.food;
    $('#v-close').onclick = on.close;
  }

  renderMission(status) {
    const el = this.$('#mission');
    if (this.mode !== 'survival') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    if (!status.current) { el.innerHTML = `<b>¡Completaste todas las misiones!</b><small>${status.done}/${status.total} · Seguí explorando y construyendo.</small>`; return; }
    const m = status.current;
    el.innerHTML = `<span class="m-count">Misión ${status.number}/${status.total} · ${status.done} cumplidas</span><b>${m.title}</b><div class="m-bar"><div style="width:${(status.value / m.goal) * 100}%"></div></div><small>${m.hint}</small>`;
  }

  // Barra de armadura (al lado de los corazones) y monedas de plata.
  renderArmor(points, show) {
    const el = this.$('#armor');
    el.style.display = show && points > 0 ? 'flex' : 'none';
    if (show && points > 0) el.innerHTML = Array.from({ length: 10 }, (_, i) => { const v = points - i * 2; return `<span class="shieldpip ${v >= 2 ? 'full' : v === 1 ? 'half' : 'empty'}"></span>`; }).join('');
  }

  renderSilver(n, show) {
    const el = this.$('#silver');
    el.style.display = show ? 'flex' : 'none';
    el.innerHTML = `<img src="${this.icon(131)}" alt="">${n}`;
  }

  renderStamina(v, show) {
    const el = this.$('#stamina');
    el.style.display = show ? 'block' : 'none';
    if (show) { el.firstElementChild.style.width = `${v}%`; el.classList.toggle('low', v < 20); }
  }

  debug(text) { this.$('#debug').textContent = text; }
  show(sel, on) { this.$(sel).classList.toggle('open', on); }
}
