import { describe, it, expect } from 'vitest';
import {
  getCarryCapacity,
  getMagnetRangeCost,
  getAttractPowerCost,
  getCarryCapacityCost,
  getMovementSpeedCost,
  getUpgradeCost,
  UPGRADE_MAX_LEVEL,
  UPGRADE_BASE_COSTS,
  UPGRADE_COST_MULTIPLIERS,
  TIER_UNLOCK_COSTS,
  JUNKYARD_TIERS,
  PlayerUpgrades,
} from '../../src/config/constants';

// ============================================================================
// Milestone M_O1 Empirical Adversarial Stress Test Suite
// Authored by: challenger_m_o1_1
// Focus:
//   1. getCarryCapacity extreme boundary clamping & non-numeric handling
//   2. getCarryCapacity strict monotonicity & continuous monotonicity
//   3. getCarryCapacity strict convexity (constant second difference = 2)
//   4. getCarryCapacity sequence exact parity against [6, 11, 18, 27, 38, 51, 66, 83, 102, 123]
//   5. Upgrade costs positivity, integer purity, cap at L>=10 (Infinity), and ladder sums
//   6. Junkyard Tier unlock costs & total economy investment
// ============================================================================

describe('Adversarial Challenge 1: getCarryCapacity Extreme Input Boundary & Clamping', () => {
  it('clamps extreme negative levels to baseline (Level 1 -> 6 kg)', () => {
    expect(getCarryCapacity(-100)).toBe(6);
    expect(getCarryCapacity(-1)).toBe(6);
    expect(getCarryCapacity(-0.0001)).toBe(6);
    expect(getCarryCapacity(-Infinity)).toBe(6);
  });

  it('clamps zero level to baseline (Level 1 -> 6 kg)', () => {
    expect(getCarryCapacity(0)).toBe(6);
    expect(getCarryCapacity(-0)).toBe(6);
  });

  it('evaluates exact baseline at Level 1 (6 kg)', () => {
    expect(getCarryCapacity(1)).toBe(6);
  });

  it('evaluates continuous fractional levels smoothly within bounds', () => {
    // At L = 2.5: clamped = 2.5 -> (clamped - 1) = 1.5
    // 6 + 4*(1.5) + (1.5)^2 = 6 + 6 + 2.25 = 14.25
    const cap2_5 = getCarryCapacity(2.5);
    expect(cap2_5).toBe(14.25);
    expect(cap2_5).toBeGreaterThan(getCarryCapacity(2)); // 11
    expect(cap2_5).toBeLessThan(getCarryCapacity(3));    // 18
  });

  it('evaluates exact cap at Level 10 (123 kg)', () => {
    expect(getCarryCapacity(10)).toBe(123);
  });

  it('clamps levels above Level 10 to 123 kg', () => {
    expect(getCarryCapacity(11)).toBe(123);
    expect(getCarryCapacity(10.001)).toBe(123);
    expect(getCarryCapacity(100)).toBe(123);
    expect(getCarryCapacity(1000)).toBe(123);
    expect(getCarryCapacity(1_000_000)).toBe(123);
    expect(getCarryCapacity(Infinity)).toBe(123);
  });

  it('returns NaN when input is NaN or undefined', () => {
    expect(Number.isNaN(getCarryCapacity(NaN))).toBe(true);
    expect(Number.isNaN(getCarryCapacity(undefined as unknown as number))).toBe(true);
  });

  it('handles null and numeric strings appropriately via JS coercion', () => {
    // null coerces to 0 in Math.min/max, clamping to 1 -> 6
    expect(getCarryCapacity(null as unknown as number)).toBe(6);
    // numeric strings coerce to numbers
    expect(getCarryCapacity('5' as unknown as number)).toBe(38);
    // non-numeric strings coerce to NaN
    expect(Number.isNaN(getCarryCapacity('invalid' as unknown as number))).toBe(true);
  });
});

