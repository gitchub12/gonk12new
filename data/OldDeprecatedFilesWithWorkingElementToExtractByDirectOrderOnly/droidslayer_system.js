// BROWSERFIREFOXHIDE droidslayer_system.js
// Manages the DroidSlayer nemesis system - promotion, abilities, persistence, and interactions

class DroidSlayerSystem {
    constructor() {
        this.activeDroidSlayer = null;
        this.damagedNode = null; // Which upgrade node has been damaged
        this.musicFadingOut = false;
        this.tyranitarPlaying = false;
        this.encounterCount = 0; // Track how many times we've fought the DroidSlayer
        this.hasEscaped = false; // Track if DroidSlayer has fled
        this.fleeTargetLevel = null; // Which level the DroidSlayer fled to
        this.cheatNextShotMakesDroidSlayer = false; // Cheat toggle

        // Variant types with their properties
        this.variants = {
            gunslinger: {
                name: "Gunslinger",
                fireRateBonus: 1.0, // 100% faster
                cooldownReduction: 0.5
            },
            juggernaut: {
                name: "Juggernaut",
                damageReduction: 0.5, // Takes 50% less damage
                speedPenalty: 0.2
            },
            tactician: {
                name: "Tactician",
                minionCount: 4, // Spawns 4 instead of 2
                keepDistance: true
            },
            berserker: {
                name: "Berserker",
                speedBonus: 0.5,
                damageBonus: 1.0,
                damageTakenBonus: 0.3
            },
            sniper: {
                name: "Sniper",
                rangeBonus: 2.0, // 200% range
                perfectAccuracy: true,
                glowColor: 0x0099ff // Blue instead of red
            },
            shadow: {
                name: "Shadow",
                transparency: 0.5,
                teleportCooldown: 5.0 // Seconds between teleports
            },
            thief: {
                name: "Thief",
                wireSteal: 2 // Steals 2 wire per hit
            }
        };

        // Eligibility tracking
        this.eligibilityCheckTimer = 0;
        this.killCount = 0;
        this.playerDamageTaken = 0;
    }

    update(deltaTime) {
        // Check for DroidSlayer promotion conditions
        if (!this.activeDroidSlayer && window.game && !window.game.state.isPaused) {
            this.eligibilityCheckTimer -= deltaTime;
            if (this.eligibilityCheckTimer <= 0) {
                this.eligibilityCheckTimer = 10.0; // Check every 10 seconds
                this.checkForPromotion();
            }
        }

        // Update active DroidSlayer
        if (this.activeDroidSlayer && !this.activeDroidSlayer.isDead) {
            this.updateDroidSlayerBehavior(deltaTime);
        }
    }

    checkForPromotion() {
        if (this.activeDroidSlayer) return; // Only one DroidSlayer at a time

        // Cheat mode: instant promotion on next damage
        if (this.cheatNextShotMakesDroidSlayer) {
            // Find any NPC that's being damaged
            // This will be triggered from the damage handler
            return;
        }

        // Check if player is "doing too well"
        const doingTooWell = this.killCount >= 10;
        if (!doingTooWell) return;

        // Find eligible NPCs
        const eligibleNPCs = window.game.entities.npcs.filter(npc => this.isEligible(npc));
        if (eligibleNPCs.length === 0) return;

        // Weight the candidates
        const weightedCandidates = eligibleNPCs.map(npc => ({
            npc,
            weight: this.calculateWeight(npc)
        }));

        // Roll for promotion (10% chance per check when doing too well)
        if (Math.random() < 0.1) {
            const totalWeight = weightedCandidates.reduce((sum, c) => sum + c.weight, 0);
            let roll = Math.random() * totalWeight;

            for (const candidate of weightedCandidates) {
                roll -= candidate.weight;
                if (roll <= 0) {
                    this.promoteToDroidSlayer(candidate.npc);
                    break;
                }
            }
        }
    }

