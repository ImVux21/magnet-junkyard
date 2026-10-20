# Survey Report: Game Feel & Visual Polish Architecture

**Date**: 2026-09-26  
**Investigator**: Explorer 1 (`teamwork_preview_explorer`)  
**Project**: Magnet Junkyard (Phaser 3.88.2 + TypeScript + Vite)  
**Objective**: Comprehensive survey of the codebase for Screen Shake, Particle Systems, UI Toggles, and Action Polish/Juice per `prompt_draft.md` and the `game-feel` skill.

---

## 1. Executive Summary

The current implementation of *Magnet Junkyard* features solid core arcade mechanics (kinematic steering, zero-GC scrap pooling, dynamic fever combos, destructible crates, and hazards), but visual and tactile feedback ("juice") remains sparse and uneven:
1. **Screen Shake**: Only 3 hardcoded `cameras.main.shake()` calls exist (`JunkyardScene.ts:192, 813` and `DestructibleCrate.ts:38`). Critical high-impact moments (EMP Mine blasts, Scrap Critter collisions/cargo ejections, low-speed crate impacts) have zero camera shake. Crucially, **no setting or toggle exists** to disable camera shake, violating accessibility and motion sickness standards.
2. **Settings & Persistence**: `SaveManager.ts` (Schema V2) tracks player upgrades, stats, and audio/control settings, but does NOT include a `screenShake` setting. The UI in `UIScene.ts` provides an audio mute toggle on the HUD, but lacks a Screen Shake toggle.
3. **Particle Systems**: The project has basic emitters for compactor crunch (`sparkEmitter`) and thermal steam (`recyclerSteamEmitter`). However:
   - Magnetic Pulse emits NO sparks (only a 2D line graphic).
   - Destructible Pinata Crates currently reuse yellow compactor metal sparks instead of wooden/metal debris splinters.
   - High-speed rover movement emits NO dust/smoke puffs along its tracks.
   - `RivalScavenger.ts` dynamically creates and destroys a particle emitter on demand via `time.delayedCall`, which creates GC pressure. A centralized, pre-allocated persistent emitter architecture in `JunkyardScene` with zero dynamic allocations is required to prevent memory leaks and maintain 60 FPS.
4. **Action Polish & Punchiness**: Scrap pickups and upgrade purchases currently execute with instant numerical updates and sound effects, but lack physical deformation (squash & stretch / pop tweens), sparkle bursts, or HUD bar bounces as specified in the `game-feel` skill.

---

## 2. Deep Dive: Camera System & Screen Shake Hooks

### 2.1 Current Camera Architecture
- **Location**: `src/scenes/JunkyardScene.ts` lines 171–173.
- **Implementation**:
  ```ts
  this.cameras.main.setBounds(0, 0, GAME_CONSTANTS.WORLD_WIDTH, GAME_CONSTANTS.WORLD_HEIGHT);
  this.cameras.main.startFollow(this.playerRover, true, 0.08, 0.08);
  ```
  Phaser 3's built-in `cameras.main` follows the rover with smooth linear interpolation (`lerp: 0.08`).

### 2.2 Existing Shake Invocations
Only three places trigger `this.cameras.main.shake()`:
1. `src/scenes/JunkyardScene.ts:192` (Fever Mode Started):
   ```ts
   this.comboManager.on('fever-started', (state) => {
     if (this.cameras && this.cameras.main) {
       this.cameras.main.shake(300, 0.012);
     }
   ```
2. `src/scenes/JunkyardScene.ts:813` (Magnetic Pulse Ability):
   ```ts
   public triggerMagneticPulse(): boolean {
     ...
     if (this.cameras && this.cameras.main) {
       this.cameras.main.shake(200, 0.012);
     }
   ```
3. `src/entities/hazards/DestructibleCrate.ts:38` (Crate Destruction):
   ```ts
   public breakCrate(junkyard: JunkyardScene, _byPulse: boolean = false): void {
     ...
     if (junkyard.cameras && junkyard.cameras.main) {
       junkyard.cameras.main.shake(120, 0.008);
     }
   ```

