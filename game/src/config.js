// Sunset Vice: tuning and world constants. All original: the city of Palmetto Bay,
// its streets, cars, people and story are invented for this game.
export const STEP = 1 / 60;

// World: a 2600 x 2000 city. Roads form a grid; blocks hold buildings, parks and plazas.
export const WORLD = { width: 2600, height: 2000 };
export const ROADS_X = [240, 640, 1040, 1440, 1840, 2240];
export const ROADS_Y = [220, 520, 820, 1120, 1420, 1720];
export const ROAD_W = 96; // road width, sidewalks included
export const LANE_W = 20;

// Player on foot.
export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  runSpeed: 265,
  health: 100,
  punchDamage: 22,
  punchRange: 34,
  punchCooldown: 0.32,
};

// Cars.
export const CAR = {
  length: 54,
  width: 26,
  accel: 340,
  brake: 520,
  reverseAccel: 200,
  maxSpeed: 460,
  maxReverse: 140,
  steer: 2.6,
  grip: 3.2,
  health: 100,
};

// Traffic and pedestrians.
export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 26;
export const TRAFFIC_SPEED = 150;
export const PED_SPEED = 55;

// Wanted level: 0..5 stars. Police response scales with stars.
export const WANTED = {
  max: 5,
  decaySeconds: 26, // quiet seconds to drop one star
  // cops on the hunt per star level (cars + foot cops)
  copsPerStar: [0, 1, 2, 3, 4, 5],
  copCarSpeed: 430,
  copFootSpeed: 185,
};

// Combat.
export const GUN = {
  damage: 34,
  range: 420,
  cooldown: 0.22,
  startAmmo: 24,
  maxAmmo: 120,
};

// Missions: id, title, briefing, reward.
export const MISSIONS = [
  {
    id: 'wheels',
    title: 'First Wheels',
    brief: 'Rico: You need wheels. Steal any car and bring it to the garage on Palm Row.',
    reward: 150,
  },
  {
    id: 'pickup',
    title: 'The Pickup',
    brief: 'Rico: A package waits at the docks, south side. Grab it on foot and bring it back to the garage.',
    reward: 250,
  },
  {
    id: 'heat',
    title: 'Hot Pursuit',
    brief: 'Rico: The cops are onto you. Lose the heat: get your wanted level back to zero.',
    reward: 300,
  },
  {
    id: 'score',
    title: 'The Score',
    brief: 'Rico: The corner store on Coral Ave is holding cash. Hold E inside to clean it out, then lose the cops and reach the safehouse.',
    reward: 500,
  },
  {
    id: 'king',
    title: 'Vice King',
    brief: 'Rico: Last job. Deliver the package to the north gate before the timer runs out. Cops will be everywhere.',
    reward: 800,
  },
];

// Money, pickups, save.
export const PICKUP = { health: 35, ammo: 24, cashMin: 10, cashMax: 40 };
export const SPRAY_COST = 100; // Pay n Spray clears wanted
export const SAVE_KEY = 'sunset-vice-save-v1';
export const BEST_KEY = 'sunset-vice-best-v1';

// Sunset palette for Palmetto Bay.
export const COLORS = {
  grass: '#3f7a4e',
  park: '#4c8a58',
  sand: '#d9b380',
  water: '#2b6cb0',
  road: '#2e2e38',
  roadEdge: '#23232c',
  sidewalk: '#55555f',
  lane: '#e8d44d',
  buildingRoof: ['#7a4a3a', '#5a6b7a', '#8a6a4a', '#4a6b5a', '#6b4a6b', '#9a7a3a'],
  buildingEdge: '#2c2c34',
  carColors: ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#8e44ad', '#16a085', '#e67e22', '#34495e'],
  player: '#ff5e78',
  cop: '#2c3e50',
  copCar: '#1a2a3a',
  pedShirt: ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c'],
  hud: '#f5f0e6',
};
