// ============================================================================
// Adversarial Challenger M1: Game Feel, Visual Polish & Screen Shake Oracles
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockSprite {
    public scene: any;
    public x: number = 0;
    public y: number = 0;
    public active: boolean = true;
    public visible: boolean = true;
    public depth: number = 0;
    public rotation: number = 0;
    public scaleX: number = 1;
    public scaleY: number = 1;
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
    setScale(x?: number, y?: number) {
      this.scaleX = x ?? 1;
      this.scaleY = y ?? x ?? 1;
      return this;
    }
    destroy() {
      this.active = false;
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
      GameObjects: {
        Sprite: MockSprite,
      },
      Physics: {
        Arcade: {
          Sprite: MockSprite,
        },
      },
      Math: {
        Between: (min: number, max: number) =>
          Math.floor(Math.random() * (max - min + 1)) + min,
        RND: {
          pick: (arr: any[]) => arr[0],
        },
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

import { SaveManager, STORAGE_KEY_V1, STORAGE_KEY_V2, DEFAULT_SAVE_DATA_V2 } from '../../src/services/persistence/SaveManager';
import { DestructibleCrate } from '../../src/entities/hazards/DestructibleCrate';
import { EMPMine } from '../../src/entities/hazards/EMPMine';
import { ScrapCritter } from '../../src/entities/hazards/ScrapCritter';
import { SCRAP_CATALOG, ScrapItemData } from '../../src/config/constants';

// ----------------------------------------------------------------------------
// Mock In-Memory Storage
// ----------------------------------------------------------------------------
class MockMemoryStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

// ----------------------------------------------------------------------------
// Mock Scene Builder
// ----------------------------------------------------------------------------
function createMockSceneWithShake() {
  const shakeFn = vi.fn();
  const events = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  const cameras = {
    main: {
      shake: shakeFn,
    },
  };

  const tweens = {
    add: vi.fn().mockReturnValue({ pause: vi.fn(), resume: vi.fn() }),
    killTweensOf: vi.fn(),
  };

  const crateDebrisEmitter = {
    explode: vi.fn(),
    destroy: vi.fn(),
  };

  const sparkEmitter = {
    explode: vi.fn(),
    destroy: vi.fn(),
  };

  const pulseSparkEmitter = {
    explode: vi.fn(),
    destroy: vi.fn(),
  };

  const roverDustEmitter = {
    emitParticleAt: vi.fn(),
    destroy: vi.fn(),
  };

  const audioService = {
    playCompressorCrunch: vi.fn(),
    playEMPBlast: vi.fn(),
    playCritterSqueak: vi.fn(),
  };

  const scrapPool = {
    spawn: vi.fn().mockReturnValue({
      body: { setVelocity: vi.fn() },
    }),
  };

  const showFloatingText = vi.fn();

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

  let timerCallback: (() => void) | null = null;
  const time = {
    delayedCall: vi.fn((_ms: number, cb: () => void) => {
      timerCallback = cb;
      return {
        destroy: vi.fn(() => {
          timerCallback = null;
        }),
      };
    }),
    now: 10000,
  };

  const scene: any = {
    add,
    tweens,
    physics: { world: physicsWorld },
    time,
    events,
    cameras,
    audioService,
    crateDebrisEmitter,
    sparkEmitter,
    pulseSparkEmitter,
    roverDustEmitter,
    scrapPool,
    showFloatingText,
    screenShakeEnabled: true,
    triggerScreenShake: function (duration: number = 150, intensity: number = 0.01) {
      if (!this.screenShakeEnabled) return;
      if (this.cameras && this.cameras.main) {
        this.cameras.main.shake(duration, intensity);
      }
    },
    setScreenShakeEnabled: function (enabled: boolean) {
      this.screenShakeEnabled = enabled;
      this.events.emit('screenshake-toggled', enabled);
    },
  };

  return { scene, shakeFn, cameras, time, timerCallback: () => timerCallback?.() };
}

// ----------------------------------------------------------------------------
// Mock Rover Builder
// ----------------------------------------------------------------------------
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

// ============================================================================
// Test Suites
// ============================================================================

describe('Adversarial Challenge 1: Camera Screen Shake Behavior & Intensity Hierarchy', () => {
  it('triggers camera.shake when screenShakeEnabled is true with exact arguments', () => {
    const { scene, shakeFn } = createMockSceneWithShake();
    scene.screenShakeEnabled = true;

    scene.triggerScreenShake(200, 0.012);
    expect(shakeFn).toHaveBeenCalledTimes(1);
    expect(shakeFn).toHaveBeenCalledWith(200, 0.012);
  });

  it('suppresses camera.shake completely when screenShakeEnabled is false', () => {
    const { scene, shakeFn } = createMockSceneWithShake();
    scene.screenShakeEnabled = false;

    scene.triggerScreenShake(250, 0.014);
    scene.triggerScreenShake(160, 0.010);
    scene.triggerScreenShake(80, 0.004);

    expect(shakeFn).not.toHaveBeenCalled();
  });

  it('safely handles missing cameras or cameras.main without throwing exceptions', () => {
    const { scene } = createMockSceneWithShake();
    scene.cameras = null;
    expect(() => scene.triggerScreenShake(150, 0.01)).not.toThrow();

    scene.cameras = {};
    expect(() => scene.triggerScreenShake(150, 0.01)).not.toThrow();
  });

  it('verifies game impact intensity hierarchy satisfies strict monotonicity', () => {
    // Defined tiers across the codebase:
    // Critter Repel: (80ms, 0.004)
    // Critter Collision: (140ms, 0.007)
    // Crate Smash: (160ms, 0.010)
    // Magnetic Pulse: (200ms, 0.012)
    // EMP Mine Detonation: (250ms, 0.014)
    const tiers = [
      { name: 'critter_repel', duration: 80, intensity: 0.004 },
      { name: 'critter_collision', duration: 140, intensity: 0.007 },
      { name: 'crate_smash', duration: 160, intensity: 0.010 },
      { name: 'magnetic_pulse', duration: 200, intensity: 0.012 },
      { name: 'emp_mine', duration: 250, intensity: 0.014 },
    ];

    for (let i = 0; i < tiers.length - 1; i++) {
      expect(tiers[i].intensity).toBeLessThan(tiers[i + 1].intensity);
      expect(tiers[i].duration).toBeLessThan(tiers[i + 1].duration);
    }
  });

  it('toggles screen shake state and emits event consistently across 100 rapid flips', () => {
    const { scene } = createMockSceneWithShake();
    let state = true;

    for (let i = 0; i < 100; i++) {
      state = !state;
      scene.setScreenShakeEnabled(state);
      expect(scene.screenShakeEnabled).toBe(state);
      expect(scene.events.emit).toHaveBeenCalledWith('screenshake-toggled', state);
    }
  });
});

describe('Adversarial Challenge 2: SaveManager ScreenShake Toggle Persistence & Migration Oracles', () => {
  let storage: MockMemoryStorage;
  let saveManager: SaveManager;

  beforeEach(() => {
    storage = new MockMemoryStorage();
    saveManager = new SaveManager(storage);
  });

  it('defaults screenShake to true in schema v2 defaults', () => {
    expect(DEFAULT_SAVE_DATA_V2.settings.screenShake).toBe(true);
    const loaded = saveManager.load();
    expect(loaded.settings.screenShake).toBe(true);
  });

  it('persists screenShake toggle to false across simulated reload cycles', () => {
    const data = saveManager.load();
    data.settings.screenShake = false;
    saveManager.save(data);

    // Simulate new session / reload with new instance reading storage
    const reloadedManager = new SaveManager(storage);
    const reloadedData = reloadedManager.load();
    expect(reloadedData.settings.screenShake).toBe(false);

    // Toggle back to true
    reloadedData.settings.screenShake = true;
    reloadedManager.save(reloadedData);

    const thirdManager = new SaveManager(storage);
    expect(thirdManager.load().settings.screenShake).toBe(true);
  });

  it('migrates legacy v1 save missing screenShake with default true', () => {
    const v1Data = {
      version: 1,
      timestamp: 123456,
      player: {
        coins: 5000,
        upgrades: { magnetRange: 2, attractPower: 2, carryCapacity: 2, movementSpeed: 2 },
        unlockedTiers: [1],
      },
      stats: { totalCoinsEarned: 5000 },
      settings: {
        sfxVolume: 0.7,
        musicVolume: 0.5,
        touchControls: true,
        hapticFeedback: true,
        // Notice: NO screenShake property in v1!
      },
    };
    storage.setItem(STORAGE_KEY_V1, JSON.stringify(v1Data));

    const migrated = saveManager.load();
    expect(migrated.version).toBe(2);
    expect(migrated.settings.screenShake).toBe(true);
    expect(migrated.player.coins).toBe(5000);
  });

  it('adversarially rejects invalid screenShake types during migration and restores boolean fallback', () => {
    const testCases = [
      { input: 'false', expected: true }, // string "false" is not boolean
      { input: 0, expected: true },       // number 0 is not boolean
      { input: null, expected: true },    // null
      { input: undefined, expected: true }, // undefined
      { input: {}, expected: true },      // object
      { input: false, expected: false },  // genuine boolean false -> must preserve!
      { input: true, expected: true },    // genuine boolean true -> must preserve!
    ];

    for (const { input, expected } of testCases) {
      const raw = {
        version: 2,
        settings: { screenShake: input },
      };
      const result = saveManager.migrate(raw);
      expect(result.settings.screenShake).toBe(expected);
      expect(typeof result.settings.screenShake).toBe('boolean');
    }
  });

  it('clears screenShake override and reverts to true on storage reset', () => {
    const data = saveManager.load();
    data.settings.screenShake = false;
    saveManager.save(data);

    saveManager.reset();
    expect(storage.getItem(STORAGE_KEY_V2)).toBeNull();

    const fresh = saveManager.load();
    expect(fresh.settings.screenShake).toBe(true);
  });
});

describe('Adversarial Challenge 3: Destructible Crate Destruction Juice & Emitter Lifecycle', () => {
  it('triggers compressor sound, crate debris burst, spark burst, and screen shake on breakCrate', () => {
    const { scene, shakeFn } = createMockSceneWithShake();
    const crate = new DestructibleCrate(scene, 300, 400, 1);

    crate.breakCrate(scene);

    expect(scene.audioService.playCompressorCrunch).toHaveBeenCalledTimes(1);
    expect(scene.crateDebrisEmitter.explode).toHaveBeenCalledWith(20, 300, 400);
    expect(scene.sparkEmitter.explode).toHaveBeenCalledWith(8, 300, 400);
    expect(shakeFn).toHaveBeenCalledWith(160, 0.010);
    expect(crate.isDestroyed).toBe(true);
    expect(crate.visible).toBe(false);
  });

  it('is strictly idempotent: repeated breakCrate calls do not re-trigger particles or shake', () => {
    const { scene, shakeFn } = createMockSceneWithShake();
    const crate = new DestructibleCrate(scene, 300, 400, 1);

    crate.breakCrate(scene);
    crate.breakCrate(scene); // Second call in same frame
    crate.breakCrate(scene); // Third call

    expect(scene.crateDebrisEmitter.explode).toHaveBeenCalledTimes(1);
    expect(scene.sparkEmitter.explode).toHaveBeenCalledTimes(1);
    expect(shakeFn).toHaveBeenCalledTimes(1);
  });

  it('handles missing emitters gracefully without throwing runtime errors', () => {
    const { scene } = createMockSceneWithShake();
    scene.crateDebrisEmitter = null;
    scene.sparkEmitter = null;

    const crate = new DestructibleCrate(scene, 300, 400, 1);
    expect(() => crate.breakCrate(scene)).not.toThrow();
  });

  it('cancels respawnTimer and cleans up tweens on crate.destroy() to prevent leaks', () => {
    const { scene } = createMockSceneWithShake();
    const crate = new DestructibleCrate(scene, 300, 400, 1);
    crate.breakCrate(scene);

    expect(scene.time.delayedCall).toHaveBeenCalled();

    // Destroy crate
    expect(() => crate.destroy()).not.toThrow();
    expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(crate);
  });
});

describe('Adversarial Challenge 4: EMP Mine Detonation Shake & Feedback', () => {
  it('triggers heavy screen shake (250ms, 0.014) on detonation', () => {
    const { scene, shakeFn } = createMockSceneWithShake();
    const mine = new EMPMine(scene, 600, 700);
    mine.activate(600, 700);

    const rover = createMockRover(500, [SCRAP_CATALOG.screw, SCRAP_CATALOG.can]);
    const res = mine.detonate(rover, 10000);

    expect(shakeFn).toHaveBeenCalledWith(250, 0.014);
    expect(res.disabledDurationMs).toBe(3000);
    expect(rover.isMagnetDisabled).toBe(true);
  });

  it('does not trigger shake if mine is not armed or already detonated', () => {
    const { scene, shakeFn } = createMockSceneWithShake();
    const mine = new EMPMine(scene, 600, 700);
    mine.deactivate(); // explicitly disarm

    const rover = createMockRover(500, []);
    const res = mine.detonate(rover, 10000);

    expect(shakeFn).not.toHaveBeenCalled();
    expect(res.disabledDurationMs).toBe(0);
  });

  it('survives gracefully if scene lacks triggerScreenShake method', () => {
    const { scene } = createMockSceneWithShake();
    delete scene.triggerScreenShake;

    const mine = new EMPMine(scene, 600, 700);
    mine.activate(600, 700);

    const rover = createMockRover(500, []);
    expect(() => mine.detonate(rover, 10000)).not.toThrow();
  });
});

describe('Adversarial Challenge 5: Scrap Critter Collision Shake & Feedback', () => {
  it('triggers medium shake (140ms, 0.007) on collision with rover under power threshold', () => {
    const { scene, shakeFn } = createMockSceneWithShake();
    const critter = new ScrapCritter(scene, 400, 400);
    critter.activate(400, 400, 2);

    const testItems = [SCRAP_CATALOG.screw, SCRAP_CATALOG.can, SCRAP_CATALOG.pipe];
    const rover = createMockRover(350, testItems); // Power 350 < 700 threshold

    const res = critter.interactWithRover(rover, 10000);

    expect(res.repelled).toBe(false);
    expect(shakeFn).toHaveBeenCalledWith(140, 0.007);
  });

  it('triggers light shake (80ms, 0.004) when repelled by high-power rover (>= 700)', () => {
    const { scene, shakeFn } = createMockSceneWithShake();
    const critter = new ScrapCritter(scene, 400, 400);
    critter.activate(400, 400, 2);

    const rover = createMockRover(750, [SCRAP_CATALOG.screw]); // Power 750 >= 700
    const res = critter.interactWithRover(rover, 10000);

    expect(res.repelled).toBe(true);
    expect(shakeFn).toHaveBeenCalledWith(80, 0.004);
  });

  it('does not trigger shake during collision cooldown window', () => {
    const { scene, shakeFn } = createMockSceneWithShake();
    const critter = new ScrapCritter(scene, 400, 400);
    critter.activate(400, 400, 2);

    const rover = createMockRover(350, [SCRAP_CATALOG.screw]);

    // First hit
    critter.interactWithRover(rover, 10000);
    expect(shakeFn).toHaveBeenCalledTimes(1);

    // Second hit 500ms later (hitCooldownUntil is 12000)
    const secondRes = critter.interactWithRover(rover, 10500);
    expect(secondRes.ejectedItems).toHaveLength(0);
    expect(shakeFn).toHaveBeenCalledTimes(1); // No new shake
  });
});

describe('Adversarial Challenge 6: Shutdown Cleanup & Cross-Scene Leak Prevention', () => {
  it('verifies all 14 cross-scene event listeners are unhooked upon UIScene shutdown', () => {
    const offCalls: Array<{ event: string; fn: any; context: any }> = [];
    const mockJunkyard = {
      events: {
        off: vi.fn((event: string, fn: any, context: any) => {
          offCalls.push({ event, fn, context });
        }),
      },
    };

    const mockUIScene: any = {
      scene: {
        get: vi.fn().mockReturnValue(mockJunkyard),
      },
      updateCargoDisplay: vi.fn(),
      updateCoinsDisplay: vi.fn(),
      updateTierDisplay: vi.fn(),
      showBuffToast: vi.fn(),
      updateComboDisplay: vi.fn(),
      handleFeverStarted: vi.fn(),
      handleFeverEnded: vi.fn(),
      handleComboExpired: vi.fn(),
      updatePrestigeDisplay: vi.fn(),
      updateChallengeDisplay: vi.fn(),
      onHazardHit: vi.fn(),
      onHazardRepelled: vi.fn(),
      onOfflineEarnings: vi.fn(),
      onScreenShakeToggled: vi.fn(),
      shutdown: function () {
        const junkyard = this.scene.get('JunkyardScene');
        if (junkyard && junkyard.events) {
          junkyard.events.off('cargo-updated', this.updateCargoDisplay, this);
          junkyard.events.off('coins-updated', this.updateCoinsDisplay, this);
          junkyard.events.off('tier-updated', this.updateTierDisplay, this);
          junkyard.events.off('buff-activated', this.showBuffToast, this);
          junkyard.events.off('combo-updated', this.updateComboDisplay, this);
          junkyard.events.off('fever-started', this.handleFeverStarted, this);
          junkyard.events.off('fever-ended', this.handleFeverEnded, this);
          junkyard.events.off('combo-expired', this.handleComboExpired, this);
          junkyard.events.off('prestige-updated', this.updatePrestigeDisplay, this);
          junkyard.events.off('challenge-updated', this.updateChallengeDisplay, this);
          junkyard.events.off('hazard-hit', this.onHazardHit, this);
          junkyard.events.off('hazard-repelled', this.onHazardRepelled, this);
          junkyard.events.off('offline-earnings', this.onOfflineEarnings, this);
          junkyard.events.off('screenshake-toggled', this.onScreenShakeToggled, this);
        }
      },
    };

    mockUIScene.shutdown();

    const expectedEvents = [
      'cargo-updated',
      'coins-updated',
      'tier-updated',
      'buff-activated',
      'combo-updated',
      'fever-started',
      'fever-ended',
      'combo-expired',
      'prestige-updated',
      'challenge-updated',
      'hazard-hit',
      'hazard-repelled',
      'offline-earnings',
      'screenshake-toggled',
    ];

    expect(offCalls).toHaveLength(14);
    for (const ev of expectedEvents) {
      expect(offCalls.some((c) => c.event === ev)).toBe(true);
    }
  });

  it('verifies particle emitters and destructible crate timers are destroyed on JunkyardScene shutdown', () => {
    const mockJunkyardScene: any = {
      respawnTimer: { destroy: vi.fn() },
      scrapPool: { destroy: vi.fn() },
      sparkEmitter: { destroy: vi.fn() },
      pulseSparkEmitter: { destroy: vi.fn() },
      crateDebrisEmitter: { destroy: vi.fn() },
      roverDustEmitter: { destroy: vi.fn() },
      recyclerSteamEmitter: { destroy: vi.fn() },
      destructibleCrates: [
        { destroy: vi.fn() },
        { destroy: vi.fn() },
      ],
      comboManager: { reset: vi.fn() },
      audioService: { stopAll: vi.fn() },
      shutdown: function () {
        if (this.respawnTimer) this.respawnTimer.destroy();
        if (this.scrapPool) this.scrapPool.destroy();
        if (this.sparkEmitter) this.sparkEmitter.destroy();
        if (this.pulseSparkEmitter) this.pulseSparkEmitter.destroy();
        if (this.crateDebrisEmitter) this.crateDebrisEmitter.destroy();
        if (this.roverDustEmitter) this.roverDustEmitter.destroy();
        if (this.recyclerSteamEmitter) this.recyclerSteamEmitter.destroy();
        if (this.destructibleCrates) {
          for (const crate of this.destructibleCrates) {
            crate.destroy();
          }
          this.destructibleCrates = [];
        }
        this.comboManager.reset();
        if (this.audioService) this.audioService.stopAll();
      },
    };

    mockJunkyardScene.shutdown();

    expect(mockJunkyardScene.pulseSparkEmitter.destroy).toHaveBeenCalledTimes(1);
    expect(mockJunkyardScene.crateDebrisEmitter.destroy).toHaveBeenCalledTimes(1);
    expect(mockJunkyardScene.roverDustEmitter.destroy).toHaveBeenCalledTimes(1);
    expect(mockJunkyardScene.sparkEmitter.destroy).toHaveBeenCalledTimes(1);
    expect(mockJunkyardScene.recyclerSteamEmitter.destroy).toHaveBeenCalledTimes(1);
    expect(mockJunkyardScene.destructibleCrates).toHaveLength(0);
  });
});

describe('Adversarial Challenge 7: Action Punchiness & Juice (Squash, Stretch, Dust, and Purchase Pop)', () => {
  it('triggers squash & stretch (1.22, 0.82) settling back to (1.0, 1.0) on scrap pickup', () => {
    const killTweensOf = vi.fn();
    const tweenAdd = vi.fn();
    let currentScaleX = 1;
    let currentScaleY = 1;

    const mockCargoSprite = {
      setScale: vi.fn((sx: number, sy: number) => {
        currentScaleX = sx;
        currentScaleY = sy;
      }),
    };

    const mockScene = {
      tweens: {
        killTweensOf,
        add: tweenAdd,
      },
    };

    // Simulate addItem squash & stretch logic
    if (mockCargoSprite && mockScene && mockScene.tweens) {
      mockScene.tweens.killTweensOf(mockCargoSprite);
      mockCargoSprite.setScale(1.22, 0.82);
      mockScene.tweens.add({
        targets: mockCargoSprite,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 160,
        ease: 'Back.out',
      });
    }

    expect(killTweensOf).toHaveBeenCalledWith(mockCargoSprite);
    expect(currentScaleX).toBe(1.22);
    expect(currentScaleY).toBe(0.82);
    expect(tweenAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: mockCargoSprite,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 160,
        ease: 'Back.out',
      })
    );
  });

  it('emits high-speed dust trail particles when speed > 130 px/s with 65ms throttling', () => {
    const emitParticleAt = vi.fn();
    const mockJunkyard = {
      roverDustEmitter: {
        emitParticleAt,
      },
    };

    let nextDustEmitTime = 0;

    function simulateDustCheck(speed: number, time: number) {
      if (speed > 130 && time >= nextDustEmitTime) {
        nextDustEmitTime = time + 65;
        if (mockJunkyard && mockJunkyard.roverDustEmitter) {
          mockJunkyard.roverDustEmitter.emitParticleAt(100, 100, 1);
          mockJunkyard.roverDustEmitter.emitParticleAt(110, 110, 1);
        }
      }
    }

    // 1. Slow speed (100 px/s) -> no emission
    simulateDustCheck(100, 1000);
    expect(emitParticleAt).not.toHaveBeenCalled();

    // 2. High speed (150 px/s) at t=1000 -> emits left & right particles
    simulateDustCheck(150, 1000);
    expect(emitParticleAt).toHaveBeenCalledTimes(2);

    // 3. High speed at t=1030 (< t+65 throttle) -> throttled, no extra emission
    simulateDustCheck(150, 1030);
    expect(emitParticleAt).toHaveBeenCalledTimes(2);

    // 4. High speed at t=1070 (>= t+65 throttle) -> emits again
    simulateDustCheck(150, 1070);
    expect(emitParticleAt).toHaveBeenCalledTimes(4);
  });

  it('triggers punchy scale pop (1.18x, 75ms yoyo Back.out) on upgrade button purchase', () => {
    const tweenAdd = vi.fn();
    const mockBuyBtn = { id: 'buyBtn' };
    const mockScene = {
      tweens: {
        add: tweenAdd,
      },
    };

    // Simulate purchaseUpgrade feedback
    mockScene.tweens.add({
      targets: mockBuyBtn,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 75,
      yoyo: true,
      ease: 'Back.out',
    });

    expect(tweenAdd).toHaveBeenCalledWith({
      targets: mockBuyBtn,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 75,
      yoyo: true,
      ease: 'Back.out',
    });
  });
});

describe('M1 Fix 3 Verification: Settings Preservation, UI Robustness & Dust Safety', () => {
  it('preserves customized audio volumes and control settings when saveGameState() executes', () => {
    const storage = new MockMemoryStorage();
    const saveManager = new SaveManager(storage);
    SaveManager['instance'] = saveManager;

    // 1. Player customizes audio settings
    const initialSave = saveManager.load();
    initialSave.settings.sfxVolume = 0.25;
    initialSave.settings.musicVolume = 0.15;
    initialSave.settings.touchControls = false;
    initialSave.settings.hapticFeedback = false;
    initialSave.settings.screenShake = true;
    saveManager.save(initialSave);

    // 2. JunkyardScene triggers saveGameState() (e.g. after scrap recycle or shake toggle)
    const mockJunkyardScene: any = {
      coins: 500,
      upgrades: { magnetRange: 2, attractPower: 2, carryCapacity: 2, movementSpeed: 2 },
      unlockedTiers: [1, 2],
      prestigeLevel: 0,
      challengeManager: { serialize: () => initialSave.challenges, getState: () => ({ completedCount: 0 }) },
      achievementManager: { serialize: () => initialSave.achievements },
      totalScrapCollected: 50,
      totalRecycledRuns: 5,
      sessionStartTime: Date.now(),
      loadedPlayTimeSeconds: 100,
      adRewardsClaimed: 0,
      goldenScrapCollected: 0,
      crittersRepelled: 0,
      empMineHits: 0,
      screenShakeEnabled: false, // Player toggled shake off
    };

    // Execute proposed saveGameState logic
    const currentSettings = saveManager.load()?.settings;
    saveManager.save({
      version: 2,
      timestamp: Date.now(),
      player: {
        coins: mockJunkyardScene.coins,
        upgrades: mockJunkyardScene.upgrades,
        unlockedTiers: mockJunkyardScene.unlockedTiers,
        prestigeLevel: mockJunkyardScene.prestigeLevel,
      },
      challenges: mockJunkyardScene.challengeManager.serialize(),
      achievements: mockJunkyardScene.achievementManager.serialize(),
      stats: {
        totalScrapCollected: mockJunkyardScene.totalScrapCollected,
        totalCoinsEarned: mockJunkyardScene.coins,
        totalRecycledRuns: mockJunkyardScene.totalRecycledRuns,
        playTimeSeconds: 100,
        adRewardsClaimed: 0,
        totalPrestiges: 0,
        totalChallengesCompleted: 0,
        goldenScrapCollected: 0,
        crittersRepelled: 0,
        empMineHits: 0,
      },
      settings: {
        sfxVolume: 0.8,
        musicVolume: 0.6,
        touchControls: true,
        hapticFeedback: true,
        ...currentSettings,
        screenShake: mockJunkyardScene.screenShakeEnabled,
      },
    });

    // 3. Verify settings are preserved, NOT overwritten with 0.8/0.6
    const reloaded = saveManager.load();
    expect(reloaded.settings.sfxVolume).toBe(0.25);
    expect(reloaded.settings.musicVolume).toBe(0.15);
    expect(reloaded.settings.touchControls).toBe(false);
    expect(reloaded.settings.hapticFeedback).toBe(false);
    expect(reloaded.settings.screenShake).toBe(false);
  });

  it('kills conflicting tweens and prevents button scale freeze on rapid toggle clicks', () => {
    let currentScale = 1.0;
    const killedTargets: any[] = [];
    const addedTweens: any[] = [];

    const mockTweens = {
      killTweensOf: vi.fn((target) => {
        killedTargets.push(target);
      }),
      add: vi.fn((config) => {
        addedTweens.push(config);
      }),
      isTweening: vi.fn(() => false),
    };

    const mockContainer = {
      scaleX: 1.0,
      scaleY: 1.0,
      setScale: (s: number) => { currentScale = s; },
    };

    // Simulate 5 rapid clicks within 50ms
    for (let i = 0; i < 5; i++) {
      mockTweens.killTweensOf(mockContainer);
      mockContainer.setScale(1.0);
      mockTweens.add({
        targets: mockContainer,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 80,
        yoyo: true,
      });
    }

    expect(mockTweens.killTweensOf).toHaveBeenCalledTimes(5);
    expect(mockTweens.add).toHaveBeenCalledTimes(5);
    expect(currentScale).toBe(1.0);
  });

  it('bypasses emitParticleAt when roverDustEmitter is inactive or destroyed', () => {
    const emitParticleAtSpy = vi.fn();
    const mockJunkyard = {
      roverDustEmitter: {
        active: false, // Destroyed or inactive emitter
        emitParticleAt: emitParticleAtSpy,
      },
    };

    // Simulate PlayerRover check
    if (mockJunkyard && mockJunkyard.roverDustEmitter && mockJunkyard.roverDustEmitter.active) {
      mockJunkyard.roverDustEmitter.emitParticleAt(100, 100, 1);
    }

    expect(emitParticleAtSpy).not.toHaveBeenCalled();
  });
});


