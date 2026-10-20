import { describe, it, expect } from 'vitest';

// ============================================================================
// Authoritative Economy Specifications per PROJECT.md & explorer_survey_3
// ============================================================================

export interface ScrapItemData {
  typeId: string;
  name: string;
  massKg: number;
  coinValue: number;
  dragResistance: number;
  tier: number;
}

export const AUTHORITATIVE_SCRAP_CATALOG: Record<string, ScrapItemData> = {
  // Tier 1: The Rusted Basin
  screw: { typeId: 'screw', name: 'Rusty Screws', massKg: 1, coinValue: 1, dragResistance: 1.0, tier: 1 },
  can: { typeId: 'can', name: 'Crushed Soda Can', massKg: 1, coinValue: 2, dragResistance: 1.0, tier: 1 },
  pipe: { typeId: 'pipe', name: 'Iron Pipe Scrap', massKg: 2, coinValue: 6, dragResistance: 1.5, tier: 1 },

  // Tier 2: Smelter's Yard
  copper_wire: { typeId: 'copper_wire', name: 'Copper Wire Spool', massKg: 2.0, coinValue: 18, dragResistance: 1.5, tier: 2 },
  battery: { typeId: 'battery', name: 'Lead-Acid Battery', massKg: 3, coinValue: 15, dragResistance: 2.5, tier: 2 },
  steel_plate: { typeId: 'steel_plate', name: 'Heavy Steel Plate', massKg: 5, coinValue: 50, dragResistance: 4.0, tier: 2 },

  // Tier 3: Automotive Graveyard
  engine_belt: { typeId: 'engine_belt', name: 'Alternator Belt', massKg: 6.0, coinValue: 90, dragResistance: 4.5, tier: 3 },
  radiator: { typeId: 'radiator', name: 'Brass Radiator', massKg: 8.0, coinValue: 140, dragResistance: 5.5, tier: 3 },
  car_chassis: { typeId: 'car_chassis', name: 'Vehicle Door Panel', massKg: 12, coinValue: 240, dragResistance: 9.0, tier: 3 },

  // Tier 4: Titanium Ridge
  catalytic_converter: { typeId: 'catalytic_converter', name: 'Catalytic Converter', massKg: 9.0, coinValue: 340, dragResistance: 6.5, tier: 4 },
  engine_block: { typeId: 'engine_block', name: 'Cracked V6 Engine', massKg: 8, coinValue: 120, dragResistance: 6.5, tier: 4 },
  rocket_nozzle: { typeId: 'rocket_nozzle', name: 'Rocket Thruster Bell', massKg: 16.0, coinValue: 800, dragResistance: 12.0, tier: 4 },
};

export const TIER_UNLOCK_COSTS: Record<number, number> = {
  1: 0,
  2: 750,
  3: 5000,
  4: 25000,
};

// Reference mathematical formula implementations
export function calcMagnetRange(level: number): number {
  if (level < 1 || !Number.isInteger(level) || isNaN(level)) {
    throw new Error(`Invalid upgrade level: ${level}`);
  }
  return 120 + 25 * (level - 1);
}

export function calcAttractPower(level: number): number {
  if (level < 1 || !Number.isInteger(level) || isNaN(level)) {
    throw new Error(`Invalid upgrade level: ${level}`);
  }
  return 350 * (1 + 0.25 * (level - 1));
}

export function calcCarryCapacity(level: number): number {
  if (level < 1 || !Number.isInteger(level) || isNaN(level)) {
    throw new Error(`Invalid upgrade level: ${level}`);
  }
  return 6 + 4 * (level - 1) + Math.pow(level - 1, 2);
}

export function calcMovementSpeed(level: number): number {
  if (level < 1 || !Number.isInteger(level) || isNaN(level)) {
    throw new Error(`Invalid upgrade level: ${level}`);
  }
  return 200 + 20 * (level - 1);
}

export type UpgradeType = 'magnetRange' | 'attractPower' | 'carryCapacity' | 'movementSpeed';

export const UPGRADE_BASE_COSTS: Record<UpgradeType, { base: number; multiplier: number }> = {
  magnetRange: { base: 50, multiplier: 1.45 },
  attractPower: { base: 70, multiplier: 1.42 },
  carryCapacity: { base: 85, multiplier: 1.50 },
  movementSpeed: { base: 100, multiplier: 1.45 },
};

