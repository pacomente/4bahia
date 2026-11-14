import * as THREE from 'three';
import { B, BLOCKS, PLACEABLE } from './blocks.js';
import { World, CS, H } from './world.js';
import { meshChunk, createBlockMaterial, toGeometry } from './mesher.js';
import MeshWorker from './meshWorker.js?worker&inline';
import { buildAtlasCanvas, buildAtlasTexture, uvRect } from './textures.js';
import { Player } from './player.js';
import { raycast } from './raycast.js';
import { Sky } from './sky.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { saveWorld, saveSettings, exitToLauncher } from './storage.js';
import { I, ITEMS, isItem, mineSpeed, attackDamage, maxUses, armorPoints, armorReduction, isFood, ARMOR_SLOTS, COOKS, MAX_UPGRADE, upgradeCost } from './items.js';
import { GROW, RIPE, PLANT, CROP_BLOCKS, harvest } from './crops.js';
import { rankFor } from './economy.js';
import { craft, craftableTimes } from './recipes.js';
import { Hand } from './hand.js';
import { emptyStats, missionStatus } from './missions.js';
import { Shadows, nearLight } from './mobs.js';
import { Animals } from './animals.js';
import { Sea } from './sea.js';
import { navFrame } from './pathfind.js';
import { Creatures, lairsNear } from './creatures.js';
import { dungeonsNear, dungeonBlocks, dungeonLoot } from './dungeons.js';
import { BOOKS, relation, isFestival } from './society.js';
import { TUTORIAL, ACHIEVEMENTS } from './progress.js';
import { settleFalling, fellTree, orphanLeaves, flowWater } from './physics.js';
import { PLAYER_LOOK } from './preview.js';
import { createHumanoid, animateHumanoid, lightHumanoid } from './humanoid.js';
import { wrecksNear, treasure } from './wrecks.js';
import { Caravans, tradeGoods, applyTrade, GOODS_NAME } from './caravans.js';
import { linksOf, routeOf } from './roads.js';
import { ruinsNear, ruinLoot, treasureSpot, buriedTreasure, RUIN_REGION, ruinPlan } from './ruins.js';
import { villagePlan } from './villages.js';
import { MiniMap } from './minimap.js';
import { Villages, newVillager } from './villagers.js';
import { villagesNear } from './villages.js';
import { Zombies } from './zombies.js';
import { Arrows } from './projectiles.js';
import { PlayerPreview } from './preview.js';
import { Bandits } from './bandits.js';
import { campsNear, lootTable, CAMP_REGION, campPlan } from './camps.js';

