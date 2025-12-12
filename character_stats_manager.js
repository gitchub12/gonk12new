// BROWSERFIREFOXHIDE character_stats_manager.js
// D20 SRD Character Stats System - Table-Based Progression

class CharacterStatsManager {
    constructor() {
        this.stats = {
            STR: 10,
            DEX: 10,
            CON: 10,
            INT: 10,
            WIS: 10,
            CHA: 10
        };

        this.skills = {
            intimidate: 0,
            jump: 0,
            climb: 0,
            slicing: 0,
            insight: 0,
            persuasion: 0,
            repair: 0,
            deception: 0,
            medicine: 0,
            running: 0,
            athletics: 0,
            stealth: 0,
            perception: 0,
            speaklanguages: 0,
            craft: 0,
            scavenge: 0
        };

        this.level = 1;
        this.currentClass = 'Gonk'; // Default starting class - "Hunter Killer", "Slicer", "Protocol Droid", "Adept", "Medical", "Sith", "Gonk"

        this.hp = 60; // Starting HP (5×CON + level×hp_per_level, approximately)
        this.maxHp = 60;

        this.armor = 0; // Damage reduction
        this.weaponSlots = 0; // Number of weapon slots

        this.energyMaxBonusPct = 0; // Percentage bonus to max energy
        this.maxEnergy = 100; // Base energy
        this.energyRegenBonusPct = 5; // Percentage bonus to energy regen rate (Base 5%)
        this.damageBonusPct = 0; // Percentage bonus to all damage

        this.maxAllies = 0; // Maximum number of allies

        this.classPowers = []; // Array of special power names acquired
        this.pendingPowerChoice = null; // For major unlock levels (5, 10, 15, 20)
        this.selectedPowers = {}; // Track which power variant was chosen at each level

        // Load progression tables
        this.progressionTables = null;
        this.currentClassData = null;
        this.chassis = 'gonk';
    }

    // Calculate stat modifier using D&D 5e formula
    getStatModifier(statValue) {
        return Math.floor((statValue - 10) / 2);
    }

    // Get all stat modifiers
    getStatModifiers() {
        return {
            STR: this.getStatModifier(this.stats.STR),
            DEX: this.getStatModifier(this.stats.DEX),
            CON: this.getStatModifier(this.stats.CON),
            INT: this.getStatModifier(this.stats.INT),
            WIS: this.getStatModifier(this.stats.WIS),
            CHA: this.getStatModifier(this.stats.CHA)
        };
    }

    // Load progression tables from JSON
    async loadProgressionTables() {
        try {
            const response = await fetch('data/ClassesAndSkills/class_progression_tables.json');
            this.progressionTables = await response.json();
            console.log('Loaded class progression tables:', this.progressionTables);
            return true;
        } catch (error) {
            console.error('Failed to load progression tables:', error);
            return false;
        }
    }

    // Select a class (only at level 1)
    async selectClass(className) {
        if (this.level !== 1) {
            console.warn('Can only select class at level 1!');
            return false;
        }

        if (!this.progressionTables) {
            await this.loadProgressionTables();
        }

        const classData = this.progressionTables.classes[className];
        if (!classData) {
            console.error(`Class "${className}" not found in progression tables`);
            return false;
        }

        if (classData.locked) {
            console.warn(`Class "${className}" is locked!`);
            return false;
        }

        this.currentClass = className;
        this.currentClassData = classData;

        // Apply level 1 bonuses
        this.applyLevelBonuses(1);

        // Grant starting modules
        let startingModuleList = [];
        // Use the centralized list from CharacterUpgrades (SOURCE OF TRUTH)
        if (window.characterUpgrades && window.characterUpgrades.getClassStartingModules) {
            startingModuleList = window.characterUpgrades.getClassStartingModules(className);
        } else if (classData.starting_modules) {
            // Fallback (deprecated)
            startingModuleList = classData.starting_modules;
        }

        if (startingModuleList.length > 0) {
            console.log(`[CharacterStats] Granting starting modules for ${className}:`, startingModuleList);

            if (window.moduleManager) {
                for (const modStr of startingModuleList) {
                    // Parse "Name Rank" format (e.g. "Jump 3")
                    const match = modStr.match(/^(.+?)\s+(\d+)$/);
                    let modId = modStr;
                    let rank = 1;

                    if (match) {
                        modId = match[1]; // "Jump"
                        rank = parseInt(match[2]); // 3
                    }

                    // Normalize ID (remove spaces if needed, but our new files use spaces in filenames/IDs like "Force Heal")
                    // Actually, the new JSONs use "Force Heal" as ID?
                    // Let's check: "Force_Heal.json" likely has ID "Force Heal" or "Force_Heal"?
                    // File content step 582: "id": "Force Heal" for Force_Heal.json.
                    // So "Force Heal" is correct.
                    // But if user typed "Jump 3", modId is "Jump".
                    // The file is "Jump.json", ID "Jump".
                    // So we are good.

                    console.log(`[CharacterStats] Granting ${modId} (Rank ${rank})`);
                    for (let i = 0; i < rank; i++) {
                        window.moduleManager.grantModule(modId);
                    }
                }
            } else {
                console.error('[CharacterStats] window.moduleManager missing, cannot grant modules.');
            }
        } else {
            console.log(`[CharacterStats] No starting modules for ${className}`);
        }

        console.log(`Selected class: ${className}`);
        return true;
    }

