// Screenshot scenes for Starshard Drift: `?shot=start|play|boss|win|end`
// builds a fixed, seeded scene and renders it once, so the screenshots in
// screenshots/ are reproducible renders of the game's own code. `seed` picks
// the variation; the live game never reads this file's query.

import { explode, makeBoss, makeEnemy, makeFloatText, makeShard } from './entities.js';
import { mulberry32, range } from './rng.js';

// A do-nothing sound bank: shots render silently.
const SILENT = {
  shoot() {}, enemyDie() {}, shard() {}, hit() {}, dash() {},
  waveClear() {}, bossHit() {}, win() {}, lose() {},
};

function scatter(world, rng, kinds, count, margin) {
  for (let i = 0; i < count; i++) {
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const x = range(rng, margin, world.w - margin);
    const y = range(rng, margin, world.h - margin);
    if (Math.hypot(x - world.player.x, y - world.player.y) < 120) continue;
    world.enemies.push(makeEnemy(kind, x, y, rng));
  }
}

export function applyShot(world, name, seed) {
  const rng = mulberry32(seed);
  world.rng = rng;
  const w = world.w;
  const h = world.h;

  if (name === 'start') {
    world.state = 'title';
    world.score = 0;
    world.best = 18450;
    scatter(world, rng, ['mote', 'darter', 'spinner'], 7, 60);
    for (const e of world.enemies) {
      e.x = range(rng, 60, w - 60);
      e.y = range(rng, h * 0.55, h - 60);
    }
    return true;
  }

  if (name === 'play' || name === 'boss') {
    world.startGame();
    if (name === 'play') {
      world.wave = 3;
      world.score = 1250;
      world.combo = 4;
      world.comboTimer = 2.1;
      world.kills = 23;
      world.shardsCollected = 41;
      world.banner = '';
      world.bannerTimer = 0;
      world.spawnQueue = ['mote', 'darter', 'spinner', 'mote'];
      scatter(world, rng, ['mote', 'mote', 'darter', 'spinner'], 8, 80);
      for (let i = 0; i < 5; i++) {
        world.shards.push(makeShard(range(rng, 100, w - 100), range(rng, 100, h - 100), 'shard', rng));
      }
      world.shards.push(makeShard(w * 0.7, h * 0.3, 'heart', rng));
      world.player.x = w * 0.42;
      world.player.y = h * 0.58;
      world.player.angle = -0.6;
      world.player.hull = 2;
      world.player.shield = 4;
    } else {
      world.wave = 8;
      world.score = 8420;
      world.combo = 6;
      world.comboTimer = 2.6;
      world.kills = 97;
      world.shardsCollected = 132;
      world.banner = '';
      world.bannerTimer = 0;
      world.spawnQueue = [];
      // Boss placed by hand so the bar and the maw both read in the shot.
      world.boss = makeBoss(w * 0.62, h * 0.3);
      world.boss.hp = 41;
      world.boss.fireTimer = 1.2;
      scatter(world, rng, ['mote'], 3, 80);
      world.player.x = w * 0.38;
      world.player.y = h * 0.66;
      world.player.angle = -1.1;
      world.player.hull = 3;
    }
    // Run a short fixed-step simulation so bullets, particles and motion
    // look mid-action instead of freshly placed. The pilot is invulnerable
    // during the staged run so the scene cannot end itself.
    world.player.invuln = 999;
    const fakeInput = {
      moveVector: () => ({ x: 0.4, y: -0.2 }),
      dashRequested: () => false,
      mouse: { x: w * 0.7, y: h * 0.3 },
    };
    for (let i = 0; i < 150; i++) world.update(1 / 60, fakeInput);
    world.player.invuln = 0;
    world.state = 'playing';
    world.banner = '';
    world.bannerTimer = 0;
    // A few floating score texts for life.
    world.texts.push(makeFloatText(w * 0.55, h * 0.4, '+400', '#ffd94a', 18));
    world.texts.push(makeFloatText(w * 0.3, h * 0.5, '+100', '#ffd94a', 16));
    explode(w * 0.72, h * 0.42, '#b78cff', 10, world.particles, rng);
    return true;
  }

  if (name === 'win') {
    world.startGame();
    world.wave = 8;
    world.score = 12840;
    world.kills = 121;
    world.shardsCollected = 168;
    world.stats.timePlayed = 312;
    world.best = 12840;
    world.state = 'win';
    scatter(world, rng, ['mote'], 4, 80);
    explode(w * 0.5, h * 0.4, '#c86bff', 24, world.particles, rng);
    return true;
  }

  if (name === 'end') {
    world.startGame();
    world.wave = 5;
    world.score = 4230;
    world.kills = 54;
    world.shardsCollected = 76;
    world.stats.timePlayed = 187;
    world.best = 18450;
    world.player.hull = 0;
    world.player.alive = false;
    world.state = 'gameover';
    world.banner = '';
    world.bannerTimer = 0;
    scatter(world, rng, ['mote', 'darter'], 5, 80);
    explode(w * 0.5, h * 0.55, '#7df9ff', 30, world.particles, rng);
    return true;
  }

  return false;
}

export { SILENT };
