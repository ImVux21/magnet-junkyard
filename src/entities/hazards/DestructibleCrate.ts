// ============================================================================
// Magnet Junkyard - Destructible Pinata Scrap Crate
// ============================================================================

import Phaser from 'phaser';
import { JunkyardScene } from '../../scenes/JunkyardScene';

export class DestructibleCrate extends Phaser.GameObjects.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  public zoneTier: number = 1;
  public isDestroyed: boolean = false;
  private respawnTimer: Phaser.Time.TimerEvent | null = null;
  private readonly RESPAWN_DELAY_MS: number = 45000; // 45 seconds

  constructor(scene: Phaser.Scene, x: number, y: number, zoneTier: number = 1) {
    super(scene, x, y, 'scrap_crate');
    this.zoneTier = zoneTier;

    scene.add.existing(this);
    scene.physics.world.enable(this);

    if (typeof this.setDisplaySize === 'function') {
      this.setDisplaySize(44, 44);
    }
    this.body.setImmovable(true);
    this.body.setSize(38, 38);
    this.setDepth(15);
  }

  public breakCrate(junkyard: JunkyardScene, _byPulse: boolean = false): void {
    if (this.isDestroyed || !this.active) return;
    this.isDestroyed = true;

    // Visual & audio feedback (Per game-feel skill: multi-channel feedback)
    junkyard.audioService.playCompressorCrunch();
    if (junkyard.crateDebrisEmitter) {
      junkyard.crateDebrisEmitter.explode(20, this.x, this.y);
    }
    if (junkyard.sparkEmitter) {
      junkyard.sparkEmitter.explode(8, this.x, this.y);
    }

    junkyard.triggerScreenShake(160, 0.010);

    // Spawn 4 to 6 pieces of scrap (Pinata Effect)
    const scrapCount = Phaser.Math.Between(4, 6);
    let goldenSpawned = false;

    // Available scrap catalog keys for this tier
    const tierTypes: Record<number, string[]> = {
      1: ['screw', 'tin_can', 'copper_wire'],
      2: ['rusty_pipe', 'iron_gear', 'fan_belt'],
      3: ['car_battery', 'brass_radiator', 'alternator'],
      4: ['catalytic_converter', 'engine_block', 'steel_chassis'],
    };

    const typePool = tierTypes[this.zoneTier] || tierTypes[1];

    for (let i = 0; i < scrapCount; i++) {
      const typeId = Phaser.Math.RND.pick(typePool);
      const offsetX = Phaser.Math.Between(-35, 35);
      const offsetY = Phaser.Math.Between(-35, 35);
      const isGolden = Math.random() < 0.15; // 15% golden scrap chance!
      if (isGolden) goldenSpawned = true;

      const item = junkyard.scrapPool.spawn(typeId, this.x + offsetX, this.y + offsetY, this.zoneTier, isGolden);
      if (item && item.body) {
        // Pop outward radially
        const angle = Math.random() * Math.PI * 2;
        const popSpeed = Phaser.Math.Between(90, 160);
        item.body.setVelocity(Math.cos(angle) * popSpeed, Math.sin(angle) * popSpeed);
      }
    }

    const textMsg = goldenSpawned ? '✨ JACKPOT! GOLDEN CRATE!' : `💥 CRATE SMASH! +${scrapCount} SCRAP!`;
    const textColor = goldenSpawned ? '#ffd700' : '#00e5ff';
    junkyard.showFloatingText(this.x, this.y - 20, textMsg, textColor, 15);

    // Disable physics body & hide
    this.setVisible(false);
    this.body.enable = false;

    // Respawn timer
    this.respawnTimer = this.scene.time.delayedCall(this.RESPAWN_DELAY_MS, () => {
      this.respawnCrate();
    });
  }

  public respawnCrate(): void {
    this.isDestroyed = false;
    this.setVisible(true);
    this.body.enable = true;
    this.setScale(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 350,
      ease: 'Back.out',
    });
  }

  public destroy(): void {
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this);
    }
    if (this.respawnTimer) {
      this.respawnTimer.destroy();
      this.respawnTimer = null;
    }
    super.destroy();
  }
}