    // Apply all bonuses from a specific level in the progression table
    applyLevelBonuses(level) {
        if (!this.currentClassData) {
            console.error('No class selected!');
            return;
        }

        const levelData = this.currentClassData.progression[level - 1];
        if (!levelData) {
            console.error(`No data for level ${level}`);
            return;
        }

        // Apply stats
        this.stats.STR = levelData.str;
        this.stats.DEX = levelData.dex;
        this.stats.CON = levelData.con;
        this.stats.INT = levelData.int;
        this.stats.WIS = levelData.wis;
        this.stats.CHA = levelData.cha;

        // Apply skills (only update if they exist in levelData)
        for (const skill in this.skills) {
            if (levelData[skill] !== undefined) {
                this.skills[skill] = levelData[skill];
            }
        }

        // Apply other stats
        this.armor = levelData.armor || 0;
        this.weaponSlots = levelData.weapon_slots || 0;
        this.energyMaxBonusPct = levelData.energy_max_bonus_pct || 0;
        this.energyRegenBonusPct = levelData.energy_regen_bonus_pct || 0;
        this.damageBonusPct = levelData.damage_bonus_pct || 0;
        this.maxAllies = levelData.max_allies || 0;

        // Calculate Max Energy (Base 100 + INT * 5 + Level * 2)
        // User specified INT increases max, WIS increases regen.
        const intMod = this.getStatModifier(this.stats.INT);
        const wisMod = this.getStatModifier(this.stats.WIS);
        const baseEnergy = 100;
        const statEnergy = (intMod * 5);
        this.maxEnergy = Math.floor((baseEnergy + statEnergy + (level * 2)) * (1 + (this.energyMaxBonusPct / 100)));

        // Calculate Energy Regen Rate
        // Base: 20
        // Overcharge: +1 per rank (Flat Base Increase)
        // WIS: +5% per modifier point (Multiplier to Base)

        let baseRegen = 20;
        let overchargeFlat = 0;

        // Scan powers for Overcharge/Quickcharge
        if (this.classPowers) {
            const regex = /(?:Overcharge|Quickcharge|HK Quickcharge)\s*(\d+)/i;
            for (const power of this.classPowers) {
                const match = power.match(regex);
                if (match) {
                    overchargeFlat += parseInt(match[1]);
                }
            }
        }

        // Check for specific modules if known and not in powers
        if (window.moduleManager && window.moduleManager.hasModule) {
            if (window.moduleManager.hasModule('HK Quickcharge 5') && !this.classPowers.includes('HK Quickcharge 5')) {
                overchargeFlat += 5;
            }
            // Add other overrides if needed
        }

        const totalBaseRegen = baseRegen + overchargeFlat;
        const wisBonusPct = wisMod * 5; // 5% per point

        // Combined Regen
        this.energyRegenRate = totalBaseRegen * (1 + (wisBonusPct / 100));

        // Apply Power Bonuses (Legacy hook, might account for non-standard bonuses)
        // this.applyPowerBonuses(); // Removing this call as we integrated the logic above for clarity

        // Calculate HP: 5×CON + (level × HP_per_level)
        const hpPerLevel = this.currentClassData.base_stats.hp_per_level;
        this.maxHp = (5 * this.stats.CON) + (level * hpPerLevel);
        this.hp = Math.min(this.hp, this.maxHp); // Don't overflow current HP

        // Check for special power choice
        if (levelData.special && levelData.special.includes('OR')) {
            // This level has a power choice
            this.pendingPowerChoice = {
                level: level,
                special: levelData.special,
                options: this.parsePowerOptions(levelData.special)
            };
            console.log(`Power choice available at level ${level}: ${levelData.special}`);
        } else if (levelData.special && levelData.special !== '') {
            // Automatic power (no choice)
            this.classPowers.push(levelData.special);
            console.log(`Gained power: ${levelData.special}`);
        }

        console.log(`Applied level ${level} bonuses. HP: ${this.hp}/${this.maxHp}, Armor: ${this.armor}, Damage: +${this.damageBonusPct}%`);
    }

