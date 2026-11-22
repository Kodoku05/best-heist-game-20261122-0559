// Boot, fixed-step loop, screens and the self-test bot. One clear job:
// own the game session — start worlds, route input, drive ?shot= and
// ?selftest=, and keep the frame loop honest.
import { TILE, VIEW_W, VIEW_H } from './config.js';
import { LEVELS } from './levels.js';
import { createWorld, updateWorld, pointInAnyCone, segmentCrossesActiveLaser, tileCenter } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  drawWorld, drawHUD, drawTitle, drawHowTo, drawLevelSelect, drawPaused,
  drawLevelComplete, drawGameOver, drawCampaignComplete, drawCaughtFlash,
} from './render.js';
import { stageShot } from './shots.js';
import { makeBot } from './bot.js';

const params = new URLSearchParams(window.location.search);
const SEED = Number(params.get('seed') || '1') || 1;
const SHOT = params.get('shot');
const SELFTEST = params.get('selftest') === '1';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();

const store = {
  get unlocked() {
    return Number(window.localStorage.getItem('gilded-unlocked') || '0') || 0;
  },
  set unlocked(v) {
    window.localStorage.setItem('gilded-unlocked', String(v));
  },
  get best() {
    return Number(window.localStorage.getItem('gilded-best') || '0') || 0;
  },
  set best(v) {
    window.localStorage.setItem('gilded-best', String(v));
  },
};

let screen = 'title'; // title | howto | select | play | paused | complete | gameover | campaign
let levelIndex = 0;
let world = createWorld(0, SEED);
let totalScore = 0;
let selectIndex = 0;
let prevMouseDown = false;
let statusTimer = 0;

function startLevel(index) {
  levelIndex = index;
  world = createWorld(index, SEED);
  totalScore = 0;
  screen = 'play';
  audio.unlock();
  audio.startHum();
}

function nextLevel() {
  if (levelIndex + 1 < LEVELS.length) {
    levelIndex += 1;
    world = createWorld(levelIndex, SEED);
    screen = 'play';
  } else {
    screen = 'campaign';
    if (totalScore > store.best) store.best = totalScore;
  }
}

function onLevelComplete() {
  totalScore += world.score;
  if (levelIndex > store.unlocked) store.unlocked = levelIndex;
  if (levelIndex + 1 < LEVELS.length) store.unlocked = Math.max(store.unlocked, levelIndex + 1);
}

function setStatus(text) {
  statusEl.textContent = text;
}

// --- Clickable menu buttons (mouse) ---
function buttonsForScreen() {
  const cx = VIEW_W / 2;
  if (screen === 'title') {
    return [
      { x: cx - 330, y: 496, w: 200, h: 40, action: () => startLevel(0), label: 'Play' },
      { x: cx - 100, y: 496, w: 200, h: 40, action: () => { screen = 'howto'; }, label: 'How to' },
      { x: cx + 130, y: 496, w: 200, h: 40, action: () => { selectIndex = 0; screen = 'select'; }, label: 'Levels' },
    ];
  }
  if (screen === 'select') {
    const rows = [];
    for (let i = 0; i < LEVELS.length; i += 1) {
      rows.push({
        x: cx - 320, y: 200 + i * 72 - 28, w: 640, h: 52,
        action: () => { if (i <= store.unlocked) startLevel(i); },
        label: `Floor ${i + 1}`,
      });
    }
    return rows;
  }
  if (screen === 'complete') {
    return [
      { x: cx - 330, y: 468, w: 200, h: 40, action: () => nextLevel(), label: 'Next floor' },
      { x: cx - 100, y: 468, w: 200, h: 40, action: () => startLevel(levelIndex), label: 'Replay' },
      { x: cx + 130, y: 468, w: 200, h: 40, action: () => { screen = 'title'; }, label: 'Title' },
    ];
  }
  if (screen === 'gameover') {
    return [
      { x: cx - 320, y: 396, w: 280, h: 40, action: () => startLevel(levelIndex), label: 'Retry' },
      { x: cx + 20, y: 396, w: 200, h: 40, action: () => { screen = 'title'; }, label: 'Title' },
    ];
  }
  return [];
}

function handleClick() {
  if (!input.mouseDown || prevMouseDown) return;
  for (const b of buttonsForScreen()) {
    if (input.mouseX >= b.x && input.mouseX <= b.x + b.w && input.mouseY >= b.y && input.mouseY <= b.y + b.h) {
      b.action();
      return;
    }
  }
}

// --- Keyboard menus ---
function handleMenuKeys() {
  if (screen === 'title') {
    if (input.anyKeyPressed) {
      audio.unlock();
      if (keysDown('Enter')) startLevel(0);
      else if (keysDown('KeyH')) screen = 'howto';
      else if (keysDown('KeyL')) { selectIndex = 0; screen = 'select'; }
    }
  } else if (screen === 'howto') {
    if (keysDown('Escape') || keysDown('KeyH') || keysDown('Enter')) screen = 'title';
  } else if (screen === 'select') {
    if (keysDown('ArrowUp')) selectIndex = Math.max(0, selectIndex - 1);
    else if (keysDown('ArrowDown')) selectIndex = Math.min(LEVELS.length - 1, selectIndex + 1);
    else if (keysDown('Enter') && selectIndex <= store.unlocked) startLevel(selectIndex);
    else if (keysDown('Escape')) screen = 'title';
  } else if (screen === 'paused') {
    if (keysDown('KeyP') || keysDown('Escape')) screen = 'play';
    else if (keysDown('KeyR')) startLevel(levelIndex);
    else if (keysDown('KeyT')) screen = 'title';
  } else if (screen === 'complete') {
    if (keysDown('Enter')) nextLevel();
    else if (keysDown('KeyR')) startLevel(levelIndex);
    else if (keysDown('KeyT')) screen = 'title';
  } else if (screen === 'gameover') {
    if (keysDown('KeyR') || keysDown('Enter')) startLevel(levelIndex);
    else if (keysDown('KeyT')) screen = 'title';
  } else if (screen === 'campaign') {
    if (keysDown('Enter')) startLevel(0);
    else if (keysDown('KeyT')) screen = 'title';
  }
}

