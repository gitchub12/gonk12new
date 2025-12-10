// BROWSERFIREFOXHIDE module_manager.js
// Module System - Manages temporary per-run module upgrades (Hades-style boons)

class ModuleManager {
    constructor() {
        this.modules = {}; // All available modules (from modules.json)
        this.activeModules = []; // Currently equipped module IDs
        this.appliedEffects = {}; // Track what effects have been applied
    }

    async loadModules() {
        try {
            const response = await fetch('data/modules.json');
            const data = await response.json();

            // Convert array to object keyed by ID
            this.modules = {};
            data.modules.forEach(module => {
                this.modules[module.id] = module;
            });

            console.log(`[ModuleManager] Loaded ${Object.keys(this.modules).length} modules`);
            return true;
        } catch (error) {
            console.error('[ModuleManager] Failed to load modules:', error);
            return false;
        }
    }

    // Grant a module to the player
    grantModule(moduleId) {
        if (!this.modules[moduleId]) {
            console.error(`[ModuleManager] Unknown module: ${moduleId}`);
            return false;
        }

        // NEW: Check if this is a duplicate - if so, just add it again to increase level
        // The character_upgrades.js will handle counting and displaying the level
        this.activeModules.push(moduleId);
        console.log(`[ModuleManager] Granted module: ${moduleId}`);

        // Add to game state modules for UI display
        if (window.game && window.game.state) {
            if (!window.game.state.modules) {
                window.game.state.modules = [];
            }
            // Always push, even if duplicate (this allows level stacking)
            window.game.state.modules.push(moduleId);
        }

        // Apply immediate effects
        this.applyModuleEffects(moduleId);

        // Update UI
        if (window.game && window.game.updateCharacterSheet) {
            window.game.updateCharacterSheet();
        }

        return true;
    }

    // Apply effects from a module
    applyModuleEffects(moduleId) {
        const module = this.modules[moduleId];
        if (!module || !module.effects) return;

        const currentLevel = window.characterStats?.level || 1;

        // Process immediate effects
        if (module.effects.immediate) {
            this._applyEffectBlock(module.effects.immediate, moduleId, 'immediate');
        }

        // Check for level-based effects
        for (const key in module.effects) {
            if (key.startsWith('level_')) {
                const requiredLevel = parseInt(key.replace('level_', ''));
                if (currentLevel >= requiredLevel && !this.appliedEffects[`${moduleId}_${key}`]) {
                    this._applyEffectBlock(module.effects[key], moduleId, key);
                    this.appliedEffects[`${moduleId}_${key}`] = true;
                }
            }
        }

        // Apply non-level-based effects (stats, bonuses, etc.)
        const ignoredKeys = ['immediate'];
        for (const key in module.effects) {
            if (!key.startsWith('level_') && !ignoredKeys.includes(key)) {
                this._applyEffectBlock({ [key]: module.effects[key] }, moduleId, key);
            }
        }
    }

    // Apply a block of effects
    _applyEffectBlock(effectBlock, moduleId, blockName) {
        for (const effectKey in effectBlock) {
            const effectValue = effectBlock[effectKey];
            this._applySingleEffect(effectKey, effectValue, moduleId, blockName);
        }
    }

