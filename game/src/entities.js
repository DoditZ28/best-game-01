// Entities for Starshard Drift: factories and per-kind updates. The world
// owns the arrays; this file only knows how one thing moves and looks.

import { CFG, ENEMIES } from './config.js';
import { angleTo, clamp, dist2, range } from './rng.js';

export function makePlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    angle: -Math.PI / 2,
    radius: CFG.player.radius,
    hull: CFG.player.hull,
    maxHull: CFG.player.maxHull,
    fireTimer: 0,
    invuln: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashDir: { x: 0, y: -1 },
    shield: 0,
    magnet: 0,
    alive: true,
    trail: 0,
  };
}

export function makeEnemy(kind, x, y, rng) {
  const def = ENEMIES[kind];
  return {
    kind, x, y,
    vx: 0, vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    speed: def.speed * range(rng, 0.9, 1.15),
    score: def.score,
    color: def.color,
    glow: def.glow,
    angle: rng() * Math.PI * 2,
    fireTimer: range(rng, 1.2, 2.4),
    lungeTimer: range(rng, 1.5, 3),
    lunging: 0,
    wobble: rng() * Math.PI * 2,
    flash: 0,
  };
}

export function makeBoss(x, y) {
  return {
    kind: 'boss', x, y, vx: 0, vy: 0,
    hp: CFG.boss.hp, maxHp: CFG.boss.hp,
    radius: CFG.boss.radius,
    speed: CFG.boss.speed,
    score: CFG.boss.score,
    color: '#c86bff', glow: '#7b2ff7',
    angle: 0,
    fireTimer: 2,
    spawnTimer: CFG.boss.spawnInterval,
    flash: 0,
    pulse: 0,
  };
}

export function makeBullet(x, y, angle, speed, friendly) {
  return {
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    radius: friendly ? CFG.player.bulletRadius : 7,
    friendly,
    life: 1.6,
    damage: 1,
  };
}

export function makeShard(x, y, kind, rng) {
  return {
    x, y,
    vx: range(rng, -30, 30), vy: range(rng, -30, 30),
    kind, // 'shard' | 'heart' | 'magnet' | 'shield'
    radius: kind === 'shard' ? 9 : 13,
    life: 14,
    bob: rng() * Math.PI * 2,
  };
}

export function makeParticle(x, y, vx, vy, life, size, color) {
  return { x, y, vx, vy, life, maxLife: life, size, color };
}

export function makeFloatText(x, y, text, color, size) {
  return { x, y, text, color, size: size || 16, life: 1.1, maxLife: 1.1 };
}

// --- updates ---------------------------------------------------------------

export function updatePlayer(p, move, dt, w, h, fx) {
  if (p.invuln > 0) p.invuln -= dt;
  if (p.dashCooldown > 0) p.dashCooldown -= dt;
  if (p.shield > 0) p.shield -= dt;
  if (p.magnet > 0) p.magnet -= dt;

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.dashDir.x * CFG.player.dashSpeed;
    p.vy = p.dashDir.y * CFG.player.dashSpeed;
    p.trail -= dt;
    if (p.trail <= 0) {
      p.trail = 0.016;
      fx.push(makeParticle(p.x, p.y, -p.vx * 0.05, -p.vy * 0.05, 0.35, 5, '#7df9ff'));
    }
  } else {
    p.vx += move.x * CFG.player.accel * dt;
    p.vy += move.y * CFG.player.accel * dt;
    p.vx *= Math.pow(CFG.player.drag, dt * 60);
    p.vy *= Math.pow(CFG.player.drag, dt * 60);
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > CFG.player.maxSpeed) {
      p.vx = (p.vx / sp) * CFG.player.maxSpeed;
      p.vy = (p.vy / sp) * CFG.player.maxSpeed;
    }
  }
  p.x = clamp(p.x + p.vx * dt, p.radius, w - p.radius);
  p.y = clamp(p.y + p.vy * dt, p.radius, h - p.radius);
  if (Math.hypot(p.vx, p.vy) > 40) p.angle = Math.atan2(p.vy, p.vx);

  // Engine trail while thrusting.
  p.trail -= dt;
  if ((move.x !== 0 || move.y !== 0) && p.trail <= 0) {
    p.trail = 0.05;
    const bx = p.x - Math.cos(p.angle) * 18;
    const by = p.y - Math.sin(p.angle) * 18;
    fx.push(makeParticle(bx, by, -Math.cos(p.angle) * 60 + range(Math.random, -20, 20),
      -Math.sin(p.angle) * 60 + range(Math.random, -20, 20), 0.3, 4, '#ff9d5c'));
  }
  if (p.fireTimer > 0) p.fireTimer -= dt;
}