const pressedCodes = new Set();
window.addEventListener('keydown', (e) => { if (!e.repeat) pressedCodes.add(e.code); });
function keysDown(code) {
  return pressedCodes.has(code);
}

function frame(dt) {
  handleClick();
  handleMenuKeys();

  if (screen === 'play') {
    if (input.pausePressed) { screen = 'paused'; }
    else if (input.restartPressed) { startLevel(levelIndex); }
    else {
      const prevPhase = world.phase;
      updateWorld(world, input, dt, audio);
      if (input.mutePressed) audio.toggleMute();
      if (world.phase === 'complete' && prevPhase !== 'complete') {
        onLevelComplete();
        screen = 'complete';
      } else if (world.phase === 'gameover' && prevPhase !== 'gameover') {
        screen = 'gameover';
      }
    }
  } else if (screen === 'paused' && input.mutePressed) {
    audio.toggleMute();
  }

  // Render.
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (screen === 'title') {
    drawWorld(ctx, world);
    drawTitle(ctx, store.best);
  } else if (screen === 'howto') {
    drawWorld(ctx, world);
    drawHowTo(ctx);
  } else if (screen === 'select') {
    drawWorld(ctx, world);
    drawLevelSelect(ctx, store.unlocked, selectIndex);
  } else if (screen === 'play' || screen === 'paused') {
    drawWorld(ctx, world);
    drawHUD(ctx, world);
    drawCaughtFlash(ctx, world);
    if (screen === 'paused') drawPaused(ctx);
  } else if (screen === 'complete') {
    drawWorld(ctx, world);
    drawHUD(ctx, world);
    drawLevelComplete(ctx, world, totalScore);
  } else if (screen === 'gameover') {
    drawWorld(ctx, world);
    drawHUD(ctx, world);
    drawGameOver(ctx, world);
  } else if (screen === 'campaign') {
    drawWorld(ctx, world);
    drawCampaignComplete(ctx, totalScore);
  }

  statusTimer += dt;
  if (statusTimer > 1) {
    statusTimer = 0;
    if (screen === 'play') {
      setStatus(`${world.def.name}. Alarm ${Math.round(world.alarm)} percent. Loot $${world.lootValue}. Lives ${world.lives}.`);
    } else {
      setStatus('GILDED — The Star Sapphire Gala Heist');
    }
  }

  pressedCodes.clear();
  prevMouseDown = input.mouseDown;
  input.endFrame();
}

// --- Fixed-step loop ---
let last = performance.now();
let acc = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  const step = 1 / 60;
  let n = 0;
  while (acc >= step && n < 5) {
    frame(step);
    acc -= step;
    n += 1;
  }
  if (n === 5) acc = 0;
  requestAnimationFrame(loop);
}

// --- Self-test bot: plays every floor on its ghost route ---
function runSelfTest() {
  const out = [];
  const dt = 1 / 60;
  for (let li = 0; li < LEVELS.length; li += 1) {
    const w = createWorld(li, SEED);
    const bot = makeBot(w);
    let simTime = 0;
    let result = 'FAIL';
    let detail = 'timeout';
    while (simTime < 150) {
      const s = bot.step(dt);
      simTime += dt;
      if (s === 'complete') {
        result = w.fullSpots === 0 && w.caughtCount === 0 ? 'PASS' : 'FAIL';
        detail = `rating ${w.rating}, spots ${w.fullSpots}, caught ${w.caughtCount}`;
        break;
      }
      if (s === 'gameover') { result = 'FAIL'; detail = 'game over (no lives)'; break; }
    }
    if (result === 'FAIL' && detail === 'timeout') detail = `timeout at ${simTime.toFixed(0)}s, route step ${bot.routeIndex}/${bot.routeLength}`;
    out.push(`Level ${li + 1} ${LEVELS[li].name}: ${result} (${detail}, ${simTime.toFixed(1)}s)`);
  }
  const el = document.getElementById('selftest');
  el.textContent = out.join('\n');
  el.style.display = 'block';
  window.__selftest = out.join('\n');
  window.__shotReady = true;
}

// --- Shot mode: stage one scene, paint it, signal readiness ---
function runShot() {
  const staged = stageShot(SHOT, SEED);
  if (!staged) {
    window.__shotReady = true;
    return;
  }
  world = staged.world;
  screen = staged.screen;
  totalScore = staged.totalScore || 0;
  // Paint twice so pulsing elements settle, then signal.
  frame(1 / 60);
  frame(1 / 60);
  window.__shotReady = true;
}

if (SELFTEST) {
  runSelfTest();
} else if (SHOT) {
  runShot();
  requestAnimationFrame(loop);
} else {
  requestAnimationFrame(loop);
}
