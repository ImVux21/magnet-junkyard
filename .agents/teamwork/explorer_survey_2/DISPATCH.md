# Task Assignment for Explorer 2 (Survey: Game Balancing & Economy)

## Role & Working Directory
- Role: teamwork_preview_explorer
- Working directory: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_2
- Parent Orchestrator ID: fbfef778-f014-4177-8736-00dd5df8723f

## Instructions & Objective
Read the authoritative requirements and survey the existing codebase:
- ORIGINAL_REQUEST path: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\ORIGINAL_REQUEST.md
- Specification path: C:\Users\vuodo\.gemini\antigravity\brain\3d46d0f6-13de-4967-83f1-ae32a1f9bfb2\prompt_draft.md

Your focus is **Game Balancing & Economy**:
1. Investigate how the Compactor speed scaling is currently implemented. Where is the logic for speed progression, distance, and time?
2. Map the 10-minute engagement pacing requirement:
   - Safe distance / low pressure during minutes 1-3 to prevent churn.
   - Gradual ramp-up with noticeable escalation after 5 minutes.
3. Investigate Scrap spawn mechanics and Hazard (monsters/obstacles) spawn mechanics. Where are spawn intervals, densities, pool limits, and rate formulas defined?
4. Investigate the Upgrade cost curves and Scrap yields. Map out existing upgrade definitions, costs per level, scrap value per tier, and evaluate how long it takes to reach mid-game and late-game upgrades.
5. Identify the exact configuration files or code files where pacing, rates, and costs need adjustments.
6. Write your comprehensive survey report to `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_2\survey_report.md` and your `handoff.md`.
7. Send a message to the orchestrator when complete.

## 2026-09-26T03:54:06Z
Survey the codebase focusing on Game Balancing & Economy:
1. Compactor speed scaling logic, safe distance in minutes 1-3 (anti-churn), escalation after 5 minutes for a 10-minute engagement loop.
2. Scrap spawning rates & Hazard spawning rates.
3. Upgrade cost curves and scrap yields for sustained 10+ minute progression.
4. Exact code and config files where balance adjustments must occur.
Write your survey report to c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_2\survey_report.md and your handoff.md.
Then send a completion message to the parent orchestrator.

