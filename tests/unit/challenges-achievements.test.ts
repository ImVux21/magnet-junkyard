// ============================================================================
// Magnet Junkyard - Micro-Challenges & Achievements Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChallengeManager } from '../../src/services/economy/ChallengeManager';
import { AchievementManager, ACHIEVEMENTS_CATALOG } from '../../src/services/economy/AchievementManager';
import { SCRAP_CATALOG } from '../../src/config/constants';

describe('Retention System — Rotating Micro-Challenges (ChallengeManager)', () => {
  let challengeManager: ChallengeManager;

  beforeEach(() => {
    challengeManager = new ChallengeManager();
  });

  it('initializes with Speed Recycler as first challenge', () => {
    const active = challengeManager.getActiveChallenge();
    expect(active.id).toBe('speed_recycler');
    expect(active.rewardCoins).toBe(200);
  });

  it('evaluates and completes Speed Recycler with >= 8 items in <= 25 seconds', () => {
    const items = Array(8).fill(SCRAP_CATALOG.screw);
    // Recycle 8 items in 15 seconds
    const reward = challengeManager.evaluateRecycle(items, 8, 10, 15);
    expect(reward).toBe(200);

    // Rotates to Heavy Hauler
    const nextChallenge = challengeManager.getActiveChallenge();
    expect(nextChallenge.id).toBe('heavy_hauler');
    expect(challengeManager.getState().completedCount).toBe(1);
  });

  it('evaluates and completes Heavy Hauler at >= 80% cargo capacity', () => {
    // Rotate to heavy hauler first
    challengeManager.completeChallenge();
    expect(challengeManager.getActiveChallenge().id).toBe('heavy_hauler');

    // 8.5kg / 10.0kg = 85% capacity
    const reward = challengeManager.evaluateRecycle([SCRAP_CATALOG.screw], 8.5, 10.0, 30);
    expect(reward).toBe(150);

    // Rotates to Zone Explorer
    expect(challengeManager.getActiveChallenge().id).toBe('zone_explorer');
  });

  it('evaluates and completes Zone Explorer with scrap from 2+ distinct tiers', () => {
    // Rotate to zone explorer
    challengeManager.completeChallenge(); // to heavy
    challengeManager.completeChallenge(); // to zone explorer
    expect(challengeManager.getActiveChallenge().id).toBe('zone_explorer');

    // Items from Tier 1 (screw) and Tier 2 (copper_wire)
    const multiTierItems = [SCRAP_CATALOG.screw, SCRAP_CATALOG.copper_wire];
    const reward = challengeManager.evaluateRecycle(multiTierItems, 3, 10, 20);
    expect(reward).toBe(300);

    // Rotates back to Speed Recycler
    expect(challengeManager.getActiveChallenge().id).toBe('speed_recycler');
  });

  it('serializes and deserializes state accurately', () => {
    challengeManager.completeChallenge();
    const serialized = challengeManager.serialize();
    expect(serialized.activeChallengeId).toBe('heavy_hauler');
    expect(serialized.completedCount).toBe(1);

    const freshManager = new ChallengeManager();
    freshManager.deserialize(serialized);
    expect(freshManager.getActiveChallenge().id).toBe('heavy_hauler');
    expect(freshManager.getState().completedCount).toBe(1);
  });
});

describe('Retention System — Achievements Engine (12 Milestone Unlocks)', () => {
  let achievementManager: AchievementManager;

  beforeEach(() => {
    achievementManager = new AchievementManager();
  });

  it('contains exactly 12 authoritative milestone definitions', () => {
    expect(ACHIEVEMENTS_CATALOG.length).toBe(12);
  });

  it('unlocks achievement, awards coins, and ignores duplicate calls', () => {
    const listener = vi.fn();
    achievementManager.on(listener);

    const reward1 = achievementManager.unlock('first_crush');
    expect(reward1).toBe(50);
    expect(achievementManager.isUnlocked('first_crush')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Duplicate call returns 0
    const reward2 = achievementManager.unlock('first_crush');
    expect(reward2).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('serializes and deserializes unlocked milestones accurately', () => {
    achievementManager.unlock('fever_master');
    achievementManager.unlock('golden_touch');

    const serialized = achievementManager.serialize();
    expect(serialized.unlocked).toEqual(['fever_master', 'golden_touch']);

    const fresh = new AchievementManager();
    fresh.deserialize(serialized);
    expect(fresh.isUnlocked('fever_master')).toBe(true);
    expect(fresh.isUnlocked('golden_touch')).toBe(true);
    expect(fresh.isUnlocked('first_crush')).toBe(false);
  });

  it('can unlock hauler_apprentice, scrap_collector_50, critter_repelled, and emp_survivor', () => {
    expect(achievementManager.unlock('hauler_apprentice')).toBe(100);
    expect(achievementManager.unlock('scrap_collector_50')).toBe(150);
    expect(achievementManager.unlock('critter_repelled')).toBe(150);
    expect(achievementManager.unlock('emp_survivor')).toBe(150);

    expect(achievementManager.isUnlocked('hauler_apprentice')).toBe(true);
    expect(achievementManager.isUnlocked('scrap_collector_50')).toBe(true);
    expect(achievementManager.isUnlocked('critter_repelled')).toBe(true);
    expect(achievementManager.isUnlocked('emp_survivor')).toBe(true);
  });
});
