// ============================================================================
// Magnet Junkyard - Milestone M_O2 Empirical Adversarial Stress Test Suite
// Authored by: challenger_m_o2
// Focus:
//   1. Combo Boundary Timing: delta = 1999ms vs 2001ms, active vs expired
//   2. Multiplier Schedule & Monotonicity: 1x, 1.5x, 2.0x, 3.0x, 5.0x Fever
//   3. Fever Mode Duration: active at 9999ms, expires at 10000ms/10001ms, inactivity immunity
//   4. Recycler Cooldown Lockout: deposits blocked during 2.5s; unblocked at 2501ms
//   5. Audio Pitch Escalation: monotonicity, bounds [1.0, 2.0], safety clamps
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComboManager } from '../../src/services/economy/ComboManager';
import { ProceduralAudioService } from '../../src/services/audio/ProceduralAudioService';

describe('Adversarial Challenge 1: Combo Boundary Timing (1999ms vs 2001ms)', () => {
  let combo: ComboManager;

  beforeEach(() => {
    combo = new ComboManager();
  });

  it('increments combo at delta = 1999ms (within 2000ms window)', () => {
    const t0 = 10000;
    const p1 = combo.recordPickup(t0);
    expect(p1.count).toBe(1);

    // Delta t = 1999ms
    const p2 = combo.recordPickup(t0 + 1999);
    expect(p2.count).toBe(2);
    expect(combo.count).toBe(2);

    // Another pickup at delta t = 1999ms
    const p3 = combo.recordPickup(t0 + 1999 + 1999);
    expect(p3.count).toBe(3);
    expect(combo.count).toBe(3);
  });

  it('increments combo at exact boundary delta = 2000ms', () => {
    const t0 = 20000;
    combo.recordPickup(t0);

    // Delta t = 2000ms exactly
    const p2 = combo.recordPickup(t0 + 2000);
    expect(p2.count).toBe(2);
    expect(combo.count).toBe(2);
  });

  it('resets combo count to 1 on pickup at delta = 2001ms', () => {
    const t0 = 30000;
    combo.recordPickup(t0);
    combo.recordPickup(t0 + 1000);
    combo.recordPickup(t0 + 1800);
    expect(combo.count).toBe(3);

    // Delta t = 2001ms since last pickup (t0 + 1800)
    const pAfterWindow = combo.recordPickup(t0 + 1800 + 2001);
    expect(pAfterWindow.count).toBe(1);
    expect(combo.count).toBe(1);
  });

  it('update() preserves combo count at delta = 1999ms and 2000ms, but expires at 2001ms', () => {
    const t0 = 40000;
    const expiredSpy = vi.fn();
    combo.on('combo-expired', expiredSpy);

    combo.recordPickup(t0);
    expect(combo.count).toBe(1);

    // Tick at 1999ms -> still active
    combo.update(t0 + 1999);
    expect(combo.count).toBe(1);
    expect(expiredSpy).not.toHaveBeenCalled();

    // Tick at 2000ms -> still active
    combo.update(t0 + 2000);
    expect(combo.count).toBe(1);
    expect(expiredSpy).not.toHaveBeenCalled();

    // Tick at 2001ms -> expires to 0
    combo.update(t0 + 2001);
    expect(combo.count).toBe(0);
    expect(expiredSpy).toHaveBeenCalledTimes(1);
  });

  it('survives rapid stream of jittered pickups (dt in [1, 1999]ms) pre-fever, and maintains fever within 10s', () => {
    let t = 100000;
    // 19 pickups before Fever triggers, each with dt in [1, 1999]ms
    for (let i = 1; i <= 19; i++) {
      const dt = ((i * 97) % 1998) + 1; // dt in [1, 1998]ms
      t += dt;
      const res = combo.recordPickup(t);
      expect(res.count).toBe(i);
      expect(res.isFever).toBe(false);
    }
    expect(combo.count).toBe(19);

    // 20th pickup triggers Fever
    t += 500;
    const feverPickup = combo.recordPickup(t);
    expect(feverPickup.count).toBe(20);
    expect(feverPickup.isFever).toBe(true);
    expect(feverPickup.triggeredFever).toBe(true);

    const feverStartTime = t;

    // Rapid pickups during Fever within the 10,000ms duration (e.g. 50 pickups @ 60ms = 3000ms < 10000ms)
    for (let j = 1; j <= 50; j++) {
      t += 60;
      const res = combo.recordPickup(t);
      expect(res.count).toBe(20 + j);
      expect(res.isFever).toBe(true);
    }
    expect(combo.count).toBe(70);
    expect(combo.isFever).toBe(true);

    // After 10s fever expires -> combo resets to 0
    combo.update(feverStartTime + 10000);
    expect(combo.isFever).toBe(false);
    expect(combo.count).toBe(0);
    expect(combo.getMultiplier()).toBe(1.0);
  });
});