    // Parse power options from special string "Power A OR Power B"
    parsePowerOptions(specialText) {
        const parts = specialText.split(' OR ');
        return parts.map(p => p.trim());
    }

    // Select a power from pending choice
    selectPower(powerName) {
        if (!this.pendingPowerChoice) {
            console.warn('No pending power choice!');
            return false;
        }

        if (!this.pendingPowerChoice.options.includes(powerName)) {
            console.warn(`"${powerName}" is not a valid option!`);
            return false;
        }

        this.classPowers.push(powerName);
        this.selectedPowers[this.pendingPowerChoice.level] = powerName;
        console.log(`Selected power: ${powerName}`);

        this.pendingPowerChoice = null;
        return true;
    }

    // Level up to next level
    async levelUp() {
        if (!this.currentClass) {
            console.warn('Cannot level up without selecting a class first!');
            return false;
        }

        if (!this.progressionTables) {
            await this.loadProgressionTables();
        }

        const nextLevel = this.level + 1;

        if (nextLevel > 20) {
            console.warn('Already at max level (20)!');
            return false;
        }

        this.level = nextLevel;
        this.applyLevelBonuses(nextLevel);

        console.log(`Leveled up to ${nextLevel}!`);
        return true;
    }

    // Calculate max HP (for external calls)
    calculateMaxHP() {
        if (!this.currentClassData) return 100;

        const baseHp = this.currentClassData.base_stats.starting_hp_base;
        const hpPerLevel = this.currentClassData.base_stats.hp_per_level;
        this.maxHp = (baseHp + this.stats.CON + (this.level * hpPerLevel)) * 10;
        return this.maxHp;
    }

    // Calculate damage with all bonuses
    calculateDamage(baseDamage, weaponType = null, targetIsOrganic = false, isBehind = false, targetHealthPercent = 1.0, isCrit = false) {
        let totalDamage = baseDamage;

        // Apply percentage damage bonus
        totalDamage *= (1 + (this.damageBonusPct / 100));

        // Apply stat bonus (STR for melee, DEX for ranged - simplified)
        const statBonus = this.getStatModifier(this.stats.STR); // Can be enhanced per weapon type
        totalDamage += statBonus;

        // Apply special power modifiers (these would be checked here)
        // For now, just apply percentage bonus

        return Math.max(1, Math.round(totalDamage));
    }

    // Get damage reduction from armor
    getDamageReduction(incomingDamage) {
        // Armor reduces damage by percentage (e.g., 10 armor = 10% reduction)
        const reduction = (this.armor / 100) * incomingDamage;
        return Math.floor(reduction);
    }

    // Apply damage to character
    takeDamage(amount) {
        const reduction = this.getDamageReduction(amount);
        const actualDamage = Math.max(1, amount - reduction); // Minimum 1 damage
        this.hp = Math.max(0, this.hp - actualDamage);
        console.log(`Took ${actualDamage} damage (${amount} - ${reduction} armor). HP: ${this.hp}/${this.maxHp}`);
        return actualDamage;
    }

    // Heal character
    heal(amount) {
        const oldHp = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        const healed = this.hp - oldHp;
        console.log(`Healed ${healed} HP. HP: ${this.hp}/${this.maxHp}`);
        return healed;
    }

    // Get display data for UI
    getDisplayData() {
        const modifiers = this.getStatModifiers();

        return {
            level: this.level,
            currentClass: this.currentClass,
            stats: { ...this.stats },
            modifiers: modifiers,
            skills: { ...this.skills },
            hp: this.hp,
            maxHp: this.maxHp,
            armor: this.armor,
            weaponSlots: this.weaponSlots,
            maxEnergy: this.maxEnergy,
            energyRegenRate: this.energyRegenRate,
            energyMaxBonusPct: this.energyMaxBonusPct,
            energyRegenBonusPct: this.energyRegenBonusPct,
            damageBonusPct: this.damageBonusPct,
            maxAllies: this.maxAllies,
            powers: [...this.classPowers],
            pendingPowerChoice: this.pendingPowerChoice
        };
    }

    // Get full progression table for a class (for UI display)
    getClassProgression(className) {
        if (!this.progressionTables) return null;
        return this.progressionTables.classes[className];
    }

    // Get all available classes
    getAvailableClasses() {
        if (!this.progressionTables) return [];

        const classes = [];
        for (const [name, data] of Object.entries(this.progressionTables.classes)) {
            classes.push({
                name: name,
                description: data.description,
                locked: data.locked || false,
                unlock_condition: data.unlock_condition || null
            });
        }
        return classes;
    }

