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
            jump: 0,
            climb: 0,
            stealth: 0,
            perception: 0,
            speaklanguages: 0,
            craft: 0,
            scavenge: 0
        };

        this.level = 1;
        this.currentClass = 'Hunter Killer'; // Default to Hunter Killer Class

        this.hp = 60; // Starting HP (5×CON + level×hp_per_level, approximately)
        this.maxHp = 60;

        this.armor = 0; // Damage reduction
        this.weaponSlots = 0; // Number of weapon slots

        this.energyMaxBonusPct = 0; // Percentage bonus to max energy
        this.energyRegenBonusPct = 0; // Percentage bonus to energy regen rate
        this.damageBonusPct = 0; // Percentage bonus to all damage

        this.maxAllies = 0; // Maximum number of allies

        this.classPowers = []; // Array of special power names acquired
        this.pendingPowerChoice = null; // For major unlock levels (5, 10, 15, 20)
        this.selectedPowers = {}; // Track which power variant was chosen at each level

        // Load progression tables
        this.progressionTables = null;
        this.currentClassData = null;
        this.chassis = 'gonk'; // Reverted to default Gonk chassis

        // Calculate initial stats based on defaults
        this.recalculateDerivedStats();

        // --- Jedi/Sith Powers State ---
        this.jediPowers = {
            forceHeal: false,
            mindTrick: false,
            boltReflection: false,
            boltReflectionChance: 0.0,
            perfectReflection: false
        };
    }

    // Calculate stat modifier using D&D 5e formula
    getStatModifier(statValue) {
        return Math.floor((statValue - 10) / 2);
    }

    // Calcluate derived stats (HP, Skills) based on Attributes
    recalculateDerivedStats() {
        if (!window.AttributeSystem) return;

        // 1. HP Calculation
        // "CON adds HP (not the mod, the actual trait)"
        // Base HP (60) + Level Growth + CON Score
        // Assuming 10 HP per level after 1st?
        const hpPerLevel = 10;
        const baseHp = 50 + (this.level * hpPerLevel);
        const conBonus = window.AttributeSystem.getHPBonus(this.stats.CON);
        this.maxHp = baseHp + conBonus;
        // Don't auto-heal, but clamp if max reduced? 
        // For now just set max.

        // 2. Skill Modifiers
        // We need to preserve 'ranks' (base values). 
        // If this.baseSkills doesn't exist, we assume current this.skills ARE the bases (initially 0)
        if (!this.baseSkills) {
            this.baseSkills = { ...this.skills };
        }

        const intMod = window.AttributeSystem.getSlicingBonus(this.stats.INT);
        const chaMod = window.AttributeSystem.getSocialBonus(this.stats.CHA);
        const wisMod = window.AttributeSystem.getWillSave(this.stats.WIS);
        const strMod = window.AttributeSystem.getMeleeDamageBonus(this.stats.STR);
        const conMod = window.AttributeSystem.getFortitudeSave(this.stats.CON); // Using Fortitude (CON mod) for Running

        // Update skills with modifiers
        const isSlicer = (this.currentClass === 'Slicer' || this.currentClass === 'Techie'); // Handle both names
        const slicerLevelBonus = isSlicer ? this.level : 0;

        this.skills.slicing = (this.baseSkills.slicing || 0) + intMod + slicerLevelBonus;
        this.skills.persuasion = (this.baseSkills.persuasion || 0) + chaMod;
        this.skills.deception = (this.baseSkills.deception || 0) + chaMod;
        this.skills.intimidate = (this.baseSkills.intimidate || 0) + chaMod;
        this.skills.insight = (this.baseSkills.insight || 0) + wisMod;

        // Physical Skills
        this.skills.running = (this.baseSkills.running || 0) + conMod; // Running = CON
        this.skills.jump = (this.baseSkills.jump || 0) + strMod;
        this.skills.climb = (this.baseSkills.climb || 0) + strMod;

        // Repair is usually INT
        this.skills.repair = (this.baseSkills.repair || 0) + intMod;

        console.log('Recalculated Derived Stats:', this.skills);
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
        if (classData.starting_modules && classData.starting_modules.length > 0) {
            console.log(`[CharacterStats] Class has starting modules:`, classData.starting_modules);

            if (!window.moduleManager) {
                console.error('[CharacterStats] ERROR: window.moduleManager is not available!');
            } else if (!window.game) {
                console.error('[CharacterStats] ERROR: window.game is not available!');
            } else if (!window.game.state) {
                console.error('[CharacterStats] ERROR: window.game.state is not available!');
            } else {
                console.log(`[CharacterStats] Granting starting modules for ${className}:`, classData.starting_modules);
                for (const moduleId of classData.starting_modules) {
                    console.log(`[CharacterStats] Attempting to grant module: ${moduleId}`);
                    const result = window.moduleManager.grantModule(moduleId);
                    console.log(`[CharacterStats] Module grant result for ${moduleId}:`, result);
                }
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

        // Grant HK Pamphlets (Ammo) at Level 1
        if (this.currentClass === 'Hunter Killer' && level === 1) {
            if (window.game && window.game.state && window.game.state.ammo === 0) {
                window.game.state.ammo = 50;
                console.log("Granted 50 Pamphlets to Hunter Killer.");
            }
        }
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
            energyMaxBonusPct: this.energyMaxBonusPct,
            energyRegenBonusPct: this.energyRegenBonusPct,
            damageBonusPct: this.damageBonusPct,
            maxAllies: this.maxAllies,
            powers: [...this.classPowers],
            pendingPowerChoice: this.pendingPowerChoice
        };
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
        this.damageBonusPct = state.damageBonusPct || 0;
        this.maxAllies = state.maxAllies || 0;
        this.classPowers = [...(state.classPowers || [])];
        this.selectedPowers = { ...(state.selectedPowers || {}) };

        if (this.currentClass) {
            if (!this.progressionTables) {
                await this.loadProgressionTables();
            }
            if (this.progressionTables && this.progressionTables.classes) {
                this.currentClassData = this.progressionTables.classes[this.currentClass];
            } else {
                console.warn(`[CharacterStats] Progression tables failed to load or class ${this.currentClass} not found.`);
            }
        }
    }

    // --- ACTIVE SKILLS ---

    // Helper to check if an NPC is a droid
    isDroid(npc) {
        if (!npc) return false;
        const species = npc.config?.species?.toLowerCase() || '';
        const name = npc.name?.toLowerCase() || '';
        const faction = npc.faction?.toLowerCase() || '';

        // Check generic indicators
        if (species.includes('droid')) return true;
        if (name.includes('droid') || name.includes('gonk') || name.includes('astromech')) return true;
        if (faction === 'droids' || faction === 'separatist_droids') return true;

        // Check for known droid classes (if any)
        if (npc.config?.npc_class?.includes('droid')) return true;

        return false;
    }

    // Active Skill: Medicine (Heals Biological Allies)
    performMedicineCheck() {
        if (!window.game || !window.game.state || !window.SkillSystem) return false;

        // 1. Roll Skill Check (DC 0, we just use the result value)
        // Note: The design says "Heal for the rolled amount". 
        // We use a dummy DC 10 just to get the roll object, but we trigger off the TOTAL.
        const check = window.SkillSystem.rollSkillCheck(
            window.SkillSystem.SKILLS.MEDICINE,
            10,
            this
        );

        const healAmount = Math.max(0, check.total);
        console.log(`[Medicine] Roll: ${check.roll} + Mod: ${check.total - check.roll} = ${healAmount} Healing`);

        let healedCount = 0;
        let totalHealed = 0;

        // 2. Heal Biological Allies
        if (window.game.state.allies) {
            window.game.state.allies.forEach(ally => {
                const npc = ally.npc;
                if (npc && !npc.isDead && !this.isDroid(npc)) {
                    const amount = npc.heal(healAmount);
                    if (amount > 0) {
                        healedCount++;
                        totalHealed += amount;
                        console.log(`[Medicine] Healed ally ${npc.name} for ${amount}`);
                    }
                }
            });
        }

        if (healedCount > 0) {
            // TODO: Show on-screen message
            console.log(`[Medicine] Total: Healed ${healedCount} allies for ${totalHealed} HP.`);
            return true;
        } else {
            console.log(`[Medicine] No injured biological allies found.`);
            return false;
        }
    }

    // Active Skill: Repair (Heals Self + Droid Allies)
    performRepairCheck() {
        if (!window.game || !window.game.state || !window.SkillSystem) return false;

        // 1. Roll Skill Check
        const check = window.SkillSystem.rollSkillCheck(
            window.SkillSystem.SKILLS.REPAIR,
            10,
            this
        );

        const healAmount = Math.max(0, check.total);
        console.log(`[Repair] Roll: ${check.roll} + Mod: ${check.total - check.roll} = ${healAmount} Healing`);

        let healedCount = 0;
        let totalHealed = 0;

        // 2. Heal Self (Gonk is a droid)
        const selfHeal = this.heal(healAmount);
        if (selfHeal > 0) {
            healedCount++;
            totalHealed += selfHeal;
            console.log(`[Repair] Healed Self for ${selfHeal}`);
        }

        // 3. Heal Droid Allies
        if (window.game.state.allies) {
            window.game.state.allies.forEach(ally => {
                const npc = ally.npc;
                if (npc && !npc.isDead && this.isDroid(npc)) {
                    const amount = npc.heal(healAmount);
                    if (amount > 0) {
                        healedCount++;
                        totalHealed += amount;
                        console.log(`[Repair] Healed droid ally ${npc.name} for ${amount}`);
                    }
                }
            });
        }

        if (healedCount > 0) {
            // TODO: Show on-screen message
            console.log(`[Repair] Total: Healed ${healedCount} targets for ${totalHealed} HP.`);
            return true;
        } else {
            console.log(`[Repair] No injured droids found.`);
            return false;
        }
    }

    // --- JEDI POWERS ---

    // Unlock Bolt Reflection
    unlockBoltReflection(baseChance = 0.3) {
        this.jediPowers.boltReflection = true;
        this.jediPowers.boltReflectionChance = baseChance;
        console.log(`[Jedi] Unlocked Bolt Reflection at ${baseChance * 100}% chance`);
    }

    // Upgrade Bolt Reflection
    upgradeBoltReflection(bonusChance) {
        this.jediPowers.boltReflectionChance = Math.min(1.0, this.jediPowers.boltReflectionChance + bonusChance);
        console.log(`[Jedi] Bolt Reflection chance upgraded to ${this.jediPowers.boltReflectionChance * 100}%`);
    }

    // Unlock Perfect Reflection
    unlockPerfectReflection() {
        this.jediPowers.perfectReflection = true;
        console.log('[Jedi] Unlocked Perfect Reflection');
    }

    // Force Heal
    useForceHeal() {
        if (!this.jediPowers.forceHeal) return false;

        const energyCost = 100;
        if (window.game.state.energy < energyCost) {
            console.log('Not enough energy for Force Heal');
            return false;
        }

        window.game.state.energy -= energyCost;

        // Scaled healing (e.g. 50 + WIS mod * 5)
        const wisMod = this.getStatModifier(this.stats.WIS);
        const healAmount = 50 + (wisMod * 5);

        this.heal(healAmount);

        if (window.audioSystem) {
            window.audioSystem.playSound('forceheal', 1.0);
        }
        return true;
    }

    // Mind Trick
    useMindTrick(targetNPC) {
        if (!this.jediPowers.mindTrick) return false;

        const energyCost = 75;
        if (window.game.state.energy < energyCost) {
            console.log('Not enough energy for Mind Trick');
            return false;
        }

        if (!targetNPC || targetNPC.isDead) return false;

        // DC = 8 + Prof + CHA = 8 + Level + ChaMod
        const dc = 8 + Math.floor(this.level / 2) + this.getStatModifier(this.stats.CHA);

        window.game.state.energy -= energyCost;

        targetNPC.mindTricked = true;
        targetNPC.mindTrickDuration = 10.0 + (this.getStatModifier(this.stats.CHA) * 2.0); // Duration based on CHA

        console.log(`Mind Trick on ${targetNPC.name} (Duration: ${targetNPC.mindTrickDuration.toFixed(1)}s)`);

        if (window.audioSystem) {
            window.audioSystem.playPositionalSound('/data/sounds/force/mindtrick.wav', targetNPC.mesh.group.position, 1.0);
        }
        return true;
    }
}

// Global instance
window.characterStats = new CharacterStatsManager();
