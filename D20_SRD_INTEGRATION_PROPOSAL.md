# D20 SRD Integration Proposal for Gonk

## Executive Summary

This proposal outlines a plan to integrate D20 System Reference Document (SRD) mechanics into Gonk while preserving the current game feel and Gonk's existing power level. The goal is to standardize character statistics across all NPCs and the player using a familiar, balanced framework that makes tuning easier.

## Current State Analysis

### Gonk's Current Stats (from game_and_character_config.js)
- **Health**: 100
- **Speed**: 0.05
- **Jump Force**: 0.008
- **Weapon Damage**: Variable by weapon (10-50+ base damage)
- **No explicit skill/stat system**: Combat and conversations use faction relationships, not character abilities

### Current NPC Stats (from data/factionJSONs/*.json)
Each NPC type has:
- `health`: Raw HP values (50-200)
- `speed`: Movement multiplier
- `perception_radius`: Detection range
- `attack_range`: Weapon-dependent
- `default_weapon`: Weapon key
- **No unified stat system**: Each faction/NPC is hand-tuned

### Problems This Solves
1. **Balancing Difficulty**: Hard to tune encounters without standard stat framework
2. **Conversation Checks**: Currently faction-based only; no character skill influence
3. **Progression Clarity**: Upgrades feel arbitrary without stat foundations
4. **NPC Variety**: All clones are identical; no elite/weak variants using same model

---

## D20 SRD Mapping Proposal

### Core Ability Scores (3-18 scale, 10 = average)

#### For Gonk (GNK Power Droid)
- **Strength (STR)**: 14 (+2) - Gonks are heavy-duty industrial droids
- **Dexterity (DEX)**: 8 (-1) - Slow, plodding movement
- **Constitution (CON)**: 16 (+3) - Exceptionally durable construction
- **Intelligence (INT)**: 10 (+0) - Basic programming, surprisingly adaptive
- **Wisdom (WIS)**: 12 (+1) - Survival instincts, situational awareness
- **Charisma (CHA)**: 6 (-2) - Gonk. Just... Gonk.

**Derived Stats**:
- **HP**: 10 + (CON modifier × level) = 10 + (3 × 10) = 40 base HP
  - _Scale factor: 2.5× for video game feel = **100 HP**_ (matches current!)
- **AC (Armor Class)**: 10 + DEX modifier + armor bonus = 10 - 1 + 5 (droid plating) = **14 AC**
- **Initiative**: DEX modifier = **-1**
- **Speed**: 20 ft/round (slow) → translates to current 0.05 movement speed

#### For NPCs (Example: Clone Trooper)
- **STR**: 13 (+1) - Well-trained soldier
- **DEX**: 14 (+2) - Combat agility
- **CON**: 12 (+1) - Military conditioning
- **INT**: 10 (+0) - Standard intelligence
- **WIS**: 11 (+0) - Tactical awareness
- **CHA**: 10 (+0) - Professional demeanor

**Derived Stats**:
- **HP**: 10 + (1 × 5) = 15 base → **38 HP** (scale 2.5×)
- **AC**: 10 + 2 + 4 (armor) = **16 AC**
- **Initiative**: +2

---

## Skill System Integration

### D20 SRD Skills Mapped to Gonk Gameplay

#### Combat Skills
- **Attack Bonus**: STR (melee) or DEX (ranged) + proficiency + weapon bonus
  - Gonk pistol attack: -1 (DEX) + 2 (proficiency) + 1 (weapon) = **+2 to hit**
  - Clone rifle attack: +2 (DEX) + 3 (proficiency) + 2 (weapon) = **+7 to hit**
- **Damage**: Weapon base damage + STR/DEX modifier
  - Gonk pistol: 1d6+0 (DEX penalty negated by weapon min) = **10-16 damage** (scale 3×: 30-48)

#### Social Skills (for Conversation System)
- **Diplomacy**: CHA + proficiency → Affects conversation tension reduction
- **Intimidate**: STR or CHA + proficiency → Aggressive conversation options
- **Bluff**: CHA + proficiency → Deception checks during dialogue
- **Sense Motive**: WIS + proficiency → Detect NPC lies, hidden agendas

**Example Conversation Check**:
```javascript
// Current: Pure faction relationship determines success
// Proposed: Faction relationship + skill check
const relationshipBonus = factionScore / 10; // 0-10
const skillBonus = character.getSkillModifier('diplomacy'); // -2 to +8
const roll = Math.floor(Math.random() * 20) + 1; // 1d20
const total = roll + relationshipBonus + skillBonus;
const DC = 15; // Difficulty Class
if (total >= DC) { /* Success */ }
```

