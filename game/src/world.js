// World simulation. One clear job: the rules of the heist — movement,
// collision, line of sight, guard AI, cameras, lasers, noise, loot, the
// alarm meter and win/lose. No drawing here; render.js reads this state.
import { TILE, PLAYER_RADIUS, WALK_SPEED, SNEAK_SPEED, SPRINT_SPEED, DETECT, ALARM, TOOLS, LIVES_PER_LEVEL } from './config.js';
import { LEVELS, LOOT_TABLE } from './levels.js';

const PAR_SECONDS = [90, 120, 150, 150];

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function createWorld(levelIndex, rng) {
  const def = LEVELS[levelIndex];
  const rows = def.map.length;
  const cols = def.map[0].length;
  const grid = def.map.map((row) => row.split(''));
  let start = { x: 60, y: 60 };
  let sapphire = null;
  let exit = null;
  let vaultDoor = null;
  let terminal = null;
  const loots = [];
  let lootCycle = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const ch = grid[y][x];
      if (ch === 'P') { start = tileCenter(x, y); grid[y][x] = '.'; }
      else if (ch === 'D') { sapphire = { ...tileCenter(x, y), tx: x, ty: y, taken: false }; grid[y][x] = '.'; }
      else if (ch === 'E') { exit = { ...tileCenter(x, y), tx: x, ty: y }; grid[y][x] = '.'; }
      else if (ch === 'V') { vaultDoor = { ...tileCenter(x, y), tx: x, ty: y, open: false, progress: 0 }; }
      else if (ch === 'H') { terminal = { ...tileCenter(x, y), tx: x, ty: y, used: false }; grid[y][x] = '.'; }
      else if (ch === 'T') {
        const kind = LOOT_TABLE[lootCycle % LOOT_TABLE.length];
        lootCycle += 1;
        loots.push({ ...tileCenter(x, y), tx: x, ty: y, value: kind.value, weight: kind.weight, label: kind.label, taken: false });
        grid[y][x] = '.';
      }
    }
  }

  const guards = def.guards.map((g, i) => {
    const p = tileCenter(g.waypoints[0][0], g.waypoints[0][1]);
    const q = tileCenter(g.waypoints[1][0], g.waypoints[1][1]);
    return {
      id: i,
      x: p.x, y: p.y,
      dir: Math.atan2(q.y - p.y, q.x - p.x),
      waypoints: g.waypoints.map(([wx, wy]) => tileCenter(wx, wy)),
      wpIndex: 1,
      pause: g.pause,
      pauseT: 0,
      lookDir: 0,
      speed: g.speed,
      state: 'patrol',
      stateT: 0,
      target: null,
      lastSeen: null,
      lostT: 0,
      searchT: 0,
    };
  });
  const cameras = def.cameras.map((c) => {
    const p = tileCenter(c.tx, c.ty);
    return { x: p.x, y: p.y, baseDir: c.dir, sweep: c.sweep, speed: c.speed, dir: c.dir };
  });
  const lasers = def.lasers.map((l) => ({
    x1: l.x1 * TILE, y1: l.y1 * TILE, x2: l.x2 * TILE, y2: l.y2 * TILE,
    period: l.period, onFrac: l.onFrac, phase: l.phase, cooldown: 0,
  }));
  const guests = def.guests.map((g) => {
    const p = tileCenter(g.waypoints[0][0], g.waypoints[0][1]);
    return {
      x: p.x, y: p.y,
      waypoints: g.waypoints.map(([wx, wy]) => tileCenter(wx, wy)),
      wpIndex: 1, pause: g.pause, pauseT: 0, speed: g.speed, dir: 0,
    };
  });

  return {
    levelIndex,
    def,
    grid, rows, cols,
    time: 0,
    player: {
      x: start.x, y: start.y, dir: 0,
      sneak: false, sprint: false,
      coins: TOOLS.coinsStart, smoke: TOOLS.smokeStart, emp: TOOLS.empStart,
      weight: 0, stepT: 0,
    },
    start,
    guards, cameras, lasers, guests,
    loots, sapphire, exit, vaultDoor, terminal,
    alarm: def.alarmStart,
    detection: 0,
    detectionPeak: 0,
    lives: LIVES_PER_LEVEL,
    lootValue: 0,
    lootCount: 0,
    phase: 'play', // play | caught | complete | gameover
    phaseT: 0,
    lockdownT: 0,
    lockdowns: 0,
    empT: 0,
    hackT: 0,
    fullSpots: 0,
    caughtCount: 0,
    toasts: [],
    coinsFlying: [],
    smokes: [],
    noiseRings: [],
    ghostRoute: def.ghostRoute,
    par: PAR_SECONDS[levelIndex],
    score: 0,
    rating: '',
    stars: 0,
    message: '',
  };
}

