import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '../../src/services/persistence/SaveManager';

describe('Tutorial System — Onboarding State & Flow Logic', () => {
  let mockStorage: Record<string, string>;
  let saveManager: SaveManager;

  beforeEach(() => {
    mockStorage = {};
    const storageShim = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
    saveManager = new SaveManager(storageShim);
  });

  it('initializes tutorialCompleted as false by default for new players', () => {
    const data = saveManager.load();
    expect(data.settings.tutorialCompleted).toBe(false);
  });

  it('persists tutorialCompleted status when player finishes or skips tutorial', () => {
    const data = saveManager.load();
    data.settings.tutorialCompleted = true;
    saveManager.save(data);

    const reloaded = saveManager.load();
    expect(reloaded.settings.tutorialCompleted).toBe(true);
  });

  it('retains tutorialCompleted true across schema migration', () => {
    const rawV2 = {
      version: 2,
      timestamp: Date.now(),
      player: {
        coins: 100,
        upgrades: { magnetRange: 1, attractPower: 1, carryCapacity: 1, movementSpeed: 1 },
        unlockedTiers: [1],
        prestigeLevel: 0,
      },
      challenges: { activeChallengeId: 'speed_recycler', progress: 0, completedCount: 0 },
      achievements: { unlocked: [] },
      stats: {
        totalScrapCollected: 10,
        totalCoinsEarned: 100,
        totalRecycledRuns: 1,
        playTimeSeconds: 60,
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
        screenShake: true,
        tutorialCompleted: true,
      },
    };

    const migrated = saveManager.migrate(rawV2);
    expect(migrated.settings.tutorialCompleted).toBe(true);
  });
});
