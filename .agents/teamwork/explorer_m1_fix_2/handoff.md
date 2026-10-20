# Technical Investigation & Remediation Report: Zero-Allocation Rival Smoke Particle Lifecycle

**Agent**: explorer_m1_fix_2  
**Target Milestone**: Milestone 1 Remediation (Game Feel & Visual Polish)  
**Parent Conversation ID**: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a  
**Working Directory**: `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_2`  
**Verdict**: **REMEDIATION_READY**

---

## 1. Observation

### 1.1 Empirical Defect in `RivalScavenger.ts`
In `src/entities/hazards/RivalScavenger.ts` (lines 118-130), `createSmokePuff()` dynamically constructs a new `ParticleEmitter` and schedules a `delayedCall` timer on every invocation:
```typescript
// src/entities/hazards/RivalScavenger.ts:118-130
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

This method is executed at:
1. `src/entities/hazards/RivalScavenger.ts:43` — inside `spawn(x, y, zoneTier, currentTime)`.
2. `src/entities/hazards/RivalScavenger.ts:67` — inside `updateAI(deltaMs, scrapPool, currentTime)` upon 30-second duration expiration / despawn.

### 1.2 Emitter Landscape Across Codebase
A grep across the entire `src/` codebase for `add.particles` confirmed exactly 6 sites:
1. `src/scenes/JunkyardScene.ts:333` — `this.sparkEmitter` (pre-allocated, `emitting: false`)
2. `src/scenes/JunkyardScene.ts:344` — `this.pulseSparkEmitter` (pre-allocated, `emitting: false`)
3. `src/scenes/JunkyardScene.ts:357` — `this.crateDebrisEmitter` (pre-allocated, `emitting: false`)
4. `src/scenes/JunkyardScene.ts:370` — `this.roverDustEmitter` (pre-allocated, `emitting: false`)
5. `src/scenes/JunkyardScene.ts:391` — `this.recyclerSteamEmitter` (pre-allocated, `emitting: false`)
6. `src/entities/hazards/RivalScavenger.ts:119` — `this.scene.add.particles` (**the sole remaining dynamic runtime allocation site in the entire project**)

### 1.3 `JunkyardScene` Emitter Architecture & Shutdown Status
- In `src/scenes/JunkyardScene.ts` (lines 59-63):
  ```typescript
  public sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public pulseSparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public crateDebrisEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public roverDustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private recyclerSteamEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  ```
- In `src/scenes/JunkyardScene.ts` (lines 332-402 in `buildRecyclerStation`):
  All pre-allocated emitters are instantiated during scene initialization and configured with `emitting: false`.
- In `src/scenes/JunkyardScene.ts` (lines 1142-1174 in `shutdown()`):
  `sparkEmitter`, `pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`, and `recyclerSteamEmitter` are destroyed via `.destroy()`. There is currently no `rivalSmokeEmitter` member or cleanup call.

### 1.4 Test Suite Impact
In `tests/unit/adversarial-m1-perf-memory.test.ts` (lines 234-338), the test `Empirical Defect Discovery 1: RivalScavenger Dynamic ParticleEmitter Allocation & Timer Leaks` was authored by `challenger_m1_2_r2` to assert that `this.scene.add.particles` and `delayedCall` are called. Once remediated, those tests will fail unless updated to assert that zero allocations occur and `rivalSmokeEmitter.explode()` is invoked.

---

## 2. Logic Chain

1. **Root Cause**: `RivalScavenger` instantiates a transient `ParticleEmitter` and creates a 700ms `delayedCall` timer whenever a rival enters or leaves the playfield. In prolonged sessions, recurring rival spawns trigger continuous GC pressure and timer object churn.
2. **Pre-Allocation Principle**: In Phaser 3, a `ParticleEmitter` configured with `emitting: false` pre-allocates its internal particle buffer and pipeline references at scene creation. Calling `emitter.explode(count, x, y)` emits the burst instantaneously at the target coordinates without allocating any new JavaScript objects or GameObjects.
3. **Architecture Consistency**: `JunkyardScene` already centrally manages all other particle emitters (`sparkEmitter`, `pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`, `recyclerSteamEmitter`). Adding `public rivalSmokeEmitter` aligns `RivalScavenger` with the existing pattern used by `DestructibleCrate` (`junkyard.crateDebrisEmitter.explode(...)`) and `PlayerRover` (`junkyard.roverDustEmitter.emitParticleAt(...)`).
4. **Decoupling & Circular Dependency Avoidance**: In `RivalScavenger.ts`, casting `this.scene` as an interface `{ rivalSmokeEmitter?: Phaser.GameObjects.Particles.ParticleEmitter }` allows type-safe access to `rivalSmokeEmitter` without creating a circular module dependency between `JunkyardScene` and `RivalScavenger`.
5. **Headless & Teardown Safety**: Guarding with `if (junkyard?.rivalSmokeEmitter && junkyard.rivalSmokeEmitter.active !== false)` ensures that:
   - Headless unit tests that instantiate `RivalScavenger` with minimal mock scenes (like `tests/unit/hazards.test.ts`) continue to run smoothly without errors.
   - If the scene or emitter is in the process of shutting down (`active === false`), no particle explosion is triggered on a disposed emitter.
6. **Lifecycle Completeness**: Registering `this.rivalSmokeEmitter.destroy()` in `JunkyardScene.shutdown()` ensures all WebGL resources and buffers associated with `rivalSmokeEmitter` are disposed when the scene stops or transitions.

---

## 3. Caveats

1. **Division of Responsibility**:
   - `explorer_m1_fix_1` is handling the missing `this.events.on('shutdown', this.shutdown, this)` hook in `JunkyardScene.create()` and event listener unbinding on managers.
   - `explorer_m1_fix_2` (this report) handles the pre-allocated `rivalSmokeEmitter` on `JunkyardScene`, its usage in `RivalScavenger`, its disposal in `JunkyardScene.shutdown()`, and the corresponding unit test updates.
2. **Adversarial Test Refactoring**:
   - `tests/unit/adversarial-m1-perf-memory.test.ts` lines 234-338 was explicitly written to assert defect reproduction. When the code is fixed, that test MUST be updated to verify the remediation (zero `add.particles`, zero `delayedCall`, and invocation of `rivalSmokeEmitter.explode(10, x, y)`).

---

## 4. Conclusion & Proposed Implementation Specification

### 4.1 Changes to `src/scenes/JunkyardScene.ts`

#### Change 1: Class Property Declaration
**File**: `src/scenes/JunkyardScene.ts`  
**Location**: Line 62 (alongside other particle emitters)

```typescript
// BEFORE:
  public crateDebrisEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public roverDustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private recyclerSteamEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

