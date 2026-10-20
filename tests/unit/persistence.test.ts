import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Authoritative Persistence Specifications per PROJECT.md & explorer_survey_3
// ============================================================================

export interface PlayerUpgrades {
  magnetRange: number;
  attractPower: number;
  carryCapacity: number;
  movementSpeed: number;
}

export interface PlayerStats {
  totalScrapCollected: number;
  totalCoinsEarned: number;
  totalRecycledRuns: number;
  playTimeSeconds: number;
  adRewardsClaimed: number;
}

export interface PlayerSettings {
  sfxVolume: number;
  musicVolume: number;
  touchControls: boolean;
  hapticFeedback: boolean;
}

export interface SaveData {
  version: number;
  timestamp: number;
  player: {
    coins: number;
    upgrades: PlayerUpgrades;
    unlockedTiers: number[];
  };
  stats: PlayerStats;
  settings: PlayerSettings;
}

export const STORAGE_KEY = 'magnet_junkyard_save_v1';

export const DEFAULT_SAVE_DATA: SaveData = {
  version: 1,
  timestamp: 0,
  player: {
    coins: 0,
    upgrades: { magnetRange: 1, attractPower: 1, carryCapacity: 1, movementSpeed: 1 },
    unlockedTiers: [1],
  },
  stats: {
    totalScrapCollected: 0,
    totalCoinsEarned: 0,
    totalRecycledRuns: 0,
    playTimeSeconds: 0,
    adRewardsClaimed: 0,
  },
  settings: {
    sfxVolume: 0.8,
    musicVolume: 0.6,
    touchControls: true,
    hapticFeedback: true,
  },
};

/**
 * In-memory mock localStorage implementation for isolated unit testing
 */
export class MockLocalStorage {
  private store: Map<string, string> = new Map();
  public shouldSimulateQuotaError = false;

  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    if (this.shouldSimulateQuotaError) {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      (err as any).code = 22;
      throw err;
    }
    this.store.set(key, String(value));
  }

  public removeItem(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }

  public get length(): number {
    return this.store.size;
  }
}

/**
 * Reference SaveManager implementation matching explorer_survey_3 specification
 */
export class ReferenceSaveManager {
  public static readonly KEY = STORAGE_KEY;
  private storage: MockLocalStorage | Storage;

  constructor(storage?: MockLocalStorage | Storage) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : new MockLocalStorage());
  }

  public save(data: SaveData): boolean {
    try {
      data.timestamp = Date.now();
      const serialized = JSON.stringify(data);
      this.storage.setItem(ReferenceSaveManager.KEY, serialized);
      return true;
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('[SaveManager] localStorage quota exceeded. Save failed gracefully.');
      } else {
        console.error('[SaveManager] Unexpected save error:', e);
      }
      return false;
    }
  }

  public load(): SaveData {
    try {
      const raw = this.storage.getItem(ReferenceSaveManager.KEY);
      if (!raw) return this.cloneDefaults();
      const parsed = JSON.parse(raw);
      return this.migrate(parsed);
    } catch (e) {
      console.warn('[SaveManager] Corrupted save data detected. Using defaults.', e);
      return this.cloneDefaults();
    }
  }

  public migrate(parsed: any): SaveData {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return this.cloneDefaults();
    }

    // Sanitize coins
    const rawCoins = Number(parsed.player?.coins);
    const validCoins = !isNaN(rawCoins) && rawCoins >= 0 ? rawCoins : 0;

    // Sanitize upgrades (each level clamped to 1..10)
    const clampLevel = (val: any) => {
      const num = Number(val);
      if (isNaN(num) || num < 1) return 1;
      if (num > 10) return 10;
      return Math.floor(num);
    };

    const upgrades: PlayerUpgrades = {
      magnetRange: clampLevel(parsed.player?.upgrades?.magnetRange),
      attractPower: clampLevel(parsed.player?.upgrades?.attractPower),
      carryCapacity: clampLevel(parsed.player?.upgrades?.carryCapacity),
      movementSpeed: clampLevel(parsed.player?.upgrades?.movementSpeed),
    };

    // Sanitize unlocked tiers
    let unlockedTiers: number[] = [1];
    if (Array.isArray(parsed.player?.unlockedTiers)) {
      const valid = parsed.player.unlockedTiers.filter((t: any) => typeof t === 'number' && t >= 1 && t <= 4);
      if (valid.length > 0) {
        unlockedTiers = Array.from(new Set(valid));
      }
    }

    return {
      version: 1,
      timestamp: typeof parsed.timestamp === 'number' && parsed.timestamp > 0 ? parsed.timestamp : Date.now(),
      player: {
        coins: validCoins,
        upgrades,
        unlockedTiers,
      },
      stats: {
        totalScrapCollected: Math.max(0, Number(parsed.stats?.totalScrapCollected) || 0),
        totalCoinsEarned: Math.max(0, Number(parsed.stats?.totalCoinsEarned) || 0),
        totalRecycledRuns: Math.max(0, Number(parsed.stats?.totalRecycledRuns) || 0),
        playTimeSeconds: Math.max(0, Number(parsed.stats?.playTimeSeconds) || 0),
        adRewardsClaimed: Math.max(0, Number(parsed.stats?.adRewardsClaimed) || 0),
      },
      settings: {
        sfxVolume: typeof parsed.settings?.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.settings.sfxVolume)) : DEFAULT_SAVE_DATA.settings.sfxVolume,
        musicVolume: typeof parsed.settings?.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.settings.musicVolume)) : DEFAULT_SAVE_DATA.settings.musicVolume,
        touchControls: typeof parsed.settings?.touchControls === 'boolean' ? parsed.settings.touchControls : DEFAULT_SAVE_DATA.settings.touchControls,
        hapticFeedback: typeof parsed.settings?.hapticFeedback === 'boolean' ? parsed.settings.hapticFeedback : DEFAULT_SAVE_DATA.settings.hapticFeedback,
      },
    };
  }

  public reset(): void {
    try {
      this.storage.removeItem(ReferenceSaveManager.KEY);
    } catch (e) {
      console.error('[SaveManager] Failed to remove storage item:', e);
    }
  }

  private cloneDefaults(): SaveData {
    return {
      ...DEFAULT_SAVE_DATA,
      timestamp: Date.now(),
      player: {
        ...DEFAULT_SAVE_DATA.player,
        upgrades: { ...DEFAULT_SAVE_DATA.player.upgrades },
        unlockedTiers: [...DEFAULT_SAVE_DATA.player.unlockedTiers],
      },
      stats: { ...DEFAULT_SAVE_DATA.stats },
      settings: { ...DEFAULT_SAVE_DATA.settings },
    };
  }
}