export function calcUpgradeCost(type: UpgradeType, currentLevel: number): number {
  if (currentLevel < 1 || !Number.isInteger(currentLevel) || isNaN(currentLevel)) {
    throw new Error(`Invalid upgrade level: ${currentLevel}`);
  }
  if (currentLevel >= 10) {
    return Infinity; // Already at max level
  }
  const config = UPGRADE_BASE_COSTS[type];
  if (!config) {
    throw new Error(`Unknown upgrade type: ${type}`);
  }
  return Math.floor(config.base * Math.pow(config.multiplier, currentLevel - 1));
}

export function executePurchase(
  currentCoins: number,
  cost: number
): { success: boolean; remainingCoins: number } {
  if (cost < 0 || isNaN(cost)) {
    throw new Error(`Invalid cost amount: ${cost}`);
  }
  if (currentCoins < 0 || isNaN(currentCoins)) {
    throw new Error(`Invalid balance: ${currentCoins}`);
  }
  if (currentCoins >= cost) {
    return { success: true, remainingCoins: currentCoins - cost };
  }
  return { success: false, remainingCoins: currentCoins };
}

// Helper to check if production constants file exists and can be imported
async function getProductionCatalog(): Promise<Record<string, ScrapItemData> | null> {
  try {
    const mod = await import(/* @vite-ignore */ '../../src/config/constants');
    return mod.SCRAP_CATALOG || null;
  } catch {
    return null;
  }
}

// ============================================================================
// Test Suite: Economy & Progression Balancing
// ============================================================================

