// ============================================================================
// Magnet Junkyard - Active Ability Manager (Magnetic Pulse)
// ============================================================================

export interface AbilityState {
  ready: boolean;
  remainingCooldownMs: number;
  totalCooldownMs: number;
  progress: number; // 0 (cooling down) to 1.0 (ready)
}

export class AbilityManager {
  public static readonly PULSE_COOLDOWN_MS = 12000; // 12 seconds

  private pulseReadyAt: number = 0;
  private cooldownMs: number = AbilityManager.PULSE_COOLDOWN_MS;

  constructor(cooldownMs: number = AbilityManager.PULSE_COOLDOWN_MS) {
    this.cooldownMs = cooldownMs;
    this.pulseReadyAt = 0; // ready on start
  }

  public setCooldownMs(ms: number): void {
    this.cooldownMs = Math.max(3000, ms);
  }

  public canUsePulse(currentTime: number = Date.now()): boolean {
    return currentTime >= this.pulseReadyAt;
  }

  public triggerPulse(currentTime: number = Date.now()): boolean {
    if (!this.canUsePulse(currentTime)) {
      return false;
    }
    this.pulseReadyAt = currentTime + this.cooldownMs;
    return true;
  }

  /**
   * Instantly refreshes pulse cooldown (e.g. entering Fever Mode).
   */
  public resetCooldown(): void {
    this.pulseReadyAt = 0;
  }

  public getState(currentTime: number = Date.now()): AbilityState {
    const remaining = Math.max(0, this.pulseReadyAt - currentTime);
    const ready = remaining <= 0;
    const progress = ready ? 1.0 : Math.max(0, Math.min(1.0, 1.0 - remaining / this.cooldownMs));

    return {
      ready,
      remainingCooldownMs: remaining,
      totalCooldownMs: this.cooldownMs,
      progress,
    };
  }
}
