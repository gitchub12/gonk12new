// BROWSERFIREFOXHIDE tab_hud_controls.js
console.log('--- LOADING HUD CONTROLS MANAGER v7 (FINAL REFACTOR) ---');

class HUDControlsManager {
    constructor() {
        this.hudElements = [];
        this.selectedElement = null;
        this.isEditMode = false;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.elementStartPosition = null;
        this.selectionBox = null;
        this.snapshotButton = null;
        this.zIndexDisplay = null;
        this.undoStack = [];
        this.maxUndoSteps = 20;

        this.init();
    }

    init() {
        this.selectionBox = document.createElement('div');
        this.selectionBox.id = 'hud-selection-box';
        Object.assign(this.selectionBox.style, {
            position: 'fixed',
            border: '3px dashed #00ffff',
            pointerEvents: 'none',
            display: 'none',
            zIndex: '999999',
            boxShadow: '0 0 15px #00ffff',
            background: 'rgba(0, 255, 255, 0.1)'
        });
        document.body.appendChild(this.selectionBox);

        this.zIndexDisplay = document.createElement('div');
        this.zIndexDisplay.id = 'hud-zindex-display';
        Object.assign(this.zIndexDisplay.style, {
            position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
            padding: '10px 20px', background: 'rgba(0, 0, 0, 0.9)',
            border: '2px solid #00ffff', color: '#00ffff', fontSize: '16px',
            fontFamily: 'monospace', fontWeight: 'bold', borderRadius: '8px',
            display: 'none', zIndex: '999998',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)'
        });
        document.body.appendChild(this.zIndexDisplay);

