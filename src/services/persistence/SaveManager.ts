// ============================================================================
// Magnet Junkyard - SaveManager (Schema v2 Migration & Offline Earnings)
// ============================================================================

export interface PlayerUpgrades {
  magnetRange: number;
  attractPower: number;
  carryCapacity: number;
  movementSpeed: number;
}

export interface PlayerStatsV2 {
  totalScrapCollected: number;
  totalCoinsEarned: number;
  totalRecycledRuns: number;
  playTimeSeconds: number;
  adRewardsClaimed: number;
  totalPrestiges: number;
  totalChallengesCompleted: number;
  goldenScrapCollected: number;
  crittersRepelled: number;
  empMineHits: number;
}

export interface PlayerSettings {
  sfxVolume: number;
  musicVolume: number;
  touchControls: boolean;
  hapticFeedback: boolean;
  screenShake: boolean;
  tutorialCompleted?: boolean;
}

export interface SaveDataV2 {
  version: 2;
  timestamp: number;
  player: {
    coins: number;
    upgrades: PlayerUpgrades;
    unlockedTiers: number[];
    prestigeLevel: number;
    prestigeTokens?: number;
    prestigePerks?: Record<string, number>;
    clearedZoneMilestones?: number[];
  };
  challenges: {
    activeChallengeId: string;
    progress: number;
    completedCount: number;
  };
  achievements: {
    unlocked: string[];
  };
  stats: PlayerStatsV2;
  settings: PlayerSettings;
}

export const STORAGE_KEY_V1 = 'magnet_junkyard_save_v1';
export const STORAGE_KEY_V2 = 'magnet_junkyard_save_v2';

export const DEFAULT_SAVE_DATA_V2: SaveDataV2 = {
  version: 2,
  timestamp: 0,
  player: {
    coins: 0,
    upgrades: { magnetRange: 1, attractPower: 1, carryCapacity: 1, movementSpeed: 1 },
    unlockedTiers: [1],
    prestigeLevel: 0,
    prestigeTokens: 0,
    prestigePerks: {},
    clearedZoneMilestones: [],
  },
  challenges: {
    activeChallengeId: 'speed_recycler',
    progress: 0,
    completedCount: 0,
  },
  achievements: {
    unlocked: [],
  },
  stats: {
    totalScrapCollected: 0,
    totalCoinsEarned: 0,
    totalRecycledRuns: 0,
    playTimeSeconds: 0,
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
    tutorialCompleted: false,
  },
};

export class SaveManager {
  public static readonly KEY = STORAGE_KEY_V2;
  private storage: Storage | any;
  private static instance: SaveManager | null = null;