    // Apply a single effect
    _applySingleEffect(effectKey, effectValue, moduleId, blockName) {
        const trackingKey = `${moduleId}_${blockName}_${effectKey}`;

        // Don't re-apply the same effect
        if (this.appliedEffects[trackingKey]) {
            console.log(`[ModuleManager] Effect already applied, skipping: ${trackingKey}`);
            return;
        }

        console.log(`[ModuleManager] Applying effect: ${effectKey} = ${effectValue} (from ${moduleId})`);

        switch (effectKey) {
            case 'memory_cores':
            case 'spare_cores':
                console.log(`[ModuleManager] Attempting to apply memory_cores/spare_cores...`);
                console.log(`[ModuleManager] window.game exists:`, !!window.game);
                console.log(`[ModuleManager] window.game.state exists:`, !!(window.game && window.game.state));
                console.log(`[ModuleManager] window.game.state.playerStats exists:`, !!(window.game && window.game.state && window.game.state.playerStats));

                if (window.game && window.game.state && window.game.state.playerStats) {
                    window.game.state.playerStats.spare_cores = (window.game.state.playerStats.spare_cores || 0) + effectValue;
                    console.log(`[ModuleManager] ✓ Spare cores now: ${window.game.state.playerStats.spare_cores}`);

                    // Update HUD
                    const spareCoreCount = document.getElementById('spare-core-count');
                    if (spareCoreCount) {
                        spareCoreCount.textContent = window.game.state.playerStats.spare_cores;
                    }
                }
                break;

            case 'movement_speed_bonus':
                if (window.game && window.game.state) {
                    window.game.state.movementSpeedBonus = (window.game.state.movementSpeedBonus || 0) + effectValue;
                }
                break;

            case 'jump_height_bonus':
                if (window.game && window.game.state) {
                    window.game.state.jumpHeightBonus = (window.game.state.jumpHeightBonus || 0) + effectValue;
                }
                break;

            case 'extra_jumps':
                if (window.game && window.game.state) {
                    window.game.state.extraJumps = (window.game.state.extraJumps || 0) + effectValue;
                }
                break;

            case 'energy_max_bonus_pct':
                if (window.characterStats) {
                    window.characterStats.energyMaxBonusPct = (window.characterStats.energyMaxBonusPct || 0) + effectValue;
                }
                break;

            case 'energy_regen_bonus_pct':
                if (window.characterStats) {
                    window.characterStats.energyRegenBonusPct = (window.characterStats.energyRegenBonusPct || 0) + effectValue;
                }
                break;

            case 'weapon_energy_cost_multiplier':
                if (window.playerWeaponSystem) {
                    window.playerWeaponSystem.energyCostMultiplier = (window.playerWeaponSystem.energyCostMultiplier || 0) + effectValue;
                }
                break;

            case 'max_health_bonus_pct':
                if (window.characterStats) {
                    window.characterStats.maxHpBonusPct = (window.characterStats.maxHpBonusPct || 0) + effectValue;
                }
                break;

            case 'armor':
                if (window.characterStats) {
                    window.characterStats.armor = (window.characterStats.armor || 0) + effectValue;
                }
                break;

            case 'melee_damage_bonus_pct':
            case 'pistol_damage_bonus_pct':
            case 'rifle_damage_bonus_pct':
            case 'longarm_damage_bonus_pct':
            case 'saber_damage_bonus_pct':
                if (window.playerWeaponSystem) {
                    if (!window.playerWeaponSystem.damageModifiers) {
                        window.playerWeaponSystem.damageModifiers = {};
                    }
                    const category = effectKey.replace('_damage_bonus_pct', '');
                    window.playerWeaponSystem.damageModifiers[category] = (window.playerWeaponSystem.damageModifiers[category] || 0) + effectValue;
                }
                break;

            case 'fire_rate_bonus':
            case 'melee_attack_speed_bonus':
                if (window.playerWeaponSystem) {
                    window.playerWeaponSystem.fireRateBonus = (window.playerWeaponSystem.fireRateBonus || 0) + effectValue;
                }
                break;

            case 'projectile_speed_bonus':
                if (window.game && window.game.state) {
                    window.game.state.projectileSpeedBonus = (window.game.state.projectileSpeedBonus || 0) + effectValue;
                }
                break;

            case 'max_allies':
                if (window.game && window.game.state) {
                    window.game.state.maxAllies = (window.game.state.maxAllies || 0) + effectValue;
                }
                break;

            case 'ally_damage_bonus_pct':
                if (window.game && window.game.state) {
                    window.game.state.allyDamageBonus = (window.game.state.allyDamageBonus || 0) + effectValue;
                }
                break;

            case 'weapon_slots':
                if (window.playerWeaponSystem) {
                    window.playerWeaponSystem.maxWeapons = (window.playerWeaponSystem.maxWeapons || 2) + effectValue;
                }
                break;

            case 'unlock_slot':
            case 'extra_slot':
                if (window.playerWeaponSystem) {
                    if (!window.playerWeaponSystem.unlockedSlots) {
                        window.playerWeaponSystem.unlockedSlots = [];
                    }
                    window.playerWeaponSystem.unlockedSlots.push(effectValue);
                }
                break;

            // Boolean toggles
            case 'enable_dash':
            case 'enable_autofire':
            case 'enable_force_push':
            case 'enable_force_lightning':
            case 'enable_force_heal':
            case 'enable_force_heal_self':
            case 'enable_saber_throw':
            case 'speak_all_languages':
            case 'diplomacy_advantage':
            case 'reveal_enemies':
                if (window.game && window.game.state) {
                    window.game.state[effectKey] = effectValue;
                }
                break;

            // Numeric bonuses
            case 'cha_bonus':
            case 'intimidate_bonus':
            case 'slicing_bonus':
                if (window.characterStats) {
                    const statKey = effectKey.replace('_bonus', '');
                    if (statKey === 'cha') {
                        window.characterStats.stats.CHA = (window.characterStats.stats.CHA || 10) + effectValue;
                    } else if (window.characterStats.skills[statKey] !== undefined) {
                        window.characterStats.skills[statKey] = (window.characterStats.skills[statKey] || 0) + effectValue;
                    }
                }
                break;

            // Chance-based effects
            case 'saber_block_chance':
            case 'deflect_chance':
            case 'instant_kill_chance':
            case 'droid_duplicate_chance':
                if (window.game && window.game.state) {
                    window.game.state[effectKey] = effectValue;
                }
                break;

            case 'force_shield_capacity':
                if (window.game && window.game.state) {
                    window.game.state.forceShieldMax = effectValue;
                    window.game.state.forceShieldCurrent = effectValue;
                }
                break;

            case 'shop_price_multiplier':
                if (window.game && window.game.state) {
                    window.game.state.shopPriceMultiplier = (window.game.state.shopPriceMultiplier || 1) + effectValue;
                }
                break;

            case 'pamphlet_range_multiplier':
            case 'pamphlet_convert_chance':
                if (window.game && window.game.state) {
                    window.game.state[effectKey] = effectValue;
                }
                break;

            case 'repair_bonus':
            case 'climb_speed_bonus':
            case 'scavenge_chance_bonus':
                if (window.characterStats) {
                    const skillName = effectKey.replace('_bonus', '').replace('_speed', '').replace('_chance', '');
                    // Map to skill names if needed, or simple add to generic boosts
                    // For now, assume these map to skill values if they exist
                    if (window.characterStats.skills) {
                        // Check for matching skill name regardless of case
                        const targetSkill = Object.keys(window.characterStats.skills).find(k => k.toLowerCase() === skillName);
                        if (targetSkill) {
                            window.characterStats.skills[targetSkill] = (window.characterStats.skills[targetSkill] || 0) + effectValue;
                        }
                    }
                }
                break;

            default:
                console.warn(`[ModuleManager] Unknown effect type: ${effectKey}`);
                break;
        }

        this.appliedEffects[trackingKey] = true;
    }

