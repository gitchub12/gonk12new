// BROWSERFIREFOXHIDE E:\gonk\d20_attributes.js
class AttributeSystem {
    /**
     * Calculates the standard D&D-style modifier: floor((Score - 10) / 2)
     * 10 -> 0, 12 -> +1, 8 -> -1
     */
    static getModifier(score) {
        return Math.floor(((score || 10) - 10) / 2);
    }

    /**
     * STR: Melee Damage Bonus
     * +1 damage per modifier point
     */
    static getMeleeDamageBonus(strScore) {
        return this.getModifier(strScore);
    }

    /**
     * DEX: Ranged Fire Speed Multiplier (applied to Delay)
     * +3% speed per modifier point reduces delay.
     * Formula: 1.0 - (Mod * 0.03)
     * Example: Dex 20 (+5) -> 1 - 0.15 = 0.85 multiplier (15% faster)
     */
    static getRangedSpeedMultiplier(dexScore) {
        const mod = this.getModifier(dexScore);
        // Ensure multiplier doesn't go below 0.1 (90% reduction cap for safety)
        return Math.max(0.1, 1.0 - (mod * 0.03));
    }

    /**
     * INT: Energy Regeneration Multiplier
     * +2% regen speed per modifier point
     */
    static getEnergyRegenMultiplier(intScore) {
        const mod = this.getModifier(intScore);
        return 1.0 + (mod * 0.02);
    }

    /**
     * INT: Slicing Skill Bonus
     * +1 per modifier point
     */
    static getSlicingBonus(intScore) {
        return this.getModifier(intScore);
    }

    /**
     * CON: HP Bonus
     * Adds the raw Score to max HP (per user request)
     */
    static getHPBonus(conScore) {
        return conScore || 0;
    }

    /**
     * CON: Fortitude Save Bonus
     */
    static getFortitudeSave(conScore) {
        return this.getModifier(conScore);
    }

    /**
     * WIS: Will Save / Insight Bonus
     */
    static getWillSave(wisScore) {
        return this.getModifier(wisScore);
    }

    /**
     * CHA: Social Skill Bonus (Bluff, Diplomacy)
     */
    static getSocialBonus(chaScore) {
        return this.getModifier(chaScore);
    }
}

// Expose globally
window.AttributeSystem = AttributeSystem;
