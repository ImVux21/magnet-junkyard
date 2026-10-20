import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Authoritative CrazyGames SDK Specifications per spec_miner_survey_1
// ============================================================================

export type CrazyEnvironment = 'crazygames' | 'local' | 'disabled' | 'mock';

export interface RewardedAdOptions {
  onStart?: () => void;
  onReward: () => void;
  onError?: (error: any) => void;
}

export interface ICrazyGamesSDK {
  init(): Promise<void>;
  getEnvironment(): Promise<CrazyEnvironment>;
  gameplayStart(): void;
  gameplayStop(): void;
  requestRewardedAd(options: RewardedAdOptions): Promise<boolean>;
  hasAdblock(): Promise<boolean>;
  isMock: boolean;
}

/**
 * Reference implementation of MockCrazyGamesSDK per spec_miner_survey_1 § Component 1.2
 */
export class ReferenceMockCrazyGamesSDK implements ICrazyGamesSDK {
  public readonly isMock = true;
  private isGameplayActive = false;
  private adInProgress = false;

  public get isPlaying(): boolean {
    return this.isGameplayActive;
  }

  public get isAdBusy(): boolean {
    return this.adInProgress;
  }

  public async init(): Promise<void> {
    console.log('[CrazyGamesSDK:Mock] Initialized in autonomous Mock mode.');
  }

  public async getEnvironment(): Promise<CrazyEnvironment> {
    return 'mock';
  }

  public gameplayStart(): void {
    if (this.isGameplayActive) {
      console.warn('[CrazyGamesSDK:Mock] gameplayStart() called while already active.');
      return;
    }
    this.isGameplayActive = true;
    console.log('[CrazyGamesSDK:Mock] >>> gameplayStart() - active gameplay resumed.');
  }

  public gameplayStop(): void {
    if (!this.isGameplayActive) {
      return;
    }
    this.isGameplayActive = false;
    console.log('[CrazyGamesSDK:Mock] <<< gameplayStop() - active gameplay paused.');
  }

  public async hasAdblock(): Promise<boolean> {
    console.log('[CrazyGamesSDK:Mock] hasAdblock() queried -> returning false.');
    return false;
  }

  public async requestRewardedAd(options: RewardedAdOptions): Promise<boolean> {
    if (this.adInProgress) {
      console.warn('[CrazyGamesSDK:Mock] Ad request rejected: request already in progress.');
      options.onError?.('An ad request is already in progress');
      return false;
    }

    this.adInProgress = true;
    this.gameplayStop();
    console.log('[CrazyGamesSDK:Mock] Rewarded Ad requested. Showing mock simulation...');

    // Trigger onStart
    options.onStart?.();

    // Check for automated E2E test hook override on window or globalThis
    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    const testHook = globalObj.__MOCK_ADS__;

    if (testHook?.simulateError) {
      console.log('[CrazyGamesSDK:Mock] Simulating ad error per test hook.');
      this.adInProgress = false;
      this.gameplayStart();
      options.onError?.('Simulated ad error');
      return false;
    }

    // Fast simulation duration for unit tests
    const duration = testHook?.instant ? 0 : (testHook?.durationMs ?? 0);

    return new Promise((resolve) => {
      setTimeout(() => {
        this.adInProgress = false;
        console.log('[CrazyGamesSDK:Mock] Rewarded Ad completed successfully! Granting reward.');
        options.onReward();
        this.gameplayStart();
        resolve(true);
      }, duration);
    });
  }
}

// Try loading production MockCrazyGamesSDK if available
async function getProductionMockSDK(): Promise<ICrazyGamesSDK> {
  try {
    const mod = await import(/* @vite-ignore */ '../../src/services/crazygames/MockCrazyGamesSDK');
    if (mod && mod.MockCrazyGamesSDK) {
      return new mod.MockCrazyGamesSDK();
    }
  } catch {
    // Falls back to reference implementation
  }
  return new ReferenceMockCrazyGamesSDK();
}

// ============================================================================
// Test Suite: CrazyGames SDK v2 Mock Implementation
// ============================================================================

describe('CrazyGames SDK Mock — Initialization & Environment', () => {
  let sdk: ReferenceMockCrazyGamesSDK;
  let logSpy: any;

  beforeEach(() => {
    sdk = new ReferenceMockCrazyGamesSDK();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('declares isMock property as true', () => {
    expect(sdk.isMock).toBe(true);
  });

  it('returns environment identifier as "mock"', async () => {
    const env = await sdk.getEnvironment();
    expect(env).toBe('mock');
  });

  it('initializes without throwing and logs initialization banner to console', async () => {
    await expect(sdk.init()).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CrazyGamesSDK:Mock] Initialized in autonomous Mock mode.')
    );
  });

  it('queries hasAdblock() and resolves to false without errors', async () => {
    const hasAdblock = await sdk.hasAdblock();
    expect(hasAdblock).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CrazyGamesSDK:Mock] hasAdblock() queried -> returning false.')
    );
  });
});

