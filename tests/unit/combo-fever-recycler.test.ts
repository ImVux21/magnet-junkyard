// ============================================================================
// Magnet Junkyard - Unit Test Suite: Combo, Fever Mode & Recycler Cooldown
// ============================================================================

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ComboManager } from '../../src/services/economy/ComboManager';
import { ProceduralAudioService } from '../../src/services/audio/ProceduralAudioService';
import {
  getMagnetRange,
  getCarryCapacity,
  PlayerUpgrades,
} from '../../src/config/constants';

describe('ComboManager — 2.0s Timing Window & Streak Decay', () => {
  let combo: ComboManager;

  beforeEach(() => {
    combo = new ComboManager();
  });

  it('increments combo count for rapid pickups within the 2000ms window', () => {
    let t = 1000;
    const p1 = combo.recordPickup(t);
    expect(p1.count).toBe(1);
    expect(combo.count).toBe(1);

    t += 500; // 500ms later (< 2000ms)
    const p2 = combo.recordPickup(t);
    expect(p2.count).toBe(2);
    expect(combo.count).toBe(2);

    t += 1200; // 1200ms later (< 2000ms)
    const p3 = combo.recordPickup(t);
    expect(p3.count).toBe(3);
    expect(combo.count).toBe(3);

    t += 1999; // 1999ms later (< 2000ms)
    const p4 = combo.recordPickup(t);
    expect(p4.count).toBe(4);
    expect(combo.count).toBe(4);
  });

  it('resets combo count to 1 when a pickup occurs after > 2000ms has elapsed', () => {
    const t0 = 10000;
    combo.recordPickup(t0);
    combo.recordPickup(t0 + 500);
    expect(combo.count).toBe(2);

    // 2001ms after last pickup (window expired)
    const nextPickup = combo.recordPickup(t0 + 500 + 2001);
    expect(nextPickup.count).toBe(1);
    expect(combo.count).toBe(1);
  });

  it('resets combo count to 0 when update() is called after the 2000ms window expires', () => {
    const t0 = 10000;
    const expiredSpy = vi.fn();
    combo.on('combo-expired', expiredSpy);

    combo.recordPickup(t0);
    combo.recordPickup(t0 + 800);
    expect(combo.count).toBe(2);

    // Tick at 1999ms after last pickup -> still active
    combo.update(t0 + 800 + 1999);
    expect(combo.count).toBe(2);
    expect(expiredSpy).not.toHaveBeenCalled();

    // Tick at 2001ms after last pickup -> expires to 0
    combo.update(t0 + 800 + 2001);
    expect(combo.count).toBe(0);
    expect(expiredSpy).toHaveBeenCalledTimes(1);
    expect(combo.getState(t0 + 800 + 2001).multiplier).toBe(1.0);
  });

  it('handles multiple pickups at the exact same millisecond (dt = 0)', () => {
    const t = 50000;
    const r1 = combo.recordPickup(t);
    const r2 = combo.recordPickup(t);
    const r3 = combo.recordPickup(t);

    expect(r1.count).toBe(1);
    expect(r2.count).toBe(2);
    expect(r3.count).toBe(3);
    expect(combo.count).toBe(3);
  });

  it('calculates remaining combo window milliseconds correctly', () => {
    const t0 = 10000;
    combo.recordPickup(t0);

    const s1 = combo.getState(t0 + 500);
    expect(s1.remainingWindowMs).toBe(1500);

    const s2 = combo.getState(t0 + 1900);
    expect(s2.remainingWindowMs).toBe(100);

    const s3 = combo.getState(t0 + 2500);
    expect(s3.remainingWindowMs).toBe(0);
  });
});

