// Rendering for Starshard Drift: the nebula, every entity, the HUD and the
// title / pause / win / game-over overlays. All drawing is canvas 2D with
// shapes and gradients — no image assets, so nothing loads over the network.

import { CFG, PALETTE } from './config.js';

// Button rects the last draw produced, for click handling in main.js.
export let buttons = [];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(ctx, id, x, y, w, h, label, accent) {
  buttons.push({ id, x, y, w, h });
  ctx.save();
  ctx.fillStyle = 'rgba(10, 16, 40, 0.85)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

// --- background -------------------------------------------------------------

let nebulaCache = null;
let nebulaKey = '';

function buildNebula(w, h) {
  const key = `${w}x${h}`;
  if (nebulaCache && nebulaKey === key) return nebulaCache;
  const c = document.createElement('canvas');
  c.width = Math.max(2, w);
  c.height = Math.max(2, h);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, PALETTE.bg0);
  grad.addColorStop(0.55, PALETTE.bg1);
  grad.addColorStop(1, '#0a0f28');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const blobs = [
    [0.22, 0.28, 0.42, PALETTE.nebulaA],
    [0.78, 0.2, 0.36, PALETTE.nebulaB],
    [0.62, 0.78, 0.45, PALETTE.nebulaC],
    [0.15, 0.82, 0.3, PALETTE.nebulaB],
  ];
  for (const [fx, fy, fr, color] of blobs) {
    const r = fr * Math.max(w, h);
    const rg = g.createRadialGradient(w * fx, h * fy, 0, w * fx, h * fy, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.5;
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  }
  g.globalAlpha = 1;
  nebulaCache = c;
  nebulaKey = key;
  return c;
}

let stars = [];
function starField(w, h, rngSeed) {
  if (stars.length && stars.w === w && stars.h === h) return stars;
  let seed = rngSeed;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const list = [];
  for (let i = 0; i < 130; i++) {
    list.push({
      x: rnd() * w, y: rnd() * h,
      layer: 1 + Math.floor(rnd() * 3),
      size: 0.6 + rnd() * 1.8,
      phase: rnd() * Math.PI * 2,
    });
  }
  list.w = w;
  list.h = h;
  stars = list;
  return list;
}

// --- entities ----------------------------------------------------------------

function drawShip(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.rotate(p.angle);
  // Engine flame.
  const flame = 14 + Math.sin(time * 30) * 4;
  ctx.beginPath();
  ctx.moveTo(-12, 6);
  ctx.lineTo(-12 - flame, 0);
  ctx.lineTo(-12, -6);
  ctx.closePath();
  ctx.fillStyle = '#ff9d5c';
  ctx.fill();
  // Hull.
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-10, 11);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, -11);
  ctx.closePath();
  ctx.fillStyle = PALETTE.ship;
  ctx.shadowColor = PALETTE.ship;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.shipCore;
  ctx.fill();
  ctx.restore();

  if (p.shield > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.flash > 0;
  ctx.shadowColor = e.glow;
  ctx.shadowBlur = 12;
  ctx.fillStyle = flash ? '#ffffff' : e.color;
  if (e.kind === 'mote') {
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    // Spikes.
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = e.wobble + (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
      ctx.lineTo(Math.cos(a) * (e.radius + 6), Math.sin(a) * (e.radius + 6));
      ctx.stroke();
    }
  } else if (e.kind === 'darter') {
    ctx.rotate(e.angle);
    ctx.beginPath();
    ctx.moveTo(e.radius + 6, 0);
    ctx.lineTo(-e.radius, e.radius * 0.8);
    ctx.lineTo(-e.radius * 0.4, 0);
    ctx.lineTo(-e.radius, -e.radius * 0.8);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'spinner') {
    ctx.rotate(time * 2 + e.wobble);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(e.radius, e.radius * 0.45);
      ctx.lineTo(e.radius, -e.radius * 0.45);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3d6';
    ctx.fill();
  }
  ctx.restore();
  // Health pips for tougher foes.
  if (e.maxHp > 1 && e.hp < e.maxHp) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 16, e.y - e.radius - 12, 32, 4);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - 16, e.y - e.radius - 12, 32 * (e.hp / e.maxHp), 4);
    ctx.restore();
  }
}

