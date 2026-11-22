// Canvas renderer. One clear job: draw the world, the HUD and every
// screen. It reads world state; it never changes it.
import { TILE, VIEW_W, VIEW_H, PALETTE, DETECT, TOOLS } from './config.js';
import { tileAt } from './world.js';

function conePath(ctx, x, y, dir, range, halfAngle) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, dir - halfAngle, dir + halfAngle);
  ctx.closePath();
}

function drawCone(ctx, x, y, dir, range, halfAngle, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  conePath(ctx, x, y, dir, range, halfAngle);
  ctx.fill();
  ctx.globalAlpha = alpha * 1.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, world) {
  // --- Floor ---
  for (let ty = 0; ty < world.rows; ty += 1) {
    for (let tx = 0; tx < world.cols; tx += 1) {
      const ch = tileAt(world, tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(x, y, TILE, 6);
        continue;
      }
      ctx.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
      if (ch === 'S') ctx.fillStyle = PALETTE.floorShadow;
      ctx.fillRect(x, y, TILE, TILE);
      if (ch === 'S') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y, TILE, TILE);
      }
      // Subtle tile grout.
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }

  // --- Exit pad ---
  const ex = world.exit;
  if (ex) {
    const open = world.sapphire && world.sapphire.taken;
    const locked = world.lockdownT > 0;
    ctx.save();
    ctx.globalAlpha = open && !locked ? 0.9 : 0.45;
    ctx.fillStyle = locked ? PALETTE.danger : PALETTE.exit;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#062b14';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(locked ? 'SEALED' : 'EXIT', ex.x, ex.y + 4);
    ctx.restore();
  }

  // --- Loot + sapphire ---
  for (const loot of world.loots) {
    if (loot.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(world.time * 3 + loot.tx);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.loot;
    ctx.beginPath();
    ctx.arc(loot.x, loot.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2c00';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('$', loot.x, loot.y + 3.5);
    ctx.restore();
  }
  const sap = world.sapphire;
  if (sap && !sap.taken) {
    const pulse = 0.7 + 0.3 * Math.sin(world.time * 4);
    ctx.save();
    ctx.shadowColor = PALETTE.sapphire;
    ctx.shadowBlur = 22;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.sapphire;
    ctx.beginPath();
    ctx.moveTo(sap.x, sap.y - 13);
    ctx.lineTo(sap.x + 10, sap.y);
    ctx.lineTo(sap.x, sap.y + 13);
    ctx.lineTo(sap.x - 10, sap.y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#06283d';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SAPPHIRE', sap.x, sap.y - 20);
    ctx.restore();
  }

  // --- Vault door / terminal ---
  const vd = world.vaultDoor;
  if (vd) {
    ctx.fillStyle = vd.open ? '#3a3222' : PALETTE.vault;
    ctx.fillRect(vd.x - 20, vd.y - 20, 40, 40);
    ctx.strokeStyle = '#d9c25a';
    ctx.lineWidth = 2;
    ctx.strokeRect(vd.x - 20, vd.y - 20, 40, 40);
    ctx.fillStyle = '#241d0c';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(vd.open ? 'OPEN' : 'VAULT', vd.x, vd.y + 3);
    if (!vd.open && vd.progress > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(vd.x - 18, vd.y + 24, 36 * (vd.progress / TOOLS.lockpickSeconds), 4);
    }
  }
  const term = world.terminal;
  if (term) {
    ctx.fillStyle = term.used ? '#2c3a4d' : '#274b63';
    ctx.fillRect(term.x - 14, term.y - 14, 28, 28);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(term.used ? 'OFF' : 'HACK', term.x, term.y + 3);
  }

  // --- Plants (hide spots) ---
  for (let ty = 0; ty < world.rows; ty += 1) {
    for (let tx = 0; tx < world.cols; tx += 1) {
      if (tileAt(world, tx, ty) !== 'b') continue;
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = PALETTE.plant;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = PALETTE.plantTop;
      for (let i = 0; i < 5; i += 1) {
        const lx = x + 8 + ((i * 7) % 26);
        const ly = y + 8 + ((i * 11) % 24);
        ctx.beginPath();
        ctx.arc(lx, ly, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // --- Crates ---
  for (let ty = 0; ty < world.rows; ty += 1) {
    for (let tx = 0; tx < world.cols; tx += 1) {
      if (tileAt(world, tx, ty) !== 'C') continue;
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = PALETTE.crateTop;
      ctx.fillRect(x + 2, y + 2, TILE - 4, 8);
      ctx.strokeStyle = '#2e2113';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + TILE - 2, y + TILE - 2);
      ctx.moveTo(x + TILE - 2, y + 2);
      ctx.lineTo(x + 2, y + TILE - 2);
      ctx.stroke();
    }
  }

  // --- Lasers ---
  for (const l of world.lasers) {
    const on = world.empT > 0 ? false : ((world.time + l.phase) % l.period) < l.period * 0.62;
    ctx.save();
    ctx.strokeStyle = on ? PALETTE.laser : PALETTE.laserOff;
    ctx.globalAlpha = on ? 0.95 : 0.35;
    ctx.lineWidth = on ? 3 : 2;
    ctx.setLineDash(on ? [] : [6, 6]);
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Emitters.
    ctx.fillStyle = '#3d1420';
    ctx.fillRect(l.x1 - 5, l.y1 - 5, 10, 10);
    ctx.fillRect(l.x2 - 5, l.y2 - 5, 10, 10);
    ctx.restore();
  }

  // --- Vision cones (under the entities) ---
  for (const g of world.guards) {
    const color = g.state === 'alert' ? PALETTE.guardAlert : g.state === 'patrol' ? '#ffb84d' : '#ff7a3d';
    drawCone(ctx, g.x, g.y, g.dir, DETECT.guardRange, DETECT.guardHalfAngle, color, g.state === 'alert' ? 0.30 : 0.20);
  }
  for (const c of world.cameras) {
    if (world.empT > 0 || world.hackT > 0) continue;
    drawCone(ctx, c.x, c.y, c.dir, DETECT.cameraRange, DETECT.cameraHalfAngle, '#7fb2ff', 0.16);
  }

  // --- Smoke clouds ---
  for (const s of world.smokes) {
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - s.t / TOOLS.smokeSeconds);
    ctx.fillStyle = '#c9c9d4';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- Guests (blend cover) ---
  for (const gu of world.guests) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = PALETTE.guest;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(gu.x, gu.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.guest;
    ctx.beginPath();
    ctx.arc(gu.x, gu.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241d05';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('G', gu.x, gu.y + 3);
    ctx.restore();
  }

  // --- Cameras ---
  for (const c of world.cameras) {
    const off = world.empT > 0 || world.hackT > 0;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.dir);
    ctx.fillStyle = off ? '#4a4a55' : PALETTE.camera;
    ctx.fillRect(-4, -6, 18, 12);
    ctx.fillStyle = off ? '#33333c' : '#ff4d6d';
    ctx.beginPath();
    ctx.arc(14, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- Guards ---
  for (const g of world.guards) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.fillStyle = g.state === 'alert' ? PALETTE.guardAlert : PALETTE.guard;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(g.dir);
    ctx.fillStyle = '#1d1206';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(2, -6);
    ctx.lineTo(2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // State mark.
    if (g.state === 'suspicious' || g.state === 'search') {
      ctx.fillStyle = '#ffb84d';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 20);
    } else if (g.state === 'alert') {
      ctx.fillStyle = PALETTE.guardAlert;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 20);
    }
  }

  // --- Thrown coins ---
  for (const c of world.coinsFlying) {
    const t = c.t / 0.35;
    const x = c.x + (c.tx - c.x) * t;
    const y = c.y + (c.ty - c.y) * t - Math.sin(t * Math.PI) * 26;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Noise rings ---
  for (const r of world.noiseRings) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - r.r / r.max) * 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- Player (Marlowe Fox) ---
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow blend ring when hidden in a plant.
  ctx.fillStyle = p.sneak ? PALETTE.playerSneak : PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.dir);
  ctx.fillStyle = '#06231f';
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(1, -7);
  ctx.lineTo(1, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Loot-weight satchel.
  if (p.weight > 0) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`[${p.weight}kg]`, p.x, p.y - 20);
  }
  // Detection eye above the player.
  if (world.detection > 0.04 && world.phase === 'play') {
    const d = world.detection;
    ctx.save();
    ctx.translate(p.x, p.y - 32);
    ctx.fillStyle = 'rgba(10,8,18,0.85)';
    roundRect(ctx, -26, -11, 52, 22, 6);
    ctx.fill();
    ctx.fillStyle = d > 0.7 ? PALETTE.danger : '#ffd166';
    ctx.beginPath();
    ctx.arc(-14, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-14, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d > 0.7 ? PALETTE.danger : '#ffd166';
    ctx.fillRect(-6, -3, 32 * d, 6);
    ctx.restore();
  }
}

export function drawHUD(ctx, world) {
  ctx.save();
  // Top bar.
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, 46);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(world.def.name, 14, 20);
  ctx.font = '12px monospace';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(world.def.subtitle, 14, 38);

  // Alarm meter (center).
  const ax = 470;
  const aw = 340;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', ax, 18);
  ctx.fillStyle = '#241a20';
  roundRect(ctx, ax, 24, aw, 12, 6);
  ctx.fill();
  const aFrac = Math.min(1, world.alarm / 100);
  ctx.fillStyle = world.lockdownT > 0 ? PALETTE.danger : aFrac > 0.66 ? '#ff9f43' : aFrac > 0.33 ? '#ffd166' : '#3dff7a';
  if (aFrac > 0) {
    roundRect(ctx, ax, 24, aw * aFrac, 12, 6);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(world.lockdownT > 0 ? 'LOCKDOWN!' : `${Math.round(world.alarm)}%`, ax + aw + 52, 35);

  // Right side: loot, tools, lives, timer.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`$${world.lootValue.toLocaleString('en-US')}`, 1252, 20);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '12px monospace';
  const tools = `coin x${world.player.coins}   smoke x${world.player.smoke}   EMP x${world.player.emp}`;
  ctx.fillText(tools, 1252, 38);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.danger;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('♥'.repeat(Math.max(0, world.lives)) + '♡'.repeat(Math.max(0, 3 - world.lives)), 880, 20);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '12px monospace';
  const mm = Math.floor(world.time / 60);
  const ss = Math.floor(world.time % 60).toString().padStart(2, '0');
  ctx.fillText(`${mm}:${ss}`, 880, 38);

  // Objective line.
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '12px monospace';
  const obj = world.sapphire && world.sapphire.taken
    ? 'Sapphire secured — reach the green EXIT!'
    : 'Steal the STAR SAPPHIRE, then reach the EXIT. Stay out of the cones.';
  ctx.fillText(obj, 14, 64);

  // Toasts (bottom-left).
  ctx.font = 'bold 13px monospace';
  world.toasts.forEach((t, i) => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, 3.2 - t.t);
    ctx.fillStyle = 'rgba(10,8,18,0.85)';
    const w = ctx.measureText(t.text).width + 20;
    roundRect(ctx, 12, VIEW_H - 40 - i * 26, w, 22, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(t.text, 22, VIEW_H - 24 - i * 26);
    ctx.restore();
  });

  // Minimap (bottom-right).
  const mw = 150;
  const mh = 84;
  const mx = VIEW_W - mw - 12;
  const my = VIEW_H - mh - 12;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,18,0.8)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  const sx = mw / (world.cols * TILE);
  const sy = mh / (world.rows * TILE);
  for (let ty = 0; ty < world.rows; ty += 1) {
    for (let tx = 0; tx < world.cols; tx += 1) {
      const ch = tileAt(world, tx, ty);
      if (ch === '#') ctx.fillStyle = '#6b5a8f';
      else if (ch === 'C') ctx.fillStyle = '#7d6547';
      else continue;
      ctx.fillRect(mx + tx * TILE * sx, my + ty * TILE * sy, TILE * sx + 0.5, TILE * sy + 0.5);
    }
  }
  if (world.sapphire && !world.sapphire.taken) {
    ctx.fillStyle = PALETTE.sapphire;
    ctx.fillRect(mx + world.sapphire.x * sx - 2, my + world.sapphire.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = PALETTE.exit;
  ctx.fillRect(mx + world.exit.x * sx - 2, my + world.exit.y * sy - 2, 4, 4);
  for (const g of world.guards) {
    ctx.fillStyle = g.state === 'alert' ? PALETTE.guardAlert : PALETTE.guard;
    ctx.fillRect(mx + g.x * sx - 2, my + g.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Controls hint.
  ctx.fillStyle = 'rgba(242,234,216,0.55)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move · SHIFT sprint (loud) · C sneak · CLICK throw coin · Q smoke · F EMP · E pick / hack · P pause · M mute · R restart', VIEW_W / 2, VIEW_H - 8);
  ctx.restore();
}

function dim(ctx) {
  ctx.fillStyle = 'rgba(8,6,14,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function titleText(ctx, text, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, y);
}

export function drawTitle(ctx, totalScore) {
  dim(ctx);
  titleText(ctx, 'GILDED', 170, 84, PALETTE.gold);
  titleText(ctx, 'THE STAR SAPPHIRE GALA HEIST', 220, 26, PALETTE.sapphire);
  titleText(ctx, 'You are Marlowe Fox, gentleman thief. The Meridian Museum is', 300, 17, PALETTE.text);
  titleText(ctx, 'holding its grandest gala tonight — and the Star Sapphire', 326, 17, PALETTE.text);
  titleText(ctx, 'is sitting in a glass case, guarded, filmed and lasered.', 352, 17, PALETTE.text);
  titleText(ctx, 'Four floors. One sapphire. No alarms. Probably.', 396, 17, PALETTE.textDim);
  if (totalScore > 0) titleText(ctx, `Campaign best: $${totalScore.toLocaleString('en-US')}`, 440, 16, PALETTE.gold);
  drawMenuButton(ctx, VIEW_W / 2 - 330, 496, 200, 40, '[ ENTER ] Play');
  drawMenuButton(ctx, VIEW_W / 2 - 100, 496, 200, 40, '[ H ] How to play');
  drawMenuButton(ctx, VIEW_W / 2 + 130, 496, 200, 40, '[ L ] Level select');
  titleText(ctx, 'WASD move · SHIFT sprint · C sneak · CLICK throw a coin · Q smoke · F EMP · E pick locks', 580, 14, PALETTE.textDim);
  titleText(ctx, 'Guards see cones. Cameras sweep. Lasers blink. The alarm meter is always watching.', 606, 14, PALETTE.textDim);
}

function drawMenuButton(ctx, x, y, w, h, label) {
  ctx.fillStyle = 'rgba(232,201,106,0.10)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = '15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
}

export function drawHowTo(ctx) {
  dim(ctx);
  titleText(ctx, 'HOW TO PLAY', 90, 36, PALETTE.gold);
  const lines = [
    'MOVE  WASD / arrows. SHIFT sprints (fast, LOUD — guards hear it).',
    'SNEAK  Hold C: slow, quiet, cones reach half as far.',
    'CONES  Amber wedges are guard sight. Red means you are caught in it.',
    'SHADOW  Dark floor halves a cone. Plants hide you unless a guard is close.',
    'GUESTS  Mingle with the golden guests — guards barely notice you near them.',
    'COIN  Click anywhere to toss a coin (limited). Guards investigate the clink.',
    'SMOKE  Q drops a smoke cloud (limited). EMP  F kills cameras and lasers 12s.',
    'VAULT  Stand by the vault door and HOLD E to pick the lock.',
    'HACK  Stand by a terminal and press E: cameras go blind for 30s.',
    'LOOT  Gold is heavy — every kilo slows you down. The Sapphire is the job.',
    'ALARM  Being seen, tripping lasers and noise raise it. At 100%: LOCKDOWN.',
    'CAUGHT  A guard touching you while alerted costs a life. Three per floor.',
    'RATING  Finish unseen and uncaught for GHOST (3 stars).',
  ];
  ctx.textAlign = 'left';
  ctx.font = '15px monospace';
  lines.forEach((line, i) => {
    ctx.fillStyle = i % 2 === 0 ? PALETTE.text : PALETTE.textDim;
    ctx.fillText(line, 150, 140 + i * 32);
  });
  titleText(ctx, '[ ESC / H ]  Back', 620, 17, PALETTE.text);
}

export function drawLevelSelect(ctx, unlocked, selected) {
  dim(ctx);
  titleText(ctx, 'CHOOSE A FLOOR', 110, 36, PALETTE.gold);
  const names = ['I — The Gala Hall', 'II — The Gallery Wing', 'III — The Vault Floor', 'IV — Rooftop Getaway'];
  names.forEach((name, i) => {
    const y = 200 + i * 72;
    const avail = i <= unlocked;
    ctx.fillStyle = i === selected ? 'rgba(232,201,106,0.16)' : 'rgba(255,255,255,0.04)';
    roundRect(ctx, VIEW_W / 2 - 320, y - 28, 640, 52, 10);
    ctx.fill();
    ctx.strokeStyle = i === selected ? PALETTE.gold : '#444';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = avail ? PALETTE.text : '#555';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(avail ? name : `${name}  —  locked`, VIEW_W / 2, y + 7);
  });
  titleText(ctx, '[ ↑ ↓ ] choose   [ ENTER ] play   [ ESC ] back', 540, 17, PALETTE.textDim);
}

export function drawPaused(ctx) {
  dim(ctx);
  titleText(ctx, 'PAUSED', 300, 48, PALETTE.text);
  titleText(ctx, '[ P / ESC ] resume      [ R ] restart floor      [ T ] title', 380, 18, PALETTE.textDim);
}

export function drawLevelComplete(ctx, world, totalScore) {
  dim(ctx);
  titleText(ctx, 'FLOOR CLEARED', 130, 44, PALETTE.exit);
  titleText(ctx, world.def.name, 180, 22, PALETTE.text);
  const stars = '★'.repeat(world.stars) + '☆'.repeat(3 - world.stars);
  titleText(ctx, stars, 250, 44, PALETTE.gold);
  titleText(ctx, `Rating: ${world.rating}`, 310, 22, PALETTE.text);
  titleText(ctx, `Loot  $${world.lootValue.toLocaleString('en-US')}   ·   Time  ${Math.floor(world.time)}s   ·   Floor score  ${world.score.toLocaleString('en-US')}`, 360, 18, PALETTE.textDim);
  titleText(ctx, `Campaign total  $${totalScore.toLocaleString('en-US')}`, 400, 18, PALETTE.gold);
  drawMenuButton(ctx, VIEW_W / 2 - 330, 468, 200, 40, '[ ENTER ] Next floor');
  drawMenuButton(ctx, VIEW_W / 2 - 100, 468, 200, 40, '[ R ] Replay');
  drawMenuButton(ctx, VIEW_W / 2 + 130, 468, 200, 40, '[ T ] Title');
}

export function drawGameOver(ctx, world) {
  dim(ctx);
  titleText(ctx, 'THE GALA HAS YOU', 280, 44, PALETTE.danger);
  titleText(ctx, 'Security dragged Marlowe Fox out past the velvet rope.', 340, 18, PALETTE.text);
  drawMenuButton(ctx, VIEW_W / 2 - 320, 396, 280, 40, '[ R ] Try the floor again');
  drawMenuButton(ctx, VIEW_W / 2 + 20, 396, 200, 40, '[ T ] Title');
}

export function drawCampaignComplete(ctx, totalScore) {
  dim(ctx);
  titleText(ctx, 'THE PERFECT HEIST', 200, 52, PALETTE.gold);
  titleText(ctx, 'Four floors. One Star Sapphire. The getaway car is already running.', 280, 19, PALETTE.text);
  titleText(ctx, `Final campaign score  $${totalScore.toLocaleString('en-US')}`, 340, 22, PALETTE.sapphire);
  titleText(ctx, '[ ENTER ]  Play again          [ T ]  Title', 440, 19, PALETTE.text);
}

export function drawCaughtFlash(ctx, world) {
  if (world.phase !== 'caught') return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, world.phaseT);
  ctx.fillStyle = PALETTE.danger;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
  titleText(ctx, 'CAUGHT!', VIEW_H / 2 - 10, 64, '#ffffff');
}
