import { describe, it, expect } from 'vitest';
import {
  SCRAP_CATALOG,
  JUNKYARD_TIERS,
  TIER_UNLOCK_COSTS,
  UPGRADE_BASE_COSTS,
  UPGRADE_COST_MULTIPLIERS,
  UPGRADE_MAX_LEVEL,
  getMagnetRange,
  getAttractPower,
  getCarryCapacity,
  getMovementSpeed,
  getMagnetRangeCost,
  getAttractPowerCost,
  getCarryCapacityCost,
  getMovementSpeedCost,
  getUpgradeCost,
  PlayerUpgrades,
  ScrapItemData,
} from '../../src/config/constants';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Empirical Challenger M_O1: Economy, Progression Curves & Starter Capacity Stress
// ============================================================================

describe('Challenger M_O1: 19,209 Upgrade Cost Oracle Verification', () => {
  const upgradeTracks: (keyof PlayerUpgrades)[] = [
    'magnetRange',
    'attractPower',
    'carryCapacity',
    'movementSpeed',
  ];

  it('evaluates exact discrete cost ladders per track from Level 1 to 9 -> 10', () => {
    // Track 1: Magnet Range (Base 50, 1.45 multiplier)
    const expectedRange = [50, 72, 105, 152, 221, 320, 464, 673, 977];
    const actualRange = Array.from({ length: 9 }, (_, i) => getMagnetRangeCost(i + 1));
    expect(actualRange).toEqual(expectedRange);
    expect(actualRange.reduce((a, b) => a + b, 0)).toBe(3034);

    // Track 2: Attract Power (Base 70, 1.42 multiplier)
    const expectedPower = [70, 99, 141, 200, 284, 404, 573, 814, 1157];
    const actualPower = Array.from({ length: 9 }, (_, i) => getAttractPowerCost(i + 1));
    expect(actualPower).toEqual(expectedPower);
    expect(actualPower.reduce((a, b) => a + b, 0)).toBe(3742);

    // Track 3: Carry Capacity (Base 85, 1.50 multiplier)
    const expectedCapacity = [85, 127, 191, 286, 430, 645, 968, 1452, 2178];
    const actualCapacity = Array.from({ length: 9 }, (_, i) => getCarryCapacityCost(i + 1));
    expect(actualCapacity).toEqual(expectedCapacity);
    expect(actualCapacity.reduce((a, b) => a + b, 0)).toBe(6362);

    // Track 4: Movement Speed (Base 100, 1.45 multiplier)
    const expectedSpeed = [100, 145, 210, 304, 442, 640, 929, 1347, 1954];
    const actualSpeed = Array.from({ length: 9 }, (_, i) => getMovementSpeedCost(i + 1));
    expect(actualSpeed).toEqual(expectedSpeed);
    expect(actualSpeed.reduce((a, b) => a + b, 0)).toBe(6071);
  });

  it('oracle verifies that grand total upgrade cost across all 4 tracks evaluates strictly to 19,209 coins', () => {
    let grandTotal = 0;
    const trackSums: Record<string, number> = {};

    for (const track of upgradeTracks) {
      let trackSum = 0;
      for (let level = 1; level < UPGRADE_MAX_LEVEL; level++) {
        const cost = getUpgradeCost(track, level);
        expect(cost).toBeGreaterThan(0);
        expect(Number.isInteger(cost)).toBe(true);
        trackSum += cost;
      }
      trackSums[track] = trackSum;
      grandTotal += trackSum;
    }

    expect(trackSums.magnetRange).toBe(3034);
    expect(trackSums.attractPower).toBe(3742);
    expect(trackSums.carryCapacity).toBe(6362);
    expect(trackSums.movementSpeed).toBe(6071);

    // Strict assertion: 3034 + 3742 + 6362 + 6071 = 19,209
    expect(grandTotal).toBe(19209);
  });

  it('verifies that level >= 10 caps out and returns Infinity for all upgrade tracks', () => {
    for (const track of upgradeTracks) {
      expect(getUpgradeCost(track, 10)).toBe(Infinity);
      expect(getUpgradeCost(track, 11)).toBe(Infinity);
      expect(getUpgradeCost(track, 100)).toBe(Infinity);
    }
  });

  it('validates exported UPGRADE_BASE_COSTS and UPGRADE_COST_MULTIPLIERS constants', () => {
    expect(UPGRADE_BASE_COSTS).toEqual({
      magnetRange: 50,
      attractPower: 70,
      carryCapacity: 85,
      movementSpeed: 100,
    });
    expect(UPGRADE_COST_MULTIPLIERS).toEqual({
      magnetRange: 1.45,
      attractPower: 1.42,
      carryCapacity: 1.50,
      movementSpeed: 1.45,
    });
  });
});

