# Technical Investigation & Remediation Plan: JunkyardScene Lifecycle & Shutdown

**Agent**: `explorer_m1_fix_1` (Technical Exploration Agent)  
**Working Directory**: `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_1`  
**Parent Conversation ID**: `8d72af9b-41a6-4ea1-93f6-835a8f34ff9a`  
**Target Milestone**: Milestone 1 Remediation (Lifecycle & Memory Leak Elimination)  

---

## Executive Summary

An exhaustive investigation of `JunkyardScene.ts`, Phaser 3 lifecycle mechanics (`Systems.js`), and recent review reports (`reviewer_m1_2_r2` and `challenger_m1_2_r2`) confirms that `JunkyardScene.shutdown()` was completely orphaned due to the omission of `this.events.on('shutdown', this.shutdown, this)` in `create()`. Furthermore, instance managers (`challengeManager`, `achievementManager`, `comboManager`) and `achievement-trigger` scene events bind anonymous closures on every `create()` execution, creating cumulative duplicate listeners on every scene restart. This report provides exact line-by-line before/after code modifications, memory cleanup steps for all 5 particle emitters, active 45-second crate respawn timers, scrap pool entities, and a test harness adjustment plan.

A complete diff patch is provided in `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_1\junkyard_scene_lifecycle.patch`.

---

## 1. Observation

### 1.1 Direct Inspection of Phaser 3 Engine Lifecycle
- **File**: `node_modules/phaser/src/scene/Systems.js:780-786`
  ```javascript
  780:         settings.status = CONST.SHUTDOWN;
  781: 
  782:         settings.active = false;
  783:         settings.visible = false;
  784: 
  785:         events.emit(Events.SHUTDOWN, this, data);
  786:     },
  ```
- **Observation**: Phaser 3 `Systems.shutdown()` emits `Events.SHUTDOWN` (`'shutdown'`) across `events` (the `scene.events` EventEmitter). Phaser **NEVER** automatically calls a method named `shutdown()` on the scene class prototype. Unless an explicit listener `this.events.on('shutdown', this.shutdown, this)` is bound, `JunkyardScene.prototype.shutdown` is dead code at runtime.
- **Reference Implementation**: `src/scenes/UIScene.ts:107`:
  ```typescript
  107:     this.events.on('shutdown', this.shutdown, this);
  ```
  `UIScene` correctly registered the listener; `JunkyardScene` omitted it completely.

### 1.2 Event Listener Accumulation Mechanics on Scene Restart
- **File**: `src/scenes/JunkyardScene.ts:31-35`
  ```typescript
  31:   public comboManager: ComboManager = new ComboManager();
  32:   public hazardManager!: HazardManager;
  33:   public challengeManager: ChallengeManager = new ChallengeManager();
  34:   public achievementManager: AchievementManager = new AchievementManager();
  ```
- **File**: `src/scenes/JunkyardScene.ts:127-152, 195-230`
  ```typescript
  127:     this.challengeManager.on((state, completed) => { ... });
  138:     this.achievementManager.on((ach, reward) => { ... });
  147:     this.events.on('achievement-trigger', (id: string) => { ... });
  195:     this.comboManager.on('fever-started', (state) => { ... });
  213:     this.comboManager.on('fever-ended', (state) => { ... });
  222:     this.comboManager.on('combo-expired', (state) => { ... });
  228:     this.comboManager.on('combo-updated', (state) => { ... });
  ```
- **Observation**: When Phaser restarts a scene (`this.scene.restart()`), it does NOT re-instantiate the Scene class; it invokes `sys.shutdown()` followed by `sys.start()` and `create()` on the **same existing instance**.
- Because `challengeManager`, `achievementManager`, and `comboManager` are instantiated once as property initializers, each scene restart executes `create()` and registers **additional** listeners to the existing `Set` of listeners.
- `this.events.on('achievement-trigger', ...)` passes an anonymous arrow function directly to `this.events`. Phaser's `Systems.shutdown()` does NOT call `removeAllListeners()` on `this.events` (that only happens in `destroy()` at `Systems.js:810`). Therefore, `this.events` also accumulates duplicate `achievement-trigger` listeners across restarts.
- **Consequence**: Upon completing a challenge or triggering Fever mode in a restarted scene, handlers execute multiple times, awarding duplicated coins, playing overlapping sound effects, and triggering multiple state saves.