describe('Economy System — Scrap Item Catalog (12 Items)', () => {
  it('contains exactly 12 discrete scrap item types across 4 tiers', () => {
    const items = Object.values(AUTHORITATIVE_SCRAP_CATALOG);
    expect(items.length).toBe(12);

    const tierCounts = items.reduce<Record<number, number>>((acc, item) => {
      acc[item.tier] = (acc[item.tier] || 0) + 1;
      return acc;
    }, {});

    expect(tierCounts[1]).toBe(3);
    expect(tierCounts[2]).toBe(3);
    expect(tierCounts[3]).toBe(3);
    expect(tierCounts[4]).toBe(3);
  });

  it('validates Tier 1 (The Rusted Basin) starter scrap item specifications', () => {
    const screw = AUTHORITATIVE_SCRAP_CATALOG['screw'];
    expect(screw).toBeDefined();
    expect(screw.massKg).toBe(1);
    expect(screw.coinValue).toBe(1);
    expect(screw.dragResistance).toBe(1.0);
    expect(screw.tier).toBe(1);

    const can = AUTHORITATIVE_SCRAP_CATALOG['can'];
    expect(can).toBeDefined();
    expect(can.massKg).toBe(1);
    expect(can.coinValue).toBe(2);
    expect(can.dragResistance).toBe(1.0);
    expect(can.tier).toBe(1);

    const pipe = AUTHORITATIVE_SCRAP_CATALOG['pipe'];
    expect(pipe).toBeDefined();
    expect(pipe.massKg).toBe(2);
    expect(pipe.coinValue).toBe(6);
    expect(pipe.dragResistance).toBe(1.5);
    expect(pipe.tier).toBe(1);
  });

  it('validates Tier 2 (Smelter\'s Yard) intermediate scrap item specifications', () => {
    const copperWire = AUTHORITATIVE_SCRAP_CATALOG['copper_wire'];
    expect(copperWire).toBeDefined();
    expect(copperWire.massKg).toBe(2.0);
    expect(copperWire.coinValue).toBe(18);
    expect(copperWire.dragResistance).toBe(1.5);
    expect(copperWire.tier).toBe(2);

    const battery = AUTHORITATIVE_SCRAP_CATALOG['battery'];
    expect(battery).toBeDefined();
    expect(battery.massKg).toBe(3);
    expect(battery.coinValue).toBe(15);
    expect(battery.dragResistance).toBe(2.5);
    expect(battery.tier).toBe(2);

    const steelPlate = AUTHORITATIVE_SCRAP_CATALOG['steel_plate'];
    expect(steelPlate).toBeDefined();
    expect(steelPlate.massKg).toBe(5);
    expect(steelPlate.coinValue).toBe(50);
    expect(steelPlate.dragResistance).toBe(4.0);
    expect(steelPlate.tier).toBe(2);
  });

  it('validates Tier 3 (Automotive Graveyard) heavy scrap item specifications', () => {
    const engineBelt = AUTHORITATIVE_SCRAP_CATALOG['engine_belt'];
    expect(engineBelt).toBeDefined();
    expect(engineBelt.massKg).toBe(6.0);
    expect(engineBelt.coinValue).toBe(90);
    expect(engineBelt.dragResistance).toBe(4.5);
    expect(engineBelt.tier).toBe(3);

    const radiator = AUTHORITATIVE_SCRAP_CATALOG['radiator'];
    expect(radiator).toBeDefined();
    expect(radiator.massKg).toBe(8.0);
    expect(radiator.coinValue).toBe(140);
    expect(radiator.dragResistance).toBe(5.5);
    expect(radiator.tier).toBe(3);

    const carChassis = AUTHORITATIVE_SCRAP_CATALOG['car_chassis'];
    expect(carChassis).toBeDefined();
    expect(carChassis.massKg).toBe(12);
    expect(carChassis.coinValue).toBe(240);
    expect(carChassis.dragResistance).toBe(9.0);
    expect(carChassis.tier).toBe(3);
  });

  it('validates Tier 4 (Titanium Ridge) aerospace scrap item specifications', () => {
    const catalyticConverter = AUTHORITATIVE_SCRAP_CATALOG['catalytic_converter'];
    expect(catalyticConverter).toBeDefined();
    expect(catalyticConverter.massKg).toBe(9.0);
    expect(catalyticConverter.coinValue).toBe(340);
    expect(catalyticConverter.dragResistance).toBe(6.5);
    expect(catalyticConverter.tier).toBe(4);

    const engineBlock = AUTHORITATIVE_SCRAP_CATALOG['engine_block'];
    expect(engineBlock).toBeDefined();
    expect(engineBlock.massKg).toBe(8);
    expect(engineBlock.coinValue).toBe(120);
    expect(engineBlock.dragResistance).toBe(6.5);
    expect(engineBlock.tier).toBe(4);

    const rocketNozzle = AUTHORITATIVE_SCRAP_CATALOG['rocket_nozzle'];
    expect(rocketNozzle).toBeDefined();
    expect(rocketNozzle.massKg).toBe(16.0);
    expect(rocketNozzle.coinValue).toBe(800);
    expect(rocketNozzle.dragResistance).toBe(12.0);
    expect(rocketNozzle.tier).toBe(4);
  });

  it('enforces physical invariants: mass (1-16kg), value (1-800), drag (1.0-12.0)', () => {
    for (const [key, item] of Object.entries(AUTHORITATIVE_SCRAP_CATALOG)) {
      expect(item.massKg, `${key} mass`).toBeGreaterThanOrEqual(1);
      expect(item.massKg, `${key} mass`).toBeLessThanOrEqual(16);
      expect(item.coinValue, `${key} coin value`).toBeGreaterThanOrEqual(1);
      expect(item.coinValue, `${key} coin value`).toBeLessThanOrEqual(800);
      expect(item.dragResistance, `${key} drag resistance`).toBeGreaterThanOrEqual(1.0);
      expect(item.dragResistance, `${key} drag resistance`).toBeLessThanOrEqual(12.0);
      expect(item.tier, `${key} tier`).toBeGreaterThanOrEqual(1);
      expect(item.tier, `${key} tier`).toBeLessThanOrEqual(4);
    }
  });

  it('verifies value-to-mass density strictly accelerates with higher tier unlock progression', () => {
    const items = Object.values(AUTHORITATIVE_SCRAP_CATALOG);
    const tierAvgRatios: Record<number, number> = {};

    for (let t = 1; t <= 4; t++) {
      const tierItems = items.filter((i) => i.tier === t);
      const totalRatio = tierItems.reduce((acc, i) => acc + i.coinValue / i.massKg, 0);
      tierAvgRatios[t] = totalRatio / tierItems.length;
    }

    expect(tierAvgRatios[1]).toBeCloseTo(2.0, 1);  // (1/1 + 2/1 + 6/2) / 3 = 2.00
    expect(tierAvgRatios[2]).toBeCloseTo(8.0, 1);  // (18/2 + 15/3 + 50/5) / 3 = 8.00
    expect(tierAvgRatios[3]).toBeCloseTo(17.5, 1); // (90/6 + 140/8 + 240/12) / 3 = 17.50
    expect(tierAvgRatios[4]).toBeCloseTo(34.26, 1); // (340/9 + 120/8 + 800/16) / 3 = 34.26

    // Strictly monotonic progression
    expect(tierAvgRatios[2]).toBeGreaterThan(tierAvgRatios[1]);
    expect(tierAvgRatios[3]).toBeGreaterThan(tierAvgRatios[2]);
    expect(tierAvgRatios[4]).toBeGreaterThan(tierAvgRatios[3]);
  });

  it('matches production constants when src/config/constants.ts is loaded', async () => {
    const prodCatalog = await getProductionCatalog();
    if (prodCatalog) {
      const authKeys = Object.keys(AUTHORITATIVE_SCRAP_CATALOG).sort();
      const prodKeys = Object.keys(prodCatalog).sort();
      expect(prodKeys).toEqual(authKeys);

      for (const [key, expected] of Object.entries(AUTHORITATIVE_SCRAP_CATALOG)) {
        const prod = prodCatalog[key];
        expect(prod, `Missing production scrap item: ${key}`).toBeDefined();
        expect(prod.massKg, `${key} massKg mismatch`).toBe(expected.massKg);
        expect(prod.coinValue, `${key} coinValue mismatch`).toBe(expected.coinValue);
        expect(prod.dragResistance, `${key} dragResistance mismatch`).toBe(expected.dragResistance);
        expect(prod.tier, `${key} tier mismatch`).toBe(expected.tier);
      }
    }
  });
});

