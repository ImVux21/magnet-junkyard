// ============================================================================
// Magnet Junkyard - Scrap Pool & Zone Spawner (Zero-GC Pooling)
// ============================================================================

import Phaser from 'phaser';
import {
  GAME_CONSTANTS,
  JUNKYARD_TIERS,
  SCRAP_CATALOG,
  ScrapItemData,
} from '../config/constants';
import { ProceduralAudioService } from '../services/audio/ProceduralAudioService';
import { PlayerRover } from './PlayerRover';
import { ScrapItem } from './ScrapItem';

export class ScrapPool {
  private scene: Phaser.Scene;
  private group: Phaser.GameObjects.Group;
  private items: ScrapItem[] = [];
  private itemIndexCounter: number = 0;
  public goldenChanceBonus: number = 0;

  public setGoldenChanceBonus(bonus: number): void {
    this.goldenChanceBonus = Math.max(0, bonus);
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.group = scene.add.group({
      classType: ScrapItem,
      maxSize: GAME_CONSTANTS.TOTAL_POOL_SIZE,
      runChildUpdate: false,
    });

    this.prepopulatePool();
  }

  private prepopulatePool(): void {
    for (let i = 0; i < GAME_CONSTANTS.TOTAL_POOL_SIZE; i++) {
      const item = new ScrapItem(this.scene, 0, 0);
      this.group.add(item);
      this.items.push(item);
    }
  }

  public getActiveCount(): number {
    return this.items.filter((item) => item.active).length;
  }

  public getActiveItems(): ScrapItem[] {
    return this.items.filter((item) => item.active);
  }

  public getById(instanceId: string): ScrapItem | null {
    return this.items.find((item) => item.active && item.instanceId === instanceId) || null;
  }

  public getInRadius(x: number, y: number, radius: number): ScrapItem[] {
    const radiusSq = radius * radius;
    return this.items.filter((item) => {
      if (!item.active) return false;
      const dx = item.x - x;
      const dy = item.y - y;
      return dx * dx + dy * dy <= radiusSq;
    });
  }

  /**
   * Spawns an item of a specific type at given coordinates.
   */
  public spawn(typeId: string, x: number, y: number, zoneTier = 1, forceGolden?: boolean): ScrapItem | null {
    const data = SCRAP_CATALOG[typeId];
    if (!data) {
      console.warn(`[ScrapPool] Unknown scrap typeId: ${typeId}`);
      return null;
    }

    const availableItem = this.items.find((item) => !item.active);
    if (!availableItem) {
      return null; // Pool exhausted
    }

    this.itemIndexCounter++;
    const id = `scrap_${this.itemIndexCounter}`;
    // 5% base chance + prestige bonus of spawning as a Golden Scrap variant
    const isGolden = forceGolden !== undefined ? forceGolden : Math.random() < (0.05 + this.goldenChanceBonus);
    availableItem.activate(data, x, y, id, zoneTier, isGolden);
    return availableItem;
  }

  /**
   * Dynamic Event: Scrap Storm - Spawns a cluster of 15 high-value scrap items near the player.
   */
  public triggerScrapStorm(zoneTier: number, playerX: number, playerY: number): ScrapItem[] {
    const spawned: ScrapItem[] = [];
    const tierConfig = JUNKYARD_TIERS.find((t) => t.id === zoneTier) || JUNKYARD_TIERS[0];
    const bounds = tierConfig.bounds;

    // Pick top items for this zone
    const weightIndex = Math.max(0, Math.min(3, zoneTier - 1));
    const eligibleTypes = Object.entries(SCRAP_CATALOG)
      .filter(([_, d]) => d.spawnWeights[weightIndex] > 0)
      .map(([k]) => k);

    for (let i = 0; i < 15; i++) {
      const type = eligibleTypes[i % eligibleTypes.length] || 'screw';
      const angle = (i * Math.PI * 2) / 15;
      const dist = Phaser.Math.Between(100, 220);
      const sx = Phaser.Math.Clamp(playerX + Math.cos(angle) * dist, bounds.x + 20, bounds.x + bounds.width - 20);
      const sy = Phaser.Math.Clamp(playerY + Math.sin(angle) * dist, bounds.y + 20, bounds.y + bounds.height - 20);

      // 20% chance in a storm to be golden
      const item = this.spawn(type, sx, sy, zoneTier, Math.random() < 0.20);
      if (item) {
        spawned.push(item);
      }
    }

    return spawned;
  }