### 1.3 Particle Emitters, Crates, Timers, and Scrap Pool
- **File**: `src/scenes/JunkyardScene.ts:333-401`
  - Emitter 1: `this.sparkEmitter` (line 333)
  - Emitter 2: `this.pulseSparkEmitter` (line 344)
  - Emitter 3: `this.crateDebrisEmitter` (line 357)
  - Emitter 4: `this.roverDustEmitter` (line 370)
  - Emitter 5: `this.recyclerSteamEmitter` (line 391)
- **File**: `src/scenes/JunkyardScene.ts:184, 923-952`
  - `this.buildDestructibleObstacles()` instantiates 20 `DestructibleCrate` instances into `this.destructibleCrates`.
  - When smashed, `DestructibleCrate.ts:81` schedules a 45,000ms delayed timer:
    ```typescript
    this.respawnTimer = this.scene.time.delayedCall(this.RESPAWN_DELAY_MS, () => { this.respawnCrate(); });
    ```
- **File**: `src/scenes/JunkyardScene.ts:187-192`
  - `this.respawnTimer = this.time.addEvent({ delay: 1500, loop: true, ... });` runs every 1.5s.
- **File**: `src/scenes/JunkyardScene.ts:164`
  - `this.scrapPool = new ScrapPool(this);` allocates 200 pooled entities.
- **File**: `src/entities/PlayerRover.ts:286-307`
  ```typescript
  const junkyard = this.scene as any;
  if (junkyard && junkyard.roverDustEmitter) {
    junkyard.roverDustEmitter.emitParticleAt(...);
  }
  ```
  If `roverDustEmitter.destroy()` is called but `junkyard.roverDustEmitter` is not set to `null`/falsy, `emitParticleAt` throws an unhandled `TypeError` during trailing update frames.

### 1.4 Challenger Unit Test Assertion
- **File**: `tests/unit/adversarial-m1-perf-memory.test.ts:355-356`
  ```typescript
  const hasShutdownListener = /this\.events\.(?:on|once)\(\s*['"]shutdown['"]/.test(source);
  expect(hasShutdownListener).toBe(false);
  ```
  `challenger_m1_2_r2` wrote this assertion to empirically prove that `this.events.on('shutdown', ...)` was absent. Once the fix is applied, this assertion must be updated to `toBe(true)` to avoid a test failure.

---

## 2. Logic Chain

1. **Premise 1**: In Phaser 3, scenes are notified of shutdown strictly via the `'shutdown'` event emitted on `scene.events` (`Systems.js:785`). Phaser does not invoke a method named `shutdown()` automatically.
2. **Premise 2**: `JunkyardScene.create()` contains no registration of `this.events.on('shutdown', this.shutdown, this)`.
3. **Deduction 1**: `JunkyardScene.prototype.shutdown()` never runs during scene transitions or restarts. Therefore, all 5 particle emitters (`sparkEmitter`, `pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`, `recyclerSteamEmitter`), the 200-item scrap pool, the 1.5s respawn timer, and all 45-second crate respawn timers continue running and leaking in memory.
4. **Premise 3**: When `scene.restart()` is called, Phaser reuses the same scene instance and calls `create()` again.
5. **Premise 4**: `challengeManager.on()`, `achievementManager.on()`, `comboManager.on()`, and `this.events.on('achievement-trigger')` add listeners to internal collections without clearing prior listeners.
6. **Deduction 2**: Every scene restart adds duplicate listeners. A player completing 1 challenge after 2 restarts receives 3x coins and 3x audio notifications.
7. **Resolution**:
   - Register `this.events.on('shutdown', this.shutdown, this)` in `JunkyardScene.create()`.
   - Store unsubscribe callbacks returned by `challengeManager.on()`, `achievementManager.on()`, and `comboManager.on()`, and unbind them in `shutdown()` and before re-subscribing in `create()`.
   - Use a stable bound class method `handleAchievementTrigger` and unbind `this.events.off('achievement-trigger', ...)` in `shutdown()`.
   - In `shutdown()`, destroy all 5 emitters and set their references to `null as any`.
   - Destroy all crates in `this.destructibleCrates` (which cancels their active 45s respawn timers and kills tweens) and empty the array.
   - Destroy `this.respawnTimer`, call `this.time.removeAllEvents()`, destroy `this.scrapPool`, and null out references.
   - Update `tests/unit/adversarial-m1-perf-memory.test.ts:356` to assert `expect(hasShutdownListener).toBe(true)`.

