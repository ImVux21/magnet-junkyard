// ============================================================================
// Magnet Junkyard - Scrap Critter Entity (Tier 2+ Hazard)
// ============================================================================

import Phaser from 'phaser';
import { PlayerRover } from '../PlayerRover';
import { ScrapItemData } from '../../config/constants';

export class ScrapCritter extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;
  public zoneTier: number = 2;
  public moveSpeed: number = 80;
  private roamTarget: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
  private nextRetargetTime: number = 0;
  private hitCooldownUntil: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'critter_sprite');
    scene.add.existing(this);
    scene.physics.world.enable(this);

    if (typeof this.setDisplaySize === 'function') {
      this.setDisplaySize(28, 22);
    }
    this.body.setSize(24, 18);
    this.body.setCircle(10, 2, 2);
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.4, 0.4);
    this.setDepth(15);
    this.setActive(false);
    this.setVisible(false);
  }

  public activate(x: number, y: number, tier: number): void {
    this.setPosition(x, y);
    this.zoneTier = tier;
    // Speed scales slightly with zone tier
    this.moveSpeed = 60 + tier * 15;
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.roamTarget.set(x, y);
    this.nextRetargetTime = 0;
    this.hitCooldownUntil = 0;
  }

  public deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
  }

  public updateRoam(
    _deltaMs: number,
    bounds: { x: number; y: number; width: number; height: number },
    time: number,
    speedMultiplier: number = 1.0
  ): void {
    if (!this.active) return;

    if (time >= this.nextRetargetTime) {
      // Pick new wander point inside tier bounds
      const tx = bounds.x + 30 + Math.random() * (bounds.width - 60);
      const ty = bounds.y + 30 + Math.random() * (bounds.height - 60);
      this.roamTarget.set(tx, ty);
      this.nextRetargetTime = time + Phaser.Math.Between(2000, 4500);
    }

    const dx = this.roamTarget.x - this.x;
    const dy = this.roamTarget.y - this.y;
    const distSq = dx * dx + dy * dy;

    const effectiveSpeed = this.moveSpeed * speedMultiplier;
    if (distSq > 400) {
      const angle = Math.atan2(dy, dx);
      this.rotation = angle;
      this.body.setVelocity(Math.cos(angle) * effectiveSpeed, Math.sin(angle) * effectiveSpeed);
    } else {
      this.body.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
    }
  }

  public repel(fromX: number, fromY: number, force: number = 350): void {
    const angle = Math.atan2(this.y - fromY, this.x - fromX);
    this.body.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
    this.nextRetargetTime = Date.now() + 1500;
  }

  /**
   * Collision check with player rover.
   * Returns ejected scrap items if knocked loose, or empty array if repelled / on cooldown.
   */
  public interactWithRover(
    rover: PlayerRover,
    time: number
  ): { repelled: boolean; ejectedItems: ScrapItemData[] } {
    if (!this.active || time < this.hitCooldownUntil) {
      return { repelled: false, ejectedItems: [] };
    }

    // Power check: Rovers with Attract Power >= 700 (L5+) repel critters
    if (rover.effectivePower >= 700) {
      this.repel(rover.x, rover.y, 450);
      this.hitCooldownUntil = time + 1000;
      if ((this.scene as any)?.triggerScreenShake) {
        (this.scene as any).triggerScreenShake(80, 0.004);
      }
      return { repelled: true, ejectedItems: [] };
    }

    // Otherwise, knock loose 1-2 items from cargo
    const ejectCount = Phaser.Math.Between(1, 2);
    const ejected = rover.ejectCargo(ejectCount);

    // Push critter slightly away on impact
    this.repel(rover.x, rover.y, 200);
    this.hitCooldownUntil = time + 2000;

    // Trigger Medium screen shake (140ms, 0.007)
    if ((this.scene as any)?.triggerScreenShake) {
      (this.scene as any).triggerScreenShake(140, 0.007);
    }

    return { repelled: false, ejectedItems: ejected };
  }
}
