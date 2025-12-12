
/**
 * Extracted Room Generation Logic from LevelEditor (editor.js)
 * This logic handles the procedural generation of a room within the level editor.
 * It selects textures based on style/theme, places floors, walls, and fills the room with content.
 */

/* Context: This method is part of the LevelEditor class.
   'this' refers to the LevelEditor instance.
   
   Dependencies:
   - this.levelData: The data structure holding the level layers.
   - this.assetManager: Manages game assets (textures, NPCs, etc.).
   - this.gridWidth, this.gridHeight: Level dimensions.
   - this.modifyState: Method to handle state changes for undo/redo.
*/

generateRoom(bounds, config) {
    const { x1, y1, x2, y2, width, height } = bounds;
    const { style, theme, wall2Key, wall3Key, ceilingHeight, elevation, hasWater, furnitureCount, npcConfig, randomPerGame } = config;

    // Helper to get random texture from themed folder
    const getThemedTextures = (layerType) => {
        const basePath = `/data/pngs/${layerType}/${style}/${theme}/`;
        const allTextures = this.assetManager.layerTextures[layerType] || [];
        return allTextures.filter(p => p.startsWith(basePath));
    };

    const getRandomFrom = (arr) => {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    };

    // Get textures from themed folders (style/theme structure)
    // Floors, ceilings, doors, AND walls ARE organized by style/theme
    const themedFloorTextures = getThemedTextures('floor');
    const themedCeilingTextures = getThemedTextures('ceiling');
    const themedDoorTextures = getThemedTextures('door');
    const themedWallTextures = getThemedTextures('wall');

    // Ceiling sides ARE organized by style/theme
    const ceilingSideTextures = getThemedTextures('ceilingsides');

    // REQUIRE themed textures - NO FALLBACK
    if (themedFloorTextures.length === 0) {
        this.statusMsg.textContent = `ERROR: No floor textures found for ${style}/${theme}. Check /data/pngs/floor/${style}/${theme}/`;
        console.error(`No floor textures found in /data/pngs/floor/${style}/${theme}/`);
        return;
    }
    if (themedCeilingTextures.length === 0) {
        this.statusMsg.textContent = `ERROR: No ceiling textures found for ${style}/${theme}. Check /data/pngs/ceiling/${style}/${theme}/`;
        console.error(`No ceiling textures found in /data/pngs/ceiling/${style}/${theme}/`);
        return;
    }
    if (themedWallTextures.length === 0) {
        this.statusMsg.textContent = `ERROR: No wall textures found for ${style}/${theme}. Check /data/pngs/wall/${style}/${theme}/`;
        console.error(`No wall textures found in /data/pngs/wall/${style}/${theme}/`);
        return;
    }

    const floorTextures = themedFloorTextures;
    const ceilingTextures = themedCeilingTextures;
    const doorTextures = themedDoorTextures;
    const wallTextures = themedWallTextures;

    // Get ceiling side texture path with fallback
    const getCeilingSidePath = () => {
        if (ceilingSideTextures.length > 0) {
            return getRandomFrom(ceilingSideTextures);
        }
        // Fallback to global default if themed version doesn't exist
        return '/data/pngs/ceilingsides/cside_default.png';
    };

    // Get elevation side texture path with fallback
    const getElevationSidePath = () => {
        const themedPath = `/data/pngs/elevationsides/${style}/${theme}/eside_default.png`;
        const elevationSides = this.assetManager.layerTextures['elevationsides'] || [];
        if (elevationSides.includes(themedPath)) {
            return themedPath;
        }
        // Fallback to global default
        return '/data/pngs/elevationsides/eside_default.png';
    };

    this.modifyState(() => {
        // 1. Place floors
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                // Don't overwrite existing floor tiles
                if (!this.levelData.floor.has(`${x},${y}`)) {
                    const floorKey = getRandomFrom(floorTextures);
                    if (floorKey) {
                        const floorItem = {
                            type: 'texture',
                            key: floorKey,
                            rotation: 0,
                            properties: randomPerGame ? { randomize: true, style, theme, layerType: 'floor' } : {}
                        };
                        this.levelData.floor.set(`${x},${y}`, floorItem);
                    }
                }

                // Handle elevation if specified (don't overwrite existing)
                if (elevation > 0 && !this.levelData.elevation.has(`${x},${y}`)) {
                    const elevationItem = {
                        type: 'texture',
                        key: `/data/pngs/elevation/${elevation}.png`,
                        rotation: 0,
                        properties: { elevation: elevation, wallsideTexture: getElevationSidePath() }
                    };
                    this.levelData.elevation.set(`${x},${y}`, elevationItem);
                }

                // Handle water if specified (don't overwrite existing)
                if (hasWater && !this.levelData.water.has(`${x},${y}`)) {
                    const waterTextures = this.assetManager.layerTextures.water || [];
                    const waterKey = getRandomFrom(waterTextures);
                    if (waterKey) {
                        this.levelData.water.set(`${x},${y}`, {
                            type: 'texture',
                            key: waterKey,
                            rotation: 0,
                            properties: {}
                        });
                    }
                }

                // Place ceilings (don't overwrite existing)
                if (!this.levelData.ceiling.has(`${x},${y}`)) {
                    const ceilingKey = getRandomFrom(ceilingTextures);
                    if (ceilingKey) {
                        const ceilingItem = {
                            type: 'texture',
                            key: ceilingKey,
                            rotation: 0,
                            properties: {
                                heightMultiplier: ceilingHeight,
                                wallsideTexture: getCeilingSidePath()
                            }
                        };
                        if (randomPerGame) ceilingItem.properties.randomize = true;
                        this.levelData.ceiling.set(`${x},${y}`, ceilingItem);
                    }
                }
            }
        }

        // 2. Place walls around the room perimeter (don't overwrite existing)
        // Top wall (horizontal, along y1-1)
        for (let x = x1; x <= x2; x++) {
            const wallMapKey = `H_${x}_${y1 - 1}`;
            if (!this.levelData.wall.has(wallMapKey)) {
                const wallKey = getRandomFrom(wallTextures);
                if (wallKey) {
                    const wallData = {
                        type: 'texture',
                        key: wallKey,
                        properties: { level2: wall2Key, level3: wall3Key }
                    };
                    if (randomPerGame) wallData.properties.randomize = true;
                    this.levelData.wall.set(wallMapKey, wallData);
                }
            }
        }
        // Bottom wall (horizontal, along y2)
        for (let x = x1; x <= x2; x++) {
            const wallMapKey = `H_${x}_${y2}`;
            if (!this.levelData.wall.has(wallMapKey)) {
                const wallKey = getRandomFrom(wallTextures);
                if (wallKey) {
                    const wallData = {
                        type: 'texture',
                        key: wallKey,
                        properties: { level2: wall2Key, level3: wall3Key }
                    };
                    if (randomPerGame) wallData.properties.randomize = true;
                    this.levelData.wall.set(wallMapKey, wallData);
                }
            }
        }
        // Left wall (vertical, along x1-1)
        for (let y = y1; y <= y2; y++) {
            const wallMapKey = `V_${x1 - 1}_${y}`;
            if (!this.levelData.wall.has(wallMapKey)) {
                const wallKey = getRandomFrom(wallTextures);
                if (wallKey) {
                    const wallData = {
                        type: 'texture',
                        key: wallKey,
                        properties: { level2: wall2Key, level3: wall3Key }
                    };
                    if (randomPerGame) wallData.properties.randomize = true;
                    this.levelData.wall.set(wallMapKey, wallData);
                }
            }
        }
        // Right wall (vertical, along x2)
        for (let y = y1; y <= y2; y++) {
            const wallMapKey = `V_${x2}_${y}`;
            if (!this.levelData.wall.has(wallMapKey)) {
                const wallKey = getRandomFrom(wallTextures);
                if (wallKey) {
                    const wallData = {
                        type: 'texture',
                        key: wallKey,
                        properties: { level2: wall2Key, level3: wall3Key }
                    };
                    if (randomPerGame) wallData.properties.randomize = true;
                    this.levelData.wall.set(wallMapKey, wallData);
                }
            }
        }

        // 3. Place doors at x=10 intervals on top AND bottom walls (avoiding level edges)
        if (doorTextures.length > 0) {
            // Top wall (y1-1) - only if not at y=0 level edge
            const topY = y1 - 1;
            if (topY > 0) {
                for (let x = x1; x <= x2; x++) {
                    if (x % 10 === 0) {
                        const doorMapKey = `H_${x}_${topY}`;
                        if (!this.levelData.door.has(doorMapKey)) {
                            const doorKey = getRandomFrom(doorTextures);
                            if (doorKey) {
                                this.levelData.wall.delete(doorMapKey);
                                this.levelData.door.set(doorMapKey, {
                                    type: 'texture',
                                    key: doorKey,
                                    rotation: 0,
                                    properties: { level2: wall2Key, level3: wall3Key }
                                });
                            }
                        }
                    }
                }
            }

            // Bottom wall (y2) - only if not at maximum y level edge
            const bottomY = y2;
            if (bottomY < this.gridHeight - 1) {
                for (let x = x1; x <= x2; x++) {
                    if (x % 10 === 0) {
                        const doorMapKey = `H_${x}_${bottomY}`;
                        if (!this.levelData.door.has(doorMapKey)) {
                            const doorKey = getRandomFrom(doorTextures);
                            if (doorKey) {
                                this.levelData.wall.delete(doorMapKey);
                                this.levelData.door.set(doorMapKey, {
                                    type: 'texture',
                                    key: doorKey,
                                    rotation: 0,
                                    properties: { level2: wall2Key, level3: wall3Key }
                                });
                            }
                        }
                    }
                }
            }
        }

        // 4. Place NPCs based on threat budget
        if (npcConfig && npcConfig.faction !== 'none' && npcConfig.totalThreat > 0) {
            console.log(`[Room Generator] Starting NPC placement: faction=${npcConfig.faction}, subgroup=${npcConfig.subgroup}, totalThreat=${npcConfig.totalThreat}`);
            let remainingThreat = npcConfig.totalThreat;
            const usedNpcs = new Set();
            let attempts = 0;
            let npcsPlaced = 0;

            while (remainingThreat > 0 && attempts < 100) {
                attempts++;

                // Pick a random threat level
                const maxThreat = Math.min(npcConfig.maxIndividualThreat, remainingThreat);
                const threatLevel = Math.ceil(Math.random() * maxThreat);

                const criteria = {
                    macroCategory: npcConfig.faction,
                    subgroup: npcConfig.subgroup || 'all',
                    threat: threatLevel
                };

                const possibleNpcs = this.assetManager.getNpcsByCriteria ?
                    this.assetManager.getNpcsByCriteria(criteria) : [];

                if (attempts === 1) {
                    console.log(`[Room Generator] First NPC query - criteria:`, criteria, `found ${possibleNpcs.length} NPCs:`, possibleNpcs.slice(0, 5));
                }

                if (possibleNpcs.length > 0) {
                    let chosenKey;
                    if (npcConfig.noRepeats) {
                        const availableNpcs = possibleNpcs.filter(k => !usedNpcs.has(k));
                        if (availableNpcs.length === 0) break;
                        chosenKey = availableNpcs[Math.floor(Math.random() * availableNpcs.length)];
                        usedNpcs.add(chosenKey);
                    } else {
                        chosenKey = possibleNpcs[Math.floor(Math.random() * possibleNpcs.length)];
                    }

                    // Find random position within room, at least 1 unit away from walls
                    const margin = 1;
                    const safeWidth = Math.max(1, width - 2 * margin);
                    const safeHeight = Math.max(1, height - 2 * margin);
                    const npcX = x1 + margin + Math.floor(Math.random() * safeWidth);
                    const npcY = y1 + margin + Math.floor(Math.random() * safeHeight);
                    const npcKey = `${npcX},${npcY}`;

                    // Don't place NPC if one already exists there
                    if (!this.levelData.npcs.has(npcKey)) {
                        this.levelData.npcs.set(npcKey, {
                            type: 'npc',
                            key: chosenKey,
                            rotation: Math.floor(Math.random() * 4),
                            properties: {}
                        });
                        remainingThreat -= threatLevel;
                        npcsPlaced++;
                    }
                }
            }
            console.log(`[Room Generator] NPC placement complete: placed ${npcsPlaced} NPCs in ${attempts} attempts, remaining threat: ${remainingThreat}`);
        }
    });

    this.statusMsg.textContent = `Room generated: ${width}x${height} with ${style}/${theme} style.`;
    this.render();
}