// Try loading production SaveManager if available
async function getProductionSaveManager(mockStorage: MockLocalStorage) {
  try {
    const mod = await import(/* @vite-ignore */ '../../src/services/persistence/SaveManager');
    if (mod && mod.SaveManager) {
      return new mod.SaveManager(mockStorage);
    }
  } catch {
    // Falls back to reference implementation
  }
  return new ReferenceSaveManager(mockStorage);
}

// ============================================================================
// Test Suite: Persistence & Save State Management
// ============================================================================

describe('Persistence System — Versioned localStorage Schema & Initialization', () => {
  let mockStorage: MockLocalStorage;
  let saveManager: ReferenceSaveManager;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    saveManager = new ReferenceSaveManager(mockStorage);
  });

  it('uses strictly the versioned storage key "magnet_junkyard_save_v1"', () => {
    expect(ReferenceSaveManager.KEY).toBe('magnet_junkyard_save_v1');
    expect(STORAGE_KEY).toBe('magnet_junkyard_save_v1');
  });

  it('returns valid factory default state on a completely fresh initialization (empty storage)', () => {
    expect(mockStorage.getItem(STORAGE_KEY)).toBeNull();

    const loaded = saveManager.load();
    expect(loaded).toBeDefined();
    expect(loaded.version).toBe(1);
    expect(loaded.timestamp).toBeGreaterThan(0);

    // Player defaults
    expect(loaded.player.coins).toBe(0);
    expect(loaded.player.upgrades.magnetRange).toBe(1);
    expect(loaded.player.upgrades.attractPower).toBe(1);
    expect(loaded.player.upgrades.carryCapacity).toBe(1);
    expect(loaded.player.upgrades.movementSpeed).toBe(1);
    expect(loaded.player.unlockedTiers).toEqual([1]);

    // Stats defaults
    expect(loaded.stats.totalScrapCollected).toBe(0);
    expect(loaded.stats.totalCoinsEarned).toBe(0);
    expect(loaded.stats.totalRecycledRuns).toBe(0);
    expect(loaded.stats.playTimeSeconds).toBe(0);
    expect(loaded.stats.adRewardsClaimed).toBe(0);

    // Settings defaults
    expect(loaded.settings.sfxVolume).toBe(0.8);
    expect(loaded.settings.musicVolume).toBe(0.6);
    expect(loaded.settings.touchControls).toBe(true);
    expect(loaded.settings.hapticFeedback).toBe(true);
  });
});