### 2.3 Missing Shake Hooks & Opportunities
| Event / Impact | File & Location | Current Behavior | Recommended Shake (Duration / Intensity) | Rationale |
|---|---|---|---|---|
| **EMP Mine Detonation** | `src/entities/hazards/EMPMine.ts:73-99` & `src/entities/hazards/HazardManager.ts:148-158` | Audio blast, disables magnet for 3s, dumps 30% cargo, shockwave graphic. **No camera shake!** | **250ms / 0.014** (Tier: Heavy) | Severe penalty and violent shockwave. Without shake, the blast feels weak and disconnected. |
| **Scrap Critter Attack (Hit Rover)** | `src/entities/hazards/HazardManager.ts:127-135` & `src/entities/hazards/ScrapCritter.ts:104-113` | Squeak audio, dumps 1-2 items from cargo, knocks critter back. **No camera shake!** | **140ms / 0.007** (Tier: Medium) | Direct physical collision that unseats cargo. Needs tactile jolt. |
| **Scrap Critter Repelled (Wave Defense)** | `src/entities/hazards/HazardManager.ts:122-125` & `src/entities/hazards/ScrapCritter.ts:98-102` | Squeak audio, repels critter at 450 px/s. **No camera shake!** | **80ms / 0.004** (Tier: Light) | Micro-vibration confirms successful magnetic repulsion. |
| **Low-Speed Rover/Crate Bump** | `src/scenes/JunkyardScene.ts:889-897` | When `roverSpeed < 90`, Arcade physics resolves collision without any sound, shake, or juice. | **60ms / 0.003** (Tier: Micro) + soft metallic thud | Gives weight to the rover when bumping into crates without destroying them. |
| **Pinata Crate Smash** | `src/entities/hazards/DestructibleCrate.ts:38` | Has `shake(120, 0.008)`. Can be upgraded to **160ms / 0.010** paired with a 35ms micro hit-stop freeze. | **160ms / 0.010** (Tier: Medium-Heavy) | Smashes the wooden crate into pieces; feels punchier. |
| **Recycler Heavy Batch Finish** | `src/scenes/JunkyardScene.ts:612-641` | When cargo batch reaches 0kg and initiates cooldown. | **100ms / 0.006** (Tier: Light) | Final compactor seal and steam release. |

### 2.4 Recommended Centralized Shake Architecture
Add a public method to `JunkyardScene`:
```ts
public triggerScreenShake(duration: number = 150, intensity: number = 0.01): void {
  if (!this.screenShakeEnabled) return;
  if (this.cameras && this.cameras.main) {
    this.cameras.main.shake(duration, intensity);
  }
}
```
All scenes and entities (`DestructibleCrate`, `HazardManager`, `EMPMine`) must call `junkyard.triggerScreenShake()` instead of directly accessing `cameras.main.shake()`.

---

## 3. Deep Dive: Screen Shake Toggle & UI/Settings Integration

### 3.1 Persistence & Data Schema
In `src/services/persistence/SaveManager.ts`:
1. **Extend `PlayerSettings` Interface**:
   ```ts
   export interface PlayerSettings {
     sfxVolume: number;
     musicVolume: number;
     touchControls: boolean;
     hapticFeedback: boolean;
     screenShake: boolean; // New setting (default: true)
   }
   ```
2. **Update `DEFAULT_SAVE_DATA_V2`**:
   ```ts
   settings: {
     sfxVolume: 0.8,
     musicVolume: 0.6,
     touchControls: true,
     hapticFeedback: true,
     screenShake: true,
   }
   ```
3. **Update `migrate(parsed)`**:
   ```ts
   screenShake:
     typeof parsed.settings?.screenShake === 'boolean'
       ? parsed.settings.screenShake
       : true,
   ```
4. **Wire into `JunkyardScene`**:
   - In `JunkyardScene.create()`:
     `this.screenShakeEnabled = saved.settings.screenShake ?? true;`
   - In `JunkyardScene.saveGameState()`:
     Include `screenShake: this.screenShakeEnabled` in settings payload.
   - Provide a setter:
     ```ts
     public setScreenShakeEnabled(enabled: boolean): void {
       this.screenShakeEnabled = enabled;
       this.saveGameState();
       this.events.emit('settings-updated', { screenShake: enabled });
     }
     ```

