// BROWSERFIREFOXHIDE Gonkjedi_and_saber_effects.js
// Player (Gonk) Jedi powers and saber effects

class GonkJediEffects {
    constructor() {
        this.boltReflectionEnabled = false; // Requires node unlock
        this.boltReflectionChance = 0.0; // Base chance, increased by nodes
        this.reflectionPerfectAimEnabled = false; // Returns bolt to sender
        this.forceHealEnabled = false;
        this.mindTrickEnabled = false;
    }

    // Enable bolt reflection (called from character upgrade node)
    unlockBoltReflection(baseChance = 0.3) {
        this.boltReflectionEnabled = true;
        this.boltReflectionChance = baseChance;
        console.log(`Gonk unlocked Bolt Reflection at ${baseChance * 100}% chance`);
    }

    // Upgrade bolt reflection chance
    upgradeBoltReflection(bonusChance) {
        this.boltReflectionChance = Math.min(1.0, this.boltReflectionChance + bonusChance);
        console.log(`Gonk Bolt Reflection upgraded to ${this.boltReflectionChance * 100}%`);
    }

    // Enable perfect aim for reflections
    unlockPerfectReflection() {
        this.reflectionPerfectAimEnabled = true;
        console.log('Gonk unlocked Perfect Reflection');
    }

    // Check if player can reflect incoming bolt
    canReflectBolt(projectile) {
        if (!this.boltReflectionEnabled) return false;
        if (!window.game || !window.game.state) return false;

        // Must have saber equipped
        const activeSaber = window.playerWeaponSystem &&
            window.playerWeaponSystem.activeWeapon &&
            window.playerWeaponSystem.activeWeapon.config.category === 'saberhiltoverlayer';

        if (!activeSaber) return false;

        // Can only reflect certain weapon types
        if (projectile.ownerType === 'player') return false; // Can't reflect own shots
        if (projectile.isMelee || projectile.isSaber || projectile.isUnique) return false;

        // Check if we're facing the bolt (need to be looking roughly toward it)
        const camera = window.game.camera;
        const playerPos = physics.playerCollider.position;
        const boltPos = projectile.mesh.position;

        const toBolt = new THREE.Vector3().subVectors(boltPos, playerPos).normalize();
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);

        const dot = cameraDir.dot(toBolt);
        if (dot < 0) return false; // Bolt is behind us

        // Roll for reflection
        return Math.random() < this.boltReflectionChance;
    }

    // Reflect a bolt
    reflectBolt(projectile) {
        if (!this.canReflectBolt(projectile)) return false;

        console.log('Gonk reflected a blaster bolt!');

        const playerPos = physics.playerCollider.position.clone();
        playerPos.y += 0.5; // Saber height

        let direction;

        if (this.reflectionPerfectAimEnabled && projectile.owner) {
            // Perfect aim: return to sender
            const shooterPos = projectile.owner.mesh
                ? projectile.owner.mesh.group.position
                : projectile.owner.position;

            direction = new THREE.Vector3().subVectors(shooterPos, playerPos).normalize();
        } else {
            // Imperfect aim: general direction but with spread
            const camera = window.game.camera;
            direction = new THREE.Vector3();
            camera.getWorldDirection(direction);

            // Add some random spread
            const spread = 0.2 * (1 - this.boltReflectionChance); // Less spread at higher skill
            direction.x += (Math.random() - 0.5) * spread;
            direction.y += (Math.random() - 0.5) * spread;
            direction.z += (Math.random() - 0.5) * spread;
            direction.normalize();
        }

        // Create reflected bolt
        const reflectedBolt = new BlasterBolt(playerPos, direction, {
            owner: physics.playerEntity,
            ownerType: 'player_reflected',
            damage: projectile.damage || 10
        });

        // Make it visually distinct
        if (reflectedBolt.mesh && reflectedBolt.mesh.material) {
            reflectedBolt.mesh.material.color.set(0x00ff00); // Green for player reflections
            reflectedBolt.mesh.material.emissive.set(0x00ff00);
        }

        window.game.entities.projectiles.push(reflectedBolt);

        // Play deflection sound (folder-based random selection)
        if (window.audioSystem) {
            window.audioSystem.playSoundFromList('saberdeflect', 0.8);
        }

        // Visual flash
        this.createReflectionFlash(playerPos);

        return true;
    }

    createReflectionFlash(position) {
        // Create flash effect
        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 1.0
        });
        const flash = new THREE.Mesh(geometry, material);
        flash.position.copy(position);
        window.game.scene.add(flash);

        // Fade out
        let opacity = 1.0;
        const fadeInterval = setInterval(() => {
            opacity -= 0.1;
            if (opacity <= 0) {
                clearInterval(fadeInterval);
                window.game.scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
            } else {
                flash.material.opacity = opacity;
            }
        }, 30);
    }

    // Check bolt reflection during game loop
    checkPlayerBoltReflection(projectile) {
        // Only check for enemy projectiles
        if (projectile.ownerType === 'player' || projectile.ownerType === 'ally') return false;

        // Check distance to player
        const dist = projectile.mesh.position.distanceTo(physics.playerCollider.position);
        if (dist > 2.5) return false;

        // Attempt reflection
        if (this.reflectBolt(projectile)) {
            projectile.reflected = true;
            return true;
        }

        return false;
    }

    // Force Heal (activated via keybind or menu)
    useForceHeal() {
        if (!this.forceHealEnabled) return false;

        const energyCost = 100;
        if (window.game.state.energy < energyCost) {
            console.log('Not enough energy for Force Heal');
            return false;
        }

        // Consume energy
        window.game.state.energy -= energyCost;

        // Heal player
        const healAmount = 50;
        window.game.state.health = Math.min(
            window.game.state.playerStats.max_health,
            window.game.state.health + healAmount
        );

        console.log(`Force Heal restored ${healAmount} HP`);

        // Visual/audio feedback
        if (window.audioSystem) {
            window.audioSystem.playSound('forceheal', 1.0);
        }

        return true;
    }

    // Mind Trick (activated via keybind, affects targeted NPC)
    useMindTrick(targetNPC) {
        if (!this.mindTrickEnabled) return false;

        const energyCost = 75;
        if (window.game.state.energy < energyCost) {
            console.log('Not enough energy for Mind Trick');
            return false;
        }

        if (!targetNPC || targetNPC.isDead) return false;

        // Consume energy
        window.game.state.energy -= energyCost;

        // Apply mind trick effect (confuse, ignore player temporarily)
        targetNPC.mindTricked = true;
        targetNPC.mindTrickDuration = 10.0; // seconds

        console.log(`Mind Trick used on ${targetNPC.name}`);

        // Visual/audio feedback
        if (window.audioSystem) {
            window.audioSystem.playPositionalSound('/data/sounds/force/mindtrick.wav', targetNPC.mesh.group.position, 1.0);
        }

        return true;
    }

    // Update function (called from game loop)
    update(deltaTime) {
        // Update mind trick durations
        if (window.game && window.game.entities) {
            window.game.entities.npcs.forEach(npc => {
                if (npc.mindTricked) {
                    npc.mindTrickDuration -= deltaTime;
                    if (npc.mindTrickDuration <= 0) {
                        npc.mindTricked = false;
                        console.log(`Mind Trick wore off on ${npc.name}`);
                    }
                }
            });
        }
    }
}

// Initialize global Gonk Jedi effects system
window.gonkJediEffects = new GonkJediEffects();
