import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');
const extracted = path.join(projectRoot, 'downloads', 'extracted');
const publicAssets = path.join(projectRoot, 'public', 'assets');

// Directories to ensure
const dirs = [
  'images/rover',
  'images/scrap',
  'images/hazards',
  'images/particles',
  'images/environment',
  'images/ui',
  'audio/sfx'
];

for (const d of dirs) {
  fs.mkdirSync(path.join(publicAssets, d), { recursive: true });
}

function copy(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[WARN] Missing source: ${src}`);
    return false;
  }
  fs.copyFileSync(src, dest);
  return true;
}

console.log('Copying Tank / Rover assets...');
// Rover sprites
copy(path.join(extracted, 'tanks/PNG/Tanks/tracksLarge.png'), path.join(publicAssets, 'images/rover/tracks.png'));
copy(path.join(extracted, 'tanks/PNG/Tanks/tankBlue.png'), path.join(publicAssets, 'images/rover/chassis_base.png'));
copy(path.join(extracted, 'tanks/PNG/Tanks/tankGreen.png'), path.join(publicAssets, 'images/rover/chassis_reinforced.png'));
copy(path.join(extracted, 'tanks/PNG/Tanks/tankBlack.png'), path.join(publicAssets, 'images/rover/chassis_elite.png'));
copy(path.join(extracted, 'tanks/PNG/Tanks/barrelBlack.png'), path.join(publicAssets, 'images/rover/magnet_emitter.png'));

// Hazards
copy(path.join(extracted, 'tanks/PNG/Tanks/tankRed.png'), path.join(publicAssets, 'images/hazards/rival_rover.png'));
copy(path.join(extracted, 'tanks/PNG/Obstacles/sandbagBrown.png'), path.join(publicAssets, 'images/hazards/crate.png'));
copy(path.join(extracted, 'tanks/PNG/Obstacles/barrelRed_up.png'), path.join(publicAssets, 'images/hazards/emp_mine.png'));
copy(path.join(extracted, 'tanks/PNG/Obstacles/oil.png'), path.join(publicAssets, 'images/hazards/critter.png'));

// Environment
copy(path.join(extracted, 'tanks/PNG/Environment/dirt.png'), path.join(publicAssets, 'images/environment/ground_dirt.png'));
copy(path.join(extracted, 'tanks/PNG/Environment/sand.png'), path.join(publicAssets, 'images/environment/ground_sand.png'));

// Particles
console.log('Copying Particles...');
const particleSrc = path.join(extracted, 'particles/PNG (Transparent)');
copy(path.join(particleSrc, 'dirt_01.png'), path.join(publicAssets, 'images/particles/dust.png'));
copy(path.join(particleSrc, 'spark_01.png'), path.join(publicAssets, 'images/particles/spark.png'));
copy(path.join(particleSrc, 'smoke_01.png'), path.join(publicAssets, 'images/particles/smoke.png'));
copy(path.join(particleSrc, 'star_04.png'), path.join(publicAssets, 'images/particles/pulse_star.png'));
copy(path.join(particleSrc, 'magic_03.png'), path.join(publicAssets, 'images/particles/magic_burst.png'));

// Scrap items from generic-items
console.log('Copying Scrap items...');
const itemSrc = path.join(extracted, 'items/PNG/Colored');
const scrapMapping = [
  { from: 'genericItem_color_030.png', to: 'scrap_screw.png' },      // Nut / bolt
  { from: 'genericItem_color_026.png', to: 'scrap_can.png' },        // Can
  { from: 'genericItem_color_013.png', to: 'scrap_pipe.png' },       // Pipe
  { from: 'genericItem_color_024.png', to: 'scrap_copper_wire.png' },// Wire coil
  { from: 'genericItem_color_028.png', to: 'scrap_battery.png' },    // Battery
  { from: 'genericItem_color_006.png', to: 'scrap_steel_plate.png' },// Plate
  { from: 'genericItem_color_019.png', to: 'scrap_engine_belt.png' },// Belt / ring
  { from: 'genericItem_color_021.png', to: 'scrap_radiator.png' },   // Radiator / grill
  { from: 'genericItem_color_001.png', to: 'scrap_car_chassis.png' },// Car hull
  { from: 'genericItem_color_011.png', to: 'scrap_catalytic_converter.png' }, // Cylinder
  { from: 'genericItem_color_033.png', to: 'scrap_engine_block.png' },// Engine
  { from: 'genericItem_color_016.png', to: 'scrap_rocket_nozzle.png' },// Rocket cone
];

for (const m of scrapMapping) {
  copy(path.join(itemSrc, m.from), path.join(publicAssets, 'images/scrap', m.to));
}

// UI Icons from downloads/icons
console.log('Copying UI Vector Icons...');
const iconSrc = path.join(projectRoot, 'downloads', 'icons');
const iconFiles = ['magnet.svg', 'tread.svg', 'weight.svg', 'pulse.svg', 'recycle.svg', 'speedometer.svg', 'lightning.svg'];
for (const ic of iconFiles) {
  copy(path.join(iconSrc, ic), path.join(publicAssets, 'images/ui', ic));
}

// Audio SFX
console.log('Copying Audio SFX...');
copy(path.join(extracted, 'impact/Audio/impactMetal_heavy_000.ogg'), path.join(publicAssets, 'audio/sfx/compressor_crunch.ogg'));
copy(path.join(extracted, 'impact/Audio/impactMetal_light_000.ogg'), path.join(publicAssets, 'audio/sfx/scrap_pickup.ogg'));
copy(path.join(extracted, 'impact/Audio/impactMetal_medium_000.ogg'), path.join(publicAssets, 'audio/sfx/coin_clink.ogg'));
copy(path.join(extracted, 'interface/Audio/select_001.ogg'), path.join(publicAssets, 'audio/sfx/ui_click.ogg'));
copy(path.join(extracted, 'interface/Audio/switch_001.ogg'), path.join(publicAssets, 'audio/sfx/ui_switch.ogg'));
copy(path.join(extracted, 'interface/Audio/open_001.ogg'), path.join(publicAssets, 'audio/sfx/ui_open.ogg'));
copy(path.join(extracted, 'scifi/Audio/forceField_000.ogg'), path.join(publicAssets, 'audio/sfx/magnet_hum.ogg'));
copy(path.join(extracted, 'scifi/Audio/laserLarge_000.ogg'), path.join(publicAssets, 'audio/sfx/emp_blast.ogg'));
copy(path.join(extracted, 'scifi/Audio/thrusterFire_000.ogg'), path.join(publicAssets, 'audio/sfx/steam_hiss.ogg'));
copy(path.join(extracted, 'scifi/Audio/computerNoise_000.ogg'), path.join(publicAssets, 'audio/sfx/fanfare.ogg'));

console.log('Asset deployment completed!');