describe('Challenger M_O1: Junkyard Tier Costs & Grand Total Currency Requirement', () => {
  it('verifies tier unlock costs evaluate strictly to 30,750 coins total', () => {
    expect(JUNKYARD_TIERS[0].unlockCost).toBe(0);
    expect(JUNKYARD_TIERS[1].unlockCost).toBe(750);
    expect(JUNKYARD_TIERS[2].unlockCost).toBe(5000);
    expect(JUNKYARD_TIERS[3].unlockCost).toBe(25000);

    expect(TIER_UNLOCK_COSTS[1]).toBe(0);
    expect(TIER_UNLOCK_COSTS[2]).toBe(750);
    expect(TIER_UNLOCK_COSTS[3]).toBe(5000);
    expect(TIER_UNLOCK_COSTS[4]).toBe(25000);

    const totalTierCost = JUNKYARD_TIERS.reduce((sum, tier) => sum + tier.unlockCost, 0);
    expect(totalTierCost).toBe(30750);
  });

  it('verifies grand total currency requirement evaluates to 49,959 coins (~3.43x legacy scaling)', () => {
    const totalUpgradesCost = 19209;
    const totalTierCost = 30750;
    const grandTotalCurrency = totalUpgradesCost + totalTierCost;

    // Strict evaluation: 19,209 + 30,750 = 49,959 coins
    expect(grandTotalCurrency).toBe(49959);

    // Legacy baseline:
    // Legacy upgrades = 909 + 1348 + 1972 + 1582 = 5,811
    // Legacy tier costs = 0 + 250 + 1500 + 7000 = 8,750
    // Legacy grand total = 5,811 + 8,750 = 14,561
    const legacyGrandTotal = 14561;
    const scalingFactor = grandTotalCurrency / legacyGrandTotal;
    expect(scalingFactor).toBeCloseTo(3.431, 3);
    expect(scalingFactor).toBeGreaterThanOrEqual(3.4);
    expect(scalingFactor).toBeLessThanOrEqual(3.5);
  });
});

describe('Challenger M_O1: Carry Capacity Formula & Boundary Stress', () => {
  it('strictly adheres to the quadratic curve C(L) = 6 + 4*(L-1) + (L-1)^2 across [1..10]', () => {
    const expectedCapacities = [6, 11, 18, 27, 38, 51, 66, 83, 102, 123];
    for (let l = 1; l <= 10; l++) {
      expect(getCarryCapacity(l)).toBe(expectedCapacities[l - 1]);
    }
  });

  it('verifies strict clamping below level 1 and above level 10', () => {
    expect(getCarryCapacity(0)).toBe(6);
    expect(getCarryCapacity(-1)).toBe(6);
    expect(getCarryCapacity(-999)).toBe(6);
    expect(getCarryCapacity(11)).toBe(123);
    expect(getCarryCapacity(50)).toBe(123);
    expect(getCarryCapacity(9999)).toBe(123);
  });

  it('verifies non-linear convex growth with constant second difference of +2', () => {
    for (let l = 1; l <= 8; l++) {
      const d1 = getCarryCapacity(l + 1) - getCarryCapacity(l);
      const d2 = getCarryCapacity(l + 2) - getCarryCapacity(l + 1);
      expect(d2 - d1).toBe(2); // Discrete second derivative of (L-1)^2 is 2
    }
  });
});