### 3.2 UI Exposure (Two Complementary Touchpoints)
1. **HUD Quick Toggle Button in `UIScene.ts`**:
   - Location: Adjacent to Audio Toggle button at `x: 955, y: 34` (Screen size: 1280 x 720).
   - Graphic: Circular container with cyan border (matching `audioBtnContainer`).
   - Icon Text: `📳` when enabled, `📴` when disabled.
   - Behavior:
     - On click: toggles `junkyard.setScreenShakeEnabled(!junkyard.screenShakeEnabled)`.
     - Plays bounce tween (`scale: 1.2` for 80ms yoyo).
     - Displays feedback toast via `this.showBuffToast(enabled ? '📳 Screen Shake: ON' : '📴 Screen Shake: OFF', 0x263238, 0x00e5ff)`.
2. **Settings/Toggle in `UpgradeModal.ts`**:
   - Add a Settings row in the modal footer near the reset button:
     `[📳 Screen Shake: ON/OFF]` allowing players to toggle while upgrading.

---

## 4. Deep Dive: Particle Systems & Zero-Leak Architecture

### 4.1 Current Particle Implementations & Shortcomings
1. **Recycler Crunch Sparks**:
   `JunkyardScene.ts:330-338`: Persistent emitter using `'spark_particle'` (8x8 yellow dot). Explodes 6 particles on crunch. Works well, but texture is very simple.
2. **Recycler Steam**:
   `JunkyardScene.ts:352-362`: Persistent emitter using `'steam_particle'`. Emits steam during cooldown.
3. **Rival Scavenger Smoke**:
   `RivalScavenger.ts:118-130`:
   ```ts
   private createSmokePuff(): void {
     const p = this.scene.add.particles(this.x, this.y, 'smoke_particle', ...);
     p.explode();
     this.scene.time.delayedCall(700, () => p.destroy());
   }
   ```
   *Warning*: Spawns new ParticleEmitter instances and schedules delayed destroy calls. If called repeatedly or during scene unmount, this causes GC thrashing and potential dangling timers.
4. **Missing Particle Systems**:
   - **Pulse Sparks**: None exists. When Magnetic Pulse fires, only a line circle graphic is drawn.
   - **Crate Debris**: Crate destruction reuses yellow compactor sparks (`sparkEmitter.explode(16)`), rather than wood splinters/metal debris.
   - **Rover Dust**: No dust emitted when rover travels at high speeds.

### 4.2 Required Procedural Textures in `BootScene.ts`
1. `pulse_spark` (8 x 8):
   - Bright cyan `#00e5ff` core with white `#ffffff` center and diamond/star flare.
2. `crate_debris` (10 x 6):
   - Angular wooden / rusty metal splinter rectangles (`#8d6e63`, `#5d4037`, `#ffb300` edge).
3. `dust_particle` (12 x 12):
   - Soft semi-transparent circular puff with radial alpha falloff (`#4e342e` / `#6d4c41` at 0.5 alpha).

### 4.3 Proposed Zero-Leak Pre-Allocated Architecture in `JunkyardScene`
Pre-allocate 4 dedicated emitters in `JunkyardScene.create()` with `emitting: false`:

```ts
// 1. Existing Compactor Sparks
this.sparkEmitter = this.add.particles(rx, ry, 'spark_particle', { ... emitting: false });

// 2. Pulse Sparks Emitter (Electric Cyan/White Burst)
this.pulseSparkEmitter = this.add.particles(0, 0, 'pulse_spark', {
  speed: { min: 140, max: 380 },
  angle: { min: 0, max: 360 },
  scale: { start: 1.2, end: 0 },
  alpha: { start: 1.0, end: 0 },
  tint: [0x00e5ff, 0xffffff, 0x80d8ff],
  lifespan: 400,
  gravityY: 0,
  emitting: false,
});
this.pulseSparkEmitter.setDepth(25);

// 3. Destructible Crate Debris Emitter (Wooden Splinters & Shards)
this.crateDebrisEmitter = this.add.particles(0, 0, 'crate_debris', {
  speed: { min: 90, max: 260 },
  angle: { min: 0, max: 360 },
  rotate: { min: 0, max: 360 },
  scale: { start: 1.0, end: 0.2 },
  alpha: { start: 1.0, end: 0 },
  lifespan: 550,
  gravityY: 180,
  emitting: false,
});
this.crateDebrisEmitter.setDepth(22);

// 4. Rover High-Speed Dust Emitter (Ground Treads)
this.roverDustEmitter = this.add.particles(0, 0, 'dust_particle', {
  speed: { min: 15, max: 45 },
  scale: { start: 0.8, end: 1.6 },
  alpha: { start: 0.45, end: 0 },
  lifespan: 350,
  emitting: false,
});
this.roverDustEmitter.setDepth(10);
```