// Pueblos: señorío, casa propia, encargos y trueques.
// (Métodos del juego: se copian a Game.prototype en game.js.)
export class TownMixin {
  // ───── Señorío y casa propia ─────
  pay(n) { if (this.mode !== 'survival') return true; if ((this.inventory[I.SILVER] ?? 0) < n) { this.ui.toast(`Te faltan ${n - (this.inventory[I.SILVER] ?? 0)} de plata`, 1800); return false; } this.inventory[I.SILVER] -= n; if (this.inventory[I.SILVER] <= 0) delete this.inventory[I.SILVER]; return true; }
  lordAction(e, act) {
    const { plan, rec } = e.a; const L = this.lordships[plan.id];
    if (act === 'ask') {
      if (!this.pay(200)) return;
      this.lordships[plan.id] = { pending: 0, since: this.stats.nights };
      this.ui.toast(`👑 ¡Ahora sos señor de ${plan.name}! Vas a cobrar parte de los impuestos.`, 4500);
      this.logEvent(`Te nombraron señor de ${plan.name}.`); this.villages.addGossip({ type: 'king', village: plan.name, name: this.playerName, title: 'señor' });
      this.stats.lord = 1; for (let k = 0; k < 4; k++) setTimeout(() => this.sound.tone(523 * Math.pow(1.26, k), 0.3, 0.12, 'triangle'), k * 150);
    } else if (act === 'house') {
      const slot = plan.slots.findIndex((_, i) => !rec.built.includes(i) && !(rec.build && rec.build.slot === i));
      if (slot < 0) { this.ui.toast('No queda terreno libre para una casa', 2000); return; }
      if (!this.pay(120)) return;
      rec.playerSlot = slot; rec.stock.wood += 10; rec.stock.stone += 10;
      if (!rec.build) rec.build = { slot, step: 0 };
      this.ui.toast(`🏗 Compraste un terreno en ${plan.name}. El constructor va a levantar tu casa.`, 4000);
      this.logEvent(`Compraste una casa en ${plan.name}.`);
    } else if (L && act === 'collect') {
      if (!L.pending) { this.ui.toast('Todavía no hay impuestos para cobrar (se juntan cada amanecer)', 2200); return; }
      this.addItem(I.SILVER, L.pending); this.ui.toast(`+${L.pending} de plata de los impuestos de ${plan.name}`, 2500); this.coinSound(); L.pending = 0;
    } else if (L && act === 'guard') {
      if (!this.pay(40)) return;
      const v = newVillager(plan, rec, Math.random, { prof: 'guard' }); rec.villagers.push(v);
      const a = this.villages.active.get(plan.id); if (a) this.villages.spawn(a, v);
      this.ui.toast(`🛡 ${v.name} se suma a la guardia de ${plan.name}.`, 3000);
    } else if (L && act === 'works') {
      if (!this.pay(30)) return;
      rec.boost = 180; rec.stock.wood += 12; rec.stock.stone += 12; this.ui.toast('🏗 Los constructores trabajan al doble de velocidad por un rato.', 3000);
    } else if (L && act === 'feast') {
      if (!this.pay(25)) return;
      rec.forceFestival = (rec.day ?? 0) + 1; this.ui.toast(`🎉 Mañana hay fiesta en ${plan.name}.`, 3000);
    }
    this.syncHotbar(); this.renderStatus(); this.checkMissions(); this.renderVillager();
  }

  deliverRequest(e) {
    const reward = this.villages.completeRequest(e, this.inventory);
    if (!reward) { this.ui.toast('Todavía no tenés lo que te pidió', 1800); return; }
    this.addItem(I.SILVER, reward);
    this.ui.toast(`¡Encargo de ${e.data.name} cumplido! +${reward} de plata.`, 3000);
    this.logEvent(`Ayudaste a ${e.data.name} en ${e.a.plan.name}.`);
    this.stats.requests = (this.stats.requests ?? 0) + 1;
    this.coinSound(); this.syncHotbar(); this.renderStatus(); this.checkMissions(); this.renderVillager();
  }

  deliverQuest(e) {
    const reward = this.villages.completeQuest(e, this.inventory);
    if (!reward) { this.ui.toast('Todavía no cumpliste el encargo', 1800); return; }
    const before = rankFor(this.stats.honor ?? 0).name;
    this.stats.honor = (this.stats.honor ?? 0) + 1;
    this.addItem(I.SILVER, reward);
    const after = rankFor(this.stats.honor).name;
    this.ui.toast(after !== before ? `¡Encargo cumplido! +${reward} de plata. Ahora sos ${after}.` : `¡Encargo cumplido! +${reward} monedas de plata.`, 3500);
    this.coinSound(); this.sound.tone(784, 0.25, 0.15, 'sine');
    this.syncHotbar(); this.renderStatus(); this.checkMissions(); this.renderVillager();
  }

