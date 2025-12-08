// BROWSERFIREFOXHIDE NPCjedi_and_saber_effects.js
// Master controller for all NPC Jedi powers and saber effects

class NPCJediEffects {
    constructor() {
        this.boltReflectionEnabled = true;
    }

    // Check if an NPC can reflect blaster bolts
    canReflectBolt(npc, projectile) {
        // Must have bolt reflection enabled
        if (!npc.boltReflectionChance || npc.boltReflectionChance <= 0) return false;

        // Can only reflect certain weapon types
        const reflectableTypes = ['pistol', 'rifle', 'longarm'];
        if (!projectile.ownerType || projectile.ownerType === 'player') {
            // Check if it's a reflectable weapon
            // For now, assume all player bolts except special ones are reflectable
            if (projectile.isUnique || projectile.isMelee || projectile.isSaber) return false;
        }

        // Roll for reflection chance
        return Math.random() < npc.boltReflectionChance;
    }

    // Reflect a blaster bolt back at the attacker
    reflectBolt(npc, projectile) {
        if (!this.canReflectBolt(npc, projectile)) return false;

        console.log(`${npc.name} reflected a blaster bolt!`);

        // Get reflection direction (back toward shooter)
        const shooter = projectile.owner;
        if (!shooter) return false;

        const shooterPos = shooter.isPlayer
            ? physics.playerCollider.position
            : shooter.mesh.group.position;

        const npcPos = npc.mesh.group.position.clone();
        npcPos.y += 1.0; // Saber height

        // Calculate direction back to shooter
        const direction = new THREE.Vector3().subVectors(shooterPos, npcPos).normalize();

        // Create reflected bolt
        const reflectedBolt = new BlasterBolt(npcPos, direction, {
            owner: npc,
            ownerType: 'npc_reflected',
            damage: projectile.damage || 10
        });

        // Visual effect: make it slightly different color
        if (reflectedBolt.mesh && reflectedBolt.mesh.material) {
            reflectedBolt.mesh.material.color.set(0xff00ff); // Purple for reflected bolts
            reflectedBolt.mesh.material.emissive.set(0xff00ff);
        }

        window.game.entities.projectiles.push(reflectedBolt);

        // Play deflection sound (folder-based random selection)
        if (window.audioSystem) {
            window.audioSystem.playPositionalSoundFromList('saberdeflect', npcPos, 0.8);
        }

        // Visual flash at reflection point
        this.createReflectionFlash(npcPos);

        // Destroy the original bolt
        return true;
    }

    createReflectionFlash(position) {
        // Create a brief flash effect at the reflection point
        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 1.0
        });
        const flash = new THREE.Mesh(geometry, material);
        flash.position.copy(position);
        window.game.scene.add(flash);

        // Fade out and remove
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

    // Check if a bolt should be reflected during collision detection
    checkBoltReflection(projectile, npc) {
        // Only check if NPC has reflection ability
        if (!npc.boltReflectionChance) return false;

        // Check if projectile is close enough to be reflected (within weapon range)
        const dist = projectile.mesh.position.distanceTo(npc.mesh.group.position);
        if (dist > 2.5) return false;

        // Attempt reflection
        if (this.reflectBolt(npc, projectile)) {
            // Mark projectile for removal
            projectile.reflected = true;
            return true;
        }

        return false;
    }

    // Force powers placeholder methods (for future implementation)

    forceHeal(npc, target, amount) {
        // TODO: Implement force heal
        console.log(`${npc.name} uses Force Heal on ${target.name}`);
        if (window.audioSystem) {
            window.audioSystem.playPositionalSound('/data/sounds/force/forceheal.wav', npc.mesh.group.position, 1.0);
        }
    }

    forcePush(npc, targets) {
        // TODO: Implement force push for NPCs
        console.log(`${npc.name} uses Force Push`);
        if (window.audioSystem) {
            window.audioSystem.playPositionalSound('/data/sounds/force/forcepush.wav', npc.mesh.group.position, 1.0);
        }
    }

    mindTrick(npc, target) {
        // TODO: Implement mind trick
        console.log(`${npc.name} uses Mind Trick on ${target.name}`);
        if (window.audioSystem) {
            window.audioSystem.playPositionalSound('/data/sounds/force/mindtrick.wav', npc.mesh.group.position, 1.0);
        }
    }

    forceChoke(npc, target) {
        // TODO: Implement force choke
        console.log(`${npc.name} uses Force Choke on ${target.name}`);
        if (window.audioSystem) {
            window.audioSystem.playPositionalSound('/data/sounds/force/forcechoke.wav', npc.mesh.group.position, 1.0);
        }
    }

    forceLightning(npc, target) {
        // TODO: Implement force lightning
        console.log(`${npc.name} uses Force Lightning on ${target.name}`);
        if (window.audioSystem) {
            window.audioSystem.playPositionalSound('/data/sounds/force/forcelightning.wav', npc.mesh.group.position, 1.0);
        }
    }
}

// Initialize global NPC Jedi effects system
window.npcJediEffects = new NPCJediEffects();
