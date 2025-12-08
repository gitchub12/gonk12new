// BROWSERFIREFOXHIDE TabControls/tab_charactersheet_controls.js
// Character Sheet Element Position Controls for Tab Menu

class CharacterSheetTabControls {
    constructor() {
        this.elements = [
            { id: 'char-name', label: 'Character Name', hasFont: true },
            { id: 'base-stats', label: 'Base Stats (Left Panel)', hasFont: false },
            { id: 'skills', label: 'Skills Display', hasFont: false },
            { id: 'category-headers', label: 'Category Headers', hasFont: false },
            { id: 'current-label', label: 'CURRENT Label', hasFont: false },
            { id: 'current-stats', label: 'Current Stats Row', hasFont: false },
            { id: 'next-label', label: 'NEXT Label', hasFont: false },
            { id: 'next-stats', label: 'Next Stats Row', hasFont: false },
            { id: 'module-grid', label: 'Module Grid', hasFont: false },
            { id: 'wire-display', label: 'Scrap Display', hasFont: false },
            { id: 'credits-display', label: 'Credits Display', hasFont: false }
        ];
    }

    createTabContent() {
        let html = '<h4>Character Sheet Element Controls</h4>';
        html += '<p style="font-size: 12px; color: #888;">Adjust positions of character sheet elements. Changes save automatically.</p>';

        this.elements.forEach(elem => {
            html += `<hr><h4>${elem.label}</h4>`;
            html += `<div class="control-group">`;
            html += `<label>X: <span id="charsheet_${elem.id}_x_val">0</span></label>`;
            html += `<input type="range" class="charsheet-slider" id="charsheet_${elem.id}_x" min="-1000" max="2000" value="0" step="1" data-element="${elem.id}" data-property="left" data-unit="px">`;
            html += `</div>`;
            html += `<div class="control-group">`;
            html += `<label>Y: <span id="charsheet_${elem.id}_y_val">0</span></label>`;
            html += `<input type="range" class="charsheet-slider" id="charsheet_${elem.id}_y" min="-500" max="1500" value="0" step="1" data-element="${elem.id}" data-property="top" data-unit="px">`;
            html += `</div>`;
            html += `<div class="control-group">`;
            html += `<label>Width: <span id="charsheet_${elem.id}_width_val">auto</span></label>`;
            html += `<input type="range" class="charsheet-slider" id="charsheet_${elem.id}_width" min="100" max="2000" value="500" step="10" data-element="${elem.id}" data-property="width" data-unit="px">`;
            html += `</div>`;

            if (elem.hasFont) {
                html += `<div class="control-group">`;
                html += `<label>Font Size: <span id="charsheet_${elem.id}_font_val">36</span></label>`;
                html += `<input type="range" class="charsheet-slider" id="charsheet_${elem.id}_font" min="12" max="100" value="36" step="1" data-element="${elem.id}" data-property="font-size" data-unit="px">`;
                html += `</div>`;
            }
        });

        html += '<hr>';
        html += '<button id="charsheet_snapshot_btn" style="width: 100%; padding: 8px; margin-bottom: 5px;">Snapshot to Console</button>';
        html += '<button id="charsheet_reset_btn" style="width: 100%; padding: 8px;">Reset to Defaults</button>';

        return html;
    }