---

## 3. Detailed Remediation Plan & Exact Code Specifications

### Change 1: Class Property Declarations in `src/scenes/JunkyardScene.ts`
**Location**: Lines 36-37 (right after `destructibleCrates`)
**Action**: Add handles for tracking listener unsubscriptions.

```typescript
<<<< BEFORE (Line 36)
  public destructibleCrates: DestructibleCrate[] = [];
====
  public destructibleCrates: DestructibleCrate[] = [];

  // Event unhook & cleanup handles to prevent listener accumulation on restart
  private challengeUnsubscribe?: () => void;
  private achievementUnsubscribe?: () => void;
  private comboUnsubscribes: (() => void)[] = [];
>>>> AFTER
```

---

### Change 2: Register Lifecycle Shutdown Hook in `create()`
**Location**: Line 96, immediately at the beginning of `create()`.
**Verification of exact line placement**: Placing the shutdown registration at the very top of `create()` (before audio initialization, persistence loading, or pool allocations) guarantees that if the scene encounters any initialization error or rapid shutdown, the handler is already in place.

```typescript
<<<< BEFORE (Lines 96-98)
  create(): void {
    this.audioService = ProceduralAudioService.getInstance();
    this.audioService.init();
====
  create(): void {
    // 0a. Hook Phaser 3 Scene shutdown lifecycle event (guarantees execution on scene.stop / scene.restart)
    this.events.off('shutdown', this.shutdown, this);
    this.events.on('shutdown', this.shutdown, this);

    this.audioService = ProceduralAudioService.getInstance();
    this.audioService.init();
>>>> AFTER
```

---

### Change 3: Unhook & Prevent Duplicate Listeners on `challengeManager`, `achievementManager`, and `achievement-trigger`
**Location**: Lines 126-153 in `JunkyardScene.ts`.
**Action**: Clean up existing subscriptions before re-attaching, store unsubscribe functions, and replace anonymous arrow function with stable bound method `handleAchievementTrigger`.

```typescript
<<<< BEFORE (Lines 126-153)
    // Wire Challenge & Achievement Listeners
    this.challengeManager.on((state, completed) => {
      if (completed) {
        this.coins += completed.rewardCoins;
        this.audioService.playCoinClink(1.6);
        this.events.emit('buff-activated', `🎯 CHALLENGE COMPLETE: +${completed.rewardCoins} 🪙!`);
        this.events.emit('coins-updated', this.coins);
        this.saveGameState();
      }
      this.events.emit('challenge-updated', state);
    });

    this.achievementManager.on((ach, reward) => {
      this.coins += reward;
      this.audioService.playFanfare();
      this.events.emit('buff-activated', `🏆 ACHIEVEMENT: ${ach.title} (+${reward} 🪙)!`);
      this.events.emit('coins-updated', this.coins);
      this.saveGameState();
    });

    // Wire Hazard achievement trigger listener
    this.events.on('achievement-trigger', (id: string) => {
      this.achievementManager.unlock(id);
      if (id === 'critter_repelled') this.crittersRepelled++;
      if (id === 'emp_survivor') this.empMineHits++;
      this.saveGameState();
    });
====
    // Wire Challenge & Achievement Listeners (with idempotent unhooking)
    if (this.challengeUnsubscribe) {
      this.challengeUnsubscribe();
    }
    this.challengeUnsubscribe = this.challengeManager.on((state, completed) => {
      if (completed) {
        this.coins += completed.rewardCoins;
        this.audioService.playCoinClink(1.6);
        this.events.emit('buff-activated', `🎯 CHALLENGE COMPLETE: +${completed.rewardCoins} 🪙!`);
        this.events.emit('coins-updated', this.coins);
        this.saveGameState();
      }
      this.events.emit('challenge-updated', state);
    });

    if (this.achievementUnsubscribe) {
      this.achievementUnsubscribe();
    }
    this.achievementUnsubscribe = this.achievementManager.on((ach, reward) => {
      this.coins += reward;
      this.audioService.playFanfare();
      this.events.emit('buff-activated', `🏆 ACHIEVEMENT: ${ach.title} (+${reward} 🪙)!`);
      this.events.emit('coins-updated', this.coins);
      this.saveGameState();
    });

    // Wire Hazard achievement trigger listener using stable bound handler
    this.events.off('achievement-trigger', this.handleAchievementTrigger, this);
    this.events.on('achievement-trigger', this.handleAchievementTrigger, this);
>>>> AFTER
```

