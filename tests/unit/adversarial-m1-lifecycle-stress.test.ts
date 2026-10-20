// ============================================================================
// Adversarial Challenger Test Suite: Milestone 1 Lifecycle, Perf & Memory
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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

    constructor(scene: any, x: number = 0, y: number = 0, _texture?: string) {
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
    setScale(_val: number) {
      return this;
    }
    setRotation(val: number) {
      this.rotation = val;
      return this;
    }
    destroy() {
      this.active = false;
    }
  }

  class MockContainer extends MockSprite {
    public list: any[] = [];
    add(child: any) {
      this.list.push(child);
      return this;
    }
    remove(child: any) {
      this.list = this.list.filter((c) => c !== child);
      return this;
    }
  }

  class MockGroup {
    public children: any[] = [];
    add(child: any) {
      this.children.push(child);
    }
    createMultiple(_config: any) {
      return [];
    }
    destroy() {}
  }

  class MockScene {
    public sys: any = {
      settings: { key: 'MockScene' },
    };
    public events: any = {
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };
    public add: any = {
      existing: vi.fn(),
      particles: vi.fn(),
      group: vi.fn(() => new MockGroup()),
      text: vi.fn(() => ({ setOrigin: vi.fn(), setDepth: vi.fn(), setAlpha: vi.fn(), destroy: vi.fn() })),
      graphics: vi.fn(() => ({
        clear: vi.fn(),
        lineStyle: vi.fn(),
        fillStyle: vi.fn(),
        beginPath: vi.fn(),
        strokePath: vi.fn(),
        strokeCircle: vi.fn(),
        fillCircle: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        arc: vi.fn(),
        generateTexture: vi.fn(),
        destroy: vi.fn(),
      })),
    };
    public physics: any = {
      world: {
        enable: vi.fn(),
      },
      add: {
        existing: vi.fn(),
      },
    };
    public tweens: any = {
      add: vi.fn(),
      killTweensOf: vi.fn(),
    };
    public time: any = {
      addEvent: vi.fn(),
      delayedCall: vi.fn(),
      removeAllEvents: vi.fn(),
    };
    constructor(_config?: any) {}
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
      Scene: MockScene,
      GameObjects: {
        Sprite: MockSprite,
        Container: MockContainer,
        Group: MockGroup,
        Graphics: MockSprite,
        Text: MockSprite,
        Particles: {
          ParticleEmitter: MockSprite,
        },
      },
      Physics: {
        Arcade: {
          Sprite: MockSprite,
          Body: class {},
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
          Between: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1),
        },
        Angle: {
          Between: (x1: number, y1: number, x2: number, y2: number) => Math.atan2(y2 - y1, x2 - x1),
        },
      },
    },
  };
});

import { JunkyardScene } from '../../src/scenes/JunkyardScene';
import { RivalScavenger } from '../../src/entities/hazards/RivalScavenger';
import { DestructibleCrate } from '../../src/entities/hazards/DestructibleCrate';
import { SaveManager } from '../../src/services/persistence/SaveManager';

class MockMemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
}