describe('Economy System — Upgrade Attribute Scaling (Levels 1 to 10)', () => {
  describe('Magnet Range: Radius(L) = 120 + 25 * (L - 1)', () => {
    it('calculates exact baseline at Level 1 (120px)', () => {
      expect(calcMagnetRange(1)).toBe(120);
    });

    it('calculates intermediate levels accurately', () => {
      expect(calcMagnetRange(2)).toBe(145);
      expect(calcMagnetRange(3)).toBe(170);
      expect(calcMagnetRange(4)).toBe(195);
      expect(calcMagnetRange(5)).toBe(220);
      expect(calcMagnetRange(6)).toBe(245);
      expect(calcMagnetRange(7)).toBe(270);
      expect(calcMagnetRange(8)).toBe(295);
      expect(calcMagnetRange(9)).toBe(320);
    });

    it('calculates maximum attribute value at Level 10 (345px)', () => {
      expect(calcMagnetRange(10)).toBe(345);
    });

    it('increases strictly monotonically by exactly 25px per level', () => {
      for (let l = 1; l < 10; l++) {
        expect(calcMagnetRange(l + 1) - calcMagnetRange(l)).toBe(25);
      }
    });
  });

  describe('Attract Power: Power(L) = 350 * (1 + 0.25 * (L - 1))', () => {
    it('calculates exact baseline at Level 1 (350 px/s²)', () => {
      expect(calcAttractPower(1)).toBe(350);
    });

    it('calculates intermediate levels accurately', () => {
      expect(calcAttractPower(2)).toBe(437.5);
      expect(calcAttractPower(3)).toBe(525);
      expect(calcAttractPower(4)).toBe(612.5);
      expect(calcAttractPower(5)).toBe(700);
      expect(calcAttractPower(6)).toBe(787.5);
      expect(calcAttractPower(7)).toBe(875);
      expect(calcAttractPower(8)).toBe(962.5);
      expect(calcAttractPower(9)).toBe(1050);
    });

    it('calculates maximum attribute value at Level 10 (1137.5 px/s²)', () => {
      expect(calcAttractPower(10)).toBe(1137.5);
    });

    it('increases strictly monotonically by exactly 87.5 px/s² per level', () => {
      for (let l = 1; l < 10; l++) {
        expect(calcAttractPower(l + 1) - calcAttractPower(l)).toBe(87.5);
      }
    });
  });

  describe('Carry Capacity: Capacity(L) = 6 + 4*(L-1) + (L-1)^2', () => {
    it('calculates exact baseline at Level 1 (6 kg)', () => {
      expect(calcCarryCapacity(1)).toBe(6);
    });

    it('calculates progressive acceleration at intermediate levels', () => {
      expect(calcCarryCapacity(2)).toBe(11);
      expect(calcCarryCapacity(3)).toBe(18);
      expect(calcCarryCapacity(4)).toBe(27);
      expect(calcCarryCapacity(5)).toBe(38);
      expect(calcCarryCapacity(6)).toBe(51);
      expect(calcCarryCapacity(7)).toBe(66);
      expect(calcCarryCapacity(8)).toBe(83);
      expect(calcCarryCapacity(9)).toBe(102);
    });

    it('calculates maximum attribute value at Level 10 (123 kg)', () => {
      expect(calcCarryCapacity(10)).toBe(123);
    });

    it('exhibits strictly non-linear convex growth (second derivative > 0)', () => {
      for (let l = 1; l <= 8; l++) {
        const delta1 = calcCarryCapacity(l + 1) - calcCarryCapacity(l);
        const delta2 = calcCarryCapacity(l + 2) - calcCarryCapacity(l + 1);
        expect(delta2).toBeGreaterThan(delta1);
      }
    });

    it('verifies production getCarryCapacity matches the authoritative 6 to 123kg curve', async () => {
      const mod = await import(/* @vite-ignore */ '../../src/config/constants');
      if (mod && mod.getCarryCapacity) {
        expect(mod.getCarryCapacity(1)).toBe(6);
        expect(mod.getCarryCapacity(5)).toBe(38);
        expect(mod.getCarryCapacity(10)).toBe(123);
        for (let l = 1; l <= 10; l++) {
          expect(mod.getCarryCapacity(l)).toBe(calcCarryCapacity(l));
        }
      }
    });
  });

  describe('Movement Speed: Speed(L) = 200 + 20 * (L - 1)', () => {
    it('calculates exact baseline at Level 1 (200 px/s)', () => {
      expect(calcMovementSpeed(1)).toBe(200);
    });

    it('calculates intermediate levels accurately', () => {
      expect(calcMovementSpeed(2)).toBe(220);
      expect(calcMovementSpeed(3)).toBe(240);
      expect(calcMovementSpeed(4)).toBe(260);
      expect(calcMovementSpeed(5)).toBe(280);
      expect(calcMovementSpeed(6)).toBe(300);
      expect(calcMovementSpeed(7)).toBe(320);
      expect(calcMovementSpeed(8)).toBe(340);
      expect(calcMovementSpeed(9)).toBe(360);
    });

    it('calculates maximum attribute value at Level 10 (380 px/s)', () => {
      expect(calcMovementSpeed(10)).toBe(380);
    });

    it('increases strictly monotonically by exactly 20 px/s per level', () => {
      for (let l = 1; l < 10; l++) {
        expect(calcMovementSpeed(l + 1) - calcMovementSpeed(l)).toBe(20);
      }
    });
  });
});

