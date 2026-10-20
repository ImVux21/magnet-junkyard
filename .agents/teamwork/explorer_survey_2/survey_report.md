# Comprehensive Survey Report: Game Balancing & Economy Architecture

**Author**: Explorer Subagent 2 (`teamwork_preview_explorer`)  
**Date**: 2026-09-26  
**Target Project**: Magnet Junkyard (Phaser 3 + TypeScript + Vite)  
**Assigned Mission**: Survey codebase for Compactor speed scaling, safe distance (anti-churn min 1-3, escalation post-5 min), scrap & hazard spawn rates, upgrade costs & scrap yields for sustained 10+ minute progression, and map exact code/config files for balancing.

---

## Executive Summary

1. **Current Compactor Speed Implementation**:
   - In `src/scenes/JunkyardScene.ts` (lines 552-555), the "Compactor" is the Recycler Station's hydraulic crusher press.
   - Its compression speed is currently governed by `const compactorInterval = Math.max(30, 75 - (this.upgrades.carryCapacity - 1) * 5);` (75ms/item at Level 1 down to 30ms/item at Level 10).
   - There is currently **no time-based session scaling** or **distance-based pressure** on the compactor in the active update loop.
   - In minutes 1-3, the starter tier (Tier 1) operates as an innate "safe zone" with 0 critters, 0 EMP mines, and the first Rival Scavenger deferred to `Date.now() + 180000` (exactly 3 minutes). However, no explicit session clock dynamically drives hazard difficulty or compactor urgency after 5 minutes.

2. **Scrap & Hazard Spawning Rates**:
   - **Scrap Pool**: Pre-allocated Zero-GC pool of 260 items (`TOTAL_POOL_SIZE = 260` in `src/config/constants.ts`). Quotas per zone: Tier 1 = 45, Tier 2 = 60, Tier 3 = 75, Tier 4 = 80.
   - **Respawn Loop**: Ticks every 1,500ms (`RESPAWN_INTERVAL_MS`), replenishing active scrap up to zone quotas in batches of up to 4 items per tick, enforced by distance guards (min 180px from player, min 220px from recycler).
   - **Hazard Loop**: 12 pre-allocated `ScrapCritter` entities (Tier 1: 0, Tier 2: 2, Tier 3: 4, Tier 4: 6), 8 fixed `EMPMine` locations (Tiers 2-4 only), and 1 `RivalScavenger` that spawns at 3 minutes and recurs every 3.5 minutes.
   - **Pacing Gap**: Hazard density and speed are tied exclusively to unlocked tiers, not session elapsed time. A player farming Tier 1/Tier 2 encounters no escalation after 5 minutes.

3. **Economy & Upgrade Progression**:
   - **Scrap Value Scaling**: 
     - Tier 1: Avg ~2.00 coins/kg (1-6 coins/item).
     - Tier 2: Avg ~8.00 coins/kg (15-50 coins/item).
     - Tier 3: Avg ~17.50 coins/kg (90-240 coins/item).
     - Tier 4: Avg ~34.26 coins/kg (120-800 coins/item).
   - **Upgrade Curves**: 4 tracks across 10 levels. Range (Base 50, 1.45x, sum 3,034c), Power (Base 70, 1.42x, sum 3,742c), Capacity (Base 85, 1.50x, sum 6,362c), Speed (Base 100, 1.45x, sum 6,071c).
   - **Carry Capacity Curve**: Quadratic `C(L) = 6 + 4*(L-1) + (L-1)^2` yielding `[6, 11, 18, 27, 38, 51, 66, 83, 102, 123] kg`.
   - **Tier Unlock Costs**: Tier 1 = 0, Tier 2 = 750, Tier 3 = 5,000, Tier 4 = 25,000 (total = 30,750c).
   - **Progression Pacing**: Grand total currency requirement is 49,959 coins. Empirical progression simulation (`tests/unit/m-o1-economy-stress.test.ts`) verifies reaching Tier 4 takes **>= 15 minutes (900s)** of active play.
   - **Crucial Architectural Warning**: Existing unit test suites (`m-o1-economy-stress.test.ts`, `adversarial-m-o1.test.ts`, `economy.test.ts`) have **exact oracle assertions** on the base costs, multipliers, capacity discrete steps, and the grand total of 19,209 / 49,959 coins. Any adjustments to the economy formulas must be synchronized with these tests or tuned through dynamic gameplay modifiers.