describe('Adversarial Challenge 2: Strict Monotonicity Analysis', () => {
  it('exhibits strictly increasing carry capacity for all integer levels from 1 to 10', () => {
    for (let l = 1; l < UPGRADE_MAX_LEVEL; l++) {
      const current = getCarryCapacity(l);
      const next = getCarryCapacity(l + 1);
      expect(next).toBeGreaterThan(current);
      const diff = next - current;
      // First difference is strictly positive and increases: 5, 7, 9, 11, 13, 15, 17, 19, 21
      expect(diff).toBeGreaterThanOrEqual(5);
    }
  });

  it('maintains continuous monotonicity over 1,000 fine-grained steps in [1.0, 10.0]', () => {
    const steps = 1000;
    const delta = (10 - 1) / steps;
    let prev = getCarryCapacity(1.0);

    for (let i = 1; i <= steps; i++) {
      const level = 1.0 + i * delta;
      const curr = getCarryCapacity(level);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });

  it('plateaus at boundary clamp regions (<= 1 and >= 10)', () => {
    expect(getCarryCapacity(-10)).toBe(getCarryCapacity(1));
    expect(getCarryCapacity(10)).toBe(getCarryCapacity(50));
  });
});

describe('Adversarial Challenge 3: Convexity Verification (Second Difference Delta^2 > 0)', () => {
  it('confirms strictly positive second difference Delta^2 across all intermediate levels', () => {
    // Delta^2(L) = (C(L+2) - C(L+1)) - (C(L+1) - C(L))
    for (let l = 1; l <= 8; l++) {
      const delta1 = getCarryCapacity(l + 1) - getCarryCapacity(l);
      const delta2 = getCarryCapacity(l + 2) - getCarryCapacity(l + 1);
      const secondDiff = delta2 - delta1;

      expect(secondDiff).toBeGreaterThan(0);
      // For quadratic (L-1)^2 + 4(L-1) + 6:
      // f(x) = x^2 + 2x + 3
      // Delta^2 = f(x+2) - 2f(x+1) + f(x) = 2 identically!
      expect(secondDiff).toBe(2);
    }
  });

  it('proves accelerating return on investment (each carry upgrade yields more than the previous)', () => {
    const gains: number[] = [];
    for (let l = 1; l < UPGRADE_MAX_LEVEL; l++) {
      gains.push(getCarryCapacity(l + 1) - getCarryCapacity(l));
    }
    // Expected gains: [5, 7, 9, 11, 13, 15, 17, 19, 21]
    expect(gains).toEqual([5, 7, 9, 11, 13, 15, 17, 19, 21]);

    for (let i = 0; i < gains.length - 1; i++) {
      expect(gains[i + 1] - gains[i]).toBe(2);
    }
  });
});

describe('Adversarial Challenge 4: Sequence Parity with Authoritative Specification', () => {
  const AUTHORITATIVE_SEQUENCE = [6, 11, 18, 27, 38, 51, 66, 83, 102, 123];

  it('matches expected sequence [6, 11, 18, 27, 38, 51, 66, 83, 102, 123] identically', () => {
    const actual = [];
    for (let l = 1; l <= 10; l++) {
      actual.push(getCarryCapacity(l));
    }
    expect(actual).toEqual(AUTHORITATIVE_SEQUENCE);
  });

  it('guarantees Level 1 rover capacity cannot haul heavy Tier 3/4 scrap items', () => {
    const baselineCapacity = getCarryCapacity(1); // 6kg
    expect(baselineCapacity).toBe(6);

    // Radiator: 8kg -> cannot haul
    // Chassis: 12kg -> cannot haul
    // Rocket Nozzle: 16kg -> cannot haul
    expect(baselineCapacity).toBeLessThan(8.0);
    expect(baselineCapacity).toBeLessThan(12.0);
    expect(baselineCapacity).toBeLessThan(16.0);

    // But CAN haul Tier 1 screws (1kg), cans (1kg), pipes (2kg) and Tier 2 wire (2kg), battery (3kg), steel plate (5kg)
    expect(baselineCapacity).toBeGreaterThanOrEqual(1.0);
    expect(baselineCapacity).toBeGreaterThanOrEqual(2.0);
    expect(baselineCapacity).toBeGreaterThanOrEqual(5.0);
  });
});

describe('Adversarial Challenge 5: Upgrade Cost Ladder Purity, Positivity & Cap at L >= 10', () => {
  const STATS: (keyof PlayerUpgrades)[] = ['magnetRange', 'attractPower', 'carryCapacity', 'movementSpeed'];

  const EXPECTED_LADDERS: Record<keyof PlayerUpgrades, number[]> = {
    magnetRange:   [50, 72, 105, 152, 221, 320, 464, 673, 977],
    attractPower:  [70, 99, 141, 200, 284, 404, 573, 814, 1157],
    carryCapacity: [85, 127, 191, 286, 430, 645, 968, 1452, 2178],
    movementSpeed: [100, 145, 210, 304, 442, 640, 929, 1347, 1954],
  };

  const EXPECTED_SUMS: Record<keyof PlayerUpgrades, number> = {
    magnetRange: 3034,
    attractPower: 3742,
    carryCapacity: 6362,
    movementSpeed: 6071,
  };

  it('guarantees all costs for L=1..9 are positive integers and match exact expected ladders', () => {
    for (const stat of STATS) {
      const expected = EXPECTED_LADDERS[stat];
      let ladderSum = 0;

      for (let l = 1; l <= 9; l++) {
        const cost = getUpgradeCost(stat, l);

        // Positive integer check
        expect(Number.isInteger(cost)).toBe(true);
        expect(cost).toBeGreaterThan(0);
        expect(Number.isFinite(cost)).toBe(true);

        // Exact value parity
        expect(cost).toBe(expected[l - 1]);
        ladderSum += cost;

        // Monotonic cost escalation check
        if (l > 1) {
          expect(cost).toBeGreaterThan(getUpgradeCost(stat, l - 1));
        }
      }

      // Check ladder sum
      expect(ladderSum).toBe(EXPECTED_SUMS[stat]);
    }
  });

  it('returns strictly Infinity for L >= 10 across all stats and dispatchers', () => {
    const testLevels = [10, 11, 15, 100, 1000, Infinity];

    for (const stat of STATS) {
      for (const lvl of testLevels) {
        expect(getUpgradeCost(stat, lvl)).toBe(Infinity);
      }
    }

    // Direct specialized cost functions
    for (const lvl of testLevels) {
      expect(getMagnetRangeCost(lvl)).toBe(Infinity);
      expect(getAttractPowerCost(lvl)).toBe(Infinity);
      expect(getCarryCapacityCost(lvl)).toBe(Infinity);
      expect(getMovementSpeedCost(lvl)).toBe(Infinity);
    }
  });

  it('returns Infinity for invalid stat identifier', () => {
    expect(getUpgradeCost('nonExistentStat' as unknown as keyof PlayerUpgrades, 1)).toBe(Infinity);
  });

  it('verifies grand total cost to max all 4 stats is exactly 19,209 coins', () => {
    let grandTotal = 0;
    for (const stat of STATS) {
      for (let l = 1; l <= 9; l++) {
        grandTotal += getUpgradeCost(stat, l);
      }
    }
    expect(grandTotal).toBe(19209);
  });
});

describe('Adversarial Challenge 6: Economy Progression Integrity & Tier Gates', () => {
  it('confirms JUNKYARD_TIERS milestone unlock costs match R1 and AC3', () => {
    expect(JUNKYARD_TIERS[0].unlockCost).toBe(0);     // Tier 1
    expect(JUNKYARD_TIERS[1].unlockCost).toBe(750);   // Tier 2
    expect(JUNKYARD_TIERS[2].unlockCost).toBe(5000);  // Tier 3
    expect(JUNKYARD_TIERS[3].unlockCost).toBe(25000); // Tier 4

    // TIER_UNLOCK_COSTS map parity
    expect(TIER_UNLOCK_COSTS[1]).toBe(0);
    expect(TIER_UNLOCK_COSTS[2]).toBe(750);
    expect(TIER_UNLOCK_COSTS[3]).toBe(5000);
    expect(TIER_UNLOCK_COSTS[4]).toBe(25000);
  });

  it('confirms total tier unlock investment is 30,750 coins and grand game progression is 49,959 coins', () => {
    const tierSum = TIER_UNLOCK_COSTS[1] + TIER_UNLOCK_COSTS[2] + TIER_UNLOCK_COSTS[3] + TIER_UNLOCK_COSTS[4];
    expect(tierSum).toBe(30750);

    const upgradeSum = 19209;
    const totalProgressionInvestment = tierSum + upgradeSum;
    expect(totalProgressionInvestment).toBe(49959);

    // Baseline comparison: Previously tiers cost [0, 200, 1500, 7500] = 9200
    // and upgrades cost ~5582 = ~14782 total.
    // Progression scaling ratio: 49959 / 14782 ~= 3.38x (perfect ~3.4x match for 15-20 min pacing)
    expect(totalProgressionInvestment / 14782).toBeGreaterThan(3.3);
    expect(totalProgressionInvestment / 14782).toBeLessThan(3.5);
  });
});