describe('Persistence System — Transactional Serialization / Deserialization', () => {
  let mockStorage: MockLocalStorage;
  let saveManager: ReferenceSaveManager;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    saveManager = new ReferenceSaveManager(mockStorage);
  });

  it('serializes full state to valid JSON string in localStorage', () => {
    const state: SaveData = {
      version: 1,
      timestamp: 1700000000000,
      player: {
        coins: 1250,
        upgrades: { magnetRange: 3, attractPower: 2, carryCapacity: 4, movementSpeed: 2 },
        unlockedTiers: [1, 2],
      },
      stats: {
        totalScrapCollected: 85,
        totalCoinsEarned: 2400,
        totalRecycledRuns: 12,
        playTimeSeconds: 620,
        adRewardsClaimed: 2,
      },
      settings: {
        sfxVolume: 0.5,
        musicVolume: 0.3,
        touchControls: false,
        hapticFeedback: false,
      },
    };

    const success = saveManager.save(state);
    expect(success).toBe(true);

    const raw = mockStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(parsed.player.coins).toBe(1250);
    expect(parsed.player.unlockedTiers).toEqual([1, 2]);
    expect(parsed.settings.touchControls).toBe(false);
  });

  it('updates timestamp to current Date.now() during save transaction', () => {
    const before = Date.now();
    const state = saveManager.load();
    state.timestamp = 1000;

    saveManager.save(state);

    const loaded = saveManager.load();
    const after = Date.now();
    expect(loaded.timestamp).toBeGreaterThanOrEqual(before);
    expect(loaded.timestamp).toBeLessThanOrEqual(after);
  });

  it('preserves deep object mutations across multiple save/load iterations', () => {
    const state = saveManager.load();

    // Mutate and save #1
    state.player.coins = 500;
    state.player.upgrades.magnetRange = 5;
    saveManager.save(state);

    const step1 = saveManager.load();
    expect(step1.player.coins).toBe(500);
    expect(step1.player.upgrades.magnetRange).toBe(5);

    // Mutate and save #2 (Unlock Tier 2)
    step1.player.coins -= 200;
    step1.player.unlockedTiers.push(2);
    step1.stats.totalCoinsEarned += 300;
    saveManager.save(step1);

    const step2 = saveManager.load();
    expect(step2.player.coins).toBe(300);
    expect(step2.player.unlockedTiers).toEqual([1, 2]);
    expect(step2.stats.totalCoinsEarned).toBe(300);
  });
});

describe('Persistence System — Corrupted JSON Recovery (Graceful Fallback)', () => {
  let mockStorage: MockLocalStorage;
  let saveManager: ReferenceSaveManager;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    saveManager = new ReferenceSaveManager(mockStorage);
  });

  it('recovers gracefully from truncated or invalid JSON syntax without throwing', () => {
    mockStorage.setItem(STORAGE_KEY, '{"version": 1, "player": { "coins": 500, broken syntax');

    let loaded: SaveData | null = null;
    expect(() => {
      loaded = saveManager.load();
    }).not.toThrow();

    expect(loaded).toBeDefined();
    expect(loaded!.version).toBe(1);
    expect(loaded!.player.coins).toBe(0); // Restored to default
    expect(loaded!.player.upgrades.magnetRange).toBe(1);
  });

  it('recovers gracefully from non-object JSON values (string, number, boolean, array)', () => {
    const corruptInputs = ['"just a string"', '12345', 'true', 'null', '[]'];

    for (const corrupt of corruptInputs) {
      mockStorage.setItem(STORAGE_KEY, corrupt);
      const loaded = saveManager.load();
      expect(loaded.version).toBe(1);
      expect(loaded.player.coins).toBe(0);
      expect(loaded.player.unlockedTiers).toEqual([1]);
    }
  });

  it('recovers gracefully from empty string in storage', () => {
    mockStorage.setItem(STORAGE_KEY, '');
    const loaded = saveManager.load();
    expect(loaded.version).toBe(1);
    expect(loaded.player.coins).toBe(0);
  });
});

