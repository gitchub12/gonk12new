// BROWSERFIREFOXHIDE npc_behavior.js
// update: Corrected name generation logic in processName to accurately map faction/baseType to the correct name lists (e.g., 'imperialF' -> 'stormtrooperF', 'cloneF') as defined in npc_names.json, fixing console warnings.
// update: Added batched nameplate updates for performance optimization
let nameplateUpdateFrame = 0;

class NPC {
    constructor(characterMesh, itemData, npcConfig) {
        this.mesh = characterMesh;
        this.itemData = itemData;
        this.config = npcConfig; // The unified config from asset manager
        this.name = itemData.properties?.name || 'NPC';
        this.setWeaponData(); // NEW: Set weapon data right after config is available

        this.weaponData = null; // To be populated by weapon system
        this.isDead = false;
        this.spawnPoint = characterMesh.position.clone();
        this.nameplateRevealed = false; // Nameplates hidden until revealed
        this.hitByPamphlet = false; // Track pamphlet hits

        this.currentState = 'IDLING';
        this.stateTimer = 0;
        this.wanderTarget = null;
        this.reactionTimer = 0;
        this.fleeTimer = 0;
        this.fleeDecisionTimer = -1; // Timer for the aggro check after fleeing
        this.hasMadeFleeDecision = false; // NEW: Flag to ensure flee check happens only once.
        this.followUpdateTimer = 0;
        this.followTarget = null;
        this.hasSpoken = false;
        this.isConversing = false;

        // DroidSlayer system flags
        this.hostileGonk = itemData.properties?.hostileGonk || false;
        this.hostileAll = itemData.properties?.hostileAll || false;
        this.NonFactionNeutral = itemData.properties?.NonFactionNeutral || false;
        this.isDroidSlayer = false;
        this.droidSlayerVariant = null;
        this.droidSlayerDamageTaken = 0;
        this.droidSlayerHitCounter = 0;
        this.droidSlayerMissedHits = 0;

        // Quest/Vendor properties
        this.immovable = itemData.properties?.immovable || false;
        this.invincible = itemData.properties?.invincible || false;
        this.interactionScreen = itemData.properties?.interactionScreen || null;

        this.processName(itemData.properties?.name);

        this.hitboxes = this.mesh.hitboxes;
        this.weaponMesh = null;
        this.mesh.onMeleeHitFrame = () => this.onMeleeHitFrame();
        this.meleeHitFrameTriggered = false;
        this.allyRing = null;
        this.allySlotIndex = -1;

        // All stats are now read directly from the unified config
        this.maxHealth = itemData.properties?.health || this.config.health || 50;
        this.health = this.maxHealth;
        this.velocity = new THREE.Vector3();

        this.speed = this.config.speed || 0.025;
        this.perceptionRadius = this.config.perception_radius || 25;
        this.attackRange = this.config.attack_range || 1.2; // Base, will be modified by weapon
        this.attackCooldown = this.config.attack_cooldown || 2.0; // Base, will be modified by weapon
        this.attackTimer = 0;
        this.shootAnimTimer = 0;
        this.meleeAnimTimer = 0;

        this.hitCount = 0;
        this.conversionProgress = 0;
        this.isAlly = false;
        this.isAggro = false;

        this.target = null;
        this.lastTargetSearch = Math.random() * 0.5;

        this.faction = this.itemData.properties.faction || this.config.faction || 'aliens';
        this.originalFaction = this.faction;
        this.personalRelationships = {};
        this.traits = this.config; // The whole config is now the traits object

        this.weight = this.config.weight || 80;
        this.movementCollider = {
            isPlayer: false,
            radius: this.config.collision_radius || 0.5,
            lastPosition: this.mesh.group.position.clone(),
            position: this.mesh.group.position,
            velocity: this.velocity,
            weight: this.immovable ? 999999 : this.weight, // Immovable NPCs have infinite weight
            parent: this,
            immovable: this.immovable // Flag for physics system to skip
        };
        const modelHeight = (this.config.scale_y || 1.0) * 1.8;
        this.boundingSphere = new THREE.Sphere(this.mesh.group.position, modelHeight * 0.7);

        // --- NEW NPC LEVELING & CLASS SYSTEM ---
        this.applyProgressionSystem();

        // FIX: Apply y_offset to the visual mesh (children of group) to allow floating adjustments
        // This moves the model relative to the physics collider.
        if (this.config.y_offset) {
            this.mesh.group.children.forEach(child => {
                child.position.y += this.config.y_offset;
            });
        }

        this.createNameplate();
    }

    applyProgressionSystem() {
        // 1. Determine Level based on Threat
        const playerLevel = window.characterStats?.level || 1;
        const threat = this.itemData.properties?.threat || this.config.threat || 1;
        this.threat = parseInt(threat); // Store threat for nameplate coloring

        let levelOffset = 0;
        switch (parseInt(threat)) {
            case 1: levelOffset = -5; break; // Substantially lower
            case 2: levelOffset = -2; break; // Slightly lower
            case 3: levelOffset = 2; break;  // Slightly higher
            case 4: levelOffset = 5; break;  // Higher
            case 5: levelOffset = 8; break;  // Much higher (Boss-like)
            default: levelOffset = 0;
        }

        this.level = Math.max(1, playerLevel + levelOffset);
        // console.log(`[NPC] ${this.name} (Threat ${threat}) -> Level ${this.level} (Player Lvl ${playerLevel})`);

        // 2. Determine Class (Placeholder: Default to npc_str if not specified)
        // In the future, this comes from config.class or similar
        const classKey = this.config.npc_class || 'npc_str';
        const classDef = window.assetManager.npcClasses ? window.assetManager.npcClasses[classKey] : null;

        if (classDef) {
            // 3. Apply Class Stats
            // HP = Base + (PerLevel * Level)
            const calculatedMaxHP = classDef.base_hp + (classDef.hp_per_level * this.level);

            // Apply to instance
            this.maxHealth = calculatedMaxHP;
            this.health = this.maxHealth;

            // Apply Primary Stat (Just storing it for now, can be used for checks)
            this.stats = {
                STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10
            };
            this.stats[classDef.primary_stat] += this.level; // +1 per level to primary

            // 4. Apply Species Modifiers
            // Default to 'human' if not specified
            const speciesKey = (this.config.species || 'human').toLowerCase();
            const speciesDef = window.assetManager.speciesData ? window.assetManager.speciesData[speciesKey] : null;

            if (speciesDef) {
                // Apply stat modifiers
                if (speciesDef.modifiers) {
                    for (const [stat, mod] of Object.entries(speciesDef.modifiers)) {
                        if (this.stats[stat] !== undefined) {
                            this.stats[stat] += mod;
                        }
                    }
                }
                // Apply speed (if defined in species, override config)
                // Note: config.speed is usually small float (0.03), species.speed is int (10m).
                // We might need a conversion or just stick to config.speed for now to avoid breaking movement.
                // For now, we'll just log it.
                // console.log(`[NPC] ${this.name}: Species ${speciesKey} applied. Stats:`, this.stats);
            } else {
                // console.warn(`[NPC] Species '${speciesKey}' not found, using base stats.`);
            }

            // console.log(`[NPC] ${this.name} assigned ${classDef.name}. HP: ${this.maxHealth}, ${classDef.primary_stat}: ${this.stats[classDef.primary_stat]}`);
        } else {
            // Fallback if class system fails or data missing
            // console.warn(`[NPC] No class definition found for '${classKey}', using default stats.`);
        }
    }