---

## Detailed Investigation

### 1. Compactor Speed Scaling Logic & Safe Distance Pacing

#### Current Implementation
The compactor logic resides in `src/scenes/JunkyardScene.ts`:
- **Crusher Press Initialization** (`lines 302-364`):
  `buildRecyclerStation()` mounts `recycler_press`, `recycler_pad`, `sparkEmitter`, and `recyclerSteamEmitter` at `GAME_CONSTANTS.RECYCLER_CENTER` (1500, 1200).
- **Processing Interval Formula** (`lines 552-555`):
  ```typescript
  // Process one scrap item with compactor speed (75ms down to 30ms with capacity upgrade)
  const compactorInterval = Math.max(30, 75 - (this.upgrades.carryCapacity - 1) * 5);
  if (time - this.lastRecycleProcessTime >= compactorInterval) {
    this.lastRecycleProcessTime = time;
    const item = this.playerRover.cargo.items.pop();
    ...
  }
  ```
- **Thermal Cooldown** (`lines 643-682`):
  Whenever the rover's cargo is completely emptied in the recycler zone, a 2.5-second lockout (`RECYCLER_COOLDOWN_MS = 2500`) triggers with steam particles and a UI progress bar.

#### Pacing Analysis: The 10-Minute Loop Requirement
The specification (`prompt_draft.md` Section 5.2) specifies:
> "Nhịp độ (Pacing): Giai đoạn 1-3 phút đầu compactor giữ khoảng cách an toàn để người chơi mới làm quen (anti-churn). Sau 5 phút độ khó tăng tiến rõ rệt."

**Analysis of Existing Pacing**:
1. **Minutes 1 - 3 (Anti-Churn Safe Phase)**:
   - In the first 3 minutes, the player is confined to Tier 1 (`The Rusted Basin`).
   - Tier 1 contains 0 Scrap Critters and 0 EMP Mines.
   - The Rival Scavenger has a hardcoded initial delay:
     `this.nextRivalSpawnTime = Date.now() + 180000;` (`HazardManager.ts:32`) — meaning the Rival cannot appear before minute 3.
   - The Recycler Compactor is located centrally at (1500, 1200), immediately adjacent to the player spawn point at (1380, 1200). The round-trip travel distance is minimal (~120px).
   - Thus, low pressure and safe distance are implicitly achieved by the tier layout and initial hazard delays.

2. **Minutes 3 - 5 (Early Mid-Game Transition)**:
   - At 180 seconds (3 min), the first Rival Scavenger enters the highest unlocked tier for 30s.
   - Player unlocks Tier 2 (cost 750 coins), introducing 2 Scrap Critters and 3 EMP Mines.
   - Player starts upgrading Capacity to Level 2 (11kg) or Level 3 (18kg), dropping compactor interval from 75ms down to 70ms - 65ms.

3. **Minutes 5 - 10+ (Escalation Phase - Pacing Gap Identified)**:
   - **Current Missing Mechanic**: Currently, neither `JunkyardScene` nor `HazardManager` tracks total session elapsed time to scale difficulty.
   - Compactor processing speed is strictly static based on `this.upgrades.carryCapacity`.
   - Rival Scavenger recurs on a fixed 3.5-minute interval (`RIVAL_SPAWN_INTERVAL_MS = 210000`).
   - Critters maintain fixed wandering speed (`60 + tier * 15`).

