# Session Narrative

## Current Session (2025-12-04) - Module Reward System & Character Sheet Redesign

### 🎮 NEW FEATURE: Ship Objective Module Rewards (Hades-style Boon System)

**Overview:**
Each ship (level) comes with an objective. Upon completion, the player receives a **module** - major game-shifting powers that aren't class-specific. This creates unique playthroughs similar to Hades' boon system.

**Module Reward System:**
- **Objective Types:**
  - Simple: "Kill all enemies"
  - Retrieval: "Retrieve item X"
  - Rescue: "Rescue person Y"
  - Other quest variants

- **Module Selection (Hades-style):**
  - Each ship has a **Major Faction** and **Minor Faction**
  - Upon objective completion, player chooses **1 of 3 modules**:
    - 2 options from Major Faction module pool
    - 1 option from Minor Faction module pool
  - Random selection from faction's pool, but player has choice

- **Ship Selection Preview:**
  - Before entering a ship, player sees:
    - Ship objective preview
    - Major/Minor faction indicators
    - Example modules from those factions (not exact rewards, but representative)
  - Allows strategic routing: "I want Imperial modules, so I'll take ship 2R instead of 2L"

**Module Design Principles:**
- Must be useful to ANY class (at least somewhat)
- Major game-shifting powers
- Create unique playsthroughs through combinations

**Example Major Modules:**
- **Fly** - Enables flight/hover movement
- **Dual Wielding** - Use two weapons simultaneously
- **Pistol Expertise** - Massive pistol damage/handling boost
- **Faction Diplomat** - +10 Charisma vs specific faction (e.g., Imperials)
- **Enhanced Jump** - Double/triple jump height
- **Speed Demon** - Significantly increased movement speed
- **Shield Generator** - Energy-based shield that absorbs damage
- **Ricochet Shots** - Bullets bounce to additional targets
- **Cloaking Device** - Temporary invisibility
- **Weapon Mastery (Type)** - Expertise with rifles/sabers/launchers/melee

**Implementation Tasks:**
1. Design 8-10 modules per faction (8 factions = 64-80 total modules)
2. Create module preview UI for ship selection screen
3. Implement objective tracking per ship
4. Build module selection screen (post-objective completion)
5. Apply module effects to player stats/abilities
6. Persist modules across level transitions
7. Display active modules in character sheet

**Faction Module Themes:**
- **Rebels:** Resourcefulness, adaptability, underdog bonuses
- **Imperials:** Discipline, organization, overwhelming force
- **Clones:** Teamwork, precision, battlefield tactics
- **Mandalorians:** Combat mastery, honor, weapon expertise
- **Sith:** Dark powers, aggression, fear-based abilities
- **Aliens:** Diversity, unique biology, exotic tech
- **Droids:** Logic, efficiency, technical superiority
- **Takers:** Scavenging, survival, improvisation

---

## Previous Session (2025-12-02) - Simplified Stat Progression System

### ✅ COMPLETED: Simplified D20 SRD Stat Progression

**Complete stat system overhaul** to make progression easier to understand and more predictable:

**New System Design:**
- ✅ **Strong base stats at creation** - Each class starts with stats appropriate to their playstyle
- ✅ **+2 to primary stat every 5th level** - Clean, predictable progression at levels 5, 10, 15, 20
- ✅ **Other stats mostly static** - Small thematic growth only (CON for survivability, DEX for combat classes)
- ✅ **No complex rotation** - Replaced old every-level stat rotation with simple milestone system

**All Four Base Classes Updated:**

1. **Hunter Killer (STR Primary)** - 3 Skills
   - Starting: STR 16, DEX 12, CON 14, INT 10, WIS 10, CHA 8
   - STR progression: 18 (L5), 20 (L10), 22 (L15), 24 (L20)
   - Minor: DEX +3, CON +3 over 20 levels
   - Skills: **Intimidate** (cause fear/flee), **Jump** (+0.05 height/level), **Repair** (heal droids/self like Medicine)

2. **Protocol Droid (CHA Primary)** - 7 Skills
   - Starting: STR 8, DEX 10, CON 9, INT 12, WIS 13, CHA 16
   - CHA progression: 18 (L5), 20 (L10), 22 (L15), 24 (L20)
   - Minor: DEX +3, CON +3, INT +3, WIS +3 over 20 levels
   - Skills: **Jump** (+0.02 height/level), **Diplomacy** (talk to non-hostiles), **Gather Info** (see distant ships/docks), **Medicine** (heal 5%/level at new level), **Repair** (heal droids/self), **Slicing** (d20 roll), **Speak Languages** (automatic at L1)