export function updateEnemy(e, player, dt, w, h, time) {
  if (e.flash > 0) e.flash -= dt;
  const d = Math.hypot(player.x - e.x, player.y - e.y) || 1;
  const tx = (player.x - e.x) / d;
  const ty = (player.y - e.y) / d;

  if (e.kind === 'mote') {
    e.wobble += dt * 3;
    const wob = Math.sin(e.wobble) * 0.5;
    e.vx += (tx * e.speed + -ty * wob * 40 - e.vx) * dt * 2;
    e.vy += (ty * e.speed + tx * wob * 40 - e.vy) * dt * 2;
  } else if (e.kind === 'darter') {
    e.lungeTimer -= dt;
    if (e.lungeTimer <= 0) {
      e.lunging = 0.55;
      e.lungeTimer = range(Math.random, 2.2, 3.4);
    }
    if (e.lunging > 0) {
      e.lunging -= dt;
      e.vx += (tx * e.speed * 3.1 - e.vx) * dt * 6;
      e.vy += (ty * e.speed * 3.1 - e.vy) * dt * 6;
    } else {
      e.vx += (tx * e.speed * 0.4 - e.vx) * dt * 2;
      e.vy += (ty * e.speed * 0.4 - e.vy) * dt * 2;
    }
  } else if (e.kind === 'spinner') {
    // Keep a ring around the player and strafe.
    const want = 260;
    const radial = d < want - 30 ? -1 : d > want + 30 ? 1 : 0;
    const strafe = Math.sin(time * 1.3 + e.wobble) > 0 ? 1 : -1;
    e.vx += ((tx * radial + -ty * strafe) * e.speed - e.vx) * dt * 2;
    e.vy += ((ty * radial + tx * strafe) * e.speed - e.vy) * dt * 2;
  } else if (e.kind === 'boss') {
    e.pulse += dt;
    e.vx += (tx * e.speed - e.vx) * dt * 1.2;
    e.vy += (ty * e.speed - e.vy) * dt * 1.2;
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.x = clamp(e.x, e.radius, w - e.radius);
  e.y = clamp(e.y, e.radius, h - e.radius);
  e.angle = Math.atan2(e.vy, e.vx);
}

export function updateBullet(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.life -= dt;
}

export function updateShard(s, player, dt, magnetOn) {
  s.bob += dt * 4;
  s.life -= dt;
  if (magnetOn) {
    const d2 = dist2(s.x, s.y, player.x, player.y);
    if (d2 < CFG.pickups.attractRadius * CFG.pickups.attractRadius) {
      const a = angleTo(s.x, s.y, player.x, player.y);
      s.vx += Math.cos(a) * 900 * dt;
      s.vy += Math.sin(a) * 900 * dt;
    }
  }
  s.vx *= Math.pow(0.94, dt * 60);
  s.vy *= Math.pow(0.94, dt * 60);
  s.x += s.vx * dt;
  s.y += s.vy * dt;
}

export function updateParticle(p, dt) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= Math.pow(0.96, dt * 60);
  p.vy *= Math.pow(0.96, dt * 60);
  p.life -= dt;
}

export function updateFloatText(t, dt) {
  t.y -= 42 * dt;
  t.life -= dt;
}

export function explode(x, y, color, count, fx, rng) {
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const sp = range(rng, 40, 260);
    fx.push(makeParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
      range(rng, 0.3, 0.8), range(rng, 2, 6), i % 3 === 0 ? '#ffffff' : color));
  }
}