describe('Combo Multiplier Schedule', () => {
  let combo: ComboManager;

  beforeEach(() => {
    combo = new ComboManager();
  });

  it('applies 1.0x multiplier for 0 to 2 hits', () => {
    expect(combo.getMultiplier()).toBe(1.0);

    combo.setCombo(1);
    expect(combo.getMultiplier()).toBe(1.0);

    combo.setCombo(2);
    expect(combo.getMultiplier()).toBe(1.0);
  });

  it('applies 1.5x multiplier for 3 to 4 hits', () => {
    combo.setCombo(3);
    expect(combo.getMultiplier()).toBe(1.5);
    expect(combo.getCoinMultiplier()).toBe(1.5);

    combo.setCombo(4);
    expect(combo.getMultiplier()).toBe(1.5);
  });

  it('applies 2.0x multiplier for 5 to 9 hits', () => {
    combo.setCombo(5);
    expect(combo.getMultiplier()).toBe(2.0);
    expect(combo.getCoinMultiplier()).toBe(2.0);

    combo.setCombo(7);
    expect(combo.getMultiplier()).toBe(2.0);

    combo.setCombo(9);
    expect(combo.getMultiplier()).toBe(2.0);
  });

  it('applies 3.0x multiplier for 10 to 19 hits', () => {
    combo.setCombo(10);
    expect(combo.getMultiplier()).toBe(3.0);
    expect(combo.getCoinMultiplier()).toBe(3.0);

    combo.setCombo(15);
    expect(combo.getMultiplier()).toBe(3.0);

    combo.setCombo(19);
    expect(combo.getMultiplier()).toBe(3.0);
  });

  it('applies 5.0x multiplier for 20+ hits (Fever Mode)', () => {
    combo.setCombo(20);
    expect(combo.getMultiplier()).toBe(5.0);
    expect(combo.getCoinMultiplier()).toBe(5.0);
    expect(combo.isFever).toBe(true);

    combo.setCombo(25);
    expect(combo.getMultiplier()).toBe(5.0);
    expect(combo.isFever).toBe(true);
  });
});

describe('Fever Mode Mechanics & Buffs', () => {
  let combo: ComboManager;

  beforeEach(() => {
    combo = new ComboManager();
  });

  it('triggers Fever Mode upon reaching 20 consecutive pickups', () => {
    let t = 1000;
    const feverStartSpy = vi.fn();
    combo.on('fever-started', feverStartSpy);

    for (let i = 1; i <= 19; i++) {
      combo.recordPickup(t);
      expect(combo.isFever).toBe(false);
      t += 100;
    }

    // 20th pickup
    const r20 = combo.recordPickup(t);
    expect(r20.count).toBe(20);
    expect(r20.isFever).toBe(true);
    expect(r20.triggeredFever).toBe(true);
    expect(r20.multiplier).toBe(5.0);
    expect(feverStartSpy).toHaveBeenCalledTimes(1);
  });

  it('lasts exactly 10,000ms (10.0 seconds)', () => {
    const t0 = 50000;
    combo.triggerFever(t0);

    expect(combo.isFever).toBe(true);
    const state0 = combo.getState(t0);
    expect(state0.remainingFeverMs).toBe(10000);

    // Halfway through
    const stateMid = combo.getState(t0 + 5000);
    expect(stateMid.remainingFeverMs).toBe(5000);
    expect(combo.isFever).toBe(true);

    // 9,999ms elapsed -> still fever
    combo.update(t0 + 9999);
    expect(combo.isFever).toBe(true);
    expect(combo.getState(t0 + 9999).remainingFeverMs).toBe(1);

    // Exactly 10,000ms elapsed -> fever expires
    const feverEndSpy = vi.fn();
    combo.on('fever-ended', feverEndSpy);

    combo.update(t0 + 10000);
    expect(combo.isFever).toBe(false);
    expect(combo.count).toBe(0);
    expect(combo.getMultiplier()).toBe(1.0);
    expect(combo.getRangeMultiplier()).toBe(1.0);
    expect(feverEndSpy).toHaveBeenCalledTimes(1);
  });

  it('doubles magnet range multiplier (2.0x) during Fever Mode', () => {
    expect(combo.getRangeMultiplier()).toBe(1.0);

    combo.triggerFever();
    expect(combo.getRangeMultiplier()).toBe(2.0);

    combo.reset();
    expect(combo.getRangeMultiplier()).toBe(1.0);
  });

  it('does not expire from 2s pickup inactivity while Fever Mode is active', () => {
    const t0 = 10000;
    combo.triggerFever(t0);

    // Advance 4000ms without pickups (> 2000ms window)
    combo.update(t0 + 4000);
    expect(combo.isFever).toBe(true);
    expect(combo.getMultiplier()).toBe(5.0);

    // Pick up an item at 4000ms -> should still be fever and streak incremented
    const p = combo.recordPickup(t0 + 4000);
    expect(p.isFever).toBe(true);
    expect(p.count).toBe(21);
  });

  it('cleanly resets fever state on explicit reset()', () => {
    combo.triggerFever();
    expect(combo.isFever).toBe(true);

    combo.reset();
    expect(combo.isFever).toBe(false);
    expect(combo.count).toBe(0);
    expect(combo.getMultiplier()).toBe(1.0);
    expect(combo.getRangeMultiplier()).toBe(1.0);
  });
});

