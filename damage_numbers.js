// BROWSERFIREFOXHIDE damage_numbers.js
// Floating damage numbers system

class DamageNumbersManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.activeNumbers = [];
        this.enabled = true; // Default ON

        // Settings
        this.fontSize = 48; // Large, readable font
        this.lifetime = 1.5; // seconds
        this.riseSpeed = 1.5; // units per second
        this.fadeDelay = 0.5; // seconds before fading starts
    }

    createDamageNumber(damage, position, isCrit = false) {
        if (!this.enabled) return;

        // Create canvas for the text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Make canvas large enough for text
        canvas.width = 256;
        canvas.height = 128;

        // Setup font
        const fontSize = isCrit ? this.fontSize * 1.5 : this.fontSize;
        context.font = `bold ${fontSize}px monospace`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Draw text with outline for visibility
        const text = Math.round(damage).toString();
        const color = isCrit ? '#ffff00' : '#ffffff'; // Yellow for crits, white for normal

        // Black outline
        context.strokeStyle = '#000000';
        context.lineWidth = 4;
        context.strokeText(text, 128, 64);

        // Colored fill
        context.fillStyle = color;
        context.fillText(text, 128, 64);

        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false, // Always render on top
            depthWrite: false
        });

        const sprite = new THREE.Sprite(spriteMaterial);

        // Scale sprite to be visible
        const scale = isCrit ? 2.0 : 1.5;
        sprite.scale.set(scale, scale * 0.5, 1);

        // Position slightly above the hit position
        sprite.position.copy(position);
        sprite.position.y += 1.5;

        // Set render order to always be on top
        sprite.renderOrder = 9999;

        this.scene.add(sprite);

        // Track this number
        this.activeNumbers.push({
            sprite: sprite,
            startTime: performance.now() / 1000,
            startY: sprite.position.y,
            isCrit: isCrit
        });
    }

    update(deltaTime) {
        if (!this.enabled) {
            // Clean up if disabled
            if (this.activeNumbers.length > 0) {
                this.activeNumbers.forEach(num => this.scene.remove(num.sprite));
                this.activeNumbers = [];
            }
            return;
        }

        const currentTime = performance.now() / 1000;

        // Update all active numbers
        for (let i = this.activeNumbers.length - 1; i >= 0; i--) {
            const num = this.activeNumbers[i];
            const age = currentTime - num.startTime;

            // Remove if too old
            if (age > this.lifetime) {
                this.scene.remove(num.sprite);
                num.sprite.material.map.dispose();
                num.sprite.material.dispose();
                this.activeNumbers.splice(i, 1);
                continue;
            }

            // Rise up
            num.sprite.position.y = num.startY + (this.riseSpeed * age);

            // Fade out after delay
            if (age > this.fadeDelay) {
                const fadeProgress = (age - this.fadeDelay) / (this.lifetime - this.fadeDelay);
                num.sprite.material.opacity = 1 - fadeProgress;
            }

            // Always face camera (billboard)
            num.sprite.quaternion.copy(this.camera.quaternion);
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`Damage numbers ${enabled ? 'enabled' : 'disabled'}`);
    }

    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }

    cleanup() {
        this.activeNumbers.forEach(num => {
            this.scene.remove(num.sprite);
            if (num.sprite.material.map) num.sprite.material.map.dispose();
            num.sprite.material.dispose();
        });
        this.activeNumbers = [];
    }
}

// Global instance
window.damageNumbersManager = null;