function drawBoss(ctx, b, time) {
  ctx.save();
  ctx.translate(b.x, b.y);
  const r = b.radius + Math.sin(b.pulse * 3) * 4;
  ctx.shadowColor = '#a64dff';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#2a0a4a';
  ctx.fill();
  ctx.shadowBlur = 0;
  // Rotating maw ring.
  ctx.strokeStyle = '#c86bff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 8, b.pulse, b.pulse + Math.PI * 1.5);
  ctx.stroke();
  // Eye.
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#ff2e63';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#1a001f';
  ctx.fill();
  // Teeth.
  ctx.fillStyle = '#e8d5ff';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + b.pulse * 0.6;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (r - 16), Math.sin(a) * (r - 16), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPickup(ctx, s, time) {
  const bob = Math.sin(s.bob) * 2;
  ctx.save();
  ctx.translate(s.x, s.y + bob);
  ctx.shadowBlur = 10;
  if (s.kind === 'shard') {
    ctx.shadowColor = PALETTE.shard;
    ctx.rotate(time * 2 + s.bob);
    ctx.fillStyle = PALETTE.shard;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff8d6';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.kind === 'heart') {
    ctx.shadowColor = PALETTE.heart;
    ctx.fillStyle = PALETTE.heart;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-12, -2, -8, -11, 0, -4);
    ctx.bezierCurveTo(8, -11, 12, -2, 0, 9);
    ctx.fill();
  } else if (s.kind === 'magnet') {
    ctx.shadowColor = PALETTE.ship;
    ctx.strokeStyle = PALETTE.ship;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 9, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-9, 6);
    ctx.moveTo(9, 0);
    ctx.lineTo(9, 6);
    ctx.stroke();
  } else {
    ctx.shadowColor = '#6dffa8';
    ctx.strokeStyle = '#6dffa8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
  }
  ctx.restore();
}

// --- HUD ----------------------------------------------------------------------

