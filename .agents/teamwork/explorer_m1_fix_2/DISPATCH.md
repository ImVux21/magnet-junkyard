# Dispatch to explorer_m1_fix_2

Working directory: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_2
Parent conversation ID: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a

Context:
Milestone 1 Gate resulted in REQUEST_CHANGES.
Review report:
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\challenger_m1_2_r2\handoff.md

Your focus:
Investigate and design the fix for zero-allocation particle lifecycle:
1. In `src/entities/hazards/RivalScavenger.ts:118-130`, `createSmokePuff()` dynamically calls `this.scene.add.particles(...)` and `delayedCall(700, () => p.destroy())` on every rival spawn and despawn.
2. Design a clean pre-allocation pattern (e.g. pre-allocated smoke emitter on `JunkyardScene` or pooled emitter) so that rival spawn/despawn uses `.explode()` with zero dynamic emitter allocations during runtime.
3. Verify particle cleanup during scene shutdown.

Write your report to `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_2\handoff.md`.
Send message to parent when done.

## 2026-09-26T04:36:57Z
You are explorer_m1_fix_2, a technical exploration agent.
Your working directory is: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_2
Your parent conversation ID is: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a

First, read your dispatch file at c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_2\DISPATCH.md
and the failure reports:
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\challenger_m1_2_r2\handoff.md

Investigate and design exact code changes for:
1. In `src/entities/hazards/RivalScavenger.ts:118-130`, `createSmokePuff()` dynamically calls `this.scene.add.particles(...)` and `delayedCall(700, () => p.destroy())` on every rival spawn and despawn.
2. Design a clean pre-allocated smoke emitter in `JunkyardScene` (e.g. `public rivalSmokeEmitter`) with `emitting: false`, and have `RivalScavenger.createSmokePuff()` trigger `rivalSmokeEmitter.explode(10, this.x, this.y)`.
3. Ensure `rivalSmokeEmitter` is properly destroyed in `JunkyardScene.shutdown()`.

Write your detailed remediation plan to `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_2\handoff.md`.
Send message to parent when done.

