// ============================================================================
// Magnet Junkyard - CrazyGames SDK v3 Integration & Resilient Adapter
// ============================================================================

export type CrazyEnvironment = 'crazygames' | 'local' | 'disabled' | 'mock';

export interface RewardedAdOptions {
  adStarted?: () => void;
  adFinished: () => void;
  adError?: (error: any) => void;
}

export interface CrazyGameSettings {
  muteAudio?: boolean;
}

export interface ICrazyGamesSDK {
  init(): Promise<void>;
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    addSettingsChangeListener?(listener: (settings: CrazyGameSettings) => void): void;
    removeSettingsChangeListener?(listener: (settings: CrazyGameSettings) => void): void;
  };
  ad: {
    requestAd(type: 'rewarded' | 'midgame', options: RewardedAdOptions): void;
    hasAdblock(): Promise<boolean>;
  };
}

class MockCrazyGamesSDK implements ICrazyGamesSDK {
  private isGameplayActive = false;
  private adInProgress = false;

  public async init(): Promise<void> {
    console.log('[CrazyGamesSDK:Mock] Initialized in Mock mode.');
  }

  public game = {
    gameplayStart: () => {
      this.isGameplayActive = true;
      console.log('[CrazyGamesSDK:Mock] gameplayStart()');
    },
    gameplayStop: () => {
      this.isGameplayActive = false;
      console.log('[CrazyGamesSDK:Mock] gameplayStop()');
    },
    loadingStart: () => {
      console.log('[CrazyGamesSDK:Mock] loadingStart()');
    },
    loadingStop: () => {
      console.log('[CrazyGamesSDK:Mock] loadingStop()');
    },
    happytime: () => {
      console.log('[CrazyGamesSDK:Mock] happytime() 🎉');
    },
    addSettingsChangeListener: (_listener: (settings: CrazyGameSettings) => void) => {},
    removeSettingsChangeListener: (_listener: (settings: CrazyGameSettings) => void) => {},
  };

  public ad = {
    requestAd: (_type: 'rewarded' | 'midgame', options: RewardedAdOptions) => {
      if (this.adInProgress) {
        if (options.adError) options.adError('Ad in progress');
        return;
      }
      this.adInProgress = true;
      const wasPlaying = this.isGameplayActive;
      if (wasPlaying) this.game.gameplayStop();

      if (options.adStarted) options.adStarted();

      setTimeout(() => {
        this.adInProgress = false;
        try {
          options.adFinished();
        } catch (e) {
          console.error('[CrazyGamesSDK:Mock] Error in adFinished:', e);
        }
        if (wasPlaying) this.game.gameplayStart();
      }, 500);
    },
    hasAdblock: async () => false,
  };
}

class CrazyGamesSDKAdapter implements ICrazyGamesSDK {
  private mock = new MockCrazyGamesSDK();
  private isInitialized = false;

  private get realSDK(): any {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    return win?.CrazyGames?.SDK || null;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    const real = this.realSDK;
    if (real && typeof real.init === 'function') {
      try {
        await real.init();
        this.isInitialized = true;
        console.log('[CrazyGamesSDK] Official CrazyGames SDK v3 initialized.');
        return;
      } catch (e) {
        console.warn('[CrazyGamesSDK] Official init failed, falling back to mock:', e);
      }
    }
    await this.mock.init();
    this.isInitialized = true;
  }

  public game = {
    gameplayStart: () => {
      const real = this.realSDK;
      if (real?.game?.gameplayStart) {
        try {
          real.game.gameplayStart();
          return;
        } catch (e) {
          console.warn('[CrazyGamesSDK] gameplayStart error:', e);
        }
      }
      this.mock.game.gameplayStart();
    },
    gameplayStop: () => {
      const real = this.realSDK;
      if (real?.game?.gameplayStop) {
        try {
          real.game.gameplayStop();
          return;
        } catch (e) {
          console.warn('[CrazyGamesSDK] gameplayStop error:', e);
        }
      }
      this.mock.game.gameplayStop();
    },
    loadingStart: () => {
      const real = this.realSDK;
      if (real?.game?.loadingStart) {
        try {
          real.game.loadingStart();
          return;
        } catch (e) {
          console.warn('[CrazyGamesSDK] loadingStart error:', e);
        }
      }
      this.mock.game.loadingStart();
    },
    loadingStop: () => {
      const real = this.realSDK;
      if (real?.game?.loadingStop) {
        try {
          real.game.loadingStop();
          return;
        } catch (e) {
          console.warn('[CrazyGamesSDK] loadingStop error:', e);
        }
      }
      this.mock.game.loadingStop();
    },
    happytime: () => {
      const real = this.realSDK;
      if (real?.game?.happytime) {
        try {
          real.game.happytime();
          return;
        } catch (e) {
          console.warn('[CrazyGamesSDK] happytime error:', e);
        }
      }
      this.mock.game.happytime();
    },
    addSettingsChangeListener: (listener: (settings: CrazyGameSettings) => void) => {
      const real = this.realSDK;
      if (real?.game?.addSettingsChangeListener) {
        try {
          real.game.addSettingsChangeListener(listener);
          return;
        } catch (e) {
          console.warn('[CrazyGamesSDK] addSettingsChangeListener error:', e);
        }
      }
      this.mock.game.addSettingsChangeListener(listener);
    },
    removeSettingsChangeListener: (listener: (settings: CrazyGameSettings) => void) => {
      const real = this.realSDK;
      if (real?.game?.removeSettingsChangeListener) {
        try {
          real.game.removeSettingsChangeListener(listener);
          return;
        } catch (e) {
          console.warn('[CrazyGamesSDK] removeSettingsChangeListener error:', e);
        }
      }
      this.mock.game.removeSettingsChangeListener(listener);
    },
  };

  public ad = {
    requestAd: (type: 'rewarded' | 'midgame', options: RewardedAdOptions) => {
      const real = this.realSDK;
      if (real?.ad?.requestAd) {
        try {
          real.ad.requestAd(type, {
            adStarted: () => {
              if (options.adStarted) options.adStarted();
            },
            adFinished: () => {
              options.adFinished();
            },
            adError: (error: any, errorData: any) => {
              console.warn('[CrazyGamesSDK] Ad error:', error, errorData);
              if (options.adError) options.adError(error);
            },
          });
          return;
        } catch (e) {
          console.warn('[CrazyGamesSDK] Failed calling real requestAd, falling back to mock:', e);
        }
      }
      this.mock.ad.requestAd(type, options);
    },
    hasAdblock: async () => {
      const real = this.realSDK;
      if (real?.ad?.hasAdblock) {
        try {
          return await real.ad.hasAdblock();
        } catch {}
      }
      return this.mock.ad.hasAdblock();
    },
  };
}

let sdkAdapter: ICrazyGamesSDK | null = null;

export function getCrazyGamesSDK(): ICrazyGamesSDK {
  if (!sdkAdapter) {
    sdkAdapter = new CrazyGamesSDKAdapter();
  }
  return sdkAdapter;
}
