import { describe, it, expect } from 'vitest';
import { PrestigeManager, PRESTIGE_PERKS } from '../../src/services/economy/PrestigeManager';
import { SaveManager, DEFAULT_SAVE_DATA_V2 } from '../../src/services/persistence/SaveManager';

describe('Prestige Meta-Progression System', () => {
  describe('PRESTIGE_PERKS registry', () => {
    it('defines 6 distinct permanent meta-perks with valid schemas', () => {
      const perkIds = Object.keys(PRESTIGE_PERKS);
      expect(perkIds.length).toBe(6);

      for (const id of perkIds) {
        const perk = PRESTIGE_PERKS[id];
        expect(perk.id).toBe(id);
        expect(perk.name.length).toBeGreaterThan(0);
        expect(perk.icon.length).toBeGreaterThan(0);
        expect(perk.description.length).toBeGreaterThan(0);
        expect(perk.costTokens).toBeGreaterThan(0);
        expect(perk.maxLevel).toBeGreaterThanOrEqual(1);
        expect(perk.effectPerLevel).toBeGreaterThan(0);
      }
    });
  });

  describe('PrestigeManager.calculateTokensAwarded', () => {
    it('awards minimum 1 base token even with 0 achievements and 0 scrap', () => {
      expect(PrestigeManager.calculateTokensAwarded(0, 0)).toBe(1);
    });

    it('awards bonus tokens based on unlocked achievements (1 per 3 achievements)', () => {
      expect(PrestigeManager.calculateTokensAwarded(2, 0)).toBe(1);
      expect(PrestigeManager.calculateTokensAwarded(3, 0)).toBe(2);
      expect(PrestigeManager.calculateTokensAwarded(6, 0)).toBe(3);
      expect(PrestigeManager.calculateTokensAwarded(8, 0)).toBe(3);
    });

    it('awards bonus tokens based on total scrap collected (1 per 100 scrap)', () => {
      expect(PrestigeManager.calculateTokensAwarded(0, 99)).toBe(1);
      expect(PrestigeManager.calculateTokensAwarded(0, 100)).toBe(2);
      expect(PrestigeManager.calculateTokensAwarded(0, 250)).toBe(3);
    });

    it('combines achievement and scrap bonuses accurately', () => {
      // 1 base + floor(6/3) + floor(350/100) = 1 + 2 + 3 = 6 tokens
      expect(PrestigeManager.calculateTokensAwarded(6, 350)).toBe(6);
    });
  });

  describe('PrestigeManager.getPerkBonus', () => {
    it('returns 0 if perk ID is invalid or level <= 0', () => {
      expect(PrestigeManager.getPerkBonus('non_existent', 1)).toBe(0);
      expect(PrestigeManager.getPerkBonus('magnet_aura', 0)).toBe(0);
      expect(PrestigeManager.getPerkBonus('magnet_aura', -2)).toBe(0);
    });

    it('scales linearly with level up to maxLevel', () => {
      // magnet_aura: 15px per level, max 5 -> 75px max
      expect(PrestigeManager.getPerkBonus('magnet_aura', 1)).toBe(15);
      expect(PrestigeManager.getPerkBonus('magnet_aura', 3)).toBe(45);
      expect(PrestigeManager.getPerkBonus('magnet_aura', 5)).toBe(75);
      expect(PrestigeManager.getPerkBonus('magnet_aura', 10)).toBe(75); // Clamped at maxLevel
    });

    it('clamps correctly for overclock_pulse (maxLevel: 3, 1.5s/level)', () => {
      expect(PrestigeManager.getPerkBonus('overclock_pulse', 1)).toBe(1.5);
      expect(PrestigeManager.getPerkBonus('overclock_pulse', 2)).toBe(3.0);
      expect(PrestigeManager.getPerkBonus('overclock_pulse', 3)).toBe(4.5);
      expect(PrestigeManager.getPerkBonus('overclock_pulse', 99)).toBe(4.5);
    });
  });

  describe('Prestige State Persistence in SaveDataV2', () => {
    it('initializes with 0 prestige tokens and empty perks by default', () => {
      expect(DEFAULT_SAVE_DATA_V2.player.prestigeTokens).toBe(0);
      expect(DEFAULT_SAVE_DATA_V2.player.prestigePerks).toEqual({});
      expect(DEFAULT_SAVE_DATA_V2.player.clearedZoneMilestones).toEqual([]);
    });

    it('persists and restores prestigeTokens and prestigePerks correctly', () => {
      const mockStorage: Record<string, string> = {};
      const fakeStorage = {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
        clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
      };

      const saveManager = new SaveManager(fakeStorage);
      const loaded = saveManager.load();
      loaded.player.prestigeTokens = 5;
      loaded.player.prestigePerks = { magnet_aura: 2, titan_cargo: 1 };
      loaded.player.clearedZoneMilestones = [2, 3];
      saveManager.save(loaded);

      const reloaded = saveManager.load();
      expect(reloaded.player.prestigeTokens).toBe(5);
      expect(reloaded.player.prestigePerks).toEqual({ magnet_aura: 2, titan_cargo: 1 });
      expect(reloaded.player.clearedZoneMilestones).toEqual([2, 3]);
    });
  });
});