### 4.4 Trigger Points & Usage
1. **Pulse Trigger (`JunkyardScene.triggerMagneticPulse`)**:
   `this.pulseSparkEmitter.explode(36, rx, ry);`
2. **Crate Break (`DestructibleCrate.breakCrate`)**:
   `junkyard.crateDebrisEmitter.explode(20, this.x, this.y);`
   `junkyard.sparkEmitter.explode(8, this.x, this.y);`
3. **High-Speed Dust Emission (`PlayerRover.updateMovement`)**:
   Check rover speed against threshold (e.g. `speed > 130` px/s).
   When exceeding threshold, emit 1 particle at left & right tread rear positions throttled every 60ms:
   ```ts
   if (speed > 130 && time >= this.nextDustEmitTime) {
     this.nextDustEmitTime = time + 65;
     const rearAngle = this.rotation + Math.PI;
     const cosA = Math.cos(rearAngle);
     const sinA = Math.sin(rearAngle);
     const perpCos = -sinA;
     const perpSin = cosA;
     // Left tread rear
     junkyard.roverDustEmitter.emitParticleAt(this.x + cosA * 18 + perpCos * 14, this.y + sinA * 18 + perpSin * 14, 1);
     // Right tread rear
     junkyard.roverDustEmitter.emitParticleAt(this.x + cosA * 18 - perpCos * 14, this.y + sinA * 18 - perpSin * 14, 1);
   }
   ```
4. **Lifecycle & Cleanup Guarantee in `JunkyardScene.shutdown()`**:
   ```ts
   this.sparkEmitter?.destroy();
   this.pulseSparkEmitter?.destroy();
   this.crateDebrisEmitter?.destroy();
   this.roverDustEmitter?.destroy();
   this.recyclerSteamEmitter?.destroy();
   ```
   Zero lingering emitters, zero memory leaks.

---

## 5. Deep Dive: Action Polish & Punchiness (Juice)

### 5.1 Scrap Pickup Feedback (`on_pickup`)
Per the `game-feel` skill: *"Squash & stretch + overshoot via an eased tween (the 'pop') — conserve volume: stretch one axis, squash the other, then spring back with overshoot."*

- **Current State**:
  In `PlayerRover.addItem()`, `this.updateCargoVisual()` swaps textures (`cargo_empty`, `cargo_low`, etc.).
  Audio `playScrapPickup(massKg)` plays pitch-scaled triangle plink.
- **Recommended Juice**:
  1. **Squash & Stretch on Cargo Sprite**:
     When an item is collected:
     ```ts
     this.scene.tweens.killTweensOf(this.cargoSprite);
     this.cargoSprite.setScale(1.22, 0.82);
     this.scene.tweens.add({
       targets: this.cargoSprite,
       scaleX: 1.0,
       scaleY: 1.0,
       duration: 160,
       ease: 'Back.out',
     });
     ```
  2. **Golden Scrap Pickup**:
     When collecting a golden scrap (`item.isGolden`), emit 8 `golden_spark` particles at the rover collection point and trigger a micro-shake (60ms, 0.004).
  3. **HUD Cargo Bar Reactive Pulse**:
     In `UIScene.updateCargoDisplay()`:
     When cargo mass increases, add a quick bump tween to `this.cargoBarFill` or `this.cargoText` (`scale: 1.08` for 70ms yoyo).

### 5.2 Upgrade & Purchase Feedback (`on_upgrade`)
- **Current State**:
  In `UpgradeModal.ts:303-308`:
  `buyBtn.on('pointerdown', ...)` executes `purchaseUpgrade()` which plays a coin clink and updates stats. No tactile visual feedback exists on the UI button or the card.
