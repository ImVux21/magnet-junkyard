# Task Assignment for Worker M1 (Game Feel & Visual Polish)

## Role & Working Directory
- Role: teamwork_preview_worker
- Working directory: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\worker_m1
- Parent Orchestrator ID: fbfef778-f014-4177-8736-00dd5df8723f

## Mandatory References
- ORIGINAL_REQUEST path: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\ORIGINAL_REQUEST.md
- PROJECT.md path: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\PROJECT.md
- Specification path: C:\Users\vuodo\.gemini\antigravity\brain\3d46d0f6-13de-4967-83f1-ae32a1f9bfb2\prompt_draft.md
- Skill reference: c:\Users\vuodo\software\magnet-junkyard\.agents\skills\game-feel\SKILL.md
- Explorer 1 Survey Report: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_1\survey_report.md
- Explorer 3 Survey Report: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_3\survey_report.md

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership
You have exclusive write ownership over:
- `src/scenes/BootScene.ts`
- `src/scenes/JunkyardScene.ts`
- `src/scenes/UIScene.ts`
- `src/services/persistence/SaveManager.ts`
- `src/entities/hazards/DestructibleCrate.ts`
- `src/entities/hazards/EMPMine.ts`
- `src/entities/hazards/ScrapCritter.ts`
- `src/entities/PlayerRover.ts`
- `src/ui/UpgradeModal.ts`

## Specific Tasks
1. **Camera Screen Shake Centralizer & Hooks**:
   - In `src/scenes/JunkyardScene.ts`: Add `triggerScreenShake(duration: number, intensity: number): void` which verifies `this.screenShakeEnabled` before calling `this.cameras.main.shake()`.
   - Update existing shake calls (Fever, Magnetic Pulse, Pinata Crate destruction) to route through `triggerScreenShake`.
   - Hook `triggerScreenShake` into EMP Mine detonations (`250ms, 0.014`) and Scrap Critter rover collisions (`140ms, 0.007`).

2. **Screen Shake Settings & UI Toggle**:
   - In `src/services/persistence/SaveManager.ts`: Add `screenShake: boolean` (default `true`) to `PlayerSettings`. Update `DEFAULT_SAVE_DATA_V2` and migration logic so existing saves get `screenShake: true`.
   - In `src/scenes/UIScene.ts`: Add a Screen Shake toggle button (`📳` / `📴`) on HUD at (955, 34) next to the Audio toggle (1005, 34). Connect it to SaveManager and notify JunkyardScene via event or direct scene reference.

3. **Particle System Upgrade (Zero Memory Leaks)**:
   - In `src/scenes/BootScene.ts`: Procedurally generate `pulse_spark` (electric blue/cyan spark texture), `crate_debris` (wood/metal splinter texture), and `dust_particle` (soft translucent grey/white circle).
   - In `src/scenes/JunkyardScene.ts`: Pre-allocate persistent particle emitters (`pulseSparkEmitter`, `crateDebrisEmitter`, `roverDustEmitter`) in `create()` with `emitting: false`.
   - Trigger spark burst when Magnetic Pulse is fired.
   - Trigger debris splinter burst in `DestructibleCrate.ts` when broken.
   - Trigger dust puffs trailing the rover in `PlayerRover.ts` / `JunkyardScene.ts` when rover velocity > 130 px/s.
   - Clean up ALL emitters in `JunkyardScene.shutdown()`.

4. **Action Punchiness & Juice**:
   - In `src/entities/PlayerRover.ts`: Add a squash & stretch scale bounce tween on `this.cargoSprite` upon scrap pickup (`scale: 1.22, 0.82` returning to `1.0, 1.0` with `Back.out` easing).
   - In `src/ui/UpgradeModal.ts`: Add a punchy scale pop tween on upgrade purchase buttons upon successful purchase.

5. **Memory Leak Hygiene**:
   - In `src/scenes/UIScene.ts`: Implement `shutdown()` to unbind all cross-scene event listeners attached to `junkyard.events`.
   - In `src/entities/hazards/DestructibleCrate.ts`: Ensure delayedCall respawn timers are tracked and cleanable on scene shutdown.

6. **Build & Test Verification**:
   - Run `npm test` and ensure all 203 unit tests pass (100%).
   - Run `npm run build` and ensure exit code 0, 0 TypeScript errors, bundle size <= 10MB.
   - Document verification results in your `handoff.md`.

## 2026-09-26T04:01:29Z
Dispatch received from orchestrator:
Implement Milestone 1: Game Feel & Visual Polish (Screen Shake centralizer & toggle in SaveManager/UIScene, upgraded particle systems for pulse/crates/dust with zero memory leaks, action punchiness on pickup/upgrade, and shutdown cleanup).
Run build and tests to verify: `npm test` and `npm run build`.
Write completion report in handoff.md and send message to parent orchestrator.

