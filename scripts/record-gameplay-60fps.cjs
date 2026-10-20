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

  // 2. Launch browser with FULL GPU ACCELERATION (No swiftshader CPU lag)
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: false, // Running with head enabled allows true 60fps GPU vsync
    args: [
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--enable-webgl2',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,720',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
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
          tutorialCompleted: true,
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

  // Start 60 FPS in-browser MediaRecorder directly from canvas!
  console.log('Starting 60 FPS in-browser canvas stream recording...');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const stream = canvas.captureStream(60);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    window._mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 12000000, // 12 Mbps ultra-high quality
    });
    window._recordedChunks = [];
    window._mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) window._recordedChunks.push(e.data);
    };
    window._mediaRecorder.start();
  });

  // Spawn scrap near player
  await page.evaluate(() => {
    const bridge = window.__MAGNET_GAME__;
    if (bridge) {
      const state = bridge.getState();
      const px = state.player.x;
      const py = state.player.y;
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const dist = 60 + Math.random() * 80;
        bridge.actions.spawnScrap('copper_wire', px + Math.cos(angle) * dist, py + Math.sin(angle) * dist, i % 3 === 0);
      }
    }
  });

  // T = 0 - 2.5s: Drive rover to collect scrap with magnetic suction
  console.log('[Action 1] Driving rover through scrap cluster...');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyD');

  // T = 2.5s: Trigger Scrap Storm & Rival
  console.log('[Action 2] Triggering Scrap Storm & Rival...');
  await page.evaluate(() => {
    const bridge = window.__MAGNET_GAME__;
    if (bridge) {
      bridge.actions.triggerScrapStorm();
      bridge.actions.spawnRival(1);
    }
  });
  await page.waitForTimeout(800);

  // T = 3.5s: Turn and trigger EM Pulse
  console.log('[Action 3] Steering and firing EM Pulse shockwave...');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyA');

  // T = 5.5s - 9s: Steer directly toward the central Recycler station
  console.log('[Action 4] Heading to Recycler Station to crush & sell haul...');
  await page.evaluate(() => {
    const bridge = window.__MAGNET_GAME__;
    if (bridge) {
      const rx = 1280;
      const ry = 1280;
      bridge.actions.teleportPlayer(rx - 120, ry);
    }
  });

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1800);
  await page.keyboard.up('KeyD');

  // Trigger recycling crunch
  await page.evaluate(() => {
    const bridge = window.__MAGNET_GAME__;
    if (bridge) {
      bridge.actions.triggerRecycle();
      bridge.actions.triggerFever();
    }
  });

  // T = 9s - 13s: High speed cruising
  console.log('[Action 5] Fever Mode activated! High speed cruising...');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2800);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');

  console.log('Stopping 60 FPS recording and extracting video buffer...');
  // Stop recorder and get base64 data
  const base64Video = await page.evaluate(async () => {
    return new Promise((resolve) => {
      window._mediaRecorder.onstop = async () => {
        const blob = new Blob(window._recordedChunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      };
      window._mediaRecorder.stop();
    });
  });

  await page.close();
  await context.close();
  await browser.close();
  server.close();

  const rawVideoPath = path.resolve(__dirname, '../temp_raw_60fps.webm');
  fs.writeFileSync(rawVideoPath, Buffer.from(base64Video, 'base64'));
  console.log('Saved raw 60fps webm video, size:', fs.statSync(rawVideoPath).size, 'bytes');

  // 3. Transcode to Landscape MP4 (1920x1080, 60fps, high quality H.264)
  const landscapeOutput = path.resolve(__dirname, '../store-assets/preview_landscape.mp4');
  console.log('Transcoding 60 FPS smooth landscape video...');
  execSync(
    `ffmpeg -y -i "${rawVideoPath}" -vf "scale=1920:1080:flags=lanczos" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 60 -an "${landscapeOutput}"`,
    { stdio: 'inherit' }
  );

  // 4. Transcode to Portrait MP4 (800x1200, 60fps, high quality H.264)
  const portraitOutput = path.resolve(__dirname, '../store-assets/preview_portrait.mp4');
  console.log('Transcoding 60 FPS smooth portrait video...');
  execSync(
    `ffmpeg -y -i "${rawVideoPath}" -vf "crop=480:720:(in_w-480)/2:(in_h-720)/2,scale=800:1200:flags=lanczos" -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r 60 -an "${portraitOutput}"`,
    { stdio: 'inherit' }
  );

  if (fs.existsSync(rawVideoPath)) fs.unlinkSync(rawVideoPath);
  console.log('ALL DONE: Buttery smooth 60 FPS videos successfully created!');
}

main().catch((err) => {
  console.error('60fps recording failed:', err);
  process.exit(1);
});
