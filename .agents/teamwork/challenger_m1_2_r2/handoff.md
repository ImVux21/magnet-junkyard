# Milestone 1: Performance & Memory Challenge Handoff Report

**Agent**: challenger_m1_2_r2 (Performance & Memory Challenger)  
**Milestone**: Milestone 1: Game Feel & Visual Polish  
**Working Directory**: `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\challenger_m1_2_r2`  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Test Suite & Production Build Execution
- Command `npm test`:
  ```text
  Test Files  15 passed (15)
       Tests  238 passed (238)
    Duration  2.00s
  ```
  All existing tests plus the newly added empirical stress test suite (`tests/unit/adversarial-m1-perf-memory.test.ts`) executed and passed 100%.

- Command `npm run build`:
  ```text
  ✓ built in 12.61s
  [Portal Compliance] Total uncompressed dist/ size: 1.55 MB (1,627,440 bytes / 10,485,760 bytes max).
  [PASSED] dist/ size is strictly under 10MB.
  ```
  Build succeeded with exit code 0. Dist directory total size is 1.55 MB (1,627,440 bytes), strictly below the 10 MB budget limit (15.5% of total budget).

### 1.2 Particle Emitter Pre-Allocation & Hot Loops
- In `src/scenes/JunkyardScene.ts` (lines 333-377):
  - `sparkEmitter` (pre-allocated in `buildRecyclerStation`, line 333)
  - `pulseSparkEmitter` (pre-allocated in `buildRecyclerStation`, line 344)
  - `crateDebrisEmitter` (pre-allocated in `buildRecyclerStation`, line 357)
  - `roverDustEmitter` (pre-allocated in `buildRecyclerStation`, line 370)
  - `recyclerSteamEmitter` (pre-allocated in `buildRecyclerStation`, line 391)
  - All M1 emitters use `emitting: false` and are triggered during gameplay via `.explode()` or `.emitParticleAt()`, allocating zero new `ParticleEmitter` objects in hot loops.
- **Defect Observation in `src/entities/hazards/RivalScavenger.ts` (lines 118-130)**:
  ```ts
  private createSmokePuff(): void {
    const p = this.scene.add.particles(this.x, this.y, 'smoke_particle', {
      speed: { min: 20, max: 70 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.0, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 600,
      quantity: 10,
    });
    p.setDepth(26);
    p.explode();
    this.scene.time.delayedCall(700, () => p.destroy());
  }
  ```
  `createSmokePuff()` is called in `spawn()` (line 43) and `updateAI()` on despawn (line 67). Every spawn and despawn of a rival dynamically allocates a brand new `ParticleEmitter` and schedules a 700ms `delayedCall` timer.

### 1.3 Scene Shutdown & Destroy Handlers
- In `src/scenes/UIScene.ts` (lines 107, 981-999):
  - Line 107: `this.events.on('shutdown', this.shutdown, this);` properly binds the scene shutdown lifecycle event.
  - Lines 981-999: Unbinds all 14 listeners attached to `junkyard.events` (`cargo-updated`, `coins-updated`, `tier-updated`, `buff-activated`, `combo-updated`, `fever-started`, `fever-ended`, `combo-expired`, `prestige-updated`, `challenge-updated`, `hazard-hit`, `hazard-repelled`, `offline-earnings`, `screenshake-toggled`).
- **Critical Defect Observation in `src/scenes/JunkyardScene.ts` (lines 1142-1174)**:
  - `JunkyardScene` defines a cleanup method `public shutdown(): void` (lines 1142-1174) that destroys emitters, crate timers, and scrap pool:
    ```ts
    public shutdown(): void {
      if (this.respawnTimer) this.respawnTimer.destroy();
      if (this.scrapPool) this.scrapPool.destroy();
      if (this.sparkEmitter) this.sparkEmitter.destroy();
      if (this.pulseSparkEmitter) this.pulseSparkEmitter.destroy();
      if (this.crateDebrisEmitter) this.crateDebrisEmitter.destroy();
      if (this.roverDustEmitter) this.roverDustEmitter.destroy();
      if (this.recyclerSteamEmitter) this.recyclerSteamEmitter.destroy();
      if (this.destructibleCrates) {
        for (const crate of this.destructibleCrates) crate.destroy();
        this.destructibleCrates = [];
      }
      this.comboManager.reset();
      if (this.audioService) this.audioService.stopAll();
    }
    ```
  - **HOWEVER**: `JunkyardScene.create()` (lines 96-240) **NEVER** calls `this.events.on('shutdown', this.shutdown, this)`.
  - In Phaser 3, `SceneManager.stop()` calls `scene.sys.shutdown()`, which emits `'shutdown'` on `scene.events` (`events.emit(Events.SHUTDOWN, this, data)` in `node_modules/phaser/src/scene/Systems.js:785`). Phaser does **NOT** automatically call class methods named `shutdown()`.
  - Because the event listener is absent, `JunkyardScene.prototype.shutdown()` is dead code during runtime scene shutdown/restart.
  - As a direct consequence, during a scene transition or restart:
    1. `pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`, `sparkEmitter`, and `recyclerSteamEmitter` are **NOT** destroyed.
    2. `destructibleCrates` are **NOT** destroyed, leaving active 45-second delayed timers (`respawnTimer = this.scene.time.delayedCall(45000, ...)`) running on the scene timer clock.
    3. `this.scrapPool.destroy()` and `this.respawnTimer.destroy()` are **NOT** called.
    4. `this.audioService.stopAll()` is **NOT** called.

