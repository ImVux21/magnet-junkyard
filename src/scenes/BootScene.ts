// ============================================================================
// Magnet Junkyard - Boot Scene & Procedural Asset Generator (0 KB External Assets)
// ============================================================================

import Phaser from 'phaser';
import { ProceduralAudioService } from '../services/audio/ProceduralAudioService';
import { getCrazyGamesSDK } from '../services/crazygames/MockCrazyGamesSDK';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

    preload(): void {
    // 0. Visual Loading Bar (Complies with CrazyGames: No black screen during load)
    const width = this.cameras && this.cameras.main ? this.cameras.main.width : 960;
    const height = this.cameras && this.cameras.main ? this.cameras.main.height : 600;

    if (this.add && this.add.graphics && this.add.text) {
      const bg = this.add.graphics();
      bg.fillStyle(0x0f1418, 1);
      bg.fillRect(0, 0, width, height);

      const progressBox = this.add.graphics();
      const progressBar = this.add.graphics();
      progressBox.fillStyle(0x1a2327, 0.9);
      progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 14, 320, 28, 8);
      progressBox.lineStyle(2, 0x00e5ff, 0.7);
      progressBox.strokeRoundedRect(width / 2 - 160, height / 2 - 14, 320, 28, 8);

      const titleText = this.add.text(width / 2, height / 2 - 50, '🧲 MAGNET JUNKYARD', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '26px',
        color: '#ffd54f',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5);

      const loadingText = this.add.text(width / 2, height / 2 + 35, 'INITIALIZING MAGNETIC SYSTEMS...', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: '#80deea',
      }).setOrigin(0.5);

      this.load.on('progress', (value: number) => {
        progressBar.clear();
        progressBar.fillStyle(0x00e5ff, 1);
        progressBar.fillRoundedRect(width / 2 - 156, height / 2 - 10, 312 * value, 20, 6);
      });

      this.load.on('complete', () => {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
        titleText.destroy();
        bg.destroy();
      });
    }

    // 1. Rover Textures
    this.load.image('rover_treads', 'assets/images/rover/tracks.png');
    this.load.image('rover_chassis', 'assets/images/rover/chassis_base.png');
    this.load.image('rover_chassis_reinforced', 'assets/images/rover/chassis_reinforced.png');
    this.load.image('rover_chassis_elite', 'assets/images/rover/chassis_elite.png');
    this.load.image('magnet_emitter', 'assets/images/rover/magnet_emitter.png');

    // 2. 12 Real Scrap Item Textures
    this.load.image('scrap_screw', 'assets/images/scrap/scrap_screw.png');
    this.load.image('scrap_can', 'assets/images/scrap/scrap_can.png');
    this.load.image('scrap_pipe', 'assets/images/scrap/scrap_pipe.png');
    this.load.image('scrap_copper_wire', 'assets/images/scrap/scrap_copper_wire.png');
    this.load.image('scrap_battery', 'assets/images/scrap/scrap_battery.png');
    this.load.image('scrap_steel_plate', 'assets/images/scrap/scrap_steel_plate.png');
    this.load.image('scrap_engine_belt', 'assets/images/scrap/scrap_engine_belt.png');
    this.load.image('scrap_radiator', 'assets/images/scrap/scrap_radiator.png');
    this.load.image('scrap_car_chassis', 'assets/images/scrap/scrap_car_chassis.png');
    this.load.image('scrap_catalytic_converter', 'assets/images/scrap/scrap_catalytic_converter.png');
    this.load.image('scrap_engine_block', 'assets/images/scrap/scrap_engine_block.png');
    this.load.image('scrap_rocket_nozzle', 'assets/images/scrap/scrap_rocket_nozzle.png');

    // 3. Hazards
    this.load.image('rival_rover', 'assets/images/hazards/rival_rover.png');
    this.load.image('scrap_crate', 'assets/images/hazards/crate.png');
    this.load.image('emp_mine', 'assets/images/hazards/emp_mine.png');
    this.load.image('critter_sprite', 'assets/images/hazards/critter.png');

    // 4. Environment & Terrain
    this.load.image('ground_dirt', 'assets/images/environment/ground_dirt.png');
    this.load.image('ground_sand', 'assets/images/environment/ground_sand.png');

    // 5. UI Vector Icons
    this.load.svg('icon_magnet', 'assets/images/ui/magnet.svg');
    this.load.svg('icon_tread', 'assets/images/ui/tread.svg');
    this.load.svg('icon_weight', 'assets/images/ui/weight.svg');
    this.load.svg('icon_pulse', 'assets/images/ui/pulse.svg');
    this.load.svg('icon_recycle', 'assets/images/ui/recycle.svg');
    this.load.svg('icon_speedometer', 'assets/images/ui/speedometer.svg');
    this.load.svg('icon_lightning', 'assets/images/ui/lightning.svg');
  }

  create(): void {
    // 1. Initialize Procedural Audio Engine
    const audio = ProceduralAudioService.getInstance();
    audio.init();

    // 2. Generate all game textures procedurally into Phaser TextureManager
    this.generateRoverTextures();
    this.generateScrapTextures();
    this.generateRecyclerTextures();
    this.generateParticleAndUITextures();
    this.generateHazardTextures();

    // 3. Transition into JunkyardScene and launch UIScene overlay
    const sdk = getCrazyGamesSDK();
    sdk.game.loadingStop();
    
    this.scene.start('JunkyardScene');
    this.scene.launch('UIScene');
  }

    private safeGenerate(g: Phaser.GameObjects.Graphics, key: string, width: number, height: number): void {
    if (!this.textures.exists(key)) {
      g.generateTexture(key, width, height);
    }
    g.destroy();
  }

  // --------------------------------------------------------------------------
  // Rover Textures
  // --------------------------------------------------------------------------
  private generateRoverTextures(): void {
    // 1. Rover Treads (56 x 48)
    const gTreads = this.make.graphics({ x: 0, y: 0 });
    gTreads.fillStyle(0x1e272c, 1);
    gTreads.fillRoundedRect(0, 2, 56, 12, 3);
    gTreads.fillRoundedRect(0, 34, 56, 12, 3);

    // Tread ridges
    gTreads.fillStyle(0x37474f, 1);
    for (let x = 4; x < 54; x += 8) {
      gTreads.fillRect(x, 2, 4, 12);
      gTreads.fillRect(x, 34, 4, 12);
    }
    this.safeGenerate(gTreads, 'rover_treads', 56, 48);

    // 2. Rover Chassis (46 x 34)
    const gChassis = this.make.graphics({ x: 0, y: 0 });
    // Armored body
    gChassis.fillStyle(0x455a64, 1);
    gChassis.fillRoundedRect(4, 3, 38, 28, 5);
    gChassis.lineStyle(2, 0x263238, 1);
    gChassis.strokeRoundedRect(4, 3, 38, 28, 5);

    // Cockpit windshield
    gChassis.fillStyle(0xffb300, 1);
    gChassis.fillRoundedRect(22, 9, 14, 16, 3);
    gChassis.fillStyle(0xffe082, 0.8);
    gChassis.fillRect(24, 11, 4, 12);

    // Front headlights
    gChassis.fillStyle(0x00e5ff, 1);
    gChassis.fillCircle(40, 8, 3);
    gChassis.fillCircle(40, 26, 3);

    this.safeGenerate(gChassis, 'rover_chassis', 46, 34);

    // 2b. Rover Chassis Tier 2: Reinforced (Gold / Amber trim, added plates)
    const gChassis2 = this.make.graphics({ x: 0, y: 0 });
    gChassis2.fillStyle(0x37474f, 1);
    gChassis2.fillRoundedRect(4, 3, 38, 28, 5);
    gChassis2.lineStyle(2, 0xffb300, 1);
    gChassis2.strokeRoundedRect(4, 3, 38, 28, 5);
    gChassis2.fillStyle(0x546e7a, 1);
    gChassis2.fillRect(8, 6, 8, 22);
    gChassis2.fillStyle(0x00e5ff, 1);
    gChassis2.fillRoundedRect(22, 9, 14, 16, 3);
    gChassis2.fillStyle(0xffeb3b, 1);
    gChassis2.fillCircle(40, 8, 3.5);
    gChassis2.fillCircle(40, 26, 3.5);
    this.safeGenerate(gChassis2, 'rover_chassis_reinforced', 46, 34);

    // 2c. Rover Chassis Tier 3: Elite Chrome (Neon cyan trim, chrome plating)
    const gChassis3 = this.make.graphics({ x: 0, y: 0 });
    gChassis3.fillStyle(0x263238, 1);
    gChassis3.fillRoundedRect(4, 3, 38, 28, 5);
    gChassis3.lineStyle(2, 0x00e5ff, 1);
    gChassis3.strokeRoundedRect(4, 3, 38, 28, 5);
    gChassis3.fillStyle(0xb0bec5, 1);
    gChassis3.fillRect(8, 5, 10, 24);
    gChassis3.fillStyle(0xd500f9, 1);
    gChassis3.fillRoundedRect(22, 9, 14, 16, 3);
    gChassis3.fillStyle(0x00e5ff, 1);
    gChassis3.fillCircle(40, 7, 4);
    gChassis3.fillCircle(40, 27, 4);
    this.safeGenerate(gChassis3, 'rover_chassis_elite', 46, 34);

    // 3. Magnet Emitter Head (26 x 28)
    const gMag = this.make.graphics({ x: 0, y: 0 });
    // Mounting arm
    gMag.fillStyle(0x37474f, 1);
    gMag.fillRect(0, 10, 10, 8);

    // Electromagnetic coil bracket
    gMag.fillStyle(0x263238, 1);
    gMag.fillRoundedRect(8, 2, 14, 24, 4);

    // Copper induction coils
    gMag.fillStyle(0xff7043, 1);
    gMag.fillRect(10, 5, 10, 4);
    gMag.fillRect(10, 12, 10, 4);
    gMag.fillRect(10, 19, 10, 4);

    // Cyan magnetic pole caps
    gMag.fillStyle(0x00e5ff, 1);
    gMag.fillCircle(22, 6, 3.5);
    gMag.fillCircle(22, 22, 3.5);

    this.safeGenerate(gMag, 'magnet_emitter', 26, 28);

    // 4. Cargo Visual States (30 x 24)
    // Empty tray
    const gEmpty = this.make.graphics({ x: 0, y: 0 });
    gEmpty.fillStyle(0x212121, 0.7);
    gEmpty.fillRoundedRect(2, 2, 26, 20, 3);
    gEmpty.lineStyle(1.5, 0x424242, 1);
    gEmpty.strokeRoundedRect(2, 2, 26, 20, 3);
    this.safeGenerate(gEmpty, 'cargo_empty', 30, 24);

    // Low load
    const gLow = this.make.graphics({ x: 0, y: 0 });
    gLow.fillStyle(0x212121, 0.85);
    gLow.fillRoundedRect(2, 2, 26, 20, 3);
    gLow.fillStyle(0xb0bec5, 1);
    gLow.fillCircle(10, 10, 4);
    gLow.fillStyle(0xef5350, 1);
    gLow.fillRect(16, 7, 8, 6);
    this.safeGenerate(gLow, 'cargo_low', 30, 24);

    // Medium load
    const gMed = this.make.graphics({ x: 0, y: 0 });
    gMed.fillStyle(0x212121, 0.95);
    gMed.fillRoundedRect(2, 2, 26, 20, 3);
    gMed.fillStyle(0xb0bec5, 1);
    gMed.fillCircle(9, 8, 4);
    gMed.fillStyle(0xef5350, 1);
    gMed.fillRect(15, 6, 9, 6);
    gMed.fillStyle(0x78909c, 1);
    gMed.fillRect(7, 14, 12, 6);
    gMed.fillStyle(0xff7043, 1);
    gMed.fillCircle(21, 15, 4);
    this.safeGenerate(gMed, 'cargo_med', 30, 24);

    // Heavy / Full load
    const gHigh = this.make.graphics({ x: 0, y: 0 });
    gHigh.fillStyle(0x1a1a1a, 1);
    gHigh.fillRoundedRect(1, 1, 28, 22, 3);
    gHigh.fillStyle(0x546e7a, 1);
    gHigh.fillRect(4, 4, 22, 16);
    gHigh.fillStyle(0xd4af37, 1);
    gHigh.fillRect(6, 6, 10, 8);
    gHigh.fillStyle(0x1e88e5, 1);
    gHigh.fillRect(14, 10, 12, 9);
    gHigh.fillStyle(0xff1744, 0.85);
    gHigh.fillCircle(15, 12, 3);
    this.safeGenerate(gHigh, 'cargo_high', 30, 24);
  }

  // --------------------------------------------------------------------------
  // 12 Scrap Item Textures
  // --------------------------------------------------------------------------
  private generateScrapTextures(): void {
    // 1. Rusty Screws (16 x 16)
    const g1 = this.make.graphics({ x: 0, y: 0 });
    g1.fillStyle(0xb0bec5, 1);
    g1.fillCircle(8, 8, 6);
    g1.fillStyle(0x37474f, 1);
    g1.fillRect(4, 7, 8, 2);
    g1.fillRect(7, 4, 2, 8);
    this.safeGenerate(g1, 'scrap_screw', 16, 16);

    // 2. Crushed Soda Can (20 x 16)
    const g2 = this.make.graphics({ x: 0, y: 0 });
    g2.fillStyle(0xef5350, 1);
    g2.fillRoundedRect(2, 3, 16, 10, 3);
    g2.fillStyle(0xffffff, 0.8);
    g2.fillRect(6, 5, 8, 2);
    g2.fillStyle(0xb71c1c, 1);
    g2.fillRect(4, 9, 12, 2);
    this.safeGenerate(g2, 'scrap_can', 20, 16);

    // 3. Iron Pipe Scrap (28 x 14)
    const g3 = this.make.graphics({ x: 0, y: 0 });
    g3.fillStyle(0x78909c, 1);
    g3.fillRoundedRect(2, 2, 24, 10, 2);
    g3.fillStyle(0x37474f, 1);
    g3.fillCircle(6, 7, 4);
    this.safeGenerate(g3, 'scrap_pipe', 28, 14);

    // 4. Copper Wire Spool (22 x 22)
    const g4 = this.make.graphics({ x: 0, y: 0 });
    g4.fillStyle(0x4e342e, 1);
    g4.fillCircle(11, 11, 10);
    g4.fillStyle(0xff7043, 1);
    g4.fillCircle(11, 11, 7);
    g4.fillStyle(0x212121, 1);
    g4.fillCircle(11, 11, 3);
    this.safeGenerate(g4, 'scrap_copper_wire', 22, 22);

    // 5. Lead-Acid Battery (26 x 20)
    const g5 = this.make.graphics({ x: 0, y: 0 });
    g5.fillStyle(0x455a64, 1);
    g5.fillRoundedRect(2, 4, 22, 14, 2);
    g5.fillStyle(0xd50000, 1); // Anode
    g5.fillRect(5, 1, 4, 4);
    g5.fillStyle(0x1976d2, 1); // Cathode
    g5.fillRect(17, 1, 4, 4);
    this.safeGenerate(g5, 'scrap_battery', 26, 20);

    // 6. Heavy Steel Plate (30 x 30)
    const g6 = this.make.graphics({ x: 0, y: 0 });
    g6.fillStyle(0x546e7a, 1);
    g6.fillRoundedRect(2, 2, 26, 26, 3);
    g6.fillStyle(0x263238, 1);
    g6.fillCircle(6, 6, 2);
    g6.fillCircle(24, 6, 2);
    g6.fillCircle(6, 24, 2);
    g6.fillCircle(24, 24, 2);
    this.safeGenerate(g6, 'scrap_steel_plate', 30, 30);

    // 7. Alternator Belt (32 x 24)
    const g7 = this.make.graphics({ x: 0, y: 0 });
    g7.lineStyle(3.5, 0x263238, 1);
    g7.strokeEllipse(16, 12, 13, 8);
    g7.lineStyle(1.5, 0x455a64, 1);
    g7.strokeEllipse(16, 12, 10, 5);
    this.safeGenerate(g7, 'scrap_engine_belt', 32, 24);

    // 8. Brass Radiator (36 x 28)
    const g8 = this.make.graphics({ x: 0, y: 0 });
    g8.fillStyle(0xd4af37, 1);
    g8.fillRoundedRect(2, 2, 32, 24, 3);
    g8.fillStyle(0x8d6e63, 1);
    for (let x = 6; x < 32; x += 4) {
      g8.fillRect(x, 5, 2, 18);
    }
    this.safeGenerate(g8, 'scrap_radiator', 36, 28);

    // 9. Vehicle Door Panel (42 x 32)
    const g9 = this.make.graphics({ x: 0, y: 0 });
    g9.fillStyle(0x1e88e5, 1);
    g9.fillRoundedRect(2, 2, 38, 28, 4);
    g9.fillStyle(0x90caf9, 0.7);
    g9.fillRoundedRect(6, 5, 22, 10, 2); // Window
    g9.fillStyle(0x212121, 1);
    g9.fillRect(30, 16, 6, 2); // Handle
    this.safeGenerate(g9, 'scrap_car_chassis', 42, 32);

    // 10. Catalytic Converter (38 x 22)
    const g10 = this.make.graphics({ x: 0, y: 0 });
    g10.fillStyle(0xffb300, 1);
    g10.fillRoundedRect(8, 3, 22, 16, 6);
    g10.fillStyle(0xb0bec5, 1);
    g10.fillRect(2, 8, 8, 6);
    g10.fillRect(28, 8, 8, 6);
    this.safeGenerate(g10, 'scrap_catalytic_converter', 38, 22);

    // 11. Cracked V8 Engine Block (44 x 36)
    const g11 = this.make.graphics({ x: 0, y: 0 });
    g11.fillStyle(0x37474f, 1);
    g11.fillRoundedRect(2, 2, 40, 32, 4);
    g11.fillStyle(0x212121, 1);
    // Cylinder bores
    for (let x = 8; x <= 32; x += 8) {
      g11.fillCircle(x, 10, 3);
      g11.fillCircle(x, 24, 3);
    }
    this.safeGenerate(g11, 'scrap_engine_block', 44, 36);

    // 12. Rocket Thruster Bell (48 x 48)
    const g12 = this.make.graphics({ x: 0, y: 0 });
    g12.fillStyle(0x263238, 1);
    g12.beginPath();
    g12.moveTo(24, 4);
    g12.lineTo(44, 42);
    g12.lineTo(4, 42);
    g12.closePath();
    g12.fillPath();

    g12.lineStyle(2, 0x00e5ff, 0.9);
    g12.strokeEllipse(24, 42, 18, 4);
    g12.fillStyle(0x00e5ff, 0.5);
    g12.fillCircle(24, 18, 5);
    this.safeGenerate(g12, 'scrap_rocket_nozzle', 48, 48);
  }

  // --------------------------------------------------------------------------
  // Recycler Textures
  // --------------------------------------------------------------------------
  private generateRecyclerTextures(): void {
    // 1. Recycler Pad (240 x 240)
    const gPad = this.make.graphics({ x: 0, y: 0 });
    // Concrete foundation
    gPad.fillStyle(0x302c28, 1);
    gPad.fillRect(0, 0, 240, 240);

    // Inner steel floor
    gPad.fillStyle(0x211e1c, 1);
    gPad.fillRect(20, 20, 200, 200);

    // Caution diagonal stripes along perimeter
    gPad.fillStyle(0xffd600, 1);
    for (let i = 0; i < 240; i += 24) {
      // Top stripe
      gPad.fillRect(i, 0, 12, 16);
      // Bottom stripe
      gPad.fillRect(i, 224, 12, 16);
      // Left stripe
      gPad.fillRect(0, i, 16, 12);
      // Right stripe
      gPad.fillRect(224, i, 16, 12);
    }

    gPad.lineStyle(2, 0x455a64, 1);
    gPad.strokeRect(20, 20, 200, 200);
    this.safeGenerate(gPad, 'recycler_pad', 240, 240);

    // 2. Recycler Hydraulic Crusher Press (160 x 100)
    const gPress = this.make.graphics({ x: 0, y: 0 });
    // Hydraulic pistons
    gPress.fillStyle(0xb0bec5, 1);
    gPress.fillRect(25, 0, 16, 40);
    gPress.fillRect(119, 0, 16, 40);

    // Heavy crushing head
    gPress.fillStyle(0x455a64, 1);
    gPress.fillRoundedRect(10, 36, 140, 50, 4);
    gPress.lineStyle(2, 0x263238, 1);
    gPress.strokeRoundedRect(10, 36, 140, 50, 4);

    // Hazard crossbar
    gPress.fillStyle(0xffd600, 1);
    gPress.fillRect(20, 44, 120, 8);

    // Crushing teeth
    gPress.fillStyle(0x212121, 1);
    for (let x = 18; x < 140; x += 14) {
      gPress.fillRect(x, 86, 8, 8);
    }

    this.safeGenerate(gPress, 'recycler_press', 160, 100);
  }

  // --------------------------------------------------------------------------
  // Particle & UI Textures
  // --------------------------------------------------------------------------
  private generateParticleAndUITextures(): void {
    // 1. Coin Icon (24 x 24)
    const gCoin = this.make.graphics({ x: 0, y: 0 });
    gCoin.fillStyle(0xffd54f, 1);
    gCoin.fillCircle(12, 12, 10);
    gCoin.lineStyle(2, 0xffa000, 1);
    gCoin.strokeCircle(12, 12, 10);
    gCoin.fillStyle(0xffecb3, 1);
    gCoin.fillCircle(12, 12, 6);
    this.safeGenerate(gCoin, 'coin_icon', 24, 24);

    // 2. Spark Particle (8 x 8)
    const gSpark = this.make.graphics({ x: 0, y: 0 });
    gSpark.fillStyle(0xfff9c4, 1);
    gSpark.fillCircle(4, 4, 3.5);
    this.safeGenerate(gSpark, 'spark_particle', 8, 8);

    // 3. Smoke Particle (14 x 14)
    const gSmoke = this.make.graphics({ x: 0, y: 0 });
    gSmoke.fillStyle(0x78909c, 0.85);
    gSmoke.fillCircle(7, 7, 6);
    this.safeGenerate(gSmoke, 'smoke_particle', 14, 14);

    // 4. Golden Spark (10 x 10)
    const gGold = this.make.graphics({ x: 0, y: 0 });
    gGold.fillStyle(0xffd700, 1);
    gGold.fillCircle(5, 5, 4);
    gGold.fillStyle(0xffffff, 0.9);
    gGold.fillCircle(5, 5, 2);
    this.safeGenerate(gGold, 'golden_spark', 10, 10);

    // 5. Pulse Spark (8 x 8) - Electric blue/cyan star spark
    const gPulse = this.make.graphics({ x: 0, y: 0 });
    gPulse.fillStyle(0x00e5ff, 1);
    gPulse.beginPath();
    gPulse.moveTo(4, 0);
    gPulse.lineTo(8, 4);
    gPulse.lineTo(4, 8);
    gPulse.lineTo(0, 4);
    gPulse.closePath();
    gPulse.fillPath();
    gPulse.fillStyle(0xffffff, 0.95);
    gPulse.fillCircle(4, 4, 1.8);
    this.safeGenerate(gPulse, 'pulse_spark', 8, 8);

    // 6. Crate Debris Splinter (10 x 6) - Wood & rusty metal splinter
    const gDebris = this.make.graphics({ x: 0, y: 0 });
    gDebris.fillStyle(0x8d6e63, 1);
    gDebris.fillRect(0, 1, 10, 4);
    gDebris.fillStyle(0x5d4037, 1);
    gDebris.fillRect(2, 2, 6, 2);
    gDebris.fillStyle(0xffb300, 0.9);
    gDebris.fillRect(0, 0, 3, 2);
    gDebris.fillRect(7, 4, 3, 2);
    this.safeGenerate(gDebris, 'crate_debris', 10, 6);

    // 7. Dust Particle (12 x 12) - Soft translucent earthy dirt puff
    const gDust = this.make.graphics({ x: 0, y: 0 });
    gDust.fillStyle(0x6d4c41, 0.22);
    gDust.fillCircle(6, 6, 6);
    gDust.fillStyle(0x8d6e63, 0.30);
    gDust.fillCircle(6, 6, 4);
    gDust.fillStyle(0xa1887f, 0.38);
    gDust.fillCircle(6, 6, 2);
    this.safeGenerate(gDust, 'dust_particle', 12, 12);
  }

  // --------------------------------------------------------------------------
  // Hazard & Threat Textures (Scrap Critter, EMP Mine, Rival Scavenger)
  // --------------------------------------------------------------------------
  private generateHazardTextures(): void {
    // 1. Scrap Critter (28 x 22) - Rust rat / insect
    const gCritter = this.make.graphics({ x: 0, y: 0 });
    // Shell body
    gCritter.fillStyle(0x3e2723, 1);
    gCritter.fillRoundedRect(4, 3, 20, 16, 5);
    // Segment armor bands
    gCritter.fillStyle(0x5d4037, 1);
    gCritter.fillRect(8, 3, 3, 16);
    gCritter.fillRect(14, 3, 3, 16);
    // Glowing red eyes
    gCritter.fillStyle(0xff1744, 1);
    gCritter.fillCircle(22, 7, 2);
    gCritter.fillCircle(22, 15, 2);
    // Metal mandibles / claws
    gCritter.fillStyle(0xb0bec5, 1);
    gCritter.fillRect(24, 5, 4, 2);
    gCritter.fillRect(24, 15, 4, 2);
    // Wire whiskers / antennae
    gCritter.lineStyle(1, 0xffab00, 1);
    gCritter.lineBetween(22, 6, 27, 2);
    gCritter.lineBetween(22, 16, 27, 20);
    this.safeGenerate(gCritter, 'critter_sprite', 28, 22);

    // 2. EMP Mine (32 x 32) - Pulsing magnetic hazard mine
    const gMine = this.make.graphics({ x: 0, y: 0 });
    // Outer spikes
    gMine.fillStyle(0x263238, 1);
    gMine.fillCircle(16, 16, 12);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const sx = 16 + Math.cos(angle) * 14;
      const sy = 16 + Math.sin(angle) * 14;
      gMine.fillCircle(sx, sy, 3);
    }
    // Inner warning casing
    gMine.fillStyle(0xd50000, 1);
    gMine.fillCircle(16, 16, 8);
    // Electric core
    gMine.fillStyle(0x00e5ff, 1);
    gMine.fillCircle(16, 16, 4);
    gMine.lineStyle(1.5, 0xff5252, 1);
    gMine.strokeCircle(16, 16, 12);
    this.safeGenerate(gMine, 'emp_mine', 32, 32);

    // 3. Rival Scavenger Rover (52 x 40) - Aggressive rust-orange AI rover
    const gRival = this.make.graphics({ x: 0, y: 0 });
    // Heavy treads
    gRival.fillStyle(0x212121, 1);
    gRival.fillRoundedRect(0, 2, 52, 10, 3);
    gRival.fillRoundedRect(0, 28, 52, 10, 3);
    // Armored chassis (hazard orange)
    gRival.fillStyle(0xd84315, 1);
    gRival.fillRoundedRect(6, 6, 36, 28, 4);
    gRival.lineStyle(1.5, 0xbf360c, 1);
    gRival.strokeRoundedRect(6, 6, 36, 28, 4);
    // Front scrap scoop / vacuum funnel
    gRival.fillStyle(0x37474f, 1);
    gRival.fillTriangle(42, 8, 52, 20, 42, 32);
    // Cockpit sensor dome (violet)
    gRival.fillStyle(0x7b1fa2, 1);
    gRival.fillCircle(24, 20, 6);
    gRival.fillStyle(0xe1bee7, 0.9);
    gRival.fillCircle(22, 18, 2);
    this.safeGenerate(gRival, 'rival_rover', 52, 40);

    // 4. Destructible Pinata Scrap Crate (44 x 44)
    const gCrate = this.make.graphics({ x: 0, y: 0 });
    gCrate.fillStyle(0x3e2723, 1);
    gCrate.fillRoundedRect(2, 2, 40, 40, 4);
    gCrate.lineStyle(2, 0x8d6e63, 1);
    gCrate.strokeRoundedRect(2, 2, 40, 40, 4);
    // Metal cross braces
    gCrate.lineStyle(2, 0xffb300, 0.9);
    gCrate.lineBetween(4, 4, 40, 40);
    gCrate.lineBetween(4, 40, 40, 4);
    // Heavy corner bolts
    gCrate.fillStyle(0xffd54f, 1);
    gCrate.fillCircle(8, 8, 2.5);
    gCrate.fillCircle(36, 8, 2.5);
    gCrate.fillCircle(8, 36, 2.5);
    gCrate.fillCircle(36, 36, 2.5);
    this.safeGenerate(gCrate, 'scrap_crate', 44, 44);
  }
}