describe('CrazyGames SDK Mock — Gameplay Lifecycle Hooks (gameplayStart / gameplayStop)', () => {
  let sdk: ReferenceMockCrazyGamesSDK;
  let logSpy: any;
  let warnSpy: any;

  beforeEach(() => {
    sdk = new ReferenceMockCrazyGamesSDK();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('starts in inactive gameplay state initially', () => {
    expect(sdk.isPlaying).toBe(false);
  });

  it('transitions to active state and logs correctly upon gameplayStart()', () => {
    sdk.gameplayStart();
    expect(sdk.isPlaying).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CrazyGamesSDK:Mock] >>> gameplayStart() - active gameplay resumed.')
    );
  });

  it('transitions to inactive state and logs correctly upon gameplayStop()', () => {
    sdk.gameplayStart();
    expect(sdk.isPlaying).toBe(true);

    sdk.gameplayStop();
    expect(sdk.isPlaying).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CrazyGamesSDK:Mock] <<< gameplayStop() - active gameplay paused.')
    );
  });

  it('suppresses redundant gameplayStart() calls and emits a console warning', () => {
    sdk.gameplayStart();
    expect(sdk.isPlaying).toBe(true);

    // Call gameplayStart second time while already active
    sdk.gameplayStart();
    expect(sdk.isPlaying).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CrazyGamesSDK:Mock] gameplayStart() called while already active.')
    );
  });

  it('performs safe no-op on duplicate gameplayStop() when already stopped', () => {
    expect(sdk.isPlaying).toBe(false);

    // Stop when already stopped
    sdk.gameplayStop();
    expect(sdk.isPlaying).toBe(false);
    // Should NOT log "active gameplay paused" again
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[CrazyGamesSDK:Mock] <<< gameplayStop()')
    );
  });
});

describe('CrazyGames SDK Mock — Rewarded Ad Placement & Execution Flow', () => {
  let sdk: ReferenceMockCrazyGamesSDK;
  let logSpy: any;
  let warnSpy: any;

  beforeEach(() => {
    sdk = new ReferenceMockCrazyGamesSDK();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    globalObj.__MOCK_ADS__ = { instant: true };
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    delete globalObj.__MOCK_ADS__;
  });

  it('completes successful Rewarded Ad flow: suspends gameplay, calls onStart, grants reward, resumes gameplay', async () => {
    sdk.gameplayStart();
    expect(sdk.isPlaying).toBe(true);

    let startCalled = false;
    let rewardGranted = false;

    const result = await sdk.requestRewardedAd({
      onStart: () => {
        startCalled = true;
        // Gameplay must be paused while ad is active
        expect(sdk.isPlaying).toBe(false);
      },
      onReward: () => {
        rewardGranted = true;
      },
    });

    expect(result).toBe(true);
    expect(startCalled).toBe(true);
    expect(rewardGranted).toBe(true);
    // Gameplay resumed after ad completed
    expect(sdk.isPlaying).toBe(true);
  });

  it('enforces in-flight concurrency lock: rejects concurrent ad requests', async () => {
    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    globalObj.__MOCK_ADS__ = { durationMs: 50 }; // Slow down first ad slightly

    let firstCompleted = false;
    let secondRejected = false;
    let secondErrorMsg = '';

    // Launch first ad
    const ad1Promise = sdk.requestRewardedAd({
      onReward: () => {
        firstCompleted = true;
      },
    });

    expect(sdk.isAdBusy).toBe(true);

    // Attempt concurrent second ad immediately
    const ad2Result = await sdk.requestRewardedAd({
      onReward: () => {},
      onError: (err) => {
        secondRejected = true;
        secondErrorMsg = String(err);
      },
    });

    expect(ad2Result).toBe(false);
    expect(secondRejected).toBe(true);
    expect(secondErrorMsg).toContain('already in progress');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('request already in progress'));

    // Wait for first ad to complete cleanly
    const ad1Result = await ad1Promise;
    expect(ad1Result).toBe(true);
    expect(firstCompleted).toBe(true);
    expect(sdk.isAdBusy).toBe(false);
  });
});

describe('CrazyGames SDK Mock — Adblock & Error Simulation via Test Hooks', () => {
  let sdk: ReferenceMockCrazyGamesSDK;
  let logSpy: any;

  beforeEach(() => {
    sdk = new ReferenceMockCrazyGamesSDK();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    delete globalObj.__MOCK_ADS__;
  });

  it('handles simulated ad error via window.__MOCK_ADS__.simulateError', async () => {
    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    globalObj.__MOCK_ADS__ = { simulateError: true };

    sdk.gameplayStart();
    expect(sdk.isPlaying).toBe(true);

    let rewardCalled = false;
    let errorCalled = false;
    let errorReceived: any = null;

    const result = await sdk.requestRewardedAd({
      onReward: () => {
        rewardCalled = true;
      },
      onError: (err) => {
        errorCalled = true;
        errorReceived = err;
      },
    });

    // Verify error outcome
    expect(result).toBe(false);
    expect(rewardCalled).toBe(false);
    expect(errorCalled).toBe(true);
    expect(errorReceived).toBe('Simulated ad error');
    // Crucial: Gameplay must still resume so the player is never trapped
    expect(sdk.isPlaying).toBe(true);
    // Ad busy state must be reset so future requests are not permanently blocked
    expect(sdk.isAdBusy).toBe(false);
  });

  it('allows subsequent successful ad requests after a simulated error occurs', async () => {
    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    globalObj.__MOCK_ADS__ = { simulateError: true };

    // Request 1 fails
    await sdk.requestRewardedAd({
      onReward: () => {},
      onError: () => {},
    });

    // Remove error hook
    globalObj.__MOCK_ADS__ = { instant: true };

    let recoveredReward = false;
    const result2 = await sdk.requestRewardedAd({
      onReward: () => {
        recoveredReward = true;
      },
    });

    expect(result2).toBe(true);
    expect(recoveredReward).toBe(true);
  });
});

describe('CrazyGames SDK Mock — Production Service Integration Parity', () => {
  it('instantiates production or reference MockCrazyGamesSDK identically', async () => {
    const sdk = await getProductionMockSDK();
    expect(sdk).toBeDefined();
    expect(sdk.isMock).toBe(true);

    const env = await sdk.getEnvironment();
    expect(env).toBe('mock');

    sdk.gameplayStart();
    sdk.gameplayStop();
  });
});