export function tileAt(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return '#';
  return world.grid[ty][tx];
}

export function isSolidTile(world, tx, ty) {
  const ch = tileAt(world, tx, ty);
  if (ch === '#' || ch === 'C') return true;
  if (ch === 'V') return !(world.vaultDoor && world.vaultDoor.open);
  return false;
}

function blocksSight(world, tx, ty) {
  const ch = tileAt(world, tx, ty);
  return ch === '#' || ch === 'C';
}

export function hasLineOfSight(world, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (blocksSight(world, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

function playerTile(world) {
  return { tx: Math.floor(world.player.x / TILE), ty: Math.floor(world.player.y / TILE) };
}

function inShadow(world) {
  const { tx, ty } = playerTile(world);
  return tileAt(world, tx, ty) === 'S';
}

function inPlant(world) {
  const { tx, ty } = playerTile(world);
  return tileAt(world, tx, ty) === 'b';
}

function inSmoke(world) {
  return world.smokes.some((s) => Math.hypot(world.player.x - s.x, world.player.y - s.y) < s.r);
}

function nearGuest(world) {
  return world.guests.some((g) => Math.hypot(world.player.x - g.x, world.player.y - g.y) < 78);
}

function effectiveRange(world, base) {
  let r = base;
  if (inShadow(world)) r *= DETECT.shadowRangeFactor;
  if (world.player.sneak) r *= DETECT.sneakRangeFactor;
  if (world.player.sprint) r *= DETECT.sprintRangeFactor;
  if (nearGuest(world) && !world.player.sprint) r *= DETECT.blendRangeFactor;
  return r;
}

function canSeePlayer(world, ox, oy, dir, baseRange, halfAngle) {
  const p = world.player;
  const dist = Math.hypot(p.x - ox, p.y - oy);
  if (inPlant(world) && dist > DETECT.plantHideDistance) return false;
  if (inSmoke(world)) return false;
  const range = effectiveRange(world, baseRange);
  if (dist > range) return false;
  if (angleDiff(Math.atan2(p.y - oy, p.x - ox), dir) > halfAngle) return false;
  return hasLineOfSight(world, ox, oy, p.x, p.y);
}

// For the self-test bot and staged shots: is this point inside any live cone?
export function pointInAnyCone(world, x, y) {
  for (const g of world.guards) {
    const dist = Math.hypot(x - g.x, y - g.y);
    if (dist > DETECT.guardRange) continue;
    if (angleDiff(Math.atan2(y - g.y, x - g.x), g.dir) > DETECT.guardHalfAngle) continue;
    if (hasLineOfSight(world, g.x, g.y, x, y)) return true;
  }
  for (const c of world.cameras) {
    if (world.empT > 0 || world.hackT > 0) continue;
    const dist = Math.hypot(x - c.x, y - c.y);
    if (dist > DETECT.cameraRange) continue;
    if (angleDiff(Math.atan2(y - c.y, x - c.x), c.dir) > DETECT.cameraHalfAngle) continue;
    if (hasLineOfSight(world, c.x, c.y, x, y)) return true;
  }
  return false;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function laserIsOn(world, laser) {
  if (world.empT > 0) return false;
  const cycle = (world.time + laser.phase) % laser.period;
  return cycle < laser.period * laser.onFrac;
}

export function laserCycleInfo(world, laser) {
  if (world.empT > 0) return { on: false, untilChange: world.empT };
  const cycle = (world.time + laser.phase) % laser.period;
  const on = cycle < laser.period * laser.onFrac;
  return { on, untilChange: on ? laser.period * laser.onFrac - cycle : laser.period - cycle };
}

export function segmentCrossesActiveLaser(world, x1, y1, x2, y2) {
  for (const l of world.lasers) {
    if (!laserIsOn(world, l)) continue;
    // Sample the segment; trip if it passes within 10px of the beam.
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 10));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (distToSegment(x, y, l.x1, l.y1, l.x2, l.y2) < 10) return l;
    }
  }
  return null;
}

function toast(world, text) {
  world.toasts.push({ text, t: 0 });
  if (world.toasts.length > 4) world.toasts.shift();
}

function moveCircle(world, ent, dx, dy, radius) {
  // Axis-separated circle-vs-solid-tile movement.
  let nx = ent.x + dx;
  const top = Math.floor((ent.y - radius) / TILE);
  const bottom = Math.floor((ent.y + radius) / TILE);
  const left = Math.floor((nx - radius) / TILE);
  const right = Math.floor((nx + radius) / TILE);
  let blocked = false;
  for (let ty = top; ty <= bottom && !blocked; ty += 1) {
    for (let tx = left; tx <= right; tx += 1) {
      if (isSolidTile(world, tx, ty)) {
        const cx = Math.max(tx * TILE, Math.min(nx, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(ent.y, ty * TILE + TILE));
        if (Math.hypot(nx - cx, ent.y - cy) < radius) { blocked = true; break; }
      }
    }
  }
  if (!blocked) ent.x = nx;
  let ny = ent.y + dy;
  const top2 = Math.floor((ny - radius) / TILE);
  const bottom2 = Math.floor((ny + radius) / TILE);
  const left2 = Math.floor((ent.x - radius) / TILE);
  const right2 = Math.floor((ent.x + radius) / TILE);
  blocked = false;
  for (let ty = top2; ty <= bottom2 && !blocked; ty += 1) {
    for (let tx = left2; tx <= right2; tx += 1) {
      if (isSolidTile(world, tx, ty)) {
        const cx = Math.max(tx * TILE, Math.min(ent.x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(ny, ty * TILE + TILE));
        if (Math.hypot(ent.x - cx, ny - cy) < radius) { blocked = true; break; }
      }
    }
  }
  if (!blocked) ent.y = ny;
}

function guardSpotPlayer(world, guard, audio) {
  if (guard.state === 'alert') return;
  guard.state = 'alert';
  guard.stateT = 0;
  guard.lostT = 0;
  world.fullSpots += 1;
  world.alarm = Math.min(100, world.alarm + ALARM.onFullSpot);
  if (audio) audio.alert();
  toast(world, 'SPOTTED! Run!');
}

function cameraSpotPlayer(world, audio) {
  world.alarm = Math.min(100, world.alarm + ALARM.onCameraSpot);
  if (audio) audio.alert();
  toast(world, 'Camera has you!');
  // Nearest guard investigates.
  let best = null;
  let bestD = Infinity;
  for (const g of world.guards) {
    const d = Math.hypot(g.x - world.player.x, g.y - world.player.y);
    if (d < bestD) { bestD = d; best = g; }
  }
  if (best && best.state !== 'alert') {
    best.state = 'suspicious';
    best.stateT = 0;
    best.target = { x: world.player.x, y: world.player.y };
  }
}

function emitNoise(world, x, y, radius, audio) {
  world.noiseRings.push({ x, y, r: 8, max: radius, t: 0 });
  world.alarm = Math.min(100, world.alarm + ALARM.onNoiseHeard);
  for (const g of world.guards) {
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < radius && g.state !== 'alert') {
      g.state = 'suspicious';
      g.stateT = 0;
      g.target = { x, y };
    }
  }
  if (audio) audio.coinLand();
}

function updateGuard(world, g, dt, audio) {
  g.stateT += dt;
  const p = world.player;
  const sees = canSeePlayer(world, g.x, g.y, g.dir, DETECT.guardRange, DETECT.guardHalfAngle);
  if (sees && world.phase === 'play') {
    g.lastSeen = { x: p.x, y: p.y };
    const dist = Math.hypot(p.x - g.x, p.y - g.y);
    const range = effectiveRange(world, DETECT.guardRange);
    const rate = DETECT.fillPerSecondFar + (DETECT.fillPerSecondClose - DETECT.fillPerSecondFar) * (1 - dist / range);
    world.detection = Math.min(1, world.detection + rate * dt * (g.state === 'patrol' ? 1 : 1.5));
    world.detectionPeak = Math.max(world.detectionPeak, world.detection);
    if (world.detection >= 0.55 && g.state === 'patrol') {
      g.state = 'suspicious';
      g.stateT = 0;
      g.target = { x: p.x, y: p.y };
      if (audio) audio.suspicious();
    }
    if (world.detection >= 1) guardSpotPlayer(world, g, audio);
  }

  if (g.state === 'patrol') {
    if (g.pauseT > 0) {
      g.pauseT -= dt;
      g.dir += Math.sin(world.time * 1.4 + g.id) * dt * 0.9; // look around
      return;
    }
    const wp = g.waypoints[g.wpIndex];
    const dx = wp.x - g.x;
    const dy = wp.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) {
      g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
      g.pauseT = g.pause;
      return;
    }
    g.dir = Math.atan2(dy, dx);
    moveCircle(world, g, (dx / d) * g.speed * dt, (dy / d) * g.speed * dt, 12);
  } else if (g.state === 'suspicious') {
    const t = g.target || g.lastSeen;
    if (!t) { g.state = 'patrol'; return; }
    const dx = t.x - g.x;
    const dy = t.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d < 14) {
      g.dir += dt * 1.6; // scan the area
      if (g.stateT > 2.2) { g.state = 'patrol'; g.stateT = 0; g.target = null; }
      return;
    }
    g.dir = Math.atan2(dy, dx);
    moveCircle(world, g, (dx / d) * g.speed * 1.25 * dt, (dy / d) * g.speed * 1.25 * dt, 12);
  } else if (g.state === 'alert') {
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d < 26) {
      catchPlayer(world, audio);
      return;
    }
    if (sees) { g.lostT = 0; g.lastSeen = { x: p.x, y: p.y }; }
    else {
      g.lostT += dt;
      if (g.lostT > 3) {
        g.state = 'search';
        g.stateT = 0;
        g.target = g.lastSeen ? { ...g.lastSeen } : { x: p.x, y: p.y };
        return;
      }
    }
    const tx = (g.lastSeen || p).x;
    const ty = (g.lastSeen || p).y;
    const tdx = tx - g.x;
    const tdy = ty - g.y;
    const td = Math.hypot(tdx, tdy);
    if (td > 4) {
      g.dir = Math.atan2(tdy, tdx);
      moveCircle(world, g, (tdx / td) * g.speed * 1.6 * dt, (tdy / td) * g.speed * 1.6 * dt, 12);
    }
  } else if (g.state === 'search') {
    const t = g.target;
    if (!t) { g.state = 'patrol'; return; }
    const dx = t.x - g.x;
    const dy = t.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d < 14) {
      g.dir += dt * 2.2;
      if (g.stateT > 4) { g.state = 'patrol'; g.stateT = 0; g.target = null; }
      return;
    }
    g.dir = Math.atan2(dy, dx);
    moveCircle(world, g, (dx / d) * g.speed * 1.3 * dt, (dy / d) * g.speed * 1.3 * dt, 12);
  }
}

