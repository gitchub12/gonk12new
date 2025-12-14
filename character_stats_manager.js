// BROWSERFIREFOXHIDE character_stats_manager.js
// D20 SRD Character Stats System - Table-Based Progression

class CharacterStatsManager {
    constructor() {
        this.stats = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };

        // Deprecated Skills (Kept empty to prevent UI crashes if referenced)
        this.skills = {};

        this.level = 1;
        this.currentClass = 'Gonk';
        this.hp = 60;
        this.maxHp = 60;
        this.armor = 0;
        this.weaponSlots = 0;
        this.energyMaxBonusPct = 0;
        this.maxEnergy = 100;
        this.energyRegenRate = 20;
        this.energyRegenBonusPct = 5;
        this.damageBonusPct = 0;
        this.maxAllies = 0;
        this.classPowers = [];
        this.playerClasses = {}; // New storage for class data
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

    // Load new Player Class JSONs
    async loadPlayerClasses() {
        // Filenames map to expected class keys.
        const classFiles = ['Gonk', 'HunterKiller', 'Protocol', 'Slicer', 'Adept'];
        this.playerClasses = {};

        console.log("Loading Player Classes...");
        for (const filename of classFiles) {
            try {
                const response = await fetch(`data/ClassesAndSkills/PlayerClasses/${filename}.json`);
                if (response.ok) {
                    const data = await response.json();
                    // Use the className from the file as the key
                    this.playerClasses[data.className] = data;
                    console.log(`Loaded class: ${data.className} from ${filename}.json`);
                } else {
                    console.error(`Failed to load ${filename}.json`);
                }
            } catch (e) {
                console.error(`Error loading ${filename}:`, e);
            }
        }
        return true;
    }

    // Legacy method name support - redirects to new loader
    async loadProgressionTables() {
        return this.loadPlayerClasses();
    }

    // Select a class
    async selectClass(className) {
        if (!this.playerClasses || Object.keys(this.playerClasses).length === 0) {
            await this.loadPlayerClasses();
        }

        const classData = this.playerClasses[className];
        if (!classData) {
            console.error(`Class "${className}" not found.`);
            return false;
        }

        this.currentClass = className;
        this.currentClassData = classData;
        this.level = 1; // Reset level on class change

        // RESET Modules (Prevent retaining old class modules)
        if (window.moduleManager) {
            console.log('Resetting modules for new class selection...');
            window.moduleManager.reset();
        }

        // Apply Starting Attributes (Standard Array)
        if (classData.starting_attributes) {
            this.stats = { ...classData.starting_attributes };
            console.log(`Set starting stats for ${className}:`, this.stats);
        }

        // Apply Level 1 Bonuses (Stats only)
        this.applyLevelBonuses(1);

        // Grant Starting Modules from Level 1 Progression
        if (classData.progression) {
            const level1 = classData.progression.find(p => p.level === 1);
            if (level1 && level1.modules && window.moduleManager) {
                console.log(`Granting starting modules for ${className}...`);
                level1.modules.forEach(modName => {
                    window.moduleManager.grantModule(modName);
                });
            }
        }

        console.log(`Selected class: ${className}`);
        return true;
    }

    // Apply bonuses for a specific level (Refactored for Module System)
    applyLevelBonuses(level) {
        if (!this.currentClassData) {
            console.error('No class selected!');
            return;
        }

        console.log(`Applying Level ${level} stats for ${this.currentClass}...`);

        // USER REQUEST: No bonus modules on level up inside this function.
        // Derived stats calculation only.

        // 1. Calculate HP
        // Formula: (HP_Per_Level + CON_Mod) * Level + CON_Score (Base Buffer)
        const conMod = this.getStatModifier(this.stats.CON);
        const hpPerLevel = this.currentClassData.hp_per_level || 8;
        // Ensure at least 1 HP gain per level
        const hpGrowth = Math.max(1, hpPerLevel + conMod);

        // Recalculate Max HP
        this.maxHp = this.stats.CON + (level * hpGrowth);

        // Current HP adjustment
        this.hp = Math.min(this.hp, this.maxHp);
        // Start fresh char with full HP
        if (level === 1) this.hp = this.maxHp;


        // 2. Calculate Energy
        const intMod = this.getStatModifier(this.stats.INT);
        const wisMod = this.getStatModifier(this.stats.WIS);
        const baseEnergy = 100;
        // Energy scaling: Base + INT*5 + Level*2
        const statEnergy = (intMod * 5);
        this.maxEnergy = Math.floor((baseEnergy + statEnergy + (level * 2)) * (1 + (this.energyMaxBonusPct / 100)));

        // 3. Energy Regen
        // Base: 20 + HK Quickcharge
        let baseRegen = 20;
        let overchargeFlat = 0;

        // Check for Quickcharge module
        if (window.moduleManager) {
            // Safe check using hasModule if available, or manual check
            if (window.moduleManager.hasModule && window.moduleManager.hasModule('HK Quickcharge 5')) {
                overchargeFlat += 5;
            } else if (window.moduleManager.activeModules && window.moduleManager.activeModules.includes('HK Quickcharge 5')) {
                overchargeFlat += 5;
            }
        }

        const totalBaseRegen = baseRegen + overchargeFlat;
        const wisBonusPct = wisMod * 5; // 5% per point of WIS modifier

        this.energyRegenRate = totalBaseRegen * (1 + (wisBonusPct / 100));

        console.log(`Stats Updated. HP: ${this.maxHp}, Energy: ${this.maxEnergy}, Regen: ${this.energyRegenRate}`);
    }