Add the bound method to `JunkyardScene`:
```typescript
  private handleAchievementTrigger(id: string): void {
    this.achievementManager.unlock(id);
    if (id === 'critter_repelled') this.crittersRepelled++;
    if (id === 'emp_survivor') this.empMineHits++;
    this.saveGameState();
  }
```

---

### Change 4: Unhook & Prevent Duplicate Listeners on `comboManager`
**Location**: Lines 194-231 in `JunkyardScene.ts`.
**Action**: Unsubscribe previous combo listeners and store new unsubscribe handles.

```typescript
<<<< BEFORE (Lines 194-231)
    // 9. Wire Combo & Fever Mode State Machine
    this.comboManager.on('fever-started', (state) => {
      this.triggerScreenShake(300, 0.012);
      this.audioService.playFeverFanfare();
      this.abilityManager.resetCooldown();
      if (this.playerRover) {
        this.playerRover.setFever(true);
        this.showFloatingText(
          this.playerRover.x,
          this.playerRover.y - 35,
          '🔥 FEVER MODE! 5x COINS & PULSE RESET! 🔥',
          '#ff007f',
          18
        );
      }
      this.events.emit('fever-started', state);
      TestBridge.recordEvent('fever-started', state);
    });

    this.comboManager.on('fever-ended', (state) => {
      if (this.playerRover) {
        this.playerRover.setFever(false);
      }
      this.audioService.setComboPitchModifier(1.0);
      this.events.emit('fever-ended', state);
      TestBridge.recordEvent('fever-ended', state);
    });

    this.comboManager.on('combo-expired', (state) => {
      this.audioService.setComboPitchModifier(1.0);
      this.events.emit('combo-expired', state);
      TestBridge.recordEvent('combo-expired', state);
    });

    this.comboManager.on('combo-updated', (state) => {
      this.events.emit('combo-updated', state);
    });
====
    // 9. Wire Combo & Fever Mode State Machine (with unhook tracking)
    for (const unsub of this.comboUnsubscribes) {
      unsub();
    }
    this.comboUnsubscribes = [];

    this.comboUnsubscribes.push(
      this.comboManager.on('fever-started', (state) => {
        this.triggerScreenShake(300, 0.012);
        this.audioService.playFeverFanfare();
        this.abilityManager.resetCooldown();
        if (this.playerRover) {
          this.playerRover.setFever(true);
          this.showFloatingText(
            this.playerRover.x,
            this.playerRover.y - 35,
            '🔥 FEVER MODE! 5x COINS & PULSE RESET! 🔥',
            '#ff007f',
            18
          );
        }
        this.events.emit('fever-started', state);
        TestBridge.recordEvent('fever-started', state);
      }),
      this.comboManager.on('fever-ended', (state) => {
        if (this.playerRover) {
          this.playerRover.setFever(false);
        }
        this.audioService.setComboPitchModifier(1.0);
        this.events.emit('fever-ended', state);
        TestBridge.recordEvent('fever-ended', state);
      }),
      this.comboManager.on('combo-expired', (state) => {
        this.audioService.setComboPitchModifier(1.0);
        this.events.emit('combo-expired', state);
        TestBridge.recordEvent('combo-expired', state);
      }),
      this.comboManager.on('combo-updated', (state) => {
        this.events.emit('combo-updated', state);
      })
    );
>>>> AFTER
```

