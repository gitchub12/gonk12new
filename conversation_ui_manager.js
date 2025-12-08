// BROWSERFIREFOXHIDE conversation_ui_manager.js
console.log('--- LOADING CONVERSATION UI MANAGER v14 (ORIGIN & VISIBILITY FIX) ---');

class ConversationUIManager {
    constructor() {
        this.hudContainer = document.querySelector('.game-hud-container');
        this.container = document.getElementById('conversation-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'conversation-container';
            document.body.appendChild(this.container);
        }
        Object.assign(this.container.style, {
            position: 'absolute', bottom: '220px', left: '50%', transform: 'translateX(-50%)',
            width: '600px', height: 'auto', display: 'flex', flexDirection: 'column',
            justifyContent: 'flex-end', alignItems: 'center', gap: '5px',
            pointerEvents: 'none', zIndex: '1000'
        });

        this.isFactionDisplayVisible = true;
        this.wasFactionDisplayVisibleBeforeConv = true;

        // --- ConversationGauge Group ---
        this.conversationGaugeGroup = document.createElement('div');
        this.conversationGaugeGroup.id = 'conversation-gauge-group';
        this.createGauge(); // Creates this.gaugeContainer
        this.conversationGaugeGroup.appendChild(this.gaugeContainer);
        this.hudContainer.appendChild(this.conversationGaugeGroup);

        // --- Apply Group Styles ---
        const baseGroupStyle = {
            position: 'absolute',
            transformOrigin: 'bottom right',
            transition: 'transform 0.3s ease-out',
        };
        Object.assign(this.conversationGaugeGroup.style, {
            ...baseGroupStyle,
            zIndex: 10,
            bottom: '0px',
            right: '0px',
            opacity: '0.3' // Semi-transparent when not in use
        });

        // --- Other UI Elements ---
        this.svgContainer = document.getElementById('conversation-lines-svg');
        this.slots = Array.from({ length: 4 }, (_, i) => this.setupSlot(`conversation-slot-${i + 1}`));
        this.offscreenIndicators = document.getElementById('offscreen-indicators');
        this.camera = null;
        this.canvas = null;
        this.activeSlotIndex = -1;

        this.createChoiceOverlay();
        this.createPopupContainer();
        this.updateConversationUIPositions(); // Initial position update
    }


    init(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;
        this.resetToPeekState();
    }

    updateConversationUIPositions() {
        const getSliderValue = (id, defaultValue) => {
            const el = document.getElementById(id);
            return el ? parseFloat(el.value) : defaultValue;
        };

        // --- ConversationGauge (Main) ---
        const gaugeMainX = getSliderValue('ui_conv_gauge_main_offsetX', -248);
        const gaugeMainY = getSliderValue('ui_conv_gauge_main_offsetY', -54);
        const gaugeMainScaleX = getSliderValue('ui_conv_gauge_main_scaleX', 0.7);
        const gaugeMainScaleY = getSliderValue('ui_conv_gauge_main_scaleY', 0.6);
        if (this.conversationGaugeGroup) {
            this.conversationGaugeGroup.style.transform = `translate(${gaugeMainX}px, ${gaugeMainY}px) scale(${gaugeMainScaleX}, ${gaugeMainScaleY})`;
        }

        // --- ConversationGauge (Dial) ---
        const gaugeDialX = getSliderValue('ui_conv_gauge_dial_offsetX', 0);
        const gaugeDialY = getSliderValue('ui_conv_gauge_dial_offsetY', 0);
        const gaugeDialScaleX = getSliderValue('ui_conv_gauge_dial_scaleX', 1);
        const gaugeDialScaleY = getSliderValue('ui_conv_gauge_dial_scaleY', 1);
        if (this.gaugeContainer) {
            this.gaugeContainer.style.transform = `translate(${gaugeDialX}px, ${gaugeDialY}px) scale(${gaugeDialScaleX}, ${gaugeDialScaleY})`;
        }

        // --- Speech Box (separate) ---
        const speechX = getSliderValue('ui_conv_speech_x', 0);
        const speechY = getSliderValue('ui_conv_speech_y', 40);
        const speechScale = getSliderValue('ui_conv_speech_scale', 1);
        if (this.container) {
            this.container.style.transform = `translateX(-50%) translate(${speechX}px, ${speechY}px) scale(${speechScale})`;
        }
    }

