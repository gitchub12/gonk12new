// BROWSERFIREFOXHIDE TabControls/tab_charactersheet_controls.js
// Character Sheet Element Position Controls for Tab Menu

class CharacterSheetTabControls {
    constructor() {
        // Module number badge settings
        this.moduleBadgeScale = this.loadModuleBadgeScale();
        this.moduleBadgePosition = this.loadModuleBadgePosition();
    }

    loadModuleBadgeScale() {
        const saved = localStorage.getItem('gonk_module_badge_scale');
        return saved ? parseFloat(saved) : 0.32; // Default 0.32
    }

    saveModuleBadgeScale(scale) {
        this.moduleBadgeScale = scale;
        localStorage.setItem('gonk_module_badge_scale', scale.toString());
    }

    loadModuleBadgePosition() {
        const saved = localStorage.getItem('gonk_module_badge_position');
        return saved ? JSON.parse(saved) : { x: 1, y: 84 }; // Default x:1, y:84
    }

    saveModuleBadgePosition(x, y) {
        this.moduleBadgePosition = { x, y };
        localStorage.setItem('gonk_module_badge_position', JSON.stringify({ x, y }));
    }

    createTabContent() {
        let html = '<h4>Module Level Badge Controls</h4>';
        html += '<p style="font-size: 12px; color: #888;">Adjust module number badge appearance. Changes save automatically and update in real-time.</p>';

        html += `<hr><h4>Badge Size</h4>`;
        html += `<div class="control-group">`;
        html += `<label>Number Scale: <span id="charsheet_module_badge_scale_val">${this.moduleBadgeScale.toFixed(2)}</span></label>`;
        html += `<input type="range" id="charsheet_module_badge_scale" min="0.1" max="1.0" value="${this.moduleBadgeScale}" step="0.01">`;
        html += `</div>`;
        html += `<p style="font-size: 11px; color: #666; margin-top: 5px;">Controls the size of the number badge relative to the module icon (default: 0.25)</p>`;

        html += `<hr><h4>Badge Position</h4>`;
        html += `<div class="control-group">`;
        html += `<label>X Offset: <span id="charsheet_module_badge_x_val">${this.moduleBadgePosition.x}</span>px</label>`;
        html += `<input type="range" id="charsheet_module_badge_x" min="-130" max="130" value="${this.moduleBadgePosition.x}" step="1">`;
        html += `</div>`;
        html += `<p style="font-size: 11px; color: #666; margin-top: 5px;">Negative = move left, Positive = move right from top-right corner</p>`;

        html += `<div class="control-group">`;
        html += `<label>Y Offset: <span id="charsheet_module_badge_y_val">${this.moduleBadgePosition.y}</span>px</label>`;
        html += `<input type="range" id="charsheet_module_badge_y" min="-130" max="130" value="${this.moduleBadgePosition.y}" step="1">`;
        html += `</div>`;
        html += `<p style="font-size: 11px; color: #666; margin-top: 5px;">Negative = move up, Positive = move down from top-right corner</p>`;

        html += '<hr>';
        html += '<p style="font-size: 12px; color: #888; font-style: italic;">Note: The character sheet uses CSS Grid layout. Element positioning cannot be adjusted here. Wire/Credits/Stats are dynamically rendered and cannot be repositioned individually.</p>';
        html += '<hr>';
        html += '<button id="charsheet_reset_btn" style="width: 100%; padding: 8px;">Reset to Defaults</button>';

        return html;
    }

    setupEventListeners() {
        // Module badge scale slider
        const badgeScaleSlider = document.getElementById('charsheet_module_badge_scale');
        if (badgeScaleSlider) {
            badgeScaleSlider.addEventListener('input', (e) => {
                const scale = parseFloat(e.target.value);
                this.saveModuleBadgeScale(scale);

                // Update display
                const valSpan = document.getElementById('charsheet_module_badge_scale_val');
                if (valSpan) valSpan.textContent = scale.toFixed(2);

                // Re-render module grid if character sheet is open
                if (window.characterUpgrades && window.characterUpgrades.updateCharacterSheet) {
                    window.characterUpgrades.updateCharacterSheet();
                }
            });
        }

        // Module badge X position slider
        const badgeXSlider = document.getElementById('charsheet_module_badge_x');
        if (badgeXSlider) {
            badgeXSlider.addEventListener('input', (e) => {
                const x = parseInt(e.target.value);
                this.saveModuleBadgePosition(x, this.moduleBadgePosition.y);

                // Update display
                const valSpan = document.getElementById('charsheet_module_badge_x_val');
                if (valSpan) valSpan.textContent = x;

                // Re-render module grid
                if (window.characterUpgrades && window.characterUpgrades.updateCharacterSheet) {
                    window.characterUpgrades.updateCharacterSheet();
                }
            });
        }

        // Module badge Y position slider
        const badgeYSlider = document.getElementById('charsheet_module_badge_y');
        if (badgeYSlider) {
            badgeYSlider.addEventListener('input', (e) => {
                const y = parseInt(e.target.value);
                this.saveModuleBadgePosition(this.moduleBadgePosition.x, y);

                // Update display
                const valSpan = document.getElementById('charsheet_module_badge_y_val');
                if (valSpan) valSpan.textContent = y;

                // Re-render module grid
                if (window.characterUpgrades && window.characterUpgrades.updateCharacterSheet) {
                    window.characterUpgrades.updateCharacterSheet();
                }
            });
        }

        // Reset button
        const resetBtn = document.getElementById('charsheet_reset_btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetToDefaults());
        }
    }

    resetToDefaults() {
        // Reset badge settings
        this.saveModuleBadgeScale(0.32);
        this.saveModuleBadgePosition(1, 84);

        const badgeScaleSlider = document.getElementById('charsheet_module_badge_scale');
        if (badgeScaleSlider) badgeScaleSlider.value = 0.32;

        const badgeXSlider = document.getElementById('charsheet_module_badge_x');
        if (badgeXSlider) badgeXSlider.value = 1;

        const badgeYSlider = document.getElementById('charsheet_module_badge_y');
        if (badgeYSlider) badgeYSlider.value = 84;

        // Update displays
        const scaleVal = document.getElementById('charsheet_module_badge_scale_val');
        if (scaleVal) scaleVal.textContent = '0.32';

        const xVal = document.getElementById('charsheet_module_badge_x_val');
        if (xVal) xVal.textContent = '1';

        const yVal = document.getElementById('charsheet_module_badge_y_val');
        if (yVal) yVal.textContent = '84';

        // Re-render module grid to apply changes
        if (window.characterUpgrades && window.characterUpgrades.updateCharacterSheet) {
            window.characterUpgrades.updateCharacterSheet();
        }

        console.log('Module badge settings reset to defaults');
    }
}

// Initialize when loaded
window.characterSheetTabControls = new CharacterSheetTabControls();