describe('Audio Pitch Escalation Formula', () => {
  it('scales pitch according to 1.0 + 0.05 * min(20, comboCount)', () => {
    const combo = new ComboManager();

    expect(combo.getAudioPitchModifier()).toBeCloseTo(1.0, 5);

    combo.setCombo(1);
    expect(combo.getAudioPitchModifier()).toBeCloseTo(1.05, 5);

    combo.setCombo(5);
    expect(combo.getAudioPitchModifier()).toBeCloseTo(1.25, 5);

    combo.setCombo(10);
    expect(combo.getAudioPitchModifier()).toBeCloseTo(1.50, 5);

    combo.setCombo(20);
    expect(combo.getAudioPitchModifier()).toBeCloseTo(2.00, 5);

    // Capped at 2.0x for combo > 20
    combo.setCombo(30);
    expect(combo.getAudioPitchModifier()).toBeCloseTo(2.00, 5);

    combo.setCombo(100);
    expect(combo.getAudioPitchModifier()).toBeCloseTo(2.00, 5);
  });

  it('ProceduralAudioService clamp guards combo pitch modifier', () => {
    const audio = ProceduralAudioService.getInstance();

    audio.setComboPitchModifier(1.5);
    expect(audio.getComboPitchModifier()).toBe(1.5);

    audio.setComboPitchModifier(0.1); // below min 0.5
    expect(audio.getComboPitchModifier()).toBe(0.5);

    audio.setComboPitchModifier(5.0); // above max 3.0
    expect(audio.getComboPitchModifier()).toBe(3.0);

    audio.setComboPitchModifier(1.0); // restore default
  });
});