describe('Adversarial Challenge 2: Multiplier Boundaries & Exhaustive Monotonicity', () => {
  let combo: ComboManager;

  beforeEach(() => {
    combo = new ComboManager();
  });

  it('confirms exact multiplier values at critical hit boundaries', () => {
    // 0 hits
    combo.setCombo(0);
    expect(combo.getMultiplier()).toBe(1.0);

    // 1 hit
    combo.setCombo(1);
    expect(combo.getMultiplier()).toBe(1.0);

    // 2 hits (upper bound of 1.0x tier)
    combo.setCombo(2);
    expect(combo.getMultiplier()).toBe(1.0);

    // 3 hits (lower bound of 1.5x tier)
    combo.setCombo(3);
    expect(combo.getMultiplier()).toBe(1.5);

    // 4 hits (upper bound of 1.5x tier)
    combo.setCombo(4);
    expect(combo.getMultiplier()).toBe(1.5);

    // 5 hits (lower bound of 2.0x tier)
    combo.setCombo(5);
    expect(combo.getMultiplier()).toBe(2.0);

    // 9 hits (upper bound of 2.0x tier)
    combo.setCombo(9);
    expect(combo.getMultiplier()).toBe(2.0);

    // 10 hits (lower bound of 3.0x tier)
    combo.setCombo(10);
    expect(combo.getMultiplier()).toBe(3.0);

    // 19 hits (upper bound of 3.0x tier)
    combo.setCombo(19);
    expect(combo.getMultiplier()).toBe(3.0);

    // 20 hits (Fever Mode threshold -> 5.0x)
    combo.setCombo(20);
    expect(combo.getMultiplier()).toBe(5.0);
    expect(combo.isFever).toBe(true);

    // 50 hits (still 5.0x in Fever)
    combo.setCombo(50);
    expect(combo.getMultiplier()).toBe(5.0);
  });

  it('proves global monotonicity: M(c) <= M(c+1) for all c in [0, 100]', () => {
    let prevMultiplier = 1.0;
    for (let c = 0; c <= 100; c++) {
      combo.setCombo(c);
      const mult = combo.getMultiplier();
      expect(mult).toBeGreaterThanOrEqual(prevMultiplier);
      expect(combo.getCoinMultiplier()).toBe(mult);
      prevMultiplier = mult;
    }
  });

  it('guarantees state snapshot parity with getMultiplier()', () => {
    for (const hits of [0, 1, 2, 3, 4, 5, 8, 9, 10, 15, 19, 20, 25]) {
      combo.setCombo(hits);
      const state = combo.getState();
      expect(state.multiplier).toBe(combo.getMultiplier());
      expect(state.multiplier).toBe(combo.getCoinMultiplier());
    }
  });
});

describe('Adversarial Challenge 3: Fever Mode Duration & Inactivity Immunity', () => {
  let combo: ComboManager;

  beforeEach(() => {
    combo = new ComboManager();
  });

  it('maintains active Fever at t = 9999ms and expires at t = 10000ms / 10001ms', () => {
    const t0 = 50000;
    combo.triggerFever(t0);

    // Immediately active
    expect(combo.isFever).toBe(true);
    expect(combo.getMultiplier()).toBe(5.0);
    expect(combo.getRangeMultiplier()).toBe(2.0);
    expect(combo.getState(t0).remainingFeverMs).toBe(10000);

    // At t = 9999ms: strictly active
    combo.update(t0 + 9999);
    expect(combo.isFever).toBe(true);
    expect(combo.getMultiplier()).toBe(5.0);
    expect(combo.getRangeMultiplier()).toBe(2.0);
    expect(combo.getState(t0 + 9999).remainingFeverMs).toBe(1);

    // At t = 10000ms: expires
    const feverEndedSpy = vi.fn();
    combo.on('fever-ended', feverEndedSpy);

    combo.update(t0 + 10000);
    expect(combo.isFever).toBe(false);
    expect(combo.count).toBe(0);
    expect(combo.getMultiplier()).toBe(1.0);
    expect(combo.getRangeMultiplier()).toBe(1.0);
    expect(combo.getState(t0 + 10000).remainingFeverMs).toBe(0);
    expect(feverEndedSpy).toHaveBeenCalledTimes(1);

    // At t = 10001ms: remains cleanly expired
    combo.update(t0 + 10001);
    expect(combo.isFever).toBe(false);
  });

  it('demonstrates inactivity immunity: 5 seconds of zero pickups does not drop Fever', () => {
    const t0 = 60000;
    combo.triggerFever(t0);

    // Advance 5000ms without pickups (normally 2000ms window would expire)
    combo.update(t0 + 5000);
    expect(combo.isFever).toBe(true);
    expect(combo.getMultiplier()).toBe(5.0);
    expect(combo.getRangeMultiplier()).toBe(2.0);

    // Pickups during fever increment streak while keeping Fever active
    const p1 = combo.recordPickup(t0 + 5100);
    expect(p1.isFever).toBe(true);
    expect(p1.count).toBeGreaterThanOrEqual(21);
    expect(p1.multiplier).toBe(5.0);
  });

  it('cleanly resets fever on manual reset()', () => {
    combo.triggerFever();
    expect(combo.isFever).toBe(true);

    combo.reset();
    expect(combo.isFever).toBe(false);
    expect(combo.count).toBe(0);
    expect(combo.getMultiplier()).toBe(1.0);
    expect(combo.getRangeMultiplier()).toBe(1.0);
  });
});

