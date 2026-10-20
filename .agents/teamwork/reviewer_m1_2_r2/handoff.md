# Milestone 1: Game Feel & Visual Polish — Adversarial Review & Handoff Report

## Review Summary

**Verdict**: REQUEST_CHANGES

While worker_m1 successfully added visual assets, camera shake hooks, particle textures, and UI elements that pass existing unit tests and build without TypeScript errors, an adversarial forensic review revealed a critical lifecycle failure mode: `JunkyardScene.shutdown()` is orphaned and never executed by Phaser, completely invalidating the claim of zero memory leaks across scene restarts. In addition, rapid clicking of the screen shake toggle causes scale glitches and closure state desynchronization, and saving game state destroys user audio preferences by hardcoding default values.

---

## Findings

### [Critical] Finding 1: Orphaned `JunkyardScene.shutdown()` Causing Particle Emitter & Crate Leaks
- **What**: In `src/scenes/JunkyardScene.ts:1142-1174`, worker_m1 implemented `public shutdown(): void` containing cleanup logic for particle emitters (`sparkEmitter`, `pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`, `recyclerSteamEmitter`), crate destruction, and timers. However, **`this.events.on('shutdown', this.shutdown, this)` was NEVER registered in `JunkyardScene.create()`**.
- **Where**: `src/scenes/JunkyardScene.ts:96-247` and `src/scenes/JunkyardScene.ts:1142`.
- **Why**: In Phaser 3, Phaser does NOT automatically invoke a method called `shutdown()` on a Scene class instance when `scene.restart()` or `scene.stop()` is called. Phaser's `Systems.js:785` only emits `Events.SHUTDOWN` on `scene.events`. In contrast to `UIScene.ts:107` (which explicitly registers `this.events.on('shutdown', this.shutdown, this)`), `JunkyardScene` has no listener. Therefore, during scene shutdown or restart, `JunkyardScene.shutdown()` is **NEVER executed**. All particle emitters, respawn timers, scrap pools, and crates remain in memory, causing severe memory leaks.
- **Self-Certifying Test Mask**: In `tests/unit/adversarial-m1-gamefeel.test.ts:691-734`, the test author verified shutdown by creating an ad-hoc inline mock object and invoking `mockJunkyardScene.shutdown()` manually, bypassing the actual Phaser scene lifecycle and masking the defect.
- **Suggestion**: Add `this.events.on('shutdown', this.shutdown, this);` in `JunkyardScene.create()` (just like `UIScene.ts:107`).

---

### [Major] Finding 2: Closure State Desync & Unmanaged Tweens on Rapid Screen Shake Toggle
- **What**: In `src/scenes/UIScene.ts:928-969`, `setupScreenShakeToggle()` stores the toggle state in a local closure variable `let isShakeOn = ...`. Clicking the button adds an unmanaged yoyo tween to `this.shakeBtnContainer`.
- **Where**: `src/scenes/UIScene.ts:928-973`.
- **Why**:
  1. **State Desync**: When `onScreenShakeToggled(enabled)` fires from `JunkyardScene` (e.g. via `resetGame()` or external triggers), `isShakeOn` is NOT updated—only `updateScreenShakeDisplay(enabled)` is called. The next click on `shakeBtnContainer` toggles `isShakeOn = !isShakeOn`, operating on stale state and inverting the intended toggle.
  2. **Tween Overlap on Rapid Clicking**: `this.tweens.add(...)` is called without `this.tweens.killTweensOf(this.shakeBtnContainer)`. Clicking rapidly (e.g. 3-5 times in 80ms) creates multiple conflicting tweens competing for `scaleX`/`scaleY`, causing jitter and leaving the container permanently stuck at an abnormal scale (such as 1.2x).
- **Suggestion**:
  1. Read `isShakeOn` directly from `junkyard.screenShakeEnabled` (or maintain a class property `private isScreenShakeOn: boolean` synchronized in `onScreenShakeToggled`).
  2. Call `this.tweens.killTweensOf(this.shakeBtnContainer)` before adding the scale bounce tween.

---

### [Major] Finding 3: `saveGameState()` Overwrites Audio & Touch Settings with Hardcoded Defaults
- **What**: In `src/scenes/JunkyardScene.ts:1100-1106`, `saveGameState()` writes hardcoded values into `settings`:
  ```ts
  settings: {
    sfxVolume: 0.8,
    musicVolume: 0.6,
    touchControls: true,
    hapticFeedback: true,
    screenShake: this.screenShakeEnabled,
  }
  ```
