import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('src/scenes/BootScene.ts');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add preload asset loading
const preloadAssets = `  preload(): void {
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

    // 5. Particles
    this.load.image('dust_particle', 'assets/images/particles/dust.png');
    this.load.image('spark_particle', 'assets/images/particles/spark.png');
    this.load.image('smoke_particle', 'assets/images/particles/smoke.png');
    this.load.image('pulse_spark', 'assets/images/particles/pulse_star.png');
    this.load.image('golden_spark', 'assets/images/particles/magic_burst.png');

    // 6. UI Vector Icons
    this.load.svg('icon_magnet', 'assets/images/ui/magnet.svg');
    this.load.svg('icon_tread', 'assets/images/ui/tread.svg');
    this.load.svg('icon_weight', 'assets/images/ui/weight.svg');
    this.load.svg('icon_pulse', 'assets/images/ui/pulse.svg');
    this.load.svg('icon_recycle', 'assets/images/ui/recycle.svg');
    this.load.svg('icon_speedometer', 'assets/images/ui/speedometer.svg');
    this.load.svg('icon_lightning', 'assets/images/ui/lightning.svg');
  }`;

content = content.replace(/preload\(\): void {\s*\/\/ 0 KB external downloads[^\}]*\}/, preloadAssets);

// 2. Add safeGenerate helper method
const safeHelper = `  private safeGenerate(g: Phaser.GameObjects.Graphics, key: string, width: number, height: number): void {
    if (!this.textures.exists(key)) {
      g.generateTexture(key, width, height);
    }
    g.destroy();
  }
`;

content = content.replace(/(\/\/\s*--+\s*\n\s*\/\/\s*Rover Textures)/, `${safeHelper}\n  $1`);

// 3. Replace all generateTexture calls with safeGenerate
content = content.replace(/(\w+)\.generateTexture\((['"][^'"]+['"]),\s*([^)]+)\);\s*\n\s*\1\.destroy\(\);/g, 'this.safeGenerate($1, $2, $3);');

fs.writeFileSync(file, content, 'utf-8');
console.log('BootScene.ts patched successfully!');