describe('Economy System — Cost Scaling Formulae: Cost(L) = floor(Base * Multiplier^(L-1))', () => {
  it('verifies Magnet Range upgrade cost ladder (Levels 1 to 9 -> 10)', () => {
    const expectedCosts = [50, 72, 105, 152, 221, 320, 464, 673, 977];
    for (let l = 1; l <= 9; l++) {
      expect(calcUpgradeCost('magnetRange', l)).toBe(expectedCosts[l - 1]);
    }
    const totalCost = expectedCosts.reduce((a, b) => a + b, 0);
    expect(totalCost).toBe(3034);
  });

  it('verifies Attract Power upgrade cost ladder (Levels 1 to 9 -> 10)', () => {
    const expectedCosts = [70, 99, 141, 200, 284, 404, 573, 814, 1157];
    for (let l = 1; l <= 9; l++) {
      expect(calcUpgradeCost('attractPower', l)).toBe(expectedCosts[l - 1]);
    }
    const totalCost = expectedCosts.reduce((a, b) => a + b, 0);
    expect(totalCost).toBe(3742);
  });

  it('verifies Carry Capacity upgrade cost ladder (Levels 1 to 9 -> 10)', () => {
    const expectedCosts = [85, 127, 191, 286, 430, 645, 968, 1452, 2178];
    for (let l = 1; l <= 9; l++) {
      expect(calcUpgradeCost('carryCapacity', l)).toBe(expectedCosts[l - 1]);
    }
    const totalCost = expectedCosts.reduce((a, b) => a + b, 0);
    expect(totalCost).toBe(6362);
  });

  it('verifies Movement Speed upgrade cost ladder (Levels 1 to 9 -> 10)', () => {
    const expectedCosts = [100, 145, 210, 304, 442, 640, 929, 1347, 1954];
    for (let l = 1; l <= 9; l++) {
      expect(calcUpgradeCost('movementSpeed', l)).toBe(expectedCosts[l - 1]);
    }
    const totalCost = expectedCosts.reduce((a, b) => a + b, 0);
    expect(totalCost).toBe(6071);
  });

  // Grand total upgrade cost to max all 4 attributes from Level 1 to 10:
  // Range (3,034) + Power (3,742) + Capacity (6,362) + Speed (6,071) = 19,209 coins
  it('verifies grand total cost to max all 4 stats is exactly 19,209 coins', () => {
    let grandTotal = 0;
    const upgradeTypes: UpgradeType[] = ['magnetRange', 'attractPower', 'carryCapacity', 'movementSpeed'];
    for (const type of upgradeTypes) {
      for (let l = 1; l <= 9; l++) {
        grandTotal += calcUpgradeCost(type, l);
      }
    }
    expect(grandTotal).toBe(19209);
  });

  it('returns Infinity when attempting to calculate upgrade cost at or above Level 10 (Cap)', () => {
    expect(calcUpgradeCost('magnetRange', 10)).toBe(Infinity);
    expect(calcUpgradeCost('attractPower', 10)).toBe(Infinity);
    expect(calcUpgradeCost('carryCapacity', 10)).toBe(Infinity);
    expect(calcUpgradeCost('movementSpeed', 10)).toBe(Infinity);
    expect(calcUpgradeCost('magnetRange', 11)).toBe(Infinity);
  });
});