        setTimeout(() => {
            this.createSnapshotButton();
            this.registerHUDElements();
            this.addEventListeners();
        }, 2000);
    }

    createSnapshotButton() {
        const globalPanel = document.getElementById('globalControlsPanel');
        if (!globalPanel) return;
        this.snapshotButton = document.createElement('button');
        this.snapshotButton.textContent = 'HUD SNAPSHOT';
        Object.assign(this.snapshotButton.style, {
             padding: '2px 4px', margin: '2px 0', fontSize: '10px', width: '100%',
             background: '#444', border: '1px solid #666', color: '#fff',
             cursor: 'pointer', borderRadius: '4px'
        });
        const globalContent = globalPanel.querySelector('.editor-main-content');
        if (globalContent) globalContent.appendChild(this.snapshotButton);
        this.snapshotButton.addEventListener('click', () => this.snapshotAllHUDPositions());
    }

    registerHUDElements() {
        this.hudElements = [];
        const selectors = [
            { selector: '#faction-avatar-container', name: 'Faction Avatar Grid (3x3)' },
            { selector: '#conversation-gauge-dial', name: 'Gauge Dial & Needle' },
            { selector: '#health-gauge-canvas', name: 'Health Gauge' },
            { selector: '#power-gauge-canvas', name: 'Power Gauge' },
            { selector: '#health-energy-overlay', name: 'Health/Energy Overlay' },
            { selector: '.weapon-display', name: 'Weapon Display' },
            { selector: '.ammo-display', name: 'Ammo Display' },
            { selector: '.ally-boxes', name: 'Ally Boxes' },
            { selector: '.game-hud-container', name: 'Main HUD Container' }
        ];

        selectors.forEach(config => {
            const element = document.querySelector(config.selector);
            if (element) {
                this.hudElements.push({ element, name: config.name, selector: config.selector });
            }
        });
    }

    addEventListeners() {
        const checkHideButton = () => {
            const hideButton = document.getElementById('hide-tabs-button');
            if (!hideButton) { setTimeout(checkHideButton, 500); return; }
            hideButton.addEventListener('click', () => {
                setTimeout(() => {
                    const leftPanel = document.getElementById('leftEditorPanel');
                    this.isEditMode = (leftPanel && leftPanel.style.display === 'none');
                    this.updateEditModeVisuals();
                }, 150);
            });
        };
        checkHideButton();

        document.addEventListener('contextmenu', (e) => {
            if (!this.isEditMode) return;
            e.preventDefault();
            e.stopPropagation();

            if (this.isDragging) {
                const newPosition = this.getElementPosition(this.selectedElement.element);
                this.pushUndo({ element: this.selectedElement.element, name: this.selectedElement.name, oldPosition: this.elementStartPosition, newPosition });
                this.updateSlidersForElement(this.selectedElement, newPosition);
                this.isDragging = false;
                this.deselectElement();
            } else {
                this.selectElement(e);
                if (this.selectedElement) {
                    this.isDragging = true;
                    this.dragStartX = e.clientX;
                    this.dragStartY = e.clientY;
                    this.elementStartPosition = this.getElementPosition(this.selectedElement.element);
                }
            }
        }, true);

        document.addEventListener('mousedown', (e) => { if (this.isDragging && e.button === 0) e.preventDefault(); });
        document.addEventListener('mouseup', (e) => { /* Left-click does not drop */ });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging || !this.selectedElement) return;
            this.moveElement(this.selectedElement.element, e.clientX - this.dragStartX, e.clientY - this.dragStartY);
            this.updateSelectionBox();
            e.preventDefault();
        });

        document.addEventListener('wheel', (e) => {
            if (!this.isEditMode || !this.selectedElement) return;
            e.preventDefault();
            this.adjustZIndex(e.deltaY > 0 ? -1 : 1);
        }, { passive: false });

        document.addEventListener('keydown', (e) => {
            if (!this.isEditMode) return;
            if (e.key === 'Escape') this.deselectElement();
            else if (e.key === 'z' && e.ctrlKey) { e.preventDefault(); this.undo(); }
        });
    }

    updateEditModeVisuals() {
        this.hudElements.forEach(item => {
            if (item.element) {
                item.element.style.outline = this.isEditMode ? '1px dashed rgba(0, 255, 255, 0.3)' : '';
                item.element.style.cursor = this.isEditMode ? 'pointer' : '';
            }
        });
    }

    enableEditMode() { this.isEditMode = true; this.updateEditModeVisuals(); }
    disableEditMode() { this.isEditMode = false; this.deselectElement(); this.updateEditModeVisuals(); }

    selectElement(event) {
        let bestMatch = null;
        let smallestArea = Infinity;
        for (const item of this.hudElements) {
            const rect = item.element.getBoundingClientRect();
            if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                const area = rect.width * rect.height;
                if (area < smallestArea) { smallestArea = area; bestMatch = item; }
            }
        }
        if (bestMatch) {
            this.selectedElement = bestMatch;
            this.showSelectionBox(bestMatch.element);
            this.updateZIndexDisplay();
        } else {
            this.deselectElement();
        }
    }

    showSelectionBox(element) {
        const rect = element.getBoundingClientRect();
        Object.assign(this.selectionBox.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    }

    updateSelectionBox() { if (this.selectedElement) this.showSelectionBox(this.selectedElement.element); }

    updateZIndexDisplay() {
        if (!this.selectedElement) { this.zIndexDisplay.style.display = 'none'; return; }
        const zIndex = window.getComputedStyle(this.selectedElement.element).zIndex;
        this.zIndexDisplay.textContent = `${this.selectedElement.name} | Z-Index: ${zIndex}`;
        this.zIndexDisplay.style.display = 'block';
    }

    adjustZIndex(delta) {
        if (!this.selectedElement) return;
        const element = this.selectedElement.element;
        const currentZ = parseInt(window.getComputedStyle(element).zIndex) || 0;
        element.style.zIndex = Math.max(0, Math.min(9999, currentZ + delta));
        this.updateZIndexDisplay();
    }

    deselectElement() {
        this.selectedElement = null;
        if(this.selectionBox) this.selectionBox.style.display = 'none';
        if(this.zIndexDisplay) this.zIndexDisplay.style.display = 'none';
    }

    getElementPosition(element) { return { transform: window.getComputedStyle(element).transform }; }

    moveElement(element, deltaX, deltaY) {
        const startTransform = this.elementStartPosition.transform === 'none' ? new DOMMatrix() : new DOMMatrix(this.elementStartPosition.transform);
        const newX = startTransform.m41 + deltaX;
        const newY = startTransform.m42 + deltaY;
        const newMatrix = new DOMMatrix([startTransform.a, startTransform.b, startTransform.c, startTransform.d, newX, newY]);
        element.style.transform = newMatrix.toString();
    }

    updateSlidersForElement(selectedItem, newPosition) {
        try {
            if (!selectedItem) return;
            const transform = newPosition.transform === 'none' ? new DOMMatrix() : new DOMMatrix(newPosition.transform);
            const updateSlider = (sliderId, value) => {
                const slider = document.getElementById(sliderId);
                if (slider) {
                    slider.value = value;
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                }
            };
            const name = selectedItem.name;
            const x = transform.m41;
            const y = transform.m42;
            const scaleX = transform.a;
            const scaleY = transform.d;

            let prefix = '';
            switch (name) {
                case 'Health/Energy Overlay': prefix = 'ui_health_energy_overlay'; break;
                case 'Gauge Dial & Needle': prefix = 'ui_conv_gauge_dial_offset'; break;
                default: return;
            }
            updateSlider(`${prefix}_x`, x);
            updateSlider(`${prefix}_y`, y);
            updateSlider(`${prefix}_scaleX`, scaleX);
            updateSlider(`${prefix}_scaleY`, scaleY);

        } catch (error) {
            console.error("Critical error in updateSlidersForElement, drag will not stick:", error);
        }
    }

    pushUndo(action) {
        this.undoStack.push(action);
        if (this.undoStack.length > this.maxUndoSteps) this.undoStack.shift();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const action = this.undoStack.pop();
        action.element.style.transform = action.oldPosition.transform;
        if (this.selectedElement && this.selectedElement.element === action.element) this.updateSelectionBox();
        this.updateSlidersForElement(action, action.oldPosition);
    }

    snapshotAllHUDPositions() {
        this.hudElements.forEach(item => {
            const element = item.element;
            const computed = window.getComputedStyle(element);
            console.log(`--- ${item.name} ---`);
            console.log(`transform: ${computed.transform}`);
            console.log(`z-index: ${computed.zIndex}`);
        });
    }
}

if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => { window.hudControlsManager = new HUDControlsManager(); });
}