  trade(e, tr) {
    const has = Object.entries(tr.give).every(([id, n]) => (this.inventory[id] ?? 0) >= n);
    if (this.mode === 'survival' && !has) { this.ui.toast('Te faltan materiales para el trueque', 1600); return; }
    if (tr.heal || tr.reveal) {
      if (this.mode === 'survival' && (this.inventory[I.SILVER] ?? 0) < (tr.give[I.SILVER] ?? 0)) { this.ui.toast('Te falta plata', 1600); return; }
      if (this.mode === 'survival') { this.inventory[I.SILVER] -= tr.give[I.SILVER]; if (this.inventory[I.SILVER] <= 0) delete this.inventory[I.SILVER]; }
      if (tr.heal) { this.health = this.maxHealth; this.food = Math.max(this.food, 12); this.ui.toast('El médico te curó todas las heridas.', 2500); this.sound.tone(660, 0.3, 0.1, 'sine'); }
      else { this.stats.ruinsSeen = Math.max(1, this.stats.ruinsSeen ?? 0); this.revealedMap = true; this.ui.toast('🗺 El cartógrafo marcó en tu mapa las ruinas y guaridas de la comarca (M).', 3500); this.villageCheck = 0; }
      this.villages.remember(e); e.a.rec.rep += 1; this.renderStatus(); this.syncHotbar(); this.renderVillager();
      return;
    }
    if (tr.upgrade) {
      // Refuerzo del herrero: más daño (armas), más velocidad (herramientas) o más protección (armaduras).
      const id = this.held(); const kind = ITEMS[id]?.kind;
      if (!(kind === 'tool' || kind === 'armor' || id === I.SHIELD)) { this.ui.toast('Agarrá en la mano un arma, herramienta o pieza de armadura', 2200); return; }
      const lvl = this.upgrades[id] ?? 0;
      if (lvl >= MAX_UPGRADE) { this.ui.toast('Ya está reforzada al máximo (+3)', 1800); return; }
      const cost = upgradeCost(lvl);
      if (this.mode === 'survival' && ((this.inventory[I.SILVER] ?? 0) < cost.silver || (this.inventory[I.IRON] ?? 0) < cost.iron)) { this.ui.toast(`Para +${lvl + 1} necesitás ${cost.silver} de plata y ${cost.iron} de hierro`, 2500); return; }
      if (this.mode === 'survival') { this.inventory[I.SILVER] -= cost.silver; this.inventory[I.IRON] -= cost.iron; for (const k of [I.SILVER, I.IRON]) if (this.inventory[k] <= 0) delete this.inventory[k]; }
      this.upgrades[id] = lvl + 1;
      this.ui.toast(`${ITEMS[id].name} +${lvl + 1}: ${kind === 'armor' ? 'protege más' : ITEMS[id].tool === 'sword' ? 'pega más fuerte' : 'trabaja más rápido'}`, 2500);
      for (let k = 0; k < 4; k++) setTimeout(() => this.sound.tone(900 + k * 120, 0.06, 0.12, 'square'), k * 160);   // martillazos
      this.stats.upgraded = (this.stats.upgraded ?? 0) + 1;
      e.a.rec.rep += 1; this.renderStatus(); this.syncHotbar(); this.checkMissions(); this.renderVillager();
      return;
    }
    if (tr.repair) {
      const id = this.held();
      if (!maxUses(id) || !(this.toolWear[id] > 0)) { this.ui.toast('Agarrá en la mano una herramienta gastada', 2000); return; }
      this.toolWear[id] = 0;
      this.ui.toast(`${ITEMS[id].name}: ¡como nueva!`, 2000);
    }
    if (this.mode === 'survival') for (const [id, n] of Object.entries(tr.give)) { this.inventory[id] -= n; if (this.inventory[id] <= 0) delete this.inventory[id]; }
    for (const [id, n] of Object.entries(tr.get)) this.addItem(Number(id), n);
    e.a.rec.rep += 1; this.villages.remember(e);
    this.stats.trades = (this.stats.trades ?? 0) + 1;
    this.sound.tone(660, 0.08, 0.15, 'sine'); setTimeout(() => this.sound.tone(990, 0.12, 0.12, 'sine'), 80);
    this.villages.say(e, ['¡Trato hecho!', '¡Un placer!', 'Volvé cuando quieras.'][Math.floor(Math.random() * 3)], 2.5);
    this.syncHotbar(); this.renderHotbar(); this.checkMissions();
    this.renderVillager();
  }

}