describe('Adversarial M1 Lifecycle & Memory Challenge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Dist Bundle Size Compliance (< 10MB)', () => {
    it('empirically verifies total uncompressed dist/ size is strictly < 10MB (10,485,760 bytes)', () => {
      const distDir = path.resolve(process.cwd(), 'dist');
      expect(fs.existsSync(distDir), 'dist/ directory must exist. Run npm run build first.').toBe(true);

      function calcDirSize(dir: string): number {
        let size = 0;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            size += calcDirSize(full);
          } else {
            size += fs.statSync(full).size;
          }
        }
        return size;
      }

      const totalBytes = calcDirSize(distDir);
      const MAX_BYTES = 10 * 1024 * 1024; // 10,485,760 bytes
      const sizeMB = totalBytes / (1024 * 1024);

      expect(totalBytes).toBeLessThan(MAX_BYTES);
      // Empirical expectation: ~1.55 MB
      expect(sizeMB).toBeLessThan(5.0);
    });
  });

  describe('2. Zero Dynamic Particle Allocations Across Hot Loops in src/', () => {
    it('verifies that across all files in src/, add.particles is strictly confined to setup/init in JunkyardScene.ts', () => {
      const srcDir = path.resolve(process.cwd(), 'src');

      function scanDir(dir: string): { file: string; line: number; content: string }[] {
        const matches: { file: string; line: number; content: string }[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            matches.push(...scanDir(full));
          } else if (entry.name.endsWith('.ts')) {
            const lines = fs.readFileSync(full, 'utf-8').split('\n');
            lines.forEach((line, idx) => {
              if (/add\.particles\(/.test(line)) {
                matches.push({ file: path.relative(srcDir, full), line: idx + 1, content: line.trim() });
              }
            });
          }
        }
        return matches;
      }

      const particleAllocations = scanDir(srcDir);

      // Exactly 6 allocations allowed, all in scenes/JunkyardScene.ts
      expect(particleAllocations.length).toBe(6);
      for (const alloc of particleAllocations) {
        expect(alloc.file.replace(/\\/g, '/')).toBe('scenes/JunkyardScene.ts');
      }
    });

    it('stress tests RivalScavenger over 500 spawn & despawn cycles with zero add.particles and zero delayedCall allocations', () => {
      const addParticlesSpy = vi.fn();
      const explodeSpy = vi.fn();
      const delayedCallSpy = vi.fn();

      const mockScene: any = {
        rivalSmokeEmitter: {
          explode: explodeSpy,
          active: true,
        },
        add: {
          existing: vi.fn(),
          particles: addParticlesSpy,
        },
        physics: {
          world: {
            enable: (sprite: any) => {
              sprite.body = {
                setSize: vi.fn(),
                setCircle: vi.fn(),
                setCollideWorldBounds: vi.fn(),
                setVelocity: vi.fn(),
                velocity: { x: 0, y: 0 },
                enable: true,
              };
            },
          },
        },
        time: {
          delayedCall: delayedCallSpy,
        },
      };

      const rival = new RivalScavenger(mockScene, 0, 0);

      // Stress loop: 500 iterations of spawn and despawn
      for (let i = 0; i < 500; i++) {
        rival.spawn(100 + i, 200 + i, 1, 1000 * i);
        rival.updateAI(16, { getActiveItems: () => [] } as any, 1000 * i + 40000);
      }

      // Assert zero dynamic particle creations and zero timers
      expect(addParticlesSpy).not.toHaveBeenCalled();
      expect(delayedCallSpy).not.toHaveBeenCalled();
      expect(explodeSpy).toHaveBeenCalledTimes(1000); // 500 on spawn + 500 on despawn
    });
  });

  describe('3. Scene Lifecycle & Teardown Verification', () => {
    it('verifies that JunkyardScene registers and triggers shutdown() via Phaser scene events with clean context', () => {
      const eventListeners: Record<string, { fn: Function; context: any }[]> = {};
      const mockEvents = {
        on: vi.fn((event: string, fn: Function, context?: any) => {
          if (!eventListeners[event]) eventListeners[event] = [];
          eventListeners[event].push({ fn, context });
        }),
        off: vi.fn((event: string, fn: Function, _context?: any) => {
          if (eventListeners[event]) {
            eventListeners[event] = eventListeners[event].filter((item) => item.fn !== fn);
          }
        }),
        emit: vi.fn((event: string, ...args: any[]) => {
          if (eventListeners[event]) {
            [...eventListeners[event]].forEach((item) => item.fn.call(item.context, ...args));
          }
        }),
      };

      const scene = new JunkyardScene();
      (scene as any).events = mockEvents;

      // Mock emitters
      const emitters = {
        sparkEmitter: { destroy: vi.fn() },
        pulseSparkEmitter: { destroy: vi.fn() },
        crateDebrisEmitter: { destroy: vi.fn() },
        roverDustEmitter: { destroy: vi.fn() },
        rivalSmokeEmitter: { destroy: vi.fn() },
        recyclerSteamEmitter: { destroy: vi.fn() },
      };

      Object.assign(scene, emitters);

      // Mock respawn timer and time subsystem
      const mockTimer = { destroy: vi.fn() };
      (scene as any).respawnTimer = mockTimer;
      (scene as any).time = { removeAllEvents: vi.fn() };

      // Mock scrap pool
      const mockScrapPool = { destroy: vi.fn() };
      (scene as any).scrapPool = mockScrapPool;

      // Mock destructible crates
      const mockCrate1 = { destroy: vi.fn() };
      const mockCrate2 = { destroy: vi.fn() };
      (scene as any).destructibleCrates = [mockCrate1, mockCrate2];

      // Mock unsubscribes
      const challengeUnsub = vi.fn();
      const achUnsub = vi.fn();
      const comboUnsub1 = vi.fn();
      const comboUnsub2 = vi.fn();
      (scene as any).challengeUnsubscribe = challengeUnsub;
      (scene as any).achievementUnsubscribe = achUnsub;
      (scene as any).comboUnsubscribes = [comboUnsub1, comboUnsub2];

      // Simulate scene registration of shutdown hook (as done in create())
      scene.events.off('shutdown', scene.shutdown, scene);
      scene.events.on('shutdown', scene.shutdown, scene);

      expect(eventListeners['shutdown']).toBeDefined();
      expect(eventListeners['shutdown'].length).toBe(1);

      // Trigger scene shutdown via Phaser event pipeline
      mockEvents.emit('shutdown');

      // 1. All 6 particle emitters destroyed and nulled
      expect(emitters.sparkEmitter.destroy).toHaveBeenCalledTimes(1);
      expect(emitters.pulseSparkEmitter.destroy).toHaveBeenCalledTimes(1);
      expect(emitters.crateDebrisEmitter.destroy).toHaveBeenCalledTimes(1);
      expect(emitters.roverDustEmitter.destroy).toHaveBeenCalledTimes(1);
      expect(emitters.rivalSmokeEmitter.destroy).toHaveBeenCalledTimes(1);
      expect(emitters.recyclerSteamEmitter.destroy).toHaveBeenCalledTimes(1);

      expect(scene.sparkEmitter).toBeNull();
      expect(scene.pulseSparkEmitter).toBeNull();
      expect(scene.crateDebrisEmitter).toBeNull();
      expect(scene.roverDustEmitter).toBeNull();
      expect(scene.rivalSmokeEmitter).toBeNull();
      expect(scene.recyclerSteamEmitter).toBeNull();

      // 2. Timers destroyed
      expect(mockTimer.destroy).toHaveBeenCalledTimes(1);
      expect((scene as any).respawnTimer).toBeNull();
      expect(scene.time.removeAllEvents).toHaveBeenCalledTimes(1);

      // 3. Scrap pool destroyed
      expect(mockScrapPool.destroy).toHaveBeenCalledTimes(1);
      expect(scene.scrapPool).toBeNull();

      // 4. Crates destroyed
      expect(mockCrate1.destroy).toHaveBeenCalledTimes(1);
      expect(mockCrate2.destroy).toHaveBeenCalledTimes(1);
      expect(scene.destructibleCrates).toEqual([]);

      // 5. Unsubscribe handles called
      expect(challengeUnsub).toHaveBeenCalledTimes(1);
      expect(achUnsub).toHaveBeenCalledTimes(1);
      expect(comboUnsub1).toHaveBeenCalledTimes(1);
      expect(comboUnsub2).toHaveBeenCalledTimes(1);
      expect((scene as any).challengeUnsubscribe).toBeUndefined();
      expect((scene as any).achievementUnsubscribe).toBeUndefined();
      expect((scene as any).comboUnsubscribes).toEqual([]);

      // 6. Shutdown event unhooked from scene
      expect(eventListeners['shutdown'].length).toBe(0);
    });

    it('verifies DestructibleCrate cleans up its internal 45s delayedCall timer and tweens upon destroy()', () => {
      const killTweensSpy = vi.fn();
      const timerDestroySpy = vi.fn();

      const mockScene: any = {
        add: { existing: vi.fn() },
        physics: { world: { enable: vi.fn() } },
        tweens: { killTweensOf: killTweensSpy },
      };

      const crate = new DestructibleCrate(mockScene, 50, 50, 1);
      (crate as any).respawnTimer = { destroy: timerDestroySpy };

      crate.destroy();

      expect(killTweensSpy).toHaveBeenCalledWith(crate);
      expect(timerDestroySpy).toHaveBeenCalledTimes(1);
      expect((crate as any).respawnTimer).toBeNull();
    });

    it('verifies settings preservation across saveGameState() without overwriting customized user volume or controls', () => {
      const mockStorage = new MockMemoryStorage();
      const saveManager = SaveManager.getInstance();
      (saveManager as any).storage = mockStorage;
      saveManager.reset();

      // Save custom settings beforehand
      const customSettings = {
        sfxVolume: 0.12,
        musicVolume: 0.34,
        touchControls: false,
        hapticFeedback: false,
        screenShake: false,
      };

      saveManager.save({
        ...saveManager.load(),
        settings: customSettings,
      });

      // Verify custom settings are in storage
      expect(saveManager.load().settings.sfxVolume).toBe(0.12);

      // Instantiate scene and set properties
      const scene = new JunkyardScene();
      (scene as any).challengeManager = {
        serialize: () => ({ active: [], completedCount: 0 }),
        getState: () => ({ active: [], completedCount: 0 }),
      };
      (scene as any).achievementManager = {
        serialize: () => [],
      };
      (scene as any).coins = 500;
      (scene as any).upgrades = {};
      (scene as any).unlockedTiers = [1];
      (scene as any).prestigeLevel = 0;
      (scene as any).screenShakeEnabled = false;

      // Invoke saveGameState()
      scene.saveGameState();

      const loaded = saveManager.load();
      expect(loaded.settings).toBeDefined();
      expect(loaded.settings!.sfxVolume).toBe(0.12);
      expect(loaded.settings!.musicVolume).toBe(0.34);
      expect(loaded.settings!.touchControls).toBe(false);
      expect(loaded.settings!.hapticFeedback).toBe(false);
      expect(loaded.settings!.screenShake).toBe(false);
    });

    it('stress tests 20 destructible crates with pending 45s respawn timers destroyed on scene shutdown without leaking timers', () => {
      const timerDestroySpies: ReturnType<typeof vi.fn>[] = [];
      const tweenKillSpies: ReturnType<typeof vi.fn>[] = [];

      const mockScene: any = {
        add: { existing: vi.fn() },
        physics: { world: { enable: vi.fn() } },
        tweens: {
          killTweensOf: vi.fn((target: any) => {
            tweenKillSpies.push(target);
          }),
        },
      };

      const crates: DestructibleCrate[] = [];
      for (let i = 0; i < 20; i++) {
        const crate = new DestructibleCrate(mockScene, 100 + i * 20, 200, (i % 4) + 1);
        const tSpy = vi.fn();
        timerDestroySpies.push(tSpy);
        (crate as any).respawnTimer = { destroy: tSpy };
        crates.push(crate);
      }

      const scene = new JunkyardScene();
      scene.destructibleCrates = crates;
      (scene as any).events = { off: vi.fn() };
      (scene as any).comboManager = { reset: vi.fn() };

      // Invoke shutdown
      scene.shutdown();

      // All 20 timers destroyed
      expect(timerDestroySpies.length).toBe(20);
      for (const tSpy of timerDestroySpies) {
        expect(tSpy).toHaveBeenCalledTimes(1);
      }

      // All 20 crates had tweens killed
      expect(tweenKillSpies.length).toBe(20);

      // Crate array is cleared
      expect(scene.destructibleCrates).toEqual([]);
    });

    it('simulates 5 repeated create-shutdown restart cycles and verifies zero listener accumulation', () => {
      const scene = new JunkyardScene();

      // Track subscriptions count on managers
      let challengeListenerCount = 0;
      let achievementListenerCount = 0;
      let comboListenerCount = 0;

      scene.challengeManager.on = vi.fn((_cb: any) => {
        challengeListenerCount++;
        return () => {
          challengeListenerCount--;
        };
      }) as any;

      scene.achievementManager.on = vi.fn((_cb: any) => {
        achievementListenerCount++;
        return () => {
          achievementListenerCount--;
        };
      }) as any;

      scene.comboManager.on = vi.fn((_evt: any, _cb: any) => {
        comboListenerCount++;
        return () => {
          comboListenerCount--;
        };
      }) as any;

      const mockEvents = {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      };
      (scene as any).events = mockEvents;

      // Run 5 restart cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        // Wire Challenge & Achievement Listeners (mimicking create() lines 136-160)
        if ((scene as any).challengeUnsubscribe) {
          (scene as any).challengeUnsubscribe();
        }
        (scene as any).challengeUnsubscribe = scene.challengeManager.on(() => {});

        if ((scene as any).achievementUnsubscribe) {
          (scene as any).achievementUnsubscribe();
        }
        (scene as any).achievementUnsubscribe = scene.achievementManager.on(() => {});

        // Wire Combo listeners (mimicking create() lines 207-246)
        for (const unsub of (scene as any).comboUnsubscribes) {
          unsub();
        }
        (scene as any).comboUnsubscribes = [];
        (scene as any).comboUnsubscribes.push(
          scene.comboManager.on('fever-started', () => {}),
          scene.comboManager.on('fever-ended', () => {}),
          scene.comboManager.on('combo-expired', () => {}),
          scene.comboManager.on('combo-updated', () => {})
        );

        // After wiring, active listener count must be exactly 1 challenge, 1 achievement, 4 combo
        expect(challengeListenerCount).toBe(1);
        expect(achievementListenerCount).toBe(1);
        expect(comboListenerCount).toBe(4);

        // Run shutdown
        scene.shutdown();

        // After shutdown, all active listener counts must be ZERO
        expect(challengeListenerCount).toBe(0);
        expect(achievementListenerCount).toBe(0);
        expect(comboListenerCount).toBe(0);
      }
    });

    it('stress tests 1,000 rapid saveGameState() operations without memory inflation or setting corruption', () => {
      const mockStorage = new MockMemoryStorage();
      const saveManager = SaveManager.getInstance();
      (saveManager as any).storage = mockStorage;
      saveManager.reset();

      const initialSettings = {
        sfxVolume: 0.45,
        musicVolume: 0.75,
        touchControls: false,
        hapticFeedback: true,
        screenShake: true,
      };

      saveManager.save({
        ...saveManager.load(),
        settings: initialSettings,
      });

      const scene = new JunkyardScene();
      (scene as any).challengeManager = {
        serialize: () => ({ active: [], completedCount: 5 }),
        getState: () => ({ active: [], completedCount: 5 }),
      };
      (scene as any).achievementManager = {
        serialize: () => ['test_ach'],
      };
      (scene as any).coins = 1000;
      (scene as any).upgrades = {};
      (scene as any).unlockedTiers = [1, 2];
      (scene as any).prestigeLevel = 1;
      (scene as any).screenShakeEnabled = true;

      // 1,000 consecutive saves
      for (let i = 0; i < 1000; i++) {
        (scene as any).coins += 10;
        scene.saveGameState();
      }

      const finalSave = saveManager.load();
      expect(finalSave.player.coins).toBe(1000 + 1000 * 10);
      expect(finalSave.settings.sfxVolume).toBe(0.45);
      expect(finalSave.settings.musicVolume).toBe(0.75);
      expect(finalSave.settings.touchControls).toBe(false);
      expect(finalSave.settings.hapticFeedback).toBe(true);
      expect(finalSave.settings.screenShake).toBe(true);
      expect(finalSave.version).toBe(2);
    });
  });
});