describe('Challenger M_O1: Starter Capacity Rejection of Heavy Scrap Items', () => {
  // Pure replica of PlayerRover.canCollect and ScrapItem.updateAttraction capacity gate
  function canCollectScrap(currentMassKg: number, maxCapacityKg: number, itemMassKg: number): boolean {
    return (currentMassKg + itemMassKg) <= (maxCapacityKg + 0.001);
  }

  function simulateAttractionGating(
    availableCapacityKg: number,
    itemMassKg: number
  ): { allowed: boolean; reason: 'capacity_exceeded' | 'allowed' } {
    if (itemMassKg > availableCapacityKg + 0.001) {
      return { allowed: false, reason: 'capacity_exceeded' };
    }
    return { allowed: true, reason: 'allowed' };
  }

  it('Level 1 starter rover (6kg capacity, empty cargo): rejects all heavy scrap (> 6kg)', () => {
    const starterCapacity = getCarryCapacity(1);
    expect(starterCapacity).toBe(6);

    // 1. Brass Radiator (8.0 kg)
    const radiator = SCRAP_CATALOG.radiator;
    expect(radiator.massKg).toBe(8.0);
    expect(canCollectScrap(0, starterCapacity, radiator.massKg)).toBe(false);
    expect(simulateAttractionGating(starterCapacity, radiator.massKg).allowed).toBe(false);

    // 2. Cracked V6 Engine Block (8.0 kg)
    const engineBlock = SCRAP_CATALOG.engine_block;
    expect(engineBlock.massKg).toBe(8.0);
    expect(canCollectScrap(0, starterCapacity, engineBlock.massKg)).toBe(false);
    expect(simulateAttractionGating(starterCapacity, engineBlock.massKg).allowed).toBe(false);

    // 3. Catalytic Converter (9.0 kg)
    const catalytic = SCRAP_CATALOG.catalytic_converter;
    expect(catalytic.massKg).toBe(9.0);
    expect(canCollectScrap(0, starterCapacity, catalytic.massKg)).toBe(false);
    expect(simulateAttractionGating(starterCapacity, catalytic.massKg).allowed).toBe(false);

    // 4. Vehicle Door Panel / Car Chassis (12.0 kg)
    const chassis = SCRAP_CATALOG.car_chassis;
    expect(chassis.massKg).toBe(12.0);
    expect(canCollectScrap(0, starterCapacity, chassis.massKg)).toBe(false);
    expect(simulateAttractionGating(starterCapacity, chassis.massKg).allowed).toBe(false);

    // 5. Rocket Thruster Bell / Rocket Nozzle (16.0 kg)
    const rocketNozzle = SCRAP_CATALOG.rocket_nozzle;
    expect(rocketNozzle.massKg).toBe(16.0);
    expect(canCollectScrap(0, starterCapacity, rocketNozzle.massKg)).toBe(false);
    expect(simulateAttractionGating(starterCapacity, rocketNozzle.massKg).allowed).toBe(false);
  });

  it('Level 1 starter rover: successfully accepts items <= 6kg when cargo is empty', () => {
    const starterCapacity = getCarryCapacity(1);

    // Tier 1 items
    expect(canCollectScrap(0, starterCapacity, SCRAP_CATALOG.screw.massKg)).toBe(true); // 1kg
    expect(canCollectScrap(0, starterCapacity, SCRAP_CATALOG.can.massKg)).toBe(true);   // 1kg
    expect(canCollectScrap(0, starterCapacity, SCRAP_CATALOG.pipe.massKg)).toBe(true);  // 2kg

    // Tier 2 items
    expect(canCollectScrap(0, starterCapacity, SCRAP_CATALOG.copper_wire.massKg)).toBe(true); // 2kg
    expect(canCollectScrap(0, starterCapacity, SCRAP_CATALOG.battery.massKg)).toBe(true);     // 3kg
    expect(canCollectScrap(0, starterCapacity, SCRAP_CATALOG.steel_plate.massKg)).toBe(true); // 5kg

    // Tier 3 borderline item (exactly 6kg)
    expect(canCollectScrap(0, starterCapacity, SCRAP_CATALOG.engine_belt.massKg)).toBe(true); // 6kg
  });

  it('Partially loaded rover (e.g. carrying 1kg screw): rejects 6kg engine_belt', () => {
    const starterCapacity = getCarryCapacity(1);
    const currentCargo = 1.0; // Carrying 1 screw
    const available = starterCapacity - currentCargo; // 5.0 kg

    // 6kg engine belt now exceeds available capacity (5kg)
    expect(canCollectScrap(currentCargo, starterCapacity, SCRAP_CATALOG.engine_belt.massKg)).toBe(false);
    expect(simulateAttractionGating(available, SCRAP_CATALOG.engine_belt.massKg).allowed).toBe(false);

    // 5kg steel plate exactly fits remaining capacity
    expect(canCollectScrap(currentCargo, starterCapacity, SCRAP_CATALOG.steel_plate.massKg)).toBe(true);
    expect(simulateAttractionGating(available, SCRAP_CATALOG.steel_plate.massKg).allowed).toBe(true);
  });

  it('evaluates minimum carry capacity level required to haul each heavy scrap item', () => {
    function getMinLevelForItem(item: ScrapItemData): number {
      for (let level = 1; level <= 10; level++) {
        if (canCollectScrap(0, getCarryCapacity(level), item.massKg)) {
          return level;
        }
      }
      return -1;
    }

    // 8kg items: require Level 2 (11kg capacity)
    expect(getMinLevelForItem(SCRAP_CATALOG.radiator)).toBe(2);
    expect(getMinLevelForItem(SCRAP_CATALOG.engine_block)).toBe(2);

    // 9kg item: requires Level 2 (11kg capacity)
    expect(getMinLevelForItem(SCRAP_CATALOG.catalytic_converter)).toBe(2);

    // 12kg item: requires Level 3 (18kg capacity)
    expect(getMinLevelForItem(SCRAP_CATALOG.car_chassis)).toBe(3);

    // 16kg item: requires Level 3 (18kg capacity)
    expect(getMinLevelForItem(SCRAP_CATALOG.rocket_nozzle)).toBe(3);
  });
});

