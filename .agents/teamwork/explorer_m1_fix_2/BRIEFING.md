# BRIEFING — 2026-09-26T04:42:30Z

## Mission
Investigate and design exact remediation for rival smoke particle zero-allocation lifecycle in JunkyardScene and RivalScavenger.

## 🔒 My Identity
- Archetype: explorer
- Roles: technical exploration, root cause analysis, architecture design
- Working directory: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_2
- Original parent: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a
- Milestone: Milestone 1 Gate Remediation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Design pre-allocated smoke emitter in JunkyardScene with `emitting: false`
- RivalScavenger.createSmokePuff() triggers `rivalSmokeEmitter.explode(10, this.x, this.y)`
- Proper cleanup in JunkyardScene.shutdown()

## Current Parent
- Conversation ID: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/entities/hazards/RivalScavenger.ts` (lines 43, 67, 118-130)
  - `src/scenes/JunkyardScene.ts` (lines 59-63, 332-402, 1142-1174)
  - `src/scenes/BootScene.ts` (lines 404-410)
  - `tests/unit/adversarial-m1-perf-memory.test.ts` (lines 234-338)
  - `tests/unit/hazards.test.ts` (lines 304-331)
- **Key findings**:
  - `RivalScavenger.ts:119` was the sole remaining dynamic `add.particles` allocation in `src/`.
  - Every spawn and despawn allocated an emitter and scheduled a 700ms `delayedCall` timer.
  - Adding `public rivalSmokeEmitter` in `JunkyardScene.ts` with `emitting: false` and triggering via `.explode(10, this.x, this.y)` achieves 100% pre-allocated particles across the whole game.
  - Safe interface casting and `.active !== false` check in `RivalScavenger` ensures backwards compatibility with headless test mock scenes without circular imports.
  - `tests/unit/adversarial-m1-perf-memory.test.ts` defect discovery suite must be updated to test remediation verification.
- **Unexplored areas**: None for this scope.

## Key Decisions Made
- Pre-allocate `rivalSmokeEmitter` in `JunkyardScene.buildRecyclerStation()` alongside existing emitters.
- Destroy `rivalSmokeEmitter` in `JunkyardScene.shutdown()`.
- Use interface casting `{ rivalSmokeEmitter?: Phaser.GameObjects.Particles.ParticleEmitter }` in `RivalScavenger` to avoid circular dependencies.
- Provide verbatim before/after code blocks in `handoff.md` for `RivalScavenger.ts`, `JunkyardScene.ts`, and `adversarial-m1-perf-memory.test.ts`.

## Artifact Index
- handoff.md — Complete 5-component technical remediation plan
- progress.md — Liveness heartbeat