function catchPlayer(world, audio) {
  if (world.phase !== 'play') return;
  world.phase = 'caught';
  world.phaseT = 0;
  world.caughtCount += 1;
  world.lives -= 1;
  if (audio) audio.caught();
  toast(world, world.lives > 0 ? 'CAUGHT! One life lost.' : 'CAUGHT! No lives left.');
}

function respawn(world) {
  world.player.x = world.start.x;
  world.player.y = world.start.y;
  world.player.weight = 0;
  world.detection = 0;
  world.alarm = 25;
  world.lockdownT = 0;
  for (const g of world.guards) {
    const p = g.waypoints[0];
    g.x = p.x; g.y = p.y;
    const q = g.waypoints[1];
    g.dir = Math.atan2(q.y - p.y, q.x - p.x);
    g.wpIndex = 1;
    g.state = 'patrol';
    g.stateT = 0;
    g.target = null;
    g.lastSeen = null;
  }
  world.phase = 'play';
}

function finishLevel(world, audio) {
  world.phase = 'complete';
  world.phaseT = 0;
  const timeBonus = Math.max(0, Math.round((world.par - world.time) * 10));
  const ghostBonus = world.fullSpots === 0 && world.caughtCount === 0 ? 1000 : 0;
  world.score = world.lootValue + timeBonus + ghostBonus;
  if (world.fullSpots === 0 && world.caughtCount === 0) { world.rating = 'GHOST'; world.stars = 3; }
  else if (world.caughtCount === 0) { world.rating = 'SHADOW'; world.stars = 2; }
  else { world.rating = 'DETECTED'; world.stars = 1; }
  if (audio) audio.win();
}

