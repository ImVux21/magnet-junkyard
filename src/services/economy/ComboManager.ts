// ============================================================================
// Magnet Junkyard - Dynamic Combo & Fever Mode State Machine
// ============================================================================

export interface ComboState {
  count: number;
  multiplier: number;
  isFever: boolean;
  remainingFeverMs: number;
  remainingWindowMs: number;
  pitchModifier: number;
}

export type ComboEventType = 'combo-updated' | 'combo-expired' | 'fever-started' | 'fever-ended';
export type ComboEventListener = (data: ComboState) => void;

export class ComboManager {
  public static readonly COMBO_WINDOW_MS = 2000;
  public static readonly FEVER_DURATION_MS = 10000;
  public static readonly FEVER_HIT_THRESHOLD = 20;

  private feverDurationMs: number = ComboManager.FEVER_DURATION_MS;
  private comboCount: number = 0;
  private lastPickupTime: number = 0;
  private isFeverActive: boolean = false;
  private feverExpiresAt: number = 0;

  private listeners: Map<ComboEventType, Set<ComboEventListener>> = new Map();

  constructor() {
    this.listeners.set('combo-updated', new Set());
    this.listeners.set('combo-expired', new Set());
    this.listeners.set('fever-started', new Set());
    this.listeners.set('fever-ended', new Set());
  }

  public setFeverDurationMs(ms: number): void {
    this.feverDurationMs = Math.max(5000, ms);
  }

  // --------------------------------------------------------------------------
  // Event Subscription
  // --------------------------------------------------------------------------
  public on(event: ComboEventType, listener: ComboEventListener): () => void {
    const set = this.listeners.get(event);
    if (set) {
      set.add(listener);
    }
    return () => this.off(event, listener);
  }

