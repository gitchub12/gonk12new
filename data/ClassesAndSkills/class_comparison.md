# Gonk Class Comparison (40 Levels)

## Design Philosophy

All classes follow the **every-other-level pattern**:
- **ODD levels (1, 3, 5, 7...)**: Stats/Training + Skill Points
- **EVEN levels (2, 4, 6, 8...)**: New Powers/Abilities

This creates a rhythm of power acquisition followed by character refinement.

---

## Skill Points Per Level Summary

| Class | Skills/Level | Total at L40 | Reasoning |
|-------|-------------|--------------|-----------|
| **Protocol** | 2 | 80 | Social specialist needs moderate skills for diplomacy, languages |
| **HK** | 1 | 40 | Pure combat focus, minimal utility skills needed |
| **Tech** | 3 | 120 | Highest skill user - hacking, engineering, multiple disciplines |
| **Adept** | 2 | 80 | Force powers supplement skills, balanced progression |

---

## Class Feature Breakdown

### Protocol Droid (Diplomatic/Recruiting)
- **Primary Stats**: CHA, WIS
- **HP/Level**: 4 (fragile, relies on allies)
- **Skills/Level**: 2
- **Key Progression**:
  - L1: Pamphlet Toss (signature ability)
  - L3: +1 Ally (2 total) - **early second ally**
  - L7, 11, 15, 19, 25, 29, 33, 37: +1 Ally each (max 10 allies at L37)
  - L40: Max 12 allies, allies can be +3 levels above Gonk
- **Ally Scaling**: 1.3× XP, can exceed Gonk level, 80% faction decay reduction

### HK Combat Droid (Assassination/Pure Damage)
- **Primary Stats**: DEX, STR
- **HP/Level**: 8 (tanky solo killer)
- **Skills/Level**: 1
- **Key Progression**:
  - L1: Hunter Killer (+10% vs organics)
  - Every even level: New damage/accuracy/crit power
  - L28: Omega Protocol I (3× damage)
  - L36: Omega Protocol II (5× damage)
  - L40: Revan's Shadow (ultimate power)
- **Ally Scaling**: 0× XP, max 2 allies, -10 recruitment penalty

### Tech Specialist (Hacking/Droid Control)
- **Primary Stats**: INT, DEX
- **HP/Level**: 5 (moderate survivability)
- **Skills/Level**: 3 (highest)
- **Key Progression**:
  - L1: Master Slicer (+10 Use Device)
  - L4, 16, 22, 30, 36: Droid Command (1→2→3→4→5 droids)
  - L6, 12, 18, 24, 28, 32, 38: Weapon Mods (stack benefits)
  - L40: Droid Overlord (unlimited droids, all mods active)
- **Ally Scaling**: 1.0× XP, hacked droids don't count against limit

### Force Adept (Jedi/Sith Powers)
- **Primary Stats**: WIS, CHA
- **HP/Level**: 4
- **Skills/Level**: 2
- **Force Points/Level**: 5 (200 FP at L40)
- **Requires**: Recovered Memory: Temple Guardian (5000 wire unlock)
- **Key Progression**:
  - L1: Force Sensitivity (unlock FP pool)
  - L2: Lightsaber Proficiency
  - L15: **Alignment Choice** (Light/Dark)
  - L16, 20, 24, 28, 32, 36, 40: Alignment-specific powers
  - L40: Jedi Master OR Sith Lord ultimate
- **Ally Scaling**: 1.0× XP, Force-sensitive allies gain +5 FP per Gonk level

---

## Multiclassing

Gonk can freely mix class levels. Examples:
- **Protocol 20 / HK 10 / Tech 10**: Charismatic leader with combat and hacking skills
- **Adept 30 / Protocol 10**: Force-wielding diplomat with moderate ally support
- **HK 40**: Pure damage build, solo powerhouse

**Recommendation**: Primary class to 20, then branch to 2nd class for versatility.

---

## Power Level Comparison at Level 40

| Class | Allies | Damage Output | Survivability | Utility |
|-------|--------|---------------|---------------|---------|
| Protocol | 12 (max) | Low (ally-dependent) | Low | Very High |
| HK | 2 (max) | Extreme | Very High | Very Low |
| Tech | 4 + unlimited droids | High (mod-enhanced) | Moderate | Extreme |
| Adept | 4 | High (Force/saber) | High (barriers) | High |

---

## Every-Other-Level Pattern Example (Protocol L1-10)

| Level | Type | Feature |
|-------|------|---------|
| 1 | Power | Pamphlet Toss |
| 2 | Stats | +1 CHA, +1 WIS, +2 SP |
| 3 | Stats | +1 Max Ally (2 total), +2 SP |
| 4 | Power | Ally Bonding (+1 level on recruit) |
| 5 | Stats | +1 CHA, +2 SP |
| 6 | Power | Charismatic Presence (+1 morale) |
| 7 | Stats | +1 Max Ally (3 total), +2 SP |
| 8 | Power | Fast Talk (reroll social check) |
| 9 | Stats | +1 WIS, +2 SP |
| 10 | Power | Recruitment Mastery (+5 recruit DC) |

**Pattern holds for all 40 levels** - powers on evens, stats on odds (with occasional variations like Protocol's ally boosts).

---

## Design Notes

- **No AC (Armor Class)**: FPS accuracy-based combat, no D&D armor rolls
- **Languages as Skill Sink**: Non-Basic languages (Ugnaught, Wookiee, Ewok) cost skill points
- **Death Reset**: Levels reset, permanent nodes persist with respec option
- **Wire Currency**: Unlocks permanent "Recovered Memory" nodes via Babu Frik NPC
- **Modules**: Become level-complete rewards instead of random loot