function drawHud(ctx, world, w) {
  const p = world.player;
  ctx.save();
  ctx.textBaseline = 'top';
  // Score, top left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText(String(world.score).padStart(6, '0'), 18, 14);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = world.combo > 1 ? PALETTE.gold : PALETTE.dim;
  ctx.fillText(world.combo > 1 ? `COMBO x${world.combo}` : 'COMBO x1', 18, 48);
  if (world.comboTimer > 0 && world.combo > 1) {
    ctx.fillStyle = 'rgba(255, 217, 74, 0.5)';
    ctx.fillRect(18, 68, 90 * (world.comboTimer / CFG.combo.window), 4);
  }
  // Wave, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(world.state === 'title' ? '' : `WAVE ${world.wave} / ${CFG.waves}`, w / 2, 16);
  const left = world.spawnQueue.length + world.enemies.length + (world.boss ? 1 : 0);
  if (world.state === 'playing' || world.state === 'waveclear') {
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(left > 0 ? `${left} hostiles left` : 'sector clear', w / 2, 42);
  }
  // Hull + dash, top right.
  ctx.textAlign = 'right';
  for (let i = 0; i < p.maxHull; i++) {
    const x = w - 24 - i * 30;
    ctx.fillStyle = i < p.hull ? PALETTE.heart : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(x, 30);
    ctx.bezierCurveTo(x - 9, 22, x - 6, 15, x, 20);
    ctx.bezierCurveTo(x + 6, 15, x + 9, 22, x, 30);
    ctx.fill();
  }
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  const dashReady = p.dashCooldown <= 0;
  ctx.fillText(dashReady ? 'DASH READY [SPACE]' : 'DASH …', w - 18, 48);
  if (!dashReady) {
    ctx.fillStyle = 'rgba(125, 249, 255, 0.6)';
    ctx.fillRect(w - 118, 66, 100 * (1 - p.dashCooldown / CFG.player.dashCooldown), 4);
  }
  if (p.magnet > 0) {
    ctx.fillStyle = PALETTE.ship;
    ctx.fillText(`MAGNET ${Math.ceil(p.magnet)}s`, w - 18, 78);
  }
  if (p.shield > 0) {
    ctx.fillStyle = '#6dffa8';
    ctx.fillText(`SHIELD ${Math.ceil(p.shield)}s`, w - 18, 96);
  }
  // Boss bar.
  if (world.boss) {
    const b = world.boss;
    const bw = Math.min(520, w * 0.5);
    const bx = (w - bw) / 2;
    const by = world.h - 34;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c86bff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('VOID MAW', w / 2, by - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, bx, by, bw, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#a64dff';
    roundRect(ctx, bx, by, bw * Math.max(0, b.hp / b.maxHp), 12, 6);
    ctx.fill();
  }
  ctx.restore();
}

function drawBanner(ctx, world, w, h) {
  if (world.bannerTimer <= 0 || !world.banner) return;
  if (world.state !== 'playing' && world.state !== 'waveclear') return;
  const a = Math.min(1, world.bannerTimer);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.shadowColor = '#7b2ff7';
  ctx.shadowBlur = 24;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(world.banner, w / 2, h * 0.3);
  ctx.restore();
}

function overlay(ctx, w, h, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(4, 7, 20, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// --- main draw ------------------------------------------------------------------

export function draw(world, ctx, w, h, time) {
  buttons = [];
  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  ctx.drawImage(buildNebula(w, h), 0, 0);
  const field = starField(w, h, 1337);
  for (const s of field) {
    const tw = 0.45 + 0.55 * Math.sin(time * (0.6 + s.layer * 0.3) + s.phase);
    ctx.globalAlpha = tw * (0.35 + s.layer * 0.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(((s.x - time * 6 * s.layer) % w + w) % w, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;

  for (const s of world.shards) drawPickup(ctx, s, time);
  for (const e of world.enemies) drawEnemy(ctx, e, time);
  if (world.boss) drawBoss(ctx, world.boss, time);
  if (world.player.alive) drawShip(ctx, world.player, time);

  ctx.save();
  for (const b of world.bullets) {
    ctx.fillStyle = PALETTE.bullet;
    ctx.shadowColor = PALETTE.bullet;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const b of world.enemyBullets) {
    ctx.fillStyle = '#ff2e63';
    ctx.shadowColor = '#ff2e63';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.textAlign = 'center';
  for (const t of world.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.font = `bold ${t.size}px system-ui, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();

  if (world.state !== 'title') drawHud(ctx, world, w);
  drawBanner(ctx, world, w, h);

  if (world.state === 'title') drawTitle(ctx, world, w, h, time);
  if (world.state === 'paused') drawPaused(ctx, world, w, h);
  if (world.state === 'win') drawWin(ctx, world, w, h);
  if (world.state === 'gameover') drawGameOver(ctx, world, w, h);
  ctx.restore();
}

function drawTitle(ctx, world, w, h, time) {
  overlay(ctx, w, h, 0.45);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = w / 2;
  const bob = Math.sin(time * 1.6) * 6;
  ctx.shadowColor = '#7b2ff7';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('STARSHARD', cx, h * 0.26 + bob);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('DRIFT', cx, h * 0.26 + 66 + bob);
  ctx.shadowBlur = 0;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('Harvest the falling starshards. Dodge the void. Shatter the Maw.', cx, h * 0.26 + 122 + bob);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('WASD / Arrows — fly      Mouse — aim      SPACE / Click — dash', cx, h * 0.52);
  ctx.fillText('Auto-fire is always on. Chain kills to raise your combo. Survive 8 waves.', cx, h * 0.52 + 26);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(world.best > 0 ? `BEST SCORE  ${world.best}` : 'NO RUNS YET — SET THE FIRST RECORD', cx, h * 0.52 + 62);
  drawButton(ctx, 'start', cx - 130, h * 0.66, 260, 56, '▶  LAUNCH  [ENTER]', PALETTE.gold);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('M — mute      P — pause      R — restart', cx, h * 0.66 + 84);
  ctx.restore();
}

function drawPaused(ctx, world, w, h) {
  overlay(ctx, w, h, 0.6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h * 0.38);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('Press P or Esc to resume', w / 2, h * 0.38 + 48);
  drawButton(ctx, 'resume', w / 2 - 110, h * 0.52, 220, 50, 'RESUME', PALETTE.ship);
  drawButton(ctx, 'restart', w / 2 - 110, h * 0.52 + 64, 220, 50, 'RESTART  [R]', PALETTE.gold);
  ctx.restore();
}

function statsLines(world) {
  return [
    `SCORE   ${world.score}`,
    `WAVE REACHED   ${world.wave} / 8`,
    `KILLS   ${world.kills}      SHARDS   ${world.shardsCollected}`,
    `TIME   ${fmtTime(world.stats.timePlayed)}`,
  ];
}

function drawWin(ctx, world, w, h) {
  overlay(ctx, w, h, 0.55);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#6dffa8';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#6dffa8';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('VOID MAW SHATTERED!', w / 2, h * 0.28);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('All eight waves cleared. The drift is yours, pilot.', w / 2, h * 0.28 + 48);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`FINAL SCORE  ${world.score}`, w / 2, h * 0.46);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  statsLines(world).slice(1).forEach((line, i) => {
    ctx.fillText(line, w / 2, h * 0.46 + 36 + i * 26);
  });
  if (world.score >= world.best && world.score > 0) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('★ NEW BEST SCORE ★', w / 2, h * 0.46 + 36 + 3 * 26 + 14);
  }
  drawButton(ctx, 'restart', w / 2 - 130, h * 0.72, 260, 54, '↻  PLAY AGAIN  [R]', PALETTE.gold);
  ctx.restore();
}

function drawGameOver(ctx, world, w, h) {
  overlay(ctx, w, h, 0.6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff2e63';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#ff5d7a';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('SHIP LOST', w / 2, h * 0.28);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('The void claims another pilot. The shards remain.', w / 2, h * 0.28 + 48);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`SCORE  ${world.score}`, w / 2, h * 0.46);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  statsLines(world).slice(1).forEach((line, i) => {
    ctx.fillText(line, w / 2, h * 0.46 + 36 + i * 26);
  });
  ctx.fillText(`BEST  ${world.best}`, w / 2, h * 0.46 + 36 + 3 * 26 + 8);
  drawButton(ctx, 'restart', w / 2 - 130, h * 0.72, 260, 54, '↻  TRY AGAIN  [R]', PALETTE.gold);
  ctx.restore();
}
