// ============================================================================
// Magnet Junkyard - Prestige Token & Meta-Progression Perks Manager
// ============================================================================

export interface PrestigePerkDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  costTokens: number;
  maxLevel: number;
  effectPerLevel: number;
  unit: string;
}

export const PRESTIGE_PERKS: Record<string, PrestigePerkDef> = {
  magnet_aura: {
    id: 'magnet_aura',
    name: 'MAGNETIC AURA',
    icon: '🧲',
    description: 'Permanently increases base magnet attraction radius',
    costTokens: 1,
    maxLevel: 5,
    effectPerLevel: 15,
    unit: 'px',
  },
  swift_treads: {
    id: 'swift_treads',
    name: 'SWIFT TREADS',
    icon: '💨',
    description: 'Permanently increases base rover movement speed',
    costTokens: 1,
    maxLevel: 5,
    effectPerLevel: 12,
    unit: 'px/s',
  },
  titan_cargo: {
    id: 'titan_cargo',
    name: 'TITAN CARGO',
    icon: '📦',
    description: 'Permanently expands base cargo carrying capacity',
    costTokens: 2,
    maxLevel: 5,
    effectPerLevel: 4,
    unit: 'kg',
  },
  overclock_pulse: {
    id: 'overclock_pulse',
    name: 'OVERCLOCK PULSE',
    icon: '⚡',
    description: 'Permanently reduces Magnetic Pulse ability cooldown',
    costTokens: 2,
    maxLevel: 3,
    effectPerLevel: 1.5,
    unit: 's',
  },
  fever_rush: {
    id: 'fever_rush',
    name: 'FEVER RUSH',
    icon: '🔥',
    description: 'Permanently extends Fever Mode rainbow duration',
    costTokens: 3,
    maxLevel: 3,
    effectPerLevel: 2.0,
    unit: 's',
  },
  midas_touch: {
    id: 'midas_touch',
    name: 'MIDAS TOUCH',
    icon: '🌟',
    description: 'Permanently increases Golden Scrap spawn chance',
    costTokens: 3,
    maxLevel: 3,
    effectPerLevel: 2,
    unit: '%',
  },
};

export class PrestigeManager {
  /**
   * Calculates Prestige Tokens awarded upon performing a Prestige reset.
   */
  public static calculateTokensAwarded(
    achievementsUnlocked: number = 0,
    totalScrapCollected: number = 0
  ): number {
    let tokens = 1; // Base reward for completing all 4 tiers

    // +1 Token for every 3 unlocked achievements
    tokens += Math.floor(achievementsUnlocked / 3);

    // +1 Token for every 100 scrap collected lifetime
    tokens += Math.floor(totalScrapCollected / 100);

    return Math.max(1, tokens);
  }

  /**
   * Gets the total numerical bonus granted by a specific perk at its current level.
   */
  public static getPerkBonus(perkId: string, level: number = 0): number {
    const def = PRESTIGE_PERKS[perkId];
    if (!def || level <= 0) return 0;
    const clampedLevel = Math.min(def.maxLevel, Math.max(0, level));
    return clampedLevel * def.effectPerLevel;
  }
}