export function updateWorld(world, input, dt, audio) {
  dt = Math.min(dt, 0.05);
  world.time += dt;
  for (const t of world.toasts) t.t += dt;
  world.toasts = world.toasts.filter((t) => t.t < 3.2);
  for (const r of world.noiseRings) { r.t += dt; r.r += dt * 220; }
  world.noiseRings = world.noiseRings.filter((r) => r.r < r.max);
  for (const s of world.smokes) s.t += dt;
  world.smokes = world.smokes.filter((s) => s.t < TOOLS.smokeSeconds);
  if (world.empT > 0) world.empT -= dt;
  if (world.hackT > 0) world.hackT -= dt;
  for (const l of world.lasers) if (l.cooldown > 0) l.cooldown -= dt;
  if (world.lockdownT > 0) {
    world.lockdownT -= dt;
    if (world.lockdownT <= 0) world.alarm = ALARM.afterLockdown;
  }
  if (world.phase === 'caught') {
    world.phaseT += dt;
    if (world.phaseT > 1.4) {
      if (world.lives > 0) respawn(world);
      else { world.phase = 'gameover'; world.phaseT = 0; }
    }
    return;
  }
  if (world.phase !== 'play') return;

  // Alarm: slow decay, plus the rooftop clock.
  world.alarm = Math.max(0, world.alarm - ALARM.decayPerSecond * dt);
  world.alarm += world.def.alarmRisePerSecond * dt;
  if (world.alarm >= ALARM.lockdownAt && world.lockdownT <= 0) {
    world.lockdownT = ALARM.lockdownSeconds;
    world.lockdowns += 1;
    toast(world, 'LOCKDOWN! Doors sealed!');
    for (const g of world.guards) {
      if (g.state !== 'alert') {
        g.state = 'suspicious';
        g.stateT = 0;
        g.target = { x: world.player.x, y: world.player.y };
      }
    }
    if (audio) audio.alert();
  }

  // --- Player movement ---
  const p = world.player;
  p.sneak = !!input.sneak;
  p.sprint = !!input.sprint && !p.sneak;
  const speedFactor = Math.max(0.68, 1 - 0.055 * p.weight);
  let speed = p.sneak ? SNEAK_SPEED : p.sprint ? SPRINT_SPEED : WALK_SPEED;
  speed *= speedFactor;
  if (input.moveX !== 0 || input.moveY !== 0) {
    p.dir = Math.atan2(input.moveY, input.moveX);
    moveCircle(world, p, input.moveX * speed * dt, input.moveY * speed * dt, PLAYER_RADIUS);
    p.stepT += dt * speed;
    if (p.stepT > 34) {
      p.stepT = 0;
      if (audio) audio.step(p.sneak);
      if (p.sprint) emitNoise(world, p.x, p.y, DETECT.hearSprintRadius, null);
    }
  }

  // --- Tools ---
  if (input.coinTarget && p.coins > 0) {
    p.coins -= 1;
    const from = { x: p.x, y: p.y };
    world.coinsFlying.push({ ...from, tx: input.coinTarget.x, ty: input.coinTarget.y, t: 0 });
    if (audio) audio.coin();
  }
  for (const c of world.coinsFlying) c.t += dt;
  const landed = world.coinsFlying.filter((c) => c.t >= 0.35);
  world.coinsFlying = world.coinsFlying.filter((c) => c.t < 0.35);
  for (const c of landed) emitNoise(world, c.tx, c.ty, DETECT.hearCoinRadius, audio);
  if (input.smokePressed && p.smoke > 0) {
    p.smoke -= 1;
    world.smokes.push({ x: p.x, y: p.y, r: TOOLS.smokeRadius, t: 0 });
    if (audio) audio.smoke();
    toast(world, 'Smoke out!');
  }
  if (input.empPressed && p.emp > 0) {
    p.emp -= 1;
    world.empT = TOOLS.empDisableSeconds;
    if (audio) audio.emp();
    toast(world, 'EMP burst — cameras and lasers down!');
  }

  // --- Vault door lockpick (hold interact next to a closed door) ---
  const vd = world.vaultDoor;
  if (vd && !vd.open) {
    const d = Math.hypot(p.x - vd.x, p.y - vd.y);
    if (d < 62 && input.interactHeld) {
      vd.progress += dt;
      if (vd.progress >= TOOLS.lockpickSeconds) {
        vd.open = true;
        world.grid[vd.ty][vd.tx] = '.';
        toast(world, 'Vault picked open!');
        if (audio) audio.unlockDoor();
      }
    } else {
      vd.progress = Math.max(0, vd.progress - dt * 2);
    }
  }

  // --- Hack terminal (press interact next to it) ---
  const term = world.terminal;
  if (term && !term.used && input.interactPressed) {
    const d = Math.hypot(p.x - term.x, p.y - term.y);
    if (d < 62) {
      term.used = true;
      world.hackT = TOOLS.hackSeconds;
      toast(world, 'Cameras hacked — 30s blind!');
      if (audio) audio.unlockDoor();
    }
  }

  // --- Pickups ---
  for (const loot of world.loots) {
    if (!loot.taken && Math.hypot(p.x - loot.x, p.y - loot.y) < 26) {
      loot.taken = true;
      world.lootValue += loot.value;
      world.lootCount += 1;
      p.weight += loot.weight;
      toast(world, `+${loot.value} — ${loot.label}`);
      if (audio) audio.pickup();
    }
  }
  if (world.sapphire && !world.sapphire.taken && Math.hypot(p.x - world.sapphire.x, p.y - world.sapphire.y) < 28) {
    world.sapphire.taken = true;
    toast(world, 'STAR SAPPHIRE secured! Get to the exit!');
    if (audio) audio.sapphire();
  }

  // --- Exit ---
  if (world.exit && Math.hypot(p.x - world.exit.x, p.y - world.exit.y) < 28) {
    if (world.lockdownT > 0) {
      if (!world.message || world.time - (world.messageT || 0) > 2) {
        toast(world, 'Exit sealed — lockdown!');
        world.messageT = world.time;
      }
    } else if (world.sapphire && world.sapphire.taken) {
      finishLevel(world, audio);
      return;
    } else if (!world.message || world.time - (world.messageT || 0) > 2) {
      toast(world, 'You need the Star Sapphire first!');
      world.messageT = world.time;
    }
  }

  // --- Detection decay when unseen ---
  let anySees = false;
  for (const g of world.guards) {
    if (canSeePlayer(world, g.x, g.y, g.dir, DETECT.guardRange, DETECT.guardHalfAngle)) { anySees = true; break; }
  }
  if (!anySees) {
    for (const c of world.cameras) {
      if (world.empT > 0 || world.hackT > 0) continue;
      if (canSeePlayer(world, c.x, c.y, c.dir, DETECT.cameraRange, DETECT.cameraHalfAngle)) { anySees = true; break; }
    }
  }
  if (!anySees) world.detection = Math.max(0, world.detection - DETECT.drainPerSecond * dt);

  // --- Cameras ---
  for (const c of world.cameras) {
    c.dir = c.baseDir + Math.sin(world.time * c.speed) * c.sweep;
    if (world.empT > 0 || world.hackT > 0) continue;
    if (canSeePlayer(world, c.x, c.y, c.dir, DETECT.cameraRange, DETECT.cameraHalfAngle)) {
      const dist = Math.hypot(p.x - c.x, p.y - c.y);
      const range = effectiveRange(world, DETECT.cameraRange);
      const rate = 0.35 + 0.45 * (1 - dist / range);
      world.detection = Math.min(1, world.detection + rate * dt);
      world.detectionPeak = Math.max(world.detectionPeak, world.detection);
      if (world.detection >= 1) {
        world.detection = 0.4;
        cameraSpotPlayer(world, audio);
      }
    }
  }

  // --- Lasers ---
  for (const l of world.lasers) {
    if (l.cooldown > 0) continue;
    if (!laserIsOn(world, l)) continue;
    if (distToSegment(p.x, p.y, l.x1, l.y1, l.x2, l.y2) < 11) {
      l.cooldown = 1.2;
      world.alarm = Math.min(100, world.alarm + ALARM.onLaserTrip);
      toast(world, 'Laser tripped!');
      if (audio) audio.laserZap();
      for (const g of world.guards) {
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < 300 && g.state === 'patrol') {
          g.state = 'suspicious';
          g.stateT = 0;
          g.target = { x: p.x, y: p.y };
        }
      }
    }
  }

  // --- Guards & guests ---
  for (const g of world.guards) updateGuard(world, g, dt, audio);
  for (const gu of world.guests) {
    if (gu.pauseT > 0) { gu.pauseT -= dt; continue; }
    const wp = gu.waypoints[gu.wpIndex];
    const dx = wp.x - gu.x;
    const dy = wp.y - gu.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) {
      gu.wpIndex = (gu.wpIndex + 1) % gu.waypoints.length;
      gu.pauseT = gu.pause;
      continue;
    }
    gu.dir = Math.atan2(dy, dx);
    gu.x += (dx / d) * gu.speed * dt;
    gu.y += (dy / d) * gu.speed * dt;
  }
}
