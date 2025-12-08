// BROWSERFIREFOXHIDE enemy_spawn_point.js
let spawnerIdCounter = 0;

class EnemySpawnPoint {
    constructor(position, rotation, properties = {}) {
        this.id = ++spawnerIdCounter;
        this.position = position; // THREE.Vector3
        this.rotation = rotation; // 0-3 for facing direction
        this.properties = {
            attitude: properties.attitude || 'enemy', // enemy/ally/primary/secondary/none
            faction: properties.faction || null, // Optional override
            subgroup: properties.subgroup || null, // Optional subgroup override
            max_individual_threat: properties.max_individual_threat || 3,
            threat_per_minute: properties.threat_per_minute || 4,
            min_time_between_spawns: properties.min_time_between_spawns || 30,
            max_time_between_spawns: properties.max_time_between_spawns || 100,
            total_max_threat: properties.total_max_threat || 8,
            health: properties.health || 100,
            max_health: properties.max_health || 100
        };

        this.activeThreat = 0; // Current active threat from spawned NPCs still alive
        this.spawnedNpcs = new Set(); // Track NPCs spawned by this point
        this.timeSinceLastSpawn = 0;
        this.nextSpawnTime = this._calculateNextSpawnTime();
        this.isDestroyed = false;
        this.isDoorOpen = false;
        this.doorAnimationFrame = 0;
        this.doorAnimationTimer = 0;
        this.doorAnimationSpeed = 0.05; // seconds per frame
        this.pendingSpawns = []; // NPCs waiting to emerge

        // Mesh components
        this.mesh = null;
        this.crackOverlay = null;
        this.factionOverlay = null;
        this.currentCrackLevel = 0;

        // Textures (will be loaded)
        this.doorTextures = [];
        this.crackTextures = [];
        this.closedTexture = null;

        // Cache the initial faction so it doesn't change when relationships shift
        this.cachedFaction = null;

        this._createMesh();
        this._loadTextures();

        // Log spawner creation
        console.log(`[Spawner ${this.id}] Created: ${this.properties.attitude.toUpperCase()} spawner at (${position.x.toFixed(1)}, ${position.z.toFixed(1)}), spawn time: ${this.properties.min_time_between_spawns}-${this.properties.max_time_between_spawns}s, max threat: ${this.properties.total_max_threat}`);
    }

    _createMesh() {
        // Create a curved mesh that is CONCAVE (inward, not outward)
        const group = new THREE.Group();

        // Wall segment size (standard grid unit) - matches standard wall height
        const wallWidth = GAME_GLOBAL_CONSTANTS.GRID.SIZE;
        const wallHeight = GAME_GLOBAL_CONSTANTS.GRID.SIZE; // Same height as wall segment
        const bulgeDepth = wallWidth * 0.2; // 20% depth inward (concave)

        // Create curved geometry using a subdivided plane with vertex displacement
        const segments = 16;
        const geometry = new THREE.PlaneGeometry(wallWidth, wallHeight, segments, segments);
        const positions = geometry.attributes.position;

        // Apply CONCAVE curve - parabolic curve going INWARD (negative Z)
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);

            // Normalized position from -1 to 1
            const normalizedX = (x / (wallWidth / 2));
            const normalizedY = (y / (wallHeight / 2));