    createGauge() {
        this.gaugeContainer = document.createElement('div');
        this.gaugeContainer.id = 'conversation-gauge-dial';
        Object.assign(this.gaugeContainer.style, {
            position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
            pointerEvents: 'none', transformOrigin: 'bottom right' // Reverted
        });
        this.gaugeNeedle = document.createElement('div');
        Object.assign(this.gaugeNeedle.style, {
            position: 'absolute', bottom: '10px', left: '126px', width: '4px', height: '90px',
            background: '#FFF', transformOrigin: 'bottom center', transform: 'rotate(0deg)',
            transition: 'transform 1.0s cubic-bezier(0.25, 1, 0.5, 1)',
            boxShadow: '0 0 4px #000', borderRadius: '2px'
        });
        this.gaugeContainer.appendChild(this.gaugeNeedle);
    }

    showConversationHud() {
        this.wasFactionDisplayVisibleBeforeConv = this.isFactionDisplayVisible;
        if (!this.isFactionDisplayVisible) this.toggleFactionDisplay();

        // Show the gauge with full opacity
        if (this.conversationGaugeGroup) {
            this.conversationGaugeGroup.style.opacity = '1';
        }
        this.updateConversationUIPositions();
    }

    hideConversationHud() {
        // Fade the gauge to semi-transparent
        if (this.conversationGaugeGroup) {
            this.conversationGaugeGroup.style.opacity = '0.3';
        }
        if (!this.wasFactionDisplayVisibleBeforeConv) this.toggleFactionDisplay();
    }

    // ... The rest of the file is unchanged, but included for completeness ...

