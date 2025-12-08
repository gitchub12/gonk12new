class LevelManager {
    constructor() {
        this.currentLevel = 0;
        this.nameData = null;
    }

    /**
     * Decompresses level data from v2 compressed format to v1 legacy format
     * Automatically detects format and decompresses if needed
     */
    decompressLevel(levelData) {
        // Auto-detect format version
        if (levelData.version !== 2) {
            // Legacy format - return as-is
            return levelData;
        }

        console.log('[LevelManager] Decompressing level format v2...');

        const decompressed = {
            settings: {
                width: levelData.settings.width,
                height: levelData.settings.height,
                defaults: {}
            },
            layers: {}
        };

        // Convert defaults (these are ONLY for layers with actual defaults)
        for (const [layerName, defaultDef] of Object.entries(levelData.settings.defaults || {})) {
            decompressed.settings.defaults[layerName] = {
                key: levelData.settings.textureRegistry[defaultDef.textureId],
                size: defaultDef.size || 1,
                properties: defaultDef.properties || {}
            };
        }

        // Expand layers - ONLY expand overrides (no default fill)
        for (const [layerName, layerData_inner] of Object.entries(levelData.layers)) {
            if (layerData_inner.type === "sparse") {
                decompressed.layers[layerName] = layerData_inner.overrides.map(([pos, item]) => {
                    const expanded = {
                        key: levelData.settings.textureRegistry[item.textureId]
                    };

                    // Preserve all properties
                    if (item.size !== undefined) expanded.size = item.size;
                    if (item.rotation !== undefined) expanded.rotation = item.rotation;
                    if (item.properties) expanded.properties = item.properties;
                    if (item.type) expanded.type = item.type;

                    // Set defaults for required fields
                    if (expanded.size === undefined) expanded.size = 1;
                    if (expanded.rotation === undefined) expanded.rotation = 0;
                    if (expanded.properties === undefined) expanded.properties = {};
                    if (expanded.type === undefined) expanded.type = 'texture';

                    return [pos, expanded];
                });
            } else {
                // Non-sparse layers (npcs, furniture, etc.) pass through
                decompressed.layers[layerName] = layerData_inner;
            }
        }

        console.log('[LevelManager] Decompression complete');
        return decompressed;
    }

    async loadLevel(levelId) {
        // Save character state before transitioning
        if (window.characterStats && window.characterStats.currentClass) {
            const charState = window.characterStats.saveState();
            localStorage.setItem('gonk_character_state', JSON.stringify(charState));
            console.log('[LevelManager] Saved character state:', charState.currentClass, 'Level', charState.level);
        }

        const playtestDataString = localStorage.getItem('gonk_level_to_play');
        const isPlaytest = !!playtestDataString;

        // Check if we should skip the end screen (for dock transitions)
        const skipEndScreen = localStorage.getItem('gonk_skip_end_screen') === 'true';
        if (skipEndScreen) {
            localStorage.removeItem('gonk_skip_end_screen'); // Clear flag after reading
        }

        // Ensure cheats state is initialized before accessing it
        const forceShowSummary = window.game && window.game.state && window.game.state.cheats ? window.game.state.cheats.showEndOfLevelSummary : false;

        // Show summary if it's not the very first level load, not a dock transition, and it's either not a playtest or the cheat is enabled.
        if (this.currentLevel > 0 && !skipEndScreen && (!isPlaytest || forceShowSummary)) {
            if (window.endOfLevelManager) {
                // NOTE: A real stats object will be created and passed here in the future.
                await window.endOfLevelManager.show({});
            }
        }

        if (window.loadingScreenManager) window.loadingScreenManager.show();
        this.pendingMusicSettings = null; // Will be set after level data loads
        this.levelDataParsed = false; // Reset flag for new level load
        try {
            // Shift ship control for the level we're leaving (not level 1, the home base)
            if (this.currentLevel && this.currentLevel !== 1 && window.mapScreen) {
                const previousLevel = this.currentLevel;
                window.mapScreen.shiftShipControl(previousLevel);
            }

            if (window.game) {
                if (window.game.npcs) {
                    for (const npc of window.game.npcs) {
                        npc.hasSpoken = false;
                    }
                }
                if (window.game.state && window.game.state.allies) {
                    for (const ally of window.game.state.allies) {
                        if (ally.npc) {
                            ally.npc.hasSpoken = false;
                        }
                    }
                }
            }
            this.currentLevel = levelId;
            let levelData;

            if (window.loadingScreenManager) window.loadingScreenManager.updateStatus(`Loading Level ${levelId} Data...`);
            let rawText;
            if (playtestDataString) {
                rawText = playtestDataString;
            } else {
                const response = await fetch(`data/levels/level_${levelId}.json`);
                if (!response.ok) throw new Error(`Level file not found for level_${levelId}.json`);
                rawText = await response.text();
            }
            const cleanText = rawText.split('\n').filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('#')).join('\n');
            levelData = JSON.parse(cleanText);

            // Decompress if needed (auto-detects v2 compressed format)
            levelData = this.decompressLevel(levelData);

            // Store level music settings for audio system to use
            if (levelData.settings && levelData.settings.defaults && levelData.settings.defaults.music) {
                this.pendingMusicSettings = levelData.settings.defaults.music;
                console.log('[LevelManager] Found music settings:', this.pendingMusicSettings);
            } else {
                console.log('[LevelManager] No music settings in level data');
            }
            this.levelDataParsed = true; // Signal that level data has been parsed

            if (!this.nameData) {
                const nameDataResponse = await fetch('data/npc_names.json');
                if (!nameDataResponse.ok) throw new Error('Failed to load npc_names.json');
                this.nameData = await nameDataResponse.json();
            }

            if (levelData.layers.npcs) {
                const npcLayerMap = new Map(levelData.layers.npcs);

                const randomNpcItems = [];
                npcLayerMap.forEach((item, key) => {
                    if (item.type === 'random_npc') {
                        randomNpcItems.push({ key, item });
                    }
                });

                for (const { key, item } of randomNpcItems) {
                    const criteria = {
                        threat: item.properties.threat,
                        macroCategory: item.properties.macroCategory,
                        subgroup: item.properties.subgroup
                    };
                    const possibleNpcs = assetManager.getNpcsByCriteria(criteria);

                    if (possibleNpcs.length > 0) {
                        const chosenNpcKey = possibleNpcs[Math.floor(Math.random() * possibleNpcs.length)];
                        const chosenNpcItem = { ...item, type: 'npc', key: chosenNpcKey };
                        npcLayerMap.set(key, chosenNpcItem);
                    } else {
                        console.warn(`No NPCs found for random placement criteria:`, criteria);
                        npcLayerMap.delete(key);
                    }
                }

                npcLayerMap.forEach((item, key) => {
                    if (item.type !== 'npc') return;

                    const skinName = item.key;
                    const npcConfig = assetManager.npcIcons.get(skinName)?.config;

                    if (!npcConfig) {
                        console.warn(`Cannot assign name: No config found for NPC skin '${skinName}'.`);
                        return;
                    }

                    const subgroup = item.properties.subgroup || npcConfig.groupKey;

                    const npcForNaming = {
                        name: item.properties.name,
                        subgroup: subgroup,
                        faction: npcConfig.faction
                    };

                    item.properties.name = generateNpcName(npcForNaming, this.nameData);
                });


                levelData.layers.npcs = Array.from(npcLayerMap.entries());
            }

            await assetManager.loadLevelAssets(levelData);
            if (window.loadingScreenManager) window.loadingScreenManager.updateStatus('Preloading Weapon Models...');
            await weaponIcons.preloadWeapons(levelData);

            if (window.loadingScreenManager) window.loadingScreenManager.updateStatus('Building Level Geometry...');
            levelRenderer.buildLevelFromData(levelData);
            if (levelData.layers.assets) {
                levelRenderer.buildFurniture(levelData.layers.assets);
                if (window.game && window.levelRenderer.furnitureObjects) {
                    window.game.entities.furniture = window.levelRenderer.furnitureObjects.filter(f => f.userData.isQuestVendor);
                }
            }
            if (levelData.layers.enemy_spawn_points) {
                levelRenderer.buildEnemySpawnPoints(levelData.layers.enemy_spawn_points);
            }
            if (levelData.layers.stations) {
                levelRenderer.createStations(levelData.layers.stations);
            }
            if (levelData.layers.npcs) {
                await levelRenderer.createNPCs(levelData.layers.npcs);
            }

            if (window.game) {
                game.respawnAllies();
            }

            // Restore character state after level loads
            const savedCharState = localStorage.getItem('gonk_character_state');
            if (savedCharState && window.characterStats) {
                try {
                    const charState = JSON.parse(savedCharState);
                    await window.characterStats.loadState(charState);
                    console.log('[LevelManager] Restored character state:', charState.currentClass, 'Level', charState.level);

                    // Sync with game.hasSelectedClass
                    if (window.game && charState.currentClass) {
                        window.game.hasSelectedClass = true;
                        window.game.playerClass = charState.currentClass;
                    }

                    // Update UI
                    if (window.characterUpgrades) {
                        window.characterUpgrades.updateD20Display();
                    }
                } catch (e) {
                    console.error('[LevelManager] Failed to restore character state:', e);
                }
            }

            // Quest Triggers
            if (levelId === 20 && window.questManager) {
                window.questManager.acceptQuest('MQ_01_Escape_Factory');
            }

        } catch (error) {
            console.error(`Failed to load or build level ${levelId}:`, error);
            levelRenderer.createFallbackFloor();
        } finally {
            if (playtestDataString) {
                localStorage.removeItem('gonk_level_to_play');
            }
            if (window.loadingScreenManager) window.loadingScreenManager.finishLoading();
        }
    }
}

window.levelManager = new LevelManager();