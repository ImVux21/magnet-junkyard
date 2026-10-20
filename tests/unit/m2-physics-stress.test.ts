import { describe, it, expect } from 'vitest';
import {
  SCRAP_CATALOG,
  ScrapItemData,
  getMagnetRange,
  getAttractPower,
  getCarryCapacity,
  getMovementSpeed,
} from '../../src/config/constants';

// ============================================================================
// Milestone 2 Adversarial Stress Test Suite: Physics & Mathematical Models
// ============================================================================

/**
 * Pure mathematical model of ScrapItem attraction logic mirroring ScrapItem.ts
 */
export function simulateAttractionStep(
  scrapPos: { x: number; y: number },
  scrapData: ScrapItemData,
  magnetPos: { x: number; y: number },
  playerVel: { x: number; y: number },
  range: number,
  power: number,
  availableCapacityKg: number
): {
  collected: boolean;
  attracting: boolean;
  vx: number;
  vy: number;
  speed: number;
  dist: number;
  reason?: string;
} {
  // 1. Capacity overflow check
  if (scrapData.massKg > availableCapacityKg) {
    return { collected: false, attracting: false, vx: 0, vy: 0, speed: 0, dist: 0, reason: 'capacity_exceeded' };
  }

  const dx = magnetPos.x - scrapPos.x;
  const dy = magnetPos.y - scrapPos.y;
  const distSq = dx * dx + dy * dy;

  if (distSq > range * range) {
    const dist = Math.sqrt(distSq);
    return { collected: false, attracting: false, vx: 0, vy: 0, speed: 0, dist, reason: 'out_of_range' };
  }

  const dist = Math.sqrt(distSq);

  // 2. Capture threshold at d <= 26px
  if (dist <= 26) {
    return { collected: true, attracting: false, vx: 0, vy: 0, speed: 0, dist, reason: 'captured' };
  }

  // 3. Proximity factor t in [0, 1]
  const t = Math.max(0, Math.min(1, 1.0 - dist / range));

  // 4. Non-linear pull speed with mass & drag resistance scaling
  const massRatio = Math.max(
    0.35,
    Math.min(2.5, Math.sqrt(power / (scrapData.massKg * 50 * scrapData.dragResistance)))
  );
  const speed = (180 + 480 * (t * t)) * massRatio;

  // 5. Apply velocity with orbital damping and player velocity coupling
  const dirX = dx / dist;
  const dirY = dy / dist;

  const vx = dirX * speed + playerVel.x * 0.35;
  const vy = dirY * speed + playerVel.y * 0.35;

  return { collected: false, attracting: true, vx, vy, speed, dist };
}

