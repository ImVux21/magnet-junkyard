// ============================================================================
// Magnet Junkyard - Test Hook Bridge (window.__MAGNET_GAME__)
// ============================================================================

import Phaser from 'phaser';
import { PlayerUpgrades, getUpgradeCost } from '../../config/constants';
import { JunkyardScene } from '../../scenes/JunkyardScene';
import { SaveManager } from '../persistence/SaveManager';

export interface MagnetGameTestHook {
  isReady: boolean;
  version: string;
  game: Phaser.Game;

  getState(): {
    coins: number;
    currentLoad: number;
    maxCapacity: number;
    isFull: boolean;
    cargoCount: number;
    upgrades: {
      magnetRange: number;
      attractPower: number;
      carryCapacity: number;
      movementSpeed: number;
    };
    unlockedTiers: number[];
    player: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      rotation: number;
      effectiveRadius: number;
      effectivePower: number;
      effectiveSpeed: number;
    };
    activeScrapCount: number;
    activeBuffs: Array<{ type: string; remainingMs: number }>;
    combo: {
      count: number;
      multiplier: number;
      isFever: boolean;
      remainingFeverMs: number;
    };
    recycler: {
      isCoolingDown: boolean;
      remainingCooldownMs: number;
    };
    prestigeLevel: number;
    isMagnetDisabled: boolean;
    hazards: {
      activeCritters: number;
      activeMines: number;
      isRivalActive: boolean;
    };
    activeChallenge: any;
    achievements: string[];
  };

  actions: {
    teleportPlayer(x: number, y: number): void;
    setPlayerVelocity(vx: number, vy: number): void;
    spawnScrap(typeId: string, x: number, y: number, forceGolden?: boolean): string;
    collectScrap(instanceId: string): boolean;
    clearCargo(): void;
    triggerRecycle(): { itemsRecycled: number; coinsAwarded: number };
    setCoins(amount: number): void;
    addCoins(amount: number): void;
    setCombo(count: number): void;
    triggerFever(): void;
    triggerRecyclerCooldown(): void;
    purchaseUpgrade(statId: 'magnetRange' | 'attractPower' | 'carryCapacity' | 'movementSpeed'): boolean;
    unlockTier(tier: number): boolean;
    triggerPrestige(): boolean;
    triggerEMP(): void;
    spawnCritter(tier?: number, x?: number, y?: number): any;
    spawnRival(tier?: number): any;
    triggerScrapStorm(): any;
    completeChallenge(): number;
    unlockAchievement(id: string): number;
    simulateOfflineTime(minutes: number): any;
    triggerAdReward(rewardType: 'double_coins' | 'mega_magnet'): Promise<boolean>;
    saveGame(): void;
    reloadFromSave(): void;
    resetGame(): void;
    stepSimulation(deltaMs: number, steps?: number): void;
  };

  queries: {
    getScrapById(instanceId: string): {
      id: string;
      type: string;
      x: number;
      y: number;
      distanceToPlayer: number;
      isBeingAttracted: boolean;
      mass: number;
      baseValue: number;
    } | null;
    getScrapsInRadius(radius: number): Array<{ id: string; type: string; distance: number }>;
    isPlayerInRecyclerZone(): boolean;
    getUpgradeCost(statId: string): number;
  };

  events: {
    waitFor(eventName: string, timeoutMs?: number): Promise<unknown>;
    getRecentEvents(): Array<{ name: string; timestamp: number; data?: unknown }>;
  };
}

declare global {
  interface Window {
    __MAGNET_GAME__?: MagnetGameTestHook;
  }
}

export class TestBridge {
  private static recentEvents: Array<{ name: string; timestamp: number; data?: unknown }> = [];

  public static recordEvent(name: string, data?: unknown): void {
    TestBridge.recentEvents.push({ name, timestamp: Date.now(), data });
    if (TestBridge.recentEvents.length > 100) {
      TestBridge.recentEvents.shift();
    }
  }