    isEligible(npc) {
        // Must be in combat
        if (npc.currentState !== 'CHASING' && npc.currentState !== 'ATTACKING') return false;

        // Must have humanoid 3D mesh (not a krayt dragon or cow)
        if (!npc.mesh || !npc.mesh.parts || !npc.mesh.parts.head) return false;

        // Must not be hostileAll
        if (npc.hostileAll) return false;

        // Must have at least 60% HP
        if (npc.health < npc.maxHealth * 0.6) return false;

        // Must have been in combat for at least 30 seconds
        if (npc.stateTimer < 30.0) return false;

        // Must have a weapon
        if (!npc.weaponData) return false;

        // Must have dealt damage at least 3 times (we'll track this with a new property)
        if (!npc.damageDealtCount || npc.damageDealtCount < 3) return false;

        return true;
    }

    calculateWeight(npc) {
        let weight = 1.0;

        // Check for recent ally kills by this NPC
        if (npc.recentAllyKill) weight *= 10;

        // Check for witnessing player kills of their faction
        if (npc.witnessedKills && npc.witnessedKills >= 3) weight *= 5;

        // Survived long time against player
        if (npc.stateTimer > 60) weight *= 3;

        // Elite or boss type
        if (npc.config.threat >= 3) weight *= 2;

        // Closest to player
        const dist = npc.mesh.group.position.distanceTo(physics.playerCollider.position);
        if (dist < 5.0) weight *= 2;

        // Has dealt most damage to player
        if (npc.damageDealtToPlayer > 20) weight *= 4;

        return weight;
    }

    promoteToDroidSlayer(npc) {
        console.log(`Promoting ${npc.name} to DroidSlayer!`);

        this.activeDroidSlayer = npc;
        npc.isDroidSlayer = true;

        // Choose random variant
        const variantKeys = Object.keys(this.variants);
        const variantKey = variantKeys[Math.floor(Math.random() * variantKeys.length)];
        npc.droidSlayerVariant = this.variants[variantKey];

        // Store original stats
        npc.originalMaxHealth = npc.maxHealth;
        npc.originalSpeed = npc.speed;
        npc.originalPerceptionRadius = npc.perceptionRadius;
        npc.originalScale = npc.mesh.group.scale.clone();

        // Apply transformation
        this.transformDroidSlayer(npc);

        // Show transformation sequence
        this.playTransformationSequence(npc);

        // Damage a random node
        this.damageRandomNode();
    }

    transformDroidSlayer(npc) {
        // Set HP based on encounter count
        if (this.encounterCount === 0) {
            // First encounter: invincible
            npc.health = 9999;
            npc.maxHealth = 9999;
            npc.droidSlayerFleeThreshold = 200;
        } else {
            // Second+ encounter: 3000 HP
            npc.health = 3000;
            npc.maxHealth = 3000;
            npc.droidSlayerFleeThreshold = 400;
        }

        // Make DroidSlayer never recruitable and always hostile
        npc.hostileAll = true;
        npc.NonFactionNeutral = false;
        npc.canBeRecruited = false;

        // Set perfect accuracy
        npc.accuracy = 1.0;

        // Scale up by 30%
        const newScale = 1.3;
        npc.mesh.group.scale.multiplyScalar(newScale);

        // Perception radius to maximum
        npc.perceptionRadius = 999;

        // Base speed increase for all DroidSlayers
        npc.speed *= 1.5;

        // Apply variant-specific modifications
        const variant = npc.droidSlayerVariant;
        if (variant.speedBonus) {
            npc.speed *= (1 + variant.speedBonus);
        }
        if (variant.speedPenalty) {
            npc.speed *= (1 - variant.speedPenalty);
        }

        // Second+ encounter: equip red saber
        if (this.encounterCount > 0) {
            this.equipRedSaber(npc);
        }

        // Update name
        const firstName = npc.name.split(' ')[0];
        const fullName = npc.name;
        if (fullName.length <= 12) {
            npc.name = `${fullName} the DroidSlayer`;
        } else {
            npc.name = `${firstName} the DroidSlayer`;
        }

        // Update nameplate
        if (npc.nameplate && npc.nameplateName) {
            // Remove old nameSprite
            if (npc.nameSprite) {
                npc.nameplateName.remove(npc.nameSprite);
                // Dispose of old sprite
                if (npc.nameSprite.material && npc.nameSprite.material.map) {
                    npc.nameSprite.material.map.dispose();
                }
                if (npc.nameSprite.material) {
                    npc.nameSprite.material.dispose();
                }
            }

            // Create new red nameSprite
            npc.nameSprite = npc.createTextSprite(npc.name, {
                fontsize: 48,
                fontface: 'Arial',
                textColor: { r: 255, g: 0, b: 0, a: 1.0 }
            });
            const nameWidth = npc.nameSprite.material.map.image.width;
            const nameHeight = npc.nameSprite.material.map.image.height;
            npc.nameSprite.scale.set(nameWidth, nameHeight, 1.0);
            npc.nameplateName.add(npc.nameSprite);
        }
    }

