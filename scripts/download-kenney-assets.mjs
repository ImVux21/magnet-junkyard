import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const downloadsDir = path.resolve('downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const assets = [
  { name: 'top-down-tanks.zip', url: 'https://kenney.nl/media/pages/assets/top-down-tanks/0385fcb3e0-1677699019/kenney_top-down-tanks.zip' },
  { name: 'particle-pack.zip', url: 'https://kenney.nl/media/pages/assets/particle-pack/f8fe0f8cb8-1677578741/kenney_particle-pack.zip' },
  { name: 'impact-sounds.zip', url: 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip' },
  { name: 'interface-sounds.zip', url: 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip' },
  { name: 'sci-fi-sounds.zip', url: 'https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip' },
  { name: 'ui-pack.zip', url: 'https://kenney.nl/media/pages/assets/ui-pack/f651646eab-1718203990/kenney_ui-pack.zip' },
  { name: 'generic-items.zip', url: 'https://kenney.nl/media/pages/assets/generic-items/96b9087204-1677667000/kenney_generic-items.zip' }
];

async function downloadFile(item) {
  const destPath = path.join(downloadsDir, item.name);
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    console.log(`[SKIP] Already exists: ${item.name}`);
    return;
  }
  console.log(`[DOWNLOADING] ${item.name}...`);
  const res = await fetch(item.url);
  if (!res.ok) {
    throw new Error(`Failed to download ${item.name}: HTTP ${res.status}`);
  }
  const fileStream = fs.createWriteStream(destPath);
  await pipeline(res.body, fileStream);
  const sizeMb = (fs.statSync(destPath).size / (1024 * 1024)).toFixed(2);
  console.log(`[DONE] ${item.name} (${sizeMb} MB)`);
}

async function main() {
  for (const item of assets) {
    try {
      await downloadFile(item);
    } catch (err) {
      console.error(`[ERROR] ${item.name}:`, err.message);
    }
  }
  console.log('All downloads completed!');
}

main();