  public off(event: ComboEventType, listener: ComboEventListener): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  private emit(event: ComboEventType, state?: ComboState): void {
    const current = state ?? this.getState();
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(current);
        } catch (err) {
          console.error(`[ComboManager] Listener error on event '${event}':`, err);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // State Accessors
  // --------------------------------------------------------------------------
  public get count(): number {
    return this.comboCount;
  }

  public get isFever(): boolean {
    return this.isFeverActive;
  }

  public getMultiplier(): number {
    if (this.isFeverActive) {
      return 5.0;
    }
    if (this.comboCount >= ComboManager.FEVER_HIT_THRESHOLD) {
      return 5.0;
    }
    if (this.comboCount >= 10) {
      return 3.0;
    }
    if (this.comboCount >= 5) {
      return 2.0;
    }
    if (this.comboCount >= 3) {
      return 1.5;
    }
    return 1.0;
  }

  /**
   * Audio pitch escalation formula:
   * 1.0 + 0.05 * min(20, comboCount) -> ranges from 1.0x up to 2.0x
   */
  public getAudioPitchModifier(): number {
    return 1.0 + 0.05 * Math.min(20, this.comboCount);
  }

  /**
   * Effective magnet attraction range multiplier (2.0x during Fever Mode).
   */
  public getRangeMultiplier(): number {
    return this.isFeverActive ? 2.0 : 1.0;
  }

  /**
   * Coin value multiplier applied to recycled scrap.
   */
  public getCoinMultiplier(): number {
    return this.getMultiplier();
  }

  public getState(currentTime: number = Date.now()): ComboState {
    const remainingFeverMs = this.isFeverActive ? Math.max(0, this.feverExpiresAt - currentTime) : 0;
    const remainingWindowMs =
      !this.isFeverActive && this.comboCount > 0 && this.lastPickupTime > 0
        ? Math.max(0, ComboManager.COMBO_WINDOW_MS - (currentTime - this.lastPickupTime))
        : 0;

    return {
      count: this.comboCount,
      multiplier: this.getMultiplier(),
      isFever: this.isFeverActive,
      remainingFeverMs,
      remainingWindowMs,
      pitchModifier: this.getAudioPitchModifier(),
    };
  }

  // --------------------------------------------------------------------------
  // Core State Machine Update & Pickup Recording
  // --------------------------------------------------------------------------
  /**
   * Periodic tick update to check timing windows and fever expiration.
   */
  public update(currentTime: number = Date.now()): void {
    if (this.isFeverActive) {
      if (currentTime >= this.feverExpiresAt) {
        this.isFeverActive = false;
        this.feverExpiresAt = 0;
        this.comboCount = 0;
        this.lastPickupTime = 0;
        const state = this.getState(currentTime);
        this.emit('fever-ended', state);
        this.emit('combo-updated', state);
      }
    } else if (this.comboCount > 0) {
      if (currentTime - this.lastPickupTime > ComboManager.COMBO_WINDOW_MS) {
        this.comboCount = 0;
        this.lastPickupTime = 0;
        const state = this.getState(currentTime);
        this.emit('combo-expired', state);
        this.emit('combo-updated', state);
      }
    }
  }

  /**
   * Records a scrap pickup event.
   * If within 2.0s window, increments combo.
   * At 20 hits, triggers Fever Mode (10s duration).
   */
  public recordPickup(currentTime: number = Date.now()): {
    count: number;
    multiplier: number;
    isFever: boolean;
    triggeredFever: boolean;
    pitchModifier: number;
  } {
    // Process any overdue expiration at current time
    this.update(currentTime);

    let triggeredFever = false;

    if (this.isFeverActive) {
      // During fever mode, pickups increment combo streak and maintain fever state
      this.comboCount++;
      this.lastPickupTime = currentTime;
    } else {
      if (this.lastPickupTime > 0 && currentTime - this.lastPickupTime <= ComboManager.COMBO_WINDOW_MS) {
        this.comboCount++;
      } else {
        this.comboCount = 1;
      }
      this.lastPickupTime = currentTime;

      if (this.comboCount >= ComboManager.FEVER_HIT_THRESHOLD) {
        this.isFeverActive = true;
        this.feverExpiresAt = currentTime + this.feverDurationMs;
        triggeredFever = true;
      }
    }

    const state = this.getState(currentTime);

    if (triggeredFever) {
      this.emit('fever-started', state);
    }
    this.emit('combo-updated', state);

    return {
      count: this.comboCount,
      multiplier: state.multiplier,
      isFever: this.isFeverActive,
      triggeredFever,
      pitchModifier: state.pitchModifier,
    };
  }

  // --------------------------------------------------------------------------
  // Programmatic Actions & Test Hooks
  // --------------------------------------------------------------------------
  public setCombo(count: number, currentTime: number = Date.now()): void {
    const clamped = Math.max(0, Math.floor(count));
    this.comboCount = clamped;

    if (clamped >= ComboManager.FEVER_HIT_THRESHOLD) {
      this.isFeverActive = true;
      this.feverExpiresAt = currentTime + this.feverDurationMs;
      this.lastPickupTime = currentTime;
      const state = this.getState(currentTime);
      this.emit('fever-started', state);
      this.emit('combo-updated', state);
    } else if (clamped > 0) {
      this.isFeverActive = false;
      this.feverExpiresAt = 0;
      this.lastPickupTime = currentTime;
      this.emit('combo-updated', this.getState(currentTime));
    } else {
      this.reset(currentTime);
    }
  }

  public triggerFever(currentTime: number = Date.now(), durationMs: number = ComboManager.FEVER_DURATION_MS): void {
    this.isFeverActive = true;
    this.comboCount = Math.max(ComboManager.FEVER_HIT_THRESHOLD, this.comboCount);
    this.lastPickupTime = currentTime;
    this.feverExpiresAt = currentTime + durationMs;

    const state = this.getState(currentTime);
    this.emit('fever-started', state);
    this.emit('combo-updated', state);
  }

  public reset(currentTime: number = Date.now()): void {
    const wasFever = this.isFeverActive;
    this.comboCount = 0;
    this.lastPickupTime = 0;
    this.isFeverActive = false;
    this.feverExpiresAt = 0;

    const state = this.getState(currentTime);
    if (wasFever) {
      this.emit('fever-ended', state);
    }
    this.emit('combo-updated', state);
  }
}