- **Recommended Juice**:
  1. **Button Pop Overshoot**:
     ```ts
     this.scene.tweens.add({
       targets: buyBtn,
       scaleX: 1.15,
       scaleY: 1.15,
       duration: 75,
       yoyo: true,
       ease: 'Back.out',
     });
     ```
  2. **Card Flash / Highlight**:
     Momentarily flash the upgrade card border with bright cyan (`0x00e5ff`) or amber (`0xffd54f`) before easing back to default dark slate.
  3. **Floating Text & Sound**:
     Spawn a floating `+1 LVL!` indicator next to the card.
  4. **Rover Evolution Fanfare**:
     When reaching Level 4 (Reinforced Chassis) or Level 7 (Elite Chassis), trigger `audioService.playFanfare()` and emit an expanding holographic ring in world space on the rover.

---

## 6. Implementation Action Plan & File Touch Matrix

| Priority | Task Description | Target Files | Key Functions / Elements |
|---|---|---|---|
| **P1** | Add `screenShake` setting to `PlayerSettings`, default `true`, handle migration and persistence. | `src/services/persistence/SaveManager.ts` | `PlayerSettings`, `DEFAULT_SAVE_DATA_V2`, `migrate()`. |
| **P1** | Create centralized `triggerScreenShake()` method in `JunkyardScene` checking `screenShakeEnabled`. | `src/scenes/JunkyardScene.ts` | `screenShakeEnabled`, `triggerScreenShake()`, `saveGameState()`. |
| **P1** | Add Screen Shake HUD button with toggle icon (`📳`/`📴`) & toast. | `src/scenes/UIScene.ts` | `setupScreenShakeToggle()`, `audioBtnContainer` alignment. |
| **P1** | Wire Screen Shake hooks to EMP Mine detonation and Scrap Critter attack collisions. | `src/entities/hazards/EMPMine.ts`, `src/entities/hazards/HazardManager.ts`, `src/entities/hazards/DestructibleCrate.ts` | `detonate()`, `update()`, `breakCrate()`. |
| **P2** | Generate procedural textures (`pulse_spark`, `crate_debris`, `dust_particle`) in `BootScene`. | `src/scenes/BootScene.ts` | `generateParticleAndUITextures()`. |
| **P2** | Pre-allocate persistent emitters (`pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`) with zero GC and full shutdown cleanup. | `src/scenes/JunkyardScene.ts` | `create()`, `triggerMagneticPulse()`, `shutdown()`. |
| **P2** | Hook Crate Debris emitter into Pinata Crate breakage. | `src/entities/hazards/DestructibleCrate.ts` | `breakCrate()`. |
| **P2** | Hook Rover Dust emitter into high-speed rover movement (`speed > 130`). | `src/entities/PlayerRover.ts` or `src/scenes/JunkyardScene.ts` | `updateMovement()`. |
| **P3** | Add squash & stretch pop tween on rover cargo sprite on pickup (`addItem`). | `src/entities/PlayerRover.ts` | `addItem()`, `cargoSprite`. |
| **P3** | Add punchy UI button bounce, card flash, and upgrade feedback in `UpgradeModal`. | `src/ui/UpgradeModal.ts` | `createUpgradeCard()`, `purchaseUpgrade()`. |

---

## 7. Verification & Testing Strategy

1. **Unit Tests (`npm test`)**:
   - Verify `tests/unit/persistence-v2.test.ts` passes with `screenShake` included in defaults and legacy v1/v2 migration.
   - Verify `tests/unit/hazards.test.ts` passes with particle emitter mocking.
2. **Build & Bundle Size (`npm run build`)**:
   - Ensure zero TypeScript compiler errors (`tsc`).
   - Ensure bundle size remains strictly under 10MB (procedural generation only, 0 KB external assets).
3. **Manual / Runtime Verification**:
   - Toggle Screen Shake OFF on HUD -> verify camera does not shake during Pulse, Crate break, or EMP blast.
   - Toggle Screen Shake ON -> verify smooth shake on Pulse (200ms), Crate smash (160ms), and EMP explosion (250ms).
   - High speed rover movement -> verify dust puffs behind tracks without frame drops (steady 60 FPS).
   - Pickup scrap -> verify cargo sprite squashes and overshoots cleanly.