---

### Change 5: Complete `shutdown()` Implementation
**Location**: Lines 1142-1174 in `JunkyardScene.ts`.
**Action**: Ensure complete unhooking, emitter destruction + reference nulling, timer destruction, crate disposal, and pool cleanup.

```typescript
<<<< BEFORE (Lines 1142-1174)
  public shutdown(): void {
    if (this.respawnTimer) {
      this.respawnTimer.destroy();
    }
    if (this.scrapPool) {
      this.scrapPool.destroy();
    }
    if (this.sparkEmitter) {
      this.sparkEmitter.destroy();
    }
    if (this.pulseSparkEmitter) {
      this.pulseSparkEmitter.destroy();
    }
    if (this.crateDebrisEmitter) {
      this.crateDebrisEmitter.destroy();
    }
    if (this.roverDustEmitter) {
      this.roverDustEmitter.destroy();
    }
    if (this.recyclerSteamEmitter) {
      this.recyclerSteamEmitter.destroy();
    }
    if (this.destructibleCrates) {
      for (const crate of this.destructibleCrates) {
        crate.destroy();
      }
      this.destructibleCrates = [];
    }
    this.comboManager.reset();
    if (this.audioService) {
      this.audioService.stopAll();
    }
  }
====
  public shutdown(): void {
    // 1. Unhook scene shutdown listener itself
    this.events.off('shutdown', this.shutdown, this);

    // 2. Unhook event listeners on managers and scene events
    if (this.challengeUnsubscribe) {
      this.challengeUnsubscribe();
      this.challengeUnsubscribe = undefined;
    }
    if (this.achievementUnsubscribe) {
      this.achievementUnsubscribe();
      this.achievementUnsubscribe = undefined;
    }
    for (const unsub of this.comboUnsubscribes) {
      unsub();
    }
    this.comboUnsubscribes = [];
    this.events.off('achievement-trigger', this.handleAchievementTrigger, this);

    // 3. Timers cleanup (1.5s respawn interval and any pending scene clock timers)
    if (this.respawnTimer) {
      this.respawnTimer.destroy();
      this.respawnTimer = null as any;
    }
    if (this.time) {
      this.time.removeAllEvents();
    }

    // 4. Scrap pool cleanup (destroys 200 items, arcade bodies, and group)
    if (this.scrapPool) {
      this.scrapPool.destroy();
      this.scrapPool = null as any;
    }

    // 5. Particle emitters cleanup & nulling to prevent stale reference access
    if (this.sparkEmitter) {
      this.sparkEmitter.destroy();
      this.sparkEmitter = null as any;
    }
    if (this.pulseSparkEmitter) {
      this.pulseSparkEmitter.destroy();
      this.pulseSparkEmitter = null as any;
    }
    if (this.crateDebrisEmitter) {
      this.crateDebrisEmitter.destroy();
      this.crateDebrisEmitter = null as any;
    }
    if (this.roverDustEmitter) {
      this.roverDustEmitter.destroy();
      this.roverDustEmitter = null as any;
    }
    if (this.recyclerSteamEmitter) {
      this.recyclerSteamEmitter.destroy();
      this.recyclerSteamEmitter = null as any;
    }

    // 6. Destructible crates and active 45s respawn timers cleanup
    if (this.destructibleCrates) {
      for (const crate of this.destructibleCrates) {
        crate.destroy();
      }
      this.destructibleCrates = [];
    }

    // 7. Reset combo state and audio
    this.comboManager.reset();
    if (this.audioService) {
      this.audioService.stopAll();
    }
  }
>>>> AFTER
```

---

### Change 6 (Companion Fix): Settings Preservation in `saveGameState()`
**Location**: Lines 1100-1107 in `JunkyardScene.ts`.
**Action**: Merge saved settings instead of hardcoding default volume/input values.