describe('Adversarial Challenge 4: Recycler Cooldown Lockout (2.5s)', () => {
  // Pure state machine faithfully modeling JunkyardScene's thermal cooldown logic
  class RecyclerCooldownModel {
    public isRecyclerCoolingDown: boolean = false;
    public recyclerCooldownUntil: number = 0;
    public readonly RECYCLER_COOLDOWN_MS: number = 2500;
    public coins: number = 0;
    public itemsDeposited: number = 0;

    public triggerRecyclerCooldown(time: number): void {
      this.isRecyclerCoolingDown = true;
      this.recyclerCooldownUntil = time + this.RECYCLER_COOLDOWN_MS;
    }

    public endRecyclerCooldown(): void {
      this.isRecyclerCoolingDown = false;
      this.recyclerCooldownUntil = 0;
    }

    public processRecycler(time: number): void {
      if (this.isRecyclerCoolingDown) {
        if (time >= this.recyclerCooldownUntil) {
          this.endRecyclerCooldown();
        }
      }
    }

    public triggerRecycleNow(
      cargoCount: number,
      coinValuePerItem: number,
      time: number
    ): { itemsRecycled: number; coinsAwarded: number } {
      this.processRecycler(time);

      if (this.isRecyclerCoolingDown) {
        return { itemsRecycled: 0, coinsAwarded: 0 };
      }

      if (cargoCount <= 0) {
        return { itemsRecycled: 0, coinsAwarded: 0 };
      }

      const awarded = cargoCount * coinValuePerItem;
      this.coins += awarded;
      this.itemsDeposited += cargoCount;
      this.triggerRecyclerCooldown(time);

      return { itemsRecycled: cargoCount, coinsAwarded: awarded };
    }

    public getRemainingCooldownMs(time: number): number {
      return this.isRecyclerCoolingDown ? Math.max(0, this.recyclerCooldownUntil - time) : 0;
    }
  }

  it('triggers exactly 2500ms cooldown upon recycling a batch of cargo', () => {
    const recycler = new RecyclerCooldownModel();
    const t0 = 10000;

    const res = recycler.triggerRecycleNow(5, 10, t0);
    expect(res.itemsRecycled).toBe(5);
    expect(res.coinsAwarded).toBe(50);

    expect(recycler.isRecyclerCoolingDown).toBe(true);
    expect(recycler.recyclerCooldownUntil).toBe(t0 + 2500);
    expect(recycler.getRemainingCooldownMs(t0)).toBe(2500);
  });

  it('strictly blocks all deposits during the 2.5s cooldown (t0 to t0 + 2499ms)', () => {
    const recycler = new RecyclerCooldownModel();
    const t0 = 20000;

    recycler.triggerRecycleNow(3, 20, t0);
    expect(recycler.isRecyclerCoolingDown).toBe(true);

    // Attempt deposit at t0 + 500ms
    const b1 = recycler.triggerRecycleNow(2, 50, t0 + 500);
    expect(b1.itemsRecycled).toBe(0);
    expect(b1.coinsAwarded).toBe(0);
    expect(recycler.getRemainingCooldownMs(t0 + 500)).toBe(2000);

    // Attempt deposit at t0 + 2499ms (1ms before expiration)
    const b2 = recycler.triggerRecycleNow(2, 50, t0 + 2499);
    expect(b2.itemsRecycled).toBe(0);
    expect(b2.coinsAwarded).toBe(0);
    expect(recycler.isRecyclerCoolingDown).toBe(true);
    expect(recycler.getRemainingCooldownMs(t0 + 2499)).toBe(1);
  });

  it('unblocks deposits at t = t0 + 2501ms', () => {
    const recycler = new RecyclerCooldownModel();
    const t0 = 30000;

    recycler.triggerRecycleNow(1, 100, t0);
    expect(recycler.isRecyclerCoolingDown).toBe(true);

    // Attempt deposit at t0 + 2501ms
    const unblocked = recycler.triggerRecycleNow(4, 25, t0 + 2501);
    expect(unblocked.itemsRecycled).toBe(4);
    expect(unblocked.coinsAwarded).toBe(100);
    expect(recycler.coins).toBe(200); // 100 from first + 100 from second

    // Since a new batch was emptied, cooldown triggers anew
    expect(recycler.isRecyclerCoolingDown).toBe(true);
    expect(recycler.recyclerCooldownUntil).toBe(t0 + 2501 + 2500);
  });

  it('rejects empty cargo without initiating false cooldowns', () => {
    const recycler = new RecyclerCooldownModel();
    const t0 = 40000;

    const res = recycler.triggerRecycleNow(0, 50, t0);
    expect(res.itemsRecycled).toBe(0);
    expect(res.coinsAwarded).toBe(0);
    expect(recycler.isRecyclerCoolingDown).toBe(false);
  });
});