    // Check for level-up module effects
    onLevelUp(newLevel) {
        console.log(`[ModuleManager] Checking for level ${newLevel} module effects...`);

        for (const moduleId of this.activeModules) {
            const module = this.modules[moduleId];
            if (!module || !module.effects) continue;

            // Check for level-specific effects
            const levelKey = `level_${newLevel}`;
            if (module.effects[levelKey] && !this.appliedEffects[`${moduleId}_${levelKey}`]) {
                console.log(`[ModuleManager] Applying ${levelKey} effects from module: ${moduleId}`);
                this._applyEffectBlock(module.effects[levelKey], moduleId, levelKey);
                this.appliedEffects[`${moduleId}_${levelKey}`] = true;
            }
        }
    }

    // Get all active modules with their data
    getActiveModules() {
        return this.activeModules.map(id => this.modules[id]).filter(m => m);
    }

    // Reset all modules (for new run)
    reset() {
        console.log('[ModuleManager] Resetting all modules');
        this.activeModules = [];
        this.appliedEffects = {};
    }

    // Save state
    saveState() {
        return {
            activeModules: [...this.activeModules],
            appliedEffects: { ...this.appliedEffects }
        };
    }

    // Load state
    loadState(state) {
        this.activeModules = state.activeModules || [];
        this.appliedEffects = state.appliedEffects || {};

        // Re-apply all modules
        for (const moduleId of this.activeModules) {
            // Clear tracking so effects can be re-applied
            const keysToRemove = Object.keys(this.appliedEffects).filter(k => k.startsWith(moduleId));
            keysToRemove.forEach(k => delete this.appliedEffects[k]);

            this.applyModuleEffects(moduleId);
        }
    }
}

// Global instance
window.moduleManager = new ModuleManager();
