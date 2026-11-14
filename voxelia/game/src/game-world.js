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

// El mundo alrededor del jugador: ambiente y clima, criaturas raras, tormentas en el mar,
// carretas y barcos mercantes.
// (Métodos del juego: se copian a Game.prototype en game.js.)
export class WorldMixin {
  // Ambiente: bioma para el clima, capas de sonido según lo que hay alrededor y zona para la música.
  updateEnvironment(dt, underground) {
    this.envT = (this.envT ?? 0) - dt;
    if (this.envT <= 0) {
      this.envT = 0.6;
      const p = this.player.pos; const x = Math.floor(p.x); const z = Math.floor(p.z);
      const biome = this.world.biome(x, z); this.ambEnvBiome = biome;
      this.sky.setEnv({ biome, altitude: p.y });
      // Agua y árboles alrededor (muestras en un anillo).
      let water = 0; let leaves = 0; let n = 0;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2; const sx = Math.floor(p.x + Math.cos(a) * 12); const sz = Math.floor(p.z + Math.sin(a) * 12);
        const top = this.world.topAt(sx, sz); n++;
        if (top < 31 && BLOCKS[this.world.getBlock(sx, 31, sz)]?.water) water++;
        const id = this.world.getBlock(sx, top + 1, sz); const id2 = this.world.getBlock(sx, top, sz);
        if ([B.LEAVES, B.BIRCH_LEAVES, B.PINE_LEAVES, B.PALM_LEAVES].includes(id) || [B.LEAVES, B.BIRCH_LEAVES, B.PINE_LEAVES, B.PALM_LEAVES].includes(id2)) leaves++;
      }
      const day = this.sky.daylight > 0.5;
      const inVillage = !!this.villageNow;
      const battle = [...this.villages.active.values()].some((a) => a.alarm && Math.hypot(a.plan.x - p.x, a.plan.z - p.z) < 70) || this.bandits.list.some((b) => !b.dead && b.aggro && Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < 20);
      this.ambEnv = {
        wind: underground ? 0 : Math.min(1, Math.max(0, (p.y - 40) / 40) + (this.sky.storm ?? 0) * 0.8 + (biome === 'snow' ? 0.3 : 0)),
        waves: underground ? 0 : water / n, rain: underground ? 0 : Math.max(this.sky.rain, (this.sky.storm ?? 0)), cave: underground ? 1 : 0,
        birds: !underground && day && this.sky.rain < 0.3 ? Math.min(1, leaves / n * 3 + 0.1) : 0,
        crickets: !underground && !day && this.sky.rain < 0.3 && biome !== 'snow' ? 0.6 : 0,
        market: inVillage && day && this.sky.time < 0.42 ? 0.5 : 0,
      };
      this.zone = battle ? 'battle' : inVillage ? 'village' : (this.sea.riding || water / n > 0.6) ? 'sea' : biome === 'desert' ? 'desert' : biome === 'snow' ? 'snow' : null;
    }
    if (!this.paused && this.ambEnv) this.sound.updateAmbience(dt, this.ambEnv);
  }

  // Criaturas raras: serpiente marina y dragón.
  creatureCtx() {
    const p = this.player.pos; const x = Math.floor(p.x); const z = Math.floor(p.z);
    this.deepT = (this.deepT ?? 0) - 1;
    if (this.deepT <= 0) {
      this.deepT = 30;
      // Mar abierto: agua profunda y sin tierra cerca.
      let land = false; for (let k = 0; k < 12 && !land; k++) { const a = (k / 12) * Math.PI * 2; if (this.world.heightAt(Math.floor(p.x + Math.cos(a) * 18), Math.floor(p.z + Math.sin(a) * 18)) >= 32) land = true; }
      this.deepWaterNow = !land && this.world.heightAt(x, z) < 22;
      this.onLandFarNow = this.world.heightAt(x, z) > 33;
    }
    return {
      player: this.player, daylight: this.sky.daylight, inBoat: !!this.sea.riding, deepWater: this.deepWaterNow, onLandFar: this.onLandFarNow, killedLairs: this.killedLairs,
      setAttacker: (k) => { this.lastAttacker = k; },
      summon: (pos) => { for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; this.zombies.spawnAt(pos.x + Math.cos(a) * 3, pos.y + 1, pos.z + Math.sin(a) * 3); } },
      villagers: this.villages.entities, hurtVillager: (e, dmg, from) => { if (this.villages.hurt(e, dmg, from, true)) this.ui.toast(`Una bomba alcanzó a ${e.data.name}`, 2500); },
      onHit: (dmg, reason, dir) => this.damage(dmg, reason, dir),
      capsize: () => this.capsize('¡La serpiente dio vuelta el bote!'),
      warn: (text) => this.ui.toast(text, 3000),
      puff: (x, y, z, c) => this.spawnPuff(x, y, z, c),
      onKilled: (kind, pos, lair) => {
        if (kind === 'king') {
          this.clearedDungeons.push(lair.id);
          if (this.mode === 'survival') { this.addItem(I.CROWN, 1); this.addItem(I.GOLD, 12); this.addItem(I.CRYSTAL, 6); this.addItem(I.SILVER, 100); }
          this.ui.toast('👑 ¡Venciste al Rey Sombrío! La mazmorra quedó libre. Ganaste su corona.', 6000);
          this.villages.addGossip({ type: 'dragon' }); this.logEvent(`Venciste al Rey Sombrío en ${lair.name}.`);
          this.stats.kings = (this.stats.kings ?? 0) + 1;
        } else if (kind === 'dragon') {
          this.killedLairs.push(lair.id);
          if (this.mode === 'survival') { this.addItem(I.DRAGON_SCALE, 3); this.addItem(I.GOLD, 10); this.addItem(I.SILVER, 150); }
          this.ui.toast('🐉 ¡Venciste al dragón de las montañas! Escamas de dragón, oro y plata.', 6000);
          this.villages.addGossip({ type: 'dragon' }); this.logEvent('¡Venciste al dragón de las montañas!');
          this.stats.dragons = (this.stats.dragons ?? 0) + 1;
        } else {
          if (this.mode === 'survival') { this.addItem(I.SERPENT_FANG, 1); this.addItem(I.PEARL, 4); }
          this.ui.toast('🐍 ¡La serpiente marina se hundió! Te dejó un colmillo y perlas.', 5000);
          this.villages.addGossip({ type: 'serpent' }); this.logEvent('Hundiste a la serpiente marina.');
          this.stats.serpents = (this.stats.serpents ?? 0) + 1;
        }
        for (let k = 0; k < 6; k++) setTimeout(() => this.sound.tone(392 * Math.pow(1.19, k), 0.25, 0.12, 'triangle'), k * 140);
        this.checkMissions(); this.renderStatus();
      },
    };
  }

  // Tormenta en el mar: las olas pueden dar vuelta el bote lejos de la costa.
  updateStormSea(dt) {
    if (!this.sea.riding || (this.sky.storm ?? 0) < 0.7 || !this.deepWaterNow) { this.stormWarned = false; return; }
    if (!this.stormWarned) { this.stormWarned = true; this.ui.toast('🌊 ¡Tormenta en alta mar! Volvé a la costa antes de que una ola dé vuelta el bote.', 4000); }
    if (Math.random() < dt * 0.02) this.capsize('¡Una ola gigante dio vuelta el bote!');
  }
  capsize(text) {
    const b = this.sea.riding; if (!b) return;
    this.sea.riding = null;
    this.player.pos.set(b.mesh.position.x + 1.2, b.mesh.position.y - 0.6, b.mesh.position.z);
    b.mesh.position.x -= 2; b.speed = 0;
    this.sound.splash(); this.shake = 0.4;
    this.ui.toast(`${text} Nadá hasta el bote y subite de nuevo.`, 3500);
  }

  // Carretas: al llegar a destino se hace el trato entre las dos aldeas.
  caravanCtx() {
    const pp = this.player.pos;
    return {
      player: this.player, daylight: this.sky.daylight,
      onDepart: (c) => {
        const from = this.villages.record(c.from); const to = this.villages.record(c.to);
        c.goods = tradeGoods(from, to);
      },
      onArrive: (c) => {
        const from = this.villages.record(c.from); const to = this.villages.record(c.to);
        const g = c.goods ?? tradeGoods(from, to);
        if (g) { applyTrade(from, to, g); this.villages.addGossip({ type: 'caravan', from: c.from.name, to: c.to.name, goods: GOODS_NAME[g.kind] }); }
        if (Math.hypot(c.mesh.position.x - pp.x, c.mesh.position.z - pp.z) < 90) {
          this.stats.caravans = (this.stats.caravans ?? 0) + 1; this.checkMissions();
          this.ui.toast(g ? `🐴 Llegó la carreta de ${c.from.name} a ${c.to.name}: ${g.n} de ${GOODS_NAME[g.kind]} por ${g.price} de plata` : `🐴 Llegó la carreta de ${c.from.name} a ${c.to.name} de visita`, 4000);
          this.coinSound();
        }
      },
    };
  }

  // Mar: puertos cargados cerca (para los barcos mercantes) y qué pasa cuando uno amarra.
  seaCtx() {
    const pp = this.player.pos;
    return {
      player: this.player, daylight: this.sky.daylight,
      ports: [...this.villages.active.values()].filter((a) => a.plan.port && Math.hypot(a.plan.x - pp.x, a.plan.z - pp.z) < 200),
      onDock: (plan, pos) => {
        const a = this.villages.active.get(plan.id); const rec = a?.rec ?? this.villages.records.get(plan.id);
        if (rec) { rec.importDays = 2; rec.stock.food += 6; rec.stock.wood += 4; rec.stock.stone += 2; rec.ships = (rec.ships ?? 0) + 1; }
        for (const e of a?.list ?? []) if (!e.hidden && (e.data.prof === 'sailor' || e.data.prof === 'fisher' || e.data.prof === 'merchant')) { e.state = 'cheer'; e.timer = 3; this.villages.say?.(e, '¡Llegó el barco!', 3); }
        const d = Math.hypot(pos.x - pp.x, pos.z - pp.z);
        if (d < 120) {
          this.ui.toast(`⚓ Llegó un barco mercante a ${plan.name}: hay gemas, hierro y lana más baratos`, 4500);
          this.villages.addGossip({ type: 'ship', village: plan.name });
          const g = Math.max(0.05, 0.35 * (1 - d / 120));
          this.sound.tone(147, 1.1, g, 'sawtooth'); setTimeout(() => this.sound.tone(110, 1.4, g, 'sawtooth'), 900);
        }
      },
      onLeave: () => {},
    };
  }

}
