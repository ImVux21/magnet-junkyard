// ============================================================================
// Magnet Junkyard - Core Game Constants & Taxonomy
// ============================================================================

export interface ScrapItemData {
  typeId: string;
  name: string;
  massKg: number;
  coinValue: number;
  dragResistance: number;
  tier: number;
  color: number;
  shape: 'screw' | 'can' | 'wire' | 'pipe' | 'gear' | 'belt' | 'battery' | 'radiator' | 'alternator' | 'converter' | 'engine' | 'chassis';
  width: number;
  height: number;
  spawnWeights: [number, number, number, number]; // Zone 1, 2, 3, 4 spawn weights
  isGolden?: boolean;
}

export interface JunkyardTier {
  id: number;
  name: string;
  subtitle: string;
  unlockCost: number;
  color: number;
  accentColor: string;
  quota: number;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface CargoState {
  currentMassKg: number;
  maxCapacityKg: number;
  itemsCount: number;
  items: ScrapItemData[];
  isFull: boolean;
}

export interface PlayerUpgrades {
  magnetRange: number;
  attractPower: number;
  carryCapacity: number;
  movementSpeed: number;
}

// ----------------------------------------------------------------------------
// 12 Scrap Item Taxonomy Across 4 Tiers
// ----------------------------------------------------------------------------
export const SCRAP_CATALOG: Record<string, ScrapItemData> = {
  // Tier 1: The Rusted Basin
  screw: {
    typeId: 'screw',
    name: 'Rusty Screws',
    massKg: 1,
    coinValue: 1,
    dragResistance: 1.0,
    tier: 1,
    color: 0xb0bec5,
    shape: 'screw',
    width: 16,
    height: 16,
    spawnWeights: [50, 15, 5, 0],
  },
  can: {
    typeId: 'can',
    name: 'Crushed Soda Can',
    massKg: 1,
    coinValue: 2,
    dragResistance: 1.0,
    tier: 1,
    color: 0xef5350,
    shape: 'can',
    width: 20,
    height: 16,
    spawnWeights: [35, 20, 5, 0],
  },
  pipe: {
    typeId: 'pipe',
    name: 'Iron Pipe Scrap',
    massKg: 2,
    coinValue: 6,
    dragResistance: 1.5,
    tier: 1,
    color: 0x78909c,
    shape: 'pipe',
    width: 28,
    height: 14,
    spawnWeights: [15, 15, 10, 0],
  },

  // Tier 2: Smelter's Yard
  copper_wire: {
    typeId: 'copper_wire',
    name: 'Copper Wire Spool',
    massKg: 2.0,
    coinValue: 18,
    dragResistance: 1.5,
    tier: 2,
    color: 0xff7043,
    shape: 'wire',
    width: 22,
    height: 22,
    spawnWeights: [0, 25, 15, 5],
  },
  battery: {
    typeId: 'battery',
    name: 'Lead-Acid Battery',
    massKg: 3,
    coinValue: 15,
    dragResistance: 2.5,
    tier: 2,
    color: 0x455a64,
    shape: 'battery',
    width: 26,
    height: 20,
    spawnWeights: [0, 15, 15, 5],
  },
  steel_plate: {
    typeId: 'steel_plate',
    name: 'Heavy Steel Plate',
    massKg: 5,
    coinValue: 50,
    dragResistance: 4.0,
    tier: 2,
    color: 0x546e7a,
    shape: 'gear',
    width: 30,
    height: 30,
    spawnWeights: [0, 10, 15, 10],
  },

  // Tier 3: Automotive Graveyard
  engine_belt: {
    typeId: 'engine_belt',
    name: 'Alternator Belt',
    massKg: 6.0,
    coinValue: 90,
    dragResistance: 4.5,
    tier: 3,
    color: 0x263238,
    shape: 'belt',
    width: 32,
    height: 24,
    spawnWeights: [0, 0, 15, 10],
  },
  radiator: {
    typeId: 'radiator',
    name: 'Brass Radiator',
    massKg: 8.0,
    coinValue: 140,
    dragResistance: 5.5,
    tier: 3,
    color: 0xd4af37,
    shape: 'radiator',
    width: 36,
    height: 28,
    spawnWeights: [0, 0, 15, 15],
  },
  car_chassis: {
    typeId: 'car_chassis',
    name: 'Vehicle Door Panel',
    massKg: 12,
    coinValue: 240,
    dragResistance: 9.0,
    tier: 3,
    color: 0x1e88e5,
    shape: 'chassis',
    width: 42,
    height: 32,
    spawnWeights: [0, 0, 10, 15],
  },

  // Tier 4: Titanium Ridge
  catalytic_converter: {
    typeId: 'catalytic_converter',
    name: 'Catalytic Converter',
    massKg: 9.0,
    coinValue: 340,
    dragResistance: 6.5,
    tier: 4,
    color: 0xffb300,
    shape: 'converter',
    width: 38,
    height: 22,
    spawnWeights: [0, 0, 5, 20],
  },
  engine_block: {
    typeId: 'engine_block',
    name: 'Cracked V6 Engine',
    massKg: 8,
    coinValue: 120,
    dragResistance: 6.5,
    tier: 4,
    color: 0x37474f,
    shape: 'engine',
    width: 44,
    height: 36,
    spawnWeights: [0, 0, 5, 20],
  },
  rocket_nozzle: {
    typeId: 'rocket_nozzle',
    name: 'Rocket Thruster Bell',
    massKg: 16.0,
    coinValue: 800,
    dragResistance: 12.0,
    tier: 4,
    color: 0x00e5ff,
    shape: 'converter',
    width: 48,
    height: 48,
    spawnWeights: [0, 0, 0, 15],
  },
};

// ----------------------------------------------------------------------------
// 4 Junkyard Tier Definitions
// ----------------------------------------------------------------------------
export const JUNKYARD_TIERS: JunkyardTier[] = [
  {
    id: 1,
    name: 'The Rusted Basin',
    subtitle: 'Surface Scrap & Hardware',
    unlockCost: 0,
    color: 0x3d352e,
    accentColor: '#44dd88',
    quota: 45,
    bounds: { x: 120, y: 120, width: 1260, height: 980 },
  },
  {
    id: 2,
    name: "Smelter's Yard",
    subtitle: 'Dense Alloys & Batteries',
    unlockCost: 750,
    color: 0x4a3b32,
    accentColor: '#ffb300',
    quota: 60,
    bounds: { x: 1620, y: 120, width: 1260, height: 980 },
  },
  {
    id: 3,
    name: 'Automotive Graveyard',
    subtitle: 'Machinery & Engine Blocks',
    unlockCost: 5000,
    color: 0x2e3b44,
    accentColor: '#29b6f6',
    quota: 75,
    bounds: { x: 120, y: 1300, width: 1260, height: 980 },
  },
  {
    id: 4,
    name: 'Titanium Ridge',
    subtitle: 'Aerospace & Rare Composites',
    unlockCost: 25000,
    color: 0x2e243d,
    accentColor: '#ab47bc',
    quota: 80,
    bounds: { x: 1620, y: 1300, width: 1260, height: 980 },
  },
];

// ----------------------------------------------------------------------------
// Upgrade Attribute Formulas & Balance Tables (Levels 1 - 10)
// ----------------------------------------------------------------------------
export const UPGRADE_MAX_LEVEL = 10;

/** Magnet Range: 120px to 345px */
export function getMagnetRange(level: number): number {
  const clamped = Math.max(1, Math.min(UPGRADE_MAX_LEVEL, level));
  return 120 + 25 * (clamped - 1);
}

/** Attract Power: 350 to 1137 px/s² */
export function getAttractPower(level: number): number {
  const clamped = Math.max(1, Math.min(UPGRADE_MAX_LEVEL, level));
  return Math.floor(350 * (1 + 0.25 * (clamped - 1)));
}

/** Carry Capacity: 6kg to 123kg */
export function getCarryCapacity(level: number): number {
  const clamped = Math.max(1, Math.min(UPGRADE_MAX_LEVEL, level));
  return 6 + 4 * (clamped - 1) + (clamped - 1) * (clamped - 1);
}

/** Movement Speed: 200px/s to 380px/s */
export function getMovementSpeed(level: number): number {
  const clamped = Math.max(1, Math.min(UPGRADE_MAX_LEVEL, level));
  return 200 + 20 * (clamped - 1);
}

// Upgrade Cost Formulas: Cost to upgrade from level L to L+1 (Scaled ~3.4x for M_O1)
export function getMagnetRangeCost(level: number): number {
  if (level >= UPGRADE_MAX_LEVEL) return Infinity;
  return Math.floor(50 * Math.pow(1.45, level - 1));
}

export function getAttractPowerCost(level: number): number {
  if (level >= UPGRADE_MAX_LEVEL) return Infinity;
  return Math.floor(70 * Math.pow(1.42, level - 1));
}

export function getCarryCapacityCost(level: number): number {
  if (level >= UPGRADE_MAX_LEVEL) return Infinity;
  return Math.floor(85 * Math.pow(1.50, level - 1));
}

export function getMovementSpeedCost(level: number): number {
  if (level >= UPGRADE_MAX_LEVEL) return Infinity;
  return Math.floor(100 * Math.pow(1.45, level - 1));
}

export function getUpgradeCost(statId: keyof PlayerUpgrades, currentLevel: number): number {
  switch (statId) {
    case 'magnetRange':
      return getMagnetRangeCost(currentLevel);
    case 'attractPower':
      return getAttractPowerCost(currentLevel);
    case 'carryCapacity':
      return getCarryCapacityCost(currentLevel);
    case 'movementSpeed':
      return getMovementSpeedCost(currentLevel);
    default:
      return Infinity;
  }
}

export const TIER_UNLOCK_COSTS: Record<number, number> = { 1: 0, 2: 750, 3: 5000, 4: 25000 };

export const UPGRADE_BASE_COSTS: Record<keyof PlayerUpgrades, number> = {
  magnetRange: 50,
  attractPower: 70,
  carryCapacity: 85,
  movementSpeed: 100,
};

export const UPGRADE_COST_MULTIPLIERS: Record<keyof PlayerUpgrades, number> = {
  magnetRange: 1.45,
  attractPower: 1.42,
  carryCapacity: 1.50,
  movementSpeed: 1.45,
};

// ----------------------------------------------------------------------------
// Global Game Constants
// ----------------------------------------------------------------------------
export const GAME_CONSTANTS = {
  WORLD_WIDTH: 3000,
  WORLD_HEIGHT: 2400,
  RECYCLER_CENTER: { x: 1500, y: 1200 },
  RECYCLER_RADIUS: 110,
  RECYCLER_PROCESS_INTERVAL_MS: 75,
  ROVER_COLLISION_RADIUS: 22,
  ROVER_ACCELERATION: 1200,
  ROVER_DRAG: 800,
  ROVER_TURN_RATE: 10.0, // rad/s
  MAGNET_FORWARD_OFFSET: 22,
  CAPTURE_RADIUS: 26,
  TOTAL_POOL_SIZE: 260,
  RESPAWN_INTERVAL_MS: 1500,
  RESPAWN_MIN_PLAYER_DIST: 180,
  RESPAWN_MIN_RECYCLER_DIST: 220,
  JOYSTICK_RADIUS: 52,
  JOYSTICK_DEADZONE: 8,
};
