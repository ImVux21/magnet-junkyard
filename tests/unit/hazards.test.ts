// ============================================================================
// Magnet Junkyard - Hazards Unit Tests (Critters, EMP Mines, Rival Scavenger)
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockSprite {
    public scene: any;
    public x: number = 0;
    public y: number = 0;
    public active: boolean = false;
    public visible: boolean = false;
    public depth: number = 0;
    public rotation: number = 0;
    public body: any;

    constructor(scene: any, x: number, y: number, _texture?: string) {
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.body = {
        setSize: vi.fn(),
        setCircle: vi.fn(),
        setCollideWorldBounds: vi.fn(),
        setBounce: vi.fn(),
        setImmovable: vi.fn(),
        setVelocity: vi.fn((vx: number, vy: number) => {
          this.body.velocity.x = vx;
          this.body.velocity.y = vy;
        }),
        velocity: { x: 0, y: 0 },
        reset: vi.fn(),
        enable: true,
      };
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
    setDepth(val: number) {
      this.depth = val;
      return this;
    }
    setRotation(val: number) {
      this.rotation = val;
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

  const Between = (x1: number, y1: number, x2: number, y2: number) =>
    Math.hypot(x2 - x1, y2 - y1);

  const AngleBetween = (x1: number, y1: number, x2: number, y2: number) =>
    Math.atan2(y2 - y1, x2 - x1);

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
        Vector2: MockVector2,
        Distance: {
          Between,
        },
        Angle: {
          Between: AngleBetween,
        },
      },
    },
  };
});

import { ScrapCritter } from '../../src/entities/hazards/ScrapCritter';
import { EMPMine } from '../../src/entities/hazards/EMPMine';
import { RivalScavenger } from '../../src/entities/hazards/RivalScavenger';
import { ScrapItemData, SCRAP_CATALOG } from '../../src/config/constants';

