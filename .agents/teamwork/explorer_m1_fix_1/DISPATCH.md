# Dispatch to explorer_m1_fix_1

Working directory: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_1
Parent conversation ID: 8d72af9b-41a6-4ea1-93f6-835a8f34ff9a

Context:
Milestone 1 Gate resulted in REQUEST_CHANGES due to critical lifecycle defects.
Review reports:
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\reviewer_m1_2_r2\handoff.md
- c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\challenger_m1_2_r2\handoff.md

Your focus:
Investigate and design the fix for `JunkyardScene.ts` lifecycle and shutdown:
1. Missing `this.events.on('shutdown', this.shutdown, this)` in `JunkyardScene.create()`.
2. Prevention of event listener accumulation on `challengeManager`, `achievementManager`, `comboManager`, and `this.events.on('achievement-trigger', ...)` across scene restarts.
3. Complete cleanup of all emitters, timers, crates, and scrapPool.

Write your report to `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_m1_fix_1\handoff.md`.
Send message to parent when done.

## 2026-09-26T04:36:57Z
Dispatched task:
Investigate and design exact code changes for:
1. In `src/scenes/JunkyardScene.ts`: Add `this.events.on('shutdown', this.shutdown, this)` in `create()`. Verify exact line placement.
2. Ensure all event listeners on `challengeManager`, `achievementManager`, `comboManager`, and `this.events.on('achievement-trigger', ...)` are unhooked in `shutdown()` or cleared so scene restarts do not accumulate duplicate listeners.
3. Ensure `shutdown()` properly destroys all emitters, active crate timers, and scrapPool.