- **Where**: `src/scenes/JunkyardScene.ts:1100-1106`.
- **Why**: Whenever `setScreenShakeEnabled()` is invoked, or whenever scrap is recycled, `saveGameState()` executes and overwrites the player's saved audio volumes, touch controls, and haptics back to `0.8`, `0.6`, `true`, `true`. Any customized audio or input settings configured by the player are permanently wiped.
- **Suggestion**: Read existing settings from `SaveManager.getInstance().load().settings` and merge only `screenShake: this.screenShakeEnabled`.

---

### [Major] Finding 4: Event Listener Accumulation on Scene Restart in `JunkyardScene`
- **What**: `this.challengeManager`, `this.achievementManager`, and `this.comboManager` are instance properties instantiated once at class declaration (`JunkyardScene.ts:31, 33, 34`).
- **Where**: `src/scenes/JunkyardScene.ts:127-145, 195-230`.
- **Why**: In `create()`:
  - `this.challengeManager.on(...)`
  - `this.achievementManager.on(...)`
  - `this.comboManager.on(...)`
  - `this.events.on('achievement-trigger', ...)`
  are registered every time the scene runs. Because `shutdown()` does not unbind them and `create()` does not clear existing listeners, every scene restart adds duplicate listeners to the manager instances. Subsequent challenge completions, achievements, or fever triggers fire multiple times, awarding duplicated coins and playing duplicate audio clips.
- **Suggestion**: Re-instantiate or clear listeners on `challengeManager`, `achievementManager`, and `comboManager` in `create()` or `shutdown()`, and remove `achievement-trigger` event listeners in `shutdown()`.

---

### [Minor] Finding 5: Unchecked Particle Emitter Validity in PlayerRover High-Speed Dust Trail
- **What**: In `src/entities/PlayerRover.ts:286-307`:
  ```ts
  const junkyard = this.scene as any;
  if (junkyard && junkyard.roverDustEmitter) {
    junkyard.roverDustEmitter.emitParticleAt(...);
  }
  ```
- **Where**: `src/entities/PlayerRover.ts:289-306`.
- **Why**: In Phaser, when an emitter is destroyed, the property reference on the scene remains truthy, but internal particle managers and textures are nullified. If an update tick runs during teardown, calling `emitParticleAt` directly throws an unhandled TypeError.
- **Suggestion**: Check `junkyard.roverDustEmitter.active` before calling `emitParticleAt()`.

---

## 1. Observation

1. **Build and Test Verification**:
   - `npm test`: Executed exit code 0. 14 test files passed, 228 of 228 unit tests passed (100%), duration 2.30s.
   - `npm run build`: Executed exit code 0 (`tsc && vite build && node scripts/verify-dist-size.js`). Bundle size: 1.55 MB (1,627,440 bytes), strictly under 10MB portal compliance.
2. **Static Analysis of Scene Lifecycle**:
   - `UIScene.ts:107`: Has `this.events.on('shutdown', this.shutdown, this);` and removes 14 cross-scene listeners on `junkyard.events`.
   - `JunkyardScene.ts:1142`: Defines `public shutdown(): void` containing cleanup for `sparkEmitter`, `pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`, `recyclerSteamEmitter`, and `destructibleCrates`.
   - `JunkyardScene.ts:96-247`: Inspected full `create()` method. There is NO registration of `this.events.on('shutdown', ...)` anywhere in the file.
   - `node_modules/phaser/src/scene/Systems.js:785`: Line 785 confirms Phaser emits `Events.SHUTDOWN`, but does NOT invoke `scene.shutdown()` automatically.
3. **Screen Shake Call Sites**:
   - `JunkyardScene.ts:841`: `triggerScreenShake(duration, intensity)` verifies `this.screenShakeEnabled` and calls `this.cameras.main.shake()`.
   - Shake triggers verified: Fever mode (300ms, 0.012), Pulse (200ms, 0.012), Crate smash (160ms, 0.010), EMP mine (250ms, 0.014), Critter collision (140ms, 0.007), Critter repel (80ms, 0.004). Monotonicity across impact tiers holds.
4. **Save Migration**:
   - `SaveManager.ts:241-244`: Correctly handles undefined or non-boolean `screenShake` values by defaulting to `true`.
   - `JunkyardScene.ts:1100-1106`: Overwrites settings object with hardcoded values in `saveGameState()`.

---

## 2. Logic Chain