  public static init(game: Phaser.Game): void {
    const getJunkyard = (): JunkyardScene | null => {
      const scene = game.scene.getScene('JunkyardScene') as JunkyardScene;
      if (scene && scene.scene.isActive()) {
        return scene;
      }
      return null;
    };

    const hook: MagnetGameTestHook = {
      isReady: false,
      version: '1.0.0',
      game,

      getState() {
        const scene = getJunkyard();
        if (!scene || !scene.playerRover) {
          return {
            coins: 0,
            currentLoad: 0,
            maxCapacity: 6,
            isFull: false,
            cargoCount: 0,
            upgrades: { magnetRange: 1, attractPower: 1, carryCapacity: 1, movementSpeed: 1 },
            unlockedTiers: [1],
            player: {
              x: 0,
              y: 0,
              vx: 0,
              vy: 0,
              rotation: 0,
              effectiveRadius: 120,
              effectivePower: 350,
              effectiveSpeed: 200,
            },
            activeScrapCount: 0,
            activeBuffs: [],
            combo: {
              count: 0,
              multiplier: 1.0,
              isFever: false,
              remainingFeverMs: 0,
            },
            recycler: {
              isCoolingDown: false,
              remainingCooldownMs: 0,
            },
            prestigeLevel: 0,
            isMagnetDisabled: false,
            hazards: {
              activeCritters: 0,
              activeMines: 0,
              isRivalActive: false,
            },
            activeChallenge: null,
            achievements: [],
          };
        }

        const rover = scene.playerRover;
        const buffs: Array<{ type: string; remainingMs: number }> = [];

        if (scene.has2xRewardBonus) {
          buffs.push({ type: 'double_coins', remainingMs: Infinity });
        }
        if (scene.hasOverchargeBuff) {
          buffs.push({
            type: 'mega_magnet',
            remainingMs: Math.max(0, scene.overchargeExpiresAt - scene.time.now),
          });
        }

        const currentTime = scene.time?.now || Date.now();
        const comboState = scene.comboManager
          ? scene.comboManager.getState(currentTime)
          : { count: 0, multiplier: 1.0, isFever: false, remainingFeverMs: 0, remainingWindowMs: 0, pitchModifier: 1.0 };

        if (comboState.isFever) {
          buffs.push({
            type: 'fever_mode',
            remainingMs: comboState.remainingFeverMs,
          });
        }

        const recyclerState = {
          isCoolingDown: scene.isRecyclerCoolingDown,
          remainingCooldownMs: scene.isRecyclerCoolingDown
            ? Math.max(0, scene.recyclerCooldownUntil - currentTime)
            : 0,
        };

        return {
          coins: scene.coins,
          currentLoad: rover.cargo.currentMassKg,
          maxCapacity: rover.cargo.maxCapacityKg,
          isFull: rover.cargo.isFull,
          cargoCount: rover.cargo.itemsCount,
          upgrades: { ...scene.upgrades },
          unlockedTiers: [...scene.unlockedTiers],
          player: {
            x: rover.x,
            y: rover.y,
            vx: rover.body ? rover.body.velocity.x : 0,
            vy: rover.body ? rover.body.velocity.y : 0,
            rotation: rover.rotation,
            effectiveRadius: rover.effectiveRadius,
            effectivePower: rover.effectivePower,
            effectiveSpeed: rover.effectiveSpeed,
          },
          activeScrapCount: scene.scrapPool ? scene.scrapPool.getActiveCount() : 0,
          activeBuffs: buffs,
          combo: {
            count: comboState.count,
            multiplier: comboState.multiplier,
            isFever: comboState.isFever,
            remainingFeverMs: comboState.remainingFeverMs,
          },
          recycler: recyclerState,
          prestigeLevel: scene.prestigeLevel || 0,
          isMagnetDisabled: !!rover.isMagnetDisabled,
          hazards: {
            activeCritters: scene.hazardManager?.critters.filter((c) => c.active).length || 0,
            activeMines: scene.hazardManager?.empMines.filter((m) => m.isArmed).length || 0,
            isRivalActive: !!scene.hazardManager?.rivalScavenger?.isActiveRival,
          },
          activeChallenge: scene.challengeManager ? scene.challengeManager.getState() : null,
          achievements: scene.achievementManager ? scene.achievementManager.getUnlocked() : [],
        };
      },

      actions: {
        teleportPlayer(x: number, y: number) {
          const scene = getJunkyard();
          if (scene && scene.playerRover) {
            scene.playerRover.setPosition(x, y);
            scene.playerRover.body.reset(x, y);
            TestBridge.recordEvent('teleportPlayer', { x, y });
          }
        },

        setPlayerVelocity(vx: number, vy: number) {
          const scene = getJunkyard();
          if (scene && scene.playerRover && scene.playerRover.body) {
            scene.playerRover.body.setVelocity(vx, vy);
            TestBridge.recordEvent('setPlayerVelocity', { vx, vy });
          }
        },

        spawnScrap(typeId: string, x: number, y: number, forceGolden?: boolean): string {
          const scene = getJunkyard();
          if (scene && scene.scrapPool) {
            const scrap = scene.scrapPool.spawn(typeId, x, y, 1, forceGolden);
            const id = scrap ? scrap.instanceId : '';
            TestBridge.recordEvent('spawnScrap', { typeId, x, y, id, forceGolden });
            return id;
          }
          return '';
        },

        collectScrap(instanceId: string): boolean {
          const scene = getJunkyard();
          if (scene && scene.scrapPool && scene.playerRover) {
            const scrap = scene.scrapPool.getById(instanceId);
            if (scrap) {
              const added = scene.playerRover.addItem(scrap.scrapData);
              if (added) {
                scrap.deactivate();
                scene.handleScrapCollected(scrap.scrapData, scene.time?.now || Date.now());
                scene.events.emit('cargo-updated', scene.playerRover.cargo);
                TestBridge.recordEvent('collectScrap', { instanceId, success: true });
                return true;
              }
            }
          }
          return false;
        },

        clearCargo() {
          const scene = getJunkyard();
          if (scene && scene.playerRover) {
            scene.playerRover.clearCargo();
            scene.events.emit('cargo-updated', scene.playerRover.cargo);
            TestBridge.recordEvent('clearCargo');
          }
        },

        triggerRecycle() {
          const scene = getJunkyard();
          if (scene) {
            const res = scene.triggerRecycleNow();
            TestBridge.recordEvent('triggerRecycle', res);
            return res;
          }
          return { itemsRecycled: 0, coinsAwarded: 0 };
        },

        setCoins(amount: number) {
          const scene = getJunkyard();
          if (scene) {
            scene.setCoins(amount);
            TestBridge.recordEvent('setCoins', { amount });
          }
        },

        addCoins(amount: number) {
          const scene = getJunkyard();
          if (scene) {
            scene.addCoins(amount);
            TestBridge.recordEvent('addCoins', { amount });
          }
        },

        setCombo(count: number) {
          const scene = getJunkyard();
          if (scene) {
            scene.setCombo(count);
            TestBridge.recordEvent('setCombo', { count });
          }
        },

        triggerFever() {
          const scene = getJunkyard();
          if (scene) {
            scene.triggerFever();
            TestBridge.recordEvent('triggerFever');
          }
        },

        triggerRecyclerCooldown() {
          const scene = getJunkyard();
          if (scene) {
            scene.triggerRecyclerCooldown();
            TestBridge.recordEvent('triggerRecyclerCooldown');
          }
        },

        purchaseUpgrade(statId: 'magnetRange' | 'attractPower' | 'carryCapacity' | 'movementSpeed') {
          const scene = getJunkyard();
          if (scene) {
            const ok = scene.purchaseUpgrade(statId);
            TestBridge.recordEvent('purchaseUpgrade', { statId, ok });
            return ok;
          }
          return false;
        },

        unlockTier(tier: number) {
          const scene = getJunkyard();
          if (scene) {
            const ok = scene.unlockTier(tier);
            TestBridge.recordEvent('unlockTier', { tier, ok });
            return ok;
          }
          return false;
        },

        triggerAdReward(rewardType: 'double_coins' | 'mega_magnet') {
          const scene = getJunkyard();
          if (scene) {
            TestBridge.recordEvent('triggerAdReward', { rewardType });
            return scene.triggerAdReward(rewardType);
          }
          return Promise.resolve(false);
        },

        triggerPrestige() {
          const scene = getJunkyard();
          if (scene) {
            const ok = scene.triggerPrestige();
            TestBridge.recordEvent('triggerPrestige', { ok, prestigeLevel: scene.prestigeLevel });
            return ok;
          }
          return false;
        },

        triggerEMP() {
          const scene = getJunkyard();
          if (scene && scene.hazardManager && scene.playerRover) {
            scene.hazardManager.triggerEMP(scene.playerRover, scene.time?.now || Date.now());
            TestBridge.recordEvent('triggerEMP', {});
          }
        },

        spawnCritter(tier: number = 2, x?: number, y?: number) {
          const scene = getJunkyard();
          if (scene && scene.hazardManager) {
            const critter = scene.hazardManager.spawnCritter(tier, x, y);
            TestBridge.recordEvent('spawnCritter', { tier, x, y });
            return critter;
          }
          return null;
        },

        spawnRival(tier: number = 2) {
          const scene = getJunkyard();
          if (scene && scene.hazardManager) {
            const rival = scene.hazardManager.spawnRival(tier);
            TestBridge.recordEvent('spawnRival', { tier });
            return rival;
          }
          return null;
        },

        triggerScrapStorm() {
          const scene = getJunkyard();
          if (scene && scene.scrapPool && scene.playerRover) {
            const tier = scene.unlockedTiers[scene.unlockedTiers.length - 1];
            const items = scene.scrapPool.triggerScrapStorm(tier, scene.playerRover.x, scene.playerRover.y);
            TestBridge.recordEvent('triggerScrapStorm', { count: items.length });
            return items;
          }
          return [];
        },

        completeChallenge() {
          const scene = getJunkyard();
          if (scene && scene.challengeManager) {
            const reward = scene.challengeManager.completeChallenge();
            scene.coins += reward;
            scene.saveGameState();
            scene.events.emit('coins-updated', scene.coins);
            TestBridge.recordEvent('completeChallenge', { reward });
            return reward;
          }
          return 0;
        },

        unlockAchievement(id: string) {
          const scene = getJunkyard();
          if (scene && scene.achievementManager) {
            const reward = scene.achievementManager.unlock(id);
            if (reward > 0) {
              scene.coins += reward;
              scene.saveGameState();
              scene.events.emit('coins-updated', scene.coins);
            }
            TestBridge.recordEvent('unlockAchievement', { id, reward });
            return reward;
          }
          return 0;
        },

        simulateOfflineTime(minutes: number) {
          const saveManager = SaveManager.getInstance();
          const saved = saveManager.load();
          saved.timestamp = Date.now() - minutes * 60 * 1000;
          saveManager.save(saved);
          const scene = getJunkyard();
          if (scene) {
            const offline = saveManager.calculateOfflineEarnings();
            scene.events.emit('offline-earnings', offline);
            TestBridge.recordEvent('simulateOfflineTime', { minutes, offline });
            return offline;
          }
          return null;
        },

        saveGame() {
          const scene = getJunkyard();
          if (scene) {
            scene.saveGameState();
            TestBridge.recordEvent('saveGame', {});
          }
        },

        reloadFromSave() {
          const scene = getJunkyard();
          if (scene) {
            const saved = SaveManager.getInstance().load();
            scene.coins = saved.player.coins;
            scene.upgrades = { ...saved.player.upgrades };
            scene.unlockedTiers = [...saved.player.unlockedTiers];
            scene.prestigeLevel = saved.player.prestigeLevel || 0;
            scene.playerRover.updateStats(scene.upgrades);
            scene.events.emit('coins-updated', scene.coins);
            scene.events.emit('tier-updated', scene.unlockedTiers[scene.unlockedTiers.length - 1]);
            scene.events.emit('prestige-updated', scene.prestigeLevel);
            TestBridge.recordEvent('reloadFromSave', saved);
          }
        },

        resetGame() {
          const scene = getJunkyard();
          try {
            localStorage.removeItem('magnet_junkyard_save_v1');
          } catch {
            // safe ignore
          }

          if (scene) {
            scene.coins = 0;
            scene.unlockedTiers = [1];
            scene.upgrades = { magnetRange: 1, attractPower: 1, carryCapacity: 1, movementSpeed: 1 };
            scene.has2xRewardBonus = false;
            scene.hasOverchargeBuff = false;
            if (scene.playerRover) {
              scene.playerRover.clearCargo();
              scene.playerRover.setPosition(1340, 1200);
              scene.playerRover.body.reset(1340, 1200);
              scene.playerRover.updateStats(scene.upgrades);
            }
            scene.events.emit('coins-updated', 0);
            scene.events.emit('cargo-updated', scene.playerRover.cargo);
            scene.events.emit('tier-updated', 1);
            TestBridge.recordEvent('resetGame');
          }
        },

        stepSimulation(deltaMs: number, steps = 1) {
          for (let i = 0; i < steps; i++) {
            game.step(game.getTime(), deltaMs);
          }
          TestBridge.recordEvent('stepSimulation', { deltaMs, steps });
        },
      },

      queries: {
        getScrapById(instanceId: string) {
          const scene = getJunkyard();
          if (!scene || !scene.scrapPool || !scene.playerRover) return null;

          const item = scene.scrapPool.getById(instanceId);
          if (!item) return null;

          const dx = item.x - scene.playerRover.x;
          const dy = item.y - scene.playerRover.y;
          const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

          return {
            id: item.instanceId,
            type: item.scrapData.typeId,
            x: item.x,
            y: item.y,
            distanceToPlayer,
            isBeingAttracted: item.isBeingAttracted,
            mass: item.scrapData.massKg,
            baseValue: item.scrapData.coinValue,
          };
        },

        getScrapsInRadius(radius: number) {
          const scene = getJunkyard();
          if (!scene || !scene.scrapPool || !scene.playerRover) return [];

          const magnetPos = scene.playerRover.getMagnetPosition();
          const items = scene.scrapPool.getInRadius(magnetPos.x, magnetPos.y, radius);

          return items.map((s) => {
            const dx = s.x - magnetPos.x;
            const dy = s.y - magnetPos.y;
            return {
              id: s.instanceId,
              type: s.scrapData.typeId,
              distance: Math.sqrt(dx * dx + dy * dy),
            };
          });
        },

        isPlayerInRecyclerZone() {
          const scene = getJunkyard();
          return scene ? scene.isPlayerInRecyclerZone() : false;
        },

        getUpgradeCost(statId: string) {
          const scene = getJunkyard();
          if (!scene) return Infinity;
          const lvl = scene.upgrades[statId as keyof PlayerUpgrades] || 1;
          return getUpgradeCost(statId as keyof PlayerUpgrades, lvl);
        },
      },

      events: {
        waitFor(eventName: string, timeoutMs = 5000): Promise<unknown> {
          return new Promise((resolve, reject) => {
            const scene = getJunkyard();
            if (!scene) {
              return reject(new Error('JunkyardScene not ready'));
            }

            const timer = setTimeout(() => {
              reject(new Error(`Timeout waiting for event: ${eventName} after ${timeoutMs}ms`));
            }, timeoutMs);

            scene.events.once(eventName, (data: unknown) => {
              clearTimeout(timer);
              resolve(data);
            });
          });
        },

        getRecentEvents() {
          return [...TestBridge.recentEvents];
        },
      },
    };

    window.__MAGNET_GAME__ = hook;

    // Mark ready when JunkyardScene becomes active
    const checkReady = () => {
      const scene = getJunkyard();
      if (scene && scene.scene.isActive()) {
        hook.isReady = true;
      } else {
        setTimeout(checkReady, 50);
      }
    };
    checkReady();
  }
}
