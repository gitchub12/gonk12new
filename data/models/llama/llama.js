window.LlamaModel = {
    name: 'llama',
    textureWidth: 64,
    textureHeight: 64,
    parts: {
        body: { size: [8, 8, 16], uvOffset: [0, 0], position: [0, 14, -3], pivot: [0, 14, -3], parent: null },
        head: { size: [4, 4, 6], uvOffset: [0, 24], position: [0, 18, -6], pivot: [0, 18, -6], parent: 'body' },
        leg0: { size: [2, 12, 2], uvOffset: [30, 0], position: [-3, 6, 6], pivot: [-3, 6, 6], parent: 'body' },
        leg1: { size: [2, 12, 2], uvOffset: [30, 0], position: [3, 6, 6], pivot: [3, 6, 6], parent: 'body' },
        leg2: { size: [2, 12, 2], uvOffset: [30, 0], position: [-3, 6, -6], pivot: [-3, 6, -6], parent: 'body' },
        leg3: { size: [2, 12, 2], uvOffset: [30, 0], position: [3, 6, -6], pivot: [3, 6, -6], parent: 'body' },
        chest: { size: [10, 8, 4], uvOffset: [0, 32], position: [0, 14, 5], pivot: [0, 14, 5], parent: 'body' }
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
        return 6 * scaleY * modelScale * universalScale;
    },
    applyAnimation: function (character, animState, time, options) {
        const parts = character.parts;
        if (!parts.leg0 || !parts.leg1 || !parts.leg2 || !parts.leg3) return;

        switch (animState) {
            case 'walk':
                const walk = Math.sin(time * 2) * 0.4;
                parts.leg0.rotation.x = walk;
                parts.leg1.rotation.x = -walk;
                parts.leg2.rotation.x = -walk;
                parts.leg3.rotation.x = walk;
                break;
            case 'idle':
                const idle = Math.sin(time * 0.5) * 0.1;
                parts.head.rotation.y = idle;
                break;
        }
    }
};
// console.log('Llama model definition loaded');