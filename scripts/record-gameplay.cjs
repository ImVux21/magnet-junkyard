const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright-core');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
};

async function main() {
  const distDir = path.resolve(__dirname, '../dist');
  const tempRecordDir = path.resolve(__dirname, '../temp_record');
  if (fs.existsSync(tempRecordDir)) {
    fs.rmSync(tempRecordDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempRecordDir, { recursive: true });

  // 1. Simple HTTP server for dist
  const server = http.createServer((req, res) => {
    let filePath = path.join(distDir, req.url.split('?')[0]);
    if (filePath.endsWith('/') || !path.extname(filePath)) {
      filePath = path.join(filePath, 'index.html');
    }
    const ext = path.extname(filePath);
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(4173, resolve));
  console.log('HTTP Server listening on http://localhost:4173');

  // 2. Launch browser with recordVideo
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: tempRecordDir,
      size: { width: 1280, height: 720 },
    },
  });

  // Pre-seed localStorage to ELIMINATE all onboarding/retention popups
  await context.addInitScript(() => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(
      'magnet_junkyard_daily_login',
      JSON.stringify({ lastClaimDate: today, streak: 3 })
    );

    localStorage.setItem(
      'magnet_junkyard_save_v2',
      JSON.stringify({
        version: 2,
        timestamp: Date.now(),
        player: {
          coins: 450,
          upgrades: {
            magnetRange: 3,
            attractPower: 3,
            carryCapacity: 3,
            movementSpeed: 3,
          },
          unlockedTiers: [1, 2],
          prestigeLevel: 0,
        },
        challenges: { activeChallengeId: 'scavenge_50', progress: 15, completedCount: 1 },
        achievements: { unlocked: ['first_salvage', 'hauler_apprentice'] },
        stats: {
          totalScrapCollected: 50,
          totalCoinsEarned: 1200,
          totalRecycledRuns: 5,
          playTimeSeconds: 150,
          adRewardsClaimed: 0,
          totalPrestiges: 0,
          totalChallengesCompleted: 1,
          goldenScrapCollected: 3,
          crittersRepelled: 1,
          empMineHits: 0,
        },
        settings: {
          sfxVolume: 0.8,
          musicVolume: 0.5,
          touchControls: false,
          hapticFeedback: false,
          screenShake: true,
          tutorialCompleted: true, // NO TUTORIAL BANNER
        },
      })
    );
  });

  const page = await context.newPage();
  console.log('Navigating to game...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });

  // Wait for canvas to appear
  await page.waitForSelector('canvas', { timeout: 10000 });
  console.log('Game canvas detected. Waiting for TestBridge readiness...');

  await page.waitForFunction(() => window.__MAGNET_GAME__ && window.__MAGNET_GAME__.isReady, {
    timeout: 10000,
  });
  console.log('TestBridge ready. Starting choreographed gameplay showcase...');

  // Spawn scrap near player
  await page.evaluate(() => {
    const bridge = window.__MAGNET_GAME__;
    if (bridge) {
      const state = bridge.getState();
      const px = state.player.x;
      const py = state.player.y;
      // Spawn a dense ring of valuable scrap pieces right in front of the rover
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const dist = 70 + Math.random() * 80;
        bridge.actions.spawnScrap('copper_wire', px + Math.cos(angle) * dist, py + Math.sin(angle) * dist, i % 4 === 0);
      }
    }
  });

  // T = 0 - 3s: Drive rover to collect scrap with magnetic suction
  console.log('[Action 1] Driving rover through scrap cluster...');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyD');

  // T = 3s: Trigger Scrap Storm for dramatic visual spectacle
  console.log('[Action 2] Triggering Scrap Storm & Rival...');
  await page.evaluate(() => {
    const bridge = window.__MAGNET_GAME__;
    if (bridge) {
      bridge.actions.triggerScrapStorm();
      bridge.actions.spawnRival(1);
    }
  });
  await page.waitForTimeout(1000);

  // T = 4s: Turn and trigger EM Pulse
  console.log('[Action 3] Steering and firing EM Pulse shockwave...');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Space'); // EM Pulse
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyA');

  // T = 6s - 10s: Steer directly toward the central Recycler station
  console.log('[Action 4] Heading to Recycler Station to crush & sell haul...');
  await page.evaluate(() => {
    const bridge = window.__MAGNET_GAME__;
    if (bridge) {
      // Direct player closer to recycler if needed
      const rx = 1280;
      const ry = 1280;
      bridge.actions.teleportPlayer(rx - 120, ry);
    }
  });

  // Drive right onto recycler
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyD');

  // Trigger recycling crunch
  await page.evaluate(() => {
    const bridge = window.__MAGNET_GAME__;
    if (bridge) {
      bridge.actions.triggerRecycle();
      bridge.actions.triggerFever();
    }
  });

  // T = 10s - 15s: Victory turbo lap with Fever mode particles!
  console.log('[Action 5] Fever Mode activated! High speed cruising...');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(3000);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');

  console.log('Showcase recording completed!');
  await page.waitForTimeout(500);

  await page.close();
  await context.close();
  await browser.close();
  server.close();

  // Find recorded video file
  const videoFiles = fs.readdirSync(tempRecordDir).filter((f) => f.endsWith('.webm'));
  if (videoFiles.length === 0) {
    throw new Error('No recorded video found in ' + tempRecordDir);
  }
  const rawVideo = path.join(tempRecordDir, videoFiles[0]);
  console.log('Raw gameplay video recorded:', rawVideo);

  // 3. Transcode to Landscape MP4 (1920x1080, 30fps, H.264)
  const landscapeOutput = path.resolve(__dirname, '../store-assets/preview_landscape.mp4');
  console.log('Transcoding landscape gameplay video (1920x1080)...');
  execSync(
    `ffmpeg -y -i "${rawVideo}" -vf "scale=1920:1080:flags=lanczos" -c:v libx264 -pix_fmt yuv420p -r 30 -an "${landscapeOutput}"`,
    { stdio: 'inherit' }
  );

  // 4. Transcode to Portrait MP4 (800x1200, cropped center gameplay)
  const portraitOutput = path.resolve(__dirname, '../store-assets/preview_portrait.mp4');
  console.log('Transcoding portrait gameplay video (800x1200)...');
  execSync(
    `ffmpeg -y -i "${rawVideo}" -vf "crop=480:720:(in_w-480)/2:(in_h-720)/2,scale=800:1200:flags=lanczos" -c:v libx264 -pix_fmt yuv420p -r 30 -an "${portraitOutput}"`,
    { stdio: 'inherit' }
  );

  console.log('Cleaning up temp files...');
  fs.rmSync(tempRecordDir, { recursive: true, force: true });
  console.log('SUCCESS: High-action, popup-free gameplay videos generated!');
}

main().catch((err) => {
  console.error('Recording failed:', err);
  process.exit(1);
});
