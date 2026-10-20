// ============================================================================
// Magnet Junkyard - Hazard & Threat Orchestrator (HazardManager)
// ============================================================================

import Phaser from 'phaser';
import { JUNKYARD_TIERS } from '../../config/constants';
import { PlayerRover } from '../PlayerRover';
import { ScrapPool } from '../ScrapPool';
import { ProceduralAudioService } from '../../services/audio/ProceduralAudioService';
import { ScrapCritter } from './ScrapCritter';
import { EMPMine } from './EMPMine';
import { RivalScavenger } from './RivalScavenger';

export class HazardManager {
  private scene: Phaser.Scene;
  private audioService: ProceduralAudioService;

  // Hazard pools
  public critters: ScrapCritter[] = [];
  public empMines: EMPMine[] = [];
  public rivalScavenger!: RivalScavenger;

  // Rival spawn timer (every 180s - 240s)
  private nextRivalSpawnTime: number = 0;
  private readonly RIVAL_SPAWN_INTERVAL_MS = 210000; // 3.5 minutes

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.audioService = ProceduralAudioService.getInstance();

    this.initPools();
    this.nextRivalSpawnTime = Date.now() + 180000;
  }

  private initPools(): void {
    // 1. Scrap Critters pool (up to 12 critters)
    for (let i = 0; i < 12; i++) {
      const critter = new ScrapCritter(this.scene, 0, 0);
      this.critters.push(critter);
    }

    // 2. EMP Mines (8 fixed mine locations across Tiers 2, 3, 4)
    const mineCoords = [
      { x: 1850, y: 350 },
      { x: 2350, y: 700 },
      { x: 2000, y: 920 },
      { x: 450, y: 1550 },
      { x: 950, y: 1950 },
      { x: 1100, y: 1450 },
      { x: 1950, y: 1650 },
      { x: 2450, y: 2050 },
    ];

    for (const pos of mineCoords) {
      const mine = new EMPMine(this.scene, pos.x, pos.y);
      this.empMines.push(mine);
    }

    // 3. Rival Scavenger AI entity
    this.rivalScavenger = new RivalScavenger(this.scene, 0, 0);
  }

  /**
   * Spawns critters for unlocked tiers according to quotas.
   * Tier 1: 0 critters
   * Tier 2: 2 critters
   * Tier 3: 4 critters
   * Tier 4: 6 critters
   */
  /**
   * Spawns critters for unlocked tiers according to quotas.
   * Tier 1: 0 critters
   * Tier 2: 2 critters
   * Tier 3: 4 critters
   * Tier 4: 6 critters
   */
  public updateCritterSpawns(unlockedTiers: number[], sessionElapsedMs: number = 0): void {
    const desiredPerTier: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 6 };

    for (const tierId of unlockedTiers) {
      if (tierId < 2) continue;
      const targetCount = desiredPerTier[tierId] || 2;
      const activeForTier = this.critters.filter((c) => c.active && c.zoneTier === tierId).length;

      if (activeForTier < targetCount) {
        const tierConfig = JUNKYARD_TIERS.find((t) => t.id === tierId);
        if (!tierConfig) continue;

        const availableCritter = this.critters.find((c) => !c.active);
        if (availableCritter) {
          let spawnX = tierConfig.bounds.x + 50 + Math.random() * (tierConfig.bounds.width - 100);
          let spawnY = tierConfig.bounds.y + 50 + Math.random() * (tierConfig.bounds.height - 100);

          // Min 1-3 anti-churn: keep safe distance (>= 300px) from recycler center (1400, 1100)
          if (sessionElapsedMs < 180000) {
            const rx = 1400;
            const ry = 1100;
            const dist = Math.hypot(spawnX - rx, spawnY - ry);
            if (dist < 300) {
              const angle = Math.atan2(spawnY - ry, spawnX - rx);
              spawnX = rx + Math.cos(angle) * 350;
              spawnY = ry + Math.sin(angle) * 350;
            }
          }

          availableCritter.activate(spawnX, spawnY, tierId);
        }
      }
    }
  }

  /**
   * Main per-frame simulation loop for hazards.
   */
  public update(
    time: number,
    delta: number,
    playerRover: PlayerRover,
    scrapPool: ScrapPool,
    unlockedTiers: number[],
    sessionElapsedMs: number = 0
  ): void {
    // 0. Session Pacing calculation (0-180s safe, 180-300s standard, 300-600s+ escalation)
    const pacingProgress = sessionElapsedMs >= 300000
      ? Phaser.Math.Clamp((sessionElapsedMs - 300000) / 300000, 0, 1)
      : 0;

    // 1. Maintain critter population across unlocked tiers
    this.updateCritterSpawns(unlockedTiers, sessionElapsedMs);

    // 2. Update active critters roaming and rover collision checks
    const critterSpeedMultiplier = 1.0 + 0.35 * pacingProgress;
    for (const critter of this.critters) {
      if (!critter.active) continue;

      const tierConfig = JUNKYARD_TIERS.find((t) => t.id === critter.zoneTier);
      if (tierConfig) {
        critter.updateRoam(delta, tierConfig.bounds, time, critterSpeedMultiplier);
      }

      // Proximity check with rover (collision radius ~35px)
      const dx = critter.x - playerRover.x;
      const dy = critter.y - playerRover.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= 36 * 36) {
        const { repelled, ejectedItems } = critter.interactWithRover(playerRover, time);

        if (repelled) {
          this.audioService.playCritterSqueak();
          this.scene.events.emit('hazard-repelled', 'Scrap Critter repelled by Magnetic Wave!');
          this.scene.events.emit('achievement-trigger', 'critter_repelled');
        } else if (ejectedItems.length > 0) {
          this.audioService.playCritterSqueak();
          this.scene.events.emit('hazard-hit', `Critter attack! Dropped ${ejectedItems.length} items!`);

          // Scatter ejected items back onto the field
          for (const item of ejectedItems) {
            scrapPool.spawn(item.typeId, playerRover.x + Phaser.Math.Between(-40, 40), playerRover.y + Phaser.Math.Between(-40, 40), critter.zoneTier);
          }
          this.scene.events.emit('cargo-updated', playerRover.cargo);
        }
      }
    }

    // 3. Update EMP Mines
    for (const mine of this.empMines) {
      mine.updateMine(time);

      if (!mine.isArmed) continue;

      const dx = mine.x - playerRover.x;
      const dy = mine.y - playerRover.y;
      if (dx * dx + dy * dy <= 38 * 38) {
        const { dumpedItems } = mine.detonate(playerRover, time);
        this.audioService.playEMPBlast();
        this.scene.events.emit('hazard-hit', `⚡ EMP MINE DETONATED! Magnet disabled for 3s!`);
        this.scene.events.emit('achievement-trigger', 'emp_survivor');

        // Re-spawn dumped cargo near blast
        for (const item of dumpedItems) {
          scrapPool.spawn(item.typeId, playerRover.x + Phaser.Math.Between(-50, 50), playerRover.y + Phaser.Math.Between(-50, 50), 2);
        }
        this.scene.events.emit('cargo-updated', playerRover.cargo);
      }
    }

    // 4. Update Rival Scavenger AI & Periodic Spawner
    // Min 1-3 anti-churn: First rival delayed until at least 180s (3 minutes)
    if (sessionElapsedMs < 180000 && this.nextRivalSpawnTime < time + (180000 - sessionElapsedMs)) {
      this.nextRivalSpawnTime = time + (180000 - sessionElapsedMs);
    }

    if (this.rivalScavenger.isActiveRival) {
      this.rivalScavenger.updateAI(delta, scrapPool, time);
    } else if (time >= this.nextRivalSpawnTime) {
      const highestTier = unlockedTiers[unlockedTiers.length - 1];
      const tierConfig = JUNKYARD_TIERS.find((t) => t.id === highestTier);
      if (tierConfig) {
        const sx = tierConfig.bounds.x + tierConfig.bounds.width / 2;
        const sy = tierConfig.bounds.y + tierConfig.bounds.height / 2;
        this.rivalScavenger.spawn(sx, sy, highestTier, time);
        this.scene.events.emit('buff-activated', '⚠️ WARNING: Rival Scavenger entered the junkyard!');
        // Escalation: recurrence interval decreases from 210s down to 120s as session reaches 10m
        const currentInterval = Phaser.Math.Linear(this.RIVAL_SPAWN_INTERVAL_MS, 120000, pacingProgress);
        this.nextRivalSpawnTime = time + currentInterval;
      }
    }
  }

  // --------------------------------------------------------------------------
  // TestBridge Programmatic Hooks
  // --------------------------------------------------------------------------
  public spawnCritter(tier: number = 2, x?: number, y?: number): ScrapCritter | null {
    const available = this.critters.find((c) => !c.active);
    if (!available) return null;
    const tierConfig = JUNKYARD_TIERS.find((t) => t.id === tier) || JUNKYARD_TIERS[1];
    const spawnX = x ?? (tierConfig.bounds.x + 100);
    const spawnY = y ?? (tierConfig.bounds.y + 100);
    available.activate(spawnX, spawnY, tier);
    return available;
  }

  public triggerEMP(playerRover: PlayerRover, time: number = Date.now()): void {
    const mine = this.empMines.find((m) => m.isArmed) || this.empMines[0];
    if (mine) {
      mine.detonate(playerRover, time);
      this.audioService.playEMPBlast();
    }
  }

  public spawnRival(zoneTier: number = 2, x?: number, y?: number): RivalScavenger {
    const tierConfig = JUNKYARD_TIERS.find((t) => t.id === zoneTier) || JUNKYARD_TIERS[1];
    const sx = x ?? (tierConfig.bounds.x + tierConfig.bounds.width / 2);
    const sy = y ?? (tierConfig.bounds.y + tierConfig.bounds.height / 2);
    this.rivalScavenger.spawn(sx, sy, zoneTier, Date.now());
    return this.rivalScavenger;
  }
}
