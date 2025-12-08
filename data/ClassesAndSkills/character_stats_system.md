# Character Stats System Design

## Core Philosophy

**Low damage, low HP** - Combat is dangerous and tactical. Most weapons deal 1-3 base damage, most characters have 10-30 HP.

---

## Base Stats (All Characters Start at 10)

All characters (Gonk and NPCs) begin with:

```javascript
{
  STR: 10,  // Melee damage bonus, carrying capacity
  DEX: 10,  // Ranged damage bonus, accuracy (NPCs only)
  CON: 10,  // Base HP (1:1 ratio)
  INT: 10,  // Hacking, tech skills
  WIS: 10,  // Perception, Force powers
  CHA: 10   // Social checks, recruiting
}
```

**Base HP Formula**: `HP = CON + (HP per level × current level)`

---

## Class Starting Stat Modifiers

### HK Combat Droid
- **Primary Stat Choice**: Player chooses STR (melee) OR DEX (ranged) at class selection
  - Chosen stat: +4
- **CON**: +2
- **WIS**: -2
- **CHA**: -2

**Starting Stats (DEX build)**:
```
STR: 10, DEX: 14, CON: 12, INT: 10, WIS: 8, CHA: 8
Base HP: 12 (CON) + 8 (level 1 HK) = 20 HP
```

**Starting Stats (STR build)**:
```
STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 8, CHA: 8
Base HP: 12 (CON) + 8 (level 1 HK) = 20 HP
```