    // Level up to next level
    async levelUp() {
        if (!this.currentClass) {
            console.warn('Cannot level up without selecting a class first!');
            return false;
        }

        const nextLevel = this.level + 1;

        if (nextLevel > 20) {
            console.warn('Already at max level (20)!');
            return false;
        }

        this.level = nextLevel;

        // 1. Attribute Progression (Gold/Silver/Bronze)
        console.log(`[LevelUp] Processing GSB Stats for Level ${this.level}`);
        if (this.currentClassData && this.currentClassData.GoldSilverBronzeStats) {
            const gsb = this.currentClassData.GoldSilverBronzeStats;
            const gold = gsb.gold || 'STR';
            const silver = gsb.silver || 'CON';
            const bronze = gsb.bronze || 'DEX';

            // Gold: Every Level
            this.stats[gold] = (this.stats[gold] || 10) + 1;
            console.log(`Gold (${gold}) +1 -> ${this.stats[gold]}`);

            // Silver: Every 2 Levels
            if (this.level % 2 === 0) {
                this.stats[silver] = (this.stats[silver] || 10) + 1;
                console.log(`Silver (${silver}) +1 -> ${this.stats[silver]}`);
            }

            // Bronze: Every 3 Levels
            if (this.level % 3 === 0) {
                this.stats[bronze] = (this.stats[bronze] || 10) + 1;
                console.log(`Bronze (${bronze}) +1 -> ${this.stats[bronze]}`);
            }
        } else {
            // Fallback logic
            if (this.level % 4 === 0) {
                this.stats.STR++;
                this.stats.CON++;
            }
        }

        // 2. Module Progression (Upgrade one existing module)
        // User request: "adds 1 level to one of the existing modules per level"
        if (window.moduleManager && window.moduleManager.activeModules.length > 0) {
            const uniqueMods = [...new Set(window.moduleManager.activeModules)];
            if (uniqueMods.length > 0) {
                // Rotate through modules based on level to ensure spreads
                const index = (this.level) % uniqueMods.length;
                const modToUpgrade = uniqueMods[index];

                console.log(`[LevelUp] Upgrading module: ${modToUpgrade}`);
                window.moduleManager.grantModule(modToUpgrade);
            }
        }

        // 3. Recalculate Derived Stats (HP, Energy)
        this.applyLevelBonuses(nextLevel);

        console.log(`Leveled up to ${nextLevel}!`);
        return true;
    }

    // Calculate max HP (for external calls) (Updated to new formula)
    calculateMaxHP() {
        if (!this.currentClassData) return 60;

        const conMod = this.getStatModifier(this.stats.CON);
        const hpPerLevel = this.currentClassData.hp_per_level || 8;
        const hpGrowth = Math.max(1, hpPerLevel + conMod);
        this.maxHp = this.stats.CON + (this.level * hpGrowth);
        return this.maxHp;
    }

    calculateDamage(baseDamage, weaponType = null, targetIsOrganic = false, isBehind = false, targetHealthPercent = 1.0, isCrit = false) {
        let totalDamage = baseDamage;
        totalDamage *= (1 + (this.damageBonusPct / 100));
        const statBonus = this.getStatModifier(this.stats.STR);
        totalDamage += statBonus;
        return Math.max(1, Math.round(totalDamage));
    }

    getDamageReduction(incomingDamage) {
        const reduction = (this.armor / 100) * incomingDamage;
        return Math.floor(reduction);
    }

    takeDamage(amount) {
        const reduction = this.getDamageReduction(amount);
        const actualDamage = Math.max(1, amount - reduction);
        this.hp = Math.max(0, this.hp - actualDamage);
        console.log(`Took ${actualDamage} damage. HP: ${this.hp}/${this.maxHp}`);
        return actualDamage;
    }

    heal(amount) {
        const oldHp = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        const healed = this.hp - oldHp;
        return healed;
    }

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

    getClassProgression(className) {
        // Return full JSON data if requested by UI
        return this.playerClasses[className];
    }

    getAvailableClasses() {
        // Return list of loaded classes
        if (!this.playerClasses) return [];
        return Object.values(this.playerClasses).map(c => ({
            name: c.className,
            description: c.description
        }));
    }

    applyChassis(chassisName) {
        // Simplified Chassis logic
        if (!this.currentClass) return;
        this.chassis = chassisName;
        // Re-calc stats for level
        this.applyLevelBonuses(this.level);

        switch (chassisName) {
            case 'mouse':
                if (window.game && window.game.state.playerStats) window.game.state.playerStats.speed *= 2;
                this.weaponSlots = 1;
                break;
            case 'hk':
                this.weaponSlots = 7;
                break;
            case 'gonk':
            default:
                break;
        }
        if (window.game) window.game.updateCharacterSheet();
    }

    applyArmor(armorName) {
        if (!this.currentClass) return;
        this.applyLevelBonuses(this.level);
        this.applyChassis(this.chassis);

        switch (armorName) {
            case 'duraplate': this.maxHp *= 1.10; break;
            case 'superplate': this.maxHp *= 1.50; break;
            case 'beskar': this.maxHp *= 1.50; this.armor += 10; break;
            case 'molecular_bonding': this.maxHp *= 0.70; this.armor += 50; break;
        }
        this.hp = Math.min(this.hp, this.maxHp);
        if (window.game) window.game.updateCharacterSheet();
    }

    saveState() {
        return {
            stats: { ...this.stats },
            level: this.level,
            currentClass: this.currentClass,
            hp: this.hp,
            maxHp: this.maxHp,
            // ... other fields if needed for persistence
        };
    }

    async loadState(state) {
        if (state.currentClass) await this.selectClass(state.currentClass);
        if (state.level) {
            this.level = state.level;
            this.applyLevelBonuses(this.level);
        }
        if (state.stats) this.stats = { ...state.stats };
        if (state.hp) this.hp = state.hp;
    }
}

// Global instance
window.characterStats = new CharacterStatsManager();
