// GILDED — The Star Sapphire Gala Heist. Tuning numbers and palette.
// One clear job: every magic number the game uses lives here.
export const TILE = 40;
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PLAYER_RADIUS = 13;
export const WALK_SPEED = 155;
export const SNEAK_SPEED = 88;
export const SPRINT_SPEED = 235;

export const DETECT = {
  guardRange: 250,
  guardHalfAngle: 0.52, // ~30 degrees each side
  cameraRange: 230,
  cameraHalfAngle: 0.46,
  fillPerSecondClose: 0.9, // detection 0..1 fills this fast at point blank
  fillPerSecondFar: 0.28, // ...and this fast at max range
  drainPerSecond: 0.45,
  shadowRangeFactor: 0.55, // standing in shadow shrinks a cone's reach
  sneakRangeFactor: 0.6,
  sprintRangeFactor: 1.45,
  blendRangeFactor: 0.5, // mingling with gala guests
  plantHideDistance: 85, // inside a plant you are invisible beyond this
  hearSprintRadius: 170,
  hearCoinRadius: 260,
};

export const ALARM = {
  onFullSpot: 34, // alarm jump when a guard fully spots you
  onCameraSpot: 26,
  onLaserTrip: 18,
  onNoiseHeard: 6,
  decayPerSecond: 1.6,
  lockdownAt: 100,
  lockdownSeconds: 8,
  afterLockdown: 45,
};

export const TOOLS = {
  coinsStart: 4,
  smokeStart: 2,
  empStart: 2,
  empDisableSeconds: 12,
  smokeSeconds: 6,
  smokeRadius: 110,
  lockpickSeconds: 2.4,
  hackSeconds: 30, // terminal disables cameras this long
};

export const LIVES_PER_LEVEL = 3;

export const PALETTE = {
  floor: '#1c1a26',
  floorAlt: '#201d2c',
  floorShadow: '#14121d',
  floorBallroom: '#2a2338',
  wall: '#4a3d63',
  wallTop: '#6b5a8f',
  crate: '#5a4632',
  crateTop: '#7d6547',
  plant: '#1f4d2e',
  plantTop: '#2f7a44',
  laser: '#ff2e63',
  laserOff: '#5c1f30',
  player: '#37e0c8',
  playerSneak: '#2bb3a1',
  guest: '#e8c96a',
  guard: '#ff9f43',
  guardAlert: '#ff2e4d',
  camera: '#c9d1ff',
  sapphire: '#4dc3ff',
  loot: '#ffd166',
  exit: '#3dff7a',
  vault: '#8f7b3a',
  hudBg: 'rgba(10, 8, 18, 0.82)',
  text: '#f2ead8',
  textDim: '#a89f8a',
  danger: '#ff4d6d',
  gold: '#e8c96a',
};

export const LEVEL_NAMES = [
  'I — The Gala Hall',
  'II — The Gallery Wing',
  'III — The Vault Floor',
  'IV — Rooftop Getaway',
];
