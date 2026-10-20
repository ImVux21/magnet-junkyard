import { describe, it, expect } from 'vitest';
import {
  SCRAP_CATALOG,
  ScrapItemData,
  GAME_CONSTANTS,
  getCarryCapacity,
  getUpgradeCost,
  UPGRADE_MAX_LEVEL,
  PlayerUpgrades,
} from '../../src/config/constants';

// ============================================================================
// Milestone 2 Iteration 2 Adversarial Stress Test Suite
// Authored by: challenger_m2_iter2_2
// Focus:
//   1. TestBridge Emitter vs Center Geometry & Attraction Physics
//   2. UIScene Joystick Tween Lifecycle & Race Condition Simulation
//   3. Production Constants & Unit Test Suite Parity (False-Positive Elimination)
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Emitter vs Center Geometry Oracle
// ----------------------------------------------------------------------------

export function getMagnetPosition(
  roverX: number,
  roverY: number,
  rotation: number,
  forwardOffset = GAME_CONSTANTS.MAGNET_FORWARD_OFFSET
): { x: number; y: number } {
  return {
    x: roverX + Math.cos(rotation) * forwardOffset,
    y: roverY + Math.sin(rotation) * forwardOffset,
  };
}

export function distSq(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

export function dist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(distSq(p1, p2));
}