            // INVERTED parabolic: maximum depth at center (0,0), zero at edges (±1)
            // Negative value makes it concave (inward)
            const bulge = -bulgeDepth * (1 - normalizedX * normalizedX) * (1 - normalizedY * normalizedY);
            positions.setZ(i, bulge);
        }

        geometry.computeVertexNormals();

        // Create material with placeholder texture
        // Use FrontSide only so it's only visible from the spawner side, not through walls
        const material = new THREE.MeshLambertMaterial({
            color: 0x888888,
            side: THREE.FrontSide // Only render from front, not visible from behind/through walls
        });

        this.mainMesh = new THREE.Mesh(geometry, material);
        group.add(this.mainMesh);

        // Create crack overlay mesh (same geometry, transparent)
        const crackGeometry = geometry.clone();
        const crackMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1,
            side: THREE.FrontSide, // Match main mesh
            depthWrite: false,
            visible: false // Hidden until damaged
        });

        this.crackOverlay = new THREE.Mesh(crackGeometry, crackMaterial);
        this.crackOverlay.position.z = 0.01; // Slightly in front (toward viewer)
        group.add(this.crackOverlay);

        // Faction overlay removed - faction indicator is handled by the door textures internally

        // Apply rotation based on facing direction
        const rotationAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; // Down, Left, Up, Right
        group.rotation.y = rotationAngles[this.rotation] || 0;

        // Position the group at grid position with bottom touching ground
        // The mesh is centered at origin, so move Y up by half height
        // position.y from level is at ground level (y=0 for floor)
        // Move to the OPPOSITE edge so the concave dent goes INTO the next grid square
        // The spawner sits on the "top" side of the square (in map view) with dent going up
        const edgeOffset = new THREE.Vector3(0, 0, -wallWidth / 2); // Move to OPPOSITE edge (negative Z)
        edgeOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationAngles[this.rotation] || 0);
        group.position.set(
            this.position.x + edgeOffset.x,
            this.position.y + wallHeight / 2,
            this.position.z + edgeOffset.z
        );

        this.mesh = group;
        this.mesh.userData.isEnemySpawnPoint = true;
        this.mesh.userData.spawnPoint = this;
    }

    async _loadTextures() {
        const loader = new THREE.TextureLoader();

        // Load door animation textures
        const doorFrameCount = 21;
        const doorPromises = [];

        // Load closed door texture
        doorPromises.push(
            loader.loadAsync('data/pngs/enemyspawns/door closed.png')
                .then(tex => {
                    tex.magFilter = THREE.NearestFilter;
                    tex.minFilter = THREE.NearestFilter;
                    this.closedTexture = tex;
                    this.mainMesh.material.map = tex;
                    this.mainMesh.material.color.set(0xffffff);
                    this.mainMesh.material.needsUpdate = true;
                })
                .catch(() => console.warn('Failed to load closed door texture'))
        );

        // Load door opening frames (1-21)
        for (let i = 1; i <= doorFrameCount; i++) {
            doorPromises.push(
                loader.loadAsync(`data/pngs/enemyspawns/door_1a_${i}.png`)
                    .then(tex => {
                        tex.magFilter = THREE.NearestFilter;
                        tex.minFilter = THREE.NearestFilter;
                        this.doorTextures[i - 1] = tex;
                    })
                    .catch(() => console.warn(`Failed to load door frame ${i}`))
            );
        }

        // Load crack textures (1-6)
        for (let i = 1; i <= 6; i++) {
            doorPromises.push(
                loader.loadAsync(`data/pngs/breaking/breaking_0${i}.png`)
                    .then(tex => {
                        tex.magFilter = THREE.NearestFilter;
                        tex.minFilter = THREE.NearestFilter;
                        this.crackTextures[i - 1] = tex;
                    })
                    .catch(() => console.warn(`Failed to load crack texture ${i}`))
            );
        }

        await Promise.all(doorPromises);
    }

    _calculateNextSpawnTime() {
        const min = this.properties.min_time_between_spawns;
        const max = this.properties.max_time_between_spawns;
        return min + Math.random() * (max - min);
    }

    update(deltaTime) {
        if (this.isDestroyed) return false;

        // Update active threat count by checking which spawned NPCs are still alive
        this._updateActiveThreat();

        // Update door animation
        if (this.isDoorOpen) {
            this._updateDoorAnimation(deltaTime);
        }

        // Check if we should spawn - based on ACTIVE threat, not total lifetime threat
        if (!this.isDoorOpen && this.activeThreat < this.properties.total_max_threat) {
            this.timeSinceLastSpawn += deltaTime;

            if (this.timeSinceLastSpawn >= this.nextSpawnTime) {
                this._initiateSpawn();
            }
        }

        // Update crack overlay based on damage
        this._updateCrackOverlay();

        return true;
    }

    _updateActiveThreat() {
        // Remove dead NPCs from tracking and recalculate active threat
        let newActiveThreat = 0;
        const deadNpcs = [];

        for (const npcRef of this.spawnedNpcs) {
            // Check if NPC still exists in game and is alive
            const npcStillAlive = window.game && window.game.entities.npcs.some(
                npc => npc === npcRef.npc && npc.isDead !== true
            );

            if (npcStillAlive) {
                newActiveThreat += npcRef.threat;
            } else {
                deadNpcs.push(npcRef);
            }
        }

        // Remove dead NPCs from tracking
        for (const deadNpc of deadNpcs) {
            this.spawnedNpcs.delete(deadNpc);
        }

        this.activeThreat = newActiveThreat;
    }

    _updateCrackOverlay() {
        const healthPercent = this.properties.health / this.properties.max_health;
        const damagePercent = 1 - healthPercent;

        // Calculate crack level (0-6, where 0 = no cracks)
        // At 1/7 damage = level 1, at 6/7 damage = level 6
        const newCrackLevel = Math.floor(damagePercent * 7);

        if (newCrackLevel !== this.currentCrackLevel && newCrackLevel > 0 && newCrackLevel <= 6) {
            this.currentCrackLevel = newCrackLevel;
            const crackTexture = this.crackTextures[newCrackLevel - 1];
            if (crackTexture) {
                this.crackOverlay.material.map = crackTexture;
                this.crackOverlay.material.visible = true;
                this.crackOverlay.material.needsUpdate = true;
            }
        } else if (newCrackLevel === 0) {
            this.crackOverlay.material.visible = false;
        }
    }

    takeDamage(amount) {
        if (this.isDestroyed) return;

        this.properties.health -= amount;

        if (this.properties.health <= 0) {
            this._destroy();
        }
    }

    _destroy() {
        this.isDestroyed = true;

        // Play explosion sound
        if (window.audioSystem) {
            audioSystem.playSound('spawnerexplosion');
        }

        // Create explosion effect
        this._createExplosionEffect();

        // Replace with broken texture immediately (1 frame after explosion starts)
        setTimeout(() => {
            this._replacewithBrokenTexture();
        }, 50); // 1 frame delay (50ms)

        // Dispose of main mesh resources but keep broken mesh visible permanently
        setTimeout(() => {
            // Dispose of original spawner resources (but NOT the broken mesh)
            this.mainMesh.geometry.dispose();
            this.mainMesh.material.dispose();
            this.crackOverlay.geometry.dispose();
            this.crackOverlay.material.dispose();
            if (this.factionOverlay) {
                this.factionOverlay.geometry.dispose();
                this.factionOverlay.material.dispose();
            }

            // Dispose original textures
            if (this.closedTexture) this.closedTexture.dispose();
            this.doorTextures.forEach(t => t && t.dispose());
            this.crackTextures.forEach(t => t && t.dispose());
            // NOTE: Keep brokenMesh and brokenTexture - they remain visible as debris
        }, 1500); // Clean up after explosion animation
    }

    _replacewithBrokenTexture() {
        // Hide the curved mesh and crack overlay
        this.mainMesh.visible = false;
        this.crackOverlay.visible = false;
        if (this.factionOverlay) this.factionOverlay.visible = false;

        // Load and display the broken spawner texture with same CONCAVE geometry
        const loader = new THREE.TextureLoader();
        loader.load('data/pngs/screen/brokenNPCspawner.png', (texture) => {
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;

            const wallWidth = GAME_GLOBAL_CONSTANTS.GRID.SIZE;
            const wallHeight = GAME_GLOBAL_CONSTANTS.GRID.SIZE;
            const bulgeDepth = wallWidth * 0.2;

            // Create concave geometry for broken texture (same as main mesh)
            const segments = 16;
            const geometry = new THREE.PlaneGeometry(wallWidth, wallHeight, segments, segments);
            const positions = geometry.attributes.position;

            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                const normalizedX = (x / (wallWidth / 2));
                const normalizedY = (y / (wallHeight / 2));
                const bulge = -bulgeDepth * (1 - normalizedX * normalizedX) * (1 - normalizedY * normalizedY);
                positions.setZ(i, bulge);
            }
            geometry.computeVertexNormals();

            const material = new THREE.MeshLambertMaterial({
                map: texture,
                side: THREE.FrontSide
            });

            this.brokenMesh = new THREE.Mesh(geometry, material);
            this.brokenTexture = texture;
            // Add to group (inherits group's position and rotation)
            this.mesh.add(this.brokenMesh);
        });
    }

    _createExplosionEffect() {
        const loader = new THREE.TextureLoader();
        const explosionFrames = [];
        const frameCount = 26;

        // Load explosion frames
        const loadPromises = [];
        for (let i = 1; i <= frameCount; i++) {
            loadPromises.push(
                loader.loadAsync(`data/pngs/fx/boom${i}.png`)
                    .then(tex => {
                        tex.magFilter = THREE.NearestFilter;
                        tex.minFilter = THREE.NearestFilter;
                        explosionFrames[i - 1] = tex;
                    })
                    .catch(() => console.warn(`Failed to load explosion frame ${i}`))
            );
        }

        Promise.all(loadPromises).then(() => {
            // Create billboard sprite for explosion - 20% larger than before
            const wallSize = GAME_GLOBAL_CONSTANTS.GRID.SIZE;
            const explosionSize = wallSize * 2.4; // 20% larger (was 2.0)
            const geometry = new THREE.PlaneGeometry(explosionSize, explosionSize);
            const material = new THREE.MeshBasicMaterial({
                map: explosionFrames[0],
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const explosionMesh = new THREE.Mesh(geometry, material);
            explosionMesh.position.copy(this.mesh.position);

            // Make it always face the camera
            if (window.game && window.game.camera) {
                const camera = window.game.camera;
                explosionMesh.lookAt(camera.position);
            }

            window.game.scene.add(explosionMesh);

            // Animate through frames
            let currentFrame = 0;
            const frameTime = 50; // ms per frame (roughly 20fps)
            const animationInterval = setInterval(() => {
                currentFrame++;
                if (currentFrame >= frameCount) {
                    clearInterval(animationInterval);
                    window.game.scene.remove(explosionMesh);
                    geometry.dispose();
                    material.dispose();
                    explosionFrames.forEach(tex => tex && tex.dispose());
                } else {
                    if (explosionFrames[currentFrame]) {
                        material.map = explosionFrames[currentFrame];
                        material.needsUpdate = true;
                    }
                    // Keep facing camera
                    if (window.game && window.game.camera) {
                        explosionMesh.lookAt(window.game.camera.position);
                    }
                }
            }, frameTime);
        });
    }

    _initiateSpawn() {
        // Calculate what to spawn based on ACTIVE threat budget (not lifetime total)
        const remainingThreat = this.properties.total_max_threat - this.activeThreat;
        if (remainingThreat <= 0) return;

        // Determine threat for this spawn wave (threat_per_minute is per minute, convert to per spawn)
        const threatBudget = Math.min(this.properties.threat_per_minute, remainingThreat);

        console.log(`[Spawner ${this.id}] ${this.properties.attitude.toUpperCase()} Spawner: Opened at ${(window.game?.clock?.getElapsedTime() || 0).toFixed(1)} seconds, threat budget: ${threatBudget}, active: ${this.activeThreat}/${this.properties.total_max_threat}`);

        // Select NPCs to spawn
        const npcsToSpawn = this._selectNpcsForThreat(threatBudget);
        if (npcsToSpawn.length === 0) {
            console.error(`[Spawner ${this.id}] SPAWN FAILED: No NPCs selected`);
            return;
        }

        console.log(`[Spawner ${this.id}] Selected ${npcsToSpawn.length} NPCs: ${npcsToSpawn.map(n => `${n.key}(${n.threat})`).join(', ')}`);

        this.pendingSpawns = npcsToSpawn;
        // Don't add to activeThreat yet - will be added when NPCs actually spawn

        // Reset spawn timer
        this.timeSinceLastSpawn = 0;
        this.nextSpawnTime = this._calculateNextSpawnTime();

        // Start door opening animation
        this._openDoor();
    }

    _selectNpcsForThreat(threatBudget) {
        const npcs = [];
        let remainingBudget = threatBudget;

        // Determine faction based on attitude
        let targetFaction = this._determineFaction();
        if (!targetFaction) {
            console.error(`[Spawner ${this.id}] ERROR: Could not determine faction for attitude '${this.properties.attitude}'. Check faction manager.`);
            return [];
        }

        // Build criteria for NPC selection
        const baseCriteria = {
            macroCategory: this._getMacroCategoryForFaction(targetFaction),
            subgroup: this.properties.subgroup || 'all'
        };

        console.log(`[Spawner ${this.id}] Selecting NPCs: attitude=${this.properties.attitude}, faction=${targetFaction}, category=${baseCriteria.macroCategory}, budget=${threatBudget}, maxIndividual=${this.properties.max_individual_threat}`);

        // Fill up the threat budget
        let attempts = 0;
        let failedThreatLevels = new Set();
        while (remainingBudget > 0 && attempts < 10) {
            attempts++;

            // Pick a random threat level that fits
            const maxThreat = Math.min(this.properties.max_individual_threat, remainingBudget);
            const threatLevel = Math.ceil(Math.random() * maxThreat);

            const criteria = { ...baseCriteria, threat: threatLevel };
            const possibleNpcs = window.assetManager.getNpcsByCriteria(criteria);

            if (possibleNpcs.length > 0) {
                const chosenKey = possibleNpcs[Math.floor(Math.random() * possibleNpcs.length)];
                npcs.push({
                    key: chosenKey,
                    threat: threatLevel,
                    faction: targetFaction,
                    forceAggro: this.properties.attitude === 'enemy'
                });
                remainingBudget -= threatLevel;
                console.log(`[Spawner ${this.id}] Selected: ${chosenKey} (threat ${threatLevel}), remaining budget: ${remainingBudget}`);
            } else {
                failedThreatLevels.add(threatLevel);
                console.warn(`[Spawner ${this.id}] No NPCs found for: category=${baseCriteria.macroCategory}, subgroup=${baseCriteria.subgroup}, threat=${threatLevel}`);
            }
        }

        if (npcs.length === 0) {
            console.error(`[Spawner ${this.id}] SPAWN FAILED: No NPCs available for faction '${targetFaction}' (category '${baseCriteria.macroCategory}') with threat levels 1-${this.properties.max_individual_threat}. Failed threat levels: ${Array.from(failedThreatLevels).join(', ')}`);
        }

        return npcs;
    }

    _determineFaction() {
        // If we already cached the faction, use it (prevents faction switching when relationships change)
        if (this.cachedFaction) {
            return this.cachedFaction;
        }

        // If faction is explicitly set, use it
        if (this.properties.faction) {
            console.log(`[Spawner ${this.id}] Using explicit faction: '${this.properties.faction}'`);
            this.cachedFaction = this.properties.faction;
            return this.cachedFaction;
        }

        const playerFaction = 'player_droid';
        const allFactions = window.game.factionManager.getAllFactionNames().filter(f => f !== playerFaction);
        let selectedFaction = null;

        switch (this.properties.attitude) {
            case 'enemy':
                // Find most hostile faction (highest relationship score)
                let mostHostile = null;
                let highestScore = -1;
                for (const faction of allFactions) {
                    const score = window.game.factionManager.getRelationship(playerFaction, faction);
                    if (score > highestScore) {
                        highestScore = score;
                        mostHostile = faction;
                    }
                }
                console.log(`[Spawner ${this.id}] ENEMY attitude: Selected most hostile faction '${mostHostile}' (score ${highestScore}) - CACHED`);
                selectedFaction = mostHostile;
                break;

            case 'ally':
                // Find most friendly faction (lowest relationship score)
                let mostFriendly = null;
                let lowestScore = 101;
                for (const faction of allFactions) {
                    const score = window.game.factionManager.getRelationship(playerFaction, faction);
                    if (score < lowestScore) {
                        lowestScore = score;
                        mostFriendly = faction;
                    }
                }
                console.log(`[Spawner ${this.id}] ALLY attitude: Selected most friendly faction '${mostFriendly}' (score ${lowestScore}) - CACHED`);
                selectedFaction = mostFriendly;
                break;

            case 'primary':
                // TODO: Use ship's primary faction when implemented
                selectedFaction = allFactions[Math.floor(Math.random() * allFactions.length)];
                console.log(`[Spawner ${this.id}] PRIMARY attitude: Selected random faction '${selectedFaction}' (TODO: implement ship primary) - CACHED`);
                break;

            case 'secondary':
                // TODO: Use ship's secondary faction when implemented
                selectedFaction = allFactions[Math.floor(Math.random() * allFactions.length)];
                console.log(`[Spawner ${this.id}] SECONDARY attitude: Selected random faction '${selectedFaction}' (TODO: implement ship secondary) - CACHED`);
                break;

            case 'none':
            default:
                // Random faction
                selectedFaction = allFactions[Math.floor(Math.random() * allFactions.length)];
                console.log(`[Spawner ${this.id}] NONE/DEFAULT attitude: Selected random faction '${selectedFaction}' - CACHED`);
                break;
        }

        // Cache the selected faction
        this.cachedFaction = selectedFaction;
        return this.cachedFaction;
    }

    _getMacroCategoryForFaction(factionKey) {
        // Map faction keys to macro categories
        const factionToCategory = {
            'rebels': 'Rebels',
            'imperials': 'Imperials',
            'clones': 'Clones',
            'mandalorians': 'Mandalorians',
            'sith': 'Sith',
            'aliens': 'Aliens',
            'droids': 'Droids',
            'takers': 'Takers'
        };
        return factionToCategory[factionKey] || 'Aliens';
    }

    _getFactionColor() {
        // Determine the faction based on spawner attitude and return its color
        const factionKey = this._determineFaction();
        if (factionKey && GAME_GLOBAL_CONSTANTS.FACTION_COLORS) {
            return GAME_GLOBAL_CONSTANTS.FACTION_COLORS[factionKey] || '#FFFFFF';
        }
        // Fallback colors based on attitude
        switch (this.properties.attitude) {
            case 'ally':
                return '#00FF00'; // Green for allies
            case 'enemy':
                return '#FF0000'; // Red for enemies
            case 'primary':
                return '#0088FF'; // Blue for primary faction
            case 'secondary':
                return '#FF8800'; // Orange for secondary
            case 'faction':
                return '#FFFF00'; // Yellow for specific faction
            default:
                return '#888888'; // Gray for unknown
        }
    }

    _openDoor() {
        this.isDoorOpen = true;
        this.doorAnimationFrame = 0;
        this.doorAnimationTimer = 0;

        // Play door open sound slightly before animation starts
        setTimeout(() => {
            if (window.audioSystem) {
                audioSystem.playSound('dooropen2');
            }
        }, 100); // 0.1 second before
    }

    _updateDoorAnimation(deltaTime) {
        this.doorAnimationTimer += deltaTime;

        if (this.doorAnimationTimer >= this.doorAnimationSpeed) {
            this.doorAnimationTimer = 0;

            if (this.doorAnimationFrame < this.doorTextures.length) {
                // Opening animation
                const texture = this.doorTextures[this.doorAnimationFrame];
                if (texture) {
                    this.mainMesh.material.map = texture;
                    this.mainMesh.material.needsUpdate = true;
                }
                this.doorAnimationFrame++;

                // Spawn NPCs when door is fully open (around frame 10-15)
                if (this.doorAnimationFrame === 12 && this.pendingSpawns.length > 0) {
                    this._spawnPendingNpcs();
                }
            } else if (this.doorAnimationFrame < this.doorTextures.length * 2) {
                // Closing animation (reverse)
                const reverseFrame = this.doorTextures.length * 2 - this.doorAnimationFrame - 1;
                const texture = this.doorTextures[reverseFrame];
                if (texture) {
                    this.mainMesh.material.map = texture;
                    this.mainMesh.material.needsUpdate = true;
                }
                this.doorAnimationFrame++;

                // Play close sound at start of closing
                if (this.doorAnimationFrame === this.doorTextures.length + 1) {
                    if (window.audioSystem) {
                        audioSystem.playSound('doorclose2');
                    }
                }
            } else {
                // Animation complete, return to closed
                if (this.closedTexture) {
                    this.mainMesh.material.map = this.closedTexture;
                    this.mainMesh.material.needsUpdate = true;
                }
                this.isDoorOpen = false;
                this.doorAnimationFrame = 0;
            }
        }
    }

    async _spawnPendingNpcs() {
        for (const npcData of this.pendingSpawns) {
            await this._spawnSingleNpc(npcData);
        }
        this.pendingSpawns = [];
    }

    async _spawnSingleNpc(npcData) {
        // Calculate spawn position - as close to the center-back of the spawner as possible
        // The spawner is positioned at the BACK edge of its grid square (negative Z offset)
        // So NPCs should spawn at the CENTER of that same grid square (no offset)
        // This makes them emerge from the door itself
        const spawnPosition = this.position.clone(); // Spawn at grid center (door is at back edge)

        // Check if NPC exists in asset manager
        const npcIconData = window.assetManager.npcIcons.get(npcData.key);
        if (!npcIconData) {
            console.error(`[Spawner ${this.id}] ERROR: NPC '${npcData.key}' not found in assetManager.npcIcons! Available keys with similar names:`);
            // Find similar keys for debugging
            const similarKeys = [];
            for (const [key] of window.assetManager.npcIcons) {
                if (key.toLowerCase().includes(npcData.key.toLowerCase().split('/').pop().substring(0, 5))) {
                    similarKeys.push(key);
                }
            }
            console.log(`[Spawner ${this.id}] Similar keys: ${similarKeys.slice(0, 10).join(', ')}`);
            return; // Can't spawn without config
        }

        // CRITICAL: Preload the texture if not already loaded
        const npcConfig = npcIconData.config;
        // Use the FULL key for texture lookup - textures are stored with full path keys
        if (!window.assetManager.getTexture(npcData.key)) {
            console.log(`[Spawner ${this.id}] Texture '${npcData.key}' not loaded, attempting to load...`);
            // Get the full path from skinPathMap
            const skinPath = window.assetManager.skinPathMap.get(npcData.key);
            if (skinPath) {
                try {
                    // Load texture with the FULL key as the second argument for consistent lookup
                    await window.assetManager.loadTexture(skinPath, npcData.key);
                    console.log(`[Spawner ${this.id}] Successfully loaded texture from: ${skinPath}`);

                    // Verify the texture was loaded with the correct key
                    if (!window.assetManager.getTexture(npcData.key)) {
                        console.error(`[Spawner ${this.id}] CRITICAL: Texture loaded but NOT stored under key '${npcData.key}'!`);
                        console.error(`[Spawner ${this.id}] Available texture keys (first 20): ${Array.from(window.assetManager.textures.keys()).slice(0, 20).join(', ')}`);
                        return;
                    }
                } catch (err) {
                    console.error(`[Spawner ${this.id}] Failed to load texture from ${skinPath}:`, err);
                    return;
                }
            } else {
                console.error(`[Spawner ${this.id}] No skin path found for '${npcData.key}' in skinPathMap`);
                // Debug: Show available keys in skinPathMap
                console.error(`[Spawner ${this.id}] Available skinPathMap keys (first 20): ${Array.from(window.assetManager.skinPathMap.keys()).slice(0, 20).join(', ')}`);
                return;
            }
        } else {
            console.log(`[Spawner ${this.id}] Texture '${npcData.key}' already loaded`);
        }

        // Create NPC item data similar to level loading
        const itemData = {
            type: 'npc',
            key: npcData.key,
            properties: {
                name: null, // Will be auto-generated
                subgroup: this.properties.subgroup,
                threat: npcData.threat // Pass the selected threat level to the NPC
            }
        };

        // Generate name for the NPC
        const npcForNaming = {
            name: null,
            subgroup: this.properties.subgroup || npcConfig.groupKey,
            faction: npcConfig.faction
        };
        itemData.properties.name = generateNpcName(npcForNaming, window.levelManager.nameData);

        console.log(`[Spawner ${this.id}] NPC name generated: '${itemData.properties.name}', config faction: '${npcConfig.faction}', modelType: '${npcConfig.minecraftModel}'`);

        // Create the NPC through the level renderer
        const gridX = Math.floor(spawnPosition.x / GAME_GLOBAL_CONSTANTS.GRID.SIZE);
        const gridZ = Math.floor(spawnPosition.z / GAME_GLOBAL_CONSTANTS.GRID.SIZE);
        const gridKey = `${gridX},${gridZ}`;

        // Use levelRenderer to create the NPC
        if (window.levelRenderer && window.levelRenderer.createNPCs) {
            const npcEntry = [[gridKey, itemData]];
            const npcCountBefore = window.game.entities.npcs.length;
            window.levelRenderer.createNPCs(npcEntry).then(() => {
                const npcCountAfter = window.game.entities.npcs.length;
                if (npcCountAfter <= npcCountBefore) {
                    console.error(`[Spawner ${this.id}] NPC CREATION FAILED: NPC count did not increase (${npcCountBefore} -> ${npcCountAfter})`);
                    return;
                }

                // After NPC is created, apply forced aggro if needed
                if (npcData.forceAggro && window.game && window.game.entities.npcs.length > 0) {
                    // Get the most recently added NPC (should be ours)
                    const newNpc = window.game.entities.npcs[window.game.entities.npcs.length - 1];
                    if (newNpc && newNpc.itemData.key === npcData.key) {
                        // Track this NPC for active threat calculation
                        this.spawnedNpcs.add({ npc: newNpc, threat: npcData.threat });
                        this.activeThreat += npcData.threat;
                        console.log(`[Spawner ${this.id}] NPC '${npcData.key}' successfully spawned and tracked. Active threat: ${this.activeThreat}/${this.properties.total_max_threat}`);

                        // Force aggro on player
                        newNpc.aggro({
                            position: window.physics.playerCollider.position,
                            isPlayer: true
                        });
                    } else {
                        console.warn(`[Spawner ${this.id}] NPC created but key mismatch. Expected '${npcData.key}', got '${newNpc?.itemData?.key}'`);
                    }
                } else if (window.game && window.game.entities.npcs.length > 0) {
                    // Track non-enemy NPCs too for active threat
                    const newNpc = window.game.entities.npcs[window.game.entities.npcs.length - 1];
                    if (newNpc && newNpc.itemData.key === npcData.key) {
                        this.spawnedNpcs.add({ npc: newNpc, threat: npcData.threat });
                        this.activeThreat += npcData.threat;
                        console.log(`[Spawner ${this.id}] NPC '${npcData.key}' (ally/neutral) successfully spawned and tracked. Active threat: ${this.activeThreat}/${this.properties.total_max_threat}`);
                    }
                }
            }).catch(err => {
                console.error(`[Spawner ${this.id}] createNPCs failed for '${npcData.key}':`, err);
            });
        } else {
            console.error(`[Spawner ${this.id}] ERROR: levelRenderer.createNPCs not available!`);
        }
    }

    dispose() {
        if (this.mesh && this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }

        this.mainMesh.geometry.dispose();
        this.mainMesh.material.dispose();
        this.crackOverlay.geometry.dispose();
        this.crackOverlay.material.dispose();
        if (this.factionOverlay) {
            this.factionOverlay.geometry.dispose();
            this.factionOverlay.material.dispose();
        }

        if (this.closedTexture) this.closedTexture.dispose();
        this.doorTextures.forEach(t => t && t.dispose());
        this.crackTextures.forEach(t => t && t.dispose());
    }
}

// Manager class to handle all spawn points in a level
class EnemySpawnPointManager {
    constructor() {
        this.spawnPoints = [];
    }

    addSpawnPoint(position, rotation, properties) {
        const spawnPoint = new EnemySpawnPoint(position, rotation, properties);
        this.spawnPoints.push(spawnPoint);
        return spawnPoint;
    }

    update(deltaTime) {
        // Update all spawn points, remove destroyed ones
        this.spawnPoints = this.spawnPoints.filter(sp => sp.update(deltaTime));
    }

    clear() {
        this.spawnPoints.forEach(sp => sp.dispose());
        this.spawnPoints = [];
    }

    getSpawnPointAtPosition(position, radius = 2) {
        for (const sp of this.spawnPoints) {
            if (sp.position.distanceTo(position) < radius) {
                return sp;
            }
        }
        return null;
    }
}

window.EnemySpawnPoint = EnemySpawnPoint;
window.EnemySpawnPointManager = EnemySpawnPointManager;