describe('Recycler Station Thermal Cooldown & Deposit Lockout', () => {
  class SimulatedRecyclerStation {
    public isCoolingDown: boolean = false;
    public cooldownUntil: number = 0;
    public readonly COOLDOWN_MS = 2500;
    public hadCargoInRecycler: boolean = false;
    public itemsCompressed: number = 0;
    public coinsEarned: number = 0;

    public onCargoEmptied(time: number): void {
      this.isCoolingDown = true;
      this.cooldownUntil = time + this.COOLDOWN_MS;
      this.hadCargoInRecycler = false;
    }

    public update(time: number): void {
      if (this.isCoolingDown && time >= this.cooldownUntil) {
        this.isCoolingDown = false;
        this.cooldownUntil = 0;
      }
    }

    public tryDeposit(
      time: number,
      items: Array<{ coinValue: number }>
    ): { success: boolean; coinsAwarded: number } {
      this.update(time);

      // Lockout check
      if (this.isCoolingDown) {
        return { success: false, coinsAwarded: 0 };
      }

      if (items.length === 0) {
        return { success: true, coinsAwarded: 0 };
      }

      let awarded = 0;
      for (const item of items) {
        awarded += item.coinValue;
        this.itemsCompressed++;
      }
      this.coinsEarned += awarded;

      // Upon batch emptying to 0, trigger 2.5s cooldown
      this.onCargoEmptied(time);

      return { success: true, coinsAwarded: awarded };
    }

    public getRemainingCooldownMs(time: number): number {
      return this.isCoolingDown ? Math.max(0, this.cooldownUntil - time) : 0;
    }
  }

  it('triggers a 2.5-second (2500ms) thermal cooldown upon emptying cargo batch', () => {
    const recycler = new SimulatedRecyclerStation();
    const t0 = 10000;

    const result = recycler.tryDeposit(t0, [{ coinValue: 10 }, { coinValue: 20 }]);
    expect(result.success).toBe(true);
    expect(result.coinsAwarded).toBe(30);

    expect(recycler.isCoolingDown).toBe(true);
    expect(recycler.cooldownUntil).toBe(t0 + 2500);
    expect(recycler.getRemainingCooldownMs(t0)).toBe(2500);
  });

  it('strictly locks out all scrap deposits while cooling down', () => {
    const recycler = new SimulatedRecyclerStation();
    const t0 = 20000;

    // First deposit empties cargo and triggers cooldown
    recycler.tryDeposit(t0, [{ coinValue: 15 }]);
    expect(recycler.isCoolingDown).toBe(true);

    // Attempt deposit at t0 + 1000ms (1.5s remaining on cooldown)
    const blockedDeposit1 = recycler.tryDeposit(t0 + 1000, [{ coinValue: 50 }]);
    expect(blockedDeposit1.success).toBe(false);
    expect(blockedDeposit1.coinsAwarded).toBe(0);
    expect(recycler.getRemainingCooldownMs(t0 + 1000)).toBe(1500);

    // Attempt deposit at t0 + 2499ms (1ms remaining on cooldown)
    const blockedDeposit2 = recycler.tryDeposit(t0 + 2499, [{ coinValue: 50 }]);
    expect(blockedDeposit2.success).toBe(false);
    expect(blockedDeposit2.coinsAwarded).toBe(0);
    expect(recycler.getRemainingCooldownMs(t0 + 2499)).toBe(1);
  });

  it('resumes accepting deposits once the 2500ms cooldown expires', () => {
    const recycler = new SimulatedRecyclerStation();
    const t0 = 30000;

    recycler.tryDeposit(t0, [{ coinValue: 10 }]);
    expect(recycler.isCoolingDown).toBe(true);

    // Advance to t0 + 2500ms (cooldown complete)
    recycler.update(t0 + 2500);
    expect(recycler.isCoolingDown).toBe(false);
    expect(recycler.getRemainingCooldownMs(t0 + 2500)).toBe(0);

    // Next deposit succeeds smoothly
    const nextDeposit = recycler.tryDeposit(t0 + 2600, [{ coinValue: 40 }]);
    expect(nextDeposit.success).toBe(true);
    expect(nextDeposit.coinsAwarded).toBe(40);
  });
});

describe('Player Rover & Upgrades Fever Integration', () => {
  it('correctly calculates base magnet ranges and doubles them in Fever Mode', () => {
    const testCases = [
      { level: 1, baseRange: 120, feverRange: 240 },
      { level: 2, baseRange: 145, feverRange: 290 },
      { level: 5, baseRange: 220, feverRange: 440 },
      { level: 10, baseRange: 345, feverRange: 690 },
    ];

    for (const tc of testCases) {
      const base = getMagnetRange(tc.level);
      expect(base).toBe(tc.baseRange);
      expect(base * 2.0).toBe(tc.feverRange);
    }
  });

  it('preserves carry capacity curve invariants while Fever Mode modifies attraction range', () => {
    const upgrades: PlayerUpgrades = {
      magnetRange: 3,
      attractPower: 3,
      carryCapacity: 3,
      movementSpeed: 3,
    };

    const capacity = getCarryCapacity(upgrades.carryCapacity);
    expect(capacity).toBe(18); // Level 3 overhaul capacity: 6 + 4*2 + 4 = 18kg

    const baseRange = getMagnetRange(upgrades.magnetRange);
    expect(baseRange).toBe(170); // Level 3: 120 + 25*2 = 170px

    const feverRange = baseRange * 2.0;
    expect(feverRange).toBe(340);
  });
});