**Recommendation for Implementation**:
Introduce a session elapsed time progression factor:
- Track `sessionElapsedSeconds` in `JunkyardScene.update(time, delta)` or `HazardManager`.
- In Minutes 1-3: Keep safe distance / low threat. Hazards never approach within 250px of the Recycler Station.
- In Minutes 5+: Escalate pacing:
  - Accelerate Rival Scavenger recurrence (e.g. interval scales from 210s down to 120s after 5 min).
  - Escalate Compactor processing throughput or add a dynamic "Overheat / High-Pressure Rush" to increase urgency.
  - Scale critter movement speed by `+15%` after 5 minutes.

---

### 2. Scrap & Hazard Spawning Mechanics

#### Scrap Spawning System (`src/entities/ScrapPool.ts` & `src/config/constants.ts`)

| Parameter | Current Value | Location | Description |
|---|---|---|---|
| `TOTAL_POOL_SIZE` | 260 | `constants.ts:357` | Total pre-allocated Zero-GC pool |
| Tier 1 Quota | 45 items | `constants.ts:226` | Target active items in The Rusted Basin |
| Tier 2 Quota | 60 items | `constants.ts:236` | Target active items in Smelter's Yard |
| Tier 3 Quota | 75 items | `constants.ts:246` | Target active items in Automotive Graveyard |
| Tier 4 Quota | 80 items | `constants.ts:256` | Target active items in Titanium Ridge |
| `RESPAWN_INTERVAL_MS` | 1,500 ms | `constants.ts:358` | Interval between replenishment ticks |
| `RESPAWN_MIN_PLAYER_DIST` | 180 px | `constants.ts:359` | Guard distance from player rover |
| `RESPAWN_MIN_RECYCLER_DIST` | 220 px | `constants.ts:360` | Guard distance from central recycler |
| Max Spawn Batch per Tick | 4 items | `ScrapPool.ts:207` | Framerate spike prevention clamp |
| Golden Scrap Chance | 5% (0.05) | `ScrapPool.ts:81` | 5x coin multiplier variant |
| Scrap Storm Interval | 60,000 ms | `JunkyardScene.ts:94` | Dynamic event spawning 15 items (20% golden) |
| Destructible Crates | 5 per tier (20 total) | `JunkyardScene.ts:871` | Pinata crates; drop 4-6 scrap on collision (15% golden) |
| Crate Respawn Delay | 45,000 ms | `DestructibleCrate.ts:13` | Crate replenishment timer |

#### Hazard Spawning System (`src/entities/hazards/`)

| Hazard Entity | Pool & Count | Trigger & Timing | Mechanics & Impact |
|---|---|---|---|
| **Scrap Critter** (`ScrapCritter.ts`) | 12 total pool; Tier 1: 0, Tier 2: 2, Tier 3: 4, Tier 4: 6 | Continuously roams within tier bounds; speed = `60 + tier * 15` px/s | Collides with rover (r=36px): knocks loose 1-2 cargo items onto the ground. Repelled if rover Attract Power >= 700 (L5+). |
| **EMP Mine** (`EMPMine.ts`) | 8 fixed locations (Tier 2: 3, Tier 3: 3, Tier 4: 2) | Proximity trigger (r=38px); re-arms after 20s (`ARM_COOLDOWN_MS = 20000`) | Detonates: disables rover magnet for 3.0s, dumps 2-3 items from cargo near blast. |
| **Rival Scavenger** (`RivalScavenger.ts`) | 1 active entity | First spawn at 180s (3.0m); re-spawns every 210s (3.5m); active for 30s | Speed 190 px/s; navigates to nearest scrap in highest unlocked tier; vacuums items within 130px radius. |

---

### 3. Economy & Upgrade Progression Analysis

#### Scrap Catalog & Tier Economics

