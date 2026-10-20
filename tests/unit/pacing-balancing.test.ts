// ============================================================================
// Magnet Junkyard - Milestone 2 Session Pacing & Balancing Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HazardManager } from '../../src/entities/hazards/HazardManager';
import { ScrapCritter } from '../../src/entities/hazards/ScrapCritter';
import { getUpgradeCost, UPGRADE_MAX_LEVEL, JUNKYARD_TIERS } from '../../src/config/constants';

vi.mock('phaser', () => {
  class MockSprite {
    public scene: any;
    public x: number = 0;
    public y: number = 0;
    public active: boolean = false;
    public visible: boolean = false;
    public body: any;

    constructor(scene: any, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
      const bodyObj: any = {
        setSize: vi.fn(),
        setCircle: vi.fn(),
        setCollideWorldBounds: vi.fn(),
        setBounce: vi.fn(),
        setImmovable: vi.fn(),
        velocity: { x: 0, y: 0 },
        enable: true,
      };
      bodyObj.setVelocity = vi.fn((vx: number, vy: number) => {
        bodyObj.velocity.x = vx;
        bodyObj.velocity.y = vy;
      });
      this.body = bodyObj;
    }

    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }
    setActive(val: boolean) {
      this.active = val;
      return this;
    }
    setVisible(val: boolean) {
      this.visible = val;
      return this;
    }
    setDepth() {
      return this;
    }
  }

  class MockVector2 {
    public x: number = 0;
    public y: number = 0;
    constructor(x: number = 0, y: number = 0) {
      this.x = x;
      this.y = y;
    }
    set(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }
  }

  return {
    default: {
      Physics: {
        Arcade: {
          Sprite: MockSprite,
        },
      },
      Math: {
        Between: (min: number, max: number) =>
          Math.floor(Math.random() * (max - min + 1)) + min,
        Clamp: (val: number, min: number, max: number) =>
          Math.max(min, Math.min(max, val)),
        Linear: (p0: number, p1: number, t: number) => p0 + t * (p1 - p0),
        Vector2: MockVector2,
      },
    },
  };
});

function createMockScene() {
  const events = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  const add = {
    existing: vi.fn(),
    graphics: vi.fn().mockReturnValue({
      clear: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    }),
    particles: vi.fn().mockReturnValue({
      setDepth: vi.fn().mockReturnThis(),
      explode: vi.fn(),
      destroy: vi.fn(),
    }),
  };

  const physicsWorld = {
    enable: (sprite: any) => {
      const bodyObj: any = {
        setSize: vi.fn(),
        setCircle: vi.fn(),
        setCollideWorldBounds: vi.fn(),
        setBounce: vi.fn(),
        setImmovable: vi.fn(),
        velocity: { x: 0, y: 0 },
        enable: true,
      };
      bodyObj.setVelocity = vi.fn((vx: number, vy: number) => {
        bodyObj.velocity.x = vx;
        bodyObj.velocity.y = vy;
      });
      sprite.body = bodyObj;
    },
  };

  const tweens = {
    add: vi.fn().mockReturnValue({ pause: vi.fn(), resume: vi.fn() }),
    killTweensOf: vi.fn(),
  };

  return {
    events,
    add,
    tweens,
    physics: { world: physicsWorld },
    time: { delayedCall: vi.fn(), now: 0 },
  } as any;
}

function createMockRover() {
  return {
    x: 1000,
    y: 1000,
    effectivePower: 500,
    cargo: { items: [], currentMassKg: 0 },
    ejectCargo: vi.fn().mockReturnValue([]),
  } as any;
}

function createMockScrapPool() {
  return {
    spawn: vi.fn(),
  } as any;
}

