// World for Starshard Drift: the state machine, waves, collisions, scoring
// and the boss. Rendering reads this state; it never writes it.

import { CFG, WAVES } from './config.js';
import {
  explode, makeBoss, makeBullet, makeEnemy, makeFloatText, makeParticle,
  makePlayer, makeShard, updateBullet, updateEnemy, updateFloatText,
  updateParticle, updatePlayer, updateShard,
} from './entities.js';
import { angleTo, clamp, dist2, mulberry32, range } from './rng.js';

export const STATES = ['title', 'playing', 'waveclear', 'paused', 'win', 'gameover'];

export class World {
  constructor(w, h, sound) {
    this.w = w;
    this.h = h;
    this.sound = sound;
    this.rng = mulberry32((Math.random() * 0xffffffff) >>> 0);
    this.state = 'title';
    this.time = 0;
    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem('starshard-best') || 0) || 0;
    } catch { this.best = 0; }
    this.combo = 1;
    this.comboTimer = 0;
    this.kills = 0;
    this.shardsCollected = 0;
    this.wave = 0;
    this.waveTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.shake = 0;
    this.player = makePlayer(w / 2, h / 2);
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.shards = [];
    this.particles = [];
    this.texts = [];
    this.boss = null;
    this.stats = { timePlayed: 0, shots: 0 };
    this.banner = '';
    this.bannerTimer = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.player.x = clamp(this.player.x, 20, w - 20);
    this.player.y = clamp(this.player.y, 20, h - 20);
  }

  startGame() {
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.kills = 0;
    this.shardsCollected = 0;
    this.wave = 0;
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.shards = [];
    this.particles = [];
    this.texts = [];
    this.boss = null;
    this.player = makePlayer(this.w / 2, this.h * 0.62);
    this.stats = { timePlayed: 0, shots: 0 };
    this.state = 'playing';
    this.beginWave(1);
  }

  beginWave(n) {
    this.wave = n;
    const plan = WAVES[n - 1];
    this.spawnQueue = [];
    for (let i = 0; i < plan.motes; i++) this.spawnQueue.push('mote');
    for (let i = 0; i < plan.darters; i++) this.spawnQueue.push('darter');
    for (let i = 0; i < plan.spinners; i++) this.spawnQueue.push('spinner');
    // Shuffle the queue so the mix arrives in a random order.
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    this.spawnTimer = 0.4;
    if (n === CFG.waves) {
      this.boss = makeBoss(this.w / 2, -80);
      this.boss.y = 110;
      this.banner = 'THE VOID MAW AWAKENS';
    } else {
      this.banner = `WAVE ${n}`;
    }
    this.bannerTimer = 2.2;
  }

  spawnEnemy(kind) {
    const m = 30;
    const side = Math.floor(this.rng() * 4);
    let x;
    let y;
    if (side === 0) { x = range(this.rng, 0, this.w); y = -m; }
    else if (side === 1) { x = this.w + m; y = range(this.rng, 0, this.h); }
    else if (side === 2) { x = range(this.rng, 0, this.w); y = this.h + m; }
    else { x = -m; y = range(this.rng, 0, this.h); }
    this.enemies.push(makeEnemy(kind, x, y, this.rng));
  }

  addScore(base, x, y) {
    const gained = base * this.combo;
    this.score += gained;
    if (x !== undefined) {
      this.texts.push(makeFloatText(x, y, `+${gained}`, '#ffd94a', 16));
    }
    return gained;
  }

  bumpCombo() {
    this.combo = Math.min(CFG.combo.max, this.combo + 1);
    this.comboTimer = CFG.combo.window;
  }

  dropPickup(x, y) {
    const r = this.rng();
    let kind = 'shard';
    if (r < CFG.pickups.heartChance) kind = 'heart';
    else if (r < CFG.pickups.heartChance + CFG.pickups.magnetChance) kind = 'magnet';
    else if (r < CFG.pickups.heartChance + CFG.pickups.magnetChance + CFG.pickups.shieldChance) kind = 'shield';
    this.shards.push(makeShard(x, y, kind, this.rng));
  }

  damagePlayer() {
    const p = this.player;
    if (p.invuln > 0 || p.dashTimer > 0 || !p.alive) return;
    if (p.shield > 0) {
      p.shield = 0;
      p.invuln = 1.0;
      this.texts.push(makeFloatText(p.x, p.y - 30, 'SHIELD DOWN', '#7df9ff', 18));
      this.sound.hit();
      return;
    }
    p.hull -= 1;
    p.invuln = CFG.player.invulnTime;
    this.combo = 1;
    this.comboTimer = 0;
    this.shake = 14;
    explode(p.x, p.y, '#ff5d7a', 18, this.particles, this.rng);
    this.sound.hit();
    if (p.hull <= 0) {
      p.alive = false;
      explode(p.x, p.y, '#7df9ff', 60, this.particles, this.rng);
      this.state = 'gameover';
      this.sound.lose();
      this.saveBest();
    }
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try { window.localStorage.setItem('starshard-best', String(this.best)); } catch { /* private mode */ }
    }
  }

  killEnemy(e, index) {
    this.enemies.splice(index, 1);
    this.kills += 1;
    this.addScore(e.score, e.x, e.y);
    this.bumpCombo();
    explode(e.x, e.y, e.color, e.kind === 'boss' ? 60 : 16, this.particles, this.rng);
    this.sound.enemyDie();
    if (this.rng() < 0.45) this.dropPickup(e.x, e.y);
  }

  killBoss() {
    this.boss = null;
    this.addScore(CFG.boss.score, this.w / 2, this.h / 2);
    explode(this.w / 2, this.h / 2, '#c86bff', 80, this.particles, this.rng);
    this.sound.bossHit();
    this.state = 'win';
    this.sound.win();
    this.saveBest();
  }

  firePlayerBullet() {
    const p = this.player;
    let target = null;
    let bestD = Infinity;
    const all = this.boss ? [...this.enemies, this.boss] : this.enemies;
    for (const e of all) {
      const d = dist2(p.x, p.y, e.x, e.y);
      if (d < bestD) { bestD = d; target = e; }
    }
    let angle;
    if (target) angle = angleTo(p.x, p.y, target.x, target.y);
    else angle = p.angle;
    p.angle = angle;
    this.bullets.push(makeBullet(
      p.x + Math.cos(angle) * 22, p.y + Math.sin(angle) * 22,
      angle, CFG.player.bulletSpeed, true));
    this.stats.shots += 1;
    this.sound.shoot();
  }

  tryDash(move, mouse) {
    const p = this.player;
    if (p.dashCooldown > 0 || p.dashTimer > 0) return;
    let dx = move.x;
    let dy = move.y;
    if (dx === 0 && dy === 0) {
      const a = angleTo(p.x, p.y, mouse.x, mouse.y);
      dx = Math.cos(a);
      dy = Math.sin(a);
    }
    const len = Math.hypot(dx, dy) || 1;
    p.dashDir = { x: dx / len, y: dy / len };
    p.dashTimer = CFG.player.dashTime;
    p.dashCooldown = CFG.player.dashCooldown;
    p.invuln = Math.max(p.invuln, CFG.player.dashTime + 0.05);
    this.sound.dash();
  }

  update(dt, input) {
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    for (const t of this.texts) updateFloatText(t, dt);
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const p of this.particles) updateParticle(p, dt);
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.state === 'title' || this.state === 'win' || this.state === 'gameover') {
      // Ambient drift behind the overlays.
      this.updateAmbient(dt);
      return;
    }
    if (this.state === 'paused') return;

    this.stats.timePlayed += dt;
    const p = this.player;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    // Player movement, dash and auto-fire.
    const move = input.moveVector();
    updatePlayer(p, move, dt, this.w, this.h, this.particles);
    if (input.dashRequested()) this.tryDash(move, input.mouse);
    if (p.alive && p.fireTimer <= 0 && (this.enemies.length > 0 || this.boss)) {
      p.fireTimer = CFG.player.fireInterval;
      this.firePlayerBullet();
    }

    // Spawning.
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = CFG.spawnInterval * range(this.rng, 0.7, 1.3);
        this.spawnEnemy(this.spawnQueue.shift());
      }
    }

    // Enemies.
    for (const e of this.enemies) {
      updateEnemy(e, p, dt, this.w, this.h, this.time);
      if (e.kind === 'spinner') {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && p.alive) {
          e.fireTimer = range(this.rng, 2.0, 3.0);
          const a = angleTo(e.x, e.y, p.x, p.y);
          this.enemyBullets.push(makeBullet(e.x, e.y, a, 200, false));
        }
      }
    }
    if (this.boss) {
      const b = this.boss;
      updateEnemy(b, p, dt, this.w, this.h, this.time);
      b.fireTimer -= dt;
      if (b.fireTimer <= 0) {
        b.fireTimer = CFG.boss.burstInterval;
        for (let i = 0; i < CFG.boss.burstCount; i++) {
          const a = (i / CFG.boss.burstCount) * Math.PI * 2 + b.pulse;
          this.enemyBullets.push(makeBullet(b.x, b.y, a, CFG.boss.orbSpeed, false));
        }
        this.sound.bossHit();
      }
      b.spawnTimer -= dt;
      if (b.spawnTimer <= 0) {
        b.spawnTimer = CFG.boss.spawnInterval;
        this.spawnEnemy('mote');
        this.spawnEnemy('mote');
      }
    }

    // Bullets.
    for (const b of this.bullets) updateBullet(b, dt);
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < this.w + 20 && b.y > -20 && b.y < this.h + 20);
    for (const b of this.enemyBullets) updateBullet(b, dt);
    this.enemyBullets = this.enemyBullets.filter((b) => b.life > 0 && b.x > -20 && b.x < this.w + 20 && b.y > -20 && b.y < this.h + 20);

    // Player bullets vs enemies and boss.
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let consumed = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const rr = e.radius + b.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          e.hp -= b.damage;
          e.flash = 0.12;
          this.particles.push(makeParticle(b.x, b.y, 0, 0, 0.2, 4, '#ffffff'));
          if (e.hp <= 0) this.killEnemy(e, j);
          consumed = true;
          break;
        }
      }
      if (!consumed && this.boss) {
        const bo = this.boss;
        const rr = bo.radius + b.radius;
        if (dist2(b.x, b.y, bo.x, bo.y) < rr * rr) {
          bo.hp -= b.damage;
          bo.flash = 0.12;
          this.particles.push(makeParticle(b.x, b.y, 0, 0, 0.2, 4, '#ffffff'));
          if (bo.hp <= 0) this.killBoss();
          consumed = true;
        }
      }
      if (consumed) this.bullets.splice(i, 1);
    }

    // Enemy bullets vs player.
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      const rr = p.radius + b.radius - 3;
      if (p.alive && dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        this.enemyBullets.splice(i, 1);
        this.damagePlayer();
      }
    }

    // Enemies vs player.
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const e = this.enemies[j];
      const rr = e.radius + p.radius - 4;
      if (p.alive && dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        this.killEnemy(e, j);
        this.damagePlayer();
      }
    }
    if (this.boss && p.alive) {
      const rr = this.boss.radius + p.radius - 6;
      if (dist2(this.boss.x, this.boss.y, p.x, p.y) < rr * rr) this.damagePlayer();
    }

    // Pickups.
    const magnetOn = p.magnet > 0;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      updateShard(s, p, dt, magnetOn);
      const rr = s.radius + p.radius + (magnetOn ? 14 : 0);
      if (p.alive && dist2(s.x, s.y, p.x, p.y) < rr * rr) {
        this.shards.splice(i, 1);
        this.collectPickup(s);
      } else if (s.life <= 0) {
        this.shards.splice(i, 1);
      }
    }

    // Wave clear?
    if (this.state === 'playing' && this.wave < CFG.waves &&
        this.spawnQueue.length === 0 && this.enemies.length === 0 && !this.boss) {
      const bonus = CFG.waveClearBonus * this.wave;
      this.score += bonus;
      this.texts.push(makeFloatText(this.w / 2, this.h / 2 - 40,
        `WAVE ${this.wave} CLEAR  +${bonus}`, '#6dffa8', 24));
      this.sound.waveClear();
      this.state = 'waveclear';
      this.waveTimer = 2.6;
    }
    if (this.state === 'waveclear') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.beginWave(this.wave + 1);
    }
  }

  collectPickup(s) {
    const p = this.player;
    if (s.kind === 'shard') {
      this.shardsCollected += 1;
      this.addScore(CFG.pickups.shardScore, s.x, s.y);
      this.bumpCombo();
      this.sound.shard();
    } else if (s.kind === 'heart') {
      p.hull = Math.min(p.maxHull, p.hull + 1);
      this.texts.push(makeFloatText(s.x, s.y, '+1 HULL', '#ff5d8f', 18));
      this.sound.shard();
    } else if (s.kind === 'magnet') {
      p.magnet = CFG.pickups.magnetTime;
      this.texts.push(makeFloatText(s.x, s.y, 'MAGNET!', '#7df9ff', 18));
      this.sound.shard();
    } else if (s.kind === 'shield') {
      p.shield = CFG.pickups.shieldTime;
      this.texts.push(makeFloatText(s.x, s.y, 'SHIELD!', '#7df9ff', 18));
      this.sound.shard();
    }
  }

  // Slow star drift behind title / end screens.
  updateAmbient(dt) {
    for (const e of this.enemies) updateEnemy(e, this.player, dt, this.w, this.h, this.time);
    for (const s of this.shards) updateShard(s, this.player, dt, false);
  }
}
