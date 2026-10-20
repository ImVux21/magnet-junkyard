# Project: Magnet Junkyard — Game Feel & Balancing Upgrade

## Architecture
- Engine: Phaser 3.88.2 + TypeScript + Vite.
- Procedural-only assets generated in `BootScene.ts` and `ProceduralAudioService.ts` to keep bundle size strictly under 10MB (current 1.55 MB).
- Scene Graph:
  - `BootScene`: Procedural texture & audio asset generation.
  - `JunkyardScene`: Main gameplay world, physics, rover kinematics, scrap pool, hazards, particle emitters, camera management.
  - `UIScene`: Overlay HUD, cargo meter, audio toggle, screen shake toggle, upgrade modal triggers.
- Systems & Managers:
  - `SaveManager`: Persistent storage with schema versioning.
  - `HazardManager`: Spawning and updating of DestructibleCrates, EMPMines, ScrapCritters, and RivalScavengers.
  - `ScrapPool`: Object-pooled scrap items with spatial hashing.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Camera Screen Shake | Centralized shake triggers for Magnetic Pulse, Pinata Crate destruction, and monster/hazard collisions (EMP mine, scrap critter) | M1 | prompt_draft §3 |
| 2 | Screen Shake Toggle & Persistence | Add `screenShake` setting in SaveManager schema V2 (default true) and HUD toggle button in UIScene (at 955, 34) | M1 | prompt_draft §3,5 |
| 3 | Upgraded Particle Systems | Procedural sparks for Pulse, wooden/metal debris for Crate destruction, dust puffs for high-speed rover (>130px/s) with zero memory leaks | M1 | prompt_draft §3,5 |
| 4 | Action Punchiness & Juice | Squash & stretch on scrap pickup, button pop/bounce on upgrade purchase per `game-feel` skill | M1 | prompt_draft §3 |
| 5 | Memory Leak Cleanup | Clean up particle emitters, delayed timers, and cross-scene listeners on scene shutdown | M1 | explorer_survey_3 |
| 6 | Compactor & Session Pacing | 10-minute engagement tuning: safe distance in min 1-3 (anti-churn), noticeable ramp-up in rival frequency & hazard speed after 5 min | M2 | prompt_draft §3,5 |
| 7 | Economy & Rate Balancing | Balanced scrap spawn and hazard rates, maintaining >=10-15 min progression without violating test oracles (19,209 / 49,959 coins) | M2 | prompt_draft §3,5 |
| 8 | Comprehensive Unit Testing & Build | Dedicated unit tests for screen shake, settings persistence, particle lifecycle, and pacing curves; verify 100% tests pass and build succeeds | M3 | prompt_draft §5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Game Feel & Visual Polish | Features 1, 2, 3, 4, 5: Camera shake, toggle in UI & SaveManager, particle systems, action juice, shutdown cleanup | none | PLANNED |
| M2 | Game Balancing & Economy | Features 6, 7: Session elapsed time pacing (min 1-3 anti-churn, min 5+ escalation), hazard & scrap balance | M1 | PLANNED |
| M3 | Final Verification & Hardening | Feature 8: New unit tests for all added features, full test run (100% pass), production build under 10MB, 0 errors | M1, M2 | PLANNED |

## Interface Contracts
### JunkyardScene ↔ UIScene & Settings
- `saveManager.getSettings().screenShake: boolean` (default `true`)
- `junkyardScene.triggerScreenShake(duration: number, intensity: number)`: Checks `this.screenShakeEnabled` before calling `this.cameras.main.shake()`.
- Event `'screenshake-toggled'`: UIScene emits or toggles via SaveManager, JunkyardScene updates `this.screenShakeEnabled`.

### JunkyardScene ↔ Particle Systems
- `pulseSparkEmitter`: pre-allocated in `create()`, burst on Magnetic Pulse, destroyed in `shutdown()`.
- `crateDebrisEmitter`: pre-allocated in `create()`, burst on Crate destruction, destroyed in `shutdown()`.
- `roverDustEmitter`: pre-allocated in `create()`, emits trail when rover velocity > 130 px/s, stopped when slower, destroyed in `shutdown()`.

### HazardManager ↔ Session Pacing
- `HazardManager.update(time, delta, sessionElapsedMs)`:
  - 0 - 180s (min 1-3): First rival delayed, safe distance around recycler preserved.
  - 180s - 300s (min 3-5): Standard pacing.
  - 300s+ (min 5-10): Rival recurrence interval decreases from 210s down to 120s, critter roam speed scales by up to +35%, compactor rhythm accelerates.

## Code Layout
- `src/scenes/BootScene.ts`: Procedural textures (`pulse_spark`, `crate_debris`, `dust_particle`).
- `src/scenes/JunkyardScene.ts`: Camera shake method, particle emitter management, high-speed dust tracking, elapsed time updates.
- `src/scenes/UIScene.ts`: Screen shake toggle button on HUD, shutdown listener cleanup.
- `src/services/persistence/SaveManager.ts`: Schema V2 with `screenShake` setting, migrations, defaults.
- `src/entities/PlayerRover.ts`: Pickup squash & stretch tween, dust emission trigger.
- `src/entities/hazards/DestructibleCrate.ts`: Debris burst hook, camera shake hook, timer cleanup.
- `src/entities/hazards/HazardManager.ts`: EMP mine & critter shake hooks, session-based difficulty escalation.
- `src/ui/UpgradeModal.ts`: Punchy button bounce on purchase.
- `tests/unit/`: New unit tests for Game Feel & Balancing.
