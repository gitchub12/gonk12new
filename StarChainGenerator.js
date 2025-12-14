class StarChainGenerator {
    constructor() {
        this.nodes = []; // The graph of 50 levels
        this.currentNodeIndex = 0;

        // Configuration for Hull Shapes (Bitmaps relative to 64x64)
        this.hullShapes = {
            'WEDGE': this.createWedgeMask(),
            'TUBE': this.createTubeMask(),
            'OVAL': this.createOvalMask()
        };
        this.init();
    }

    // --- PHASE 1: GRID & ANCHORS ---

    init() {
        this.generateGraph();
    }

    generateGraph() {
        console.log("Generating StarChain Ladder Graph...");
        this.nodes = [];

        // Helper to create a node
        const createNode = (depth, lateral) => {
            return {
                id: `SHIP_${depth}_${lateral}`,
                depth: depth,
                lateral: lateral, // -1 (Left), 0 (Center), 1 (Right)
                incomingVector: 'FROM_REAR', // Default, will be patched
                exits: [], // Strings: 'FORWARD', 'LEFT', 'RIGHT'
                factionDominant: this.getRandomFaction(),
                hullStyle: this.getRandomHull(),
                index: this.nodes.length
            };
        };

        // 1. Generate the Nodes (Sparse or Full Ladder?)
        // The prompt implies a trellis. Let's build a sparse set where paths exist.
        // For simplicity, we generate all 3 lanes, but connectivity defines valid paths.
        // Actually, let's just generate a Main Spine and branches.

        let previousLayer = [];

        // Depth 1: Start (Center only)
        const startNode = createNode(1, 0);
        startNode.incomingVector = 'START';
        this.nodes.push(startNode);
        previousLayer = [startNode];

        for (let d = 2; d <= 50; d++) {
            const currentLayer = [];

            // Determine lateral slots for this depth (-1, 0, 1)
            // Strategy: Always keep Center. Randomly add Left/Right side-cars.
            const slots = [0];
            if (Math.random() > 0.3) slots.push(-1);
            if (Math.random() > 0.3) slots.push(1);

            // Create nodes for this layer
            const layerNodes = {};
            slots.forEach(lat => {
                const node = createNode(d, lat);
                this.nodes.push(node);
                layerNodes[lat] = node;
                currentLayer.push(node);
            });

            // Connect Previous Layer to Current Layer
            previousLayer.forEach(prev => {
                // Forward connection?
                if (layerNodes[prev.lateral]) {
                    prev.exits.push('FORWARD');
                    layerNodes[prev.lateral].incomingVector = 'FROM_REAR';
                }

                // Diagonal/Lateral connections?
                // Logic: Ship N(0) can exit Lateral to Ship N+1(1)? Or Ship N(0) -> Ship N(1)?
                // The prompt says "ForwardRight" means entering BackLeft.
                // It implies movement *between* nodes at different depths usually.
                // Let's implement simpler: Lateral moves happen *at same depth* or diagonal forward?
                // "Ship 2R is linked to... 3R and 3L". This implies diagonals.

                // If I am at 0, and 1 exists at d+1...
                if (layerNodes[prev.lateral + 1]) {
                    prev.exits.push('RIGHT'); // Forward-Right
                    layerNodes[prev.lateral + 1].incomingVector = 'FROM_LEFT'; // Entering it from its Left side
                }
                if (layerNodes[prev.lateral - 1]) {
                    prev.exits.push('LEFT'); // Forward-Left
                    layerNodes[prev.lateral - 1].incomingVector = 'FROM_RIGHT'; // Entering it from its Right side
                }
            });

            previousLayer = currentLayer;
        }

        console.log(`Graph Complete. ${this.nodes.length} Nodes linked.`);
        // Map nodes by simple index for generateLevel(i)
        // Since we pushed in order, simple indexing works. 
        // But users travel via links. 
        // LevelManager calls generateLevel(index). We need to map linear index to graph?
        // Wait, currentLevel is just an ID. '20', '21'.
        // We will assume Level ID = Depth for now for the loop.
        // If the user branches, the Level ID might need to handle '20A', '20B'?
        // The user implementation of loadLevel handles 'levelId' as int usually.
        // We will linearize the graph for the "Next Level" button:
        // Exiting Level N only goes to ONE target in the simple engine.
        // We need to bake the choice into the 'target' property of the dock.
    }

    getRandomFaction() {
        const factions = ['IMPERIALS', 'REBELS', 'PIRATES', 'DROIDS'];
        return factions[Math.floor(Math.random() * factions.length)];
    }

    getRandomHull() {
        const styles = ['WEDGE', 'TUBE', 'OVAL'];
        return styles[Math.floor(Math.random() * styles.length)];
    }

    generateLevel(levelIndex) {
        const node = this.nodes[levelIndex];
        if (!node) return null;

        console.log(`Generating Level ${levelIndex + 1} (${node.hullStyle})...`);

        // 1. Initialize Empty Grid Structure (compatible with LevelEditor format)
        const levelData = {
            layers: {
                floor: new Map(),
                wall: new Map(),
                wall2: new Map(),
                wall3: new Map(),
                spawns: new Map(),
                door: new Map(),
                dock: new Map(),
                skybox: new Map(),
                decor: new Map(),
                ceiling: new Map(),
                water: new Map(),
                lights: new Map(),
                npcs: new Map(),
                furniture: new Map(),
                items: new Map()
            },
            width: 64,
            height: 64
        };

        // 2. Apply Hull Mask

        this.applyHullMask(levelData, node.hullStyle);

        // 3. Place Anchors (Spawn & Exit)
        let anchors = this.calculateAnchors(node);

        // FIX: Snap anchors to valid hull so we don't spawn in void
        anchors.spawn = this.snapToHull(anchors.spawn, levelData);
        anchors.exit = this.snapToHull(anchors.exit, levelData);

        // GLOBAL FIX: Force Integers to prevent off-by-0.5 errors between Spawn and Floor
        anchors.spawn.x = Math.round(anchors.spawn.x);
        anchors.spawn.y = Math.round(anchors.spawn.y);
        anchors.exit.x = Math.round(anchors.exit.x);
        anchors.exit.y = Math.round(anchors.exit.y);

        this.placeAnchors(levelData, anchors);

        // 4. Generate Spine (The Arterial Path)
        const spine = this.generateSpine(levelData, anchors);

        // 5. Generate Rooms (The Ribs) & Zoning
        this.generateRooms(levelData, spine, node);

        // 6. Build Weights/Walls around the generated layout
        this.buildWalls(levelData);

        // 4. (Placeholder) Convert Map to Array for serialization if needed, 
        // but LevelManager might handle Maps if we modify it. 
        // Actually LevelManager expects the decompressed object format. 
        // Let's return the "Runtime" format expected by LevelEditor.loadLevel/LevelManager.applyLevel

        return this.finalizeLevelData(levelData);
    }

    buildWalls(levelData) {
        // Redo wall generation based on final floor layout
        levelData.layers.wall.clear();
        // Clear aux layers if they exist (though we won't use them)
        if (levelData.layers.wall2) levelData.layers.wall2.clear();
        if (levelData.layers.wall3) levelData.layers.wall3.clear();

        const floors = levelData.layers.floor;

        // Verified Styling Dictionary
        const wallStyles = {
            'imperials': {
                base: 'data/pngs/wall/imperialstyle/normal/wall_impstandard.png'
            },
            'rebels': {
                base: 'data/pngs/wall/rebelstyle/normal/Gemini_Generated_Image_411xd7411xd7411x.png'
            },
            'overgrown': {
                base: 'data/pngs/wall/neutralstyle/overgrown/Gemini_Generated_Image_obknegobknegobkn.png'
            },
            'default': {
                base: 'data/pngs/wall/wall_1_default.png'
            }
        };

        console.log(`[StarChain] buildWalls: Processing ${floors.size} floor tiles.`);
        let createdWalls = 0;

        floors.forEach((val, key) => {
            const [x, y] = key.split(',').map(Number);
            // Including diagonals
            const neighbors = [
                { x: x + 1, y: y }, { x: x - 1, y: y },
                { x: x, y: y + 1 }, { x: x, y: y - 1 },
                { x: x + 1, y: y + 1 }, { x: x - 1, y: y - 1 },
                { x: x - 1, y: y + 1 }, { x: x + 1, y: y - 1 }
            ];

            neighbors.forEach(n => {
                const nKey = `${n.x},${n.y}`;
                const wallKey = `BLOCK_${n.x}_${n.y}`;

                // If neighbor is NOT floor AND NOT water AND NOT wall already
                if (!floors.has(nKey) && !levelData.layers.water.has(nKey) && !levelData.layers.wall.has(wallKey)) {
                    const styleKey = val.properties?.style || 'default';
                    const styleData = wallStyles[styleKey] || wallStyles['default'];
                    const texture = styleData.base;

                    // Create stacked wall using property-based stacking
                    levelData.layers.wall.set(wallKey, {
                        key: texture,
                        properties: {
                            level2: texture,
                            level3: texture
                        }
                    });

                    createdWalls++;
                }
            });
        });
        console.log(`[StarChain] Created ${createdWalls} wall stacks (Height 3).`);

    }

    calculateAnchors(node) {
        // Default positions (inset slightly to avoid absolute edge float issues)
        let spawn = { x: 32, y: 5, rotation: 0 };
        let exit = { x: 32, y: 58, rotation: 2 };

        if (node.incomingVector === 'FROM_LEFT') {
            spawn = { x: 5, y: 32, rotation: 1 };
        } else if (node.incomingVector === 'FROM_RIGHT') {
            spawn = { x: 58, y: 32, rotation: 3 };
        }

        // Ensure anchors are inside valid hull
        // If not, walk towards center (32,32) until valid
        // Note: we need levelData to check validHull, but calculateAnchors is called before placeAnchors...
        // We might need to pass levelData to calculateAnchors or do this fixup IN placeAnchors.
        // Let's return these "Ideal" positions, and fix them in placeAnchors/generateLevel.
        return { spawn, exit };
    }

    snapToHull(point, levelData) {
        // Walk from point towards center (32,32) until in validHull
        const center = { x: 32, y: 32 };
        let curr = { ...point };

        // Safety Break
        let steps = 0;
        const maxSteps = 32;

        while (steps < maxSteps) {
            if (levelData.validHull.has(`${Math.round(curr.x)},${Math.round(curr.y)}`)) {
                return { x: Math.round(curr.x), y: Math.round(curr.y), rotation: point.rotation };
            }

            // Move towards center
            const dx = center.x - curr.x;
            const dy = center.y - curr.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 1) break; // Reached center

            curr.x += (dx / dist);
            curr.y += (dy / dist);
            steps++;
        }
        return point; // Fallback (likely void)
    }

    generateRooms(levelData, spine, node) {
        // Functional Zoning:
        // Zone A (Start): Imperial Control
        // Zone B (Mid): Contested / War Zone
        // Zone C (End): Rebel Incursion / Objective

        const validVoidTiles = [];
        levelData.validHull.forEach((val, key) => {
            if (!levelData.layers.floor.has(key)) {
                validVoidTiles.push(key);
            }
        });

        console.log(`[StarChain] GenerateRooms: Found ${validVoidTiles.length} valid void tiles for rooms.`);


        const roomCount = 35;
        for (let i = 0; i < roomCount; i++) {
            if (validVoidTiles.length === 0) break;
            const seedKey = validVoidTiles[Math.floor(Math.random() * validVoidTiles.length)];
            const parts = seedKey.split(',');
            const seed = { x: parseInt(parts[0]), y: parseInt(parts[1]) };

            // Determine Faction based on proximity to Start vs End
            // Simple logic: random for now, aiming for "War" feel everywhere
            const roll = Math.random();
            let faction = 'imperials';
            if (roll > 0.6) faction = 'rebels'; // 40% Rebels
            if (roll > 0.9) faction = 'contested'; // 10% Both (Instant fight)

            this.growRoom(levelData, seed, faction);
        }
    }

    growRoom(levelData, seed, faction) {
        // CONFIG
        const styles = {
            'imperials': {
                floor: 'data/pngs/floor/imperialstyle/normal/impfloordark.png',
                ceiling: 'data/pngs/ceiling/imperialstyle/normal/cwith_bar_across.png',
                npcIcon: 'stormtrooper1',
                npcBase: 'stormtrooper',
                npcMacro: 'Imperials'
            },
            'rebels': {
                floor: 'data/pngs/floor/rebelstyle/normal/Gemini_Generated_Image_411xd7411xd7411x.png',
                ceiling: 'data/pngs/ceiling/rebelstyle/normal/cwoodbox.png',
                npcIcon: 'rebel3',
                npcBase: 'rebel_male',
                npcMacro: 'Rebels'
            },
            'overgrown': {
                floor: 'data/pngs/floor/neutralstyle/overgrown/Gemini_Generated_Image_obknegobknegobkn.png',
                ceiling: 'data/pngs/ceiling/neutralstyle/overgrown/cgreen_overgrown.png',
                npcIcon: 'wookiee',
                npcBase: 'wookiee',
                npcMacro: 'Rebels' // Wookiees align with Rebels generally
            }
        };

        // Resolve Style (Default to Imperial if missing)
        let styleKey = faction === 'contested' ? 'imperials' : faction;
        const currentStyle = styles[styleKey] || styles['imperials'];

        // ROOM TYPE
        const isPool = Math.random() < 0.15; // 15% chance for water

        // SHAPES
        const shapes = ['rect', 'cross', 'l_shape'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];

        const tiles = [];
        const width = 5 + Math.floor(Math.random() * 4); // 5-8 size
        const height = 5 + Math.floor(Math.random() * 4);

        if (shape === 'rect') {
            for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) {
                for (let dy = -Math.floor(height / 2); dy <= Math.floor(height / 2); dy++) {
                    tiles.push({ x: seed.x + dx, y: seed.y + dy });
                }
            }
        } else if (shape === 'cross') {
            for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) tiles.push({ x: seed.x + dx, y: seed.y });
            for (let dy = -Math.floor(height / 2); dy <= Math.floor(height / 2); dy++) tiles.push({ x: seed.x, y: seed.y + dy });
        } else {
            for (let dx = 0; dx < width; dx++) {
                for (let dy = 0; dy < height / 2; dy++) tiles.push({ x: seed.x + dx, y: seed.y + dy });
            }
            for (let dy = 0; dy < height; dy++) {
                for (let dx = 0; dx < width / 2; dx++) tiles.push({ x: seed.x + dx, y: seed.y + dy });
            }
        }

        // PAINT TILES
        tiles.forEach(t => {
            const key = `${t.x},${t.y}`;

            // Check collisions with existing floor/water
            if (!levelData.layers.floor.has(key) && !levelData.layers.water.has(key)) {
                if (isPool) {
                    // Pool: Water layer, no floor layer (shows subfloor or void below)
                    levelData.layers.water.set(key, {
                        key: 'data/pngs/water/water_1.png',
                        size: 1
                    });
                    levelData.layers.ceiling.set(key, {
                        key: currentStyle.ceiling,
                        rotation: 0,
                        properties: { heightMultiplier: 3 }
                    });
                } else {
                    // Standard Floor
                    levelData.layers.floor.set(key, {
                        key: currentStyle.floor,
                        rotation: 0,
                        properties: { fromRoom: true, style: styleKey }
                    });
                    // Ceiling
                    levelData.layers.ceiling.set(key, {
                        key: currentStyle.ceiling,
                        rotation: 0,
                        properties: { heightMultiplier: 3 }
                    });
                }
            }
        });

        // FURNITURE (Not in water)
        if (!isPool) {
            tiles.forEach(t => {
                if (Math.random() > 0.9 && t.x !== seed.x && t.y !== seed.y) {
                    const furn = ['custom/crate.json', 'custom/computer_terminal.json', 'custom/table_round.json'];
                    const chosen = furn[Math.floor(Math.random() * furn.length)];
                    levelData.layers.furniture.set(`${t.x},${t.y}`, {
                        key: chosen,
                        rotation: 0
                    });
                }
            });
        }

        // SPAWN SQUADS (Action!)
        if (!isPool) {
            const squadSize = 2 + Math.floor(Math.random() * 3); // 2 to 4
            for (let i = 0; i < squadSize; i++) {
                const spawnTile = tiles[Math.floor(Math.random() * tiles.length)];
                const spawnKey = `${spawnTile.x},${spawnTile.y}`;

                let unitFaction = faction;
                let unitStyle = currentStyle;
                if (faction === 'contested') {
                    if (Math.random() > 0.5) { unitFaction = 'rebels'; unitStyle = styles['rebels']; }
                    else { unitFaction = 'imperials'; unitStyle = styles['imperials']; }
                }

                if (!levelData.layers.npcs.has(spawnKey)) {
                    // Threat Logic: Weighted Random
                    // Goal: At least some High Threat units level-wide
                    const roll = Math.random();
                    let targetThreat = 1;
                    // Distribution: 6% T4, 20% T3, 34% T2, 40% T1
                    if (roll > 0.94) targetThreat = 4;
                    else if (roll > 0.74) targetThreat = 3;
                    else if (roll > 0.40) targetThreat = 2;

                    // Randomize Skin using Asset Manager
                    let npcKey = unitStyle.npcIcon;
                    if (window.assetManager) {
                        const possibilities = window.assetManager.getNpcsByCriteria({
                            macroCategory: unitStyle.npcMacro
                        });
                        if (possibilities.length > 0) {
                            npcKey = possibilities[Math.floor(Math.random() * possibilities.length)];
                        }
                    }

                    levelData.layers.npcs.set(spawnKey, {
                        type: 'npc',
                        key: npcKey,
                        rotation: 0,
                        properties: {
                            baseType: unitStyle.npcBase,
                            faction: unitFaction,
                            threat: targetThreat,
                            macroCategory: unitStyle.npcMacro,
                            subgroup: 'any'
                        }
                    });
                }
            }
        }
    }

    placeAnchors(levelData, anchors) {
        // Place Spawn Point (Player Start)
        // Place Start Anchor
        levelData.layers.spawns.set(`${anchors.spawn.x},${anchors.spawn.y}`, {
            id: 'PLAYER_START',
            x: anchors.spawn.x, y: anchors.spawn.y,
            rotation: anchors.spawn.rotation,
            key: 'data/pngs/HUD/numbers/n1.png' // Placeholder visual for editor/game so it doesn't 404
        });

        // Place Entry Dock (Visual)
        // Check local file existence: 'door_blast_1.png' usually exists or 'door_1.png'.
        // Based on previous logs, 'door_blast_1.png' gave 404. Let's use standard wall.
        levelData.layers.dock.set(`${anchors.spawn.x},${anchors.spawn.y}`, {
            type: 'texture',
            key: 'data/pngs/wall/wall_1.png',
            rotation: anchors.spawn.rotation
        });

        // Place Exit Dock
        let targetId = 'HUB_LEVEL';
        const currentNode = this.nodes[levelData.nodeIndex || 0];
        if (currentNode) {
            const nextDepth = currentNode.depth + 1;
            targetId = `TO LEVEL ${nextDepth}A`;
        }

        levelData.layers.dock.set(`${anchors.exit.x},${anchors.exit.y}`, {
            type: 'texture',
            key: 'data/pngs/wall/wall_1.png',
            rotation: anchors.exit.rotation,
            properties: { target: targetId }
        });
    }

    applyHullMask(levelData, style) {
        // Generate mask pixels
        let mask = [];
        if (style === 'WEDGE') mask = this.createWedgeMask();
        else if (style === 'TUBE') mask = this.createTubeMask();
        else if (style === 'OVAL') mask = this.createOvalMask();
        else mask = this.createTubeMask(); // Fallback

        // Store valid hull coordinates for later checks
        // Do NOT fill floor yet. We want 'Negative Space' layout.
        levelData.validHull = new Set();
        mask.forEach(p => levelData.validHull.add(`${p.x},${p.y}`));
    }

    finalizeLevelData(levelData) {
        // Helper to resolve ceiling texture from style
        const getCeilingTex = (style) => {
            if (style && style.includes('rebel')) return 'data/pngs/ceiling/rebelstyle/normal/cwoodbox.png';
            if (style && style.includes('overgrown')) return 'data/pngs/ceiling/neutralstyle/overgrown/cgreen_overgrown.png';
            return 'data/pngs/ceiling/imperialstyle/normal/cwith_bar_across.png';
        };

        // Auto-generate ceilings over all FLOORS with matching style
        levelData.layers.floor.forEach((val, key) => {
            if (!levelData.layers.ceiling.has(key)) {
                const styleKey = val.properties?.style || 'default';
                levelData.layers.ceiling.set(key, {
                    key: getCeilingTex(styleKey),
                    properties: { heightMultiplier: 3 }
                });
            }
        });

        // Auto-generate ceilings over all WALLS to prevent gaps (Use Dominant Style)
        let dominantStyle = 'imperials';
        if (levelData.layers.floor.size > 0) {
            dominantStyle = [...levelData.layers.floor.values()][0].properties?.style || 'imperials';
        }
        const wallCeilingTex = getCeilingTex(dominantStyle);

        levelData.layers.wall.forEach((val, key) => {
            if (!levelData.layers.ceiling.has(key)) {
                levelData.layers.ceiling.set(key, {
                    key: wallCeilingTex,
                    properties: { heightMultiplier: 3 }
                });
            }
        });

        // Add Skybox based on dominant style
        let skyboxKey = 'data/pngs/skybox/imperialinteriors'; // Default
        if (levelData.layers.floor.size > 0) {
            const firstFloor = [...levelData.layers.floor.values()][0];
            const style = firstFloor.properties?.style;
            if (style === 'rebels') skyboxKey = 'data/pngs/skybox/rebelinteriors';
            if (style === 'overgrown') skyboxKey = 'data/pngs/skybox/forestexterior';
        }

        // Apply a specific valid skybox image or folder?
        // Game engine likely expects a folder or a specific key. 
        // Based on user folders: "E:\gonk\data\pngs\skybox\imperialinteriors".
        // I will set the key to the folder path, which LevelRenderer handles by looking for 'front', 'back', etc, or assumes a default.
        levelData.layers.skybox.set('0,0', {
            key: skyboxKey,
            x: 0, y: 0
        });

        const finalObj = {
            settings: {
                width: 64,
                height: 64,
                defaults: {
                    music: "data/sounds/music/alien/3Can Tina Big Band.mp3"
                }
            },
            layers: {}
        };
        for (const layerName in levelData.layers) {
            finalObj.layers[layerName] = [];
            levelData.layers[layerName].forEach((val, key) => {
                finalObj.layers[layerName].push([key, val]);
            });
        }
        return finalObj;
    }

    generateSpine(levelData, anchors) {
        // Fix: Round to integers to ensure grid alignment for A*
        const start = { x: Math.round(anchors.spawn.x), y: Math.round(anchors.spawn.y) };
        const end = { x: Math.round(anchors.exit.x), y: Math.round(anchors.exit.y) };
        console.log(`[StarChain] GenerateSpine: Start(${start.x},${start.y}) -> End(${end.x},${end.y})`);

        let path = this.findPath(start, end, levelData);
        if (!path) {
            console.warn("A* Failed! Forcing a straight line path.");
            // Fallback: Bresenham's Line Algorithm to force a path
            path = this.getLine(start, end);
        }
        let step = 0;
        path.forEach(p => {
            this.carveCircle(levelData, p.x, p.y, 3, 'SPINE');

            // Add lights periodically along the spine
            step++;
            if (step % 5 === 0) {
                levelData.layers.lights.set(`${p.x},${p.y}`, {
                    type: 'point_light',
                    x: p.x, y: p.y,
                    properties: { color: '#aabbff', intensity: 1.0, distance: 8 }
                });
            }
            // Add junk (crates) occasionally
            if (Math.random() > 0.9) {
                const decoKey = `${p.x},${p.y}`;
                // Ensure not blocking path (simple check, maybe better to put on side?)
                // For now, simple crate
                // levelData.layers.decor.set(decoKey, { key: 'data/pngs/decor/crates_stack.png' });
                // Actually, decor might block movement? Let's skip for spine safety for now.
            }
        });
        return path;
    }

    getLine(p0, p1) {
        let points = [];
        let dx = Math.abs(p1.x - p0.x);
        let dy = Math.abs(p1.y - p0.y);
        let sx = (p0.x < p1.x) ? 1 : -1;
        let sy = (p0.y < p1.y) ? 1 : -1;
        let err = dx - dy;

        let x = p0.x;
        let y = p0.y;

        while (true) {
            points.push({ x: x, y: y });
            if (x === p1.x && y === p1.y) break;
            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
        return points;
    }

    findPath(start, end, levelData) {
        const openSet = [start];
        const cameFrom = new Map();
        const gScore = new Map();
        gScore.set(`${start.x},${start.y}`, 0);
        const fScore = new Map();
        fScore.set(`${start.x},${start.y}`, this.heuristic(start, end));
        const validFloors = levelData.validHull; // Use validHull!

        while (openSet.length > 0) {
            openSet.sort((a, b) => (fScore.get(`${a.x},${a.y}`) || Infinity) - (fScore.get(`${b.x},${b.y}`) || Infinity));
            const current = openSet.shift();

            if (current.x === end.x && current.y === end.y) {
                return this.reconstructPath(cameFrom, current);
            }

            const neighbors = [
                { x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 }
            ];

            for (const neighbor of neighbors) {
                if (!validFloors.has(`${neighbor.x},${neighbor.y}`)) continue;

                const tentativeG = (gScore.get(`${current.x},${current.y}`) || Infinity) + 1;
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, end));

                    if (!openSet.find(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        return null;
    }
    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    reconstructPath(cameFrom, current) {
        const totalPath = [current];
        let key = `${current.x},${current.y}`;
        while (cameFrom.has(key)) {
            current = cameFrom.get(key);
            key = `${current.x},${current.y}`;
            totalPath.unshift(current);
        }
        return totalPath;
    }

    carveCircle(levelData, cx, cy, radius, type) {
        // Used to widen the path
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const x = Math.round(cx + dx);
                    const y = Math.round(cy + dy);
                    if (x >= 0 && x < 64 && y >= 0 && y < 64) {
                        const key = `${x},${y}`;
                        // Fix: Create the floor tile if it doesn't exist!
                        if (!levelData.layers.floor.has(key)) {
                            levelData.layers.floor.set(key, {
                                key: 'data/pngs/floor/floor_2.png',
                                rotation: 0,
                                properties: { areaType: type }
                            });
                        } else {
                            // Update existing
                            levelData.layers.floor.get(key).properties = { areaType: type };
                        }
                    }
                }
            }
        }
    }
    // Imperial Star Destroyer Style: Triangular
    createWedgeMask() {
        const mask = [];
        const center = 32;
        for (let y = 0; y < 64; y++) {
            // Width increases with Y (growing forward) or shrinks?
            // "Wedge" usually widens towards stern.
            // If spawning at Y=0 (Rear), it should be wide?
            // Let's make it typical: Wide at rear (0), narrow at bow (63).
            const halfWidth = Math.floor(30 * (1 - (y / 64))); // 30 down to 0
            const xMin = center - halfWidth;
            const xMax = center + halfWidth;

            for (let x = 0; x < 64; x++) {
                if (x >= xMin && x <= xMax) {
                    mask.push({ x, y });
                }
            }
        }
        return mask;
    }

    createTubeMask() {
        // Rebel Transport / Tantive IV: Long cylinder
        const mask = [];
        for (let y = 0; y < 64; y++) {
            for (let x = 20; x < 44; x++) { // 24 wide centered
                mask.push({ x, y });
            }
        }
        return mask;
    }

    createOvalMask() {
        // Mon Calamari / Vong: Organic
        const mask = [];
        const centerX = 32;
        const centerY = 32;
        const radiusX = 28;
        const radiusY = 30;

        for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
                const dx = (x - centerX) / radiusX;
                const dy = (y - centerY) / radiusY;
                if ((dx * dx + dy * dy) <= 1) {
                    mask.push({ x, y });
                }
            }
        }
        return mask;
    }
}
window.starChainGenerator = new StarChainGenerator();