// Minimal Mock Scene for headless Arcade Physics entities
function createMockScene() {
  const tweens = {
    add: vi.fn().mockReturnValue({ pause: vi.fn(), resume: vi.fn() }),
    killTweensOf: vi.fn(),
  };

  const particlesEmitter = {
    explode: vi.fn(),
    destroy: vi.fn(),
  };

  const particles = vi.fn().mockReturnValue({
    setDepth: vi.fn().mockReturnThis(),
    explode: vi.fn(),
    destroy: vi.fn(),
  });

  const graphicsObj = {
    clear: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    fillStyle: vi.fn(),
    fillCircle: vi.fn(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };

  const add = {
    existing: vi.fn(),
    graphics: vi.fn().mockReturnValue(graphicsObj),
    particles: particles,
  };

  const physicsWorld = {
    enable: (sprite: any) => {
      sprite.body = {
        setSize: vi.fn(),
        setCircle: vi.fn(),
        setCollideWorldBounds: vi.fn(),
        setBounce: vi.fn(),
        setImmovable: vi.fn(),
        setVelocity: vi.fn((vx: number, vy: number) => {
          sprite.body.velocity.x = vx;
          sprite.body.velocity.y = vy;
        }),
        velocity: { x: 0, y: 0 },
        reset: vi.fn(),
        enable: true,
      };
    },
  };

  const time = {
    delayedCall: vi.fn((_ms: number, cb: () => void) => cb()),
    now: 10000,
  };

  return { add, tweens, physics: { world: physicsWorld }, time } as any;
}

// Minimal Mock Rover
function createMockRover(power: number = 350, items: ScrapItemData[] = []) {
  const cargo = {
    currentMassKg: items.reduce((acc, it) => acc + it.massKg, 0),
    maxCapacityKg: 20,
    itemsCount: items.length,
    items: [...items],
    isFull: false,
  };

  return {
    x: 500,
    y: 500,
    effectivePower: power,
    isMagnetDisabled: false,
    magnetDisabledUntil: 0,
    cargo,
    disableMagnet: function (durationMs: number = 3000, currentTime: number = 10000) {
      this.isMagnetDisabled = true;
      this.magnetDisabledUntil = currentTime + durationMs;
    },
    ejectCargo: function (count: number = 1) {
      const toEject = Math.min(count, this.cargo.items.length);
      const ejected: ScrapItemData[] = [];
      for (let i = 0; i < toEject; i++) {
        const it = this.cargo.items.pop();
        if (it) ejected.push(it);
      }
      this.cargo.currentMassKg = Math.max(
        0,
        this.cargo.currentMassKg - ejected.reduce((a, b) => a + b.massKg, 0)
      );
      this.cargo.itemsCount = this.cargo.items.length;
      return ejected;
    },
    dumpCargoPercentage: function (pct: number = 0.3) {
      const count = Math.max(1, Math.ceil(this.cargo.items.length * pct));
      return this.ejectCargo(count);
    },
  } as any;
}

describe('Hazards System — Scrap Critters (Tier 2+ Threat)', () => {
  let scene: any;

  beforeEach(() => {
    scene = createMockScene();
  });

  it('activates with tier-scaled move speed and world bounds', () => {
    const critter = new ScrapCritter(scene, 100, 100);
    critter.activate(200, 300, 2);

    expect(critter.active).toBe(true);
    expect(critter.visible).toBe(true);
    expect(critter.zoneTier).toBe(2);
    expect(critter.moveSpeed).toBe(60 + 2 * 15); // 90 px/s
  });

  it('knocks loose 1-2 cargo items when colliding with low-power rover', () => {
    const critter = new ScrapCritter(scene, 500, 500);
    critter.activate(500, 500, 2);

    const testItems = [
      SCRAP_CATALOG.screw,
      SCRAP_CATALOG.can,
      SCRAP_CATALOG.pipe,
    ];
    const rover = createMockRover(350, testItems); // Power 350 < 700 threshold

    const res = critter.interactWithRover(rover, 1000);
    expect(res.repelled).toBe(false);
    expect(res.ejectedItems.length).toBeGreaterThanOrEqual(1);
    expect(res.ejectedItems.length).toBeLessThanOrEqual(2);
    expect(rover.cargo.items.length).toBe(3 - res.ejectedItems.length);
  });

  it('is repelled without cargo loss when rover has Attract Power >= 700', () => {
    const critter = new ScrapCritter(scene, 500, 500);
    critter.activate(500, 500, 2);

    const testItems = [SCRAP_CATALOG.screw, SCRAP_CATALOG.can];
    const rover = createMockRover(750, testItems); // Power 750 >= 700 threshold

    const res = critter.interactWithRover(rover, 1000);
    expect(res.repelled).toBe(true);
    expect(res.ejectedItems.length).toBe(0);
    expect(rover.cargo.items.length).toBe(2); // Cargo untouched!
  });
});

describe('Hazards System — EMP Mines (Magnetic Hazard)', () => {
  let scene: any;

  beforeEach(() => {
    scene = createMockScene();
  });

  it('initializes armed and pulses with periodic tween', () => {
    const mine = new EMPMine(scene, 600, 600);
    expect(mine.isArmed).toBe(true);
  });

  it('detonates on rover contact, disables magnet for 3s, and dumps 30% cargo', () => {
    const mine = new EMPMine(scene, 600, 600);
    mine.activate(600, 600);

    const testItems = Array(10).fill(SCRAP_CATALOG.screw);
    const rover = createMockRover(400, testItems);

    const result = mine.detonate(rover, 5000);
    expect(result.disabledDurationMs).toBe(3000);
    expect(rover.isMagnetDisabled).toBe(true);
    expect(rover.magnetDisabledUntil).toBe(8000);

    // 30% of 10 items = 3 items dumped
    expect(result.dumpedItems.length).toBe(3);
    expect(rover.cargo.items.length).toBe(7);
    expect(mine.isArmed).toBe(false);
  });

  it('does not re-detonate while unarmed during cooldown period', () => {
    const mine = new EMPMine(scene, 600, 600);
    mine.activate(600, 600);

    const rover = createMockRover(400, [SCRAP_CATALOG.screw]);
    mine.detonate(rover, 1000);

    // Second hit immediately
    const secondHit = mine.detonate(rover, 1500);
    expect(secondHit.dumpedItems.length).toBe(0);
    expect(secondHit.disabledDurationMs).toBe(0);
  });
});

describe('Hazards System — Rival Scavenger AI (Resource Competitor)', () => {
  let scene: any;

  beforeEach(() => {
    scene = createMockScene();
  });

  it('spawns active for exactly 30 seconds', () => {
    const rival = new RivalScavenger(scene, 0, 0);
    rival.spawn(700, 700, 2, 20000);

    expect(rival.isActiveRival).toBe(true);
    expect(rival.getRemainingTimeMs(20000)).toBe(30000);
    expect(rival.getRemainingTimeMs(35000)).toBe(15000);
    expect(rival.getRemainingTimeMs(50000)).toBe(0);
  });

  it('despawns automatically after 30 seconds elapse', () => {
    const rival = new RivalScavenger(scene, 0, 0);
    rival.spawn(700, 700, 2, 10000);

    const mockPool = { getActiveItems: () => [] } as any;

    // Tick at 41,000 (31s elapsed)
    rival.updateAI(16, mockPool, 41000);
    expect(rival.isActiveRival).toBe(false);
  });
});
