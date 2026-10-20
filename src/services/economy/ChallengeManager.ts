// ============================================================================
// Magnet Junkyard - Rotating Micro-Challenges (ChallengeManager)
// ============================================================================

import { ScrapItemData } from '../../config/constants';

export interface ChallengeDef {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  type: 'speed_recycler' | 'heavy_hauler' | 'zone_explorer';
  target: number;
}

export const CHALLENGE_TEMPLATES: ChallengeDef[] = [
  {
    id: 'speed_recycler',
    title: '⚡ SPEED RECYCLER',
    description: 'Recycle 8 scrap items in under 25 seconds',
    rewardCoins: 200,
    type: 'speed_recycler',
    target: 8,
  },
  {
    id: 'heavy_hauler',
    title: '🎒 HEAVY HAULER',
    description: 'Recycle a load at 80%+ max cargo capacity',
    rewardCoins: 150,
    type: 'heavy_hauler',
    target: 1,
  },
  {
    id: 'zone_explorer',
    title: '🗺️ ZONE EXPLORER',
    description: 'Recycle scraps from 2+ different zones in one load',
    rewardCoins: 300,
    type: 'zone_explorer',
    target: 2,
  },
];

export interface ChallengeState {
  activeChallenge: ChallengeDef;
  progress: number;
  completedCount: number;
}

export type ChallengeListener = (state: ChallengeState, completedChallenge?: ChallengeDef) => void;

export class ChallengeManager {
  private currentIndex: number = 0;
  private progress: number = 0;
  private completedCount: number = 0;
  private listeners: Set<ChallengeListener> = new Set();

  constructor() {
    this.currentIndex = 0;
    this.progress = 0;
  }

  public on(listener: ChallengeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(completedChallenge?: ChallengeDef): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state, completedChallenge);
      } catch (err) {
        console.error('[ChallengeManager] Listener error:', err);
      }
    }
  }

  public getActiveChallenge(): ChallengeDef {
    return CHALLENGE_TEMPLATES[this.currentIndex % CHALLENGE_TEMPLATES.length];
  }

  public getState(): ChallengeState {
    return {
      activeChallenge: this.getActiveChallenge(),
      progress: this.progress,
      completedCount: this.completedCount,
    };
  }

  public getRewardForTier(baseReward: number, highestTier: number = 1): number {
    const tierMultiplier = 1.0 + 0.5 * Math.max(0, highestTier - 1);
    return Math.floor(baseReward * tierMultiplier);
  }

  /**
   * Evaluates recycling event against active challenge.
   * Returns coin reward awarded (0 if not completed).
   */
  public evaluateRecycle(
    items: ScrapItemData[],
    currentMassKg: number,
    maxCapacityKg: number,
    elapsedSeconds: number,
    highestTier: number = 1
  ): number {
    const challenge = this.getActiveChallenge();
    let isCompleted = false;

    if (challenge.type === 'speed_recycler') {
      if (items.length >= challenge.target && elapsedSeconds <= 25) {
        isCompleted = true;
      }
    } else if (challenge.type === 'heavy_hauler') {
      const fillRatio = currentMassKg / Math.max(1, maxCapacityKg);
      if (fillRatio >= 0.8) {
        isCompleted = true;
      }
    } else if (challenge.type === 'zone_explorer') {
      const uniqueTiers = new Set(items.map((it) => it.tier));
      if (uniqueTiers.size >= challenge.target) {
        isCompleted = true;
      }
    }

    if (isCompleted) {
      return this.completeChallenge(highestTier);
    }

    return 0;
  }

  public completeChallenge(highestTier: number = 1): number {
    const completed = this.getActiveChallenge();
    const reward = this.getRewardForTier(completed.rewardCoins, highestTier);
    this.completedCount++;
    this.progress = 0;
    // Rotate to next challenge
    this.currentIndex = (this.currentIndex + 1) % CHALLENGE_TEMPLATES.length;
    this.emit({ ...completed, rewardCoins: reward });
    return reward;
  }

  public serialize(): { activeChallengeId: string; progress: number; completedCount: number } {
    return {
      activeChallengeId: this.getActiveChallenge().id,
      progress: this.progress,
      completedCount: this.completedCount,
    };
  }

  public deserialize(saved?: { activeChallengeId?: string; progress?: number; completedCount?: number }): void {
    if (!saved) return;
    if (saved.activeChallengeId) {
      const idx = CHALLENGE_TEMPLATES.findIndex((t) => t.id === saved.activeChallengeId);
      if (idx >= 0) {
        this.currentIndex = idx;
      }
    }
    this.progress = saved.progress ?? 0;
    this.completedCount = saved.completedCount ?? 0;
    this.emit();
  }
}
