# Handoff Report: Game Feel & Visual Polish Codebase Survey

## 1. Observation
- **Camera Shake Implementation**:
  - `src/scenes/JunkyardScene.ts:192`: `this.cameras.main.shake(300, 0.012);` called inside `fever-started` event listener.
  - `src/scenes/JunkyardScene.ts:813`: `this.cameras.main.shake(200, 0.012);` called inside `triggerMagneticPulse()`.
  - `src/entities/hazards/DestructibleCrate.ts:38`: `junkyard.cameras.main.shake(120, 0.008);` called inside `breakCrate()`.
  - In `src/entities/hazards/HazardManager.ts:127-158` and `src/entities/hazards/EMPMine.ts:88-99`: When EMP Mine detonates (disabling magnet for 3s and dumping 30% cargo) and when Scrap Critter attacks the rover (dumping cargo), there are **zero camera shake invocations**.
  - There is currently **no conditional check** on any user setting before invoking `shake()`.
- **Screen Shake Toggle in Settings & UI**:
  - `src/services/persistence/SaveManager.ts:25-30`: `PlayerSettings` interface defines `{ sfxVolume: number; musicVolume: number; touchControls: boolean; hapticFeedback: boolean; }`. `screenShake` is completely missing.
  - `src/services/persistence/SaveManager.ts:85-90`: `DEFAULT_SAVE_DATA_V2.settings` omits `screenShake`.
  - `src/scenes/UIScene.ts:865-900`: `setupAudioToggle()` creates an audio toggle button at (1005, 34). There is no button or setting on the HUD or in `UpgradeModal.ts` for toggling screen shake.
- **Particle Systems**:
  - `src/scenes/BootScene.ts:385-419`: Procedural particle textures currently generated are `spark_particle` (8x8 yellow circle), `smoke_particle` (14x14 grey circle), and `golden_spark` (10x10 gold circle).
  - `src/scenes/JunkyardScene.ts:330-362`: Instantiates two persistent emitters: `this.sparkEmitter` (for Recycler compactor crunch) and `this.recyclerSteamEmitter` (for thermal cooldown steam).
  - In `src/scenes/JunkyardScene.ts:821-841` (`triggerMagneticPulse`): Pulse only draws a 2D line circle graphic (`shockwave.strokeCircle(...)`), with **zero spark particles emitted**.
  - In `src/entities/hazards/DestructibleCrate.ts:33-35`: Crate destruction reuses `junkyard.sparkEmitter.explode(16, this.x, this.y)`, which emits yellow metal compactor dots rather than wooden/metal debris splinters.
  - In `src/entities/PlayerRover.ts:237-260`: Rover movement kinematics has **zero dust or tread particle emission** at high speeds.
  - In `src/entities/hazards/RivalScavenger.ts:118-130`: `createSmokePuff()` dynamically calls `this.scene.add.particles(...)` and destroys it via `this.scene.time.delayedCall(700, () => p.destroy())`. Dynamic instantiations of emitters risk memory leaks and GC latency spikes.
- **Action Polish & Punchiness**:
  - In `src/entities/PlayerRover.ts:105-116` (`addItem`): Adding scrap updates cargo data and switches texture in `updateCargoVisual()`, but has no squash & stretch or scale bounce.
  - In `src/ui/UpgradeModal.ts:303-308`: Purchasing an upgrade calls `purchaseUpgrade()` with sound and numerical refresh, but has no button pop tween, card highlight, or visual celebration.
- **Baseline Test & Build Verification**:
  - Command: `npm test` exited 0. All 13 test files and 203 tests passed in 3.47s.
  - Command: `npm run build` exited 0. Bundle size uncompressed: 1.55 MB (1,621,061 bytes / 10MB budget limit). Zero TypeScript errors.