| Tier | Item Type | Name | Mass (kg) | Base Coins | Value Density (Coins/kg) | Spawn Weight (T1/T2/T3/T4) |
|---|---|---|---|---|---|---|
| **Tier 1** | `screw` | Rusty Screws | 1.0 | 1 | 1.00 | [50, 15, 5, 0] |
| | `can` | Crushed Soda Can | 1.0 | 2 | 2.00 | [35, 20, 5, 0] |
| | `pipe` | Iron Pipe Scrap | 2.0 | 6 | 3.00 | [15, 15, 10, 0] |
| **Tier 2** | `copper_wire` | Copper Wire Spool | 2.0 | 18 | 9.00 | [0, 25, 15, 5] |
| | `battery` | Lead-Acid Battery | 3.0 | 15 | 5.00 | [0, 15, 15, 5] |
| | `steel_plate` | Heavy Steel Plate | 5.0 | 50 | 10.00 | [0, 10, 15, 10] |
| **Tier 3** | `engine_belt` | Alternator Belt | 6.0 | 90 | 15.00 | [0, 0, 15, 10] |
| | `radiator` | Brass Radiator | 8.0 | 140 | 17.50 | [0, 0, 15, 15] |
| | `car_chassis` | Vehicle Door Panel | 12.0 | 240 | 20.00 | [0, 0, 10, 15] |
| **Tier 4** | `catalytic_converter` | Catalytic Converter | 9.0 | 340 | 37.78 | [0, 0, 5, 20] |
| | `engine_block` | Cracked V6 Engine | 8.0 | 120 | 15.00 | [0, 0, 5, 20] |
| | `rocket_nozzle` | Rocket Thruster Bell | 16.0 | 800 | 50.00 | [0, 0, 0, 15] |

#### Multiplier Stack Overview
The economy incorporates multiplicative layers:
1. **Combo System** (`ComboManager.ts`):
   - 3-4 scrap streak: 1.5x coins
   - 5-9 scrap streak: 2.0x coins
   - 10-19 scrap streak: 3.0x coins
   - 20+ scrap streak (Fever Mode): **5.0x coins** + magnet speed boost
2. **Golden Scrap Variant**: **5.0x coin value**
3. **Rewarded Ad Bonus**: **2.0x coins** for entire next haul
4. **Prestige Multiplier**: `+10%` permanent bonus per prestige level (`1.0 + 0.10 * prestigeLevel`)
5. **Micro-Challenges**: 150 - 300 bonus coins on recycle condition completion

#### Upgrade Progression Ladders & Cost Curves
Formula: `Cost(Level) = Math.floor(Base * Math.pow(Multiplier, Level - 1))`

| Level | Magnet Range (Base 50, 1.45x) | Attract Power (Base 70, 1.42x) | Carry Capacity (Base 85, 1.50x) | Movement Speed (Base 100, 1.45x) |
|---|---|---|---|---|
| **L1 -> L2** | 50 | 70 | 85 | 100 |
| **L2 -> L3** | 72 | 99 | 127 | 145 |
| **L3 -> L4** | 105 | 141 | 191 | 210 |
| **L4 -> L5** | 152 | 200 | 286 | 304 |
| **L5 -> L6** | 221 | 284 | 430 | 442 |
| **L6 -> L7** | 320 | 404 | 645 | 640 |
| **L7 -> L8** | 464 | 573 | 968 | 929 |
| **L8 -> L9** | 673 | 814 | 1,452 | 1,347 |
| **L9 -> L10** | 977 | 1,157 | 2,178 | 1,954 |
| **Total Track Cost** | **3,034** | **3,742** | **6,362** | **6,071** |

- **Sum of All Upgrades**: **19,209 coins**
- **Tier Unlock Costs**: Tier 2 (750) + Tier 3 (5,000) + Tier 4 (25,000) = **30,750 coins**
- **Grand Total Progression Investment**: **49,959 coins**

#### Carry Capacity Curve
Formula: `C(L) = 6 + 4*(L-1) + (L-1)^2`
- Level 1: 6 kg (Starter capacity: accepts screws, cans, pipes, wires, batteries, steel plates; rejects heavy Tier 3/4 items > 6kg)
- Level 2: 11 kg (Unlocks hauling 8kg Radiators & Engine Blocks)
- Level 3: 18 kg (Unlocks hauling 12kg Chassis & 16kg Rocket Nozzles)
- Level 4: 27 kg
- Level 5: 38 kg
- Level 6: 51 kg
- Level 7: 66 kg
- Level 8: 83 kg
- Level 9: 102 kg
- Level 10: 123 kg (Cap)