    setWeaponData() {
        const weaponName = this.itemData.properties?.weapon || this.config.default_weapon;
        if (!weaponName || weaponName === "none") {
            this.weaponData = null;
            return;
        }

        const cleanWeaponName = weaponName.split('/').pop().replace('.png', '');
        const allWeaponData = window.assetManager.weaponData;

        if (!allWeaponData || !allWeaponData[cleanWeaponName]) {
            // console.warn(`Weapon data for "${cleanWeaponName}" not found.`);
            this.weaponData = null;
            return;
        }

        const specificWeaponStats = allWeaponData[cleanWeaponName];
        const category = specificWeaponStats.category;

        if (!category || !allWeaponData._defaults.categoryDefaults[category]) {
            console.warn(`Invalid or missing category for weapon "${cleanWeaponName}".`);
            this.weaponData = { ...specificWeaponStats }; // Use specific stats even if category is bad
            return;
        }

        const categoryDefaults = allWeaponData._defaults.categoryDefaults[category];

        // Merge defaults and specific stats. Specific stats take precedence.
        this.weaponData = { ...categoryDefaults, ...specificWeaponStats };

        // FIX: Ensure itemData has the weapon property for other systems (like attack()) to see
        if (!this.itemData.properties.weapon && this.config.default_weapon) {
            this.itemData.properties.weapon = this.config.default_weapon;
        }
    }

    // NEW: Getter for Friend status based on faction relationship
    get isFriend() {
        if (this.isAlly) return true;
        const relationship = window.game.factionManager.getRelationship(this.getEffectiveFaction(), 'player_droid');
        return relationship <= GAME_GLOBAL_CONSTANTS.FACTIONS.FRIENDLY_THRESHOLD;
    }

    createNameplate() {
        this.nameplate = new THREE.Group();
        // FIX: Always attach to ROOT (this.mesh.group) to ensure consistent height calculation.
        // Attaching to Head bone is unreliable as bone height varies wildly between models.
        const parentObject = this.mesh.group;
        parentObject.add(this.nameplate);

        this.nameplate.userData.parentObject = parentObject;

        // 1. Constant Size (Inverse Scaling)
        const scaleFactor = Math.max(this.config.scale || 1.0, this.config.scale_y || 1.0);

        const baseScale = 0.005;
        const inverseScale = baseScale / scaleFactor;
        this.nameplate.scale.set(inverseScale, inverseScale, inverseScale);

        // 2. Dynamic Positioning (Bounding Box Method)
        let localTopY = 2.0; // Default top of mesh in local units

        let foundGeometry = false;
        this.mesh.group.traverse((child) => {
            if (!foundGeometry && child.isMesh && child.geometry) {
                child.geometry.computeBoundingBox();
                const box = child.geometry.boundingBox;
                if (box) {
                    // We want the TOP of the mesh (Max Y). 
                    // Assuming Origin is at 0 (Feet) or Center.
                    // Ideally Max Y represents the head top in local space.
                    // FIX: Include child.position.y to account for manual offsets (e.g. Grogu lowered)
                    const absoluteTop = child.position.y + box.max.y;
                    // FIX: Allow lower/negative heights (Grogu might be near 0). Threshold lowered to -10.
                    if (absoluteTop > -10.0) {
                        localTopY = absoluteTop;
                        foundGeometry = true;
                    }
                }
            }
        });

        // Current Scale Y of the parent Group
        const currentScaleY = this.mesh.group.scale.y || this.config.scale_y || this.config.scale || 1.0;

        // User Requirements:
        // - "Too low at 1, far too low at scale 2"
        // - "Change needs to be increasing by TWICE as much"

        // FIX: Switch from Fixed World Gap to Fixed LOCAL Gap.
        // This causes the World Gap to scale WITH the model.
        // Scale 1.0 -> Gap 1.1m
        // Scale 2.0 -> Gap 2.2m (Double!)
        // Scale 0.5 -> Gap 0.55m

        // Store for update loop
        this.localTopY = localTopY;
        this.hasValidHeight = true;

        // Initial Position (Dynamic Tuning - Visual Height Based)
        if (!window.NAMEPLATE_CONFIG) window.NAMEPLATE_CONFIG = { baseOffset: 0.1, scaleFactor: 0.5 };

        const worldHeight = this.localTopY * currentScaleY;
        const gapFromSize = window.NAMEPLATE_CONFIG.scaleFactor * worldHeight;
        const baseGap = window.NAMEPLATE_CONFIG.baseOffset + gapFromSize;

        const configOffset = this.config.nameplateOffset || this.config.nameplate_y_offset || 0;
        const totalWorldGap = baseGap + configOffset;
        const hybridLocalGap = totalWorldGap / currentScaleY;

        // Debug
        if (window.game?.debugMode) {
            console.log(`[NP-Height] ${this.name}: Top=${localTopY.toFixed(2)}, WorldGap=${totalWorldGap.toFixed(2)} (ConfigOffset=${configOffset})`);
        }

        this.nameplate.position.y = localTopY + hybridLocalGap;

        this.nameplateName = new THREE.Group();
        this.nameSprite = this.createTextSprite(this.name, { fontsize: 48, fontface: 'Arial', textColor: { r: 255, g: 255, b: 255, a: 1.0 } });
        const nameWidth = this.nameSprite.material.map.image.width;
        const nameHeight = this.nameSprite.material.map.image.height;
        this.nameSprite.scale.set(nameWidth, nameHeight, 1.0);
        this.nameplateName.add(this.nameSprite);
        this.nameplateName.position.y = 20; // Move name up slightly
        this.nameplate.add(this.nameplateName);

        this.nameplateHealthBar = new THREE.Group();
        const barWidth = 25;
        const barHeight = 9;

        const healthBarBgMat = new THREE.SpriteMaterial({ color: 0x330000, opacity: 0.7, depthTest: true, depthWrite: false });
        const healthBarBg = new THREE.Sprite(healthBarBgMat);
        healthBarBg.scale.set(barWidth, barHeight, 1.0);
        this.nameplateHealthBar.add(healthBarBg);

        const healthBarMat = new THREE.SpriteMaterial({ color: 0xff0000, depthTest: true, depthWrite: true });
        this.healthBar = new THREE.Sprite(healthBarMat);
        this.healthBar.scale.set(barWidth, barHeight, 1.0);
        this.healthBar.center.set(0.5, 0.5);
        this.healthBar.position.z = 0.001; // Prevent z-fighting
        healthBarBg.add(this.healthBar);

        this.nameplateHealthBar.position.y = -5; // Centered relative to name
        this.nameplate.add(this.nameplateHealthBar);

        // NEW: Threat Chevron (▼)
        this.threatChevron = this.createTextSprite('▼', { fontsize: 64, fontface: 'Arial', textColor: { r: 255, g: 255, b: 255, a: 1.0 } });
        // Scale chevron appropriately
        const chevronWidth = this.threatChevron.material.map.image.width * 0.6;
        const chevronHeight = this.threatChevron.material.map.image.height * 0.6;
        this.threatChevron.scale.set(chevronWidth, chevronHeight, 1.0);
        this.threatChevron.position.y = -25; // Below health bar
        this.nameplate.add(this.threatChevron);

        // NEW: Conversion progress bar (moved further down)
        this.conversionBar = new THREE.Group();
        const conversionBarBgMat = new THREE.SpriteMaterial({ color: 0x000033, opacity: 0.7, depthTest: true, depthWrite: false });
        const conversionBarBg = new THREE.Sprite(conversionBarBgMat);
        conversionBarBg.scale.set(barWidth, barHeight, 1.0);
        this.conversionBar.add(conversionBarBg);
        this.conversionBar.position.y = -40; // Position below chevron
        this.nameplate.add(this.conversionBar);
        this.conversionBar.visible = false;

        this.createDebugStatBlock(); // NEW: Add debug stats
        this.updateNameplate();
        this.nameplate.visible = false; // Nameplate is hidden by default
        this.nameplateRevealed = false; // Explicitly set to false
    }

