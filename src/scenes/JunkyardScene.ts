// ============================================================================
// Magnet Junkyard - Main World Scene (Terrain, Rover, Scrap, & Recycler)
// ============================================================================

import Phaser from 'phaser';
import {
  GAME_CONSTANTS,
  JUNKYARD_TIERS,
  PlayerUpgrades,
  ScrapItemData,
  getUpgradeCost,
} from '../config/constants';
import { PlayerRover } from '../entities/PlayerRover';
import { ScrapPool } from '../entities/ScrapPool';
import { ProceduralAudioService } from '../services/audio/ProceduralAudioService';
import { TestBridge } from '../services/testing/TestBridge';
import { UIScene } from './UIScene';
import { SaveManager } from '../services/persistence/SaveManager';
import { getCrazyGamesSDK } from '../services/crazygames/MockCrazyGamesSDK';
import { ComboManager } from '../services/economy/ComboManager';
import { HazardManager } from '../entities/hazards/HazardManager';
import { ChallengeManager } from '../services/economy/ChallengeManager';
import { AchievementManager } from '../services/economy/AchievementManager';
import { AbilityManager } from '../services/economy/AbilityManager';
import { DestructibleCrate } from '../entities/hazards/DestructibleCrate';
import { PrestigeManager, PRESTIGE_PERKS } from '../services/economy/PrestigeManager';

export class JunkyardScene extends Phaser.Scene {
  public playerRover!: PlayerRover;
  public scrapPool!: ScrapPool;
  public audioService!: ProceduralAudioService;
  public comboManager: ComboManager = new ComboManager();
  public hazardManager!: HazardManager;
  public challengeManager: ChallengeManager = new ChallengeManager();
  public achievementManager: AchievementManager = new AchievementManager();
  public abilityManager: AbilityManager = new AbilityManager(12000);
  public destructibleCrates: DestructibleCrate[] = [];

  // Event unhook & cleanup handles to prevent listener accumulation on restart
  private challengeUnsubscribe?: () => void;
  private achievementUnsubscribe?: () => void;
  private comboUnsubscribes: (() => void)[] = [];

  // Economy & Progression State
  public coins: number = 0;
  public unlockedTiers: number[] = [1];
  public prestigeLevel: number = 0;
  public prestigeTokens: number = 0;
  public prestigePerks: Record<string, number> = {};
  public clearedZoneMilestones: number[] = [];
  public upgrades: PlayerUpgrades = {
    magnetRange: 1,
    attractPower: 1,
    carryCapacity: 1,
    movementSpeed: 1,
  };

  // Dynamic Events
  private nextScrapStormTime: number = 0;
  private readonly SCRAP_STORM_INTERVAL_MS: number = 150000;

  // Recycler Station Elements & Thermal Cooldown
  private recyclerCenter = GAME_CONSTANTS.RECYCLER_CENTER;
  private recyclerRadius = GAME_CONSTANTS.RECYCLER_RADIUS;
  private recyclerPressSprite!: Phaser.GameObjects.Sprite;
  private lastRecycleProcessTime: number = 0;
  public screenShakeEnabled: boolean = true;
  public sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public pulseSparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public crateDebrisEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public roverDustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public rivalSmokeEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private recyclerSteamEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private recyclerLabel!: Phaser.GameObjects.Text;
  private recyclerProgressBar!: Phaser.GameObjects.Graphics;
  public isRecyclerCoolingDown: boolean = false;
  public recyclerCooldownUntil: number = 0;
  public readonly RECYCLER_COOLDOWN_MS: number = 2500;
  private hadCargoInRecycler: boolean = false;

  // Timers
  private respawnTimer!: Phaser.Time.TimerEvent;

  // Buffs
  public has2xRewardBonus: boolean = false;
  public hasOverchargeBuff: boolean = false;
  public overchargeExpiresAt: number = 0;

  // Haul tracking & Lifetime Stats
  public haulStartTime: number = 0;
  public currentRecycleBatch: ScrapItemData[] = [];
  public preRecyclePeakMass: number = 0;
  public totalScrapCollected: number = 0;
  public totalRecycledRuns: number = 0;
  public goldenScrapCollected: number = 0;
  public crittersRepelled: number = 0;
  public empMineHits: number = 0;
  public adRewardsClaimed: number = 0;
  public sessionStartTime: number = Date.now();
  public loadedPlayTimeSeconds: number = 0;
  public lastMidgameAdTime: number = Date.now();

  constructor() {
    super({ key: 'JunkyardScene' });
  }