---

## 2. Logic Chain

1. **Bundle Size**: Direct measurement via `node scripts/verify-dist-size.js` confirms total uncompressed size is 1.55 MB, far below the 10 MB CrazyGames portal limit. The procedurally generated audio and graphics strategy is completely compliant.
2. **Pre-Allocation Requirement**: Dispatch item 3 states: *"Verify particle emitters are pre-allocated and do not allocate new ParticleEmitter instances during gameplay."*
   - While worker_m1 pre-allocated the three new M1 emitters (`pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`), `RivalScavenger.ts` line 119 calls `this.scene.add.particles(...)` inside `createSmokePuff()` on every spawn and despawn.
   - This causes dynamic allocations and garbage collector pressure whenever rivals enter or exit the playfield, violating the zero-runtime-allocation constraint.
3. **Shutdown & Leak Prevention Requirement**: Dispatch item 4 states: *"Verify scene shutdown and destroy handlers: check for event listener leaks, timer leaks, and uncollected references."*
   - Worker_m1 authored `public shutdown(): void` in `JunkyardScene.ts` and claimed in `worker_m1/handoff.md` line 22 & 54 that memory leaks were fixed across scene restarts.
   - However, empirical examination of Phaser 3 lifecycle mechanics and `JunkyardScene.ts:96-240` reveals that `this.events.on('shutdown', this.shutdown, this)` was omitted in `create()`.
   - In contrast to `UIScene.ts:107` which correctly wired `this.events.on('shutdown', this.shutdown, this)`, `JunkyardScene.shutdown()` is never triggered when Phaser shuts down the scene.
   - Consequently, all 5 particle emitters, all active 45-second crate respawn timers, the 1.5s scrap respawn loop, and the scrap pool remain un-disposed on scene shutdown.

---

## 3. Caveats

- In single-session play without scene transitions, the un-wired `JunkyardScene.shutdown()` does not manifest as an immediate crash because the browser tab simply keeps running. However, upon game restart, death/respawn transition, or level reload, it causes duplicate emitters, orphan timers, and substantial memory leakage.
- WebGL draw call batching and mobile GPU fill rate cannot be tested in a headless Node/Vitest runner, but procedural sprites share uniform dimensions, avoiding texture atlas thrashing.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

The work product passes bundle size requirements (1.55 MB < 10MB) and test suites pass 100%. However, changes are requested to address two critical defects before Milestone 1 can be certified:

1. **Defect 1 (CRITICAL - Scene Shutdown Hook Omission)**:
   In `src/scenes/JunkyardScene.ts`, add the shutdown lifecycle event registration inside `create()`:
   ```ts
   this.events.on('shutdown', this.shutdown, this);
   ```
   Without this single line, the entire `JunkyardScene.shutdown()` cleanup routine is dead code and never executed by Phaser 3.

2. **Defect 2 (HIGH - Dynamic Particle Allocation in RivalScavenger)**:
   In `src/entities/hazards/RivalScavenger.ts`, replace `createSmokePuff()`'s dynamic allocation (`this.scene.add.particles(...)` + `delayedCall`) with a pre-allocated emitter (or route through a pre-allocated emitter on `JunkyardScene`, e.g., `junkyard.smokeEmitter` or reuse `junkyard.roverDustEmitter` / `recyclerSteamEmitter`), so zero new `ParticleEmitter` objects are allocated during runtime.

---

## 5. Verification Method

1. **Automated Verification Harness**:
   Run the newly added empirical stress test suite:
   ```bash
   npx vitest run tests/unit/adversarial-m1-perf-memory.test.ts
   ```
   - Tests `Empirical Defect Discovery 1`: Proves `RivalScavenger.spawn()` and `updateAI()` dynamically allocate new `ParticleEmitter` instances.
   - Tests `Empirical Defect Discovery 2`: Proves `JunkyardScene.ts` source lacks `this.events.on('shutdown', ...)` and simulates un-disposed emitters/crates on Phaser shutdown.
   - Tests `Empirical Verification 3`: Proves `UIScene.shutdown()` unbinds all 14 cross-scene listeners.
   - Tests `Empirical Verification 4`: Proves `DestructibleCrate.destroy()` cancels delayed timers and kills tweens.
   - Tests `Empirical Perf Challenge 1`: Confirms bundle size < 10MB.

2. **Full Regression Test Run**:
   ```bash
   npm test
   ```
   Expected: 15 passed test files, 238 passed tests (100%).

3. **Production Build Size Verification**:
   ```bash
   npm run build
   ```
   Expected: Exit code 0, dist/ size ~1.55 MB, strictly < 10MB.