#### Progression Pacing Timeline (Simulation vs 10-Minute KPI)
- **Minute 0 - 3 (Starter Onboarding)**:
  - Earnings: ~12-25 coins per haul.
  - Purchases: Range L2 (50c), Capacity L2 (85c).
  - Retention triggers: 'first_crush' achievement (+50c), Daily Login (+100c).
  - Tier 2 unlocked at ~2.5 - 3.5 minutes (750c).
- **Minute 3 - 6 (Mid-Game Transition)**:
  - Earnings: ~90-180 coins per haul.
  - Purchases: Capacity L3 (127c), Speed L2/L3 (145c/210c), Power L2/L3 (99c/141c).
  - First hazard encounters (Critters, EMP Mines, Rival).
- **Minute 6 - 10 (Deep Engagement & Retention Peak)**:
  - Accumulating 5,000 coins for Tier 3 unlock (achieved at minute 7-9).
  - Fever mode and Scrap Storms utilized for large haul spikes (500 - 1,500 coins).
- **Minute 10 - 20 (Late-Game Mastery & Endgame)**:
  - Player operates in Tier 3 / Tier 4.
  - Tier 4 unlocked (25,000c) around minute 15-20 (strictly verified in `m-o1-economy-stress.test.ts`).
  - High-tier items: Rocket Nozzle (800c), Catalytic Converter (340c).
  - Prestige unlocked upon entering Tier 4.

---

### 4. Comprehensive File & Line Reference Guide

| System / Component | Primary Source File | Key Lines / Functions | Purpose / Config Values |
|---|---|---|---|
| **Constants & Formulas** | `src/config/constants.ts` | Lines 49-213 | `SCRAP_CATALOG`: item masses, values, spawn weights |
| | | Lines 218-259 | `JUNKYARD_TIERS`: quotas (45, 60, 75, 80), unlock costs (0, 750, 5000, 25000) |
| | | Lines 264-289 | Stat curves: `getCarryCapacity`, `getMovementSpeed`, `getAttractPower`, `getMagnetRange` |
| | | Lines 291-340 | `getUpgradeCost`, `UPGRADE_BASE_COSTS`, `UPGRADE_COST_MULTIPLIERS` |
| | | Lines 345-364 | `GAME_CONSTANTS`: Pool size (260), respawn interval (1500ms), min dists (180, 220) |
| **Recycler & Compactor** | `src/scenes/JunkyardScene.ts` | Lines 302-364 | `buildRecyclerStation`: crusher press sprite, emitters |
| | | Lines 552-555 | Compactor processing interval: `Math.max(30, 75 - (cap - 1) * 5)` |
| | | Lines 643-682 | `triggerRecyclerCooldown`: 2500ms cooldown lockout |
| | | Lines 446-455 | Scrap Storm trigger (every 60s) |
| **Scrap Pooling & Spawning** | `src/entities/ScrapPool.ts` | Lines 81, 108 | Golden scrap probabilities (5% base, 20% storm) |
| | | Lines 120-186 | `spawnForZone`: weighted scrap selection & coordinate search |
| | | Lines 188-213 | `respawnTick`: zone quota maintenance & batch clamp (up to 4/tick) |
| **Hazard Orchestration** | `src/entities/hazards/HazardManager.ts` | Lines 24-25, 32 | Rival spawn interval (210s), initial delay (180s) |
| | | Lines 37-40 | Scrap Critter pool (12 critters) |
| | | Lines 43-52 | EMP Mine positions (8 fixed locations in Tiers 2-4) |
| | | Lines 70-90 | `updateCritterSpawns`: quota per tier `{ 1: 0, 2: 2, 3: 4, 4: 6 }` |
| | | Lines 101-175 | `update`: critter collision, EMP detonation, rival spawning loop |
| **Hazard Entities** | `src/entities/hazards/ScrapCritter.ts` | Lines 35, 98 | Roam speed (`60 + tier*15`), repel power threshold (700) |
| | `src/entities/hazards/EMPMine.ts` | Lines 12, 46 | Re-arm cooldown (20s), magnet disable duration (3s) |
| | `src/entities/hazards/RivalScavenger.ts` | Lines 10-16 | Active duration (30s), vacuum radius (130px), speed (190px/s) |
| | `src/entities/hazards/DestructibleCrate.ts`| Lines 13, 42, 59 | Respawn delay (45s), scrap count (4-6), golden chance (15%) |
| **Combo & Economy Services**| `src/services/economy/ComboManager.ts` | Lines 12-25 | Combo thresholds (1.5x, 2.0x, 3.0x, 5.0x Fever) |
| | `src/services/economy/ChallengeManager.ts` | Lines 15-40 | Micro-challenges & coin payouts |
| | `src/services/economy/AchievementManager.ts` | Lines 10-60 | Milestone achievements (50-500 coins) |
| **Unit Test Suites (Oracles)**| `tests/unit/m-o1-economy-stress.test.ts` | Lines 36-145 | Exact oracle for 19,209 upgrade sum and 49,959 grand total |
| | `tests/unit/adversarial-m-o1.test.ts` | Lines 29-110 | Exact boundary and monotonicity tests for carry capacity |
| | `tests/unit/economy.test.ts` | Lines 76-96 | Base costs & multiplier assertions |
| | `tests/unit/hazards.test.ts` | Lines 1-332 | Hazard interaction & state assertions |

