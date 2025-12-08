// BROWSERFIREFOXHIDE slicing_system.js
// Slicing system for hacking enemy spawn points to summon allies or trigger security alerts

class SlicingSystem {
    constructor() {
        this.currentTarget = null;
        this.hasSlicingSkill = false;
        this.slicedSpawners = new Set(); // Track already sliced spawners

        this.createUI();
    }

    createUI() {
        // Create "Press E to Slice" prompt (LARGE, center of screen)
        const promptDiv = document.createElement('div');
        promptDiv.id = 'slicing-prompt';
        promptDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: #00ffcc;
            padding: 20px 40px;
            border: 3px solid #00ffcc;
            border-radius: 8px;
            font-family: monospace;
            font-size: 24px;
            font-weight: bold;
            display: none;
            z-index: 1000;
            text-align: center;
            box-shadow: 0 0 30px rgba(0, 255, 204, 0.5);
        `;
        document.body.appendChild(promptDiv);
        this.promptElement = promptDiv;

        // Create result message UI
        const resultDiv = document.createElement('div');
        resultDiv.id = 'slicing-result';
        resultDiv.style.cssText = `
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            padding: 20px 40px;
            border: 3px solid #00ff00;
            border-radius: 8px;
            font-family: monospace;
            font-size: 22px;
            font-weight: bold;
            display: none;
            z-index: 1001;
            text-align: center;
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
        `;
        document.body.appendChild(resultDiv);
        this.resultElement = resultDiv;
    }

    // Calculate difficulty: 30 * spawner_grade + 45
    // Spawner grade is based on total_max_threat divided by 10 (threat 10 = grade 1, 20 = grade 2, etc.)
    // Or we can use max_individual_threat as the grade indicator
    calculateDifficulty(spawnPoint) {
        // Use max_individual_threat as the "grade" (1-5 typically)
        const grade = spawnPoint.properties.max_individual_threat || 1;
        return 10 + grade;
    }

    checkNearbySpawner() {
        if (!window.game || !window.physics || !window.game.entities.enemySpawnPoints) return null;

        const playerPos = window.physics.playerCollider.position;

        // Check all spawn points
        for (const spawnPoint of window.game.entities.enemySpawnPoints.spawnPoints) {
            if (spawnPoint.isDestroyed) continue;
            if (this.slicedSpawners.has(spawnPoint.id)) continue;

            const dist = playerPos.distanceTo(spawnPoint.position);
            // Must be close to the right side of the spawner (within 3 units)
            if (dist < 3.0) {
                return spawnPoint;
            }
        }

        return null;
    }

    updatePrompt() {
        if (!this.hasSlicingSkill) {
            this.promptElement.style.display = 'none';
            return;
        }

        const spawnPoint = this.checkNearbySpawner();

        if (spawnPoint) {
            this.currentTarget = spawnPoint;
            const difficulty = this.calculateDifficulty(spawnPoint);
            const grade = spawnPoint.properties.max_individual_threat || 1;

            this.promptElement.innerHTML = `
                <div style="margin-bottom: 10px;">SPAWNER DETECTED (Grade ${grade})</div>
                <div style="font-size: 18px; margin-bottom: 10px;">Difficulty: ${difficulty}</div>
                <div style="color: #ffcc00;">Press E to Slice</div>
            `;
            this.promptElement.style.display = 'block';
        } else {
            this.promptElement.style.display = 'none';
            this.currentTarget = null;
        }
    }

    attemptSlice() {
        if (!this.currentTarget || !this.hasSlicingSkill) return;

        const spawnPoint = this.currentTarget;
        if (this.slicedSpawners.has(spawnPoint.id)) return;

        const difficulty = this.calculateDifficulty(spawnPoint);
        const slicingSkill = window.characterStats.skills.slicing || 0;

        // Roll 1d20
        const roll = Math.floor(Math.random() * 20) + 1;
        const totalRoll = roll + slicingSkill;

        console.log(`[Slicing] Roll: ${roll} + ${slicingSkill} skill = ${totalRoll} vs difficulty ${difficulty}`);

        // Mark as sliced so it can't be sliced again
        this.slicedSpawners.add(spawnPoint.id);
        this.promptElement.style.display = 'none';

        if (totalRoll >= difficulty) {
            this.handleSuccess(spawnPoint, totalRoll, difficulty);
        } else {
            this.handleFailure(spawnPoint);
        }
    }

    handleSuccess(spawnPoint, totalRoll, difficulty) {
        const successMargin = totalRoll - difficulty;

        // Find most friendly faction (lowest relationship score)
        const playerFaction = 'player_droid';
        const allFactions = window.game.factionManager.getAllFactionNames().filter(f => f !== playerFaction);

        let mostFriendly = null;
        let lowestScore = 101;
        for (const faction of allFactions) {
            const score = window.game.factionManager.getRelationship(playerFaction, faction);
            if (score < lowestScore) {
                lowestScore = score;
                mostFriendly = faction;
            }
        }

        if (!mostFriendly) {
            console.error('[Slicing] No friendly faction found!');
            return;
        }

        // Calculate total threat to summon
        // Base: 2 threat (two threat 1 NPCs)
        // Every 10 points above difficulty adds 1 to total threat
        let totalThreat = 2;
        const extraThreat = Math.floor(successMargin / 10);
        totalThreat = Math.min(totalThreat + extraThreat, 6); // Max 6 (two threat 3 allies)

        console.log(`[Slicing] SUCCESS! Margin: ${successMargin}, Extra threat: ${extraThreat}, Total threat: ${totalThreat}`);

        // Determine if this is a critical success (exceeds max summon potential)
        const isCritical = totalThreat >= 6 && successMargin >= 40;

        // Distribute threat across 2 NPCs
        let threat1, threat2;
        if (totalThreat <= 2) {
            threat1 = 1;
            threat2 = 1;
        } else if (totalThreat === 3) {
            threat1 = 2;
            threat2 = 1;
        } else if (totalThreat === 4) {
            threat1 = 2;
            threat2 = 2;
        } else if (totalThreat === 5) {
            threat1 = 3;
            threat2 = 2;
        } else { // 6
            threat1 = 3;
            threat2 = 3;
        }

        // Spawn the allies
        this.spawnAllies(spawnPoint, mostFriendly, threat1, threat2, isCritical);

        // Show result message
        const factionPlural = this.getFactionPlural(mostFriendly);
        let message;
        let color;

        if (isCritical) {
            message = `Slicing Critical Success!<br>Strong Friends Summoned!`;
            color = '#00ff88';
        } else if (totalThreat > 2) {
            message = `Slicing Success!<br>Strong ${factionPlural} Summoned!`;
            color = '#00ff00';
        } else {
            message = `Slicing Succeeded!<br>Summoning ${factionPlural}!`;
            color = '#00ff00';
        }

        this.showResult(message, color);

        // Play success sound
        if (window.audioSystem) {
            window.audioSystem.playSound('slicesuccess');
        }
    }

    handleFailure(spawnPoint) {
        console.log('[Slicing] FAILURE! Spawning security...');

        // Find most hostile faction (highest relationship score)
        const playerFaction = 'player_droid';
        const allFactions = window.game.factionManager.getAllFactionNames().filter(f => f !== playerFaction);

        let mostHostile = null;
        let highestScore = -1;
        for (const faction of allFactions) {
            const score = window.game.factionManager.getRelationship(playerFaction, faction);
            if (score > highestScore) {
                highestScore = score;
                mostHostile = faction;
            }
        }

        if (!mostHostile) {
            console.error('[Slicing] No hostile faction found!');
            return;
        }

        // Spawn a threat 3 enemy
        this.spawnEnemy(spawnPoint, mostHostile, 3);

        // Show failure message
        this.showResult('Slicing Failed!<br>Security is Coming!', '#ff4444');

        // Play failure/alarm sound
        if (window.audioSystem) {
            window.audioSystem.playSound('slicefail');
        }
    }

    spawnAllies(spawnPoint, faction, threat1, threat2, makeFriends = false) {
        const macroCategory = this.getMacroCategoryForFaction(faction);

        // Spawn first NPC
        this.spawnNpcAtSpawner(spawnPoint, faction, macroCategory, threat1, true, makeFriends);

        // Spawn second NPC with slight delay
        setTimeout(() => {
            this.spawnNpcAtSpawner(spawnPoint, faction, macroCategory, threat2, true, makeFriends);
        }, 500);
    }

    spawnEnemy(spawnPoint, faction, threat) {
        const macroCategory = this.getMacroCategoryForFaction(faction);
        this.spawnNpcAtSpawner(spawnPoint, faction, macroCategory, threat, false, false);
    }

    async spawnNpcAtSpawner(spawnPoint, faction, macroCategory, threatLevel, isAlly, makeFriend) {
        // Find an NPC of the right faction and threat
        const criteria = {
            macroCategory: macroCategory,
            subgroup: 'all',
            threat: threatLevel
        };

        const possibleNpcs = window.assetManager.getNpcsByCriteria(criteria);
        if (possibleNpcs.length === 0) {
            console.error(`[Slicing] No NPCs found for ${macroCategory} threat ${threatLevel}`);
            return;
        }

        const chosenKey = possibleNpcs[Math.floor(Math.random() * possibleNpcs.length)];

        // Ensure texture is loaded
        if (!window.assetManager.getTexture(chosenKey)) {
            const skinPath = window.assetManager.skinPathMap.get(chosenKey);
            if (skinPath) {
                try {
                    await window.assetManager.loadTexture(skinPath, chosenKey);
                } catch (err) {
                    console.error(`[Slicing] Failed to load texture for ${chosenKey}:`, err);
                    return;
                }
            }
        }

        // Spawn position near the spawner
        const spawnPosition = spawnPoint.position.clone();
        // Offset slightly to spread NPCs out
        spawnPosition.x += (Math.random() - 0.5) * 2;
        spawnPosition.z += (Math.random() - 0.5) * 2;

        const gridX = Math.floor(spawnPosition.x / GAME_GLOBAL_CONSTANTS.GRID.SIZE);
        const gridZ = Math.floor(spawnPosition.z / GAME_GLOBAL_CONSTANTS.GRID.SIZE);
        const gridKey = `${gridX},${gridZ}`;

        // Get NPC config for name generation
        const npcIconData = window.assetManager.npcIcons.get(chosenKey);
        const npcConfig = npcIconData ? npcIconData.config : {};

        const itemData = {
            type: 'npc',
            key: chosenKey,
            properties: {
                name: null,
                subgroup: npcConfig.groupKey
            }
        };

        // Generate name
        const npcForNaming = {
            name: null,
            subgroup: npcConfig.groupKey,
            faction: npcConfig.faction
        };
        itemData.properties.name = generateNpcName(npcForNaming, window.levelManager.nameData);

        // Create the NPC
        if (window.levelRenderer && window.levelRenderer.createNPCs) {
            const npcEntry = [[gridKey, itemData]];
            const npcCountBefore = window.game.entities.npcs.length;

            await window.levelRenderer.createNPCs(npcEntry);

            const npcCountAfter = window.game.entities.npcs.length;
            if (npcCountAfter > npcCountBefore) {
                const newNpc = window.game.entities.npcs[window.game.entities.npcs.length - 1];

                if (newNpc) {
                    if (isAlly) {
                        if (makeFriend) {
                            // Make them "friends" - like pamphlet converted but not full allies
                            // They fight with player but don't follow to other levels
                            newNpc.isFriend = true;
                            newNpc.followingPlayer = false;

                            // Apply green nametag (similar to converted NPCs)
                            if (newNpc.nameLabelSprite) {
                                newNpc.nameLabelSprite.material.color.setHex(0x00ff00);
                            }

                            console.log(`[Slicing] Spawned FRIEND: ${chosenKey} (threat ${threatLevel})`);
                        } else {
                            // Normal ally behavior - friendly to player
                            console.log(`[Slicing] Spawned ALLY: ${chosenKey} (threat ${threatLevel})`);
                        }
                    } else {
                        // Enemy - aggro on player immediately
                        newNpc.aggro({
                            position: window.physics.playerCollider.position,
                            isPlayer: true
                        });
                        console.log(`[Slicing] Spawned ENEMY: ${chosenKey} (threat ${threatLevel})`);
                    }
                }
            }
        }
    }

    getMacroCategoryForFaction(factionKey) {
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

    getFactionPlural(faction) {
        const plurals = {
            'rebels': 'Rebels',
            'imperials': 'Imperials',
            'clones': 'Clones',
            'mandalorians': 'Mandalorians',
            'sith': 'Sith',
            'aliens': 'Aliens',
            'droids': 'Droids',
            'takers': 'Takers'
        };
        return plurals[faction] || faction;
    }

    showResult(message, color) {
        this.resultElement.innerHTML = message;
        this.resultElement.style.color = color;
        this.resultElement.style.borderColor = color;
        this.resultElement.style.boxShadow = `0 0 30px ${color}80`;
        this.resultElement.style.display = 'block';

        // Hide after 3 seconds
        setTimeout(() => {
            this.resultElement.style.display = 'none';
        }, 3000);
    }

    update(deltaTime) {
        if (window.characterStats) {
            this.hasSlicingSkill = window.characterStats.skills.slicing > 0;
        }
        this.updatePrompt();
    }

    // Handle E key press
    handleKeyPress(key) {
        if (key === 'KeyE' && this.hasSlicingSkill && this.currentTarget) {
            this.attemptSlice();
        }
    }

    // Reset for new level
    reset() {
        this.slicedSpawners.clear();
        this.currentTarget = null;
        this.promptElement.style.display = 'none';
        this.resultElement.style.display = 'none';
    }
}

// Initialize slicing system when game loads
window.addEventListener('load', () => {
    const checkGame = setInterval(() => {
        if (window.game) {
            clearInterval(checkGame);
            window.game.slicingSystem = new SlicingSystem();
            console.log('Slicing system initialized');

            // Hook into input handler for E key
            if (window.inputHandler) {
                const originalKeyDown = window.inputHandler.onKeyDown.bind(window.inputHandler);
                window.inputHandler.onKeyDown = function (event) {
                    originalKeyDown(event);
                    if (event.code === 'KeyE' && window.game.slicingSystem) {
                        window.game.slicingSystem.handleKeyPress(event.code);
                    }
                };
            }

            // Debug commands
        }
    }, 100);
});
