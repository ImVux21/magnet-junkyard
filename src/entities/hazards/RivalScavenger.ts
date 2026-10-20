// ============================================================================
// Magnet Junkyard - Rival Scavenger AI Entity (Resource Competitor)
// ============================================================================

import Phaser from 'phaser';
import { ScrapPool } from '../ScrapPool';

export class RivalScavenger extends Phaser.Physics.Arcade.Sprite {
  public declare body: Phaser.Physics.Arcade.Body;
  public static readonly ACTIVE_DURATION_MS = 30000; // 30 seconds
  public static readonly VACUUM_RADIUS = 130;

  public isActiveRival: boolean = false;
  public zoneTier: number = 1;
  public isStunned: boolean = false;
  public stunnedUntil: number = 0;
  public wasAttacked: boolean = false;
  private despawnAt: number = 0;
  private moveSpeed: number = 190;
  private scrapVacuumCount: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'rival_rover');
    scene.add.existing(this);
    scene.physics.world.enable(this);

    if (typeof this.setScale === 'function') {
      this.setScale(0.55);
    }
    this.body.setSize(44, 32);
    this.body.setCircle(18, 4, 4);
    this.body.setCollideWorldBounds(true);
    this.setDepth(18);
    this.deactivate();
  }

  public spawn(x: number, y: number, zoneTier: number, currentTime: number = Date.now()): void {
    this.setPosition(x, y);
    this.zoneTier = zoneTier;
    this.despawnAt = currentTime + RivalScavenger.ACTIVE_DURATION_MS;
    this.isActiveRival = true;
    this.scrapVacuumCount = 0;
    this.isStunned = false;
    this.stunnedUntil = 0;
    this.wasAttacked = false;

    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;

    // Spawn smoke puff
    this.createSmokePuff();
  }

  public deactivate(): void {
    this.isActiveRival = false;
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
    this.isStunned = false;
  }

  public stun(durationMs: number = 3000, currentTime: number = Date.now()): void {
    this.isStunned = true;
    this.stunnedUntil = currentTime + durationMs;
    this.wasAttacked = true;
    if (this.body) {
      this.body.setVelocity(0, 0);
    }
  }

  public spillLoot(scrapPool: ScrapPool, count: number = 3): number {
    const toSpill = Math.max(1, Math.min(count, Math.max(this.scrapVacuumCount, count)));
    let spawned = 0;
    for (let i = 0; i < toSpill; i++) {
      const angle = (i / toSpill) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 35 + Math.random() * 45;
      const lx = this.x + Math.cos(angle) * dist;
      const ly = this.y + Math.sin(angle) * dist;
      
      const item = scrapPool.spawnForZone(
        this.zoneTier,
        lx,
        ly,
        -9999,
        -9999
      );
      if (item) {
        if (this.wasAttacked && Math.random() < 0.30) {
          item.isGolden = true;
          item.setScale(1.25);
          item.setTint(0xffd700);
        }
        spawned++;
      }
    }
    this.scrapVacuumCount = Math.max(0, this.scrapVacuumCount - toSpill);
    this.createSmokePuff();
    return spawned;
  }

  public despawnWithLoot(scrapPool: ScrapPool): void {
    if (this.scrapVacuumCount > 0 || this.wasAttacked) {
      const dropCount = Math.max(2, Math.min(this.scrapVacuumCount, 6));
      this.spillLoot(scrapPool, dropCount);
    }
    this.createSmokePuff();
    this.deactivate();
  }

  public getScrapVacuumCount(): number {
    return this.scrapVacuumCount;
  }

  public getRemainingTimeMs(currentTime: number = Date.now()): number {
    return Math.max(0, this.despawnAt - currentTime);
  }

  public updateAI(deltaMs: number, scrapPool: ScrapPool, currentTime: number = Date.now()): void {
    if (!this.isActiveRival) return;

    // Check expiration
    if (currentTime >= this.despawnAt) {
      this.despawnWithLoot(scrapPool);
      return;
    }

    // Check stun
    if (this.isStunned) {
      if (currentTime >= this.stunnedUntil) {
        this.isStunned = false;
      } else {
        this.body.setVelocity(0, 0);
        return;
      }
    }

    const deltaSec = deltaMs / 1000;

    // Find nearby scrap in active pool
    const activeScraps = scrapPool.getActiveItems();
    let closestScrap: any = null;
    let closestDistSq = Infinity;

    for (const scrap of activeScraps) {
      if (!scrap.active) continue;
      const dx = scrap.x - this.x;
      const dy = scrap.y - this.y;
      const dSq = dx * dx + dy * dy;

      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestScrap = scrap;
      }
    }

    if (closestScrap) {
      const dx = closestScrap.x - this.x;
      const dy = closestScrap.y - this.y;
      const dist = Math.sqrt(closestDistSq);
      const angle = Math.atan2(dy, dx);

      this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, angle, 6.0 * deltaSec);
      this.body.setVelocity(Math.cos(this.rotation) * this.moveSpeed, Math.sin(this.rotation) * this.moveSpeed);

      // Vacuum scrap within reach
      if (dist <= RivalScavenger.VACUUM_RADIUS) {
        // Drag scrap closer rapidly
        const pullSpeed = 450;
        closestScrap.body.setVelocity(-Math.cos(angle) * pullSpeed, -Math.sin(angle) * pullSpeed);

        if (dist <= 32) {
          // Vacuumed into hopper
          closestScrap.deactivate();
          this.scrapVacuumCount++;
        }
      }
    } else {
      // Idle wander
      this.body.setVelocity(this.body.velocity.x * 0.95, this.body.velocity.y * 0.95);
    }
  }

  private createSmokePuff(): void {
    const junkyard = this.scene as { rivalSmokeEmitter?: Phaser.GameObjects.Particles.ParticleEmitter };
    if (junkyard?.rivalSmokeEmitter && junkyard.rivalSmokeEmitter.active !== false) {
      junkyard.rivalSmokeEmitter.explode(10, this.x, this.y);
    }
  }
}