    processName(name) {
        if (!name) { this.name = 'NPC'; return; }

        let currentName = name.trim();
        const nameData = window.assetManager?.nameData;

        // Intercept placeholder names and correct them to match keys in npc_names.json
        const nameParts = currentName.split(' ');
        if (nameParts.length === 2 && nameParts[0].endsWith('F') && nameParts[1].endsWith('L')) {
            let colF = nameParts[0];
            let colL = nameParts[1];

            // FIX: Map faction/macroCategory to correct name list key
            const faction = (this.config.faction || '').toLowerCase();
            const baseType = (this.config.baseType || '').toLowerCase();

            // Re-map column keys to match list names in npc_names.json
            const nameKeyMap = {
                'imperialf': 'stormtrooperF',
                'imperiall': 'stormtrooperL',
                'clonef': 'cloneF',
                'clonel': 'cloneL',
                'mandaloriansf': 'mandoF',
                'mandaloriansl': 'mandoL',
                'sithf': 'darthF',
                'sithl': 'darthL',
                'takersf': 'takerF',
                'takersl': 'takerL',
                'wookieef': 'wookieeF', // ADDED: Specific mapping for Wookiees
                'wookieel': 'wookieeL', // ADDED: Specific mapping for Wookiees
                'aliensf': 'humanoidF', // Generic alien fallback
                'aliensl': 'humanoidL',
                'droidsf': 'droidF',
                'droidsl': 'droidL',
                'rebelsf': 'maleF', // Rebel default is male, but we check baseType below
                'rebelsl': 'maleL'
            };

            // Override for Rebels (which can be human_male/female)
            if (faction === 'rebels') {
                if (baseType === 'human_female') {
                    colF = 'femaleF';
                    colL = 'femaleL';
                } else if (baseType === 'human_male') {
                    colF = 'maleF';
                    colL = 'maleL';
                }
            }

            // Apply name key map for other macroCategories
            // Prioritize baseType for specific races like Wookiees
            if (baseType === 'wookiee') {
                colF = 'wookieeF';
                colL = 'wookieeL';
            } else {
                colF = nameKeyMap[colF.toLowerCase()] || colF;
                colL = nameKeyMap[colL.toLowerCase()] || colL;
            }


            const validF = (nameData[colF] || []).filter(Boolean);
            const validL = (nameData[colL] || []).filter(Boolean);

            if (validF.length > 0) {
                const partF = validF[Math.floor(Math.random() * validF.length)];
                let partL = validL.length > 0 ? validL[Math.floor(Math.random() * validL.length)] : '';

                // Determine if a space is needed based on the name category key
                if (colF === 'droidF' || colF === 'wookieeF' || colF === 'gamorreanF' || colF === 'stormtrooperF' || colF === 'takerF' || colF === 'mandoF' || colF === 'darthF') {
                    this.name = `${partF}${partL.trim()}`;
                } else {
                    this.name = `${partF} ${partL.trim()}`;
                }
                this.name = this.name.trim(); // Final trim for safety
            } else {
                this.name = currentName; // Fallback to the placeholder if columns are invalid
                console.log(`[NameProc] Failed to find names for '${colF}'. Using placeholder.`);
            }
        } else {
            this.name = currentName; // It's a manually set name, use it as is.
        }
    }

