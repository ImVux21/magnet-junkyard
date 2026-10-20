# Codebase Survey Report: Build, Testing & Architecture

**Explorer Subagent**: Explorer 3 (`teamwork_preview_explorer`)  
**Working Directory**: `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_3`  
**Parent Orchestrator ID**: `fbfef778-f014-4177-8736-00dd5df8723f`  
**Timestamp**: 2026-09-26T04:00:00Z  
**Target Project**: Magnet Junkyard (Phaser 3.88.2 + TypeScript + Vite)

---

## Executive Summary

1. **Build & Tooling**: Clean, robust TypeScript 5.8 + Vite 6.2 configuration with Terser minification and bundle size verification (`scripts/verify-dist-size.js`). `npm run build` succeeds in ~31s with **zero TypeScript errors** and yields an uncompressed dist bundle of **1.55 MB** (well under the strict **10 MB limit** — ~8.5 MB headroom).
2. **Testing**: Vitest 3.2.7 is the test runner. Baseline `npm test` runs in ~7.7s and passes **100%** (13 test files, 203 individual unit and stress tests).
3. **Existing Coverage**: Core mathematical curves (attraction physics, carry capacity, upgrade cost ladders), economy catalogs, SDK mock parity, persistence corruption recovery, and combo/fever state machines are thoroughly tested.
4. **Coverage Gaps Identified**: Currently **zero** unit tests exist for:
   - Camera Screen Shake & Screen Shake toggle configuration.
   - Particle systems (sparks, debris, dust emission & lifecycle).
   - Compactor pacing & 10-minute engagement progression curves.
   - Destructible Pinata Crates (smash, golden drop, respawn).
5. **Memory Leak Vectors**: Five distinct architectural risks identified:
   - Missing `shutdown()` in `UIScene` causing leak of 13 cross-scene event listeners on restart.
   - `sparkEmitter` in `JunkyardScene` not destroyed in `shutdown()`.
   - Rapid allocation of unpooled `Phaser.GameObjects.Text` during high-frequency recycling (up to 30 allocations/sec).
   - Uncancelled delayed respawn timers in `DestructibleCrate`.
   - Direct, unchecked camera shake calls that bypass user preference settings.

---

## 1. Build & Configuration Survey

### 1.1 Package Manifest (`package.json`)
- **Package name**: `magnet-junkyard`, version `1.0.0`, type `module` (ESM).
- **Scripts**:
  | Script | Command | Purpose |
  |---|---|---|
  | `dev` | `vite` | Local development server (port 3000) |
  | `build` | `tsc && vite build && node scripts/verify-dist-size.js` | Production type check, bundle, and size verification |
  | `preview` | `vite preview` | Preview production dist build locally |
  | `verify:size` | `node scripts/verify-dist-size.js` | Standalone bundle size verification |
  | `test` | `vitest run` | Headless unit test suite execution |
  | `test:e2e` | `playwright test` | E2E browser tests (placeholder, no test specs present) |
- **Dependencies**:
  - `phaser`: `^3.88.2` (Production game engine)
- **DevDependencies**:
  - `@playwright/test`: `^1.50.1`
  - `@types/node`: `^22.13.9`
  - `terser`: `^5.39.0`
  - `typescript`: `^5.8.2`
  - `vite`: `^6.2.0`
  - `vitest`: `^3.0.7`

### 1.2 TypeScript Configuration (`tsconfig.json`)
- Target: `ES2022`, Module: `ESNext`, Module Resolution: `bundler`.
- Strict Mode: `strict: true`, `noImplicitAny: true`.
- Hygiene flags: `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`.
- Interop: `esModuleInterop: true`, `skipLibCheck: true`.
- Included scopes: `["src", "scripts", "vite.config.ts"]`.

### 1.3 Vite Configuration (`vite.config.ts`)
- **Root Resolution**: Dynamic project root via `fs.realpathSync(process.cwd())`.
- **Base URL**: `'./'` (relative assets, essential for CrazyGames/web portal iframe deployment).
- **Rollup Manual Chunks**: Dedicated `phaser` vendor chunk (`phaser: ['phaser']`), isolating the engine runtime (`~1.49 MB`) from game code (`~130 KB`).
- **Minification**: Terser with `drop_console: false`, `drop_debugger: true`.
- **Chunk Warning Limit**: Raised to 2000 KB to avoid false-positive warnings for the Phaser engine chunk.

### 1.4 Size Verification Script (`scripts/verify-dist-size.js`)
- Recursively calculates total uncompressed byte size of `dist/`.
- Strict gate: `maxBytes = 10 * 1024 * 1024` (10,485,760 bytes).
- Exits with status 1 if exceeded.
- Actual production build output:
  - `dist/index.html`: `0.55 kB`
  - `dist/assets/index-[hash].css`: `0.32 kB`
  - `dist/assets/index-[hash].js`: `129.67 kB`
  - `dist/assets/phaser-[hash].js`: `1,490.53 kB`
  - **Total**: **1.55 MB (1,621,061 bytes)** — strictly under 10MB (**[PASSED]**).

