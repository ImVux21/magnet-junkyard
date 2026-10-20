// ============================================================================
// Magnet Junkyard - Achievements Engine (12 Milestone Unlocks)
// ============================================================================

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  icon: string;
}

export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  { id: 'first_crush', title: 'First Crush', description: 'Recycle your very first scrap item', rewardCoins: 50, icon: '🔨' },
  { id: 'hauler_apprentice', title: 'Hauler Apprentice', description: 'Deliver 5 full cargo loads to the Recycler', rewardCoins: 100, icon: '🚛' },
  { id: 'scrap_collector_50', title: 'Scrap Collector', description: 'Collect 50 total scrap items', rewardCoins: 150, icon: '🧲' },
  { id: 'combo_starter', title: 'Combo Novice', description: 'Achieve a 5-hit pickup combo', rewardCoins: 100, icon: '⚡' },
  { id: 'fever_master', title: 'Fever Fever!', description: 'Trigger 20-hit Fever Mode', rewardCoins: 300, icon: '🔥' },
  { id: 'golden_touch', title: 'Golden Touch', description: 'Collect a rare Golden Scrap item', rewardCoins: 200, icon: '✨' },
  { id: 'storm_chaser', title: 'Storm Chaser', description: 'Collect items during a Scrap Storm', rewardCoins: 250, icon: '🌪️' },
  { id: 'critter_repelled', title: 'Magnetic Shield', description: 'Repel a Scrap Critter with high magnetic power', rewardCoins: 150, icon: '🛡️' },
  { id: 'emp_survivor', title: 'EMP Survivor', description: 'Survive an EMP mine blast and keep hauling', rewardCoins: 150, icon: '🔋' },
  { id: 'tier_pioneer', title: 'Junkyard King', description: 'Unlock all 4 Junkyard Tiers', rewardCoins: 1000, icon: '👑' },
  { id: 'max_tech', title: 'Max Tech', description: 'Upgrade any attribute to Level 10', rewardCoins: 500, icon: '⚙️' },
  { id: 'scrap_master', title: 'Scrap Mastery', description: 'Perform your first Prestige reset', rewardCoins: 2000, icon: '⭐' },
];

export type AchievementListener = (achievement: AchievementDef, totalCoinsAwarded: number) => void;

export class AchievementManager {
  private unlocked: Set<string> = new Set();
  private listeners: Set<AchievementListener> = new Set();

  public on(listener: AchievementListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public isUnlocked(id: string): boolean {
    return this.unlocked.has(id);
  }

  public getUnlocked(): string[] {
    return Array.from(this.unlocked);
  }

  public getUnlockedCount(): number {
    return this.unlocked.size;
  }

  public unlock(id: string): number {
    if (this.unlocked.has(id)) {
      return 0; // Already claimed
    }

    const def = ACHIEVEMENTS_CATALOG.find((a) => a.id === id);
    if (!def) return 0;

    this.unlocked.add(id);
    for (const listener of this.listeners) {
      try {
        listener(def, def.rewardCoins);
      } catch (err) {
        console.error('[AchievementManager] Listener error:', err);
      }
    }

    return def.rewardCoins;
  }

  public serialize(): { unlocked: string[] } {
    return {
      unlocked: Array.from(this.unlocked),
    };
  }

  public deserialize(saved?: { unlocked?: string[] }): void {
    if (!saved || !saved.unlocked) return;
    this.unlocked = new Set(saved.unlocked);
  }
}