3. **Slicer/Techie (INT Primary)** - 7 Skills
   - Starting: STR 8, DEX 13, CON 10, INT 16, WIS 12, CHA 8
   - INT progression: 18 (L5), 20 (L10), 22 (L15), 24 (L20)
   - Minor: DEX +5, CON +3, WIS +3 over 20 levels
   - Skills: **Craft** (+1 weapon damage chance), **Jump** (+0.01 height/level), **Medicine** (d20 roll heal), **Repair** (heal droids/self), **Scavenge** (+Wire at new level), **Slicing** (d20 roll), **Speak Language** (+1/level)

4. **Adept (WIS Primary)** - 4 Skills (Cannot speak to droids!)
   - Starting: STR 12, DEX 12, CON 12, INT 10, WIS 16, CHA 12
   - WIS progression: 18 (L5), 20 (L10), 22 (L15), 24 (L20)
   - Minor: STR +6, DEX +5, CON +3, INT +2, CHA +3 over 20 levels (most balanced)
   - Skills: **Gather Info** (see distant ships), **Jump** (+0.08 height/level), **Telepathy** (Speak Languages + Handle Animal, non-droids only), **Mind Trick** (Diplomacy with advantage, non-droids), **Heal** (uses Energy, heals droids or biologicals)

**Key Benefits:**
- 📊 **Much easier to understand** - Players see their primary stat grow predictably
- 🎯 **Clear class identity** - Base stats immediately show class strengths/weaknesses
- 🧮 **Less bookkeeping** - No rotating stat bonuses to track every level
- ⚖️ **Maintained balance** - All classes reach similar power levels by L20

**Files Modified:**
- ✅ `data/ClassesAndSkills/class_progression_tables.json` - Updated all 20 levels for all 4 base classes

**Ready for Testing:**
- Server running at `http://localhost:8000`
- Combat bonuses, armor, weapon slots, allies all unchanged
- Only stat progression simplified

### 📋 PLANNED: Skill System Simplification

**New Skill Progression Design:**
- **Skill rank equals character level** - All class skills start at rank 1 (level 1) and automatically increase to rank 20 (level 20)
- **Variable skill counts**: HK (5 skills), Adept (6 skills), Protocol (9 skills), Techie (9 skills)
- **Level 20 skill cap** - All class skills reach rank 20 at level 20 (naturally, since skill rank = level)
- **No skill point allocation** - Skills auto-advance with level, no player choice needed
- **Clear specialization** - Each class's skill list defines their identity
- **Future: Bonus class skills** - Eventually allow selecting 1-2 skills from outside class as bonus class skills (at camp/level-up)

**Universal Skills (Available to All):**
- **Jump** - Four variants (Jump 1-4) with different jump height bonuses per level
- **Insight** - Defense against Bluff/Diplomacy (CLASS ONLY - cannot select as bonus)
- **Repair** - Heal droids/self (works like Medicine for droids)

**Skill Details by Class:**

**Hunter Killer (5 skills):**
1. **Intimidate** - Cause fear/fleeing (backfires into combat if failed) [CLASS ONLY]
2. **Jump 3** - +0.05 jump height per level
3. **Repair** - Heal droids/self (works like Medicine for droids)
4. **Overload** - +2% energy regeneration per level (stacks with base 3% = 5% total)
5. **Running 3** - +3% movement speed per level

**Protocol Droid (9 skills):**
1. **Jump 2** - +0.02 jump height per level
2. **Diplomacy** - Talk to non-hostiles, +1/level to roll [CLASS ONLY]
3. **Gather Information** - See distant ships/docks AND see all docks between ships and secret pathways (skill level = ships away visible)
4. **Medicine** - Heal non-droid allies 5% per skill level at new level
5. **Repair** - Heal droids/self (works like Medicine for droids)
6. **Slicing** - Hack terminals/spawners (d20 roll + skill)
7. **Speak Languages** - Automatic at level 1, all languages [CLASS ONLY]
8. **Haggle 2** - Reduce shop prices by 1.0% per level (max -20% at L20, credits only)
9. **Running 2** - +2% movement speed per level