describe('Adversarial Focus 1: TestBridge Emitter vs Center Geometry', () => {
  const offset = GAME_CONSTANTS.MAGNET_FORWARD_OFFSET; // 22px
  const roverCenter = { x: 1000, y: 1000 };
  const range = 120; // Level 1 baseline magnet range

  it('verifies GAME_CONSTANTS.MAGNET_FORWARD_OFFSET is exactly 22px', () => {
    expect(offset).toBe(22);
  });

  describe('Cardinal Angles: Heading Vector Offset & Distance Discrepancies', () => {
    it('Angle 0 (East / +X): Magnet emitter is at (+22, 0) relative to center', () => {
      const emitter = getMagnetPosition(roverCenter.x, roverCenter.y, 0);
      expect(emitter.x).toBeCloseTo(1022, 5);
      expect(emitter.y).toBeCloseTo(1000, 5);

      // Ahead of rover: Scrap at (1130, 1000)
      const scrapAhead = { x: 1130, y: 1000 };
      const dCenterAhead = dist(scrapAhead, roverCenter); // 130px
      const dEmitterAhead = dist(scrapAhead, emitter);    // 108px

      expect(dCenterAhead).toBe(130);
      expect(dEmitterAhead).toBe(108);
      // Emitter is 22px closer than center
      expect(dEmitterAhead - dCenterAhead).toBe(-22);

      // Physics check: Since range = 120px, dEmitter (108) <= 120 is attracted, but dCenter (130) > 120 would be missed!
      expect(dEmitterAhead <= range).toBe(true);
      expect(dCenterAhead <= range).toBe(false);

      // Behind rover: Scrap at (890, 1000)
      const scrapBehind = { x: 890, y: 1000 };
      const dCenterBehind = dist(scrapBehind, roverCenter); // 110px
      const dEmitterBehind = dist(scrapBehind, emitter);    // 132px

      expect(dCenterBehind).toBe(110);
      expect(dEmitterBehind).toBe(132);
      // Emitter is 22px farther than center
      expect(dEmitterBehind - dCenterBehind).toBe(+22);

      // Physics check: dEmitter (132) > 120 is NOT attracted, but center query (110 <= 120) would falsely claim it is!
      expect(dEmitterBehind <= range).toBe(false);
      expect(dCenterBehind <= range).toBe(true);
    });

    it('Angle π/2 (South / +Y): Magnet emitter is at (0, +22) relative to center', () => {
      const emitter = getMagnetPosition(roverCenter.x, roverCenter.y, Math.PI / 2);
      expect(emitter.x).toBeCloseTo(1000, 5);
      expect(emitter.y).toBeCloseTo(1022, 5);

      // Ahead of rover: Scrap at (1000, 1130)
      const scrapAhead = { x: 1000, y: 1130 };
      expect(dist(scrapAhead, roverCenter)).toBe(130);
      expect(dist(scrapAhead, emitter)).toBe(108);

      // Behind rover: Scrap at (1000, 890)
      const scrapBehind = { x: 1000, y: 890 };
      expect(dist(scrapBehind, roverCenter)).toBe(110);
      expect(dist(scrapBehind, emitter)).toBe(132);
    });

    it('Angle π (West / -X): Magnet emitter is at (-22, 0) relative to center', () => {
      const emitter = getMagnetPosition(roverCenter.x, roverCenter.y, Math.PI);
      expect(emitter.x).toBeCloseTo(978, 5);
      expect(emitter.y).toBeCloseTo(1000, 5);

      // Ahead of rover: Scrap at (870, 1000)
      const scrapAhead = { x: 870, y: 1000 };
      expect(dist(scrapAhead, roverCenter)).toBe(130);
      expect(dist(scrapAhead, emitter)).toBe(108);

      // Behind rover: Scrap at (1110, 1000)
      const scrapBehind = { x: 1110, y: 1000 };
      expect(dist(scrapBehind, roverCenter)).toBe(110);
      expect(dist(scrapBehind, emitter)).toBe(132);
    });

    it('Angle 3π/2 (North / -Y): Magnet emitter is at (0, -22) relative to center', () => {
      const emitter = getMagnetPosition(roverCenter.x, roverCenter.y, (3 * Math.PI) / 2);
      expect(emitter.x).toBeCloseTo(1000, 5);
      expect(emitter.y).toBeCloseTo(978, 5);

      // Ahead of rover: Scrap at (1000, 870)
      const scrapAhead = { x: 1000, y: 870 };
      expect(dist(scrapAhead, roverCenter)).toBe(130);
      expect(dist(scrapAhead, emitter)).toBe(108);

      // Behind rover: Scrap at (1000, 1110)
      const scrapBehind = { x: 1000, y: 1110 };
      expect(dist(scrapBehind, roverCenter)).toBe(110);
      expect(dist(scrapBehind, emitter)).toBe(132);
    });
  });

  it('Continuous 360-Degree Heading Sweep: Emitter distance matches ScrapItem attraction field exactly', () => {
    // Generate 36 angles across [0, 2π)
    for (let i = 0; i < 36; i++) {
      const theta = (i * 2 * Math.PI) / 36;
      const emitter = getMagnetPosition(roverCenter.x, roverCenter.y, theta);

      // Place a test scrap exactly 100px forward along heading
      const scrapForward = {
        x: roverCenter.x + Math.cos(theta) * 100,
        y: roverCenter.y + Math.sin(theta) * 100,
      };

      const dCenter = dist(scrapForward, roverCenter); // exactly 100px
      const dEmitter = dist(scrapForward, emitter);     // exactly 100 - 22 = 78px

      expect(dCenter).toBeCloseTo(100, 4);
      expect(dEmitter).toBeCloseTo(78, 4);

      // TestBridge query distance evaluates from emitter
      const dx = scrapForward.x - emitter.x;
      const dy = scrapForward.y - emitter.y;
      const bridgeQueryDist = Math.sqrt(dx * dx + dy * dy);

      expect(bridgeQueryDist).toBeCloseTo(dEmitter, 5);
    }
  });
});

// ----------------------------------------------------------------------------
// 2. UIScene Tween Race Condition Simulator
// ----------------------------------------------------------------------------

interface MockTween {
  target: MockContainer;
  duration: number;
  elapsed: number;
  onComplete?: () => void;
  killed: boolean;
}

class MockContainer {
  public alpha = 1;
  public visible = true;
  public x = 0;
  public y = 0;
  public setAlpha(val: number) { this.alpha = val; }
  public setVisible(val: boolean) { this.visible = val; }
  public setPosition(x: number, y: number) { this.x = x; this.y = y; }
}