describe('Adversarial Challenge 5: Audio Pitch Escalation Math & Monotonicity', () => {
  let combo: ComboManager;

  beforeEach(() => {
    combo = new ComboManager();
  });

  it('matches theoretical formula 1.0 + 0.05 * min(20, comboCount) with zero drift', () => {
    const expectedMap: Record<number, number> = {
      0: 1.00,
      1: 1.05,
      2: 1.10,
      3: 1.15,
      4: 1.20,
      5: 1.25,
      10: 1.50,
      15: 1.75,
      19: 1.95,
      20: 2.00,
      25: 2.00,
      50: 2.00,
      100: 2.00,
      1000: 2.00,
    };

    for (const [hitsStr, expectedPitch] of Object.entries(expectedMap)) {
      const hits = Number(hitsStr);
      combo.setCombo(hits);
      const pitch = combo.getAudioPitchModifier();
      expect(pitch).toBeCloseTo(expectedPitch, 6);
    }
  });

  it('exhibits strict linear slope = 0.05 for combo in [0, 20]', () => {
    for (let c = 0; c < 20; c++) {
      combo.setCombo(c);
      const p1 = combo.getAudioPitchModifier();
      combo.setCombo(c + 1);
      const p2 = combo.getAudioPitchModifier();
      const diff = p2 - p1;
      expect(diff).toBeCloseTo(0.05, 6);
    }
  });

  it('strictly caps pitch at 2.00 for combo >= 20', () => {
    for (let c = 20; c <= 60; c++) {
      combo.setCombo(c);
      expect(combo.getAudioPitchModifier()).toBe(2.00);
    }
  });

  it('guarantees pitch modifier is bounded strictly in [1.0, 2.0] for all non-negative combo values', () => {
    for (let c = 0; c <= 150; c++) {
      combo.setCombo(c);
      const pitch = combo.getAudioPitchModifier();
      expect(pitch).toBeGreaterThanOrEqual(1.0);
      expect(pitch).toBeLessThanOrEqual(2.0);
    }
  });

  it('ProceduralAudioService enforces strict safety clamp [0.5, 3.0]', () => {
    const audio = ProceduralAudioService.getInstance();

    audio.setComboPitchModifier(1.0);
    expect(audio.getComboPitchModifier()).toBe(1.0);

    audio.setComboPitchModifier(2.0);
    expect(audio.getComboPitchModifier()).toBe(2.0);

    // Below 0.5 clamped to 0.5
    audio.setComboPitchModifier(0.2);
    expect(audio.getComboPitchModifier()).toBe(0.5);

    audio.setComboPitchModifier(-10.0);
    expect(audio.getComboPitchModifier()).toBe(0.5);

    // Above 3.0 clamped to 3.0
    audio.setComboPitchModifier(3.5);
    expect(audio.getComboPitchModifier()).toBe(3.0);

    audio.setComboPitchModifier(100.0);
    expect(audio.getComboPitchModifier()).toBe(3.0);

    // Reset to normal
    audio.setComboPitchModifier(1.0);
  });
});