**Techie/Slicer (9 skills):**
1. **Craft** - +40% chance/rank for +1 weapon damage (cumulative: rank 3 = +1 and 20% of +2)
2. **Jump 1** - +0.01 jump height per level
3. **Medicine** - Heal non-droids (d20 roll: 5-10=10%, 11-15=20%, 16-20=30%, 21-25=40%, 25+=50%)
4. **Repair** - Heal droids/self (same as Medicine)
5. **Scavenge** - Bonus Wire at new level (10-15: +1 Wire, 16-20: +2 Wire, etc.)
6. **Slicing** - Hack terminals/spawners (d20 roll + skill)
7. **Speak Language** - +1 language per level
8. **Insight** - Defense against Bluff/Diplomacy [CLASS ONLY]
9. **Haggle 1** - Reduce shop prices by 0.5% per level (max -10% at L20, credits only)

**Adept (6 skills, CANNOT SPEAK TO DROIDS):**
1. **Gather Information** - See distant ships/docks AND see all docks between ships and secret pathways (same as Protocol)
2. **Jump 4** - +0.08 jump height per level
3. **Telepathy** - Speak Languages + Handle Animal (non-droids only) [CLASS ONLY]
4. **Mind Trick** - Works as Diplomacy with advantage (non-droids only) [CLASS ONLY]
5. **Heal** - Self or others, droids or biologicals, uses Energy (heals allies first, then self at end of ship) [CLASS ONLY]
6. **Running 4** - +4% movement speed per level

**Jump Variants:**
- **Jump 1** (Techie): +0.01 jump height per level
- **Jump 2** (Protocol): +0.02 jump height per level
- **Jump 3** (HK): +0.05 jump height per level
- **Jump 4** (Adept): +0.08 jump height per level

**Additional Universal Skills:**

**Overload** - +2% energy regeneration per level (stacks with class base regen)
- HK gets this skill: Base 3% energy regen/level + Overload 2%/level = 5% total

**Assess** - See extended enemy info at range (health, name, level relative to Gonk, danger rating)
- Range/detail increases with skill level

**Haggle (3 variants)** - Reduce shop prices (credits only, not Wire costs)
- **Haggle 1** (Techie): -0.5% per level (max -10% at L20)
- **Haggle 2** (Protocol): -1.0% per level (max -20% at L20)
- **Haggle 4** (future class): -2.0% per level (max -40% at L20)

**Running (4 variants)** - Increase movement speed
- **Running 1** (future class): +1% per level
- **Running 2** (Protocol): +2% per level
- **Running 3** (HK): +3% per level
- **Running 4** (Adept): +4% per level

**Implementation Status:**
- ✅ Skill details fully specified
- ⏳ Need to update `class_progression_tables.json` with correct skill lists
- ⏳ Need to implement skill mechanics (Jump height, Craft rolls, Medicine/Repair healing, etc.)
- ⏳ Skills currently in progression table but not enforced in-game
- ⏳ **TODO: Add Overload to HK, Haggle to Protocol/Techie, Running to all classes**
- ⏳ **TODO: Implement bonus class skill selection system** (allow picking 1-2 non-class skills as class skills)
- ⏳ **TODO: Mark certain skills as CLASS ONLY** (cannot be selected as bonus skills)
- ⏳ **TODO: Level cap extension system** (powerup to reach level 30, only affects stats + HP)

### 📋 FUTURE: Additional Class Powers (Fixed Bonuses)

These powers from Star Wars games would work well as **fixed class features** (not skills) for future classes:

**Combat/Physical Powers:**
- **Tumble/Acrobatics** - Dodge attacks, reduce fall damage, move through enemy spaces
- **Weapon Focus** - +1 to hit with specific weapon type (pistols, rifles, melee)
- **Dual Wield** - Use two weapons simultaneously (increased energy cost)
- **Unarmed Combat** - Melee attacks without weapons, grapple enemies
- **Demolitions** - Set/disarm explosives, bonus damage with grenades/rockets

**Technical Powers:**
- **Security** - Bypass locks, disable security systems
- **Computer Use** - Hack computers faster/better outcomes than Slicing
- **Droid Programming** - Reprogram droid behavior, improve droid ally stats
- **Construct** - Build turrets, shields, or temporary defenses (uses Wire)

**Knowledge/Tactical Powers:**
- **Lore (Star Wars)** - Identify enemy weaknesses, know faction histories
- **Survival** - Find secret paths, reduce hazard damage, track enemies
- **Tactics** - Grant temporary combat bonuses to allies
- **Xenology** - Bonus to recruiting/talking to specific alien species

**Social/Manipulation Powers:**
- **Bluff** - Lie convincingly, opposed by Insight
- **Taunt** - Anger enemies into making mistakes (lower their accuracy)
- **Leadership** - Improve ally morale/combat effectiveness
- **Interrogation** - Extract info from defeated enemies before they die

