// ============================================================================
// Magnet Junkyard - EMP Mine Entity (Magnetic Hazard)
// ============================================================================

import Phaser from 'phaser';
import { PlayerRover } from '../PlayerRover';
import { ScrapItemData } from '../../config/constants';

export class EMPMine extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;
  public isArmed: boolean = true;
  private respawnAt: number = 0;
  private pulseTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'emp_mine');
    scene.add.existing(this);
    scene.physics.world.enable(this);

    if (typeof this.setDisplaySize === 'function') {
      this.setDisplaySize(32, 32);
    }
    this.body.setSize(26, 26);
    this.body.setCircle(13, 0, 0);
    this.body.setImmovable(true);
    this.setDepth(12);

    this.setupPulseAnimation();
  }

  private setupPulseAnimation(): void {
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 1.15,
      alpha: 0.85,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  public activate(x: number, y: number): void {
    this.setPosition(x, y);
    this.isArmed = true;
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    if (this.pulseTween) {
      this.pulseTween.resume();
    }
  }

  public deactivate(): void {
    this.isArmed = false;
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
    if (this.pulseTween) {
      this.pulseTween.pause();
    }
  }

  public updateMine(time: number): void {
    if (!this.isArmed && this.respawnAt > 0 && time >= this.respawnAt) {
      this.activate(this.x, this.y);
      this.respawnAt = 0;
    }
  }

  /**
   * Detonation on contact with rover.
   * Disables magnet for 3s, dumps 30% cargo, emits shockwave.
   */
  public detonate(rover: PlayerRover, time: number): {
    disabledDurationMs: number;
    dumpedItems: ScrapItemData[];
  } {
    if (!this.isArmed) {
      return { disabledDurationMs: 0, dumpedItems: [] };
    }

    this.isArmed = false;
    this.respawnAt = time + 15000; // Respawns after 15 seconds

    // 1. Disable rover magnet for 3.0s
    rover.disableMagnet(3000, time);

    // 2. Dump 30% of carried cargo
    const dumped = rover.dumpCargoPercentage(0.3);

    // 3. Shockwave & flash visual effect
    this.createBlastVisual();

    // 4. Trigger Heavy screen shake (250ms, 0.014)
    if ((this.scene as any)?.triggerScreenShake) {
      (this.scene as any).triggerScreenShake(250, 0.014);
    }

    this.deactivate();

    return {
      disabledDurationMs: 3000,
      dumpedItems: dumped,
    };
  }

  private createBlastVisual(): void {
    const shockwave = this.scene.add.graphics();
    shockwave.setDepth(28);

    this.scene.tweens.add({
      targets: { r: 10, a: 1.0 },
      r: 80,
      a: 0,
      duration: 350,
      ease: 'Quad.out',
      onUpdate: (tween) => {
        shockwave.clear();
        shockwave.lineStyle(3, 0x00e5ff, 1.0 - tween.progress);
        shockwave.strokeCircle(this.x, this.y, 10 + 70 * tween.progress);
        shockwave.fillStyle(0xff1744, 0.4 * (1.0 - tween.progress));
        shockwave.fillCircle(this.x, this.y, 25 * tween.progress);
      },
      onComplete: () => {
        shockwave.destroy();
      },
    });
  }
}