// AFTER:
  public crateDebrisEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public roverDustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  public rivalSmokeEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private recyclerSteamEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
```

#### Change 2: Pre-Allocation in `buildRecyclerStation()`
**File**: `src/scenes/JunkyardScene.ts`  
**Location**: Lines 378-403 (immediately following `roverDustEmitter` initialization)

```typescript
// BEFORE:
    // Rover High-Speed Dust Emitter (Ground Treads)
    this.roverDustEmitter = this.add.particles(0, 0, 'dust_particle', {
      speed: { min: 15, max: 45 },
      scale: { start: 0.8, end: 1.6 },
      alpha: { start: 0.45, end: 0 },
      lifespan: 350,
      emitting: false,
    });
    this.roverDustEmitter.setDepth(10);

    // Ensure steam_particle texture exists
    if (!this.textures.exists('steam_particle')) {

// AFTER:
    // Rover High-Speed Dust Emitter (Ground Treads)
    this.roverDustEmitter = this.add.particles(0, 0, 'dust_particle', {
      speed: { min: 15, max: 45 },
      scale: { start: 0.8, end: 1.6 },
      alpha: { start: 0.45, end: 0 },
      lifespan: 350,
      emitting: false,
    });
    this.roverDustEmitter.setDepth(10);

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
```

#### Change 3: Emitter Disposal in `shutdown()`
**File**: `src/scenes/JunkyardScene.ts`  
**Location**: Lines 1158-1163

```typescript
// BEFORE:
    if (this.roverDustEmitter) {
      this.roverDustEmitter.destroy();
    }
    if (this.recyclerSteamEmitter) {
      this.recyclerSteamEmitter.destroy();
    }

// AFTER:
    if (this.roverDustEmitter) {
      this.roverDustEmitter.destroy();
    }
    if (this.rivalSmokeEmitter) {
      this.rivalSmokeEmitter.destroy();
    }
    if (this.recyclerSteamEmitter) {
      this.recyclerSteamEmitter.destroy();
    }
```

---

### 4.2 Changes to `src/entities/hazards/RivalScavenger.ts`

#### Refactor `createSmokePuff()`
**File**: `src/entities/hazards/RivalScavenger.ts`  
**Location**: Lines 118-130

```typescript
// BEFORE:
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

// AFTER:
  private createSmokePuff(): void {
    const junkyard = this.scene as { rivalSmokeEmitter?: Phaser.GameObjects.Particles.ParticleEmitter };
    if (junkyard?.rivalSmokeEmitter && junkyard.rivalSmokeEmitter.active !== false) {
      junkyard.rivalSmokeEmitter.explode(10, this.x, this.y);
    }
  }
```

---

### 4.3 Changes to `tests/unit/adversarial-m1-perf-memory.test.ts`

Update the defect discovery suite to verify the zero-allocation remediation:
**File**: `tests/unit/adversarial-m1-perf-memory.test.ts`  
**Location**: Lines 234-338

```typescript
// BEFORE:
describe('Empirical Defect Discovery 1: RivalScavenger Dynamic ParticleEmitter Allocation & Timer Leaks', () => {
  it('reveals RivalScavenger allocates a NEW ParticleEmitter on every spawn() call', () => {
    const addParticlesSpy = vi.fn().mockReturnValue({
      setDepth: vi.fn(),
      explode: vi.fn(),
      destroy: vi.fn(),
    });
    const delayedCallSpy = vi.fn();

    const mockScene: any = {
      add: {
        existing: vi.fn(),
        particles: addParticlesSpy,
      },
      physics: {
        world: {
          enable: (sprite: any) => {
            sprite.body = {
              setSize: vi.fn(),
              setCircle: vi.fn(),
              setCollideWorldBounds: vi.fn(),
              setVelocity: vi.fn(),
              velocity: { x: 0, y: 0 },
              enable: true,
            };
          },
        },
      },
      time: {
        delayedCall: delayedCallSpy,
      },
    };

    const rival = new RivalScavenger(mockScene, 0, 0);

    // Initial construction does not call spawn
    addParticlesSpy.mockClear();
    delayedCallSpy.mockClear();

    // Trigger spawn
    rival.spawn(300, 400, 2, 1000);

    // EMPIRICAL FINDING: RivalScavenger allocates a brand new ParticleEmitter via scene.add.particles!
    expect(addParticlesSpy).toHaveBeenCalledTimes(1);
    expect(addParticlesSpy).toHaveBeenCalledWith(
      300,
      400,
      'smoke_particle',
      expect.objectContaining({
        speed: { min: 20, max: 70 },
        lifespan: 600,
        quantity: 10,
      })
    );

    // EMPIRICAL FINDING: Schedules a delayedCall timer (700ms) for each puff
    expect(delayedCallSpy).toHaveBeenCalledTimes(1);
    expect(delayedCallSpy).toHaveBeenCalledWith(700, expect.any(Function));
  });

  it('reveals RivalScavenger allocates ANOTHER ParticleEmitter upon despawn expiration', () => {
    const addParticlesSpy = vi.fn().mockReturnValue({
      setDepth: vi.fn(),
      explode: vi.fn(),
      destroy: vi.fn(),
    });

    const mockScene: any = {
      add: {
        existing: vi.fn(),
        particles: addParticlesSpy,
      },
      physics: {
        world: {
          enable: (sprite: any) => {
            sprite.body = {
              setSize: vi.fn(),
              setCircle: vi.fn(),
              setCollideWorldBounds: vi.fn(),
              setVelocity: vi.fn(),
              velocity: { x: 0, y: 0 },
              enable: true,
            };
          },
        },
      },
      time: {
        delayedCall: vi.fn(),
      },
    };

    const rival = new RivalScavenger(mockScene, 0, 0);
    rival.spawn(300, 400, 2, 1000);

    addParticlesSpy.mockClear();

    // Simulate expiration in updateAI (currentTime >= despawnAt)
    const mockScrapPool: any = { getActiveItems: vi.fn().mockReturnValue([]) };
    rival.updateAI(16, mockScrapPool, 1000 + 45000);

    // EMPIRICAL FINDING: A second ParticleEmitter is allocated dynamically upon expiration!
    expect(addParticlesSpy).toHaveBeenCalledTimes(1);
    expect(rival.isActiveRival).toBe(false);
  });
});

// AFTER:
describe('Empirical Defect Remediation 1: RivalScavenger Zero-Allocation Smoke Emitter', () => {
  it('verifies RivalScavenger triggers pre-allocated rivalSmokeEmitter.explode() and allocates ZERO new emitters on spawn()', () => {
    const addParticlesSpy = vi.fn();
    const explodeSpy = vi.fn();
    const delayedCallSpy = vi.fn();

    const mockScene: any = {
      rivalSmokeEmitter: {
        explode: explodeSpy,
      },
      add: {
        existing: vi.fn(),
        particles: addParticlesSpy,
      },
      physics: {
        world: {
          enable: (sprite: any) => {
            sprite.body = {
              setSize: vi.fn(),
              setCircle: vi.fn(),
              setCollideWorldBounds: vi.fn(),
              setVelocity: vi.fn(),
              velocity: { x: 0, y: 0 },
              enable: true,
            };
          },
        },
      },
      time: {
        delayedCall: delayedCallSpy,
      },
    };

    const rival = new RivalScavenger(mockScene, 0, 0);

    // Initial construction does not call spawn
    explodeSpy.mockClear();
    addParticlesSpy.mockClear();
    delayedCallSpy.mockClear();

    // Trigger spawn
    rival.spawn(300, 400, 2, 1000);

    // Zero dynamic ParticleEmitter allocations via scene.add.particles
    expect(addParticlesSpy).not.toHaveBeenCalled();
    // Zero delayedCall timers scheduled
    expect(delayedCallSpy).not.toHaveBeenCalled();
    // Emitter exploded with 10 particles at rival position (300, 400)
    expect(explodeSpy).toHaveBeenCalledTimes(1);
    expect(explodeSpy).toHaveBeenCalledWith(10, 300, 400);
  });

  it('verifies RivalScavenger triggers pre-allocated rivalSmokeEmitter.explode() and allocates ZERO new emitters upon despawn expiration', () => {
    const addParticlesSpy = vi.fn();
    const explodeSpy = vi.fn();
    const delayedCallSpy = vi.fn();

    const mockScene: any = {
      rivalSmokeEmitter: {
        explode: explodeSpy,
      },
      add: {
        existing: vi.fn(),
        particles: addParticlesSpy,
      },
      physics: {
        world: {
          enable: (sprite: any) => {
            sprite.body = {
              setSize: vi.fn(),
              setCircle: vi.fn(),
              setCollideWorldBounds: vi.fn(),
              setVelocity: vi.fn(),
              velocity: { x: 0, y: 0 },
              enable: true,
            };
          },
        },
      },
      time: {
        delayedCall: delayedCallSpy,
      },
    };

    const rival = new RivalScavenger(mockScene, 0, 0);
    rival.spawn(300, 400, 2, 1000);

    explodeSpy.mockClear();
    addParticlesSpy.mockClear();
    delayedCallSpy.mockClear();

    // Simulate expiration in updateAI (currentTime >= despawnAt)
    const mockScrapPool: any = { getActiveItems: vi.fn().mockReturnValue([]) };
    rival.updateAI(16, mockScrapPool, 1000 + 45000);

    // Zero dynamic ParticleEmitter allocations via scene.add.particles upon expiration
    expect(addParticlesSpy).not.toHaveBeenCalled();
    // Zero delayedCall timers scheduled
    expect(delayedCallSpy).not.toHaveBeenCalled();
    // Emitter exploded with 10 particles at rival position (300, 400)
    expect(explodeSpy).toHaveBeenCalledTimes(1);
    expect(explodeSpy).toHaveBeenCalledWith(10, 300, 400);
    expect(rival.isActiveRival).toBe(false);
  });
});
```

---

## 5. Verification Method

To independently verify the remediation once applied by the worker:

1. **Verify Unit Test Suite**:
   ```bash
   npx vitest run tests/unit/adversarial-m1-perf-memory.test.ts
   ```
   **Expected**: All 10 tests pass, confirming `rivalSmokeEmitter` pre-allocation, zero dynamic emitter allocations, zero scheduled timer leaks, and proper cleanup.

2. **Verify Full Regression Suite**:
   ```bash
   npm test
   ```
   **Expected**: 15/15 test files pass (100%), including `hazards.test.ts`, `adversarial-m1-perf-memory.test.ts`, and `adversarial-m1-gamefeel.test.ts`.

3. **Verify Zero Runtime Particle Allocations**:
   Grep `src/` for `add.particles`:
   ```bash
   git grep "add\.particles" src/
   ```
   **Expected**: All 6 matches are located inside `JunkyardScene.ts` within `buildRecyclerStation` during initial scene construction. 0 matches in entity hot loops.

4. **Verify Production Build**:
   ```bash
   npm run build
   ```
   **Expected**: Clean TypeScript compile (`tsc`), Vite bundle generation, and uncompressed dist size strictly under 10MB portal threshold.

5. **Invalidation Conditions**:
   - Any runtime call to `this.scene.add.particles` inside `RivalScavenger.ts` or any `src/entities/` file.
   - Any runtime call to `this.scene.time.delayedCall` for particle emitter destruction.
   - Omission of `rivalSmokeEmitter.destroy()` in `JunkyardScene.shutdown()`.
