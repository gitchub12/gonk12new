// BROWSERFIREFOXHIDE furniture.js
// fix: Rewritten to auto-discover models from models/block/ folder and resolve parent chain for geometry+textures.
console.log("FurnitureLoader v4 loaded - Auto-discovery enabled.");
class FurnitureLoader {
    constructor(assetManager) {
        this.assetManager = assetManager;
        this.modelCache = new Map();
        this.modelBasePath = '/data/furniture/';
        this.discoveredModels = new Map(); // Maps model name to { blockJson, customJson, textures }
        this.isDiscovered = false;
    }

    async discoverModels() {
        if (this.isDiscovered) return;

        try {
            // Fetch list of block JSONs (these define textures and parent references)
            const blockPath = `${this.modelBasePath}models/block/`;
            const response = await fetch(blockPath);
            if (!response.ok) {
                console.warn(`Could not fetch block model directory listing from ${blockPath}`);
                return;
            }
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href && href.endsWith('.json') && !href.includes('/'));

            console.log(`Discovered ${links.length} furniture block models.`);

            for (const jsonFile of links) {
                const modelName = jsonFile.replace('.json', '');
                this.discoveredModels.set(modelName, {
                    blockPath: `${blockPath}${jsonFile}`,
                    loaded: false
                });
            }

            this.isDiscovered = true;
        } catch (error) {
            console.warn("Could not auto-discover furniture models:", error);
        }
    }

    async getModel(modelName) {
        // Normalize name (remove underscores to match, handle holo_table -> holotable)
        const normalizedName = modelName.replace(/_/g, '').toLowerCase();

        // Try exact match first, then normalized match
        let actualModelName = modelName;
        if (!this.discoveredModels.has(modelName)) {
            // Try to find by normalized name
            for (const [key] of this.discoveredModels) {
                if (key.replace(/_/g, '').toLowerCase() === normalizedName) {
                    actualModelName = key;
                    break;
                }
            }
        }

        if (this.modelCache.has(actualModelName)) {
            const cached = this.modelCache.get(actualModelName);
            return cached ? cached.clone() : null;
        }

        await this.discoverModels();

        const modelInfo = this.discoveredModels.get(actualModelName);
        if (!modelInfo) {
            console.error(`Furniture model "${modelName}" not found in discovered models.`);
            return null;
        }

        try {
            // Load block JSON (has texture mappings)
            const blockResponse = await fetch(modelInfo.blockPath);
            if (!blockResponse.ok) throw new Error(`Failed to load block JSON: ${modelInfo.blockPath}`);
            const blockData = await blockResponse.json();

            // Extract texture mappings from block JSON
            const textureMappings = {};
            if (blockData.textures) {
                for (const key in blockData.textures) {
                    const texturePath = blockData.textures[key];
                    if (texturePath && typeof texturePath === 'string') {
                        // Convert "chronokillers_star_wars:blocks/crate" to actual path
                        const cleanPath = texturePath.replace(/^[^:]+:/, ''); // Remove namespace prefix
                        textureMappings[key] = cleanPath;
                    }
                }
            }

            // Resolve parent to get custom model with geometry
            let customModelPath = null;
            if (blockData.parent) {
                // "chronokillers_star_wars:custom/crate" -> "models/custom/crate.json"
                const parentRef = blockData.parent.replace(/^[^:]+:/, ''); // Remove namespace
                customModelPath = `${this.modelBasePath}models/${parentRef}.json`;
            } else {
                // If no parent, the block JSON might have geometry directly
                customModelPath = modelInfo.blockPath;
            }

            // Load custom model (has geometry)
            const customResponse = await fetch(customModelPath);
            if (!customResponse.ok) throw new Error(`Failed to load custom model: ${customModelPath}`);
            const customData = await customResponse.json();

            // Preload all textures
            const texturePromises = [];
            for (const key in textureMappings) {
                const texturePath = textureMappings[key];
                if (texturePath) {
                    const fullTexturePath = `${this.modelBasePath}textures/${texturePath}.png`;
                    texturePromises.push(this.assetManager.loadTexture(fullTexturePath));
                }
            }
            await Promise.all(texturePromises);

            // Create 3D model from geometry + textures
            const modelObject = this.createModelObject(customData, textureMappings, actualModelName);
            if (modelObject) {
                if (blockData.interaction) {
                    modelObject.userData.interaction = blockData.interaction;
                }
                this.modelCache.set(actualModelName, modelObject);
                return modelObject.clone();
            }
            throw new Error("createModelObject returned null");

        } catch (error) {
            console.error(`Error processing furniture model ${actualModelName}:`, error);
            this.modelCache.set(actualModelName, null);
            return null;
        }
    }

    createModelObject(modelData, textureMappings = {}, modelName = '') {
        const group = new THREE.Group();
        const scale = 0.03125; // Fixed: was double size (0.0625)

        if (modelName === 'holotable') {
            group.rotation.x = -Math.PI / 2;
        }

        if (!modelData.elements || !Array.isArray(modelData.elements)) {
            console.error("Invalid model data: 'elements' property is missing or not an array.", modelData);
            return group;
        }

        // Build materials from texture mappings
        const materials = {};
        for (const key in textureMappings) {
            const texturePath = textureMappings[key];
            if (!texturePath) continue;
            const materialName = texturePath.split('/').pop().replace(/\..+$/, '');
            const material = this.assetManager.getMaterial(materialName);
            if (material) {
                materials[key] = material;
            }
        }

        modelData.elements.forEach((element, i) => {
            if (!element.from || !Array.isArray(element.from) || element.from.length < 3 ||
                !element.to || !Array.isArray(element.to) || element.to.length < 3) {
                console.warn(`Skipping element ${i} due to missing or invalid 'from'/'to' properties.`, element);
                return;
            }

            // Auto-correct inverted from/to coordinates
            const from = [
                Math.min(element.from[0], element.to[0]),
                Math.min(element.from[1], element.to[1]),
                Math.min(element.from[2], element.to[2])
            ];
            const to = [
                Math.max(element.from[0], element.to[0]),
                Math.max(element.from[1], element.to[1]),
                Math.max(element.from[2], element.to[2])
            ];
            const size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];

            // Safety check for zero-size elements
            if (size.some(s => s <= 0)) {
                console.warn(`Skipping element ${i} due to zero/negative size after correction.`, element);
                return;
            }
            const geometry = new THREE.BoxGeometry(size[0] * scale, size[1] * scale, size[2] * scale);

            const position = [
                (from[0] + size[0] / 2) * scale,
                (from[1] + size[1] / 2) * scale,
                (from[2] + size[2] / 2) * scale
            ];

            const faceMaterials = [];
            // THREE.js r128 BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
            // Minecraft face names map: east=+X, west=-X, up=+Y, down=-Y, south=+Z, north=-Z
            const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];

            // Get UV attribute from BufferGeometry (24 vertices: 4 per face × 6 faces)
            const uvAttribute = geometry.attributes.uv;

            if (element.faces) {
                faceOrder.forEach((faceName, faceIdx) => {
                    const faceData = element.faces[faceName];
                    if (faceData && faceData.texture) {
                        let textureId = faceData.texture.substring(1); // Remove # prefix
                        faceMaterials[faceIdx] = materials[textureId] || new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });

                        if (faceData.uv && Array.isArray(faceData.uv) && faceData.uv.length >= 4 && uvAttribute) {
                            const uv = faceData.uv;
                            const u0 = uv[0] / 16; const v0 = uv[1] / 16;
                            const u1 = uv[2] / 16; const v1 = uv[3] / 16;

                            // BufferGeometry stores 4 vertices per face in order:
                            // Vertex 0 (bottom-left), Vertex 1 (bottom-right), Vertex 2 (top-left), Vertex 3 (top-right)
                            // Face vertex indices: faceIdx * 4 + (0,1,2,3)
                            const baseVertex = faceIdx * 4;

                            // Set UVs for the 4 vertices of this face
                            // Minecraft UV: [u0, v0, u1, v1] where v is top-down (flip Y)
                            uvAttribute.setXY(baseVertex + 0, u0, 1 - v1); // bottom-left
                            uvAttribute.setXY(baseVertex + 1, u1, 1 - v1); // bottom-right
                            uvAttribute.setXY(baseVertex + 2, u0, 1 - v0); // top-left
                            uvAttribute.setXY(baseVertex + 3, u1, 1 - v0); // top-right
                        }
                    } else {
                        faceMaterials[faceIdx] = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
                    }
                });
                uvAttribute.needsUpdate = true;
            }

            const mesh = new THREE.Mesh(geometry, faceMaterials);
            mesh.position.set(position[0], position[1], position[2]);

            if (element.rotation && element.rotation.origin && Array.isArray(element.rotation.origin) && element.rotation.origin.length >= 3) {
                const rot = element.rotation;
                const angle = THREE.MathUtils.degToRad(rot.angle);
                const axis = new THREE.Vector3(rot.axis === 'x' ? 1 : 0, rot.axis === 'y' ? 1 : 0, rot.axis === 'z' ? 1 : 0);

                const origin = new THREE.Vector3( rot.origin[0] * scale, rot.origin[1] * scale, rot.origin[2] * scale );

                const pivot = new THREE.Group();
                pivot.position.copy(origin);
                mesh.position.sub(origin);
                pivot.add(mesh);
                pivot.quaternion.setFromAxisAngle(axis, angle);
                group.add(pivot);
            } else {
                group.add(mesh);
            }
        });

        return group;
    }

    // Helper to get all discovered model names (for editor UI)
    async getAvailableModels() {
        await this.discoverModels();
        return Array.from(this.discoveredModels.keys()).sort();
    }

    // Get the model's geometry data (for physics)
    async getModelData(modelName) {
        await this.discoverModels();

        // Normalize name
        const normalizedName = modelName.replace(/_/g, '').toLowerCase();
        let actualModelName = modelName;
        if (!this.discoveredModels.has(modelName)) {
            for (const [key] of this.discoveredModels) {
                if (key.replace(/_/g, '').toLowerCase() === normalizedName) {
                    actualModelName = key;
                    break;
                }
            }
        }

        const modelInfo = this.discoveredModels.get(actualModelName);
        if (!modelInfo) {
            console.error(`Furniture model "${modelName}" not found for getModelData.`);
            return null;
        }

        try {
            const blockResponse = await fetch(modelInfo.blockPath);
            if (!blockResponse.ok) return null;
            const blockData = await blockResponse.json();

            let customModelPath = modelInfo.blockPath;
            if (blockData.parent) {
                const parentRef = blockData.parent.replace(/^[^:]+:/, '');
                customModelPath = `${this.modelBasePath}models/${parentRef}.json`;
            }

            const customResponse = await fetch(customModelPath);
            if (!customResponse.ok) return null;
            return await customResponse.json();
        } catch (error) {
            console.error(`Error getting model data for ${actualModelName}:`, error);
            return null;
        }
    }
}