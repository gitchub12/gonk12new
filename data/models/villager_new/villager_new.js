window.VillagerNewModel = {
    name: 'villager_new',
    textureWidth: 64,
    textureHeight: 64,
    parts: {
        head: { size: [8, 10, 8], uvOffset: [0, 0], position: [0, 14, 0], pivot: [0, 14, 0], parent: 'body' },
        nose: { size: [2, 4, 2], uvOffset: [24, 0], position: [0, 10, -4], pivot: [0, 10, -4], parent: 'head' },
        body: { size: [8, 12, 4], uvOffset: [16, 20], position: [0, 6, 0], pivot: [0, 6, 0], parent: null },
        arms: { size: [16, 12, 4], uvOffset: [40, 20], position: [0, 12, 0], pivot: [0, 12, 0], parent: 'body' },
        rightLeg: { size: [4, 12, 4], uvOffset: [0, 22], position: [-2, 0, 0], pivot: [-2, 0, 0], parent: 'body' },
        leftLeg: { size: [4, 12, 4], uvOffset: [0, 22], position: [2, 0, 0], pivot: [2, 0, 0], parent: 'body' }
    },
    scale: 0.0625,
    animationSpeed: 1.0,
    getUVMap: function (partName, isOverlay = false) {
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
    getGroundOffset: function (scaleY, modelScale, universalScale) {
        return 12 * scaleY * modelScale * universalScale;
    },
    applyAnimation: function (character, animState, time, options) {
        const parts = character.parts;
        if (!parts.rightLeg || !parts.leftLeg) return;

        switch (animState) {
            case 'walk':
                const walk = Math.sin(time * 2) * 0.4;
                parts.rightLeg.rotation.x = walk;
                parts.leftLeg.rotation.x = -walk;
                break;
            case 'idle':
                const idle = Math.sin(time * 0.5) * 0.1;
                parts.head.rotation.y = idle;
                break;
        }
    }
};
// console.log('VillagerNew model definition loaded');