#### Exploration Skills
- **Perception**: WIS + proficiency → Detection radius, spotting secrets
- **Stealth**: DEX + proficiency → Avoid NPC detection (future mechanic?)
- **Use Device**: INT + proficiency → Hacking, slicing (existing mechanic)

---

## Weapon Damage Conversion

### Current System
Weapons have raw damage values (10-50). No miss chance.

### Proposed D20 System
1. **Attack Roll**: 1d20 + attack bonus vs. target AC
   - **Hit**: Roll weapon damage dice + modifiers
   - **Miss**: No damage
   - **Critical (natural 20)**: Double damage dice

2. **Weapon Damage Table** (scaled for video game pacing):

| Weapon Type | D20 Damage | Gonk Scaled | Current Equivalent |
|-------------|------------|-------------|-------------------|
| Light Pistol | 1d6+DEX | 3-24 (avg 13) | ~15 |
| Heavy Pistol | 1d8+DEX | 4-32 (avg 18) | ~20 |
| Rifle | 1d10+DEX | 5-40 (avg 22) | ~25 |
| Heavy Rifle | 2d6+DEX | 6-48 (avg 27) | ~30 |
| Melee/Saber | 1d8+STR | 4-32 (avg 18) | ~20 |
| Launcher | 3d6 (splash) | 9-72 (avg 40) | ~50 |

_Scale factor: 4× base D20 damage for fast-paced combat_

---

## Level/Progression System

### Current System
- Upgrade nodes grant flat bonuses (e.g., +10 HP, +5% damage)
- No explicit character level

### Proposed Hybrid System
- **Character Level**: Hidden stat (1-20) that scales with upgrade purchases
- **Proficiency Bonus**: +1 per 4 levels (matches D20 SRD)
  - Level 1-4: +1
  - Level 5-8: +2
  - Level 9-12: +3
  - Level 13-16: +4
  - Level 17-20: +5

**Upgrade Node Conversion**:
- **"Constitution +1"**: Permanently increase CON score → +0.5 HP per level retroactively
- **"Weapons Training I"**: +1 proficiency bonus to ranged attacks
- **"Smooth Talker"**: +2 to Diplomacy checks
- **"Battle Hardened"**: +1 to all saving throws

### NPC Levels
- **Weak NPCs** (Scavengers, Scouts): Level 1-3
- **Standard NPCs** (Troopers, Rebels): Level 4-6
- **Elite NPCs** (Commanders, Bounty Hunters): Level 7-10
- **Boss NPCs** (Sith, Mandalorian Leaders): Level 11-15

---

## Saving Throws (Future Expansion)

For environmental hazards, force powers, special attacks:
- **Fortitude** (CON-based): Resist poison, disease, physical effects
- **Reflex** (DEX-based): Dodge explosions, traps
- **Will** (WIS-based): Resist mind tricks, fear

**Example**:
```javascript
// Grenade explodes near Gonk
const reflexSave = rollD20() + gonk.getDexModifier() + gonk.getProficiencyBonus();
const DC = 15;
if (reflexSave >= DC) {
    damage = damage / 2; // Half damage on successful save
}
```

---

## Implementation Phases

### Phase 1: Core Stat Foundation (No Gameplay Changes)
- Add `abilityScores` object to player and NPC configs
- Calculate derived stats (HP, AC, initiative) from abilities
- **Keep current combat**: Use stats for display only, don't change hit/damage yet
- **Goal**: Prove stats integrate cleanly without breaking existing balance

### Phase 2: Skill Checks in Conversations
- Add skill modifiers to conversation success calculations
- Add skill-based dialogue options (e.g., [Intimidate] "Hand over the keycard.")
- Display skill check results in UI ("Diplomacy check: 18 vs DC 15 - Success!")
- **Goal**: Make conversations feel more RPG-like with visible dice rolls

### Phase 3: Attack Rolls & AC
- Implement to-hit rolls vs. AC
- Add "miss" feedback (visual effect, no damage)
- Tune AC values so hit rate ≈ 70% (similar to current "always hit" feel)
- **Goal**: Add tactical depth without frustrating players

### Phase 4: Damage Dice & Critical Hits
- Replace flat damage with dice rolls + modifiers
- Add critical hit animations/sound effects
- Balance weapon damage dice to match current average DPS
- **Goal**: Add excitement variance without changing average combat length

### Phase 5: Expanded Systems (Post-Core Game)
- Saving throws for grenades, traps, force powers
- Skill checks for hacking, stealth, perception
- Leveling system with milestone XP
- Feat/perk selection every 3 levels

---

## Balancing Gonk's Power Level

### The Challenge
Gonk is currently viable despite being a "weak" droid. D20 stats could make Gonk feel underpowered compared to Clone Troopers.

### Solutions