## 2. Logic Chain
1. From Observation 1: Camera shake is presently hardcoded in only 3 specific locations, missing key high-impact events (EMP Mine explosion, monster/critter collision). Furthermore, calling `shake()` unconditionally causes motion discomfort for sensitive players and violates CrazyGames accessibility recommendations.
2. From Observation 2: Because `PlayerSettings` in `SaveManager.ts` lacks `screenShake: boolean`, any toggle added in UI would lose state upon browser reload. Therefore, schema migration must incorporate `screenShake: boolean` (defaulting to `true`).
3. From Observation 2: Because `UIScene.ts` already houses top-right HUD buttons (Audio toggle at 1005, 34), placing a Screen Shake toggle button at (955, 34) provides an immediately visible and intuitive control for players.
4. From Observation 3: In Phaser 3.88.2, creating ephemeral particle emitters per-event (as in `RivalScavenger.ts`) causes memory fragmentation. Pre-allocating persistent emitters in `JunkyardScene` (`pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`) with `emitting: false` and explicitly destroying them in `shutdown()` provides zero-allocation particle bursts and guaranteed zero memory leaks.
5. From Observation 4: The `game-feel` skill specifies that discrete actions (`on_pickup`, `on_upgrade`) feel flat when linear. Implementing a volume-conserving squash-and-stretch tween (`scale: 1.22, 0.82` -> `1.0, 1.0` with `Back.out`) on scrap pickup and an overshoot button bounce on upgrade purchase delivers the punchiness requested in `prompt_draft.md`.

## 3. Caveats
- No gameplay or physics constants were modified during this investigation (strictly read-only survey).
- The survey focused on client-side Game Feel & Polish; economy curve rebalancing (Task 2 in `prompt_draft.md`) was surveyed in terms of UI interactions but detailed scrap yield math is handled by the balancing agent.
- No third-party sound libraries or image assets are to be downloaded; all new particle textures must be generated procedurally in `BootScene.ts`.

## 4. Conclusion
The codebase is exceptionally well-architected for adding the requested Game Feel features:
1. Implement a centralized `triggerScreenShake(duration, intensity)` in `JunkyardScene` that checks `this.screenShakeEnabled`.
2. Hook `triggerScreenShake` into EMP Mine detonations (`250ms, 0.014`), Scrap Critter hits (`140ms, 0.007`), Crate smashes (`160ms, 0.010`), and Pulse (`200ms, 0.012`).
3. Extend `SaveManager.ts` (Schema V2) to store `screenShake: boolean` (default `true`), and add a toggle button (`📳`/`📴`) on `UIScene` HUD at (955, 34).
4. Procedurally generate `pulse_spark`, `crate_debris`, and `dust_particle` in `BootScene.ts`, and pre-allocate pooled emitters in `JunkyardScene` with full cleanup in `shutdown()`.
5. Add squash-and-stretch pop tweens to `PlayerRover.cargoSprite` on pickup and overshoot scale bounces on upgrade buttons in `UpgradeModal.ts`.

## 5. Verification Method
- **Unit Test Execution**:
  Run `npm test` to ensure all 203 existing tests continue to pass when `screenShake` is added to `SaveManager` and persistent emitters are added to scenes.
- **Production Build & Asset Budget**:
  Run `npm run build` to verify zero TypeScript errors and total uncompressed dist bundle <= 10MB.
- **Runtime Functional Checklist**:
  1. Toggle screen shake OFF in HUD -> verify Pulse, Crate Break, and EMP detonation do not shake camera.
  2. Toggle screen shake ON in HUD -> verify shake triggers at correct intensities.
  3. Fire Magnetic Pulse -> verify electric cyan/white sparks explode around rover.
  4. Break Pinata Crate -> verify wooden/debris splinters burst radially.
  5. Drive Rover at high speed (>130 px/s) -> verify dust puffs trail behind treads.
  6. Collect scrap item -> verify cargo sprite squashes and springs back.
  7. Buy upgrade -> verify button bounces with overshoot.
