// Ghost bot for the self-test (?selftest=1). One clear job: play a level
// the way a careful ghost would — sneak the route, wait out cones, time
// the lasers, hack the terminal, pick the vault — using only the same
// movement, collision and line-of-sight code the player uses. It proves a
// floor is winnable unseen; it never cheats the simulation.
import { TILE } from './config.js';
import {
  updateWorld, pointInAnyCone, segmentCrossesActiveLaser, laserCycleInfo, tileCenter,
} from './world.js';

const SNEAK_SPEED = 88;

function segmentInAnyCone(world, x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist / 12));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (pointInAnyCone(world, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return true;
  }
  return false;
}

export function makeBot(world) {
  const route = world.ghostRoute.map(([tx, ty]) => tileCenter(tx, ty));
  let ri = 0;
  let retreatTo = -1; // route index to fall back to while hunted
  const input = {
    moveX: 0, moveY: 0, sneak: true, sprint: false,
    interactHeld: false, interactPressed: false,
    coinTarget: null, smokePressed: false, empPressed: false,
    pausePressed: false, mutePressed: false, restartPressed: false,
    anyKeyPressed: false,
  };

  function moveToward(tx, ty) {
    const dx = tx - world.player.x;
    const dy = ty - world.player.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      input.moveX = 0;
      input.moveY = 0;
      return true;
    }
    input.moveX = dx / d;
    input.moveY = dy / d;
    return false;
  }

  function step(dt) {
    if (world.phase === 'complete' || world.phase === 'gameover') return world.phase;
    if (world.phase === 'caught') {
      input.moveX = 0;
      input.moveY = 0;
      input.interactHeld = false;
      updateWorld(world, input, dt, null);
      return 'caught';
    }
    const p = world.player;
    const target = route[Math.min(ri, route.length - 1)];
    if (Math.hypot(target.x - p.x, target.y - p.y) < 12) {
      ri += 1;
      if (ri >= route.length) {
        input.moveX = 0;
        input.moveY = 0;
        updateWorld(world, input, dt, null);
        return 'arrived';
      }
    }
    const next = route[Math.min(ri, route.length - 1)];

    // Hack terminal when passing it.
    input.interactPressed = false;
    const term = world.terminal;
    if (term && !term.used && Math.hypot(p.x - term.x, p.y - term.y) < 62) {
      input.interactPressed = true;
    }

    // Vault: hold interact next to a closed door and stand still to pick.
    const vd = world.vaultDoor;
    const nearVault = vd && !vd.open && Math.hypot(p.x - vd.x, p.y - vd.y) < 62;
    input.interactHeld = !!nearVault;

    const anyAlert = world.guards.some((g) => g.state === 'alert');
    const iAmSeen = pointInAnyCone(world, p.x, p.y);
    const danger = world.detection > 0.3 || iAmSeen || anyAlert;

    if (nearVault && !danger) {
      // Stand and pick the lock.
      input.moveX = 0;
      input.moveY = 0;
    } else if (danger) {
      // Fall back along the route, one waypoint at a time, until unseen.
      if (retreatTo < 0 || retreatTo >= ri) retreatTo = Math.max(0, ri - 1);
      const rt = route[retreatTo];
      if (moveToward(rt.x, rt.y) && retreatTo > 0) retreatTo -= 1;
    } else {
      retreatTo = -1;
      // Laser timing: only start a crossing if the beam stays off long
      // enough to get all the way across.
      const laser = segmentCrossesActiveLaser(world, p.x, p.y, next.x, next.y);
      let laserBlocked = false;
      if (laser) {
        const info = laserCycleInfo(world, laser);
        const crossTime = Math.hypot(next.x - p.x, next.y - p.y) / SNEAK_SPEED + 0.3;
        laserBlocked = info.on || info.untilChange < crossTime + 0.5;
      }
      const pathClear = !pointInAnyCone(world, next.x, next.y)
        && !segmentInAnyCone(world, p.x, p.y, next.x, next.y);
      if (laserBlocked || !pathClear) {
        input.moveX = 0;
        input.moveY = 0;
      } else {
        moveToward(next.x, next.y);
      }
    }
    updateWorld(world, input, dt, null);
    return 'running';
  }

  return {
    input,
    step,
    get routeIndex() {
      return ri;
    },
    get routeLength() {
      return route.length;
    },
  };
}
