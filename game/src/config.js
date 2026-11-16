// Starshard Drift — tuning and palette. One place holds every number the
// game balances on, so a change here retunes the whole game at once.

export const CFG = {
  // Playfield: the arena is the whole canvas; these are minimums, the game
  // scales up to whatever window it opens in.
  minWidth: 960,
  minHeight: 540,

  player: {
    radius: 16,
    accel: 2600,
    maxSpeed: 360,
    drag: 0.86,
    fireInterval: 0.16,
    bulletSpeed: 640,
    bulletRadius: 5,
    bulletDamage: 1,
    hull: 3,
    maxHull: 5,
    invulnTime: 1.4,
    dashSpeed: 980,
    dashTime: 0.22,
    dashCooldown: 1.6,
    magnetRadius: 90,
  },

  // Combo: kills and shards inside the window raise the multiplier.
  combo: { window: 3.0, max: 8, decay: 0.6 },

  // Waves: wave n spawns motes, darters (from 2) and spinners (from 3).
  // Wave 8 is the boss alone, with mote trickle.
  waves: 8,
  spawnInterval: 0.9,
  waveClearBonus: 250,

  pickups: {
    shardScore: 25,
    heartChance: 0.05,
    magnetChance: 0.08,
    shieldChance: 0.08,
    magnetTime: 8,
    shieldTime: 10,
    attractRadius: 220,
  },

  boss: {
    radius: 66,
    hp: 90,
    speed: 55,
    burstInterval: 2.4,
    burstCount: 12,
    orbSpeed: 170,
    spawnInterval: 5,
    score: 2000,
  },
};

// Enemy table: kind -> movement, health, score, colour, radius.
export const ENEMIES = {
  mote:    { hp: 1, speed: 95,  score: 50,  radius: 13, color: '#b78cff', glow: '#7b2ff7' },
  darter:  { hp: 2, speed: 165, score: 100, radius: 12, color: '#ff5d7a', glow: '#ff2e63' },
  spinner: { hp: 3, speed: 70,  score: 150, radius: 15, color: '#ffb347', glow: '#ff8c00' },
};

export const PALETTE = {
  bg0: '#070b1d',
  bg1: '#0d1330',
  nebulaA: '#1b2a6b',
  nebulaB: '#4b1d6e',
  nebulaC: '#0e3a4d',
  ship: '#7df9ff',
  shipCore: '#e8feff',
  bullet: '#ffe66d',
  shard: '#ffd94a',
  heart: '#ff5d8f',
  text: '#eaf2ff',
  dim: '#9fb2d8',
  gold: '#ffd94a',
  danger: '#ff5d7a',
  ok: '#6dffa8',
};

export const WAVES = [
  { motes: 6,  darters: 0, spinners: 0 },
  { motes: 8,  darters: 3, spinners: 0 },
  { motes: 9,  darters: 4, spinners: 2 },
  { motes: 10, darters: 6, spinners: 3 },
  { motes: 12, darters: 7, spinners: 4 },
  { motes: 13, darters: 9, spinners: 5 },
  { motes: 14, darters: 10, spinners: 6 },
  { motes: 0,  darters: 0, spinners: 0 }, // wave 8: the Void Maw
];
