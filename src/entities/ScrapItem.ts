// ============================================================================
// Magnet Junkyard - Scrap Item Entity
// ============================================================================

import Phaser from 'phaser';
import { ScrapItemData, SCRAP_CATALOG } from '../config/constants';

export class ScrapItem extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  public scrapData: ScrapItemData;
  public instanceId: string = '';
  public zoneTier: number = 1;
  public isBeingAttracted: boolean = false;
  public isGolden: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Default initial placeholder texture; will be re-assigned on activate()
    super(scene, x, y, 'scrap_screw');
    this.scrapData = SCRAP_CATALOG.screw;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setActive(false);
    this.setVisible(false);
    this.body.setDrag(600);
    this.body.setBounce(0.2);
    this.body.setCollideWorldBounds(true);
  }

  public activate(
    data: ScrapItemData,
    x: number,
    y: number,
    instanceId: string,
    zoneTier = 1,
    isGolden: boolean = false
  ): void {
    this.scrapData = data;
    this.instanceId = instanceId;
    this.zoneTier = zoneTier;
    this.isBeingAttracted = false;
    this.isGolden = isGolden;

    this.setTexture(`scrap_${data.typeId}`);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    if (isGolden) {
      this.setTint(0xffd700);
    } else {
      this.clearTint();
    }

    this.body.reset(x, y);
    this.body.setVelocity(0, 0);
    this.body.setAngularVelocity(0);

    const radius = Math.max(8, Math.min(18, Math.floor(Math.min(data.width, data.height) / 2)));
    const offsetX = Math.max(0, (this.width - radius * 2) / 2);
    const offsetY = Math.max(0, (this.height - radius * 2) / 2);
    this.body.setCircle(radius, offsetX, offsetY);

    // Spawn entrance animation scaling to target catalog dimensions
    const baseScaleX = data.width / Math.max(1, this.width);
    const baseScaleY = data.height / Math.max(1, this.height);
    const targetScaleX = baseScaleX * (isGolden ? 1.25 : 1.0);
    const targetScaleY = baseScaleY * (isGolden ? 1.25 : 1.0);
    if (typeof this.setScale === 'function') {
      this.setScale(0);
    }
    this.scene.tweens.add({
      targets: this,
      scaleX: targetScaleX,
      scaleY: targetScaleY,
      duration: 250,
      ease: 'Back.out',
    });
  }

  public deactivate(): void {
    this.scene.tweens.killTweensOf(this);
    this.clearTint();
    this.isGolden = false;
    this.isBeingAttracted = false;
    this.setActive(false);
    this.setVisible(false);
    this.body.reset(0, 0);
    this.body.setVelocity(0, 0);
  }

  /**
   * Applies magnetic attraction physics toward the magnet emitter position.
   * Returns whether the item was collected or is currently being pulled.
   */
  public updateAttraction(
    magnetPos: Phaser.Math.Vector2,
    playerVel: Phaser.Math.Vector2,
    range: number,
    power: number,
    availableCapacityKg: number
  ): { collected: boolean; attracting: boolean } {
    if (!this.active) {
      return { collected: false, attracting: false };
    }

    // 1. Capacity overflow check (Strict capacity enforcement with epsilon tolerance)
    if (this.scrapData.massKg > availableCapacityKg + 0.001) {
      this.isBeingAttracted = false;
      return { collected: false, attracting: false };
    }

    const dx = magnetPos.x - this.x;
    const dy = magnetPos.y - this.y;
    const distSq = dx * dx + dy * dy;

    if (distSq > range * range) {
      this.isBeingAttracted = false;
      return { collected: false, attracting: false };
    }

    const dist = Math.sqrt(distSq);

    // 2. Capture threshold at d <= 26px
    if (dist <= 26) {
      this.isBeingAttracted = false;
      return { collected: true, attracting: false };
    }

    // 3. Proximity factor t in [0, 1]
    const t = Math.max(0, Math.min(1, 1.0 - dist / range));

    // 4. Non-linear pull speed with mass & drag resistance scaling
    const massRatio = Math.max(
      0.35,
      Math.min(2.5, Math.sqrt(power / (this.scrapData.massKg * 50 * this.scrapData.dragResistance)))
    );
    const speed = (180 + 480 * (t * t)) * massRatio;

    // 5. Apply velocity with orbital damping and player velocity coupling
    const dirX = dx / dist;
    const dirY = dy / dist;

    const vx = dirX * speed + playerVel.x * 0.35;
    const vy = dirY * speed + playerVel.y * 0.35;

    this.body.setVelocity(vx, vy);
    this.rotation = Math.atan2(vy, dirX !== 0 ? vx : 0.001);
    this.isBeingAttracted = true;

    return { collected: false, attracting: true };
  }
}