    // Get power description
    getPowerDescription(powerName) {
        if (!this.progressionTables) return 'Unknown power';
        return this.progressionTables.special_power_descriptions[powerName] || powerName;
    }

    applyChassis(chassisName) {
        if (!this.currentClass) return;
        this.chassis = chassisName;

        // Reset to base stats for the current level
        this.applyLevelBonuses(this.level);

        switch (chassisName) {
            case 'mouse':
                console.log("Applying Mouse Droid chassis");
                // speed is not a stat in characterStats, it's in playerStats in game.state
                if (window.game && window.game.state.playerStats) window.game.state.playerStats.speed *= 2;
                if (this.stats.jump_strength) this.stats.jump_strength = 0;
                this.weaponSlots = 1;
                break;
            case 'hk':
                console.log("Applying HK chassis");
                if (this.stats.jump_strength) this.stats.jump_strength += 0.01;
                // climb height is not a stat here
                this.weaponSlots = 7;
                // HK chassis passive: faster energy regen? 
                // User mentioned "HK Quickcharge 5". If that's a module, it's separate.
                // But if it's innate:
                // this.energyRegenBonusPct += 50; 
                break;
            case 'gonk':
            default:
                console.log("Applying Gonk chassis (default)");
                // No changes for default chassis
                break;
        }

        if (window.game) window.game.updateCharacterSheet();
        if (window.characterUpgrades) window.characterUpgrades.updateD20Display();
    }

    applyArmor(armorName) {
        if (!this.currentClass) return;

        // Re-apply class and chassis bonuses
        this.applyLevelBonuses(this.level);
        this.applyChassis(this.chassis);

        switch (armorName) {
            case 'duraplate':
                this.maxHp *= 1.10;
                break;
            case 'superplate':
                this.maxHp *= 1.50;
                break;
            case 'beskar':
                this.maxHp *= 1.50;
                this.armor += 10;
                break;
            case 'molecular_bonding':
                this.maxHp *= 0.70;
                this.armor += 50;
                break;
        }
        this.hp = Math.min(this.hp, this.maxHp);
        if (window.game) window.game.updateCharacterSheet();
        if (window.characterUpgrades) window.characterUpgrades.updateD20Display();
    }

    // Apply bonuses from special powers
    applyPowerBonuses() {
        if (!this.classPowers) return;

        // HK Quickcharge 5: +5 flat regen + 10% bonus
        let hasQuickcharge = this.classPowers.includes('HK Quickcharge 5');

        // Also check module manager if available
        if (!hasQuickcharge && window.moduleManager && window.moduleManager.hasModule) {
            hasQuickcharge = window.moduleManager.hasModule('HK Quickcharge 5') ||
                window.moduleManager.hasModule('hk_quickcharge_5'); // Check ID as well
        }

        if (hasQuickcharge) {
            this.energyRegenRate += 5.0;
            this.energyRegenRate *= 1.10;
            console.log("Applied HK Quickcharge 5 bonus (Power/Module active)");
        } else {
            console.log("HK Quickcharge 5 not found in powers or modules");
        }
    }

    // Save state
    saveState() {
        return {
            stats: { ...this.stats },
            skills: { ...this.skills },
            level: this.level,
            currentClass: this.currentClass,
            hp: this.hp,
            maxHp: this.maxHp,
            armor: this.armor,
            weaponSlots: this.weaponSlots,
            energyMaxBonusPct: this.energyMaxBonusPct,
            energyRegenBonusPct: this.energyRegenBonusPct,
            damageBonusPct: this.damageBonusPct,
            maxAllies: this.maxAllies,
            classPowers: [...this.classPowers],
            selectedPowers: { ...this.selectedPowers }
        };
    }

    // Load state
    async loadState(state) {
        this.stats = { ...state.stats };
        this.skills = { ...state.skills };
        this.level = state.level;
        this.currentClass = state.currentClass;
        this.hp = state.hp;
        this.maxHp = state.maxHp;
        this.armor = state.armor || 0;
        this.weaponSlots = state.weaponSlots || 0;
        this.energyMaxBonusPct = state.energyMaxBonusPct || 0;
        this.energyRegenBonusPct = state.energyRegenBonusPct || 0;
        this.maxEnergy = state.maxEnergy || 100; // Load maxEnergy or default
        this.damageBonusPct = state.damageBonusPct || 0;
        this.maxAllies = state.maxAllies || 0;
        this.classPowers = [...(state.classPowers || [])];
        this.selectedPowers = { ...(state.selectedPowers || {}) };

        if (!this.progressionTables) {
            await this.loadProgressionTables();
        }

        if (this.currentClass) {
            this.currentClassData = this.progressionTables.classes[this.currentClass];
        }
    }
}

// Global instance
window.characterStats = new CharacterStatsManager();