    equipRedSaber(npc) {
        // Change weapon to red saber
        const redSaberPath = 'E:\\gonk\\data\\NPConlyweapons\\saber\\saber_red.png';

        // Update weapon data
        npc.itemData.properties.weapon = redSaberPath;
        npc.weaponData = {
            damage: 20,
            range: 2.0,
            cooldown: 0.5,
            category: 'saber'
        };

        // Load red saber texture and update weapon mesh
        if (npc.weaponMesh) {
            const loader = new THREE.TextureLoader();
            loader.load(redSaberPath, (texture) => {
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                npc.weaponMesh.material.map = texture;
                npc.weaponMesh.material.needsUpdate = true;
            });
        }

        // Enable bolt reflection based on encounter count
        npc.boltReflectionChance = 0.3 + (this.encounterCount - 1) * 0.1;
        console.log(`DroidSlayer bolt reflection chance: ${npc.boltReflectionChance * 100}%`);
    }

    async playTransformationSequence(npc) {
        // Pause briefly with screen shake
        window.game.triggerDamageEffect({
            flashOpacity: 0,
            flashDuration: 0,
            shakeIntensity: 0.05,
            shakeDuration: 1.5
        });

        // Play DroidSlayer activation scream
        if (window.audioSystem) {
            window.audioSystem.playPositionalSound(
                '/data/sounds/beasts/droidslayer/droidslayeryellsno.wav',
                npc.mesh.group.position,
                1.2
            );
        }

        // Show conversation-style announcement
        const factionColor = GAME_GLOBAL_CONSTANTS.FACTION_COLORS[npc.faction] || '#FF0000';
        const cryText = `${npc.name.split(' the DroidSlayer')[0]}: NOOOOOOOOO!`;

        window.conversationUIManager.showPhrase(0, cryText, npc, '#FF0000', npc.faction);

        // Create red glow effect
        this.createRedGlow(npc);

        // Fade out current music and start Tyranitar Orchestral
        setTimeout(() => {
            if (window.audioSystem) {
                this.musicFadingOut = true;
                // Fade current track
                const fadeInterval = setInterval(() => {
                    if (audioSystem.musicVolume > 0.1) {
                        audioSystem.musicVolume *= 0.8;
                    } else {
                        clearInterval(fadeInterval);
                        // Play Tyranitar track (use relative path)
                        audioSystem.playSpecificTrack('/data/sounds/MUSIC/orchestral/Tyranitar Orchestal.mp3');
                        this.tyranitarPlaying = true;
                        this.musicFadingOut = false;
                    }
                }, 50);
            }
        }, 500);

        // After roar (4 seconds), play weapon charge sound (3 seconds)
        setTimeout(() => {
            if (window.audioSystem) {
                window.audioSystem.playPositionalSound(
                    '/data/sounds/beasts/droidslayer/weaponcharge.mp3',
                    npc.mesh.group.position,
                    1.0
                );
            }
        }, 4000);

        // Fire burst after roar + charge (7 seconds total)
        setTimeout(() => {
            this.fireDroidSlayerBurst(npc);
        }, 7000);

        // Spawn minions after burst
        setTimeout(() => {
            this.spawnDroidSlayerMinions(npc);
        }, 8000);

        // Set ally target priority after everything
        setTimeout(() => {
            // Always prioritize first ally if available
            if (window.game.state.allies.length > 0) {
                npc.target = window.game.state.allies[0].npc;
                npc.currentState = 'CHASING';
            } else {
                npc.target = physics.playerEntity;
                npc.currentState = 'CHASING';
            }

            // Hide conversation UI
            if (window.conversationUIManager) {
                window.conversationUIManager.resetToPeekState();
            }
        }, 9000);
    }

