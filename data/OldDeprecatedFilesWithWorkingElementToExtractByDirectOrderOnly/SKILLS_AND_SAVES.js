class SkillSystem {
    // ENUMERATION OF SKILLS
    static SKILLS = {
        SLICING: 'slicing',
        PERSUASION: 'persuasion',
        DECEPTION: 'deception',
        INTIMIDATE: 'intimidate',
        INSIGHT: 'insight',
        RUNNING: 'running',
        JUMP: 'jump',
        CLIMB: 'climb',
        STEALTH: 'stealth',
        PERCEPTION: 'perception',
        REPAIR: 'repair',
        MEDICINE: 'medicine',
        CRAFT: 'craft',
        SCAVENGE: 'scavenge'
    };

    static SAVES = {
        FORTITUDE: 'fortitude',
        REFLEX: 'reflex',
        WILL: 'will'
    };

    /**
     * Performs a Skill Check against a Difficulty Class (DC).
     * @param {string} skillName - Name of the skill (lowercase).
     * @param {number} dc - The difficulty to beat.
     * @param {object} characterStats - The character stats object (window.characterStats).
     * @returns {object} { success: boolean, roll: number, total: number, margin: number }
     */
    static rollSkillCheck(skillName, dc, characterStats) {
        if (!characterStats || !characterStats.skills) {
            console.error('[SkillSystem] Invalid stats object');
            return { success: false, roll: 0, total: 0, margin: -100 };
        }

        const skillBonus = characterStats.skills[skillName] || 0;
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + skillBonus;
        const success = total >= dc;

        console.log(`[SkillCheck] ${skillName.toUpperCase()}: Roll(${roll}) + Mod(${skillBonus}) = ${total} vs DC ${dc} -> ${success ? 'SUCCESS' : 'FAILURE'}`);

        return {
            success: success,
            roll: roll,
            total: total,
            margin: total - dc
        };
    }

    /**
     * Performs a Saving Throw.
     * @param {string} saveType - 'fortitude', 'reflex', 'will'.
     * @param {number} dc - Difficulty.
     * @param {object} characterStats - Character stats.
     */
    static rollSave(saveType, dc, characterStats) {
        // Saves might not be explicitly stored yet, so we can derive them if missing
        // Base Save + Attribute Mod
        let saveBonus = 0;

        if (window.AttributeSystem) {
            if (saveType === this.SAVES.FORTITUDE) saveBonus = window.AttributeSystem.getFortitudeSave(characterStats.stats.CON);
            // Reflex isn't in AttributeSystem explicitly yet, but usually DEX
            if (saveType === this.SAVES.REFLEX) saveBonus = window.AttributeSystem.getModifier(characterStats.stats.DEX);
            if (saveType === this.SAVES.WILL) saveBonus = window.AttributeSystem.getWillSave(characterStats.stats.WIS);
        }

        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + saveBonus;
        const success = total >= dc;

        console.log(`[Save] ${saveType.toUpperCase()}: Roll(${roll}) + Mod(${saveBonus}) = ${total} vs DC ${dc} -> ${success ? 'SUCCESS' : 'FAILURE'}`);

        return {
            success: success,
            roll: roll,
            total: total,
            margin: total - dc
        };
    }
}

window.SkillSystem = SkillSystem;