  create(): void {
    // Hook Phaser 3 Scene shutdown lifecycle event
    this.events.off('shutdown', this.shutdown, this);
    this.events.on('shutdown', this.shutdown, this);

    this.audioService = ProceduralAudioService.getInstance();
    this.audioService.init();

    // Tab visibility handling for CrazyGames compliance
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.audioService.setMuted(true);
        this.scene.pause();
        getCrazyGamesSDK().game.gameplayStop();
      } else {
        this.audioService.setMuted(false);
        this.scene.resume();
        getCrazyGamesSDK().game.gameplayStart();
      }
    });

    // 0. Initialize Persistence
    const sdk = getCrazyGamesSDK();
    sdk.game.gameplayStart();

    // CrazyGames SDK Audio Mute integration
    if (sdk.game.addSettingsChangeListener) {
      sdk.game.addSettingsChangeListener((settings) => {
        if (settings.muteAudio !== undefined) {
          this.audioService.setMuted(settings.muteAudio);
        }
      });
    }

    const saveManager = SaveManager.getInstance();
    const saved = saveManager.load();
    this.coins = saved.player.coins;
    this.upgrades = saved.player.upgrades;
    this.unlockedTiers = saved.player.unlockedTiers;
    this.prestigeLevel = saved.player.prestigeLevel || 0;
    this.prestigeTokens = saved.player.prestigeTokens || 0;
    this.prestigePerks = saved.player.prestigePerks || {};
    this.clearedZoneMilestones = saved.player.clearedZoneMilestones || [];
    this.screenShakeEnabled = saved.settings?.screenShake ?? true;
    this.challengeManager.deserialize(saved.challenges);
    this.achievementManager.deserialize(saved.achievements);

    if (saved.stats) {
      this.totalScrapCollected = saved.stats.totalScrapCollected || 0;
      this.totalRecycledRuns = saved.stats.totalRecycledRuns || 0;
      this.goldenScrapCollected = saved.stats.goldenScrapCollected || 0;
      this.crittersRepelled = saved.stats.crittersRepelled || 0;
      this.empMineHits = saved.stats.empMineHits || 0;
      this.adRewardsClaimed = saved.stats.adRewardsClaimed || 0;
      this.loadedPlayTimeSeconds = saved.stats.playTimeSeconds || 0;
    }
    this.sessionStartTime = Date.now();

    // Wire Challenge & Achievement Listeners (with idempotent unhooking)
    if (this.challengeUnsubscribe) {
      this.challengeUnsubscribe();
    }
    this.challengeUnsubscribe = this.challengeManager.on((state, completed) => {
      if (completed) {
        this.coins += completed.rewardCoins;
        this.audioService.playCoinClink(1.6);
        this.events.emit('buff-activated', `🎯 CHALLENGE COMPLETE: +${completed.rewardCoins} 🪙!`);
        this.events.emit('coins-updated', this.coins);
        this.saveGameState();
      }
      this.events.emit('challenge-updated', state);
    });

    if (this.achievementUnsubscribe) {
      this.achievementUnsubscribe();
    }
    this.achievementUnsubscribe = this.achievementManager.on((ach, reward) => {
      this.coins += reward;
      this.audioService.playFanfare();
      this.events.emit('buff-activated', `🏆 ACHIEVEMENT: ${ach.title} (+${reward} 🪙)!`);
      this.events.emit('coins-updated', this.coins);
      this.saveGameState();
    });

    // Wire Hazard achievement trigger listener using stable bound handler
    this.events.off('achievement-trigger', this.handleAchievementTrigger, this);
    this.events.on('achievement-trigger', this.handleAchievementTrigger, this);

    // 1. Setup World & Physics Bounds (3000 x 2400)
    this.physics.world.setBounds(0, 0, GAME_CONSTANTS.WORLD_WIDTH, GAME_CONSTANTS.WORLD_HEIGHT);

    // 2. Draw Terrain, Zones & Pathways
    this.buildTerrain();

    // 3. Build Recycler Station Structure
    this.buildRecyclerStation();

    // 4. Instantiate Scrap Pool (200 entities)
    this.scrapPool = new ScrapPool(this);

    // 5. Instantiate Player Rover
    // Spawn just outside the recycler station
    this.playerRover = new PlayerRover(this, this.recyclerCenter.x - 160, this.recyclerCenter.y);
    this.playerRover.setDepth(20);
    this.playerRover.updateStats(this.upgrades, { overcharge: false });

    // 5b. Instantiate Hazard & Threat Manager
    this.hazardManager = new HazardManager(this);
    this.nextScrapStormTime = Date.now() + this.SCRAP_STORM_INTERVAL_MS;

    // Collider with Rival Scavenger for high-speed ramming
    this.physics.add.collider(this.playerRover, this.hazardManager.rivalScavenger, () => {
      const rival = this.hazardManager.rivalScavenger;
      if (!rival || !rival.isActiveRival || rival.isStunned) return;

      const roverSpeed = this.playerRover.body ? this.playerRover.body.velocity.length() : 0;
      if (roverSpeed >= 120) {
        rival.stun(2500, this.time.now);
        const spilled = rival.spillLoot(this.scrapPool, 2);
        this.triggerScreenShake(160, 0.010);
        this.audioService.playCompressorCrunch();
        this.showFloatingText(rival.x, rival.y - 30, `💥 RIVAL RAMMED! (+${spilled} scrap)`, '#ff9100', 14);
      }
    });

    // 6. Camera Follow with Smooth Lerp
    this.cameras.main.setBounds(0, 0, GAME_CONSTANTS.WORLD_WIDTH, GAME_CONSTANTS.WORLD_HEIGHT);
    this.cameras.main.startFollow(this.playerRover, true, 0.08, 0.08);

    // 7. Initial Scrap Spawning across Unlocked Zones
    this.initialScrapSpawn();

    // 7b. Instantiate Destructible Pinata Crates
    this.buildDestructibleObstacles();

    // 8. Respawn Interval Loop (every 1.5s)
    this.respawnTimer = this.time.addEvent({
      delay: GAME_CONSTANTS.RESPAWN_INTERVAL_MS,
      callback: this.handleRespawnTick,
      callbackScope: this,
      loop: true,
    });

    // 9. Wire Combo & Fever Mode State Machine (with unhook tracking)
    for (const unsub of this.comboUnsubscribes) {
      unsub();
    }
    this.comboUnsubscribes = [];

    this.comboUnsubscribes.push(
      this.comboManager.on('fever-started', (state) => {
        this.triggerScreenShake(300, 0.012);
        this.audioService.playFeverFanfare();
        this.abilityManager.resetCooldown();
        if (this.playerRover) {
          this.playerRover.setFever(true);
          this.showFloatingText(
            this.playerRover.x,
            this.playerRover.y - 35,
            '🔥 FEVER MODE! 5x COINS & PULSE RESET! 🔥',
            '#ff007f',
            18
          );
        }
        this.events.emit('fever-started', state);
        TestBridge.recordEvent('fever-started', state);
      }),
      this.comboManager.on('fever-ended', (state) => {
        if (this.playerRover) {
          this.playerRover.setFever(false);
        }
        this.audioService.setComboPitchModifier(1.0);
        this.events.emit('fever-ended', state);
        TestBridge.recordEvent('fever-ended', state);
      }),
      this.comboManager.on('combo-expired', (state) => {
        this.audioService.setComboPitchModifier(1.0);
        this.events.emit('combo-expired', state);
        TestBridge.recordEvent('combo-expired', state);
      }),
      this.comboManager.on('combo-updated', (state) => {
        this.events.emit('combo-updated', state);
      })
    );

    // Apply meta-progression permanent perks
    this.applyPrestigePerks();

    // Notify UI of initial values
    this.events.emit('coins-updated', this.coins);
    this.events.emit('tier-updated', this.unlockedTiers[this.unlockedTiers.length - 1]);
    this.events.emit('cargo-updated', this.playerRover.cargo);
    this.events.emit('combo-updated', this.comboManager.getState());
    this.events.emit('prestige-updated', this.prestigeLevel);
    this.events.emit('prestige-tokens-updated', this.prestigeTokens);
    this.events.emit('challenge-updated', this.challengeManager.getState());

    // Start Generative Wasteland Ambient Music (drone + wind + pentatonic chimes)
    if (this.audioService) {
      this.audioService.startAmbientMusic();
      if (this.input) {
        this.input.once('pointerdown', () => {
          this.audioService.startAmbientMusic();
        });
      }
    }

    // Check offline earnings on boot
    const offline = saveManager.calculateOfflineEarnings();
    if (offline.offlineCoins > 0) {
      this.time.delayedCall(600, () => {
        this.events.emit('offline-earnings', offline);
      });
    }
  }

  // --------------------------------------------------------------------------
  // Terrain & World Generation
  // --------------------------------------------------------------------------
  private buildTerrain(): void {
    // 1. Tiled dirt base layer from Kenney environment
    if (this.textures.exists('ground_dirt')) {
      const bgTile = this.add.tileSprite(
        GAME_CONSTANTS.WORLD_WIDTH / 2,
        GAME_CONSTANTS.WORLD_HEIGHT / 2,
        GAME_CONSTANTS.WORLD_WIDTH,
        GAME_CONSTANTS.WORLD_HEIGHT,
        'ground_dirt'
      );
      bgTile.setDepth(0);
      bgTile.setAlpha(0.75);
    }

    const graphics = this.add.graphics();
    graphics.setDepth(0);

    // Dark dirt overlay tint if no texture
    if (!this.textures.exists('ground_dirt')) {
      graphics.fillStyle(0x191715, 1);
      graphics.fillRect(0, 0, GAME_CONSTANTS.WORLD_WIDTH, GAME_CONSTANTS.WORLD_HEIGHT);
    }

    // Draw Zone Fields with Distinct Tones
    for (const tier of JUNKYARD_TIERS) {
      graphics.fillStyle(tier.color, 0.28);
      graphics.fillRect(tier.bounds.x, tier.bounds.y, tier.bounds.width, tier.bounds.height);

      graphics.lineStyle(2, tier.color, 0.6);
      graphics.strokeRect(tier.bounds.x, tier.bounds.y, tier.bounds.width, tier.bounds.height);

      // Zone Label in World Space
      this.add
        .text(
          tier.bounds.x + 24,
          tier.bounds.y + 24,
          `ZONE ${tier.id}: ${tier.name.toUpperCase()}\n(${tier.subtitle})`,
          {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '20px',
            color: tier.accentColor,
            fontStyle: 'bold',
          }
        )
        .setAlpha(0.65)
        .setDepth(1);
    }

    // Grid Floor Seams / Rusty Panels
    graphics.lineStyle(1, 0x2b2520, 0.3);
    for (let x = 0; x <= GAME_CONSTANTS.WORLD_WIDTH; x += 150) {
      graphics.lineBetween(x, 0, x, GAME_CONSTANTS.WORLD_HEIGHT);
    }
    for (let y = 0; y <= GAME_CONSTANTS.WORLD_HEIGHT; y += 150) {
      graphics.lineBetween(0, y, GAME_CONSTANTS.WORLD_WIDTH, y);
    }

    // Central Access Roads leading to Recycler Station
    if (this.textures.exists('ground_sand')) {
      const roadH = this.add.tileSprite(
        GAME_CONSTANTS.WORLD_WIDTH / 2,
        this.recyclerCenter.y,
        GAME_CONSTANTS.WORLD_WIDTH,
        240,
        'ground_sand'
      );
      roadH.setDepth(0);
      roadH.setAlpha(0.45);

      const roadV = this.add.tileSprite(
        this.recyclerCenter.x,
        GAME_CONSTANTS.WORLD_HEIGHT / 2,
        240,
        GAME_CONSTANTS.WORLD_HEIGHT,
        'ground_sand'
      );
      roadV.setDepth(0);
      roadV.setAlpha(0.45);
    } else {
      graphics.fillStyle(0x28231d, 0.7);
      graphics.fillRect(0, this.recyclerCenter.y - 120, GAME_CONSTANTS.WORLD_WIDTH, 240);
      graphics.fillRect(this.recyclerCenter.x - 120, 0, 240, GAME_CONSTANTS.WORLD_HEIGHT);
    }
  }

  // --------------------------------------------------------------------------
  // Recycler Station Compactor
  // --------------------------------------------------------------------------
  private buildRecyclerStation(): void {
    const rx = this.recyclerCenter.x;
    const ry = this.recyclerCenter.y;

    // Recycler Concrete Base Pad
    const pad = this.add.sprite(rx, ry, 'recycler_pad');
    pad.setDepth(5);

    // Hydraulic Crusher Press Sprite
    this.recyclerPressSprite = this.add.sprite(rx, ry - 10, 'recycler_press');
    this.recyclerPressSprite.setDepth(6);

    // Signage
    this.recyclerLabel = this.add.text(rx, ry + 85, 'RECYCLER STATION', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });
    this.recyclerLabel.setOrigin(0.5, 0.5);
    this.recyclerLabel.setDepth(7);

    // Thermal Cooldown Progress Bar
    this.recyclerProgressBar = this.add.graphics();
    this.recyclerProgressBar.setDepth(8);
    this.recyclerProgressBar.setVisible(false);

    // Spark Particles for Compactor Crunch
    this.sparkEmitter = this.add.particles(rx, ry, 'spark_particle', {
      speed: { min: 60, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      lifespan: 300,
      gravityY: 120,
      emitting: false,
    });
    this.sparkEmitter.setDepth(25);

    // Pulse Sparks Emitter (Electric Cyan/White Burst)
    this.pulseSparkEmitter = this.add.particles(0, 0, 'pulse_spark', {
      speed: { min: 140, max: 380 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1.0, end: 0 },
      tint: [0x00e5ff, 0xffffff, 0x80d8ff],
      lifespan: 400,
      gravityY: 0,
      emitting: false,
    });
    this.pulseSparkEmitter.setDepth(25);

    // Destructible Crate Debris Emitter (Wooden Splinters & Shards)
    this.crateDebrisEmitter = this.add.particles(0, 0, 'crate_debris', {
      speed: { min: 90, max: 260 },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1.0, end: 0.2 },
      alpha: { start: 1.0, end: 0 },
      lifespan: 550,
      gravityY: 180,
      emitting: false,
    });
    this.crateDebrisEmitter.setDepth(22);

    // Rover High-Speed Dust Emitter (Ground Treads)
    this.roverDustEmitter = this.add.particles(0, 0, 'dust_particle', {
      speed: { min: 8, max: 25 },
      scale: { start: 0.5, end: 1.0 },
      alpha: { start: 0.25, end: 0 },
      lifespan: 220,
      emitting: false,
    });
    this.roverDustEmitter.setDepth(5);

    // Ensure smoke_particle texture exists (fallback if BootScene not run in test)
    if (!this.textures.exists('smoke_particle')) {
      const gSmoke = this.make.graphics({ x: 0, y: 0 });
      gSmoke.fillStyle(0x78909c, 0.85);
      gSmoke.fillCircle(7, 7, 6);
      gSmoke.generateTexture('smoke_particle', 14, 14);
      gSmoke.destroy();
    }

    // Rival Scavenger Spawn/Despawn Smoke Emitter
    this.rivalSmokeEmitter = this.add.particles(0, 0, 'smoke_particle', {
      speed: { min: 20, max: 70 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.0, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 600,
      quantity: 10,
      emitting: false,
    });
    this.rivalSmokeEmitter.setDepth(26);

    // Ensure steam_particle texture exists
    if (!this.textures.exists('steam_particle')) {
      const gSteam = this.make.graphics({ x: 0, y: 0 });
      gSteam.fillStyle(0xffffff, 0.85);
      gSteam.fillCircle(10, 10, 8);
      gSteam.fillStyle(0xe0e0e0, 0.45);
      gSteam.fillCircle(10, 10, 10);
      gSteam.generateTexture('steam_particle', 20, 20);
      gSteam.destroy();
    }

    // Procedural Steam/Smoke Particle Emitter for Thermal Cooldown
    this.recyclerSteamEmitter = this.add.particles(rx, ry, 'steam_particle', {
      speed: { min: 35, max: 110 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.6, end: 2.2 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xffffff, 0xeeeeee, 0xb0bec5],
      lifespan: 1100,
      gravityY: -45,
      emitting: false,
    });
    this.recyclerSteamEmitter.setDepth(26);
  }

  // --------------------------------------------------------------------------
  // Scrap Spawning
  // --------------------------------------------------------------------------
  private initialScrapSpawn(): void {
    for (const tierId of this.unlockedTiers) {
      const tierConfig = JUNKYARD_TIERS.find((t) => t.id === tierId);
      if (!tierConfig) continue;

      const toSpawn = Math.min(tierConfig.quota, 35);
      for (let i = 0; i < toSpawn; i++) {
        this.scrapPool.spawnForZone(
          tierId,
          this.playerRover.x,
          this.playerRover.y,
          this.recyclerCenter.x,
          this.recyclerCenter.y
        );
      }
    }
  }

  private handleRespawnTick(): void {
    if (!this.playerRover || !this.scrapPool) return;
    this.scrapPool.respawnTick(
      this.playerRover.x,
      this.playerRover.y,
      this.recyclerCenter.x,
      this.recyclerCenter.y,
      this.unlockedTiers
    );
  }

  // --------------------------------------------------------------------------
  // Main Update Simulation
  // --------------------------------------------------------------------------
  override update(time: number, delta: number): void {
    // 1. Fetch unified input vector from UIScene
    let inputVector = new Phaser.Math.Vector2(0, 0);
    const uiScene = this.scene.get('UIScene') as UIScene;
    if (uiScene && uiScene.getInputVector) {
      inputVector = uiScene.getInputVector();
    }

    // 2. Update Overcharge Buff Timer
    if (this.hasOverchargeBuff && time > this.overchargeExpiresAt) {
      this.hasOverchargeBuff = false;
      this.playerRover.updateStats(this.upgrades, { overcharge: false });
    }

    // 3. Update Combo & Fever State Machine Tick & Audio Pitch
    this.comboManager.update(time);
    this.audioService.setComboPitchModifier(this.comboManager.getAudioPitchModifier());

    // 4. Update Player Rover Kinematics & Field Graphics
    if (this.playerRover) {
      this.playerRover.updateMovement(delta, inputVector, time);
    }

    // 5. Update Magnetic Attraction & Collection
    if (this.playerRover && this.scrapPool) {
      const { collectedItems } = this.scrapPool.updateAttraction(
        this.playerRover,
        this.audioService
      );

      if (collectedItems.length > 0) {
        this.events.emit('cargo-updated', this.playerRover.cargo);
        for (const item of collectedItems) {
          this.handleScrapCollected(item, time);
        }
      }
    }

    // 6. Recycler Drop Zone Processing Check
    this.processRecyclerZone(time);

    // 7. Update Hazards & Threat Mechanics
    if (this.hazardManager && this.playerRover && this.scrapPool) {
      const sessionElapsedMs = Date.now() - this.sessionStartTime;
      this.hazardManager.update(time, delta, this.playerRover, this.scrapPool, this.unlockedTiers, sessionElapsedMs);
    }

    // 8. Dynamic Event: Periodic Scrap Storm
    if (time >= this.nextScrapStormTime && this.playerRover && this.scrapPool) {
      const currentTier = this.unlockedTiers[this.unlockedTiers.length - 1];
      this.scrapPool.triggerScrapStorm(currentTier, this.playerRover.x, this.playerRover.y);
      this.events.emit('buff-activated', '🌪️ SCRAP STORM! 15 high-value scraps detected!');
      this.audioService.playCoinClink(1.8);
      this.nextScrapStormTime = time + this.SCRAP_STORM_INTERVAL_MS;
      this.achievementManager.unlock('storm_chaser');
    }
  }

  public handleScrapCollected(item: ScrapItemData, time: number = this.time?.now || Date.now()): void {
    // Start haul timer on first item pickup in a run
    if (this.haulStartTime === 0) {
      this.haulStartTime = time;
    }

    this.totalScrapCollected++;
    if (this.totalScrapCollected >= 50) {
      this.achievementManager.unlock('scrap_collector_50');
    }

    const res = this.comboManager.recordPickup(time);
    this.audioService.setComboPitchModifier(res.pitchModifier);

    // Check Achievements on scrap collection
    if (item.isGolden) {
      this.goldenScrapCollected++;
      this.achievementManager.unlock('golden_touch');
      this.showFloatingText(item.width ? this.playerRover.x : this.playerRover.x, this.playerRover.y - 45, '✨ GOLDEN SCRAP! (5x)', '#ffd700', 16);
    }
    if (res.count >= 5) {
      this.achievementManager.unlock('combo_starter');
    }
    if (res.triggeredFever) {
      this.achievementManager.unlock('fever_master');
    }

    if (res.count >= 3 && !res.triggeredFever) {
      const multColors: Record<number, string> = {
        1.5: '#00e676',
        2.0: '#00e5ff',
        3.0: '#ff9100',
        5.0: '#ff007f',
      };
      this.showFloatingText(
        this.playerRover.x,
        this.playerRover.y - 25,
        `${res.multiplier}x COMBO!`,
        multColors[res.multiplier] || '#ffd54f',
        14
      );
    }

    TestBridge.recordEvent('scrap-collected', {
      typeId: item.typeId,
      massKg: item.massKg,
      combo: res.count,
      multiplier: res.multiplier,
      isFever: res.isFever,
    });
  }

  // --------------------------------------------------------------------------
  // Recycler Processing Loop & Thermal Cooldown
  // --------------------------------------------------------------------------
  public isPlayerInRecyclerZone(): boolean {
    if (!this.playerRover) return false;
    const dx = this.playerRover.x - this.recyclerCenter.x;
    const dy = this.playerRover.y - this.recyclerCenter.y;
    return dx * dx + dy * dy <= this.recyclerRadius * this.recyclerRadius;
  }

  private processRecyclerZone(time: number): void {
    // 1. If currently in thermal cooldown, verify expiry or update visual and lockout
    if (this.isRecyclerCoolingDown) {
      if (time >= this.recyclerCooldownUntil) {
        this.endRecyclerCooldown();
      } else {
        this.updateRecyclerCooldownVisual(time);
        return; // Ignore player proximity and block deposits during cooldown
      }
    }

    // 2. Check player proximity
    if (!this.isPlayerInRecyclerZone()) {
      this.hadCargoInRecycler = false;
      return;
    }

    // 3. Check cargo state inside zone
    if (!this.playerRover || this.playerRover.cargo.items.length === 0) {
      if (this.hadCargoInRecycler) {
        this.hadCargoInRecycler = false;
        this.triggerRecyclerCooldown(time);
      }
      return;
    }

    // Mark that player has cargo inside the recycler zone and capture pre-recycle state
    if (!this.hadCargoInRecycler) {
      this.hadCargoInRecycler = true;
      this.currentRecycleBatch = [];
      this.preRecyclePeakMass = this.playerRover.cargo.currentMassKg;
    }

    // Process one scrap item with compactor speed (75ms down to 30ms with capacity upgrade, accelerating up to -10ms in late session)
    const sessionElapsedMs = Date.now() - this.sessionStartTime;
    const pacingProgress = sessionElapsedMs >= 300000 ? Math.min(1, (sessionElapsedMs - 300000) / 300000) : 0;
    const baseInterval = Math.max(30, 75 - (this.upgrades.carryCapacity - 1) * 5);
    const compactorInterval = Math.max(20, baseInterval - Math.floor(pacingProgress * 10));
    if (time - this.lastRecycleProcessTime >= compactorInterval) {
      this.lastRecycleProcessTime = time;

      const item = this.playerRover.cargo.items.pop();
      if (!item) return;

      this.currentRecycleBatch.push(item);

      // Recalculate cargo state
      this.playerRover.cargo.currentMassKg = Math.max(
        0,
        Math.round((this.playerRover.cargo.currentMassKg - item.massKg) * 10) / 10
      );
      this.playerRover.cargo.itemsCount = this.playerRover.cargo.items.length;
      this.playerRover.cargo.isFull =
        this.playerRover.cargo.currentMassKg >= this.playerRover.cargo.maxCapacityKg;

      // Calculate reward with 2x ad buff, dynamic combo/fever multiplier, golden scrap, and prestige bonus
      const baseMultiplier = this.has2xRewardBonus ? 2 : 1;
      const comboMultiplier = this.comboManager.getCoinMultiplier();
      const goldenMultiplier = item.isGolden ? 5 : 1;
      const prestigeMultiplier = 1.0 + 0.10 * this.prestigeLevel;
      const coinGain = Math.round(item.coinValue * goldenMultiplier * baseMultiplier * comboMultiplier * prestigeMultiplier);
      this.coins += coinGain;

      // Achievements on recycle
      this.achievementManager.unlock('first_crush');
      if (item.isGolden) {
        this.achievementManager.unlock('golden_touch');
      }

      // Audio & Visual Effects
      this.audioService.playCompressorCrunch();
      this.audioService.playCoinClink();
      this.sparkEmitter.explode(6, this.recyclerCenter.x, this.recyclerCenter.y);

      // Hydraulic press bounce animation
      this.tweens.add({
        targets: this.recyclerPressSprite,
        y: this.recyclerCenter.y + 8,
        duration: 35,
        yoyo: true,
        ease: 'Quad.inOut',
      });

      // Floating text FX
      this.showFloatingCoinText(coinGain);

      // Notify UI
      this.events.emit('cargo-updated', this.playerRover.cargo);
      this.events.emit('coins-updated', this.coins);
      TestBridge.recordEvent('recycle-processed', {
        coinGain,
        item: item.typeId,
        comboMultiplier,
      });

      // If batch just emptied to 0kg, initiate 2.5s thermal cooldown
      if (this.playerRover.cargo.items.length === 0 || this.playerRover.cargo.currentMassKg === 0) {
        const highestTier = this.unlockedTiers[this.unlockedTiers.length - 1];
        const elapsedSec = this.haulStartTime > 0 ? (time - this.haulStartTime) / 1000 : 999;
        this.challengeManager.evaluateRecycle(
          this.currentRecycleBatch,
          this.preRecyclePeakMass,
          this.playerRover.cargo.maxCapacityKg,
          elapsedSec,
          highestTier
        );

        // Zone First-Clear Milestone Bonus
        const batchTiers = new Set(this.currentRecycleBatch.map((it) => it.tier));
        const MILESTONE_BONUSES: Record<number, number> = { 2: 200, 3: 500, 4: 1000 };
        for (const t of batchTiers) {
          if (MILESTONE_BONUSES[t] && !this.clearedZoneMilestones.includes(t)) {
            this.clearedZoneMilestones.push(t);
            const bonus = MILESTONE_BONUSES[t];
            this.coins += bonus;
            this.audioService.playFanfare();
            this.events.emit('buff-activated', `🌟 ZONE ${t} FIRST CLEAR! +${bonus} 🪙 BONUS!`);
            this.showFloatingText(this.recyclerCenter.x, this.recyclerCenter.y - 65, `+${bonus} 🪙 ZONE BONUS!`, '#00e5ff', 18);
            this.events.emit('coins-updated', this.coins);
          }
        }

        this.currentRecycleBatch = [];
        this.preRecyclePeakMass = 0;
        this.haulStartTime = 0;

        // Reset 2x ad buff after use
        if (this.has2xRewardBonus) {
          this.has2xRewardBonus = false;
          this.events.emit('buff-activated', '2x Coins bonus consumed!');
        }

        // Increment totalRecycledRuns and check achievement
        this.totalRecycledRuns++;
        if (this.totalRecycledRuns >= 5) {
          this.achievementManager.unlock('hauler_apprentice');
        }

        this.hadCargoInRecycler = false;
        this.triggerRecyclerCooldown(time);
        this.saveGameState();
      }
    }
  }

  public triggerRecyclerCooldown(time: number = this.time?.now || Date.now()): void {
    this.isRecyclerCoolingDown = true;
    this.recyclerCooldownUntil = time + this.RECYCLER_COOLDOWN_MS;

    if (this.recyclerSteamEmitter) {
      this.recyclerSteamEmitter.start();
    }
    this.audioService.playSteamHiss(2.5);

    this.updateRecyclerCooldownVisual(time);
    this.events.emit('recycler-cooldown-started', {
      cooldownUntil: this.recyclerCooldownUntil,
      durationMs: this.RECYCLER_COOLDOWN_MS,
    });
    TestBridge.recordEvent('recycler-cooldown-started', {
      cooldownUntil: this.recyclerCooldownUntil,
      durationMs: this.RECYCLER_COOLDOWN_MS,
    });
  }

  public endRecyclerCooldown(): void {
    this.isRecyclerCoolingDown = false;
    this.recyclerCooldownUntil = 0;

    if (this.recyclerSteamEmitter) {
      this.recyclerSteamEmitter.stop();
    }
    if (this.recyclerLabel) {
      this.recyclerLabel.setText('RECYCLER STATION');
      this.recyclerLabel.setColor('#ffd54f');
    }
    if (this.recyclerProgressBar) {
      this.recyclerProgressBar.clear();
      this.recyclerProgressBar.setVisible(false);
    }

    this.events.emit('recycler-cooldown-ended');
    TestBridge.recordEvent('recycler-cooldown-ended');
  }

  private updateRecyclerCooldownVisual(time: number): void {
    const remainingMs = Math.max(0, this.recyclerCooldownUntil - time);
    const remainingSec = (remainingMs / 1000).toFixed(1);

    if (this.recyclerLabel) {
      this.recyclerLabel.setText(`⚠️ COOLING DOWN... (${remainingSec}s)`);
      this.recyclerLabel.setColor('#ff9100');
    }

    if (this.recyclerProgressBar) {
      this.recyclerProgressBar.clear();
      this.recyclerProgressBar.setVisible(true);

      const rx = this.recyclerCenter.x;
      const ry = this.recyclerCenter.y + 102;
      const totalW = 160;
      const barH = 6;
      const progress = 1.0 - remainingMs / this.RECYCLER_COOLDOWN_MS;

      // Background
      this.recyclerProgressBar.fillStyle(0x1a1a1a, 0.85);
      this.recyclerProgressBar.fillRoundedRect(rx - totalW / 2, ry, totalW, barH, 3);
      this.recyclerProgressBar.lineStyle(1, 0x546e7a, 0.8);
      this.recyclerProgressBar.strokeRoundedRect(rx - totalW / 2, ry, totalW, barH, 3);

      // Fill
      const fillW = Math.max(0, Math.floor((totalW - 2) * Math.min(1.0, Math.max(0, progress))));
      if (fillW > 0) {
        this.recyclerProgressBar.fillStyle(0x00e5ff, 0.9);
        this.recyclerProgressBar.fillRoundedRect(rx - totalW / 2 + 1, ry + 1, fillW, barH - 2, 2);
      }
    }
  }

  public showFloatingText(
    x: number,
    y: number,
    message: string,
    color: string = '#ffd54f',
    fontSize: number = 16
  ): void {
    const text = this.add.text(x, y, message, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${fontSize}px`,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(30);

    this.tweens.add({
      targets: text,
      y: y - 45,
      alpha: 0,
      duration: 650,
      ease: 'Quad.out',
      onComplete: () => text.destroy(),
    });
  }

  private showFloatingCoinText(amount: number): void {
    const rx = this.recyclerCenter.x + (Math.random() * 60 - 30);
    const ry = this.recyclerCenter.y - 40;
    this.showFloatingText(rx, ry, `+${amount} 🪙`, '#ffd54f', 16);
  }

  // --------------------------------------------------------------------------
  // Public Economy & Test Action API
  // --------------------------------------------------------------------------
  public triggerRecycleNow(): { itemsRecycled: number; coinsAwarded: number } {
    // Lockout during thermal cooldown
    if (this.isRecyclerCoolingDown) {
      return { itemsRecycled: 0, coinsAwarded: 0 };
    }
    if (!this.playerRover) return { itemsRecycled: 0, coinsAwarded: 0 };

    const items = this.playerRover.emptyCargo();
    const baseMultiplier = this.has2xRewardBonus ? 2 : 1;
    const comboMultiplier = this.comboManager.getCoinMultiplier();
    const prestigeMultiplier = 1.0 + 0.10 * this.prestigeLevel;
    let awarded = 0;

    for (const item of items) {
      const goldenMultiplier = item.isGolden ? 5 : 1;
      awarded += Math.round(item.coinValue * goldenMultiplier * baseMultiplier * comboMultiplier * prestigeMultiplier);
    }

    this.coins += awarded;
    if (items.length > 0) {
      const elapsedSec = this.haulStartTime > 0
        ? ((this.time?.now || Date.now()) - this.haulStartTime) / 1000
        : 999;
      const highestTier = this.unlockedTiers[this.unlockedTiers.length - 1];
      this.challengeManager.evaluateRecycle(
        items,
        items.reduce((s, i) => s + i.massKg, 0),
        this.playerRover.cargo.maxCapacityKg,
        elapsedSec,
        highestTier
      );

      // Zone First-Clear Milestone Bonus
      const batchTiers = new Set(items.map((it) => it.tier));
      const MILESTONE_BONUSES: Record<number, number> = { 2: 200, 3: 500, 4: 1000 };
      for (const t of batchTiers) {
        if (MILESTONE_BONUSES[t] && !this.clearedZoneMilestones.includes(t)) {
          this.clearedZoneMilestones.push(t);
          const bonus = MILESTONE_BONUSES[t];
          this.coins += bonus;
          this.audioService.playFanfare();
          this.events.emit('buff-activated', `🌟 ZONE ${t} FIRST CLEAR! +${bonus} 🪙 BONUS!`);
          this.showFloatingText(this.recyclerCenter.x, this.recyclerCenter.y - 65, `+${bonus} 🪙 ZONE BONUS!`, '#00e5ff', 18);
          this.events.emit('coins-updated', this.coins);
        }
      }

      this.haulStartTime = 0;
      this.has2xRewardBonus = false;
      this.totalRecycledRuns++;
      if (this.totalRecycledRuns >= 5) {
        this.achievementManager.unlock('hauler_apprentice');
      }
      this.audioService.playCompressorCrunch();
      this.audioService.playCoinClink();
      this.sparkEmitter.explode(12, this.recyclerCenter.x, this.recyclerCenter.y);
      this.saveGameState();
      this.triggerRecyclerCooldown(this.time?.now || Date.now());

      // CrazyGames Midgame Ad Integration (requires min 3 min initial playtime)
      if (Date.now() - this.lastMidgameAdTime >= 180000) { // 3 minutes
        this.lastMidgameAdTime = Date.now();
        const sdk = getCrazyGamesSDK();
        sdk.ad.requestAd('midgame', {
          adStarted: () => {
            this.audioService.setMuted(true);
            this.scene.pause();
            sdk.game.gameplayStop();
          },
          adFinished: () => {
            this.audioService.setMuted(false);
            this.scene.resume();
            sdk.game.gameplayStart();
          },
          adError: (err) => {
            console.warn('[JunkyardScene] Midgame ad error:', err);
            this.audioService.setMuted(false);
            this.scene.resume();
            sdk.game.gameplayStart();
          }
        });
      }
    }

    this.events.emit('cargo-updated', this.playerRover.cargo);
    this.events.emit('coins-updated', this.coins);

    return { itemsRecycled: items.length, coinsAwarded: awarded };
  }

  public triggerScreenShake(duration: number = 150, intensity: number = 0.01): void {
    if (!this.screenShakeEnabled) return;
    if (this.cameras && this.cameras.main) {
      this.cameras.main.shake(duration, intensity);
    }
  }

  public setScreenShakeEnabled(enabled: boolean): void {
    this.screenShakeEnabled = enabled;
    this.saveGameState();
    this.events.emit('screenshake-toggled', enabled);
  }

  public triggerMagneticPulse(): boolean {
    const time = this.time?.now || Date.now();
    if (!this.abilityManager.triggerPulse(time)) {
      return false;
    }

    if (!this.playerRover) return false;

    // 1. Audio & Camera Juice
    this.audioService.playEMPBlast();
    this.triggerScreenShake(200, 0.012);

    const rx = this.playerRover.x;
    const ry = this.playerRover.y;
    const pulseRadius = this.playerRover.effectiveRadius * 2.2;

    if (this.pulseSparkEmitter) {
      this.pulseSparkEmitter.explode(36, rx, ry);
    }

    // 2. Expanding shockwave ring graphic
    const shockwave = this.add.graphics();
    shockwave.setDepth(18);

    this.tweens.addCounter({
      from: 20,
      to: pulseRadius,
      duration: 350,
      ease: 'Quad.out',
      onUpdate: (tween) => {
        const curR = tween.getValue() || 20;
        shockwave.clear();
        const alpha = Math.max(0, 1.0 - curR / pulseRadius);
        shockwave.lineStyle(4, 0x00e5ff, alpha);
        shockwave.strokeCircle(rx, ry, curR);
        shockwave.lineStyle(1.5, 0xffffff, alpha * 0.8);
        shockwave.strokeCircle(rx, ry, curR * 0.85);
      },
      onComplete: () => {
        shockwave.destroy();
      },
    });

    // 3. Attract all nearby scraps with high velocity impulse
    if (this.scrapPool) {
      const nearbyScraps = this.scrapPool.getInRadius(rx, ry, pulseRadius);
      for (const scrap of nearbyScraps) {
        if (!scrap.active || !scrap.body) continue;
        const angle = Phaser.Math.Angle.Between(scrap.x, scrap.y, rx, ry);
        const impulseSpeed = 380;
        scrap.body.setVelocity(Math.cos(angle) * impulseSpeed, Math.sin(angle) * impulseSpeed);
      }
    }

    // 4. Shatter all crates within pulse radius
    for (const crate of this.destructibleCrates) {
      if (!crate.active || crate.isDestroyed) continue;
      const dx = crate.x - rx;
      const dy = crate.y - ry;
      if (dx * dx + dy * dy <= pulseRadius * pulseRadius) {
        crate.breakCrate(this, true);
      }
    }

    // 5. Stun Rival Scavenger and spill stolen loot if in pulse radius
    if (this.hazardManager?.rivalScavenger?.isActiveRival) {
      const rival = this.hazardManager.rivalScavenger;
      const rdx = rival.x - rx;
      const rdy = rival.y - ry;
      if (rdx * rdx + rdy * rdy <= pulseRadius * pulseRadius) {
        rival.stun(3500, time);
        const spilled = rival.spillLoot(this.scrapPool, 3);
        this.showFloatingText(rival.x, rival.y - 30, `⚡ RIVAL STUNNED! (+${spilled} scrap)`, '#00e5ff', 16);
      }
    }

    this.showFloatingText(rx, ry - 35, '💥 MAGNETIC PULSE!', '#00e5ff', 16);
    this.events.emit('buff-activated', '💥 MAGNETIC PULSE ACTIVATED!');
    return true;
  }

  private buildDestructibleObstacles(): void {
    for (const tier of JUNKYARD_TIERS) {
      const numCrates = 5;
      for (let i = 0; i < numCrates; i++) {
        let cx = 0;
        let cy = 0;
        for (let attempt = 0; attempt < 10; attempt++) {
          cx = tier.bounds.x + 80 + Math.random() * (tier.bounds.width - 160);
          cy = tier.bounds.y + 80 + Math.random() * (tier.bounds.height - 160);
          if (Math.abs(cx - this.recyclerCenter.x) > 180 || Math.abs(cy - this.recyclerCenter.y) > 180) {
            break;
          }
        }

        const crate = new DestructibleCrate(this, cx, cy, tier.id);
        this.destructibleCrates.push(crate);
      }
    }

    // Add physics collision with player rover
    this.physics.add.collider(this.playerRover, this.destructibleCrates, (_rover, crateObj) => {
      const crate = crateObj as DestructibleCrate;
      if (!crate || crate.isDestroyed) return;

      const roverSpeed = this.playerRover.body ? this.playerRover.body.velocity.length() : 0;
      if (roverSpeed >= 90) {
        crate.breakCrate(this);
      }
    });
  }

  public setCombo(count: number): void {
    this.comboManager.setCombo(count, this.time?.now || Date.now());
  }

  public triggerFever(): void {
    this.comboManager.triggerFever(this.time?.now || Date.now());
  }

  public setCoins(amount: number): void {
    this.coins = Math.max(0, amount);
    this.saveGameState();
    this.events.emit('coins-updated', this.coins);
  }

  public addCoins(amount: number): void {
    this.setCoins(this.coins + amount);
  }

  public purchaseUpgrade(statId: keyof PlayerUpgrades): boolean {
    const currentLvl = this.upgrades[statId];
    const cost = getUpgradeCost(statId, currentLvl);

    if (this.coins < cost || currentLvl >= 10) {
      return false;
    }

    this.coins -= cost;
    this.upgrades[statId]++;
    if (this.upgrades[statId] >= 10) {
      this.achievementManager.unlock('max_tech');
    }
    this.playerRover.updateStats(this.upgrades, { overcharge: this.hasOverchargeBuff }, this.prestigePerks);
    this.saveGameState();

    this.audioService.playCoinClink(1.3);
    this.events.emit('coins-updated', this.coins);
    this.events.emit('cargo-updated', this.playerRover.cargo);
    return true;
  }

  public unlockTier(tierId: number): boolean {
    if (this.unlockedTiers.includes(tierId)) return true;
    const tier = JUNKYARD_TIERS.find((t) => t.id === tierId);
    if (!tier) return false;

    if (this.coins < tier.unlockCost) return false;

    this.coins -= tier.unlockCost;
    this.unlockedTiers.push(tierId);
    this.unlockedTiers.sort((a, b) => a - b);
    if (this.unlockedTiers.length >= 4) {
      this.achievementManager.unlock('tier_pioneer');
    }
    this.saveGameState();

    // Initial scrap spawn in newly unlocked tier
    const toSpawn = Math.min(tier.quota, 25);
    for (let i = 0; i < toSpawn; i++) {
      this.scrapPool.spawnForZone(
        tierId,
        this.playerRover.x,
        this.playerRover.y,
        this.recyclerCenter.x,
        this.recyclerCenter.y
      );
    }

    this.audioService.playCoinClink(1.5);
    this.events.emit('coins-updated', this.coins);
    this.events.emit('tier-updated', tierId);
    return true;
  }

  public applyPrestigePerks(): void {
    if (this.playerRover) {
      this.playerRover.updateStats(
        this.upgrades,
        { overcharge: this.hasOverchargeBuff, fever: this.comboManager.isFever },
        this.prestigePerks
      );
    }
    if (this.abilityManager) {
      const cooldownReductionSec = (this.prestigePerks.overclock_pulse || 0) * 1.5;
      this.abilityManager.setCooldownMs(Math.max(4000, 12000 - cooldownReductionSec * 1000));
    }
    if (this.comboManager) {
      const bonusFeverSec = (this.prestigePerks.fever_rush || 0) * 2.0;
      this.comboManager.setFeverDurationMs(10000 + bonusFeverSec * 1000);
    }
    if (this.scrapPool) {
      const bonusGoldenRate = (this.prestigePerks.midas_touch || 0) * 0.02;
      this.scrapPool.setGoldenChanceBonus(bonusGoldenRate);
    }
  }

  public purchasePrestigePerk(perkId: string): boolean {
    const def = PRESTIGE_PERKS[perkId];
    if (!def) return false;

    const currentLvl = this.prestigePerks[perkId] || 0;
    if (currentLvl >= def.maxLevel) return false;
    if (this.prestigeTokens < def.costTokens) return false;

    this.prestigeTokens -= def.costTokens;
    this.prestigePerks[perkId] = currentLvl + 1;
    this.applyPrestigePerks();
    this.saveGameState();

    this.audioService.playFanfare();
    this.events.emit('prestige-tokens-updated', this.prestigeTokens);
    this.events.emit('buff-activated', `⭐ UNLOCKED: ${def.name} Lv ${this.prestigePerks[perkId]}!`);
    return true;
  }

  public triggerPrestige(): boolean {
    if (!this.unlockedTiers.includes(4)) {
      return false;
    }

    const awardedTokens = PrestigeManager.calculateTokensAwarded(
      this.achievementManager.getUnlockedCount(),
      this.totalScrapCollected
    );

    this.prestigeLevel++;
    this.prestigeTokens += awardedTokens;
    this.coins = 0;
    this.unlockedTiers = [1];
    this.clearedZoneMilestones = [];
    this.upgrades = {
      magnetRange: 1,
      attractPower: 1,
      carryCapacity: 1,
      movementSpeed: 1,
    };

    this.playerRover.emptyCargo();
    this.applyPrestigePerks();
    this.audioService.playFanfare();
    this.achievementManager.unlock('scrap_master');
    this.saveGameState();

    this.events.emit('prestige-updated', this.prestigeLevel);
    this.events.emit('prestige-tokens-updated', this.prestigeTokens);
    this.events.emit('coins-updated', this.coins);
    this.events.emit('tier-updated', 1);
    this.events.emit('cargo-updated', this.playerRover.cargo);
    this.events.emit('buff-activated', `⭐ PRESTIGE ACHIEVED! +${awardedTokens} Prestige Tokens! (Total: ${this.prestigeTokens} ⭐)`);

    return true;
  }

  public triggerAdReward(rewardType: 'double_coins' | 'mega_magnet'): Promise<boolean> {
    const sdk = getCrazyGamesSDK();
    return new Promise((resolve) => {
      sdk.ad.requestAd('rewarded', {
        adStarted: () => {
          this.audioService.setMuted(true);
          this.scene.pause();
          sdk.game.gameplayStop();
        },
        adFinished: () => {
          this.audioService.setMuted(false);
          this.scene.resume();
          sdk.game.gameplayStart();

          this.adRewardsClaimed++;
          if (rewardType === 'double_coins') {
            this.has2xRewardBonus = true;
            this.events.emit('buff-activated', '2x Coins Active!');
          } else if (rewardType === 'mega_magnet') {
            this.hasOverchargeBuff = true;
            this.overchargeExpiresAt = this.time.now + 60000; // 60 seconds
            this.playerRover.updateStats(this.upgrades, { overcharge: true });
            this.events.emit('buff-activated', 'Mega Magnet Active (60s)!');
          }
          this.saveGameState();
          resolve(true);
        },
        adError: (err) => {
          console.warn('[JunkyardScene] Ad error:', err);
          this.audioService.setMuted(false);
          this.scene.resume();
          sdk.game.gameplayStart();
          resolve(false);
        }
      });
    });
  }

  public saveGameState(): void {
    const saveManager = SaveManager.getInstance();
    const currentSettings = saveManager.load()?.settings;
    const baseSettings = {
      sfxVolume: 0.8,
      musicVolume: 0.6,
      touchControls: true,
      hapticFeedback: true,
    };

    saveManager.save({
      version: 2,
      timestamp: Date.now(),
      player: {
        coins: this.coins,
        upgrades: this.upgrades,
        unlockedTiers: this.unlockedTiers,
        prestigeLevel: this.prestigeLevel,
        prestigeTokens: this.prestigeTokens,
        prestigePerks: this.prestigePerks,
        clearedZoneMilestones: this.clearedZoneMilestones,
      },
      challenges: this.challengeManager.serialize(),
      achievements: this.achievementManager.serialize(),
      stats: {
        totalScrapCollected: this.totalScrapCollected,
        totalCoinsEarned: this.coins,
        totalRecycledRuns: this.totalRecycledRuns,
        playTimeSeconds: Math.floor((Date.now() - this.sessionStartTime) / 1000) + this.loadedPlayTimeSeconds,
        adRewardsClaimed: this.adRewardsClaimed,
        totalPrestiges: this.prestigeLevel,
        totalChallengesCompleted: this.challengeManager.getState().completedCount,
        goldenScrapCollected: this.goldenScrapCollected,
        crittersRepelled: this.crittersRepelled,
        empMineHits: this.empMineHits,
      },
      settings: {
        ...baseSettings,
        ...currentSettings,
        screenShake: this.screenShakeEnabled,
      },
    });
  }

  public resetGame(): void {
    SaveManager.getInstance().reset();
    const defaults = SaveManager.getInstance().load();
    this.coins = defaults.player.coins;
    this.upgrades = defaults.player.upgrades;
    this.unlockedTiers = defaults.player.unlockedTiers;
    this.prestigeLevel = defaults.player.prestigeLevel || 0;
    this.prestigeTokens = defaults.player.prestigeTokens || 0;
    this.prestigePerks = defaults.player.prestigePerks || {};
    this.clearedZoneMilestones = [];
    this.screenShakeEnabled = defaults.settings?.screenShake ?? true;
    this.totalScrapCollected = 0;
    this.totalRecycledRuns = 0;
    this.goldenScrapCollected = 0;
    this.crittersRepelled = 0;
    this.empMineHits = 0;
    this.adRewardsClaimed = 0;
    this.loadedPlayTimeSeconds = 0;
    this.sessionStartTime = Date.now();
    this.haulStartTime = 0;
    this.has2xRewardBonus = false;
    this.challengeManager.deserialize(defaults.challenges);
    this.achievementManager.deserialize(defaults.achievements);
    this.playerRover.updateStats(this.upgrades, { overcharge: false });
    this.comboManager.reset();
    this.endRecyclerCooldown();
    this.audioService.setComboPitchModifier(1.0);
    this.events.emit('coins-updated', this.coins);
    this.events.emit('tier-updated', 1);
    this.events.emit('cargo-updated', this.playerRover.cargo);
    this.events.emit('combo-updated', this.comboManager.getState());
    this.events.emit('prestige-updated', this.prestigeLevel);
    this.events.emit('challenge-updated', this.challengeManager.getState());
  }

  private handleAchievementTrigger(id: string): void {
    this.achievementManager.unlock(id);
    if (id === 'critter_repelled') this.crittersRepelled++;
    if (id === 'emp_survivor') this.empMineHits++;
    this.saveGameState();
  }

  public shutdown(): void {
    // 1. Unhook scene shutdown listener itself
    this.events.off('shutdown', this.shutdown, this);

    // 2. Unhook event listeners on managers and scene events
    if (this.challengeUnsubscribe) {
      this.challengeUnsubscribe();
      this.challengeUnsubscribe = undefined;
    }
    if (this.achievementUnsubscribe) {
      this.achievementUnsubscribe();
      this.achievementUnsubscribe = undefined;
    }
    for (const unsub of this.comboUnsubscribes) {
      unsub();
    }
    this.comboUnsubscribes = [];
    this.events.off('achievement-trigger', this.handleAchievementTrigger, this);

    // 3. Timers cleanup (1.5s respawn interval and any pending scene clock timers)
    if (this.respawnTimer) {
      this.respawnTimer.destroy();
      this.respawnTimer = null as any;
    }
    if (this.time) {
      this.time.removeAllEvents();
    }

    // 4. Scrap pool cleanup (destroys 200 items, arcade bodies, and group)
    if (this.scrapPool) {
      this.scrapPool.destroy();
      this.scrapPool = null as any;
    }

    // 5. Particle emitters cleanup & nulling to prevent stale reference access
    if (this.sparkEmitter) {
      this.sparkEmitter.destroy();
      this.sparkEmitter = null as any;
    }
    if (this.pulseSparkEmitter) {
      this.pulseSparkEmitter.destroy();
      this.pulseSparkEmitter = null as any;
    }
    if (this.crateDebrisEmitter) {
      this.crateDebrisEmitter.destroy();
      this.crateDebrisEmitter = null as any;
    }
    if (this.roverDustEmitter) {
      this.roverDustEmitter.destroy();
      this.roverDustEmitter = null as any;
    }
    if (this.rivalSmokeEmitter) {
      this.rivalSmokeEmitter.destroy();
      this.rivalSmokeEmitter = null as any;
    }
    if (this.recyclerSteamEmitter) {
      this.recyclerSteamEmitter.destroy();
      this.recyclerSteamEmitter = null as any;
    }

    // 6. Destructible crates and active 45s respawn timers cleanup
    if (this.destructibleCrates) {
      for (const crate of this.destructibleCrates) {
        crate.destroy();
      }
      this.destructibleCrates = [];
    }

    // 7. Reset combo state and audio
    this.comboManager.reset();
    if (this.audioService) {
      this.audioService.stopAll();
    }
  }
}