    createRedGlow(npc) {
        // Create a pulsing red light
        const redLight = new THREE.PointLight(0xff0000, 2, 10);
        npc.mesh.group.add(redLight);
        npc.droidSlayerLight = redLight;

        // Animate the light
        let intensity = 2;
        let growing = false;
        const pulseInterval = setInterval(() => {
            if (!npc.isDroidSlayer || npc.isDead) {
                clearInterval(pulseInterval);
                if (redLight.parent) redLight.parent.remove(redLight);
                return;
            }

            if (growing) {
                intensity += 0.1;
                if (intensity >= 3) growing = false;
            } else {
                intensity -= 0.1;
                if (intensity <= 1) growing = true;
            }
            redLight.intensity = intensity;
        }, 50);
    }

    fireDroidSlayerBurst(npc) {
        // Fire 12 shots in a 120-degree arc
        const startPosition = npc.mesh.group.position.clone();
        startPosition.y += 1.0; // Start from NPC chest

        const playerChestPosition = physics.playerCollider.position.clone();
        playerChestPosition.y += 1.0; // Aim at player chest

        const toPlayer = new THREE.Vector3().subVectors(playerChestPosition, startPosition).normalize();

        for (let i = 0; i < 12; i++) {
            const angle = (i - 5.5) * (Math.PI / 18); // 10-degree increments, 120-degree total spread
            const direction = toPlayer.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);

            // Enhanced bolts (50% bigger, 20% brighter, 25% faster)
            const bolt = new DroidSlayerBolt(startPosition, direction, {
                owner: npc,
                ownerType: 'droidslayer',
                damage: npc.weaponData?.damage || 10,
                sizeMultiplier: 1.5,
                brightnessMultiplier: 1.2,
                speedMultiplier: 1.25
            });
            window.game.entities.projectiles.push(bolt);
        }