describe('Milestone 2: Session Pacing & Balancing Suite', () => {
  let scene: any;
  let hazardManager: HazardManager;

  beforeEach(() => {
    scene = createMockScene();
    hazardManager = new HazardManager(scene);
  });

  describe('Phase 1: Safe Window (Minutes 1-3 / 0-180s)', () => {
    it('delays first rival scavenger appearance during initial 180 seconds', () => {
      const rover = createMockRover();
      const scrapPool = createMockScrapPool();

      // Session elapsed: 30 seconds (30,000ms), current time: 30,000ms
      hazardManager.update(30000, 16, rover, scrapPool, [1, 2], 30000);

      // Next rival spawn time must be at least 30,000 + (180,000 - 30,000) = 180,000ms
      expect((hazardManager as any).nextRivalSpawnTime).toBeGreaterThanOrEqual(180000);
      expect(hazardManager.rivalScavenger.isActiveRival).toBe(false);
    });

    it('enforces safe distance (>= 300px) from recycler center (1400, 1100) when spawning critters in min 1-3', () => {
      hazardManager.updateCritterSpawns([1, 2], 60000); // 1 minute in

      const activeCritters = hazardManager.critters.filter((c) => c.active);
      expect(activeCritters.length).toBeGreaterThan(0);

      for (const critter of activeCritters) {
        const distFromRecycler = Math.hypot(critter.x - 1400, critter.y - 1100);
        expect(distFromRecycler).toBeGreaterThanOrEqual(300);
      }
    });
  });

  describe('Phase 2: Escalation Pacing (Minutes 5-10+ / 300s-600s)', () => {
    it('scales ScrapCritter roam speed by up to +35% during late session', () => {
      const critter = new ScrapCritter(scene, 100, 100);
      critter.activate(100, 100, 2);

      const bounds = { x: 0, y: 0, width: 2000, height: 2000 };

      // Normal speed (multiplier 1.0)
      critter.updateRoam(16, bounds, 0, 1.0);
      const normalVelocityMagnitude = Math.hypot(critter.body.velocity.x, critter.body.velocity.y);

      // Escalated speed at min 10 (multiplier 1.35)
      critter.updateRoam(16, bounds, 0, 1.35);
      const escalatedVelocityMagnitude = Math.hypot(critter.body.velocity.x, critter.body.velocity.y);

      expect(escalatedVelocityMagnitude).toBeCloseTo(normalVelocityMagnitude * 1.35, 1);
    });

    it('scales rival spawn recurrence interval from 210s down to 120s as session reaches 10 minutes', () => {
      const rover = createMockRover();
      const scrapPool = createMockScrapPool();

      // Trigger rival spawn at minute 10 (600,000ms elapsed)
      (hazardManager as any).nextRivalSpawnTime = 600000;
      hazardManager.update(600000, 16, rover, scrapPool, [1, 2, 3], 600000);

      expect(hazardManager.rivalScavenger.isActiveRival).toBe(true);
      // Next rival spawn interval should be 120,000ms (so next spawn at 720,000ms)
      expect((hazardManager as any).nextRivalSpawnTime).toBeCloseTo(720000, -2);
    });
  });

  describe('Phase 3: Progression & Economy Balancing Oracles', () => {
    it('validates total upgrade cost remains exactly 19,209 coins across all 4 stats', () => {
      const stats = ['attractPower', 'magnetRange', 'carryCapacity', 'movementSpeed'] as const;
      let totalCost = 0;
      for (const stat of stats) {
        for (let lvl = 1; lvl < UPGRADE_MAX_LEVEL; lvl++) {
          totalCost += getUpgradeCost(stat, lvl);
        }
      }
      expect(totalCost).toBe(19209);
    });

    it('validates grand total progression investment is exactly 49,959 coins (tiers + upgrades)', () => {
      const tierSum = JUNKYARD_TIERS.reduce((acc, t) => acc + t.unlockCost, 0); // 0 + 750 + 5000 + 25000 = 30750
      expect(tierSum).toBe(30750);

      const upgradeSum = 19209;
      expect(tierSum + upgradeSum).toBe(49959);
    });
  });
});