class MockTweenManager {
  public tweens: MockTween[] = [];

  public add(config: { targets: MockContainer; alpha: number; duration: number; onComplete?: () => void }): MockTween {
    const tween: MockTween = {
      target: config.targets,
      duration: config.duration,
      elapsed: 0,
      onComplete: config.onComplete,
      killed: false,
    };
    this.tweens.push(tween);
    return tween;
  }

  public killTweensOf(target: MockContainer): void {
    for (const t of this.tweens) {
      if (t.target === target) {
        t.killed = true;
        // In Phaser 3, killTweensOf stops the tween without calling onComplete
      }
    }
    this.tweens = this.tweens.filter((t) => !t.killed);
  }

  public step(dtMs: number): void {
    for (const t of [...this.tweens]) {
      if (t.killed) continue;
      t.elapsed += dtMs;
      const progress = Math.min(1.0, t.elapsed / t.duration);
      t.target.alpha = 1.0 - progress; // fading from 1 to 0

      if (t.elapsed >= t.duration) {
        t.killed = true;
        t.onComplete?.();
      }
    }
    this.tweens = this.tweens.filter((t) => !t.killed);
  }
}

/**
 * High-fidelity replica of UIScene's joystick input logic
 */
class JoystickHarness {
  public container = new MockContainer();
  public tweens = new MockTweenManager();
  public activeJoystickPointerId: number | null = null;
  public enableFix = true; // Flag to compare unpatched vs patched behavior

  public onPointerDown(pointer: { id: number; x: number; y: number }): void {
    if (pointer.y < 90) return;
    if (this.activeJoystickPointerId !== null) return;

    if (this.enableFix) {
      // Worker remediation: Kill in-flight fade tweens on pointerdown
      this.tweens.killTweensOf(this.container);
    }

    this.activeJoystickPointerId = pointer.id;
    this.container.setPosition(pointer.x, pointer.y);
    this.container.setAlpha(1);
    this.container.setVisible(true);
  }

  public onPointerUp(pointer: { id: number }): void {
    if (this.activeJoystickPointerId === pointer.id) {
      this.activeJoystickPointerId = null;

      if (this.enableFix) {
        this.tweens.killTweensOf(this.container);
      }

      this.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 120,
        onComplete: () => {
          this.container.setVisible(false);
        },
      });
    }
  }
}