        // Play weapon sound
        if (window.audioSystem && npc.weaponData) {
            const weaponName = npc.itemData.properties.weapon.split('/').pop().replace('.png', '');
            audioSystem.playWeaponFireSound(weaponName, npc.mesh.group.position);
        }
    }

    async spawnDroidSlayerMinions(npc) {
        const minionCount = npc.droidSlayerVariant.minionCount || 2;

        // Get medium-power NPCs of the same faction (Threat 2)
        const macroCategory = npc.faction.charAt(0).toUpperCase() + npc.faction.slice(1);
        const criteria = {
            threat: 2,
            macroCategory: macroCategory,
            subgroup: 'all'
        };

        const availableMinions = window.assetManager.getNpcsByCriteria(criteria);

        if (!availableMinions || availableMinions.length === 0) {
            console.warn(`No Threat 2 NPCs found for faction: ${npc.faction}`);
            return;
        }

        for (let i = 0; i < minionCount; i++) {
            const minionSkinName = availableMinions[Math.floor(Math.random() * availableMinions.length)];

            // Spawn position around the DroidSlayer
            const angle = (i / minionCount) * Math.PI * 2;
            const distance = 2.0;
            const spawnPos = npc.mesh.group.position.clone();
            spawnPos.x += Math.cos(angle) * distance;
            spawnPos.z += Math.sin(angle) * distance;

            console.log(`Spawning DroidSlayer minion: ${minionSkinName} at`, spawnPos);

            if (window.levelRenderer) {
                const minion = await window.levelRenderer.spawnNpc(minionSkinName, spawnPos);
                if (minion) {
                    // Make the minion immediately hostile to the player's party
                    const target = window.game.state.allies.length > 0 ? window.game.state.allies[0].npc : window.physics.playerEntity;
                    minion.aggro(target);
                }
            }
        }
    }

    damageRandomNode() {
        if (!window.characterUpgrades || !window.characterUpgrades.nodes) return;

        // Find unpurchased nodes
        const unpurchasedNodes = window.characterUpgrades.nodes.filter(node =>
            !window.characterUpgrades.purchasedNodes.has(node.id)
        );

        if (unpurchasedNodes.length === 0) return;

        // Pick a random one
        const randomNode = unpurchasedNodes[Math.floor(Math.random() * unpurchasedNodes.length)];
        this.damagedNode = randomNode.id;

        console.log(`DroidSlayer damaged node: ${this.damagedNode}`);
    }

    updateDroidSlayerBehavior(deltaTime) {
        const ds = this.activeDroidSlayer;
        if (!ds) return;

        // Check for flee condition (use dynamic threshold)
        const fleeThreshold = ds.droidSlayerFleeThreshold || 200;
        if (ds.droidSlayerDamageTaken >= fleeThreshold && !ds.isFleeing) {
            this.initiateDroidSlayerFlee(ds);
            return;
        }

        // If already fleeing, force movement toward exit
        if (ds.isFleeing) {
            if (ds.wanderTarget) {
                const dsPos = ds.mesh.group.position;
                const toExit = new THREE.Vector3().subVectors(ds.wanderTarget, dsPos).normalize();
                // Move at maximum speed toward exit
                ds.velocity.x = toExit.x * ds.speed * 2.0;
                ds.velocity.z = toExit.z * ds.speed * 2.0;
            }
            return;
        }

        // Determine target: prioritize first ally if available
        let targetPos, targetEntity;
        if (window.game.state.allies.length > 0) {
            targetEntity = window.game.state.allies[0].npc;
            targetPos = targetEntity.mesh.group.position;
            // Update target if not already set
            if (ds.target !== targetEntity) {
                ds.target = targetEntity;
                ds.currentState = 'CHASING';
            }
        } else if (window.physics && window.physics.playerCollider) {
            targetPos = window.physics.playerCollider.position;
            targetEntity = window.physics.playerEntity;
            if (ds.target !== targetEntity) {
                ds.target = targetEntity;
                ds.currentState = 'CHASING';
            }
        } else {
            return; // No valid target
        }

        // Aggressive advancement: constantly move toward target
        if (ds.currentState !== 'FLEEING') {
            const dsPos = ds.mesh.group.position;
            const distToTarget = dsPos.distanceTo(targetPos);

            // Force DroidSlayer to always advance toward target
            if (distToTarget > 1.5) {
                const toTarget = new THREE.Vector3().subVectors(targetPos, dsPos).normalize();

                // Determine speed based on weapon type and distance
                let advanceSpeed = ds.speed;
                if (ds.weaponData && ds.weaponData.category === 'saber') {
                    // Melee weapon: advance FAST
                    advanceSpeed *= 2.5;
                } else if (ds.currentState === 'ATTACKING' || distToTarget < 15) {
                    // Shooting at target or close range: advance slowly
                    advanceSpeed *= 0.5;
                } else {
                    // Closing distance: advance at normal speed
                    advanceSpeed *= 1.2;
                }

                // Override NPC velocity to force advance
                ds.velocity.x = toTarget.x * advanceSpeed;
                ds.velocity.z = toTarget.z * advanceSpeed;
            }
        }

        // Check for stuck behind obstacles (missed hits without dealing damage)
        if (ds.droidSlayerMissedHits >= 6) {
            // Enable no-clip mode to phase through obstacles
            if (!ds.noClipEnabled) {
                console.log('DroidSlayer stuck - enabling no-clip mode');
                ds.noClipEnabled = true;
                ds.noClipTimer = 5.0; // 5 seconds of no-clip
            }
            ds.droidSlayerMissedHits = 0;
        }

        // Handle no-clip timer
        if (ds.noClipEnabled) {
            ds.noClipTimer -= deltaTime;
            if (ds.noClipTimer <= 0) {
                console.log('DroidSlayer no-clip mode disabled');
                ds.noClipEnabled = false;
            }
        }
    }

    initiateDroidSlayerFlee(npc) {
        console.log(`DroidSlayer ${npc.name} is fleeing!`);

        // Set fleeing flag to prevent re-triggering
        npc.isFleeing = true;

        // Increment encounter count
        this.encounterCount++;

        // Choose a flee target level at least 4 ships away
        this.selectFleeTarget();

        // Show "I'll be back!" message immediately
        window.conversationUIManager.showPhrase(0, `${npc.name}: I'll be back!`, npc, '#FF0000', npc.faction);

        // Find nearest door or spawner
        const nearestExit = this.findNearestExit(npc);

        if (nearestExit) {
            // Path to the exit
            npc.currentState = 'FLEEING';
            npc.wanderTarget = nearestExit.position.clone();

            // When reaching exit, disappear
            const checkArrival = setInterval(() => {
                if (!npc || npc.isDead || npc.mesh.group.position.distanceTo(nearestExit.position) < 1.0) {
                    clearInterval(checkArrival);
                    if (npc && !npc.isDead) {
                        this.droidSlayerEscape(npc);
                    }
                }
            }, 100);

            // Also set a timeout - if not reached exit in 15 seconds, force escape
            setTimeout(() => {
                if (npc && !npc.isDead && npc.isFleeing) {
                    clearInterval(checkArrival);
                    this.droidSlayerEscape(npc);
                }
            }, 15000);
        } else {
            // No exit found, just disappear after showing message
            setTimeout(() => {
                if (npc && !npc.isDead) {
                    this.droidSlayerEscape(npc);
                }
            }, 3000);
        }

        // Hide conversation UI after 8 seconds
        setTimeout(() => {
            if (window.conversationUIManager) {
                window.conversationUIManager.resetToPeekState();
            }
        }, 8000);
    }

    selectFleeTarget() {
        // Select a level at least 4 ships away from current level
        const currentLevel = window.levelManager ? window.levelManager.currentLevel : 1;
        const minDistance = 4;

        // Choose random direction: forward or backward
        const forward = Math.random() > 0.5;

        if (forward) {
            this.fleeTargetLevel = currentLevel + minDistance + Math.floor(Math.random() * 3); // 4-6 levels ahead
        } else {
            this.fleeTargetLevel = Math.max(1, currentLevel - minDistance - Math.floor(Math.random() * 3)); // 4-6 levels back
        }

        console.log(`DroidSlayer will flee to level ${this.fleeTargetLevel} (current: ${currentLevel})`);
    }

    findNearestExit(npc) {
        const npcPos = npc.mesh.group.position;
        let nearest = null;
        let minDist = Infinity;

        // Check doors
        if (window.game.entities.doors && window.game.entities.doors.length > 0) {
            for (const door of window.game.entities.doors) {
                // Door has meshGroup with position
                if (!door.meshGroup || !door.meshGroup.position) continue;
                const doorPos = door.meshGroup.position;
                const dist = npcPos.distanceTo(doorPos);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = { type: 'door', position: doorPos.clone() };
                }
            }
        }

        // Check spawners
        if (window.game.entities.enemySpawnPoints && window.game.entities.enemySpawnPoints.spawnPoints) {
            for (const spawner of window.game.entities.enemySpawnPoints.spawnPoints) {
                if (!spawner.mesh || !spawner.mesh.position) continue;
                const spawnerPos = spawner.mesh.position;
                const dist = npcPos.distanceTo(spawnerPos);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = { type: 'spawner', position: spawnerPos.clone() };
                }
            }
        }

        // Fallback: if no exit found, create a random position away from player
        if (!nearest && window.physics && window.physics.playerCollider) {
            const playerPos = window.physics.playerCollider.position;
            const awayFromPlayer = new THREE.Vector3().subVectors(npcPos, playerPos).normalize();
            awayFromPlayer.multiplyScalar(20); // 20 units away
            const fallbackPos = npcPos.clone().add(awayFromPlayer);
            fallbackPos.y = npcPos.y; // Keep same height
            nearest = { type: 'fallback', position: fallbackPos };
            console.warn('DroidSlayer: No exit found, using fallback position');
        }

        return nearest;
    }

    droidSlayerEscape(npc) {
        // Remove from scene
        window.game.scene.remove(npc.mesh.group);
        const npcIndex = window.game.entities.npcs.indexOf(npc);
        if (npcIndex !== -1) {
            window.game.entities.npcs.splice(npcIndex, 1);
        }

        // Clear active DroidSlayer reference
        this.activeDroidSlayer = null;

        console.log(`DroidSlayer ${npc.name} has escaped!`);
        // DroidSlayer persists via encounterCount - will reappear stronger in another level
    }

    teleportDroidSlayerThroughDoor(npc) {
        const nearestDoor = this.findNearestExit(npc);
        if (!nearestDoor || nearestDoor.type !== 'door') return;

        // Teleport to far side of door
        const doorPos = nearestDoor.position.clone();
        const toPlayer = new THREE.Vector3().subVectors(physics.playerCollider.position, doorPos).normalize();
        const farSide = doorPos.clone().add(toPlayer.multiplyScalar(3.0));

        npc.mesh.group.position.copy(farSide);
        npc.movementCollider.position.copy(farSide);

        // Open the door
        // TODO: Find the actual door entity and call its open method

        // Charge back toward player
        npc.currentState = 'ATTACKING';
        npc.target = physics.playerEntity;
    }

    teleportShadow(npc) {
        // Shadow variant teleports randomly around the battlefield
        const teleportRange = 10.0;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * teleportRange;

        const newPos = npc.mesh.group.position.clone();
        newPos.x += Math.cos(angle) * distance;
        newPos.z += Math.sin(angle) * distance;

        // Make sure it's valid ground
        const groundY = physics.getGroundHeight(newPos.x, newPos.z);
        newPos.y = groundY + (npc.mesh.groundOffset || 0);

        npc.mesh.group.position.copy(newPos);
        npc.movementCollider.position.copy(newPos);

        // Visual effect
        // TODO: Add particle effect
    }

    onPlayerKillNPC(npc) {
        this.killCount++;
    }

    onPlayerDamageNPC(npc, damage) {
        // Cheat mode: instant promotion
        if (this.cheatNextShotMakesDroidSlayer && !this.activeDroidSlayer) {
            this.promoteToDroidSlayer(npc);
            this.cheatNextShotMakesDroidSlayer = false; // Reset cheat
            console.log("Cheat activated: NPC promoted to DroidSlayer!");
        }
    }

    onNPCDamagePlayer(npc, damage) {
        this.playerDamageTaken += damage;

        // Track damage dealt by this NPC
        if (!npc.damageDealtToPlayer) npc.damageDealtToPlayer = 0;
        npc.damageDealtToPlayer += damage;

        if (!npc.damageDealtCount) npc.damageDealtCount = 0;
        npc.damageDealtCount++;
    }

    onNPCKillAlly(npc, ally) {
        npc.recentAllyKill = true;
        setTimeout(() => { npc.recentAllyKill = false; }, 30000); // Flag lasts 30 seconds
    }

    onDroidSlayerTakeDamage(npc, damage) {
        if (!npc.isDroidSlayer) return;

        npc.droidSlayerDamageTaken += damage;

        // Apply variant damage reduction
        if (npc.droidSlayerVariant.damageReduction) {
            return damage * (1 - npc.droidSlayerVariant.damageReduction);
        }

        return damage;
    }

    onDroidSlayerAttack(npc) {
        // Track hits/misses for pathing detection
        // This would be called when the DroidSlayer fires but doesn't hit
    }

    onDroidSlayerHit(npc, target) {
        // Reset miss counter on successful hit
        if (npc.isDroidSlayer) {
            npc.droidSlayerMissedHits = 0;
        }

        // Thief variant steals wire
        if (npc.isDroidSlayer && npc.droidSlayerVariant.wireSteal && target.isPlayer) {
            const stolen = Math.min(npc.droidSlayerVariant.wireSteal, window.game.state.wire);
            window.game.state.wire -= stolen;

            // Show popup (max once per 10 seconds)
            const now = Date.now();
            if (!npc.lastWireStealPopup || now - npc.lastWireStealPopup > 10000) {
                // TODO: Show UI popup "Wire Supply Damaged by DroidSlayer"
                console.log("Wire Supply Damaged by DroidSlayer");
                npc.lastWireStealPopup = now;
            }
        }
    }

    onDroidSlayerMiss(npc) {
        if (npc.isDroidSlayer) {
            npc.droidSlayerHitCounter++;
            if (npc.droidSlayerHitCounter % 4 === 0) {
                npc.droidSlayerMissedHits++;
            }
        }
    }

    // Called when character sheet is opened after DroidSlayer spawns
    showDamagedNodeOnCharacterSheet() {
        if (!this.damagedNode || !this.activeDroidSlayer) return;

        // This would integrate with character_upgrades.js to show the damaged node
        // For now, just log it
        console.log(`Show damaged node: ${this.damagedNode}`);

        // TODO: Add visual overlay on the character sheet showing the damaged node
    }

    // Check if a node is damaged
    isNodeDamaged(nodeId) {
        return this.damagedNode === nodeId && this.activeDroidSlayer;
    }

    // Repair the damaged node (called from end-of-level perk selection)
    repairNode() {
        this.damagedNode = null;
        console.log("DroidSlayer damaged node has been repaired!");
    }

    // Persistence methods
    serialize() {
        if (!this.activeDroidSlayer) return null;

        return {
            npcName: this.activeDroidSlayer.name,
            npcFaction: this.activeDroidSlayer.faction,
            npcBaseType: this.activeDroidSlayer.config.baseType,
            variant: this.activeDroidSlayer.droidSlayerVariant,
            damageTaken: this.activeDroidSlayer.droidSlayerDamageTaken,
            damagedNode: this.damagedNode,
            hasEscaped: this.activeDroidSlayer.mesh.group.parent === null
        };
    }

    deserialize(data) {
        if (!data) return;

        // TODO: Recreate the DroidSlayer in the current level or mark for spawning
        console.log("DroidSlayer persistence data loaded:", data);
        this.damagedNode = data.damagedNode;
    }
}

// Enhanced BlasterBolt for DroidSlayer
class DroidSlayerBolt extends BlasterBolt {
    constructor(startPos, direction, config) {
        super(startPos, direction, config);

        const sizeMultiplier = config.sizeMultiplier || 1.0;
        const brightnessMultiplier = config.brightnessMultiplier || 1.0;
        const speedMultiplier = config.speedMultiplier || 1.0;

        // Scale up the bolt
        this.mesh.scale.multiplyScalar(sizeMultiplier);

        // Increase brightness
        this.mesh.material.emissiveIntensity = brightnessMultiplier;

        if (this.glowSprite) {
            this.glowSprite.scale.multiplyScalar(sizeMultiplier);
            this.glowSprite.material.opacity *= brightnessMultiplier;
        }

        // Increase speed
        this.velocity.multiplyScalar(speedMultiplier);
    }
}

// Initialize global system
window.droidSlayerSystem = new DroidSlayerSystem();
