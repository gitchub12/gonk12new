window.EnderDragonModel = {
    name: 'enderdragon',
    textureWidth: 256,
    textureHeight: 256,
    parts: {
        body: { size: [20, 16, 20], uvOffset: [0, 0], position: [0, 24, 0], pivot: [0, 24, 0], parent: null },
        head: { size: [8, 8, 8], uvOffset: [0, 60], position: [0, 32, -10], pivot: [0, 32, -10], parent: 'body' },
        snout: { size: [4, 4, 8], uvOffset: [32, 0], position: [0, 30, -18], pivot: [0, 30, -18], parent: 'head' },
        wing_left: { size: [24, 4, 16], uvOffset: [64, 0], position: [10, 28, 0], pivot: [10, 28, 0], parent: 'body' },
        wing_right: { size: [24, 4, 16], uvOffset: [64, 0], position: [-10, 28, 0], pivot: [-10, 28, 0], parent: 'body', mirror: true },
        wing_tip_left: { size: [24, 2, 12], uvOffset: [64, 20], position: [24, 0, 2], pivot: [24, 0, 2], parent: 'wing_left' },
        wing_tip_right: { size: [24, 2, 12], uvOffset: [64, 20], position: [-24, 0, 2], pivot: [-24, 0, 2], parent: 'wing_right', mirror: true },
        tail_segment_1: { size: [8, 8, 10], uvOffset: [0, 80], position: [0, 20, 10], pivot: [0, 20, 10], parent: 'body' },
        tail_segment_2: { size: [6, 6, 10], uvOffset: [0, 98], position: [0, 0, 10], pivot: [0, 0, 10], parent: 'tail_segment_1' },
        tail_segment_3: { size: [4, 4, 10], uvOffset: [0, 114], position: [0, 0, 10], pivot: [0, 0, 10], parent: 'tail_segment_2' }
    },
    scale: 0.02,
    animationSpeed: 1.0,
    getUVMap: function(partName, isOverlay = false) {
        if (isOverlay) return null;
        const part = this.parts[partName];
        if (!part || !part.uvOffset) return null;
        const [width, height, depth] = part.size;
        const [u, v] = part.uvOffset;
        
        let uvs = {
            left: [u, v + depth, depth, height], right: [u + depth + width, v + depth, depth, height],
            top: [u + depth, v, width, depth], bottom: [u + depth + width, v, width, depth],
            front: [u + depth, v + depth, width, height], back: [u + depth + width + depth, v + depth, width, height]
        };

        if (part.mirror) {
            const temp = uvs.left;
            uvs.left = uvs.right;
            uvs.right = temp;
        }

        return uvs;
    },
    getGroundOffset: function(scaleY, modelScale, universalScale) {
        return 16 * scaleY * modelScale * universalScale;
    },
    applyAnimation: function(character, animState, time, options) {
        const parts = character.parts;
        if (!parts.wing_left || !parts.wing_right) return;

        const wingflap = Math.sin(time * 5) * 0.5;
        parts.wing_left.rotation.z = -wingflap;
        parts.wing_right.rotation.z = wingflap;
        parts.wing_tip_left.rotation.z = -wingflap * 0.5;
        parts.wing_tip_right.rotation.z = wingflap * 0.5;

        const tailSway = Math.sin(time * 2) * 0.2;
        parts.tail_segment_1.rotation.y = tailSway;
        parts.tail_segment_2.rotation.y = tailSway * 1.5;
        parts.tail_segment_3.rotation.y = tailSway * 2.0;
    }
};
console.log('EnderDragon model definition loaded');