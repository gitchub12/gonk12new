window.ChickenModel = {
    name: 'chicken',
    textureWidth: 64,
    textureHeight: 32,
    parts: {
        head: { size: [4, 6, 4], uvOffset: [0, 0], position: [0, 7, -2], pivot: [0, 7, -2], parent: 'body' },
        beak: { size: [2, 2, 2], uvOffset: [14, 0], position: [0, 5, -4], pivot: [0, 5, -4], parent: 'head' },
        wattle: { size: [2, 2, 2], uvOffset: [14, 4], position: [0, 3, -4], pivot: [0, 3, -4], parent: 'head' },
        body: { size: [6, 8, 6], uvOffset: [0, 9], position: [0, 0, 0], pivot: [0, 0, 0], parent: null },
        rightLeg: { size: [2, 6, 2], uvOffset: [26, 0], position: [-1, -5, 1], pivot: [-1, -5, 1], parent: 'body' },
        leftLeg: { size: [2, 6, 2], uvOffset: [26, 0], position: [1, -5, 1], pivot: [1, -5, 1], parent: 'body' },
        rightWing: { size: [1, 4, 6], uvOffset: [24, 13], position: [-3.5, 5, 0], pivot: [-3.5, 5, 0], parent: 'body' },
        leftWing: { size: [1, 4, 6], uvOffset: [24, 13], position: [3.5, 5, 0], pivot: [3.5, 5, 0], parent: 'body' }
    },
    scale: 0.05,
    animationSpeed: 1.0,
    getUVMap: function(partName, isOverlay = false) {
        if (isOverlay) return null;
        const part = this.parts[partName];
        if (!part || !part.uvOffset) return null;
        const [width, height, depth] = part.size;
        const [u, v] = part.uvOffset;
        return {
            left: [u, v + depth, depth, height], right: [u + depth + width, v + depth, depth, height],
            top: [u + depth, v, width, depth], bottom: [u + depth + width, v, width, depth],
            front: [u + depth, v + depth, width, height], back: [u + depth + width + depth, v + depth, width, height]
        };
    },
    getGroundOffset: function(scaleY, modelScale, universalScale) {
        return 5 * scaleY * modelScale * universalScale;
    },
    applyAnimation: function(character, animState, time, options) {
        const parts = character.parts;
        if (!parts.leftWing || !parts.rightWing) return;

        switch (animState) {
            case 'walk':
                const walk = Math.sin(time * 4) * 0.6;
                parts.leftLeg.rotation.x = walk;
                parts.rightLeg.rotation.x = -walk;
                parts.leftWing.rotation.z = -walk * 0.5;
                parts.rightWing.rotation.z = walk * 0.5;
                break;
            case 'idle':
                const idle = Math.sin(time * 0.5) * 0.1;
                parts.head.rotation.y = idle;
                break;
        }
    }
};
console.log('Chicken model definition loaded');