---

## 2. Test Framework, Runner Commands & Coverage Analysis

### 2.1 Test Framework & Execution
- **Runner**: Vitest v3.2.7.
- **Exact Command**: `npm test` or `npx vitest run`.
- **Execution Speed**: 7.70 seconds (cold transform 4.60s, tests 4.26s).
- **Test Results**: **13 test files passed (13)**, **203 tests passed (203)**, 0 failures.

### 2.2 Existing Test Files & Scope Mapping

| # | Test File | Tests | Covered Modules | Tested Behaviors & Invariants |
|---|---|---|---|---|
| 1 | `tests/unit/adversarial-combo-recycler.test.ts` | 20 | `ComboManager`, `JunkyardScene` | 2.0s boundary streak decay (1999ms vs 2001ms), 1x-4x multiplier monotonicity, 8s Fever mode immunity, 2.5s recycler cooldown lockout, audio pitch escalation formula (1.0x-1.8x). |
| 2 | `tests/unit/adversarial-m-o1.test.ts` | 21 | `src/config/constants.ts` | `getCarryCapacity` extreme boundaries (clamping $L \in [1, 10]$), strict monotonicity, convexity verification ($\Delta^2 > 0$), upgrade cost ladder positivity and infinity cap at $L=10$. |
| 3 | `tests/unit/adversarial-m2-iter2.test.ts` | 15 | `TestBridge`, `PlayerRover`, `UIScene` | TestBridge emitter forward offset (+22px) vs center geometry across cardinal directions, virtual joystick touch/pointer release race conditions, production constants parity audit. |
| 4 | `tests/unit/challenges-achievements.test.ts` | 9 | `ChallengeManager`, `AchievementManager` | Rotating micro-challenges (3 active, progression tracking, completion rewards), 12 milestone achievement unlocks and serialization parity. |
| 5 | `tests/unit/combo-fever-recycler.test.ts` | 22 | `ComboManager`, `JunkyardScene` | 2.0s timing window decay, combo multiplier schedule, Fever Mode mechanics (overcharge buff, instant ability reset), recycler thermal lockout. |
| 6 | `tests/unit/economy.test.ts` | 39 | `src/config/constants.ts` | 12 scrap item catalog taxonomy (mass, coin value, drag resistance across 4 tiers), upgrade scaling formulas (Range, Power, Capacity, Speed), cost scaling $\lfloor\text{Base} \times \text{Multiplier}^{L-1}\rfloor$, tier milestone gates. |
| 7 | `tests/unit/engagement-features.test.ts` | 6 | `AbilityManager`, `DailyLoginManager` | Magnetic Pulse 12s cooldown, ready state progression, instant fever reset, 7-day daily login calendar, 2x ad reward claim, missed day streak reset. |
| 8 | `tests/unit/hazards.test.ts` | 8 | `ScrapCritter`, `EMPMine`, `RivalScavenger` | Critter zone-based roaming and cargo ejection (or repelled by active pulse/overcharge), EMP Mine proximity arming and detonation (3s magnet disable, cargo dump), Rival Scavenger AI. |
| 9 | `tests/unit/m-o1-economy-stress.test.ts` | 17 | `src/config/constants.ts`, Economy | 19,209 upgrade cost oracle verification, tier costs (750, 5000, 25000), starter capacity rejection of heavy items, active play progression pacing simulation ($\ge$ 15 minutes). |
| 10 | `tests/unit/m2-physics-stress.test.ts` | 10 | `PlayerRover`, Attraction Math | Magnetic attraction formula stability: $F = P / (d \times \text{drag})$, domain stability $d \in [26.01, R]$, 10,000 parameter combinations yielding zero NaN/div-by-zero, trajectory zero-orbiting. |
| 11 | `tests/unit/persistence.test.ts` | 16 | `SaveManager` | Save/Load serialization to LocalStorage, corrupted JSON fallback recovery, schema migration from v1 to v2. |
| 12 | `tests/unit/persistence-v2.test.ts` | 6 | `DailyLoginManager`, `SaveManager` | Offline earnings calculation, play time accumulator, streak persistence. |
| 13 | `tests/unit/sdk-mock.test.ts` | 14 | `MockCrazyGamesSDK` | CrazyGames SDK lifecycle (`gameplayStart`, `gameplayStop`), rewarded ad callbacks, banner ad display, adblock/error simulation. |