    updateNameplate() {
        const healthPercent = this.health / this.maxHealth;

        const barWidth = 25; // Use the same fixed base width
        this.healthBar.scale.x = barWidth * Math.max(0, healthPercent);
        this.healthBar.position.x = - (barWidth * (1 - healthPercent)) / 2;

        // FIX: Retry Height Calculation (Async Model Loading support)
        if (!this.hasValidHeight) {
            let foundGeometry = false;
            let maxY = 0;
            this.mesh.group.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    child.geometry.computeBoundingBox();
                    const box = child.geometry.boundingBox;
                    // FIX: Include child.position.y
                    const absoluteTop = child.position.y + (box ? box.max.y : 0);
                    if (box && absoluteTop > maxY) {
                        maxY = absoluteTop;
                        foundGeometry = true;
                    }
                }
            });

            // If we found a substantial height (allow negative for floated meshes), update!
            if (foundGeometry && maxY > -10.0) {
                this.localTopY = maxY;
                this.hasValidHeight = true;
                if (window.game?.debugMode) console.log(`[NP-Height-Late] ${this.name}: Geometry Loaded. Top Updated to ${maxY.toFixed(2)}`);
            }
        }

        // FIX: Enforce Height Position (Dynamic Tuning via Global Config)
        // Now uses VISUAL HEIGHT (localTopY) to determine gap, not just transform scale.
        // Ensures Rancors get larger gaps than Jawas even if Scale is 1.0.
        if (!window.NAMEPLATE_CONFIG) {
            window.NAMEPLATE_CONFIG = { baseOffset: 0.1, scaleFactor: 1.5 }; // USER SELECTED DEFAULTS
        }

        if (this.nameplate && this.localTopY !== undefined) {
            const currentScaleY = this.mesh.group.scale.y || this.config.scale_y || this.config.scale || 1.0;
            const worldHeight = this.localTopY * currentScaleY;

            // Gap Calculation:
            // ScaleFactor is now "Percentage of Height" (e.g. 0.5 = 50% of height above head)
            // BaseOffset is "Flat Meters" (e.g. 0.1m extra)
            const gapFromSize = window.NAMEPLATE_CONFIG.scaleFactor * worldHeight;
            const baseGap = window.NAMEPLATE_CONFIG.baseOffset + gapFromSize;

            // Allow Config Override (from Editor Tab / Config JSON)
            // NOTE: REMOVED this.config.y_offset to prevent double-counting mesh offsets.
            const configOffset = this.config.nameplateOffset || this.config.nameplate_y_offset || 0;

            const totalWorldGap = baseGap + configOffset;
            const localGap = totalWorldGap / currentScaleY;

            this.nameplate.position.y = this.localTopY + localGap;
        }

        // --- COLOR LOGIC ---
        let nameColor = new THREE.Color(1, 1, 1); // Default White (Neutral)
        let healthColor = new THREE.Color(1, 0, 0); // Default Red
        let chevronColor = new THREE.Color(1, 0, 0); // Default Red

        // 1. Health Bar Color (Red, unless Ally)
        if (this.isAlly) {
            healthColor.setHex(0x00ff64); // Green for Allies
        } else {
            healthColor.setHex(0xff0000); // Standard Red for everyone else
        }

        // 2. Threat Chevron Color
        const threat = this.threat || 1;
        switch (threat) {
            case 1: chevronColor.setHex(0x00ffff); break; // Cyan (Light Blue)
            case 2: chevronColor.setHex(0xffff00); break; // Yellow
            case 3: chevronColor.setHex(0xffa500); break; // Orange
            case 4: chevronColor.setHex(0xff4500); break; // Orange-Red
            case 5: chevronColor.setHex(0xff0000); break; // Bright Red
            default: chevronColor.setHex(0xff0000); // Fallback Red
        }

        if (this.healthBar.material.color.getHex() !== healthColor.getHex()) {
            this.healthBar.material.color.set(healthColor);
        }

        if (this.threatChevron && this.threatChevron.material.color.getHex() !== chevronColor.getHex()) {
            this.threatChevron.material.color.set(chevronColor);
        }

        // 2. Name Color (Based on Faction Relationship)
        if (this.isAlly || this.isFriend) {
            nameColor.setHex(0x33ccff); // Blue for Allies/Friends
        } else {
            const relationship = window.game.factionManager.getRelationship(this.getEffectiveFaction(), 'player_droid');

            // Debug logging for color issues (Throttle to once per 5 seconds per NPC)
            if (!this._lastColorDebug || Date.now() - this._lastColorDebug > 5000) {
                this._lastColorDebug = Date.now();
                // console.log(`[Nameplate] ${this.name} (${this.faction}): Rel=${relationship}, IsAlly=${this.isAlly}, IsFriend=${this.isFriend}`);
            }

            if (relationship > GAME_GLOBAL_CONSTANTS.FACTIONS.HOSTILE_THRESHOLD) {
                nameColor.setHex(0xff0000); // Red (Hostile)
            } else {
                nameColor.setHex(0xffffff); // White (Neutral)
            }
        }

        if (this.nameSprite) {
            this.nameSprite.material.color.set(nameColor);
        }
    }

    createDebugStatBlock() {
        if (this.debugStatGroup) this.nameplate.remove(this.debugStatGroup);

        this.debugStatGroup = new THREE.Group();
        this.debugStatGroup.position.y = 35; // Above name
        this.nameplate.add(this.debugStatGroup);

        this.updateDebugStats();
    }

    updateDebugStats() {
        if (!this.debugStatGroup) return;

        // Clear old sprite
        while (this.debugStatGroup.children.length > 0) {
            const child = this.debugStatGroup.children[0];
            if (child.material && child.material.map) child.material.map.dispose();
            if (child.material) child.material.dispose();
            this.debugStatGroup.remove(child);
        }

        // Safely access properties with fallbacks
        const threat = this.itemData?.properties?.threat || this.config?.threat || '?';
        const species = this.config?.species || 'Unknown';
        const className = this.config?.npc_class || 'No Class';

        let primaryStat = 'N/A';
        let primaryVal = 0;

        if (this.stats) {
            const entries = Object.entries(this.stats);
            if (entries.length > 0) {
                const topStat = entries.reduce((a, b) => a[1] > b[1] ? a : b);
                primaryStat = topStat[0];
                primaryVal = topStat[1];
            }
        }

        const level = this.level || 1;
        const hp = Math.floor(this.health || 0);
        const maxHp = this.maxHealth || 1;

        const text = `Lvl ${level} (T${threat})\n${species} / ${className}\n${primaryStat}: ${primaryVal}\nHP: ${hp}/${maxHp}`;

        const sprite = this.createTextSprite(text, {
            fontsize: 24,
            fontface: 'Arial',
            textColor: { r: 255, g: 255, b: 0, a: 1.0 },
            borderColor: { r: 0, g: 0, b: 0, a: 0.8 },
            borderThickness: 2
        });

        // Adjust scale to be readable but not huge
        const scale = 0.5;
        sprite.scale.multiplyScalar(scale);

        this.debugStatGroup.add(sprite);
    }

    createTextSprite(message, parameters) {
        const fontface = parameters.fontface || 'Arial';
        const fontsize = parameters.fontsize || 18;
        const textColor = parameters.textColor || { r: 255, g: 255, b: 255, a: 1.0 };

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = "Bold " + fontsize + "px " + fontface;

        canvas.width = context.measureText(message).width;
        canvas.height = fontsize * 1.4;

        context.font = "Bold " + fontsize + "px " + fontface;
        context.fillStyle = `rgba(255, 255, 255, 1.0)`;
        context.fillText(message, 0, fontsize);

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, color: `rgb(${textColor.r}, ${textColor.g}, ${textColor.b})`, depthTest: true, depthWrite: true, transparent: true, alphaTest: 0.1 });
        return new THREE.Sprite(spriteMaterial);
    }

    updateHitboxes() {
        for (const partName in this.hitboxes) {
            const partGroup = this.mesh.parts[partName];
            const hitboxOBB = this.hitboxes[partName];
            if (partGroup && hitboxOBB) {
                partGroup.updateWorldMatrix(true, false);
                const sourceMesh = partGroup.children.find(c => c.isMesh);
                if (!sourceMesh) continue;

                if (!sourceMesh.geometry.boundingBox) {
                    sourceMesh.geometry.computeBoundingBox();
                }
                hitboxOBB.fromBox3(sourceMesh.geometry.boundingBox);
                hitboxOBB.applyMatrix4(partGroup.matrixWorld);
            }
        }
        this.boundingSphere.center.copy(this.mesh.group.position);
    }

    takeDamage(amount, attacker = null) {
        if (this.isDead) return;

        // Invincible NPCs take no damage
        if (this.invincible) {
            return;
        }

        // Post-recruitment friendly fire grace period
        if (this.postRecruitInvincibility > 0 && attacker && (attacker.isPlayer || attacker.isAlly)) {
            return;
        }
        if (attacker && attacker.postRecruitInvincibility > 0 && this.isAlly) {
            return;
        }

        // --- ALLY FRIENDLY FIRE PREVENTION ---
        // If this NPC is an ally, check if the attacker is also friendly.
        if (this.isAlly && attacker) {
            const isAttackerFriendly = attacker.isPlayer || attacker.isAlly;
            if (isAttackerFriendly) {
                return; // Exit immediately, preventing damage and aggro.
            }
        }

        // DroidSlayer damage reduction
        if (this.isDroidSlayer && window.droidSlayerSystem) {
            amount = window.droidSlayerSystem.onDroidSlayerTakeDamage(this, amount);
        }

        // Check for cheat-triggered DroidSlayer promotion
        if (window.droidSlayerSystem && attacker && attacker.isPlayer) {
            window.droidSlayerSystem.onPlayerDamageNPC(this, amount);
        }

        const wasAtFullHealth = (this.health === this.maxHealth);
        this.health -= amount;
        this.nameplate.visible = true;
        if (window.audioSystem) audioSystem.playNpcHurtSound(this);
        this.updateNameplate();

        // If this NPC is an ally and was attacked, have other allies aggro the attacker
        if (this.isAlly && attacker) {
            for (const ally of window.game.state.allies) {
                if (ally.npc && !ally.npc.isDead && ally.npc !== this) {
                    ally.npc.aggro(attacker);
                }
            }
        }

        if (this.health <= 0) {
            this.die(attacker);
        }

        if (attacker) {
            const attackerFaction = attacker.isPlayer ? 'player_droid' : (attacker.getEffectiveFaction ? attacker.getEffectiveFaction() : attacker.faction);
            const isHostileAttacker = window.game.factionManager.getRelationship(this.getEffectiveFaction(), attackerFaction) > GAME_GLOBAL_CONSTANTS.FACTIONS.HOSTILE_THRESHOLD;

            // --- Fleeing Logic Overhaul ---
            // If already in combat, ignore flee logic.
            if (this.currentState === 'ATTACKING') {
                // Do nothing, continue attacking.
            }
            // If hit while fleeing, immediately turn to fight.
            else if (this.currentState === 'FLEEING') {
                this.aggro(attacker);
            }
            // If this is the first time making a flee decision...
            else if (!this.hasMadeFleeDecision && isHostileAttacker && !this.isAlly) {
                this.hasMadeFleeDecision = true; // This decision is now permanent.
                const aggroChance = this.config.aggro !== undefined ? this.config.aggro : 0.1;
                const roll = Math.random();
                if (roll < aggroChance) { // Success: Fight back
                    this.aggro(attacker);
                } else {
                    this.fleeFrom(attacker);
                }
            } else {
                this.aggro(attacker);
            }
        }

        if (this.health <= 0) {
            this.die(attacker);
        }
    }

    fleeFrom(attacker) {
        const attackerCollider = attacker.movementCollider || attacker.collider;
        if (this.currentState !== 'ATTACKING') this.target = null;
        this.currentState = 'FLEEING';
        const aggroValue = this.config.aggro !== undefined ? this.config.aggro : 0.1;
        const decisionDelay = 1.0 - aggroValue;
        this.fleeDecisionTimer = Math.max(0.1, decisionDelay); // Ensure at least a small delay
        this.fleeAttacker = attacker; // Remember who made us flee

        this.fleeTimer = 2.0 + Math.random() * 2.0;
        const fleeDirection = this.mesh.group.position.clone().sub(attackerCollider.position).normalize();
        this.wanderTarget = this.mesh.group.position.clone().add(fleeDirection.multiplyScalar(5));
    }

    die(killer = null) {
        handleNpcDeath(this, killer);
    }

    onPamphletHit() {
        // DroidSlayer, allies, and dead NPCs cannot be converted
        if (this.isAlly || this.isDead || this.isDroidSlayer) return;
        this.hitCount++;
        let conversionRate = 0.2;
        if (game.state.playerStats.pamphlet_effectiveness_bonus) {
            conversionRate *= (1 + game.state.playerStats.pamphlet_effectiveness_bonus);
        }
        this.conversionProgress = Math.min(this.hitCount * conversionRate, 1.0); // Increased conversion rate

        // Update and show the conversion bar
        this.conversionBar.visible = true;
        if (this.conversionBar.children.length > 1) {
            this.conversionBar.remove(this.conversionBar.children[1]);
        }
        const barWidth = 25;
        const barHeight = 9;
        const conversionBarMat = new THREE.SpriteMaterial({ color: 0x0099ff, depthTest: true, depthWrite: true });
        const conversionBarFill = new THREE.Sprite(conversionBarMat);
        conversionBarFill.scale.set(barWidth * this.conversionProgress, barHeight, 1.0);
        conversionBarFill.center.set(0.5, 0.5);
        conversionBarFill.position.x = - (barWidth * (1 - this.conversionProgress)) / 2;
        this.conversionBar.add(conversionBarFill);

        if (Math.random() < this.conversionProgress) {
            this.convert();
        }
    }

    convert() {
        // DroidSlayer and non-recruitable NPCs can never be recruited
        if (this.isDroidSlayer || this.itemData.properties.nonrecruitable) {
            console.log('This NPC cannot be recruited!');
            return;
        }

        this.isAlly = true;
        if (this.config.baseType === 'wookiee' && window.audioSystem) {
            // Play Wookiee conversion sound
            audioSystem.playSoundFromList('wookconvert', 0.8);
        }
        this.postRecruitInvincibility = 3.0; // 3 seconds of friendly fire immunity
        this.isAggro = false;
        const damageSustained = this.maxHealth - this.health;
        this.maxHealth *= 2;
        this.health = this.maxHealth - (damageSustained / 2); // Heal by half of the damage taken
        this.target = null;
        this.faction = 'player_droid';
        this.currentState = 'IDLING'; // Go to IDLING first to force re-evaluation
        this.personalRelationships = {};
        this.hasMadeFleeDecision = false; // Reset flee decision on conversion
        this.attackTimer = 0; // Immediately reset attack cooldown
        this.shootAnimTimer = 0;
        this.meleeAnimTimer = 0;
        this.nameplate.visible = true; this.conversionBar.visible = false;
        this.updateNameplate(); window.game.factionManager.registerAlly(this); game.addAlly(this);
    }

    attemptIntimidation(intimidator) {
        if (this.isAlly || this.isDead || this.isAggro) return; // Cannot intimidate allies, dead, or already hostile NPCs.

        const intimidateSkill = window.characterStats.skills.intimidate || 0;
        const roll = Math.floor(Math.random() * 20) + 1;
        const totalRoll = roll + intimidateSkill;

        const dc = 10 + (this.config.threat || 1); // Use threat level for DC, fallback to 1.

        console.log(`[Intimidate] ${intimidator.name} attempts to intimidate ${this.name}. Roll: ${roll} + ${intimidateSkill} skill = ${totalRoll} vs DC ${dc}`);

        if (totalRoll >= dc) {
            // Success
            console.log(`[Intimidate] Success! ${this.name} is fleeing.`);
            this.fleeFrom(intimidator);
        } else {
            // Failure
            console.log(`[Intimidate] Failure! ${this.name} becomes hostile.`);
            this.aggro(intimidator);
        }
    }

    onJoinParty() {
        if (!window.game.factionManager) return;
        game.state.allies.forEach(ally => {
            if (ally.npc !== this) {
                this.personalRelationships[ally.npc.faction] = 0;
            }
        });
        this.personalRelationships['player_droid'] = 0;
    }

    aggro(attacker = null) {
        if (this.isAlly && attacker && attacker.isPlayer) return; // Allies don't aggro player
        if (this.isDead || (this.isAggro && this.target === attacker)) return;

        // Absolute prohibition: Never aggro a friendly target.
        if (attacker) {
            const attackerFaction = attacker.isPlayer ? 'player_droid' : attacker.faction;
            if (attackerFaction === this.getEffectiveFaction()) return;
        }

        this.isAggro = true;
        this.currentState = 'ATTACKING';
        this.target = attacker;
        this.conversionProgress = 0;
    }

    getAttackRange() {
        // 1. Use weapon-specific range multiplier if available
        if (this.weaponData && this.weaponData.attack_range_mult) {
            const baseRange = this.config.attack_range || 10.0;
            return baseRange * this.weaponData.attack_range_mult;
        }

        // 2. Fallback to category-based range
        const weaponPath = this.itemData.properties.weapon;
        if (weaponPath && window.weaponIcons) {
            const weaponName = weaponPath.split('/').pop().replace('.png', '');
            const category = window.weaponIcons.getCategoryFromName(weaponName);
            if (GAME_GLOBAL_CONSTANTS.WEAPON_RANGES && GAME_GLOBAL_CONSTANTS.WEAPON_RANGES[category]) {
                return GAME_GLOBAL_CONSTANTS.WEAPON_RANGES[category];
            }
        }

        // 3. Absolute fallback for melee or un-categorized weapons
        if (!weaponPath || weaponPath === "") {
            return GAME_GLOBAL_CONSTANTS.WEAPON_RANGES.melee || 1.5;
        }
        // Fallback for ranged weapons not in the WEAPON_RANGES config.
        return this.config.attack_range || 10.0;
    }

    getEffectiveFaction() {
        return this.isAlly ? 'player_droid' : this.faction;
    }

    getVisionPoints(targetEntity) {
        const startPos = new THREE.Vector3();
        if (this.mesh.parts.head) {
            this.mesh.parts.head.getWorldPosition(startPos);
        } else {
            startPos.copy(this.mesh.group.position);
            const modelHeight = (this.config.scale_y || 1.0) * 1.6;
            startPos.y += modelHeight * 0.8;
        }

        let endPos;
        const targetCollider = targetEntity.movementCollider || targetEntity.collider;
        if (targetEntity.isPlayer) {
            endPos = targetCollider.position.clone();
        } else if (targetEntity.mesh && targetEntity.mesh.parts.head) {
            endPos = new THREE.Vector3();
            targetEntity.mesh.parts.head.getWorldPosition(endPos);
        } else {
            endPos = targetCollider.position.clone();
            const targetModelHeight = (targetEntity.config?.scale_y || 1.0) * 1.6;
            endPos.y += targetModelHeight * 0.5;
        }
        return { start: startPos, end: endPos };
    }


    update(deltaTime) {
        if (this.isDead) return;
        if (this.reactionTimer > 0) this.reactionTimer -= deltaTime;

        this.stateTimer += deltaTime;
        if (this.postRecruitInvincibility > 0) {
            this.postRecruitInvincibility -= deltaTime;
        }

        this.attackTimer -= deltaTime;
        if (this.shootAnimTimer > 0) this.shootAnimTimer -= deltaTime;
        if (this.meleeAnimTimer > 0) this.meleeAnimTimer -= deltaTime;
        if (this.currentState === 'FOLLOWING') {
            this.followUpdateTimer -= deltaTime;
        }

        // Immovable NPCs skip targeting and state execution (they just stand still)
        if (this.immovable) {
            // Lock position - reset to spawn point if moved
            this.mesh.group.position.copy(this.spawnPoint);
            this.velocity.set(0, 0, 0);

            // Still face the player if nearby for interaction
            const playerPos = window.physics?.playerCollider?.position;
            if (playerPos) {
                const dist = this.mesh.group.position.distanceTo(playerPos);
                if (dist < 5) { // Face player if within 5 units
                    const direction = new THREE.Vector3().subVectors(playerPos, this.mesh.group.position);
                    direction.y = 0;
                    direction.normalize();
                    if (direction.length() > 0.01) {
                        const targetRotation = Math.atan2(direction.x, direction.z);
                        this.mesh.group.rotation.y = targetRotation;
                    }
                }
            }
            return; // Skip all movement and AI logic
        }

        if (this.reactionTimer <= 0) {
            this.updateTarget();
        }
        this.updateTarget();
        this.executeState(deltaTime);

        // Batched nameplate updates REMOVED to ensure consistency.
        // Previous global counter caused Nondeterministic updates.
        this.updateNameplateVisibility();

        if (this.allyRing) {
            const groundHeight = physics.getGroundHeight(this.mesh.group.position.x, this.mesh.group.position.z);
            const heightOffset = GAME_GLOBAL_CONSTANTS.ALLY_RING.BASE_HEIGHT + (this.allySlotIndex * 0.001);
            this.allyRing.position.set(this.mesh.group.position.x, groundHeight + heightOffset, this.mesh.group.position.z);
        }
    }

    updateNameplateVisibility() {
        if (!this.nameplate) return;

        // Validated start of visibility logic
        // Previous debug block removed for safety/redundancy.
        const playerPos = window.physics.playerCollider.position;
        const npcPos = this.mesh.group.position;
        const debugMode = window.game?.debugMode;

        // --- 1. UPDATE REVEALED STATE ---
        // Once revealed, it stays revealed.
        if (!this.nameplateRevealed) {
            // Trigger 0: Special NPCs (Vendors, Guides, etc.) are ALWAYS revealed
            if (this.interactionScreen) {
                this.nameplateRevealed = true;
            }

            // Trigger 1: Proximity (Strict 2.0 meter + Perception Bonus)
            // Safety: Ensure playerPos is valid (not 0,0,0 spawn glitch)
            // Trigger 1: Proximity
            // Allow 0,0,0 (remove lengthSq check) but ensure playerPos exists
            if (playerPos) {
                // Base 5m + Wisdom Bonus + Perception Skill
                const wisBonus = window.characterStats?.attributes?.WIS ? (window.characterStats.attributes.WIS - 10) : 0;
                const percSkill = window.characterStats?.skills?.perception || 0;
                const moduleBonus = window.characterStats?.perceptionBonus || 0;

                const revealDistance = 2.0 + wisBonus + percSkill + moduleBonus; // REDUCED BASE TO 2.0 (1 Wall Height)

                if (playerPos.distanceTo(npcPos) < revealDistance) {
                    this.nameplateRevealed = true;
                }
            }

            // Trigger 2: Combat (Damaged or Aggro or Attacking ANYONE)
            // Precision check for health to avoid floating point issues
            if (this.health < (this.maxHealth - 0.1) || this.isAggro || this.currentState === 'ATTACKING') {
                this.nameplateRevealed = true;
            }

            // Trigger 3: Interaction (Conversing or Spoken)
            if (this.currentState === 'CONVERSING' || this.hasSpoken) {
                this.nameplateRevealed = true;
            }

            // Trigger 4: Pamphlet Hit
            if (this.hitByPamphlet) {
                this.nameplateRevealed = true;
            }
        }

        // --- 2. DETERMINE VISIBILITY (RENDERING) ---

        // Rule 1: Debug Mode overrides everything
        if (debugMode) {
            this.nameplate.visible = true;
            this.nameplate.lookAt(game.camera.position);

            // Ensure debug stats are shown
            if (!this.debugStatGroup) this.createDebugStatBlock();
            this.debugStatGroup.visible = true;
            this.updateNameplate(); // Keep health bar updated
            return;
        }

        // Rule 2: If not revealed, HIDE IT.
        if (!this.nameplateRevealed) {
            this.nameplate.visible = false;
            return;
        }

        // Rule 3: Revealed -> VISIBLE (No distance culling, per user request)
        this.nameplate.visible = true;
        this.nameplate.lookAt(game.camera.position);

        // Hide debug stats if debug mode is off
        if (this.debugStatGroup) {
            this.debugStatGroup.visible = false;
        }

        // Standard opacity update (always full opacity now that culling is gone)
        if (this.nameplateName && this.nameplateName.children) {
            this.nameplateName.children.forEach(child => {
                if (child.material) child.material.opacity = 1.0;
            });
        }

        this.updateNameplate();
    }


    executeState(deltaTime) {
        this.velocity.set(0, 0, 0);
        let isMoving = false;

        switch (this.currentState) {
            case 'ATTACKING':
            case 'DEFENDING_ALLY':
                if (this.target && !this.target.isDead) {
                    const targetCollider = this.target.movementCollider || this.target.collider;
                    if (!targetCollider || typeof targetCollider.position === 'undefined') {
                        console.warn('NPC target has no valid collider or position!', this.name, this.target);
                        this.currentState = 'IDLING';
                        break;
                    }
                    // FIX: Separate the look-at target from the line-of-sight target.
                    // The body should only rotate on the Y-axis to prevent tilting.
                    const lookAtTarget = targetCollider.position.clone();
                    lookAtTarget.y = this.mesh.group.position.y;
                    this.mesh.group.lookAt(lookAtTarget);

                    const visionPoints = this.getVisionPoints(this.target);
                    if (!visionPoints) { // Target might have become invalid between checks
                        this.currentState = 'IDLING';
                        break;
                    }
                    const { start, end } = visionPoints;
                    if (physics.hasLineOfSight(start, end)) {
                        const distance = this.mesh.group.position.distanceTo(targetCollider.position);
                        const currentAttackRange = this.getAttackRange();
                        if (distance > currentAttackRange) {
                            const direction = targetCollider.position.clone().sub(this.mesh.group.position).normalize();
                            this.velocity.x = direction.x * this.speed;
                            this.velocity.z = direction.z * this.speed;
                            isMoving = true;
                        } else if (this.attackTimer <= 0) {
                            this.attack();
                        }
                    }
                } else {
                    this.currentState = 'IDLING';
                }
                break;

            case 'FLEEING':
                this.fleeTimer -= deltaTime;
                if (this.fleeTimer <= 0 || !this.wanderTarget) {
                    this.currentState = 'IDLING';
                } else {
                    const distanceToTarget = this.mesh.group.position.distanceTo(this.wanderTarget);
                    if (distanceToTarget > 0.5) {
                        const direction = this.wanderTarget.clone().sub(this.mesh.group.position).normalize();
                        this.velocity.x = direction.x * this.speed;
                        this.velocity.z = direction.z * this.speed;
                        this.mesh.group.lookAt(this.wanderTarget.x, this.mesh.group.position.y, this.wanderTarget.z);
                        isMoving = true;
                    } else {
                        this.wanderTarget = null;
                    }
                }
                break;

            case 'INVESTIGATING':
                // Placeholder for future logic
                // Possible flags could be set here for random events like conversations,
                // turning hostile, etc. after the investigation movement is complete.
                this.currentState = 'IDLING';
                break;

            case 'FOLLOWING':
                if (this.followUpdateTimer <= 0) {
                    this.followUpdateTimer = 0.5 + Math.random() * 0.5; // Reset timer

                    const playerPos = physics.playerCollider.position;
                    const playerYaw = window.inputHandler.yaw;
                    const offsets = [
                        new THREE.Vector3(-2.0, 0, -1.5),  // ~9:30 o'clock
                        new THREE.Vector3(2.0, 0, -1.5),   // ~2:30 o'clock
                        new THREE.Vector3(-2.5, 0, -1.0),  // ~9:45 o'clock
                        new THREE.Vector3(2.5, 0, -1.0),   // ~2:45 o'clock
                        new THREE.Vector3(0, 0, 3.0)       // 6 o'clock (for 5th ally)
                    ];
                    const offset = this.allySlotIndex < offsets.length ? offsets[this.allySlotIndex].clone() : new THREE.Vector3(0, 0, 2);
                    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);

                    this.followTarget = playerPos.clone().add(offset);
                }

                if (this.followTarget) {
                    const distanceToSlot = this.mesh.group.position.distanceTo(this.followTarget);
                    if (distanceToSlot > 1.2) {
                        const direction = this.followTarget.clone().sub(this.mesh.group.position).normalize();
                        this.velocity.x = direction.x * this.speed;
                        this.velocity.z = direction.z * this.speed;
                        this.mesh.group.lookAt(this.followTarget.x, this.mesh.group.position.y, this.followTarget.z);
                        isMoving = true;
                    } else {
                        // Ally is at its follow position, now perform idle actions
                        if (this.stateTimer > 3.0 + Math.random() * 4.0) { // Every 3-7 seconds
                            this.stateTimer = 0;
                            if (Math.random() < 0.4) { // 40% chance to wander
                                const wanderAngle = Math.random() * Math.PI * 2;
                                const wanderDist = Math.random() * 1.0 + 0.5; // Wander 0.5 to 1.5 meters
                                this.wanderTarget = this.followTarget.clone().add(new THREE.Vector3(Math.cos(wanderAngle) * wanderDist, 0, Math.sin(wanderAngle) * wanderDist));
                            } else if (Math.random() < 0.7) { // 30% chance to look at player
                                this.wanderTarget = null; // Clear wander target
                                const playerPos = physics.playerCollider.position.clone();
                                playerPos.y = this.mesh.group.position.y; // Only look horizontally
                                this.mesh.group.lookAt(playerPos);
                            } else { // 30% chance to look around randomly
                                this.wanderTarget = null; // Clear wander target
                                const lookAtPoint = this.followTarget.clone().add(new THREE.Vector3((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5));
                                lookAtPoint.y = this.mesh.group.position.y; // Only look horizontally
                                this.mesh.group.lookAt(lookAtPoint);
                            }
                        }

                        if (this.wanderTarget) {
                            if (this.mesh.group.position.distanceTo(this.wanderTarget) > 0.2) {
                                const direction = this.wanderTarget.clone().sub(this.mesh.group.position).normalize();
                                this.velocity.x = direction.x * this.speed * 0.3; // Wander slowly
                                this.velocity.z = direction.z * this.speed * 0.3;
                                this.mesh.group.lookAt(this.wanderTarget.x, this.mesh.group.position.y, this.wanderTarget.z);
                                isMoving = true;
                            } else {
                                this.wanderTarget = null;
                            }
                        }
                    }
                }
                break;

            case 'IDLING':
                if (this.isConversing) {
                    this.stateTimer = 0; // Reset timer to prevent other idle actions
                    // Transition to CONVERSING state
                    this.currentState = 'CONVERSING';
                    break;
                }
                // ... rest of IDLING logic ...
                break;

            case 'CONVERSING':
                if (!this.isConversing || !this.target) { // If conversation ends or target is lost
                    this.currentState = 'IDLING';
                    break;
                }

                const otherNpc = this.target; // Assuming 'target' is the other conversing NPC
                const myPosition = this.mesh.group.position;

                const otherPosition = otherNpc.isPlayer
                    ? window.physics.playerCollider.position
                    : (otherNpc.mesh ? otherNpc.mesh.group.position : null);

                if (!otherPosition) {
                    this.currentState = 'IDLING';
                    break;
                }

                // Make them face each other
                const lookAtTarget = otherPosition.clone();
                lookAtTarget.y = myPosition.y;
                this.mesh.group.lookAt(lookAtTarget);

                // Calculate desired distance (collision radiuses almost touching)
                const myRadius = this.config.collision_radius || 0.5;
                const otherRadius = otherNpc.isPlayer
                    ? (window.physics.playerCollider.radius || 0.5)
                    : (otherNpc.config?.collision_radius || 0.5);
                const desiredDistance = (myRadius + otherRadius) * 1.2; // A small buffer

                const currentDistance = myPosition.distanceTo(otherPosition);

                if (currentDistance > desiredDistance) {
                    // Move towards each other
                    const direction = otherPosition.clone().sub(myPosition).normalize();
                    this.velocity.x = direction.x * this.speed * 0.5; // Move slower during conversation
                    this.velocity.z = direction.z * this.speed * 0.5;
                    isMoving = true;
                } else {
                    // Stop moving once close enough
                    this.velocity.set(0, 0, 0);
                }
                break;
        }
    }

    updateTarget() {
        this.lastTargetSearch -= game.deltaTime;
        if (this.lastTargetSearch > 0) return;
        this.lastTargetSearch = 0.5 + Math.random() * 0.5;

        // If already in combat or fleeing, don't proactively search for new targets
        if (this.currentState === 'ATTACKING' || this.currentState === 'FLEEING') {
            // But check if current target is dead or out of sight
            if (this.target && (!physics.hasLineOfSight(this.getVisionPoints(this.target).start, this.getVisionPoints(this.target).end) || this.target.isDead)) {
                this.target = null;
                this.isAggro = false;
                this.currentState = this.isAlly ? 'FOLLOWING' : 'IDLING';
            }
            // NEW: Check if current target has become friendly
            if (this.target && this.isAlly) { // Only allies should terminate friendly fire
                const targetFaction = this.target.isPlayer ? 'player_droid' : (this.target.getEffectiveFaction ? this.target.getEffectiveFaction() : this.target.faction);
                const myFaction = this.getEffectiveFaction();

                let relationship = this.personalRelationships[targetFaction];
                if (relationship === undefined) {
                    relationship = window.game.factionManager.getRelationship(myFaction, targetFaction);
                }

                if (relationship <= GAME_GLOBAL_CONSTANTS.FACTIONS.FRIENDLY_THRESHOLD) { // If target is now friendly
                    this.target = null;
                    this.isAggro = false;
                    this.currentState = 'FOLLOWING'; // Allies return to following
                }
            }
            return;
        }

        // Priority 5: Attack Hostiles & Priority 7: Defend Allies
        const potentialTargets = [physics.playerEntity, ...game.entities.npcs.filter(n => n !== this && !n.isDead)];
        let bestTarget = this.findBestTarget(potentialTargets);
        if (bestTarget) {
            this.aggro(bestTarget);
            return;
        }

        if (this.isAlly) {
            this.currentState = 'FOLLOWING';
            return;
        }

        // Priority 11: Investigate Player
        const playerDist = this.mesh.group.position.distanceTo(physics.playerCollider.position);
        if (playerDist < 3.0) {
            this.currentState = 'INVESTIGATING';
            this.stateTimer = 0;
            return;
        }

        // Priority 13: Idle (Default)
        this.currentState = 'IDLING';
    }

    findBestTarget(potentialTargets, perspectiveFactionKey = null) {
        let bestTarget = null;
        let minDistance = this.perceptionRadius;
        const checkingFaction = perspectiveFactionKey || this.getEffectiveFaction();

        for (const target of potentialTargets) {
            const targetEntity = target.isPlayer ? target : target;
            if (targetEntity === this) continue;
            if (this.isAlly && targetEntity.isPlayer) continue;

            const targetFaction = targetEntity.isPlayer ? 'player_droid' : (targetEntity.getEffectiveFaction ? targetEntity.getEffectiveFaction() : targetEntity.faction);
            const targetCollider = targetEntity.movementCollider || targetEntity.collider;
            if (!targetCollider) continue;

            const distance = this.mesh.group.position.distanceTo(targetCollider.position);
            if (distance < minDistance) {
                // Absolute rule: Never target same faction, even if aggro. Allies should not fight allies.
                if (targetFaction === checkingFaction) continue;

                let relationship = this.personalRelationships[targetFaction]; // Personal relationships override factional ones.
                if (relationship === undefined) {
                    relationship = window.game.factionManager.getRelationship(checkingFaction, targetFaction);
                }

                if (relationship > GAME_GLOBAL_CONSTANTS.FACTIONS.HOSTILE_THRESHOLD) {
                    const { start, end } = this.getVisionPoints(targetEntity);
                    if (physics.hasLineOfSight(start, end)) {
                        minDistance = distance;
                        bestTarget = targetEntity;
                    }
                }
            }
        }
        return bestTarget;
    }

    // --- NEW: Conversation Highlight ---
    startHighlight(color) {
        if (!this.mesh || !this.mesh.group) return;
        const highlightColor = new THREE.Color(color);

        this.mesh.group.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (mat.uniforms && mat.uniforms.rimColor) {
                        mat.uniforms.rimColor.value = highlightColor;
                        mat.uniforms.rimIntensity.value = 1.0;
                    }
                });
            }
        });
    }

    stopHighlight() {
        if (!this.mesh || !this.mesh.group) return;
        this.startHighlight(0x000000); // Set color to black to effectively hide it
    }
    // --- END NEW ---

    updateAnimation(deltaTime) {
        if (this.isDead && this.mesh.animState !== 'death') {
            return;
        }

        if (this.mesh.animState === 'death') {
            window.updateGonkAnimation(this.mesh, { deltaTime });
            return;
        }

        const collider = this.movementCollider;
        const distanceMoved = collider.position.distanceTo(collider.lastPosition);
        collider.lastPosition.copy(collider.position);

        let animToSet = 'idle';
        // Use a small threshold to account for floating point inaccuracies
        if (distanceMoved > 0.001) {
            animToSet = 'walk';
        } else if (this.target && !this.target.isDead && (this.currentState === 'ATTACKING' || this.currentState === 'DEFENDING_ALLY')) {
            animToSet = 'aim';
        }

        // Only set animation if not in a special attack animation
        if (this.shootAnimTimer <= 0 && this.meleeAnimTimer <= 0) {
            window.setGonkAnimation(this.mesh, animToSet);
        }
        window.updateGonkAnimation(this.mesh, { deltaTime });
    }

    attack() {
        if (!this.target || (this.isAlly && this.target === physics.playerEntity)) return;

        // 1. Determine Base Cooldown: Prioritize Weapon Data > NPC Config > Default 2.0s
        let baseCooldown = 2.0;
        if (this.weaponData && this.weaponData.attack_cooldown) {
            baseCooldown = this.weaponData.attack_cooldown;
        } else {
            baseCooldown = this.attackCooldown;
        }

        // 2. Apply DEX Modifier (Higher DEX = Lower Cooldown)
        // Standard DEX is 10. DEX 20 = half cooldown.
        const dex = (this.stats && this.stats.DEX) ? this.stats.DEX : 10;
        const dexMultiplier = 10 / Math.max(1, dex); // Prevent division by zero

        // 3. Calculate Final Cooldown
        let finalCooldown = baseCooldown * dexMultiplier;

        // 4. Cap fire rate (e.g., absolute minimum 0.1s for sanity)
        finalCooldown = Math.max(0.1, finalCooldown);

        this.attackTimer = finalCooldown;

        // Prevent NPCs with no weapon from attacking
        // FIX: Check config.default_weapon as fallback
        const weaponPath = this.itemData.properties.weapon || this.config.default_weapon;
        if (!weaponPath) return;

        const weaponName = weaponPath.split('/').pop().replace('.png', '');
        const category = window.weaponIcons.getCategoryFromName(weaponName);

        if (category === 'melee' || category === 'saber' || !this.weaponMesh) {
            this.performMeleeAttack();
        } else {
            this.performRangedAttack(weaponName);
        }
    }

    performMeleeAttack() {
        this.meleeHitFrameTriggered = false;
        window.setGonkAnimation(this.mesh, 'melee');
        this.meleeAnimTimer = 0.25;
    }

    onMeleeHitFrame() {
        if (this.meleeHitFrameTriggered || this.isDead || !this.target) return;
        this.meleeHitFrameTriggered = true;

        const targetCollider = this.target.movementCollider || this.target.collider;
        if (!targetCollider) return;

        // FIX: Add a crucial range check for melee attacks.
        const attackRange = this.getAttackRange();
        const distanceToTarget = this.mesh.group.position.distanceTo(targetCollider.position);
        const effectiveRange = attackRange + (targetCollider.radius || 0);

        if (distanceToTarget <= effectiveRange) {
            // Use weapon damage if available, otherwise fallback to NPC's base melee damage
            let damage = this.weaponData?.damage || this.config.melee_damage || 5;
            damage += (this.itemData.properties.damage_modifier || 0);
            if (this.target.isPlayer) {
                game.takePlayerDamage(damage, this);
                if (window.audioSystem) audioSystem.playPlayerHurtSound('melee');
            } else if (this.target.takeDamage) {
                this.target.takeDamage(damage, this);
            }
        }
    }

    performRangedAttack(weaponName) {
        if (!this.weaponMesh) return;

        window.setGonkAnimation(this.mesh, 'shoot');
        this.shootAnimTimer = 0.2;

        const startPosition = new THREE.Vector3();
        this.weaponMesh.getWorldPosition(startPosition);

        if (window.audioSystem) audioSystem.playWeaponFireSound(weaponName, startPosition);

        const targetCollider = this.target.movementCollider || this.target.collider;
        if (!targetCollider) return;

        const { end } = this.getVisionPoints(this.target);
        const direction = new THREE.Vector3().subVectors(end, startPosition).normalize();

        // --- Accuracy Calculation (incorporates weapon stats) ---
        const baseAccuracy = this.config.accuracy || 70;
        const accuracyMultiplier = this.weaponData?.accuracy_mult || 1.0;
        const accuracy = baseAccuracy * accuracyMultiplier;
        const inaccuracy = (100 - accuracy) / 500; // Scale down for a reasonable spread angle
        const randomOffset = new THREE.Vector3(
            (Math.random() - 0.5) * inaccuracy,
            (Math.random() - 0.5) * inaccuracy,
            (Math.random() - 0.5) * inaccuracy
        );
        direction.add(randomOffset).normalize();


        startPosition.add(direction.clone().multiplyScalar(0.2)); // Offset to avoid self-collision

        let damage = this.weaponData?.damage || 5;
        damage += (this.itemData.properties.damage_modifier || 0);
        const boltSpeedMultiplier = this.weaponData?.bolt_speed_mult || 1.0;

        // DroidSlayer variant modifiers
        let ownerType = this.isAlly ? 'ally' : 'enemy';
        let boltClass = BlasterBolt;
        if (this.isDroidSlayer) {
            ownerType = 'droidslayer';
            if (window.DroidSlayerBolt) {
                boltClass = DroidSlayerBolt;
            }
        }

        const damageType = this.weaponData?.damage_type?.toLowerCase() || '';
        const isBallistic = damageType === 'ballistic';

        let boltColor = 0xff0000; // Default Red

        if (damageType === 'ion') {
            boltColor = 0xffffff; // White for Ion
        } else if (damageType === 'bowcaster') {
            boltColor = 0x00ff00; // Green for Bowcaster
        } else if (isBallistic) {
            boltColor = 0x888888; // Gray for Ballistic
        } else if (weaponName.includes('clone') || weaponName.includes('republic') || weaponName.includes('blue')) {
            boltColor = 0x0000ff;
        } else if (weaponName.includes('mandalorian') || weaponName.includes('yellow')) {
            boltColor = 0xffff00;
        } else if (weaponName.includes('tie') || weaponName.includes('green')) {
            boltColor = 0x00ff00;
        }

        // Override if NPC has a preferred color in config? (Not implemented, but good idea for later)

        const bolt = new boltClass(startPosition, direction, {
            owner: this,
            ownerType: ownerType,
            damage: damage,
            speedMultiplier: boltSpeedMultiplier,
            isBallistic: isBallistic,
            color: boltColor
        });

        // Track DroidSlayer attack
        if (this.isDroidSlayer && window.droidSlayerSystem) {
            window.droidSlayerSystem.onDroidSlayerAttack(this);
        }

        game.entities.projectiles.push(bolt);
    }
}
