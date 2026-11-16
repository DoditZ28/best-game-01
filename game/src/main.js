// Starshard Drift — boot and main loop. Sizes the canvas to the window,
// runs the world on a fixed timestep, and routes keys and clicks to the
// state machine. With ?shot=<name> it renders one staged scene and stops,
// which is how the entry's screenshots are taken.

import { SoundBank } from './audio.js';
import { CFG } from './config.js';
import { Input } from './input.js';
import { buttons, draw } from './render.js';
import { applyShot } from './shots.js';
import { World } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const sound = new SoundBank();
const input = new Input(canvas);

let world = null;
let shotMode = null;
let lastStatus = '';

function resize() {
  const w = Math.max(CFG.minWidth, window.innerWidth);
  const h = Math.max(CFG.minHeight, window.innerHeight);
  canvas.width = w;
  canvas.height = h;
  if (world) world.resize(w, h);
}

function announce(text) {
  if (text !== lastStatus) {
    lastStatus = text;
    statusEl.textContent = text;
  }
}

function buttonAt(x, y) {
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

function handleAction(id) {
  if (id === 'start' || id === 'restart') {
    sound.unlock();
    world.startGame();
  } else if (id === 'resume') {
    sound.unlock();
    world.state = 'playing';
  }
}

function handleInput() {
  const st = world.state;
  if (input.wasPressed('enter')) {
    if (st === 'title') handleAction('start');
    else if (st === 'win' || st === 'gameover') handleAction('restart');
  }
  if (input.wasPressed('r')) {
    if (st === 'playing' || st === 'waveclear' || st === 'paused' || st === 'win' || st === 'gameover') {
      handleAction('restart');
    }
  }
  if (input.wasPressed('p') || input.wasPressed('escape')) {
    if (st === 'playing' || st === 'waveclear') world.state = 'paused';
    else if (st === 'paused') world.state = 'playing';
  }
  if (input.wasPressed('m')) sound.toggleMute();
  if (input.clicked) {
    sound.unlock();
    const id = buttonAt(input.clickPos.x, input.clickPos.y);
    if (id) handleAction(id);
  }
}

function describeState() {
  const w = world;
  if (w.state === 'title') return 'Starshard Drift. Press Enter to launch.';
  if (w.state === 'playing' || w.state === 'waveclear') {
    return `Wave ${w.wave} of 8. Score ${w.score}. Hull ${w.player.hull}. Combo times ${w.combo}.`;
  }
  if (w.state === 'paused') return 'Paused.';
  if (w.state === 'win') return `Victory! Final score ${w.score}. Press R to play again.`;
  if (w.state === 'gameover') return `Ship lost. Score ${w.score}. Press R to try again.`;
  return '';
}

function frame(now) {
  const dt = 1 / 60;
  handleInput();
  world.update(dt, input);
  draw(world, ctx, canvas.width, canvas.height, now / 1000);
  announce(describeState());
  input.endFrame();
  requestAnimationFrame(frame);
}

function boot() {
  resize();
  window.addEventListener('resize', resize);
  world = new World(canvas.width, canvas.height, sound);

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 7);
  if (shot) {
    if (applyShot(world, shot, seed)) {
      shotMode = shot;
      // One deterministic render, then stop: the screenshot is the frame.
      draw(world, ctx, canvas.width, canvas.height, 1.234);
      document.title = `Starshard Drift — ${shot}`;
      return;
    }
  }
  requestAnimationFrame(frame);
}

boot();
