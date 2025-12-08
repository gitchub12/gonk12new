window.BatModel = {
    name: 'bat',
    textureWidth: 64,
    textureHeight: 32,
    parts: {
        head: { size: [6, 6, 6], uvOffset: [0, 0], position: [0, 1, 0], pivot: [0, 1, 0], parent: 'body' },
        body: { size: [6, 10, 6], uvOffset: [0, 8], position: [0, -5, 0], pivot: [0, 0, 0], parent: null },
        rightWing: { size: [8, 6, 1], uvOffset: [24, 0], position: [-5, 1, 0], pivot: [-1, 1, 0], parent: 'body' },
        leftWing: { size: [8, 6, 1], uvOffset: [24, 0], position: [5, 1, 0], pivot: [1, 1, 0], parent: 'body' },
        rightWingTip: { size: [8, 6, 1], uvOffset: [24, 8], position: [-8, 0, 0], pivot: [-8, 0, 0], parent: 'rightWing' },
        leftWingTip: { size: [8, 6, 1], uvOffset: [24, 8], position: [8, 0, 0], pivot: [8, 0, 0], parent: 'leftWing' },
        ears: { size: [4, 4, 2], uvOffset: [42, 0], position: [0, 6, 0], pivot: [0, 6, 0], parent: 'head' }
    },
    scale: 0.03,
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

        const wingflap = Math.sin(time * 20) * 0.8;
        parts.leftWing.rotation.z = -wingflap;
        parts.rightWing.rotation.z = wingflap;
        parts.leftWingTip.rotation.z = -wingflap * 0.5;
        parts.rightWingTip.rotation.z = wingflap * 0.5;
    }
};
console.log('Bat model definition loaded');