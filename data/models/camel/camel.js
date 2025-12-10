window.CamelModel = {
    name: 'camel',
    textureWidth: 64,
    textureHeight: 64,
    parts: {
        body: { size: [16, 8, 12], uvOffset: [0, 0], position: [0, 10, 0], pivot: [0, 10, 0], parent: null },
        head: { size: [8, 8, 8], uvOffset: [32, 0], position: [0, 18, -6], pivot: [0, 18, -6], parent: 'body' },
        snout: { size: [4, 4, 4], uvOffset: [0, 16], position: [0, 0, -4], pivot: [0, 0, -4], parent: 'head' },
        leg_front_left: { size: [4, 12, 4], uvOffset: [0, 32], position: [4, 2, 6], pivot: [4, 14, 6], parent: 'body' },
        leg_front_right: { size: [4, 12, 4], uvOffset: [16, 32], position: [-4, 2, 6], pivot: [-4, 14, 6], parent: 'body' },
        leg_back_left: { size: [4, 12, 4], uvOffset: [0, 48], position: [4, 2, -6], pivot: [4, 14, -6], parent: 'body' },
        leg_back_right: { size: [4, 12, 4], uvOffset: [16, 48], position: [-4, 2, -6], pivot: [-4, 14, -6], parent: 'body' },
        hump: { size: [10, 6, 10], uvOffset: [0, 20], position: [0, 18, 0], pivot: [0, 18, 0], parent: 'body' },
        tail: { size: [2, 6, 2], uvOffset: [40, 20], position: [0, 12, 6], pivot: [0, 12, 6], parent: 'body' }
    },
    scale: 0.04,
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
        if (!parts.leg_front_left || !parts.leg_front_right || !parts.leg_back_left || !parts.leg_back_right) return;

        switch (animState) {
            case 'walk':
                const walk = Math.sin(time * 2) * 0.4;
                parts.leg_front_left.rotation.x = walk;
                parts.leg_front_right.rotation.x = -walk;
                parts.leg_back_left.rotation.x = -walk;
                parts.leg_back_right.rotation.x = walk;
                break;
            case 'idle':
                const sway = Math.sin(time * 0.5) * 0.1;
                parts.tail.rotation.z = sway;
                parts.head.rotation.y = Math.sin(time * 0.7) * 0.2;
                break;
        }
    }
};
// console.log('Camel model definition loaded');