**Force-Adjacent Powers (non-Force versions):**
- **Empathy** - Sense NPC emotions/intentions, bonus to social checks
- **Focus** - Reduce energy costs or improve energy regen temporarily
- **Battle Meditation** (non-Force) - Buff allies through tactical coordination
- **Danger Sense** - Warning before ambushes, improved dodge chance

**Gonk-Specific Powers:**
- **Power Transfer** - Give energy to allies or drain from enemies
- **Emergency Protocols** - Auto-heal when dropping below 25% HP (once per level)
- **Faction Mimicry** - Disguise as another faction temporarily
- **Jury Rig** - Create temporary weapon mods from scrap (doesn't persist)
- **Holo-Decoy** - Create a fake Gonk to distract enemies
- **Pilot** - Fly ships/vehicles, better handling/damage in vehicle sections

**Potential Future Class Combinations:**
- **Bounty Hunter**: Pilot, Demolitions, Assess, Security, Dual Wield, Taunt
- **Spy**: Bluff, Security, Stealth, Assess, Slicing, Faction Mimicry
- **Engineer**: Computer Use, Droid Programming, Construct, Craft, Repair, Security
- **Commando**: Demolitions, Tactics, Leadership, Weapon Focus, Unarmed Combat, Survival

### 📋 PLANNED: HP & Damage System Overhaul

**New HP Formula:**
- **Starting HP = (5 × CON) + (1 × class HP per level)**
- **Example (HK with CON 14, 12 HP/level)**: `(5 × 14) + 12 = 82 HP` at level 1
- **Example (Protocol with CON 9, 6 HP/level)**: `(5 × 9) + 6 = 51 HP` at level 1
- **Level-up HP gain**: Class HP per level value (HK +12, Slicer +6, Protocol +6, Adept +7)
- **CON bonus applies retroactively** - If CON increases, recalculate full HP

**Current HP values** (from `class_progression_tables.json`):
- Hunter Killer: 18 base + 8/level → **Will become**: CON-based + 12/level
- Slicer: 14 base + 6/level → **Will become**: CON-based + 6/level
- Protocol Droid: 12 base + 5/level → **Will become**: CON-based + 6/level
- Adept: 16 base + 7/level → **Will become**: CON-based + 7/level

**New Damage System:**
- **Weapon damage range**: 2d4 to 3d8 (minimum 2, maximum 24 damage)
- **Current system**: Weapons deal 1-3 base damage (too low)
- **Dice progression examples**:
  - Weak pistols: 2d4 (2-8 damage)
  - Standard rifles: 2d6 (2-12 damage)
  - Heavy blasters: 2d8 (2-16 damage)
  - Sniper rifles: 3d6 (3-18 damage)
  - Rocket launchers: 3d8 (3-24 damage)

**Implementation Status:**
- ⏳ HP formula needs update in `character_stats_manager.js`
- ⏳ Damage dice system needs implementation in `player_gear.js` and weapon configs
- ⏳ Weapon JSON files need damage dice notation (e.g., `"damage_dice": "2d6"`)
- ⏳ NPC weapons need dice damage too

### 🎨 Character Sheet Layout Redesign (Previous Session Continuation)

From the previous session's work, the character sheet UI was completely redesigned:

**Layout Changes:**
- ✅ **Ultra-narrow left panel (180px)** - Compact class/level/stat display with small fonts (9-14px)
- ✅ **Massive progression table** - Takes ~90% of screen width with large fonts (15-20px)
- ✅ **Removed "Gonk Pope Status" box** - No longer needed
- ✅ **Resource counter relocated** - Blue-outlined box in bottom-right corner (Wire, Spare Cores, Credits)
- ✅ **Level Up button moved** - From character sheet (C) to cheats menu (P)
- ✅ **F9 fullscreen toggle** - Enter/exit fullscreen mode

**Grid Layout:**
- Changed from `250px 1fr` to `180px 1fr` (narrower left panel)
- Removed gap and padding for maximum table space
- Sticky table headers while scrolling
- Color-coded stats (STR, DEX, CON, etc. in yellow)

**Files Modified:**
- ✅ `main.js` - Fixed toggleCharacterSheet, added F9 fullscreen, credits state, level-up button handler
- ✅ `index.html` - Changed grid layout, removed Gonk Pope Status, added resource box, added level-up to cheats
- ✅ `data/ClassesAndSkills/character_upgrades.js` - Ultra-compact left panel, massive table design

---

## Previous Session (2025-12-01) - D20 SRD Class System + File Organization

### 📁 File Path Updates (Game Stays Playable)

Fixed all references to moved ClassesAndSkills files to ensure game continues working:
- ✅ **index.html**: Updated script paths for `character_upgrades.js`, `Gonkjedi_and_saber_effects.js`, `NPCjedi_and_saber_effects.js`
- ✅ **asset_loaders.js**: Updated `gonk_base_stats.json` path to `data/ClassesAndSkills/`
- ✅ **Renamed files**: `recovered_memories_*.json` → `permanent_nodes_*.json` (5 files)
  - **Classes** = current progress (levels, powers gained this run)
  - **Permanent nodes** = unlocked history (wire-purchased memories that persist through death)

### 🎮 Four-Class System (20 Levels Each)

Designed complete D20 SRD-based class progression for Gonk.

**📄 Full Documentation**:
- **`data/ClassesAndSkills/character_stats_system.md`** - Core stat system, HP formula, damage calculation, starting stats
- **`data/ClassesAndSkills/class_comparison.md`** - Complete class breakdown, skill point totals, design philosophy
- **`data/ClassesAndSkills/level_progression_visual.md`** - Visual level-by-level table for all 4 classes, multiclass examples
- **`data/ClassesAndSkills/implementation_order.md`** - Implementation difficulty analysis, phase planning
- **`data/ClassesAndSkills/gonk_class_*.json`** - Individual class JSON files (Protocol, HK, Tech, Adept)

**Quick Summary**:
- **Protocol** (CHA/WIS): Recruiter, 2 skills/lvl, early 2nd ally at L3, max 12 allies at L40
- **HK** (DEX/STR): Solo killer, 1 skill/lvl, progressive damage scaling, max 2 allies
- **Tech** (INT/DEX): Hacker, 3 skills/lvl, droid control (1→unlimited), stackable weapon mods
- **Adept** (WIS/CHA): Force user, 2 skills/lvl + 5 FP/lvl, Light/Dark choice at L15

**Key Mechanics**: No AC (FPS aim-based), multiclassing, wire currency, permanent "Recovered Memory" nodes, roguelike death (levels reset, nodes persist)

### ✅ HK CLASS IMPLEMENTED & PLAYABLE

**Core D20 System Live** (see `character_stats_system.md`):
- **Low damage/HP economy**: Weapons deal 1-3 base damage, HP ranges 10-30
- **HP = CON + levels**: Base HP equals CON stat (10 default) + class HP per level
- **Gonk blank slate**: All stats start at 10, class selection applies stat mods
- **Primary stat choice**: HK chooses STR (melee) or DEX (ranged), gets +4 to chosen stat
- **Flat damage bonuses**: +1, +2, +3 damage (not percentages)
- **Stat damage bonus**: STR for melee, DEX for ranged (formula: `floor((stat-10)/2)`)

**HK Starting Stats (DEX build)**: `DEX 14, CON 12, WIS 8, CHA 8` → **20 HP** (12 CON + 8 HK)

### 🎯 Implementation Status

**✅ COMPLETED:**
- ✅ Ability score system (STR/DEX/CON/INT/WIS/CHA)
- ✅ HP = CON + class levels formula
- ✅ Class selection UI (all 4 classes shown, HK playable)
- ✅ HK primary stat choice (STR melee vs DEX ranged)
- ✅ Starting stat modifiers (+4 primary, +2 CON, -2 WIS/CHA)
- ✅ Level-up system with power application
- ✅ HK Powers L1-10 implemented (Hunter Killer, Weapon Mastery, Burst Fire, etc.)
- ✅ C screen redesigned: Level display on left, powers on right
- ✅ Debug buttons: Level Up, Heal
- ✅ **STAT SYSTEM SIMPLIFIED**: +2 to primary stat every 5th level (levels 5, 10, 15, 20)

---

## Next Steps & Future Work

### 📋 Interactive Purchasing Menus (Planned)
User requested system for furniture/NPC-based purchasing stations:
- Need ability to create interactive purchasing menus in-game
- Will be used for skill training, items, etc.
- Should integrate with existing furniture/NPC systems

### 📋 Skill System (Planned)
Complete skill list per class from user-provided image:
- Need to incorporate full skill assignments per class
- May integrate with purchasing menu system

### 📋 Known Issues
- **Browser Cache**: Hard refresh (Ctrl+Shift+R) may be needed for HUD/UI changes
- **Level 20 Quest System**: Quest definitions exist but may not activate properly

---

## File Change Log (This Session)

**Intentional Changes:**
- ✅ `data/ClassesAndSkills/class_progression_tables.json` - Simplified stat progression for all 4 base classes (Hunter Killer, Slicer, Protocol Droid, Adept)
  - Removed complex every-level stat rotation
  - Implemented +2 to primary stat at levels 5, 10, 15, 20
  - Set strong base stats at level 1 for each class
  - Other stats grow minimally for thematic reasons only

## Session (2025-12-04) - Slicing Logic and Skill Refactor

### ✅ COMPLETED: Slicing System Overhaul

**New Slicing Difficulty Calculation:**
The difficulty of a slicing check now scales dynamically with the Player to ensure consistent challenge throughout the game (Level 1 to 40).
- **Formula**: `DC = 20 + NPC Level`
- **NPC Level Determination**: Based on Player Level modified by Spawner Threat (1-5).
  - **Threat 1**: 50% Player Level (Round Down, Min 1).
  - **Threat 2**: 75% Player Level.
  - **Threat 3**: 100% Player Level.
  - **Threat 4**: Min(`Player + 5`, `120% Player Level`).
  - **Threat 5**: Min(`Player + 5`, `140% Player Level`).
- **Cap Rule**: Weakest foes scale to at least 50% of player (e.g., Level 20 vs Level 40 Player). Strongest foes cap at Player Level + 5 (e.g., Level 45 vs Level 40 Player).

**Skill System Updates:**
- ❌ **Athletics Removed**: The umbrella "Athletics" skill has been removed from all game files.
- ✅ **New Physical Skills Added**:
  - **Running** (CON): Governs movement speed.
  - **Jump** (STR): Governs jump height.
  - **Climb** (STR): Governs climbing ability.
- **Slicing Bonus**: Now includes `Character Level` for the Slicer/Techie class (Base + INT + Level).

### ℹ️ Level Cap Policy
- **Level Cap Policy**:
- **Player Max Level**: **40**. Players cannot exceed level 40.
- **NPC Max Level**: **Uncapped**. NPCs can exceed level 40 (e.g., Threat 5 spawners against a max-level player will spawn Level 45 enemies).

### 📝 PENDING: Skill System Design Updates (To Be Implemented)

**Active D20 Skill Checks:**

1.  **Medicine (WIS)**:
    -   **Action**: Active Roll (`1d20 + Medicine Score`).
    -   **Effect**: Heals **each** biological/non-droid ally for the rolled amount (e.g., Roll 18 = Heal 18 HP).
    
2.  **Repair (INT)**:
    -   **Action**: Active Roll (`1d20 + Repair Score`).
    -   **Effect**: Heals **Gonk (Self)** and **each** droid ally for the rolled amount.

3.  **Gather Information (WIS)**:
    -   **Action**: Passive/Active check to see distant ships/nodes.
    -   **Rule**: **Persistent Visibility**. Once a ship is revealed by a high roll, it remains visible even if subsequent rolls are lower.

4.  **Craft (INT)**:
    -   **Action**: Active Roll (`1d20 + Craft Score`) at new **Weapon Forge** station.
    -   **Mechanism**: Select 1 owned weapon -> Roll.
    -   **Results**: Based on DC chart (e.g., DC 15=+1 Dmg, DC 20=+2 Dmg, DC 25=+3 Dmg).
    -   **Constraint**: Overwrites any existing modifications (Popup warning required).

5.  **Scavenge (INT)**:
    -   **Action**: Active Roll (`1d20 + Scavenge Score`) at **Level End Screen**.
    -   **Trigger**: Only on the **FIRST** time completing/leaving a specific ship level.
    -   **Reward**: Yields `Scrap` or `Wire` based on roll result.
    -   **UI**: "Gonk's extraordinary Scavenging skills yielded X Scrap from [ShipName]."

**Passive Skills (No Roll):**

1.  **Haggle**: Remains passive discount per level.
2.  **Overload**: Remains passive energy regen.
3.  **Run / Jump / Climb (Physical)**:
    -   **Mechanism**: Passive scaling based on Skill Rank (1-5).
    -   **Scaling**: Benefits increase with Rank.
        -   *Example (Run)*: Rank 1 = +0.5% Speed/Lvl. Rank 5 = +2.5% Speed/Lvl.
    -   **Note**: Skill Rank is distinct from Character Level (comes from Class/Module upgrades).
