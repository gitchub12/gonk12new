# D20 Consolidation & Refactor Plan

## Overview
This document outlines the steps to audit, merge, and delete legacy files to fully unify the game under the D20 Attribute/Skill/Stat system.

## 1. Identified Legacy Files & Systems

### A. Ability & Power Systems (High Priority)
*   **Target**: `e:\gonk\Gonkjedi_and_saber_effects.js`
    *   **Issue**: Contains independent logic for Bolt Reflection, Force Heal (fixed 50 HP), and Mind Trick. Hardcoded energy costs. Independent state (`this.boltReflectionEnabled`).
    *   **Recommendation**:
        *   Migrate generic mechanics (Reflection logic) to `PlayerWeaponSystem` or `Environment`.
        *   Migrate capabilities (Heal, Mind Trick) to `CharacterStatsManager` "Class Powers" list.
        *   Use D20 logic (e.g. `Heal` = d20 + WIS, not fixed 50).
        *   **Delete File**.

*   **Target**: `e:\gonk\NPCjedi_and_saber_effects.js`
    *   **Issue**: Likely similar hardcoded logic for NPC Jedi.
    *   **Recommendation**:
        *   Move logic to `npc_behavior.js` or a unified `CombatSystem`.
        *   Ensure NPCs use `stat` checks for these effects.
        *   **Delete File**.

### B. Configuration & Constants (Medium Priority)
*   **Target**: `e:\gonk\game_and_character_config.js`
    *   **Issue**: Defines global constants like `MOVEMENT.SPEED`, `PLAYER.JUMP_STRENGTH`.
    *   **Conflict**: The D20 system calculates these dynamically (Stats * Modifiers).
    *   **Recommendation**:
        *   Move "Base" values to `data/ClassesAndSkills/gonk_base_stats.json`.
        *   Ensure `CharacterStatsManager` reads these bases, then applies modifiers.
        *   Remove `GAME_GLOBAL_CONSTANTS` reliance for dynamic stats.

*   **Target**: `e:\gonk\character_config.js`
    *   **Issue**: Likely old character definition.
    *   **Recommendation**: Audit and **Delete** if superseded by JSONs.

### C. Combat & Gear (Medium Priority)
*   **Target**: `e:\gonk\player_gear.js`
    *   **Issue**: `BlasterBolt` creates projectiles with fixed damage passed in config.
    *   **Action**: Verify `PlayerWeaponSystem` calls `window.characterStats.calculateDamage()` before spawning bolts. Update if necessary.

*   **Target**: `e:\gonk\interaction_system.js`
    *   **Issue**: May have hardcoded "skill checks" (e.g. distance checks, prompt logic).
    *   **Action**: Ensure interactions use `SkillSystem.rollSkillCheck` (already done for Slicing, check others).

### D. Data Files
*   **Target**: `e:\gonk\data\upgrade_nodes.json` & `upgrade_nodes_stacked.json`
    *   **Issue**: Old "Node" system.
    *   **Recommendation**: If these are the visual nodes in the sky, ensure they essentially just call `characterStats.grantModule()` or `grantStat()`. Ensure no "magic strings" remain that reference dead files.

*   **Target**: `e:\gonk\data\weapons.json` vs `data\gonkonlyweapons\*.json`
    *   **Issue**: Potential duplicate weapon definitions.
    *   **Recommendation**: Consolidate to single source of truth (likely the subfolder structure).

## 2. Execution Strategy (For Next Session)

1.  **Phase 1: The Jedi Purge**
    *   Extract logic from `Gonkjedi_and_saber_effects.js`.
    *   Re-implement "Force Heal" as a Class Power in `CharacterStatsManager`.
    *   Re-implement "Bolt Reflection" as a passive mechanic in `PlayerWeaponSystem` checked against `characterStats`.
    *   Delete the file.

2.  **Phase 2: Config Unification**
    *   Migrate `GAME_GLOBAL_CONSTANTS` bases to `CharacterStatsManager` defaults.
    *   Update `physics_controller.js` (or `main.js`) to read `characterStats.getSpeed()` instead of `GAME_GLOBAL_CONSTANTS.MOVEMENT.SPEED`.

3.  **Phase 3: Cleanup**
    *   Delete `character_config.js`.
    *   Archive `NPCjedi_and_saber_effects.js`.
    *   Verify `player_gear.js` damage pipelines.

## 3. Immediate "D20" Gaps
*   **Weapon Damage**: Ensure `NPC` damage (in `npc_behavior.js`) uses specific Dice Logic + Stat Modifiers, not just flat config values. (Partially underway with DiceSystem).
*   **Movement**: Ensure `Running` skill *actually* modifies the speed used by the physics controller.

**End of Plan**
