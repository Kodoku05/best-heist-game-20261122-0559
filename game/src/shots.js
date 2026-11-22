// Staged scenes for screenshots (?shot=). One clear job: put a world into
// a photogenic, honest state — every scene is one the real game can reach,
// built from the same world and renderer, never screenshot-only art.
import { TILE } from './config.js';
import { createWorld, tileCenter } from './world.js';

function placePlayer(world, tx, ty, dir) {
  const p = tileCenter(tx, ty);
  world.player.x = p.x;
  world.player.y = p.y;
  world.player.dir = dir;
}

function placeGuard(world, index, tx, ty, dir, state) {
  const g = world.guards[index];
  if (!g) return;
  const p = tileCenter(tx, ty);
  g.x = p.x;
  g.y = p.y;
  g.dir = dir;
  g.state = state;
  g.stateT = 0;
  g.pauseT = 0;
}

export function stageShot(name, seed) {
  // Returns { world, screen } for the shot. screen is the UI screen to draw.
  if (name === 'start') {
    const world = createWorld(0, seed);
    return { world, screen: 'title' };
  }
  if (name === 'play') {
    // Level II, mid-heist: thief crouched by a crate, cones sweeping, the
    // laser grid blinking, the Sapphire glowing in its alcove, HUD complete.
    const world = createWorld(1, seed);
    world.time = 47;
    world.alarm = 34;
    world.detection = 0.32;
    placePlayer(world, 8, 10, -Math.PI / 2);
    world.player.sneak = true;
    world.player.coins = 3;
    world.player.smoke = 2;
    world.player.emp = 1;
    world.lootValue = 650;
    world.lootCount = 1;
    world.loots[0].taken = true;
    placeGuard(world, 0, 10, 4, Math.PI / 2, 'patrol');
    placeGuard(world, 1, 24, 6, -Math.PI / 2, 'patrol');
    placeGuard(world, 2, 16, 13, 0, 'patrol');
    return { world, screen: 'play' };
  }
  if (name === 'alert') {
    // Level I, the caught moment: a guard has spotted the thief, red cone,
    // alarm high, thief ducked behind a plant. Fair and readable.
    const world = createWorld(0, seed);
    world.time = 63;
    world.alarm = 78;
    world.detection = 1;
    world.fullSpots = 1;
    placePlayer(world, 6, 12, Math.PI / 4);
    world.player.sneak = true;
    world.lootValue = 400;
    world.lootCount = 1;
    world.loots[0].taken = true;
    placeGuard(world, 0, 9, 12, 0, 'alert');
    world.guards[0].lastSeen = { x: world.player.x, y: world.player.y };
    placeGuard(world, 1, 25, 8, Math.PI, 'suspicious');
    world.guards[1].target = { x: world.player.x, y: world.player.y };
    return { world, screen: 'play' };
  }
  if (name === 'end') {
    // Level I cleared as a GHOST: three stars, loot and time bonus.
    const world = createWorld(0, seed);
    world.time = 74;
    world.phase = 'complete';
    world.lootValue = 1950;
    world.lootCount = 3;
    world.sapphire.taken = true;
    world.loots.forEach((l) => { l.taken = true; });
    world.score = 1950 + 160 + 1000;
    world.rating = 'GHOST';
    world.stars = 3;
    placePlayer(world, 29, 16, -Math.PI / 2);
    return { world, screen: 'complete', totalScore: world.score };
  }
  return null;
}