describe('Adversarial Focus 2: UIScene Joystick Tween Race Condition Stress Test', () => {
  it('REPRODUCTION: Proves that WITHOUT killTweensOf, rapid re-tap within 120ms causes joystick to disappear mid-touch', () => {
    const unpatched = new JoystickHarness();
    unpatched.enableFix = false; // Original buggy implementation

    // Step 1: User taps down
    unpatched.onPointerDown({ id: 1, x: 200, y: 400 });
    expect(unpatched.container.visible).toBe(true);
    expect(unpatched.container.alpha).toBe(1);

    // Step 2: User releases pointer (fade tween starts: 120ms)
    unpatched.onPointerUp({ id: 1 });
    expect(unpatched.activeJoystickPointerId).toBeNull();
    expect(unpatched.tweens.tweens.length).toBe(1);

    // Step 3: Advance 30ms (< 120ms)
    unpatched.tweens.step(30);
    expect(unpatched.container.alpha).toBeCloseTo(0.75, 2);

    // Step 4: Rapid re-tap at t=30ms
    unpatched.onPointerDown({ id: 1, x: 250, y: 450 });
    expect(unpatched.activeJoystickPointerId).toBe(1);
    expect(unpatched.container.visible).toBe(true);
    expect(unpatched.container.alpha).toBe(1);

    // CRITICAL FLAW: The old tween is STILL in the tween manager!
    expect(unpatched.tweens.tweens.length).toBe(1);

    // Step 5: Advance 90ms (reaches t=120ms from original pointerup)
    unpatched.tweens.step(90);

    // BUG CONFIRMED: onComplete fired from the orphaned tween, setting visible to false!
    expect(unpatched.container.visible).toBe(false);
    expect(unpatched.activeJoystickPointerId).toBe(1); // User is STILL touching, but joystick is INVISIBLE!
  });

  it('VERIFICATION: Proves that WITH killTweensOf, rapid re-tap cancels fade tween and joystick remains visible', () => {
    const patched = new JoystickHarness();
    patched.enableFix = true; // Production remediation

    // Step 1: User taps down
    patched.onPointerDown({ id: 1, x: 200, y: 400 });
    expect(patched.container.visible).toBe(true);
    expect(patched.container.alpha).toBe(1);

    // Step 2: User releases pointer
    patched.onPointerUp({ id: 1 });
    expect(patched.tweens.tweens.length).toBe(1);

    // Step 3: Advance 30ms
    patched.tweens.step(30);

    // Step 4: Rapid re-tap at t=30ms
    patched.onPointerDown({ id: 1, x: 250, y: 450 });
    // Tween MUST have been killed immediately on pointerdown!
    expect(patched.tweens.tweens.length).toBe(0);
    expect(patched.container.visible).toBe(true);
    expect(patched.container.alpha).toBe(1);

    // Step 5: Advance 200ms
    patched.tweens.step(200);

    // FIXED: No orphaned tween fired. Joystick remains 100% visible and active!
    expect(patched.container.visible).toBe(true);
    expect(patched.container.alpha).toBe(1);
    expect(patched.activeJoystickPointerId).toBe(1);
  });

  it('Stress Storm: 100 rapid jittered tap cycles maintain 100% state consistency and zero orphaned tweens', () => {
    const harness = new JoystickHarness();
    harness.enableFix = true;

    for (let tap = 0; tap < 100; tap++) {
      const pointerId = (tap % 3) + 1;
      const touchDuration = 10 + (tap % 25); // 10..34ms
      const releaseInterval = 5 + (tap % 30); // 5..34ms (always < 120ms fade duration)

      harness.onPointerDown({ id: pointerId, x: 200, y: 300 });
      expect(harness.container.visible).toBe(true);
      expect(harness.container.alpha).toBe(1);

      harness.tweens.step(touchDuration);

      harness.onPointerUp({ id: pointerId });
      expect(harness.tweens.tweens.length).toBe(1);

      harness.tweens.step(releaseInterval);
    }

    // At the end of 100 taps, step remaining time to let the final fade finish cleanly
    harness.tweens.step(200);
    expect(harness.tweens.tweens.length).toBe(0);
    expect(harness.container.visible).toBe(false);
    expect(harness.activeJoystickPointerId).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// 3. Direct Production Parity & False-Positive Elimination
// ----------------------------------------------------------------------------

describe('Adversarial Focus 3: Production Constants & Parity Audit (Zero-Bypass)', () => {
  it('Production SCRAP_CATALOG is unconditionally defined and non-null (No silent pass)', () => {
    expect(SCRAP_CATALOG).toBeDefined();
    expect(SCRAP_CATALOG).not.toBeNull();
    expect(typeof SCRAP_CATALOG).toBe('object');
  });

  it('Catalog Symmetry: Contains exactly 12 items, exactly 3 per tier', () => {
    const items = Object.values(SCRAP_CATALOG);
    expect(items.length).toBe(12);

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const item of items) {
      counts[item.tier] = (counts[item.tier] || 0) + 1;
    }

    expect(counts[1]).toBe(3);
    expect(counts[2]).toBe(3);
    expect(counts[3]).toBe(3);
    expect(counts[4]).toBe(3);
  });

  it('Authoritative 12-Item Parity: All 12 items strictly match specified mass, value, drag, and tier', () => {
    const expectedCatalog: Record<string, { mass: number; value: number; drag: number; tier: number }> = {
      // Tier 1
      screw: { mass: 1, value: 1, drag: 1.0, tier: 1 },
      can: { mass: 1, value: 2, drag: 1.0, tier: 1 },
      pipe: { mass: 2, value: 6, drag: 1.5, tier: 1 },
      // Tier 2
      copper_wire: { mass: 2.0, value: 18, drag: 1.5, tier: 2 },
      battery: { mass: 3, value: 15, drag: 2.5, tier: 2 },
      steel_plate: { mass: 5, value: 50, drag: 4.0, tier: 2 },
      // Tier 3
      engine_belt: { mass: 6.0, value: 90, drag: 4.5, tier: 3 },
      radiator: { mass: 8.0, value: 140, drag: 5.5, tier: 3 },
      car_chassis: { mass: 12, value: 240, drag: 9.0, tier: 3 },
      // Tier 4
      catalytic_converter: { mass: 9.0, value: 340, drag: 6.5, tier: 4 },
      engine_block: { mass: 8, value: 120, drag: 6.5, tier: 4 },
      rocket_nozzle: { mass: 16.0, value: 800, drag: 12.0, tier: 4 },
    };

    // Bidirectional keys check
    expect(Object.keys(SCRAP_CATALOG).sort()).toEqual(Object.keys(expectedCatalog).sort());

    for (const [id, exp] of Object.entries(expectedCatalog)) {
      const item = SCRAP_CATALOG[id];
      expect(item, `Item ${id} must exist`).toBeDefined();
      expect(item.massKg, `${id} mass mismatch`).toBe(exp.mass);
      expect(item.coinValue, `${id} value mismatch`).toBe(exp.value);
      expect(item.dragResistance, `${id} drag mismatch`).toBe(exp.drag);
      expect(item.tier, `${id} tier mismatch`).toBe(exp.tier);
    }
  });

  it('Monotonic Value Density: Tier average (coins / kg) accelerates strictly across tiers', () => {
    const items = Object.values(SCRAP_CATALOG);
    const densities: number[] = [];

    for (let t = 1; t <= 4; t++) {
      const tierItems = items.filter((i) => i.tier === t);
      const totalRatio = tierItems.reduce((sum, i) => sum + i.coinValue / i.massKg, 0);
      densities[t] = totalRatio / tierItems.length;
    }

    expect(densities[1]).toBeCloseTo(2.0, 1);   // (1/1 + 2/1 + 6/2) / 3 = 2.00
    expect(densities[2]).toBeCloseTo(8.0, 1);   // (18/2 + 15/3 + 50/5) / 3 = 8.00
    expect(densities[3]).toBeCloseTo(17.5, 1);  // (90/6 + 140/8 + 240/12) / 3 = 17.50
    expect(densities[4]).toBeCloseTo(34.26, 1); // (340/9 + 120/8 + 800/16) / 3 = 34.26

    expect(densities[2]).toBeGreaterThan(densities[1]);
    expect(densities[3]).toBeGreaterThan(densities[2]);
    expect(densities[4]).toBeGreaterThan(densities[3]);
  });

  it('Production getCarryCapacity: Evaluates exactly to 6kg at L1 and 123kg at L10', () => {
    const expected = [6, 11, 18, 27, 38, 51, 66, 83, 102, 123];
    for (let level = 1; level <= 10; level++) {
      expect(getCarryCapacity(level)).toBe(expected[level - 1]);
    }
    // Clamping at boundary
    expect(getCarryCapacity(0)).toBe(6);
    expect(getCarryCapacity(15)).toBe(123);
  });

  it('Production Upgrade Costs: Ladders sum to exactly 19,209 coins', () => {
    const upgradeTypes: (keyof PlayerUpgrades)[] = ['magnetRange', 'attractPower', 'carryCapacity', 'movementSpeed'];
    let total = 0;
    for (const stat of upgradeTypes) {
      for (let l = 1; l <= 9; l++) {
        total += getUpgradeCost(stat, l);
      }
      expect(getUpgradeCost(stat, 10)).toBe(Infinity);
    }
    expect(total).toBe(19209);
  });
});