    setupEventListeners() {
        // Slider listeners
        document.querySelectorAll('.charsheet-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                this.updateElementFromSlider(e.target);
            });
        });

        // Snapshot button
        const snapshotBtn = document.getElementById('charsheet_snapshot_btn');
        if (snapshotBtn) {
            snapshotBtn.addEventListener('click', () => this.snapshotToConsole());
        }

        // Reset button
        const resetBtn = document.getElementById('charsheet_reset_btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetToDefaults());
        }

        // Load saved positions
        this.loadPositions();
    }

    updateElementFromSlider(slider) {
        const elementId = slider.dataset.element;
        const property = slider.dataset.property;
        const unit = slider.dataset.unit || '';
        const value = slider.value;

        // Update value display
        const valSpan = document.getElementById(`${slider.id}_val`);
        if (valSpan) {
            valSpan.textContent = value + (unit || '');
        }

        // Map element-id to actual DOM element ID
        const elementMap = {
            'char-name': 'char-name-element',
            'base-stats': 'base-stats-display',
            'skills': 'skills-display',
            'category-headers': 'category-headers-row',
            'current-label': 'current-label',
            'current-stats': 'current-stats-row',
            'next-label': 'next-label',
            'next-stats': 'next-stats-row',
            'module-grid': 'module-grid-container',
            'wire-display': 'wire-display-element',
            'credits-display': 'credits-display-element'
        };

        const element = document.getElementById(elementMap[elementId]);
        if (!element) return;

        // Apply the style
        if (property === 'font-size') {
            const textElement = element.querySelector('#char-name-text') || element;
            textElement.style.fontSize = value + unit;
        } else {
            element.style[property] = value + unit;
        }

        // Save positions
        this.savePositions();
    }

    savePositions() {
        const positions = {};
        this.elements.forEach(elem => {
            positions[elem.id] = {
                x: document.getElementById(`charsheet_${elem.id}_x`)?.value || '0',
                y: document.getElementById(`charsheet_${elem.id}_y`)?.value || '0',
                width: document.getElementById(`charsheet_${elem.id}_width`)?.value || '500'
            };
            if (elem.hasFont) {
                positions[elem.id].fontSize = document.getElementById(`charsheet_${elem.id}_font`)?.value || '36';
            }
        });

        localStorage.setItem('gonk_charsheet_positions', JSON.stringify(positions));
    }

    loadPositions() {
        const saved = localStorage.getItem('gonk_charsheet_positions');
        if (!saved) return;

        try {
            const positions = JSON.parse(saved);
            Object.keys(positions).forEach(elemId => {
                const pos = positions[elemId];

                const xSlider = document.getElementById(`charsheet_${elemId}_x`);
                if (xSlider) {
                    xSlider.value = pos.x;
                    this.updateElementFromSlider(xSlider);
                }

                const ySlider = document.getElementById(`charsheet_${elemId}_y`);
                if (ySlider) {
                    ySlider.value = pos.y;
                    this.updateElementFromSlider(ySlider);
                }

                const widthSlider = document.getElementById(`charsheet_${elemId}_width`);
                if (widthSlider) {
                    widthSlider.value = pos.width;
                    this.updateElementFromSlider(widthSlider);
                }

                if (pos.fontSize) {
                    const fontSlider = document.getElementById(`charsheet_${elemId}_font`);
                    if (fontSlider) {
                        fontSlider.value = pos.fontSize;
                        this.updateElementFromSlider(fontSlider);
                    }
                }
            });
        } catch (e) {
            console.error('Failed to load character sheet positions:', e);
        }
    }

    snapshotToConsole() {
        console.log('=== CHARACTER SHEET POSITIONS ===');
        this.elements.forEach(elem => {
            const x = document.getElementById(`charsheet_${elem.id}_x`)?.value || '0';
            const y = document.getElementById(`charsheet_${elem.id}_y`)?.value || '0';
            const width = document.getElementById(`charsheet_${elem.id}_width`)?.value || '500';

            console.log(`${elem.label}:`);
            console.log(`  X: ${x}px, Y: ${y}px, Width: ${width}px`);

            if (elem.hasFont) {
                const fontSize = document.getElementById(`charsheet_${elem.id}_font`)?.value || '36';
                console.log(`  Font Size: ${fontSize}px`);
            }
        });
        console.log('=== END SNAPSHOT ===');
    }

    resetToDefaults() {
        // Default positions
        const defaults = {
            'char-name': { x: 0, y: 20, width: 500, fontSize: 36 },
            'base-stats': { x: 40, y: 120, width: 250 },
            'skills': { x: 300, y: 70, width: 800 },
            'category-headers': { x: 300, y: 95, width: 1200 },
            'current-label': { x: 220, y: 120, width: 100 },
            'current-stats': { x: 300, y: 120, width: 1200 },
            'next-label': { x: 250, y: 165, width: 100 },
            'next-stats': { x: 300, y: 165, width: 1200 },
            'module-grid': { x: 300, y: 250, width: 1600 },
            'wire-display': { x: 40, y: 600, width: 200 },
            'credits-display': { x: 40, y: 700, width: 200 }
        };

        Object.keys(defaults).forEach(elemId => {
            const def = defaults[elemId];

            const xSlider = document.getElementById(`charsheet_${elemId}_x`);
            if (xSlider) {
                xSlider.value = def.x;
                this.updateElementFromSlider(xSlider);
            }

            const ySlider = document.getElementById(`charsheet_${elemId}_y`);
            if (ySlider) {
                ySlider.value = def.y;
                this.updateElementFromSlider(ySlider);
            }

            const widthSlider = document.getElementById(`charsheet_${elemId}_width`);
            if (widthSlider) {
                widthSlider.value = def.width;
                this.updateElementFromSlider(widthSlider);
            }

            if (def.fontSize) {
                const fontSlider = document.getElementById(`charsheet_${elemId}_font`);
                if (fontSlider) {
                    fontSlider.value = def.fontSize;
                    this.updateElementFromSlider(fontSlider);
                }
            }
        });

        console.log('Character sheet positions reset to defaults');
    }
}

// Initialize when loaded
window.characterSheetTabControls = new CharacterSheetTabControls();