```typescript
<<<< BEFORE (Lines 1100-1107)
      settings: {
        sfxVolume: 0.8,
        musicVolume: 0.6,
        touchControls: true,
        hapticFeedback: true,
        screenShake: this.screenShakeEnabled,
      },
====
      settings: {
        ...(SaveManager.getInstance().load().settings || {
          sfxVolume: 0.8,
          musicVolume: 0.6,
          touchControls: true,
          hapticFeedback: true,
        }),
        screenShake: this.screenShakeEnabled,
      },
>>>> AFTER
```

---

### Change 7: Test Harness Assertion Update
**Location**: `tests/unit/adversarial-m1-perf-memory.test.ts:356`
**Action**: Update expected assertion from `toBe(false)` to `toBe(true)`.

```typescript
<<<< BEFORE (Lines 354-356)
    // EMPIRICAL DEFECT: JunkyardScene never attaches this.shutdown to this.events!
    const hasShutdownListener = /this\.events\.(?:on|once)\(\s*['"]shutdown['"]/.test(source);
    expect(hasShutdownListener).toBe(false);
====
    // EMPIRICAL VERIFICATION: JunkyardScene correctly attaches this.shutdown to this.events!
    const hasShutdownListener = /this\.events\.(?:on|once)\(\s*['"]shutdown['"]/.test(source);
    expect(hasShutdownListener).toBe(true);
>>>> AFTER
```

---

## 4. Caveats

1. **Test Double Isolation**: Some existing unit tests create ad-hoc mock scenes with hardcoded shapes instead of instantiating `new JunkyardScene()`. Unit test assertions checking `expect(mockScene.pulseSparkEmitter.destroy).toHaveBeenCalled()` will remain valid because the method signature and contract of `shutdown()` is strictly preserved and augmented.
2. **RivalScavenger Smoke Puff**: `RivalScavenger.ts:118-130` dynamically allocates a `smoke_particle` emitter and 700ms delayedCall on spawn and despawn. While `JunkyardScene` shutdown handles all world scene objects, the implementer of Milestone 1 polish may also route smoke puffs through a pre-allocated emitter on `JunkyardScene` (e.g. `roverDustEmitter` or a dedicated `smokeEmitter`) to completely satisfy zero-runtime allocations in hot loops.
3. **No Breaking Changes**: All public properties and event contracts (`coins-updated`, `tier-updated`, `buff-activated`, `challenge-updated`, etc.) remain identical. No interface changes exist between `JunkyardScene` and `UIScene`.

---

## 5. Conclusion

1. The critical root cause of particle emitter leaks, un-disposed 45s crate timers, and scrap pool leaks is the missing `this.events.on('shutdown', this.shutdown, this)` in `JunkyardScene.create()`.
2. The root cause of duplicated rewards on scene restart is that `challengeManager`, `achievementManager`, `comboManager`, and `achievement-trigger` anonymous listeners were never unsubscribed upon scene teardown.
3. The proposed remediation fixes both defects comprehensively, with idempotent registration in `create()` and complete, leak-free disposal in `shutdown()`.
4. Applying `junkyard_scene_lifecycle.patch` and updating `adversarial-m1-perf-memory.test.ts:356` will resolve all M1 Gate rejection criteria.

---

## 6. Verification Method

To verify the remediation:
1. **Source Inspection**:
   Inspect `src/scenes/JunkyardScene.ts`:
   - Verify `this.events.on('shutdown', this.shutdown, this)` is present in `create()`.
   - Verify `this.challengeUnsubscribe`, `this.achievementUnsubscribe`, and `this.comboUnsubscribes` are tracked and called in `shutdown()`.
   - Verify `this.events.off('achievement-trigger', ...)` is executed in `shutdown()`.
   - Verify all 5 emitters, `respawnTimer`, `scrapPool`, and `destructibleCrates` are destroyed in `shutdown()`.
2. **Automated Unit Tests**:
   Execute:
   ```bash
   npx vitest run tests/unit/adversarial-m1-perf-memory.test.ts
   npx vitest run tests/unit/adversarial-m1-gamefeel.test.ts
   npm test
   ```
   All 15 test files and 238+ tests must pass with exit code 0.
3. **Build & Bundle Size Verification**:
   Execute:
   ```bash
   npm run build
   ```
   Must compile cleanly with zero TypeScript errors and maintain a bundle size strictly under 10MB.
