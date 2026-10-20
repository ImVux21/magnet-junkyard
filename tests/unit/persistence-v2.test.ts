// ============================================================================
// Magnet Junkyard - SaveManager Schema v2 & Offline Earnings Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager, STORAGE_KEY_V1, STORAGE_KEY_V2 } from '../../src/services/persistence/SaveManager';

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

describe('Persistence System — Schema v2 & Migration', () => {
  let storage: MockMemoryStorage;
  let saveManager: SaveManager;

  beforeEach(() => {
    storage = new MockMemoryStorage();
    saveManager = new SaveManager(storage);
  });

  it('initializes fresh save data with Schema Version 2 and defaults', () => {
    const data = saveManager.load();
    expect(data.version).toBe(2);
    expect(data.player.coins).toBe(0);
    expect(data.player.prestigeLevel).toBe(0);
    expect(data.challenges.activeChallengeId).toBe('speed_recycler');
    expect(data.achievements.unlocked).toEqual([]);
  });

  it('seamlessly migrates legacy v1 save data to v2 preserving player wealth & progress', () => {
    // Populate legacy v1 save in storage
    const v1Data = {
      version: 1,
      timestamp: 100000,
      player: {
        coins: 14500,
        upgrades: { magnetRange: 4, attractPower: 3, carryCapacity: 5, movementSpeed: 2 },
        unlockedTiers: [1, 2, 3],
      },
      stats: {
        totalScrapCollected: 120,
        totalCoinsEarned: 14500,
        totalRecycledRuns: 25,
        playTimeSeconds: 600,
        adRewardsClaimed: 2,
      },
      settings: {
        sfxVolume: 0.9,
        musicVolume: 0.5,
        touchControls: true,
        hapticFeedback: false,
      },
    };
    storage.setItem(STORAGE_KEY_V1, JSON.stringify(v1Data));

    // Load triggers automated migration
    const migrated = saveManager.load();
    expect(migrated.version).toBe(2);
    expect(migrated.player.coins).toBe(14500);
    expect(migrated.player.upgrades.carryCapacity).toBe(5);
    expect(migrated.player.unlockedTiers).toEqual([1, 2, 3]);
    expect(migrated.player.prestigeLevel).toBe(0);
    expect(migrated.challenges.activeChallengeId).toBe('speed_recycler');
    expect(migrated.achievements.unlocked).toEqual([]);
    expect(migrated.settings.sfxVolume).toBe(0.9);

    // Verifies it persisted into v2 key
    expect(storage.getItem(STORAGE_KEY_V2)).not.toBeNull();
  });
});

describe('Retention System — Offline Earnings Calculation (D1 Driver)', () => {
  let storage: MockMemoryStorage;
  let saveManager: SaveManager;

  beforeEach(() => {
    storage = new MockMemoryStorage();
    saveManager = new SaveManager(storage);
  });

  it('yields 0 offline coins if away for under 2 minutes', () => {
    const now = 500000;
    saveManager.save({
      ...saveManager.load(),
      timestamp: now - 60 * 1000, // 1 min ago
    });

    const earnings = saveManager.calculateOfflineEarnings(now);
    expect(earnings.offlineCoins).toBe(0);
    expect(earnings.elapsedMinutes).toBe(0);
  });

  it('calculates passive coin rewards for 60 minutes away (3 coins/min base)', () => {
    const now = 500000;
    const save = saveManager.load();
    save.timestamp = now - 60 * 60 * 1000; // 60 mins ago
    save.player.prestigeLevel = 0;
    saveManager.save(save);

    const earnings = saveManager.calculateOfflineEarnings(now);
    expect(earnings.elapsedMinutes).toBe(60);
    // 60 mins * 3 coins/min * 1.0 = 180 coins
    expect(earnings.offlineCoins).toBe(180);
  });

  it('scales offline earnings with prestige multiplier', () => {
    const now = 500000;
    const save = saveManager.load();
    save.timestamp = now - 60 * 60 * 1000; // 60 mins ago
    save.player.prestigeLevel = 2; // +30% bonus (1.30x)
    saveManager.save(save);

    const earnings = saveManager.calculateOfflineEarnings(now);
    expect(earnings.elapsedMinutes).toBe(60);
    // 60 * 3 * (1 + 0.15 * 2) = 180 * 1.30 = 234 coins
    expect(earnings.offlineCoins).toBe(234);
  });

  it('caps offline earnings at 8 hours (480 minutes)', () => {
    const now = 50000000;
    const save = saveManager.load();
    save.timestamp = now - 24 * 60 * 60 * 1000; // 24 hours ago (exceeds 8h cap)
    save.player.prestigeLevel = 0;
    saveManager.save(save);

    const earnings = saveManager.calculateOfflineEarnings(now);
    expect(earnings.elapsedMinutes).toBe(480); // Capped at 480 mins
    expect(earnings.offlineCoins).toBe(480 * 3); // 1,440 coins
  });
});
