# BRIEFING — 2026-09-26T11:43:15+07:00

## Mission
Investigate and design exact remediation for JunkyardScene lifecycle and shutdown defects (listeners, timers, pool, shutdown event).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_1
- Original parent: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a
- Milestone: milestone-1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Design exact code changes for JunkyardScene lifecycle and shutdown
- No code modification to src/ (write proposals/diffs in agent folder)

## Current Parent
- Conversation ID: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/scenes/JunkyardScene.ts` (full lifecycle, create, shutdown, event bindings)
  - `src/scenes/UIScene.ts` (reference shutdown implementation and listener bindings)
  - `node_modules/phaser/src/scene/Systems.js` (Phaser 3 lifecycle and Events.SHUTDOWN emission)
  - `node_modules/phaser/src/time/Clock.js` (TimerEvent lifecycle, removeAllEvents)
  - `src/services/economy/ChallengeManager.ts`, `AchievementManager.ts`, `ComboManager.ts` (listener mechanics)
  - `src/entities/hazards/DestructibleCrate.ts` (active 45s respawn timer disposal)
  - `src/entities/ScrapPool.ts` (pool destruction)
  - `tests/unit/adversarial-m1-perf-memory.test.ts` (defect harness)
  - `tests/unit/adversarial-m1-gamefeel.test.ts` (game feel mock suite)
- **Key findings**:
  - Phaser 3 `Systems.js:785` only emits `Events.SHUTDOWN` and never calls `scene.shutdown()` automatically; omission of `this.events.on('shutdown', ...)` rendered `JunkyardScene.shutdown()` completely dead.
  - Scene restarts via `scene.restart()` run `create()` on the same instance without re-instantiating property initializers, causing duplicate event listeners on `challengeManager`, `achievementManager`, `comboManager`, and `achievement-trigger`.
  - All 5 emitters, `destructibleCrates` (with active 45s timers), `respawnTimer`, and `scrapPool` must be destroyed and references nulled to prevent stale access crashes.
  - `adversarial-m1-perf-memory.test.ts:356` tests for `expect(hasShutdownListener).toBe(false)` and will need updating to `toBe(true)`.
- **Unexplored areas**: None for M1 shutdown scope.

## Key Decisions Made
- Designed exact line-by-line patch in `junkyard_scene_lifecycle.patch`.
- Added listener unhook handles to `JunkyardScene` and wired unhooking in `shutdown()` as well as defensive cleanup prior to re-subscribing in `create()`.
- Specified reference nulling for particle emitters to prevent `PlayerRover.ts:289` TypeError.
- Documented updating `adversarial-m1-perf-memory.test.ts:356`.

## Artifact Index
- DISPATCH.md — Task dispatch
- BRIEFING.md — Working memory
- progress.md — Liveness heartbeat
- junkyard_scene_lifecycle.patch — Unified diff patch proposal
- handoff.md — 5-component technical remediation handoff report