### Protocol Droid
- **CHA**: +4
- **WIS**: +2
- **STR**: -2
- **Primary Stat**: CHA (auto-selected, can't change)

**Starting Stats**:
```
STR: 8, DEX: 10, CON: 10, INT: 10, WIS: 12, CHA: 14
Base HP: 10 (CON) + 4 (level 1 Protocol) = 14 HP
```

### Tech Specialist
- **INT**: +4
- **DEX**: +2
- **CHA**: -2
- **Primary Stat**: INT (auto-selected)

**Starting Stats**:
```
STR: 10, DEX: 12, CON: 10, INT: 14, WIS: 10, CHA: 8
Base HP: 10 (CON) + 5 (level 1 Tech) = 15 HP
```

### Force Adept
- **WIS**: +4
- **CHA**: +2
- **STR**: -2
- **Primary Stat**: WIS (auto-selected)

**Starting Stats**:
```
STR: 8, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 12
Base HP: 10 (CON) + 4 (level 1 Adept) = 14 HP
Force Points: 5 (base) + 5 (level 1) = 10 FP
```

---

## Leveling Up: Stat Increases

Every **ODD level** (3, 5, 7, 9...):
- **+1 to primary stat** (automatic, no choice)
- **+1 to any other stat** (player chooses via C menu)
- Skill points (class-dependent: HK=1, Protocol/Adept=2, Tech=3)

### Example: HK DEX Build at Level 7

Starting: `DEX: 14`
- Level 3: +1 DEX (auto) = 15
- Level 5: +1 DEX (auto) = 16
- Level 7: +1 DEX (auto) = 17

Plus player-chosen stats at L3, L5, L7 (e.g., +CON, +INT, +CON):
- CON: 12 → 13 → 13 → 14
- INT: 10 → 10 → 11 → 11

---

## Weapon Damage System

### Base Weapon Damage (Examples)

Most weapons deal **1-3 base damage**:

```javascript
{
  "blaster_pistol": { baseDamage: 1, cooldown: 0.5 },
  "blaster_rifle": { baseDamage: 2, cooldown: 1.0 },
  "heavy_blaster": { baseDamage: 3, cooldown: 1.5 },
  "vibroknife": { baseDamage: 1, cooldown: 0.3 },
  "vibrosword": { baseDamage: 2, cooldown: 0.7 },
  "lightsaber": { baseDamage: 3, cooldown: 0.5 }
}
```

### Damage Calculation

**Final Damage = Base Weapon Damage + Stat Bonus + Class Bonuses**

#### Stat Bonus
- **STR** applies to melee weapons: `+floor((STR - 10) / 2)` damage
- **DEX** applies to ranged weapons: `+floor((DEX - 10) / 2)` damage

Examples:
- STR 14 → +2 melee damage
- DEX 18 → +4 ranged damage
- STR 10 → +0 damage (baseline)

#### Class Bonuses (HK Example)
- L1: +1 vs organics
- L10: +2 vs organics (total: +3)
- L12: +3 from behind
- L20: +5 on crits
- L24: +2 vs armored
- L26: +5 vs <20% HP enemies
- L28: +15 damage (Omega Protocol I, 1/combat)
- L38: +3 vs organics (total: +6)
- L40: +5 all damage

### Example Combat Math

**Level 10 HK (DEX 16) with Blaster Rifle**:
- Base weapon: 2
- DEX bonus: +3 (from DEX 16)
- L1 Hunter Killer: +1 vs organics
- L10 Meatbag Destroyer: +2 vs organics
- **Total vs Organic**: 2 + 3 + 3 = **8 damage per shot**
- **Total vs Droid**: 2 + 3 = **5 damage per shot**

**Level 10 HK (STR 16) with Vibrosword**:
- Base weapon: 2
- STR bonus: +3 (from STR 16)
- L1 Hunter Killer: +1 vs organics
- L10 Meatbag Destroyer: +2 vs organics
- L12 Assassination Protocol: +3 (from behind)
- **Total vs Organic (front)**: 2 + 3 + 3 = **8 damage**
- **Total vs Organic (back)**: 2 + 3 + 3 + 3 = **11 damage**

---

## NPC Stats

### Average NPC (Stormtrooper, Rebel Soldier)
```
STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10
Base HP: 10
Level 1 HP: 10 + 3 = 13 HP
Weapon: Blaster Rifle (2 damage) = 2 damage/shot
```

### Elite NPC (Clone Commando, Sith Trooper)
```
STR: 12, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10
Base HP: 14
Level 3 HP: 14 + 9 = 23 HP
Weapon: Heavy Blaster (3 damage) + DEX bonus (+1) = 4 damage/shot
```

### Boss (Rancor, AT-ST)
```
STR: 20, DEX: 8, CON: 30, INT: 6, WIS: 12, CHA: 6
Base HP: 30
Level 10 HP: 30 + 50 = 80 HP
Melee: Claws (5 damage) + STR bonus (+5) = 10 damage/hit
```

---

## Gonk Starting Configuration

**At game start, Gonk is a blank slate**:

```javascript
gonk = {
  level: 1,
  class: null, // Chosen when player selects first class level
  stats: {
    STR: 10,
    DEX: 10,
    CON: 10,
    INT: 10,
    WIS: 10,
    CHA: 10
  },
  hp: 10, // Just CON, no class HP yet
  primaryStat: null // Set when class chosen
}
```

**After choosing HK Combat Droid (DEX build)**:
```javascript
gonk = {
  level: 1,
  class: "HK",
  classLevels: { HK: 1 },
  stats: {
    STR: 10,
    DEX: 14, // +4 from HK
    CON: 12, // +2 from HK
    INT: 10,
    WIS: 8,  // -2 from HK
    CHA: 8   // -2 from HK
  },
  hp: 20, // 12 (CON) + 8 (HK L1)
  maxHp: 20,
  primaryStat: "DEX",
  classPowers: ["Hunter Killer"] // +1 damage vs organics
}
```

---

## Implementation Notes

1. **Stat-to-damage conversion**: Use D&D 5e formula `floor((stat - 10) / 2)`
2. **HP updates**: Recalculate when CON changes or level gained
3. **Primary stat**: Locked when class chosen, auto-increments on odd levels
4. **Secondary stats**: Player chooses via C menu on odd levels
5. **Gonk starts weak**: 10 HP, 1-2 damage output, very fragile
6. **Progression feels significant**: By L10, 20 HP and 5-8 damage (4-5× stronger)