describe('M2 Empirical Challenger: Magnetic Attraction Formula Stress Tests', () => {
  it('Domain Stability: produces finite, stable velocities across entire domain d in [26.01, R] for all 12 scrap catalog items', () => {
    const power = getAttractPower(1); // 350 px/s²
    const range = getMagnetRange(1); // 120 px
    const magnetPos = { x: 500, y: 500 };
    const playerVel = { x: 0, y: 0 };

    for (const [key, item] of Object.entries(SCRAP_CATALOG)) {
      // Step through domain d from 26.1 to range in increments of 0.5px
      for (let d = 26.1; d <= range; d += 0.5) {
        const scrapPos = { x: magnetPos.x + d, y: magnetPos.y };
        const res = simulateAttractionStep(scrapPos, item, magnetPos, playerVel, range, power, 100);

        expect(res.attracting).toBe(true);
        expect(res.collected).toBe(false);
        expect(Number.isFinite(res.speed)).toBe(true);
        expect(Number.isFinite(res.vx)).toBe(true);
        expect(Number.isFinite(res.vy)).toBe(true);
        expect(isNaN(res.speed)).toBe(false);
        expect(isNaN(res.vx)).toBe(false);
        expect(isNaN(res.vy)).toBe(false);

        // Speed must be bounded between 63 px/s and 1650 px/s
        expect(res.speed).toBeGreaterThanOrEqual(63.0);
        expect(res.speed).toBeLessThanOrEqual(1650.0);
      }
    }
  });

  it('Boundary Condition d = 0: safely captured without division by zero', () => {
    const item = SCRAP_CATALOG.screw;
    const magnetPos = { x: 500, y: 500 };
    const scrapPos = { x: 500, y: 500 }; // d = 0
    const res = simulateAttractionStep(scrapPos, item, magnetPos, { x: 0, y: 0 }, 120, 350, 10);

    expect(res.collected).toBe(true);
    expect(res.attracting).toBe(false);
    expect(res.vx).toBe(0);
    expect(res.vy).toBe(0);
  });

  it('Boundary Condition d = 26px: capture threshold is inclusive', () => {
    const item = SCRAP_CATALOG.screw;
    const magnetPos = { x: 500, y: 500 };
    const scrapPos = { x: 526, y: 500 }; // d = 26.0 exactly
    const res = simulateAttractionStep(scrapPos, item, magnetPos, { x: 0, y: 0 }, 120, 350, 10);

    expect(res.collected).toBe(true);
    expect(res.attracting).toBe(false);
    expect(res.dist).toBeCloseTo(26.0, 5);
  });

  it('Boundary Condition d = R: edge of attraction field attracts at base speed', () => {
    const item = SCRAP_CATALOG.screw;
    const range = 120;
    const power = 350;
    const magnetPos = { x: 500, y: 500 };
    const scrapPos = { x: 500 + range, y: 500 }; // d = R exactly
    const res = simulateAttractionStep(scrapPos, item, magnetPos, { x: 0, y: 0 }, range, power, 10);

    expect(res.attracting).toBe(true);
    expect(res.collected).toBe(false);
    // At d = R, t = 0, so speed = 180 * massRatio
    const expectedMassRatio = Math.max(0.35, Math.min(2.5, Math.sqrt(power / (item.massKg * 50 * item.dragResistance))));
    expect(res.speed).toBeCloseTo(180 * expectedMassRatio, 4);
  });

  it('Boundary Condition d > R: scrap outside magnetic radius is completely ignored', () => {
    const item = SCRAP_CATALOG.screw;
    const range = 120;
    const magnetPos = { x: 500, y: 500 };
    const scrapPos = { x: 500 + range + 0.001, y: 500 }; // d > R
    const res = simulateAttractionStep(scrapPos, item, magnetPos, { x: 0, y: 0 }, range, 350, 10);

    expect(res.attracting).toBe(false);
    expect(res.collected).toBe(false);
    expect(res.reason).toBe('out_of_range');
  });

  it('Parameter Stress Test: 10,000 combinations of (M, P, drag) yield zero division-by-zero or NaN', () => {
    // Mass: 0.5kg to 16.0kg
    // Power: 350 to 1137 px/s² (and up to 3411 with overcharge)
    // Drag: 1.0 to 12.0
    const masses = [0.5, 0.8, 1.2, 2.0, 2.5, 3.5, 5.0, 6.0, 8.0, 10.0, 13.0, 16.0];
    const powers = [350, 437, 525, 612, 700, 787, 875, 962, 1050, 1137, 3411];
    const drags = [1.0, 1.2, 1.5, 1.8, 2.5, 3.5, 4.5, 5.5, 6.5, 7.0, 9.0, 12.0];
    const distances = [27, 50, 75, 100, 120, 200, 300];

    let testCount = 0;
    for (const M of masses) {
      for (const P of powers) {
        for (const drag of drags) {
          for (const d of distances) {
            const fakeItem: ScrapItemData = {
              typeId: 'test',
              name: 'Test Scrap',
              massKg: M,
              coinValue: 10,
              dragResistance: drag,
              tier: 1,
              color: 0,
              shape: 'screw',
              width: 16,
              height: 16,
              spawnWeights: [1, 0, 0, 0],
            };

            const res = simulateAttractionStep(
              { x: 500 + d, y: 500 },
              fakeItem,
              { x: 500, y: 500 },
              { x: 100, y: -50 },
              345, // max range
              P,
              100
            );

            expect(Number.isFinite(res.speed)).toBe(true);
            expect(Number.isFinite(res.vx)).toBe(true);
            expect(Number.isFinite(res.vy)).toBe(true);
            expect(isNaN(res.speed)).toBe(false);
            testCount++;
          }
        }
      }
    }
    expect(testCount).toBe(masses.length * powers.length * drags.length * distances.length);
  });
});