  constructor(storage?: any) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  }

  public static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  public save(data: SaveDataV2): boolean {
    if (!this.storage) return false;
    try {
      data.version = 2;
      data.timestamp = data.timestamp || Date.now();
      const serialized = JSON.stringify(data);
      this.storage.setItem(SaveManager.KEY, serialized);
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

  public load(): SaveDataV2 {
    if (!this.storage) return this.cloneDefaults();
    try {
      // 1. Try loading v2
      let raw = this.storage.getItem(STORAGE_KEY_V2);
      if (raw) {
        const parsed = JSON.parse(raw);
        return this.migrate(parsed);
      }

      // 2. Fallback to v1 migration
      raw = this.storage.getItem(STORAGE_KEY_V1);
      if (raw) {
        const parsedV1 = JSON.parse(raw);
        const migrated = this.migrate(parsedV1);
        // Persist v2 immediately
        this.save(migrated);
        return migrated;
      }

      return this.cloneDefaults();
    } catch (e) {
      console.warn('[SaveManager] Corrupted save data detected. Using defaults.', e);
      return this.cloneDefaults();
    }
  }

  public migrate(parsed: any): SaveDataV2 {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return this.cloneDefaults();
    }

    const validCoins =
      typeof parsed.player?.coins === 'number' && !isNaN(parsed.player.coins) && parsed.player.coins >= 0
        ? Math.floor(parsed.player.coins)
        : DEFAULT_SAVE_DATA_V2.player.coins;

    const upgrades: PlayerUpgrades = {
      magnetRange: Math.max(1, Math.min(10, Number(parsed.player?.upgrades?.magnetRange) || 1)),
      attractPower: Math.max(1, Math.min(10, Number(parsed.player?.upgrades?.attractPower) || 1)),
      carryCapacity: Math.max(1, Math.min(10, Number(parsed.player?.upgrades?.carryCapacity) || 1)),
      movementSpeed: Math.max(1, Math.min(10, Number(parsed.player?.upgrades?.movementSpeed) || 1)),
    };

    let unlockedTiers: number[] = [1];
    if (Array.isArray(parsed.player?.unlockedTiers)) {
      const cleaned = parsed.player.unlockedTiers
        .map((t: any) => Number(t))
        .filter((t: number) => !isNaN(t) && t >= 1 && t <= 4);
      if (cleaned.length > 0) {
        unlockedTiers = Array.from(new Set([1, ...cleaned])).sort((a, b) => a - b);
      }
    }

    const prestigeLevel = Math.max(0, Math.floor(Number(parsed.player?.prestigeLevel) || 0));

    // Challenges migration
    const challenges = {
      activeChallengeId: typeof parsed.challenges?.activeChallengeId === 'string'
        ? parsed.challenges.activeChallengeId
        : DEFAULT_SAVE_DATA_V2.challenges.activeChallengeId,
      progress: Math.max(0, Number(parsed.challenges?.progress) || 0),
      completedCount: Math.max(0, Number(parsed.challenges?.completedCount) || 0),
    };

    // Achievements migration
    const achievements = {
      unlocked: Array.isArray(parsed.achievements?.unlocked)
        ? parsed.achievements.unlocked.filter((a: any) => typeof a === 'string')
        : [],
    };

    const prestigeTokens = Math.max(0, Math.floor(Number(parsed.player?.prestigeTokens) || 0));
    const prestigePerks: Record<string, number> =
      parsed.player?.prestigePerks && typeof parsed.player.prestigePerks === 'object' && !Array.isArray(parsed.player.prestigePerks)
        ? { ...parsed.player.prestigePerks }
        : {};
    const clearedZoneMilestones: number[] = Array.isArray(parsed.player?.clearedZoneMilestones)
      ? parsed.player.clearedZoneMilestones.map((z: any) => Number(z)).filter((z: number) => !isNaN(z))
      : [];

    return {
      version: 2,
      timestamp: typeof parsed.timestamp === 'number' && !isNaN(parsed.timestamp) ? parsed.timestamp : Date.now(),
      player: {
        coins: validCoins,
        upgrades,
        unlockedTiers,
        prestigeLevel,
        prestigeTokens,
        prestigePerks,
        clearedZoneMilestones,
      },
      challenges,
      achievements,
      stats: {
        totalScrapCollected: Math.max(0, Number(parsed.stats?.totalScrapCollected) || 0),
        totalCoinsEarned: Math.max(0, Number(parsed.stats?.totalCoinsEarned) || 0),
        totalRecycledRuns: Math.max(0, Number(parsed.stats?.totalRecycledRuns) || 0),
        playTimeSeconds: Math.max(0, Number(parsed.stats?.playTimeSeconds) || 0),
        adRewardsClaimed: Math.max(0, Number(parsed.stats?.adRewardsClaimed) || 0),
        totalPrestiges: Math.max(0, Number(parsed.stats?.totalPrestiges) || prestigeLevel),
        totalChallengesCompleted: Math.max(0, Number(parsed.stats?.totalChallengesCompleted) || challenges.completedCount),
        goldenScrapCollected: Math.max(0, Number(parsed.stats?.goldenScrapCollected) || 0),
        crittersRepelled: Math.max(0, Number(parsed.stats?.crittersRepelled) || 0),
        empMineHits: Math.max(0, Number(parsed.stats?.empMineHits) || 0),
      },
      settings: {
        sfxVolume:
          typeof parsed.settings?.sfxVolume === 'number'
            ? Math.max(0, Math.min(1, parsed.settings.sfxVolume))
            : DEFAULT_SAVE_DATA_V2.settings.sfxVolume,
        musicVolume:
          typeof parsed.settings?.musicVolume === 'number'
            ? Math.max(0, Math.min(1, parsed.settings.musicVolume))
            : DEFAULT_SAVE_DATA_V2.settings.musicVolume,
        touchControls:
          typeof parsed.settings?.touchControls === 'boolean'
            ? parsed.settings.touchControls
            : DEFAULT_SAVE_DATA_V2.settings.touchControls,
        hapticFeedback:
          typeof parsed.settings?.hapticFeedback === 'boolean'
            ? parsed.settings.hapticFeedback
            : DEFAULT_SAVE_DATA_V2.settings.hapticFeedback,
        screenShake:
          typeof parsed.settings?.screenShake === 'boolean'
            ? parsed.settings.screenShake
            : DEFAULT_SAVE_DATA_V2.settings.screenShake,
        tutorialCompleted:
          typeof parsed.settings?.tutorialCompleted === 'boolean'
            ? parsed.settings.tutorialCompleted
            : DEFAULT_SAVE_DATA_V2.settings.tutorialCompleted,
      },
    };
  }

  /**
   * Calculates offline earnings accumulated during user absence.
   * Capped at 8 hours (28,800 seconds).
   * Generates passive coins scaled by prestige level.
   */
  public calculateOfflineEarnings(currentTime: number = Date.now()): {
    elapsedMinutes: number;
    offlineCoins: number;
    prestigeMultiplier: number;
  } {
    const saved = this.load();
    if (typeof saved.timestamp !== 'number' || isNaN(saved.timestamp)) {
      return { elapsedMinutes: 0, offlineCoins: 0, prestigeMultiplier: 1.0 };
    }

    const elapsedSeconds = Math.max(0, (currentTime - saved.timestamp) / 1000);
    // Min 2 minutes away required to generate offline rewards
    if (elapsedSeconds < 120) {
      return { elapsedMinutes: 0, offlineCoins: 0, prestigeMultiplier: 1.0 };
    }

    // Cap at 8 hours (28,800s / 480 mins)
    const cappedMinutes = Math.min(480, Math.floor(elapsedSeconds / 60));
    const prestigeMultiplier = 1.0 + 0.15 * saved.player.prestigeLevel;
    // 3 base coins per minute away
    const offlineCoins = Math.floor(cappedMinutes * 3 * prestigeMultiplier);

    return {
      elapsedMinutes: cappedMinutes,
      offlineCoins,
      prestigeMultiplier,
    };
  }

  public reset(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(STORAGE_KEY_V1);
      this.storage.removeItem(STORAGE_KEY_V2);
    } catch (e) {
      console.error('[SaveManager] Failed to remove storage item:', e);
    }
  }

  private cloneDefaults(): SaveDataV2 {
    return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA_V2));
  }
}