#### 1. Class Features (Gonk-Specific Bonuses)
- **"Power Core Overload"**: Once per combat, explode for 4d6 damage in 10-ft radius, then reboot with half HP
- **"Energy Transfer"**: Heal allies by sacrificing own HP (support role)
- **"Plodding Inevitability"**: Cannot be knocked down or moved involuntarily
- **"Industrial Durability"**: Damage reduction 5/- (reduce all damage by 5)

#### 2. Equipment Scaling
- **Droid Upgrade Slots**: Gonk gets 6 upgrade slots vs. 4 for organics
- **Power-Hungry Weapons**: Only droids can use heavy energy weapons without penalties
- **Integrated Systems**: Gonk can install weapons as permanent fixtures (no disarm)

#### 3. Faction Reputation Bonus
- **Underestimated**: NPCs underestimate Gonk, lowering their guard (enemies get -2 initiative vs. Gonk)
- **Non-Threatening**: Gonk starts neutral with all factions (+1 relationship bonus)

---

## Data Structure Changes

### Before (Current):
```json
{
  "clone": {
    "health": 80,
    "speed": 1.0,
    "perception_radius": 10,
    "attack_range": 8
  }
}
```

### After (Proposed):
```json
{
  "clone": {
    "level": 5,
    "abilityScores": {
      "str": 13,
      "dex": 14,
      "con": 12,
      "int": 10,
      "wis": 11,
      "cha": 10
    },
    "proficiencyBonus": 2,
    "skills": {
      "perception": 2,
      "athletics": 3,
      "intimidate": 1
    },
    "armorClass": 16,
    "speed": 30,
    "equipment": {
      "armor": "clone_trooper_armor",
      "weapon": "dc15_blaster_rifle"
    }
  }
}
```

**Derived at Runtime**:
- HP = 10 + (CON mod × level) × scale = 10 + (1 × 5) × 2.5 = **38 HP**
- Perception radius = 10 + (WIS mod × 5) = 10 + 0 = **10 units**
- Attack bonus = DEX mod + proficiency = +2 + 2 = **+4**

---

## FAQ

### Q: Won't this make the game too "math-heavy"?
**A**: The math happens under the hood. Players see:
- "Attack: +7 to hit" (not "DEX 14 + Prof 3 + Weapon 2")
- "Damage: 18" (not "1d8+2, rolled 6, scaled 3×")
- Skill checks show final numbers: "Diplomacy: 16 vs DC 15"

### Q: Will Gonk feel weaker with -1 DEX?
**A**: No, because:
1. Gonk gets +3 CON (more HP than most NPCs)
2. Gonk-specific class features compensate
3. Proficiency bonuses scale with level
4. Current "+2 to hit" is competitive with level 1-3 NPCs

### Q: How much code refactoring is required?
**A**: Surprisingly little:
- Phase 1: Add stats, calculate deriveds (1-2 days)
- Phase 2: Modify conversation checks (1 day)
- Phase 3-4: Combat system changes (3-5 days)
- **Total**: ~1 week for core D20 integration

### Q: Can we still use the upgrade node system?
**A**: Yes! Nodes become:
- **Stat Increases**: "CON +1" directly modifies ability score
- **Skill Training**: "Diplomacy +2" improves specific skill
- **Feats**: "Point Blank Shot" (D20 feat) as purchasable node
- **Weapon Slots**: Keep existing weapon unlock system

---

## Recommendation

**Start with Phase 1 + Phase 2**: Add stats and skill-based conversations without touching combat. This gives:
1. **Immediate RPG Feel**: Visible stats, skill checks in dialogue
2. **Zero Risk**: Combat unchanged, no balance disruption
3. **Proof of Concept**: Test if D20 integration feels right before committing

If Phase 1-2 feels good, proceed to combat phases. If not, we only invested ~3 days and can easily revert.

---

## TODO List for D20 Integration

- [ ] Design ability score calculator (STR/DEX/CON/INT/WIS/CHA)
- [ ] Map all current NPCs to D20 stats
- [ ] Create skill check system for conversations
- [ ] Design Gonk-specific class features
- [ ] Implement attack roll vs AC system
- [ ] Convert weapon damage to dice notation
- [ ] Add critical hit mechanics
- [ ] Create saving throw system
- [ ] Add skill check UI feedback
- [ ] Balance NPC levels across all factions
- [ ] Test conversation skill checks
- [ ] Test combat hit rates (target 70%)
- [ ] Tune damage scaling for fun combat pacing

---

**Estimated Timeline**: 2-3 weeks for full D20 integration (all phases)
**Risk Level**: Low (phased approach allows rollback at any stage)
**Player Impact**: High (clearer progression, better balance, more tactical depth)
