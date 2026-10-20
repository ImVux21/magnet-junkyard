# Task Assignment for Explorer 3 (Survey: Build, Testing & Architecture)

## Role & Working Directory
- Role: teamwork_preview_explorer
- Working directory: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_3
- Parent Orchestrator ID: fbfef778-f014-4177-8736-00dd5df8723f

## Instructions & Objective
Read the authoritative requirements and survey the existing codebase:
- ORIGINAL_REQUEST path: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\ORIGINAL_REQUEST.md
- Specification path: C:\Users\vuodo\.gemini\antigravity\brain\3d46d0f6-13de-4967-83f1-ae32a1f9bfb2\prompt_draft.md

Your focus is **Build, Testing & Architecture**:
1. Inspect `package.json`, TypeScript config (`tsconfig.json`), build scripts, Vite configs, and dependencies.
2. Locate all existing unit tests and test frameworks (e.g. Vitest, Jest). What is the exact test execution command (`npm test`, `npx vitest`, etc.)?
3. Check what unit tests exist right now, what modules they cover, and whether there are any tests for Game Feel, Particles, Screen Shake, Compactor Pacing, Economy, etc.
4. Survey architecture, code layout, state management, and asset generation (reminder: procedural only, bundle size < 10MB).
5. Identify any potential memory leak risks (e.g. uncleaned tweens, unpooled particles, listeners on destroyed objects).
6. Write your comprehensive survey report to `c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_3\survey_report.md` and your `handoff.md`.
7. Send a message to the orchestrator when complete.

## 2026-09-26T03:54:06Z
You are an Explorer subagent for the Project Orchestrator.
Your working directory is: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_3
Read your task instructions at: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_3\DISPATCH.md
Read the user request: c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\ORIGINAL_REQUEST.md
Read the specification: C:\Users\vuodo\.gemini\antigravity\brain\3d46d0f6-13de-4967-83f1-ae32a1f9bfb2\prompt_draft.md

Survey the codebase focusing on Build, Testing & Architecture:
1. package.json, TypeScript config, Vite config, build scripts.
2. Test framework, runner commands, existing test files and test coverage.
3. Architectural layout, modules, performance patterns, memory leak risks.
4. Baseline test command to run and verify build/tests.
Write your survey report to c:\Users\vuodo\software\magnet-junkyard\.agents\teamwork\explorer_survey_3\survey_report.md and your handoff.md.
Then send a completion message to the parent orchestrator.