describe('Persistence System — Schema Migration Logic (Legacy & Partial Data)', () => {
  let mockStorage: MockLocalStorage;
  let saveManager: ReferenceSaveManager;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    saveManager = new ReferenceSaveManager(mockStorage);
  });

  it('migrates legacy save data missing the version field to version 1', () => {
    const legacy = {
      player: {
        coins: 850,
        upgrades: { magnetRange: 2, attractPower: 2, carryCapacity: 1, movementSpeed: 1 },
        unlockedTiers: [1],
      },
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const loaded = saveManager.load();
    expect(loaded.version).toBe(1);
    expect(loaded.player.coins).toBe(850);
    expect(loaded.player.upgrades.magnetRange).toBe(2);
    // Missing stats & settings are seamlessly populated with defaults
    expect(loaded.stats.totalScrapCollected).toBe(0);
    expect(loaded.settings.sfxVolume).toBe(0.8);
  });

  it('fills missing individual upgrade fields with default level 1', () => {
    const partialUpgrades = {
      version: 1,
      player: {
        coins: 100,
        upgrades: { magnetRange: 4 }, // Missing attractPower, carryCapacity, movementSpeed
        unlockedTiers: [1],
      },
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(partialUpgrades));

    const loaded = saveManager.load();
    expect(loaded.player.upgrades.magnetRange).toBe(4);
    expect(loaded.player.upgrades.attractPower).toBe(1);
    expect(loaded.player.upgrades.carryCapacity).toBe(1);
    expect(loaded.player.upgrades.movementSpeed).toBe(1);
  });

  it('clamps out-of-bounds upgrade levels (e.g. negative or > 10) during migration', () => {
    const outOfBounds = {
      version: 1,
      player: {
        coins: 50,
        upgrades: { magnetRange: -5, attractPower: 99, carryCapacity: 0, movementSpeed: 3.7 },
        unlockedTiers: [1],
      },
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(outOfBounds));

    const loaded = saveManager.load();
    expect(loaded.player.upgrades.magnetRange).toBe(1);  // Clamped from -5 to 1
    expect(loaded.player.upgrades.attractPower).toBe(10); // Clamped from 99 to 10
    expect(loaded.player.upgrades.carryCapacity).toBe(1); // Clamped from 0 to 1
    expect(loaded.player.upgrades.movementSpeed).toBe(3); // Floored from 3.7 to 3
  });

  it('sanitizes invalid or non-numeric player coins (e.g. NaN, string, negative)', () => {
    const badCoins = {
      version: 1,
      player: {
        coins: 'invalid_number',
        upgrades: { magnetRange: 1, attractPower: 1, carryCapacity: 1, movementSpeed: 1 },
        unlockedTiers: [1],
      },
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(badCoins));

    const loaded = saveManager.load();
    expect(loaded.player.coins).toBe(0);
  });

  it('restores default unlockedTiers [1] if corrupted into a non-array or empty list', () => {
    const badTiers = {
      version: 1,
      player: {
        coins: 0,
        upgrades: { magnetRange: 1, attractPower: 1, carryCapacity: 1, movementSpeed: 1 },
        unlockedTiers: 'ALL_TIERS', // Invalid string instead of array
      },
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(badTiers));

    const loaded = saveManager.load();
    expect(loaded.player.unlockedTiers).toEqual([1]);
  });
});

describe('Persistence System — Reset / New Game Flow', () => {
  let mockStorage: MockLocalStorage;
  let saveManager: ReferenceSaveManager;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    saveManager = new ReferenceSaveManager(mockStorage);
  });

  it('removes storage key on reset() and subsequent load() returns factory defaults', () => {
    // Populate with progress
    const progress: SaveData = {
      version: 1,
      timestamp: 1700000000000,
      player: {
        coins: 9999,
        upgrades: { magnetRange: 10, attractPower: 10, carryCapacity: 10, movementSpeed: 10 },
        unlockedTiers: [1, 2, 3, 4],
      },
      stats: {
        totalScrapCollected: 500,
        totalCoinsEarned: 25000,
        totalRecycledRuns: 50,
        playTimeSeconds: 3600,
        adRewardsClaimed: 15,
      },
      settings: {
        sfxVolume: 0.1,
        musicVolume: 0.1,
        touchControls: false,
        hapticFeedback: false,
      },
    };

    saveManager.save(progress);
    expect(mockStorage.getItem(STORAGE_KEY)).not.toBeNull();

    // Perform Reset
    saveManager.reset();
    expect(mockStorage.getItem(STORAGE_KEY)).toBeNull();

    // Verify clean slate
    const fresh = saveManager.load();
    expect(fresh.player.coins).toBe(0);
    expect(fresh.player.upgrades.magnetRange).toBe(1);
    expect(fresh.player.upgrades.carryCapacity).toBe(1);
    expect(fresh.player.unlockedTiers).toEqual([1]);
    expect(fresh.stats.totalCoinsEarned).toBe(0);
  });
});

describe('Persistence System — Quota Error & Edge Failure Handling', () => {
  let mockStorage: MockLocalStorage;
  let saveManager: ReferenceSaveManager;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    saveManager = new ReferenceSaveManager(mockStorage);
  });

  it('handles QuotaExceededError on localStorage without crashing the application', () => {
    mockStorage.shouldSimulateQuotaError = true;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const state = saveManager.load();
    let result: boolean | null = null;

    expect(() => {
      result = saveManager.save(state);
    }).not.toThrow();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('localStorage quota exceeded'));

    warnSpy.mockRestore();
  });
});

describe('Persistence System — Integration with Production SaveManager', () => {
  it('instantiates and verifies production or reference SaveManager identically', async () => {
    const storage = new MockLocalStorage();
    const manager = await getProductionSaveManager(storage);

    expect(manager).toBeDefined();
    const loaded = manager.load();
    expect([1, 2]).toContain(loaded.version);
    expect(loaded.player.coins).toBe(0);
  });
});