### 2.3 Critical Test Coverage Gaps
The existing test suite has **zero test coverage** for the new requirements in `prompt_draft.md`:
1. **Camera Screen Shake**:
   - No unit tests asserting camera shake calls during Magnetic Pulse, Pinata Crate destruction, or hazard hits.
   - No unit tests validating the Screen Shake toggle setting (enabled vs disabled).
2. **Particle Systems**:
   - No unit tests for particle emitter creation, burst counts, or cleanup lifecycles.
   - Missing tests for pulse sparks, crate debris particles, or rover movement dust particles.
3. **Game Balancing & Compactor Pacing**:
   - No tests verifying the 10-minute engagement loop curve.
   - No tests verifying the 1-3 minute initial safe distance/pressure (anti-churn) vs 5+ minute difficulty escalation.
4. **Destructible Pinata Crates**:
   - `DestructibleCrate.ts` has no dedicated test file. No tests verify crate hit detection, scrap count generation (4-6 pieces), 15% golden drop rate, or 45-second respawn timer.

---

## 3. Architectural Layout, Performance Patterns & Memory Leak Risks

### 3.1 Code Architecture & Module Map

```
src/
├── config/
│   ├── constants.ts         # Pure functional domain: scrap catalog, tier bounds, upgrade scaling, costs
│   └── phaserConfig.ts      # Arcade physics, 1280x720 canvas, scale FIT, multi-touch input
├── entities/
│   ├── PlayerRover.ts       # Player entity container: kinetic motion, cargo state, field graphics
│   ├── ScrapItem.ts         # Pooled scrap sprite: IDLE/ATTRACTED/COLLECTED states, physics
│   ├── ScrapPool.ts         # Pre-allocated 260-item pool, spatial queries, dynamic storms
│   └── hazards/
│       ├── DestructibleCrate.ts # Pinata scrap crate, smash feedback, scrap explosion
│       ├── EMPMine.ts           # Proximity hazard mine, magnet lockout, cargo dump
│       ├── HazardManager.ts     # Orchestrator for critters, mines, and rival AI rovers
│       ├── RivalScavenger.ts    # AI competitor rover stealing scrap
│       └── ScrapCritter.ts      # Bug/rust-rat stealing cargo on contact
├── scenes/
│   ├── BootScene.ts         # 0 KB asset generator: procedural graphics & texture generation
│   ├── JunkyardScene.ts     # Main world: physics, camera tracking, recycler press, updates
│   └── UIScene.ts           # Parallel UI: virtual joystick, HUD, modals, toasts, audio toggles
├── services/
│   ├── audio/
│   │   └── ProceduralAudioService.ts # Web Audio API synth (zero audio assets)
│   ├── crazygames/
│   │   └── MockCrazyGamesSDK.ts      # Emulates CrazyGames v2/v3 SDK interface
│   ├── economy/
│   │   ├── AbilityManager.ts         # Magnetic Pulse 12s cooldown manager
│   │   ├── AchievementManager.ts     # 12 achievements tracker & persistence
│   │   ├── ChallengeManager.ts       # 3 rotating micro-challenges
│   │   └── ComboManager.ts           # 2.0s combo timer & Fever Mode state machine
│   ├── persistence/
│   │   ├── DailyLoginManager.ts      # 7-day retention streak calendar
│   │   └── SaveManager.ts            # LocalStorage persistence with schema versioning
│   └── testing/
│       └── TestBridge.ts             # Global test hook (window.__MAGNET_GAME__)
└── ui/
    ├── AchievementPanel.ts  # Modal view for unlocked achievements
    └── UpgradeModal.ts      # Workshop shop for stats & tier unlocks
```

### 3.2 Performance Patterns (Strengths)
1. **Zero-GC Scrap Pooling**: `ScrapPool` creates exactly 260 `ScrapItem` objects upfront. Spawning and recycling toggles `setActive(true/false)` and resets physics bodies without runtime allocations.
2. **Procedural 0 KB Footprint**: All textures are drawn programmatically in `BootScene` into Phaser's `TextureManager` using graphics primitives. All sound effects are generated via Web Audio API oscillators and noise buffers. No external HTTP downloads.
3. **Squared-Distance Optimization**: Proximity detection (magnetic attraction, critter collisions, EMP triggers) evaluates $dx^2 + dy^2 \le r^2$, avoiding expensive `Math.sqrt` calls on every frame.
4. **Scene Decoupling**: Game world simulation runs in `JunkyardScene` while UI rendering runs on a separate layer in `UIScene`, communicating purely via event emitters (`this.events.emit`).

### 3.3 Memory Leak Risks & Mitigation Proposals