    setupSlot(id) {
        let wrapper = document.getElementById(id);
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = id;
            wrapper.innerHTML = `<div class="faction-label"></div><div class="conversation-box" style="opacity: 0;"></div>`;
            this.container.appendChild(wrapper);
        }
        const box = wrapper.querySelector('.conversation-box');
        const label = wrapper.querySelector('.faction-label');
        Object.assign(wrapper.style, {
            position: 'relative', width: '100%', display: 'none', marginBottom: '2px',
            transition: 'all 0.3s ease-out', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '10px'
        });
        Object.assign(label.style, {
            color: '#FFF', fontSize: '16px', fontWeight: 'bold', textShadow: '1px 1px 2px #000', flexShrink: 0
        });
        Object.assign(box.style, {
            background: 'rgba(0, 0, 0, 0.85)', border: '1px solid #555', borderRadius: '4px',
            padding: '5px 15px', color: '#FFF', fontSize: '18px', lineHeight: '1.2',
            boxShadow: '0 1px 2px rgba(0,0,0,0.5)', transition: 'opacity 0.3s ease, transform 0.3s ease',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '500px'
        });
        return { wrapper, box, label, pointer: null, speaker: null };
    }

    createChoiceOverlay() {
        this.choiceContainer = document.createElement('div');
        Object.assign(this.choiceContainer.style, {
            position: 'absolute', bottom: '250px', left: '50%',
            transform: 'translateX(-50%)', display: 'none',
            gap: '20px', zIndex: '2000'
        });
        const createBtn = (key, color) => {
            const div = document.createElement('div');
            Object.assign(div.style, {
                padding: '15px 30px', background: 'rgba(0,0,0,0.9)', border: `3px solid ${color}`,
                color: 'white', fontSize: '24px', borderRadius: '8px',
                textAlign: 'center', boxShadow: `0 0 10px ${color}`
            });
            return div;
        };
        this.btnLeft = createBtn('Q', '#00FFFF');
        this.btnRight = createBtn('E', '#FF0000');
        this.choiceTimerBar = document.createElement('div');
        Object.assign(this.choiceTimerBar.style, {
            position: 'absolute', bottom: '-15px', left: '0',
            width: '100%', height: '6px', background: 'white',
            boxShadow: '0 0 5px white'
        });
        this.choiceContainer.appendChild(this.btnLeft);
        this.choiceContainer.appendChild(this.btnRight);
        this.choiceContainer.appendChild(this.choiceTimerBar);
        document.body.appendChild(this.choiceContainer);
    }

    createPopupContainer() {
        this.popupContainer = document.createElement('div');
        Object.assign(this.popupContainer.style, {
            position: 'absolute', left: 'auto', right: '260px', bottom: '140px',
            width: '256px', display: 'flex', flexDirection: 'column',
            gap: '5px', pointerEvents: 'none', zIndex: '1000',
            textShadow: '0 0 2px black'
        });
        document.body.appendChild(this.popupContainer);
    }

    toggleFactionDisplay() {
        this.isFactionDisplayVisible = !this.isFactionDisplayVisible;
        if (this.isFactionDisplayVisible) {
            this.updateConversationUIPositions();
        }
    }

    hide() {
        window.isConversationUIVisible = false;
        this.slots.forEach(slot => {
            slot.wrapper.style.display = 'none';
            slot.box.innerHTML = '';
        });
        if (this.offscreenIndicators) this.offscreenIndicators.innerHTML = '';
        if (this.gaugeContainer) this.gaugeContainer.style.boxShadow = 'none';
        this.popupContainer.innerHTML = '';
        this.hideChoicePrompt();
    }

    resetToPeekState() {
        this.hide();
        this.container.style.display = 'flex';
    }

    showGauge(startTension) {
        this.updateConversationUIPositions();
        this.updateGauge(startTension);
    }

    updateGauge(value) {
        const clamped = Math.max(-100, Math.min(100, value));
        const deg = clamped * 0.9;
        if (this.gaugeNeedle) this.gaugeNeedle.style.transform = `rotate(${deg}deg)`;
        const color = value > 0 ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 0, 0, 0.6)';
        if (this.gaugeContainer) {
            this.gaugeContainer.style.boxShadow = `0 0 20px 5px ${color}`;
            this.gaugeContainer.animate([
                { boxShadow: `0 0 20px 5px ${color}` },
                { boxShadow: `0 0 50px 15px ${color}` },
                { boxShadow: `0 0 20px 5px ${color}` }
            ], { duration: 500, iterations: 1 });
        }
    }

    showStatPopup(name, stat, value, color) {
        const el = document.createElement('div');
        const sign = value >= 0 ? '+' : '';
        el.innerHTML = `${stat}: <span style="color:${color}; font-weight:bold">${sign}${Math.floor(value)}</span>`;
        Object.assign(el.style, {
            fontSize: '16px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.7)',
            padding: '5px 8px', borderRadius: '4px', opacity: '0',
            transform: 'translateY(10px)', transition: 'all 0.3s ease-out'
        });
        this.popupContainer.appendChild(el);
        requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 500);
        }, 4000);
    }

    showPhrase(slotIndex, text, speaker, color, labelName) {
        if (slotIndex < 0 || slotIndex >= this.slots.length) return;
        const activeSlot = this.slots[slotIndex];
        activeSlot.speaker = speaker;
        this.activeSlotIndex = slotIndex;
        this.slots.forEach((s, i) => {
            s.wrapper.style.display = 'flex';
            if (i === slotIndex) {
                s.box.style.opacity = '1.0'; s.label.style.opacity = '1.0';
                s.wrapper.style.transform = 'translateY(0) scale(1.0)';
            } else if (i === slotIndex - 1) {
                s.box.style.opacity = '0.6'; s.label.style.opacity = '0.6';
                s.wrapper.style.transform = 'translateY(-30px) scale(0.95)';
            } else if (i === slotIndex - 2) {
                s.box.style.opacity = '0.2'; s.label.style.opacity = '0.2';
                s.wrapper.style.transform = 'translateY(-60px) scale(0.90)';
            } else {
                s.wrapper.style.display = 'none';
            }
        });
        const displayName = speaker.isAlly ? "Ally" : labelName;
        activeSlot.label.textContent = displayName;
        activeSlot.label.style.color = color;
        activeSlot.box.textContent = text;
        activeSlot.box.style.borderColor = color;
        if (slotIndex === 0) {
            activeSlot.box.style.fontStyle = 'italic';
            activeSlot.box.style.color = '#AAAAFF';
        } else {
            activeSlot.box.style.fontStyle = 'normal';
            activeSlot.box.style.color = '#FFF';
        }
        window.isConversationUIVisible = true;
    }

    toggleAllyRingSolid(ally, isSolid) {
        if (!ally || !ally.allyRing) return;
        if (isSolid) {
            const radius = ally.allyRing.geometry.parameters.outerRadius || 0.75;
            const newGeo = new THREE.CircleGeometry(radius, 32);
            ally.allyRing.geometry.dispose();
            ally.allyRing.geometry = newGeo;
            ally.allyRing.material.opacity = 0.6;
        } else {
            const radius = 0.75;
            const newGeo = new THREE.RingGeometry(radius * 0.9, radius, 32);
            ally.allyRing.geometry.dispose();
            ally.allyRing.geometry = newGeo;
            ally.allyRing.material.opacity = 0.3;
        }
    }

    setHighlight(entity, isActive) {
        if (!entity || !entity.mesh || !entity.mesh.group) return;
        if (isActive) {
            if (!entity.convLight) {
                const light = new THREE.PointLight(0xFFFFFF, 1, 3);
                light.position.set(0, 2, 0);
                entity.mesh.group.add(light);
                entity.convLight = light;
            }
        } else {
            if (entity.convLight) {
                entity.mesh.group.remove(entity.convLight);
                entity.convLight = null;
            }
        }
    }

    highlightAllyBox(ally, type) {
        if (!ally || ally.allySlotIndex === undefined) return;
        const id = `ally-box-${ally.allySlotIndex + 1}`;
        const box = document.getElementById(id);
        if (box) {
            box.classList.remove('speaking', 'replying');
            if (type) box.classList.add(type);
        }
    }

    showChoicePrompt(left, right) {
        this.btnLeft.innerHTML = `<span style="color:#00FFFF">[Q]</span> ${left}`;
        this.btnRight.innerHTML = `<span style="color:#FF0000">[E]</span> ${right}`;
        this.choiceContainer.style.display = 'flex';
    }

    updateChoiceTimer(time) {
        const pct = (time / 5.0) * 100;
        this.choiceTimerBar.style.width = `${pct}%`;
    }

    hideChoicePrompt() {
        if (this.choiceContainer) this.choiceContainer.style.display = 'none';
    }

    endConversation(factionName, relChange) {
        const changeText = relChange === 0 ? "No Change" : (relChange < 0 ? "Relationship Improved" : "Relationship Worsened");
        const color = relChange <= 0 ? "#00FF00" : "#FF0000";
        this.showStatPopup(factionName, changeText, Math.abs(relChange), color);
        setTimeout(() => { this.resetToPeekState(); }, 3000);
    }

    shiftAllyBoxesDown() { }

    resetAllyBoxes() {
        if (window.game && window.game.state.allies) {
            window.game.state.allies.forEach(ally => {
                const box = document.getElementById(`ally-box-${ally.npc.allySlotIndex + 1}`);
                if (box) {
                    box.classList.remove('shift-up', 'shift-down', 'speaking', 'replying');
                }
            });
        }
    }

    update() {
        if (this.container.style.display === 'none' || this.activeSlotIndex === -1) {
            if (this.svgContainer) this.svgContainer.style.display = 'none';
            return;
        }
        if (this.svgContainer && this.svgContainer.style.display === 'none') {
            this.svgContainer.style.display = 'block';
        }
        this.offscreenIndicators.innerHTML = '';
        this.slots.forEach(slot => {
            if (slot.pointer) slot.pointer.style.display = 'none';
        });
        const activeSlot = this.slots[this.activeSlotIndex];
        if (activeSlot && activeSlot.speaker && activeSlot.wrapper.style.display !== 'none') {
            this.updateLineAndIndicator(activeSlot);
        }
    }

    updateLineAndIndicator(slot) {
        const { speaker, box, pointer } = slot;
        if (!pointer) return;
        const screenPos = this.getSpeakerScreenPos(speaker);
        const boxRect = box.getBoundingClientRect();
        if (screenPos.z > 1) {
            this.drawPointer(speaker, pointer, box, boxRect, screenPos, true);
            this.createOffscreenIndicator(speaker, box.style.borderColor);
        } else {
            this.drawPointer(speaker, pointer, box, boxRect, screenPos, false);
        }
    }

    getSpeakerScreenPos(speaker) {
        const position = new THREE.Vector3();
        const obj = speaker.mesh.parts && speaker.mesh.parts.head ? speaker.mesh.parts.head : speaker.mesh.group;
        if (!obj || typeof obj.getWorldPosition !== 'function') return { x: -1000, y: -1000, z: 1 };
        obj.getWorldPosition(position);
        position.project(this.camera);
        const x = (position.x * .5 + .5) * this.canvas.clientWidth;
        const y = (position.y * -.5 + .5) * this.canvas.clientHeight;
        return { x, y, z: position.z };
    }

    drawPointer(speaker, pointer, box, boxRect, screenPos, isOffscreen) {
        if (isOffscreen) {
            pointer.style.display = 'none';
            return;
        }
        pointer.style.display = 'block';
        pointer.style.opacity = '0.5';
        pointer.style.fill = box.style.borderColor;
        pointer.style.stroke = 'none';
        const boxCenterX = boxRect.left + (boxRect.width / 2);
        const boxTopY = boxRect.top;
        const triangleWidth = 10;
        const p1x = boxCenterX - triangleWidth / 2;
        const p1y = boxTopY;
        const p2x = boxCenterX + triangleWidth / 2;
        const p2y = boxTopY;
        const p3x = screenPos.x;
        const p3y = screenPos.y;
        const points = `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`;
        pointer.setAttribute('points', points);
    }

    createOffscreenIndicator(speaker, color) {
        const position = new THREE.Vector3();
        speaker.mesh.group.getWorldPosition(position);
        const screenEdgePos = this.getScreenEdge(position);
        const arrow = document.createElement('div');
        arrow.className = 'offscreen-arrow';
        Object.assign(arrow.style, {
            position: 'absolute',
            left: `${screenEdgePos.x}px`,
            top: `${screenEdgePos.y}px`,
            transform: `translate(-50%, -50%) rotate(${screenEdgePos.rotation}rad)`,
            color: color,
            fontSize: '20px'
        });
        arrow.innerHTML = '&#9650;';
        this.offscreenIndicators.appendChild(arrow);
    }

    getScreenEdge(worldPosition) {
        const screenPos = new THREE.Vector3();
        screenPos.copy(worldPosition).project(this.camera);
        const halfWidth = this.canvas.clientWidth / 2;
        const halfHeight = this.canvas.clientHeight / 2;
        const x = screenPos.x * halfWidth;
        const y = screenPos.y * halfHeight;
        let rotation = 0, screenX, screenY;
        if (Math.abs(x) > halfWidth || Math.abs(y) > halfHeight) {
            const slope = y / x;
            if (x > 0) {
                screenX = halfWidth; screenY = halfWidth * slope;
            } else {
                screenX = -halfWidth; screenY = -halfWidth * slope;
            }
            if (screenY > halfHeight) {
                screenX = halfHeight / slope; screenY = halfHeight;
            } else if (screenY < -halfHeight) {
                screenX = -halfHeight / slope; screenY = -halfHeight;
            }
        } else {
            screenX = x; screenY = y;
        }
        screenX += halfWidth;
        screenY = -screenY + halfHeight;
        screenX = Math.max(10, Math.min(this.canvas.clientWidth - 10, screenX));
        screenY = Math.max(10, Math.min(this.canvas.clientHeight - 10, screenY));
        const dx = screenX - (this.canvas.clientWidth / 2);
        const dy = screenY - (this.canvas.clientHeight / 2);
        rotation = Math.atan2(dy, dx) + Math.PI / 2;
        return { x: screenX, y: screenY, rotation };
    }
}