  /**
   * Spawns a weighted random item in the specified zone complying with distance guards.
   */
  public spawnForZone(
    zoneTier: number,
    playerX: number,
    playerY: number,
    recyclerX: number,
    recyclerY: number
  ): ScrapItem | null {
    const tierConfig = JUNKYARD_TIERS.find((t) => t.id === zoneTier);
    if (!tierConfig) return null;

    // 1. Pick scrap type based on zone spawn weights
    const weightIndex = Math.max(0, Math.min(3, zoneTier - 1));
    const candidateTypes: Array<{ typeId: string; weight: number }> = [];

    for (const [key, data] of Object.entries(SCRAP_CATALOG)) {
      const w = data.spawnWeights[weightIndex];
      if (w > 0) {
        candidateTypes.push({ typeId: key, weight: w });
      }
    }

    if (candidateTypes.length === 0) return null;

    const totalWeight = candidateTypes.reduce((acc, c) => acc + c.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosenType = candidateTypes[0].typeId;

    for (const cand of candidateTypes) {
      rand -= cand.weight;
      if (rand <= 0) {
        chosenType = cand.typeId;
        break;
      }
    }

    // 2. Pick position inside zone bounds with distance guards
    const bounds = tierConfig.bounds;
    let validX = bounds.x + bounds.width / 2;
    let validY = bounds.y + bounds.height / 2;
    let foundValid = false;

    const minPlayerDistSq = GAME_CONSTANTS.RESPAWN_MIN_PLAYER_DIST * GAME_CONSTANTS.RESPAWN_MIN_PLAYER_DIST;
    const minRecyclerDistSq = GAME_CONSTANTS.RESPAWN_MIN_RECYCLER_DIST * GAME_CONSTANTS.RESPAWN_MIN_RECYCLER_DIST;

    for (let attempts = 0; attempts < 12; attempts++) {
      const testX = bounds.x + Math.random() * bounds.width;
      const testY = bounds.y + Math.random() * bounds.height;

      const pDistSq = (testX - playerX) * (testX - playerX) + (testY - playerY) * (testY - playerY);
      const rDistSq = (testX - recyclerX) * (testX - recyclerX) + (testY - recyclerY) * (testY - recyclerY);

      if (pDistSq >= minPlayerDistSq && rDistSq >= minRecyclerDistSq) {
        validX = testX;
        validY = testY;
        foundValid = true;
        break;
      }
    }

    if (!foundValid) {
      // Fallback with slight jitter if all attempts were too close
      validX = bounds.x + Math.random() * bounds.width;
      validY = bounds.y + Math.random() * bounds.height;
    }

    return this.spawn(chosenType, validX, validY, zoneTier);
  }

  /**
   * Respawn tick: keeps active scrap count at quota for all unlocked zones.
   */
  public respawnTick(
    playerX: number,
    playerY: number,
    recyclerX: number,
    recyclerY: number,
    unlockedTiers: number[]
  ): void {
    for (const tierId of unlockedTiers) {
      const tierConfig = JUNKYARD_TIERS.find((t) => t.id === tierId);
      if (!tierConfig) continue;

      const currentZoneCount = this.items.filter((item) => item.active && item.zoneTier === tierId).length;
      const deficit = tierConfig.quota - currentZoneCount;

      if (deficit > 0) {
        // Spawn in batches of up to 4 items per tick to prevent frame spikes
        const spawnBatch = Math.min(4, deficit);
        for (let i = 0; i < spawnBatch; i++) {
          this.spawnForZone(tierId, playerX, playerY, recyclerX, recyclerY);
        }
      }
    }
  }

  /**
   * Attraction & collection simulation step.
   */
  public updateAttraction(
    playerRover: PlayerRover,
    audioService: ProceduralAudioService
  ): { collectedItems: ScrapItemData[]; activeAttractingCount: number } {
    const magnetPos = playerRover.getMagnetPosition();
    const playerVel = playerRover.body.velocity;
    const range = playerRover.isMagnetDisabled ? 0 : playerRover.effectiveRadius;
    const power = playerRover.isMagnetDisabled ? 0 : playerRover.effectivePower;
    const availableCap = playerRover.getAvailableCapacityKg();

    const collectedItems: ScrapItemData[] = [];
    let attractingCount = 0;

    for (const item of this.items) {
      if (!item.active) continue;

      const res = item.updateAttraction(magnetPos, playerVel, range, power, availableCap);

      if (res.attracting) {
        attractingCount++;
      }

      if (res.collected) {
        const itemPayload: ScrapItemData = { ...item.scrapData, isGolden: item.isGolden };
        const added = playerRover.addItem(itemPayload);
        if (added) {
          collectedItems.push(itemPayload);
          audioService.playScrapPickup(item.scrapData.massKg);
          item.deactivate();
        }
      }
    }

    // Dynamic magnet hum based on active attracting scrap
    audioService.setMagnetHum(attractingCount);

    return { collectedItems, activeAttractingCount: attractingCount };
  }

  public clearAll(): void {
    for (const item of this.items) {
      if (item.active) {
        item.deactivate();
      }
    }
  }

  public destroy(): void {
    this.clearAll();
    this.group.destroy(true);
    this.items = [];
  }
}
