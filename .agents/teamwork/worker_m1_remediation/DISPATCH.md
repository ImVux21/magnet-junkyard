# Dispatch to worker_m1_remediation

Working directory: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\worker_m1_remediation
Parent conversation ID: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A forensic auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context and Design Reports to follow:
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_1\handoff.md
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_1\junkyard_scene_lifecycle.patch
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_2\handoff.md
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_3\handoff.md

Your tasks:
1. Apply lifecycle and shutdown fixes to `src/scenes/JunkyardScene.ts`:
   - At start of `create()`: `this.events.off('shutdown', this.shutdown, this); this.events.on('shutdown', this.shutdown, this);`.
   - Store listener unhook callbacks for `challengeManager`, `achievementManager`, `comboManager`, and unhook before re-subscribing.
   - In `shutdown()`: unhook manager listeners, destroy and null out all particle emitters (`sparkEmitter`, `pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`, `rivalSmokeEmitter`, `recyclerSteamEmitter`), destroy all crates in `destructibleCrates`, destroy `respawnTimer`, call `this.time.removeAllEvents()`, destroy `scrapPool`.
   - In `saveGameState()`: load `currentSettings = saveManager.load()?.settings` and merge `...currentSettings` with base fallbacks and `screenShake: this.screenShakeEnabled`.
2. Apply rival smoke particle pre-allocation:
   - In `src/scenes/JunkyardScene.ts`: declare `public rivalSmokeEmitter`, pre-allocate in `buildRecyclerStation()` (`emitting: false`), destroy in `shutdown()`.
   - In `src/entities/hazards/RivalScavenger.ts:118-130`: refactor `createSmokePuff()` to trigger `junkyard.rivalSmokeEmitter.explode(10, this.x, this.y)`. Remove `add.particles` and `delayedCall`.
3. Apply UI and Rover safety fixes:
   - In `src/scenes/UIScene.ts`: declare `private isScreenShakeOn: boolean = true`, sync on events, query `JunkyardScene.screenShakeEnabled` on click, kill tweens on `this.shakeBtnContainer` on click and in `shutdown()`.
   - In `src/entities/PlayerRover.ts:289-306`: add guard `junkyard.roverDustEmitter.active`.
4. Update unit test assertions in `tests/unit/adversarial-m1-perf-memory.test.ts`:
   - Update `Empirical Defect Discovery 1` to verify zero dynamic `add.particles`, zero `delayedCall`, and invocation of `rivalSmokeEmitter.explode()`.
   - Update `Empirical Defect Discovery 2` assertion from `expect(hasShutdownListener).toBe(false)` to `expect(hasShutdownListener).toBe(true)`.
5. Run `npm test` and `npm run build` and capture full logs. Verify 100% tests pass and dist size is strictly < 10MB.
6. Write your handoff report to `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\worker_m1_remediation\handoff.md`.
7. Send a message to parent when complete.

## 2026-09-26T04:45:29Z
You are worker_m1_remediation, a remediation worker agent.
Your working directory is: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\worker_m1_remediation
Your parent conversation ID is: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a

First, read your dispatch file at c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\worker_m1_remediation\DISPATCH.md
and the detailed reports:
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_1\handoff.md
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_1\junkyard_scene_lifecycle.patch
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_2\handoff.md
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A forensic auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Apply all 4 remediation sets:
1. `src/scenes/JunkyardScene.ts`:
   - Wire `this.events.off('shutdown', this.shutdown, this); this.events.on('shutdown', this.shutdown, this);` at top of `create()`.
   - Prevent listener accumulation on `challengeManager`, `achievementManager`, `comboManager` by unhooking before re-subscribing.
   - Pre-allocate `public rivalSmokeEmitter` in `buildRecyclerStation()` (`emitting: false`).
   - In `shutdown()`: unhook manager listeners, destroy and null all emitters (`sparkEmitter`, `pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`, `rivalSmokeEmitter`, `recyclerSteamEmitter`), destroy all crates in `destructibleCrates`, destroy `respawnTimer`, remove clock events, destroy `scrapPool`.
   - In `saveGameState()`: load `currentSettings = saveManager.load()?.settings` and merge `...currentSettings` with base fallbacks and `screenShake: this.screenShakeEnabled`.
2. `src/entities/hazards/RivalScavenger.ts`:
   - Refactor `createSmokePuff()` to trigger `junkyard.rivalSmokeEmitter.explode(10, this.x, this.y)`. Eliminate dynamic `this.scene.add.particles(...)` and `delayedCall`.
3. `src/scenes/UIScene.ts` & `src/entities/PlayerRover.ts`:
   - In `UIScene.ts`: declare `private isScreenShakeOn: boolean = true`, sync on events, query live `JunkyardScene.screenShakeEnabled` on click, kill tweens on `this.shakeBtnContainer` on click and in `shutdown()`.
   - In `PlayerRover.ts:289-306`: guard `junkyard.roverDustEmitter.active`.
4. `tests/unit/adversarial-m1-perf-memory.test.ts`:
   - Update assertions per `explorer_m1_fix_1` and `explorer_m1_fix_2`: assert zero dynamic particle allocations on rival spawn/despawn, assert zero delayed call timers, assert `rivalSmokeEmitter.explode(10, x, y)` is called, and assert `expect(hasShutdownListener).toBe(true)`.
5. Run `npm test` and `npm run build` and capture full logs.
6. Write your complete handoff report to `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\worker_m1_remediation\handoff.md`.
7. Send a message to parent when done.
