// ============================================================================
// Magnet Junkyard - Main Entry Point
// ============================================================================

import Phaser from 'phaser';
import { phaserGameConfig } from './config/phaserConfig';
import { BootScene } from './scenes/BootScene';
import { JunkyardScene } from './scenes/JunkyardScene';
import { UIScene } from './scenes/UIScene';
import { TestBridge } from './services/testing/TestBridge';
import { getCrazyGamesSDK } from './services/crazygames/MockCrazyGamesSDK';

async function bootstrap() {
  const sdk = getCrazyGamesSDK();
  try {
    await sdk.init();
  } catch (err) {
    console.warn('[CrazyGames] SDK init error:', err);
  }

  try {
    sdk.game.loadingStart();
  } catch (err) {
    console.warn('[CrazyGames] loadingStart error:', err);
  }

  const config: Phaser.Types.Core.GameConfig = {
    ...phaserGameConfig,
    scene: [BootScene, JunkyardScene, UIScene],
  };

  const game = new Phaser.Game(config);

  // Mount Testability Hook Bridge onto window.__MAGNET_GAME__
  TestBridge.init(game);

  return game;
}

const gamePromise = bootstrap().catch((err) => {
  console.error('[MagnetJunkyard] Fatal bootstrap error:', err);
});

export default gamePromise;