describe('Challenger M_O1: Source File Consistency Audit', () => {
  it('verifies PlayerRover.ts default cargo maxCapacityKg is strictly 6', () => {
    const roverPath = path.resolve(__dirname, '../../src/entities/PlayerRover.ts');
    const content = fs.readFileSync(roverPath, 'utf-8');
    expect(content).toMatch(/maxCapacityKg:\s*6,/);
  });

  it('verifies UIScene.ts default initial cargo display is strictly 6.0 KG', () => {
    const uiPath = path.resolve(__dirname, '../../src/scenes/UIScene.ts');
    const content = fs.readFileSync(uiPath, 'utf-8');
    expect(content).toContain('CARGO: 0.0 / 6.0 KG');
    expect(content).toMatch(/this\.updateCargoBarFill\(0,\s*6,\s*false\)/);
  });

  it('verifies TestBridge.ts fallback default capacity is strictly 6', () => {
    const bridgePath = path.resolve(__dirname, '../../src/services/testing/TestBridge.ts');
    const content = fs.readFileSync(bridgePath, 'utf-8');
    expect(content).toMatch(/maxCapacity:\s*6,/);
    expect(content).toMatch(/maxCapacity:\s*rover\.cargo\.maxCapacityKg,/);
  });
});

describe('Challenger M_O1: Active Play Progression Pacing Simulation (≥15 minutes)', () => {
  it('simulates progressive earning curve to Tier 4 requiring ≥15 minutes (≥900s) of active play', () => {
    // Model economy progression simulation
    let coinsInWallet = 0;
    let elapsedSeconds = 0;
    let currentTier = 1;
    let upgrades: PlayerUpgrades = {
      magnetRange: 1,
      attractPower: 1,
      carryCapacity: 1,
      movementSpeed: 1,
    };

    // Realistic cycle time (seconds): travel + gather + return to recycler + compression
    function getCycleDuration(speed: number, range: number): number {
      const distance = 1600; // typical round-trip distance in junkyard
      const travelTime = distance / speed;
      const gatherTime = Math.max(4, 10 - (range - 120) / 40);
      const recycleTime = 1.0;
      return travelTime + gatherTime + recycleTime;
    }

    // Average value per kg in each tier
    const avgValuePerKg: Record<number, number> = {
      1: (1 / 1 + 2 / 1 + 6 / 2) / 3, // ~2.0 coins/kg
      2: (18 / 2 + 15 / 3 + 50 / 5) / 3, // ~8.0 coins/kg
      3: (90 / 6 + 140 / 8 + 240 / 12) / 3, // ~17.5 coins/kg
      4: (340 / 9 + 120 / 8 + 800 / 16) / 3, // ~34.26 coins/kg
    };

    let reachedTier4Time = -1;

    // Simulate economy loop for up to 60 minutes (3600s)
    while (elapsedSeconds < 3600) {
      const cap = getCarryCapacity(upgrades.carryCapacity);
      const spd = getMovementSpeed(upgrades.movementSpeed);
      const rng = getMagnetRange(upgrades.magnetRange);
      const cycleTime = getCycleDuration(spd, rng);

      // Value collected in this haul
      const haulValue = Math.floor(cap * avgValuePerKg[currentTier]);
      coinsInWallet += haulValue;
      elapsedSeconds += cycleTime;

      // Tier-gated upgrade cap (player buys balanced upgrades up to tier cap)
      const maxLvl = currentTier === 1 ? 2 : currentTier === 2 ? 4 : 6;
      const tracks: (keyof PlayerUpgrades)[] = ['carryCapacity', 'movementSpeed', 'magnetRange', 'attractPower'];
      let bought = false;
      for (const t of tracks) {
        if (upgrades[t] < maxLvl) {
          const c = getUpgradeCost(t, upgrades[t]);
          if (coinsInWallet >= c) {
            coinsInWallet -= c;
            upgrades[t]++;
            bought = true;
            break;
          }
        }
      }
      if (bought) continue;

      // Priority: Unlock next tier if affordable
      if (currentTier === 1 && coinsInWallet >= TIER_UNLOCK_COSTS[2]) {
        coinsInWallet -= TIER_UNLOCK_COSTS[2];
        currentTier = 2;
        continue;
      }
      if (currentTier === 2 && coinsInWallet >= TIER_UNLOCK_COSTS[3]) {
        coinsInWallet -= TIER_UNLOCK_COSTS[3];
        currentTier = 3;
        continue;
      }
      if (currentTier === 3 && coinsInWallet >= TIER_UNLOCK_COSTS[4]) {
        coinsInWallet -= TIER_UNLOCK_COSTS[4];
        currentTier = 4;
        reachedTier4Time = elapsedSeconds;
        break;
      }
    }

    // Verify player reaches Tier 4 with pacing strictly >= 15 minutes (900s)
    expect(reachedTier4Time).toBeGreaterThanOrEqual(900);
    // Upper bound sanity check: reached within 45 minutes without combo/fever boosts
    expect(reachedTier4Time).toBeLessThanOrEqual(2700);
  });
});


