// ============================================================================
// Magnet Junkyard - Active Ability & Daily Login Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { AbilityManager } from '../../src/services/economy/AbilityManager';
import { DailyLoginManager } from '../../src/services/persistence/DailyLoginManager';

describe('Engagement — AbilityManager (Magnetic Pulse)', () => {
  let ability: AbilityManager;

  beforeEach(() => {
    ability = new AbilityManager(12000);
  });

  it('is ready immediately on instantiation', () => {
    expect(ability.canUsePulse(1000)).toBe(true);
    const state = ability.getState(1000);
    expect(state.ready).toBe(true);
    expect(state.remainingCooldownMs).toBe(0);
    expect(state.progress).toBe(1.0);
  });

  it('triggers pulse and enters 12-second cooldown', () => {
    const success = ability.triggerPulse(1000);
    expect(success).toBe(true);

    // Immediately after, cannot pulse
    expect(ability.canUsePulse(2000)).toBe(false);
    const midState = ability.getState(7000); // 6s passed
    expect(midState.ready).toBe(false);
    expect(midState.remainingCooldownMs).toBe(6000);
    expect(midState.progress).toBeCloseTo(0.5, 1);

    // After 12s, ready again
    expect(ability.canUsePulse(13000)).toBe(true);
    const endState = ability.getState(13000);
    expect(endState.ready).toBe(true);
  });

  it('resets cooldown instantly when triggered (e.g. Fever Mode entry)', () => {
    ability.triggerPulse(1000);
    expect(ability.canUsePulse(2000)).toBe(false);

    ability.resetCooldown();
    expect(ability.canUsePulse(2000)).toBe(true);
  });
});

describe('Retention — DailyLoginManager (7-Day Streak & 2X Reward)', () => {
  let mockStorage: Record<string, string>;
  let customStorage: any;
  let daily: DailyLoginManager;

  beforeEach(() => {
    mockStorage = {};
    customStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
    };
    daily = new DailyLoginManager(customStorage);
  });

  it('allows day 1 claim on first login', () => {
    const status = daily.getStatus(Date.UTC(2026, 8, 26, 12, 0, 0));
    expect(status.canClaim).toBe(true);
    expect(status.streakDay).toBe(1);
    expect(status.rewardCoins).toBe(100);

    const coins = daily.claim(false, Date.UTC(2026, 8, 26, 12, 0, 0));
    expect(coins).toBe(100);

    // Same day claim rejected
    const sameDayStatus = daily.getStatus(Date.UTC(2026, 8, 26, 18, 0, 0));
    expect(sameDayStatus.canClaim).toBe(false);
  });

  it('advances streak on consecutive day and awards 2X coins with ad', () => {
    // Claim Day 1
    daily.claim(false, Date.UTC(2026, 8, 26, 12, 0, 0));

    // Next day (Day 2)
    const nextDayTime = Date.UTC(2026, 8, 27, 12, 0, 0);
    const status = daily.getStatus(nextDayTime);
    expect(status.canClaim).toBe(true);
    expect(status.streakDay).toBe(2);
    expect(status.rewardCoins).toBe(150);

    // Claim with 2X Ad watched
    const coins = daily.claim(true, nextDayTime);
    expect(coins).toBe(300); // 150 * 2
  });

  it('resets streak to Day 1 after missed day', () => {
    // Claim Day 1
    daily.claim(false, Date.UTC(2026, 8, 26, 12, 0, 0));

    // Skip to 3 days later
    const missedTime = Date.UTC(2026, 8, 29, 12, 0, 0);
    const status = daily.getStatus(missedTime);
    expect(status.canClaim).toBe(true);
    expect(status.streakDay).toBe(1);
    expect(status.rewardCoins).toBe(100);
  });
});