describe('M2 Empirical Challenger: Cargo Capacity Cutoff & Precision Vulnerability', () => {
  it('Cutoff Enforcement: scrap item is 100% ignored when massKg > availableCapacityKg', () => {
    const item = SCRAP_CATALOG.steel_plate; // 5.0kg
    const magnetPos = { x: 500, y: 500 };
    const scrapPos = { x: 530, y: 500 }; // within range

    // Capacity remaining: 4.9kg (less than 5.0kg)
    const res = simulateAttractionStep(scrapPos, item, magnetPos, { x: 0, y: 0 }, 120, 350, 4.9);
    expect(res.attracting).toBe(false);
    expect(res.collected).toBe(false);
    expect(res.reason).toBe('capacity_exceeded');
  });

  it('VULNERABILITY VERIFICATION: Floating-point precision underflow in capacity calculation', () => {
    // Demonstration of the discovered floating point bug in PlayerRover vs ScrapItem:
    // Capacity = 10, Current Mass = 8.8 (11 screws).
    // Mathematically, remaining capacity is 1.2kg.
    const maxCapacity = 10;
    const currentMass = 8.8;
    const unroundedAvailable = Math.max(0, maxCapacity - currentMass);

    // In IEEE-754: 10 - 8.8 = 1.1999999999999993
    expect(unroundedAvailable).toBeLessThan(1.2);
    expect(unroundedAvailable).toBe(1.1999999999999993);

    // Crushed soda can has massKg = 1.2 in floating point stress scenario
    const canItem = { ...SCRAP_CATALOG.can, massKg: 1.2 };
    expect(canItem.massKg).toBe(1.2);

    // Because unroundedAvailable is 1.1999999999999993, strict inequality fails!
    const isRejectedByScrapItem = canItem.massKg > unroundedAvailable;
    expect(isRejectedByScrapItem).toBe(true); // BUG CONFIRMED: 1.2 > 1.1999999999999993

    // Simulation step confirms the can is falsely rejected!
    const res = simulateAttractionStep(
      { x: 530, y: 500 },
      canItem,
      { x: 500, y: 500 },
      { x: 0, y: 0 },
      120,
      350,
      unroundedAvailable
    );
    expect(res.attracting).toBe(false);
    expect(res.reason).toBe('capacity_exceeded');

    // Case 2: Level 2 Capacity (17kg), current mass = 16.2kg.
    // Mathematical remaining capacity is 0.8kg.
    const cap17 = 17;
    const mass16_2 = 16.2;
    const unrounded17 = Math.max(0, cap17 - mass16_2);
    // In IEEE-754, 17 - 16.2 produces 0.8000000000000007, demonstrating floating-point inaccuracy
    expect(unrounded17).not.toBe(0.8);
    expect(Math.abs(unrounded17 - 0.8)).toBeLessThan(1e-14);
  });
});

describe('M2 Empirical Challenger: Zero-Orbiting & Dynamical Trajectory Simulation', () => {
  it('Trajectory Simulation: scrap approaching from 360-degree radial angles monotonically converges without orbiting', () => {
    const angles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4];
    const initialDistance = 100; // px
    const range = 120;
    const power = 350;
    const dt = 1 / 60; // 60 FPS simulation step (16.6ms)

    for (const angle of angles) {
      let scrapPos = {
        x: 500 + Math.cos(angle) * initialDistance,
        y: 500 + Math.sin(angle) * initialDistance,
      };
      const magnetPos = { x: 500, y: 500 };
      const playerVel = { x: 0, y: 0 }; // stationary player

      let frames = 0;
      let collected = false;
      let prevDist = initialDistance;

      while (frames < 120 && !collected) { // max 2 seconds
        const res = simulateAttractionStep(scrapPos, SCRAP_CATALOG.screw, magnetPos, playerVel, range, power, 10);
        if (res.collected) {
          collected = true;
          break;
        }

        // Distance must be strictly decreasing every frame
        expect(res.dist).toBeLessThanOrEqual(prevDist);
        prevDist = res.dist;

        // Advance position using Euler integration
        scrapPos.x += res.vx * dt;
        scrapPos.y += res.vy * dt;
        frames++;
      }

      expect(collected).toBe(true);
      // At speed >= 180 px/s, distance of 100 - 26 = 74px takes ~0.25 - 0.35s (~15-25 frames)
      expect(frames).toBeLessThan(35);
    }
  });

  it('Player Velocity Coupling: scrap keeps pace with forward moving rover', () => {
    // Rover moving right at 200 px/s
    const playerVel = { x: 200, y: 0 };
    let magnetPos = { x: 500, y: 500 };
    let scrapPos = { x: 450, y: 500 }; // 50px behind the magnet emitter
    const dt = 1 / 60;

    let frames = 0;
    let collected = false;

    while (frames < 180 && !collected) {
      // Rover advances forward
      magnetPos.x += playerVel.x * dt;

      const res = simulateAttractionStep(scrapPos, SCRAP_CATALOG.screw, magnetPos, playerVel, 120, 350, 10);
      if (res.collected) {
        collected = true;
        break;
      }

      // Advance scrap
      scrapPos.x += res.vx * dt;
      scrapPos.y += res.vy * dt;
      frames++;
    }

    expect(collected).toBe(true);
    expect(frames).toBeLessThan(60); // Collected within 1 second
  });
});