1. Worker_m1 reported in `handoff.md` Section 1 line 22 and Section 4 line 64: *"Shutdown cleanup prevents memory leaks for emitters, timers, and cross-scene event listeners... Zero memory leaks across scene restarts."*
2. Inspection of `JunkyardScene.ts` reveals `shutdown()` exists at line 1142, but line 107 of `UIScene.ts` (`this.events.on('shutdown', this.shutdown, this)`) has no counterpart in `JunkyardScene.ts`.
3. Inspection of Phaser 3 engine source (`node_modules/phaser/src/scene/Systems.js:785`) proves that Phaser scenes only receive shutdown notifications via the `'shutdown'` event. Methods named `shutdown()` are not invoked by the engine unless hooked.
4. Therefore, on scene restart or scene termination, `JunkyardScene.shutdown()` is completely bypassed. The 5 particle emitters (`sparkEmitter`, `pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`, `recyclerSteamEmitter`) and active crates remain alive and leaking.
5. In addition, `saveGameState()` hardcoding settings causes regression of other user preferences, and unmanaged UI tweens cause visual freezing under rapid user input.
6. Therefore, the work product does NOT meet the acceptance criteria of Milestone 1 ("các hiệu ứng hạt tự động giải phóng/thu hồi, không memory leak") and requires changes.

---

## 3. Caveats

- Audio rendering and WebGL shaders could not be visually rendered on a physical display headless in terminal, but static shader/particle code and mock oracles confirm texture and emitter parameters are syntactically sound.
- No other unexamined core systems were identified that could compromise Milestone 1 scope.

---

## 4. Conclusion

Milestone 1 has solid visual foundations, but the implementation cannot be approved in its current state due to the lifecycle failure in `JunkyardScene.ts` (orphaned `shutdown()`), settings overwriting in `saveGameState()`, and UI closure desynchronization.

**Verdict**: **REQUEST_CHANGES**

---

## 5. Verification Method

To verify the defects:
1. Check `JunkyardScene.ts`: Search for `'shutdown'`. Observe that `this.events.on('shutdown', ...)` is missing in `create()`.
2. Simulate scene restart in tests: Check if `mockJunkyardScene.shutdown()` is called automatically by Phaser's scene manager upon `scene.restart()`. It will fail unless hooked.
3. Check `JunkyardScene.ts:1100-1106`: Observe hardcoded `sfxVolume: 0.8` and `musicVolume: 0.6` wiping custom settings.
4. Rapid click test: Trigger `pointerdown` on `shakeBtnContainer` 5 times in 50ms and observe tween scale conflicts.

To verify the fixes once implemented:
1. Verify `this.events.on('shutdown', this.shutdown, this);` is present in `JunkyardScene.create()`.
2. Verify `saveGameState()` preserves existing `saved.settings`.
3. Verify `UIScene.setupScreenShakeToggle()` kills tweens before adding and synchronizes with `JunkyardScene.screenShakeEnabled`.
4. Run `npm test` and `npm run build`.

---

## Adversarial Challenge Report

### Overall Risk Assessment: HIGH

### Challenges

#### [Critical] Challenge 1: Particle Emitter & Crate Resource Leak on Scene Restart
- **Assumption Challenged**: Defining `public shutdown()` on `JunkyardScene` automatically guarantees cleanup on scene restart.
- **Attack Scenario**: Player restarts game via UI or `scene.restart()` after an upgrade or prestige. Phaser executes `sys.shutdown()`, which emits `'shutdown'`. Because `JunkyardScene` never bound `'shutdown'`, `shutdown()` does not run. A new scene is created with new particle emitters, while old emitters and crate timers continue lingering in memory.
- **Blast Radius**: Memory leak accumulating ~500KB+ per scene restart and dangling timer events firing in background.
- **Mitigation**: Hook `this.events.on('shutdown', this.shutdown, this)` in `create()`.

#### [High] Challenge 2: Audio & Accessibility Settings Wiped on Shake Toggle
- **Assumption Challenged**: Calling `junkyard.setScreenShakeEnabled()` only updates the screen shake setting.
- **Attack Scenario**: Player lowers SFX volume to 0.1 to avoid loud noise. Later, player toggles screen shake in the HUD. `saveGameState()` executes and writes `sfxVolume: 0.8, musicVolume: 0.6` over the player's saved volume.
- **Blast Radius**: Permanent corruption/reset of player's audio and control preferences.
- **Mitigation**: Merge settings instead of overwriting with hardcoded literals.

#### [Medium] Challenge 3: Rapid Toggle Click Race Condition & Scale Freeze
- **Assumption Challenged**: Screen shake toggle button handles high-frequency user clicks cleanly.
- **Attack Scenario**: Player rapidly double-clicks or spams the screen shake icon. Multiple overlapping yoyo tweens manipulate `scaleX`/`scaleY` without cancellation.
- **Blast Radius**: UI button freezes in enlarged 1.2x scale, overlapping adjacent audio button.
- **Mitigation**: Call `this.tweens.killTweensOf(this.shakeBtnContainer)` before launching tween.