| # | Risk Area | Observation | Impact | Recommended Mitigation |
|---|---|---|---|---|
| **1** | **Scene Event Listeners** | `UIScene.create()` binds 13 listeners to `junkyard.events.on(...)` (lines 109-121). `UIScene` lacks a `shutdown()` method to call `junkyard.events.off(...)`. | If scenes restart, duplicate event listeners accumulate, retaining references to destroyed UI elements. | Implement `UIScene.shutdown()` that unbinds all `junkyard.events` listeners. |
| **2** | **Particle Emitter Cleanup** | `sparkEmitter` in `JunkyardScene` is created via `this.add.particles()` (line 330) but is never destroyed in `shutdown()` (line 1086 only calls `recyclerSteamEmitter.stop()`). | Lingering emitter in WebGL pipeline upon scene reboot. | Explicitly destroy `sparkEmitter`, `recyclerSteamEmitter`, and any new emitters in `JunkyardScene.shutdown()`. |
| **3** | **High-Frequency Text Allocation** | In `JunkyardScene.showFloatingText()` (lines 717-743), every coin or scrap event instantiates `this.add.text()` and a new Phaser tween. At full capacity dump (30ms interval), this creates 30 text objects/tweens per second. | Causes GC pauses / frame drops on low-end mobile devices during rapid recycling. | Introduce a small reusable text pool or batch coin gains into combined floating values. |
| **4** | **Uncleaned Crate Timers** | `DestructibleCrate.breakCrate()` schedules `this.scene.time.delayedCall(45000, ...)` (line 80). If the scene restarts or crates are destroyed, timer events can execute on disposed objects. | "Cannot read properties of destroyed object" runtime exceptions. | Iterate over `this.destructibleCrates` in `JunkyardScene.shutdown()` and invoke `.destroy()` to cancel pending timers. |
| **5** | **Direct Unchecked Camera Shake** | Camera shake is called directly: `cameras.main.shake(200, 0.012)` in `JunkyardScene` and `cameras.main.shake(120, 0.008)` in `DestructibleCrate`. No check is performed against player preferences. | Players prone to motion sickness cannot disable shake; multiple overlapping shakes distort camera offsets. | Route all camera shakes through a centralized helper method (e.g. `junkyard.shakeCamera(duration, intensity)`) that checks `SaveManager.getSettings().screenShakeEnabled`. |

---

## 4. Baseline Test and Build Execution Command

To verify the codebase status at any time:

### Build Verification Command:
```powershell
npm run build
```
- **Executes**: `tsc && vite build && node scripts/verify-dist-size.js`
- **Current Status**: **PASS** (Zero TS errors, 1.55 MB bundle size < 10 MB limit).

### Unit Test Verification Command:
```powershell
npm test
```
- **Executes**: `vitest run`
- **Current Status**: **PASS** (13 test files, 203 tests, duration ~7.7s).

### Dist Size Verification Command:
```powershell
npm run verify:size
```
- **Executes**: `node scripts/verify-dist-size.js`
- **Current Status**: **PASS** (1,621,061 bytes / 10,485,760 bytes max).

---

## 5. Architectural Recommendations for Implementation Agents

1. **For Game Feel (Explorer 1 / Implementer 1)**:
   - Add a centralized `shakeCamera(durationMs: number, intensity: number)` method to `JunkyardScene` that checks `this.isScreenShakeEnabled`.
   - Store `screenShakeEnabled: boolean` in `SaveManager` (with default `true`).
   - Add a Screen Shake toggle button in `UIScene` next to the audio mute toggle.
   - For particle effects (sparks on pulse, debris on crate smash, dust at high speed):
     - Generate procedural particle textures (`pulse_spark`, `debris_chunk`, `dust_cloud`) in `BootScene.generateParticleAndUITextures()`.
     - Pool particle emitters in `JunkyardScene` and call `.explode(count, x, y)` on trigger.
     - Add cleanup logic in `JunkyardScene.shutdown()` for all emitters.
2. **For Balancing & Economy (Explorer 2 / Implementer 2)**:
   - Adjust `compactorInterval` in `JunkyardScene.ts` (line 553) and world hazard scaling in `HazardManager.ts`.
   - Implement pacing curve based on session elapsed time (`Date.now() - this.sessionStartTime`):
     - Minutes 0-3: Anti-churn safe phase (hazards spawn at 50% rate, safe radius increased).
     - Minutes 3-5: Moderate phase.
     - Minutes 5-10+: Escalation phase (higher scrap rewards, increased hazard aggression, scrap storm events).
   - Tune `SCRAP_CATALOG` coin values and `UPGRADE_BASE_COSTS` / `UPGRADE_COST_MULTIPLIERS` in `constants.ts` to sustain progression across 10-15 minutes.
3. **For Testing & QA**:
   - Create new unit tests in `tests/unit/game-feel.test.ts` to verify Screen Shake toggle logic and particle emitter trigger hooks.
   - Create new unit tests in `tests/unit/pacing-balancing.test.ts` to assert that hazard spawn rates and compactor speed scale monotonically with session duration.