---

## Actionable Recommendations for Balancing Implementation

1. **Compactor Pacing & Time-Based Escalation (1-3 min anti-churn, 5+ min escalation)**:
   - Add a session timer property `sessionPlayTimeSeconds` in `JunkyardScene.ts` (incremented via delta in `update()`).
   - **Minutes 0 - 3**:
     - Maintain existing Tier 1 safe zone (0 critters, 0 EMP mines, no rival).
     - Ensure compactor thermal cooldown is gentle (e.g. 1.5s - 2.0s in early minutes, or instant for first 3 runs).
   - **Minutes 5+**:
     - Implement dynamic difficulty scaling in `HazardManager.ts`:
       - Scale Rival Scavenger spawn frequency: reduce interval from 210s down to 120s after 5 minutes, or increase vacuum speed.
       - Scale Scrap Critter roam speed by 15-20% after 300s.
       - Speed up Compactor processing throughput (rewarding high-speed harvesting) or add a visual high-pressure compactor rhythm.

2. **Scrap & Hazard Rate Tuning**:
   - The current scrap quotas (45, 60, 75, 80) and 1,500ms respawn interval provide smooth performance and steady supply.
   - For mid-to-late game engagement (minute 5-10), consider increasing Scrap Storm frequency after minute 5 (e.g. interval decreasing from 60s to 45s) or boosting golden crate chance during escalation.

3. **Upgrade Costs & Scrap Yields**:
   - **Crucial**: Do NOT alter the core upgrade formulas `getMagnetRangeCost`, `getAttractPowerCost`, `getCarryCapacityCost`, `getMovementSpeedCost`, or `getCarryCapacity` directly without updating the strict oracle tests in `tests/unit/m-o1-economy-stress.test.ts` and `tests/unit/adversarial-m-o1.test.ts`.
   - The existing economy already requires **>= 15 minutes** to reach Tier 4 and ~25-35 minutes to max all upgrades, which natively satisfies and exceeds the "lasting >= 10 minutes" criterion.
   - Fine-tuning should focus on early-game gratification (first 1-3 minutes): ensure beginner players get their first 2-3 upgrades and Tier 2 unlock smoothly to eliminate early drop-off (anti-churn).

---
*End of Report.*