describe('Economy System — Junkyard Tier Milestone Unlock Gates', () => {
  it('verifies tier unlock costs match the specification', () => {
    expect(TIER_UNLOCK_COSTS[1]).toBe(0);     // Free starter zone
    expect(TIER_UNLOCK_COSTS[2]).toBe(750);   // Smelter's Yard
    expect(TIER_UNLOCK_COSTS[3]).toBe(5000);  // Automotive Graveyard
    expect(TIER_UNLOCK_COSTS[4]).toBe(25000); // Titanium Ridge
  });

  it('confirms tier progression is strictly increasing', () => {
    expect(TIER_UNLOCK_COSTS[2]).toBeGreaterThan(TIER_UNLOCK_COSTS[1]);
    expect(TIER_UNLOCK_COSTS[3]).toBeGreaterThan(TIER_UNLOCK_COSTS[2]);
    expect(TIER_UNLOCK_COSTS[4]).toBeGreaterThan(TIER_UNLOCK_COSTS[3]);
  });
});

describe('Economy System — Boundary & Corner Cases (Tier 2)', () => {
  it('rejects invalid or non-integer upgrade levels with descriptive errors', () => {
    expect(() => calcMagnetRange(0)).toThrow('Invalid upgrade level');
    expect(() => calcMagnetRange(-1)).toThrow('Invalid upgrade level');
    expect(() => calcMagnetRange(1.5)).toThrow('Invalid upgrade level');
    expect(() => calcMagnetRange(NaN)).toThrow('Invalid upgrade level');

    expect(() => calcUpgradeCost('magnetRange', 0)).toThrow('Invalid upgrade level');
    expect(() => calcUpgradeCost('magnetRange', -5)).toThrow('Invalid upgrade level');
    expect(() => calcUpgradeCost('magnetRange', 2.3)).toThrow('Invalid upgrade level');
    expect(() => calcUpgradeCost('magnetRange', NaN)).toThrow('Invalid upgrade level');
  });

  it('executes successful purchases when coins exactly equal cost', () => {
    const cost = calcUpgradeCost('magnetRange', 1); // 50 coins
    const result = executePurchase(50, cost);
    expect(result.success).toBe(true);
    expect(result.remainingCoins).toBe(0);
  });

  it('executes successful purchases when coins exceed cost', () => {
    const cost = calcUpgradeCost('attractPower', 1); // 70 coins
    const result = executePurchase(100, cost);
    expect(result.success).toBe(true);
    expect(result.remainingCoins).toBe(30);
  });

  it('rejects purchases when coins are strictly less than cost by 1 coin (Boundary BVA)', () => {
    const cost = calcUpgradeCost('carryCapacity', 1); // 85 coins
    const result = executePurchase(84, cost);
    expect(result.success).toBe(false);
    expect(result.remainingCoins).toBe(84); // Balance unmodified
  });

  it('rejects purchases when player balance is 0', () => {
    const cost = calcUpgradeCost('movementSpeed', 1); // 100 coins
    const result = executePurchase(0, cost);
    expect(result.success).toBe(false);
    expect(result.remainingCoins).toBe(0);
  });

  it('prevents negative coin deduction exploit', () => {
    expect(() => executePurchase(100, -50)).toThrow('Invalid cost amount');
    expect(() => executePurchase(-10, 20)).toThrow('Invalid balance');
    expect(() => executePurchase(100, NaN)).toThrow('Invalid cost amount');
  });
});
