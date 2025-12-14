// BROWSERFIREFOXHIDE endOfLevelManager.js
// Manages the end-of-level summary screen, stats display, and perk selection.

class EndOfLevelManager {
    constructor() {
        this.container = document.getElementById('end-of-level-container');
        this.statsContainer = document.getElementById('eol-stats-container');
        this.perksContainer = document.getElementById('eol-perks-container');
        this.allyContainer = document.getElementById('eol-ally-container');
        this.continueButton = document.getElementById('eol-continue-button');

        this.perks = [];
        this.resolvePromise = null;
        this.selectedPerks = []; // Track the 2 available perks
        this.keyHandler = null; // Track key handler for cleanup

        this.continueButton.addEventListener('click', () => this.hide());
    }

    async loadPerks() {
        if (this.perks.length > 0) return;
        try {
            const response = await fetch('data/end_of_level_perks.json');
            const data = await response.json();
            this.perks = data.perks;
        } catch (error) {
            console.error("Failed to load end_of_level_perks.json:", error);
        }
    }

    show(stats) {
        // TEMPORARY: DISABLE FOR TESTING
        console.log("BYPASSING END-OF-LEVEL SCREEN...");
        return Promise.resolve();

        return new Promise(async (resolve) => {
            this.resolvePromise = resolve;

            // In the future, we will replace these placeholders with real stats
            const placeholderStats = {
                foesDefeated: Math.floor(Math.random() * 20),
                spawnersSliced: Math.floor(Math.random() * 3),
                alliesMade: Math.floor(Math.random() * 2),
                friendsMade: Math.floor(Math.random() * 5),
                factionChanges: [{ faction: 'Rebels', change: '+5 Friendship' }, { faction: 'Imperials', change: '+9 Conflict' }],
                damageTaken: Math.floor(Math.random() * 100),
                powerUsed: Math.floor(Math.random() * 500),
                timeTaken: `${Math.floor(Math.random() * 10)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
                wireBonus: Math.random() > 0.5 ? 50 : 0,
            };

            this.populateStats(placeholderStats);
            this.populateAllies();
            await this.loadPerks();
            this.populatePerks();

            // Setup Q/E keybinds
            this.setupKeybinds();

            this.container.style.display = 'flex';
        });
    }

    hide() {
        this.container.style.display = 'none';
        // Remove key handler
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
        if (this.resolvePromise) {
            this.resolvePromise();
            this.resolvePromise = null;
        }
    }

    setupKeybinds() {
        // Remove old handler if exists
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
        }

        // Create new handler
        this.keyHandler = (e) => {
            if (e.key === 'q' || e.key === 'Q') {
                e.preventDefault();
                if (this.selectedPerks[0]) {
                    this.applyPerk(this.selectedPerks[0]);
                }
            } else if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                if (this.selectedPerks[1]) {
                    this.applyPerk(this.selectedPerks[1]);
                }
            }
        };

        document.addEventListener('keydown', this.keyHandler);
    }

    populateStats(stats) {
        this.statsContainer.innerHTML = `
    <h2>Level Complete</h2>
    <p>Foes Defeated: ${stats.foesDefeated}</p>
    <p>Spawners Sliced: ${stats.spawnersSliced}</p>
    <p>Allies Made: ${stats.alliesMade}</p>
    <p>Friends Made: ${stats.friendsMade}</p>
    <p>Damage Taken: ${stats.damageTaken}</p>
    <p>Power Used: ${stats.powerUsed}</p>
    <p>Time Taken: ${stats.timeTaken}</p>
    <p>Speed Bonus: ${stats.wireBonus} wire</p>
    <hr>
    <p>Faction Relationship Changes:</p>
    ${stats.factionChanges.map(c => `<span>${c.faction}: ${c.change}</span>`).join('<br>')}
    <hr>
    <p><em>Collect Faction Award TBD</em></p>
`;
    }

    populateAllies() {
        this.allyContainer.innerHTML = '<h3>Party Management</h3>';
        if (window.game && window.game.state.allies.length > 0) {
            window.game.state.allies.forEach(ally => {
                const allyDiv = document.createElement('div');
                allyDiv.className = 'eol-ally';
                allyDiv.innerHTML = `
            <span>${ally.npc.name} (Health: ${ally.npc.health.toFixed(0)}/${ally.npc.maxHealth})</span>
            <button data-ally-id="${ally.npc.mesh.group.uuid}">Dismiss</button>
        `;
                this.allyContainer.appendChild(allyDiv);
            });
        } else {
            this.allyContainer.innerHTML += '<p>No active allies.</p>';
        }
    }

    populatePerks() {
        let availablePerks = [...this.perks];
        const chosenPerks = [];

        // Check if DroidSlayer has damaged a node - if so, always include repair perk
        const hasDamagedNode = window.droidSlayerSystem && window.droidSlayerSystem.damagedNode;
        if (hasDamagedNode) {
            const repairPerk = availablePerks.find(p => p.id === 'repair_damaged_node');
            if (repairPerk) {
                chosenPerks.push(repairPerk);
                availablePerks = availablePerks.filter(p => p.id !== 'repair_damaged_node');
            }
        } else {
            // Remove repair perk from available pool if no damaged node
            availablePerks = availablePerks.filter(p => p.id !== 'repair_damaged_node');
        }

        // Select random perks to fill remaining slots (total 2 perks)
        const remainingSlots = 2 - chosenPerks.length;
        for (let i = 0; i < remainingSlots && availablePerks.length > 0; i++) {
            const randIndex = Math.floor(Math.random() * availablePerks.length);
            chosenPerks.push(availablePerks.splice(randIndex, 1)[0]);
        }

        this.selectedPerks = chosenPerks;

        // Compact, single-screen layout with Q/E keybinds
        this.perksContainer.innerHTML = `
    <div style="display: flex; gap: 20px; width: 100%; height: 100%; align-items: center; justify-content: center;">
        ${chosenPerks.map((perk, index) => `
            <div class="eol-perk-option" style="flex: 1; padding: 20px; background: rgba(0,255,0,0.1); border: 3px solid #0f0; cursor: pointer; text-align: center;" onclick="window.endOfLevelManager.applyPerk(window.endOfLevelManager.selectedPerks[${index}])">
                <div style="color: #ff0; font-size: 32px; font-weight: bold; margin-bottom: 10px;">[${index === 0 ? 'Q' : 'E'}]</div>
                <h3 style="color: #0ff; margin-bottom: 10px; font-size: 18px;">${perk.title}</h3>
                <p style="color: #0f0; font-size: 14px; line-height: 1.4;">${perk.description}</p>
            </div>
        `).join('')}
    </div>
`;
    }

    applyPerk(perk) {
        console.log(`Applying perk: ${perk.id}`);

        switch (perk.id) {
            case 'repair_damaged_node':
                if (window.droidSlayerSystem) {
                    window.droidSlayerSystem.repairNode();
                    this.showPerkMessage('Node repaired! You can now purchase it again.', '#0f0');
                }
                break;

            case 'heal_self_for_wire':
                // Calculate cost and apply heal
                const healthDeficit = window.game.state.playerStats.max_health - window.game.state.health;
                const percentDeficit = (healthDeficit / window.game.state.playerStats.max_health) * 100;
                const cost = Math.ceil(percentDeficit / 2);

                if (window.game.state.wire >= cost) {
                    window.game.state.wire -= cost;
                    window.game.state.health = window.game.state.playerStats.max_health;
                    this.showPerkMessage(`Healed to full! Cost: ${cost} wire.`, '#0f0');
                } else {
                    this.showPerkMessage(`Not enough wire! Need ${cost}, have ${window.game.state.wire}.`, '#f00');
                    return; // Don't close screen
                }
                break;

            case 'heal_top_allies':
                // Heal two most injured allies
                const allies = window.game.state.allies
                    .filter(a => !a.isDeadAlly && a.npc && !a.npc.isDead)
                    .sort((a, b) => {
                        const aHealthPercent = a.npc.health / a.npc.maxHealth;
                        const bHealthPercent = b.npc.health / b.npc.maxHealth;
                        return aHealthPercent - bHealthPercent;
                    });

                for (let i = 0; i < Math.min(2, allies.length); i++) {
                    allies[i].npc.health = allies[i].npc.maxHealth;
                }
                this.showPerkMessage(`Healed ${Math.min(2, allies.length)} allies to full health!`, '#0f0');
                break;

            case 'temp_speed_boost':
                // Apply temporary speed boost
                // TODO: Implement temporary buff system
                if (!window.game.state.playerStats.tempSpeedBoostLevels) {
                    window.game.state.playerStats.tempSpeedBoostLevels = 0;
                }
                window.game.state.playerStats.tempSpeedBoostLevels += 3;
                this.showPerkMessage('Speed boost applied for 3 ships!', '#0f0');
                break;

            default:
                console.warn(`Unknown perk: ${perk.id}`);
        }

        // Close the end-of-level screen after applying perk (with small delay for message)
        setTimeout(() => this.hide(), 1500);
    }

    showPerkMessage(message, color) {
        // Create overlay message element
        const messageDiv = document.createElement('div');
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '50%';
        messageDiv.style.left = '50%';
        messageDiv.style.transform = 'translate(-50%, -50%)';
        messageDiv.style.background = 'rgba(0,0,0,0.9)';
        messageDiv.style.border = `3px solid ${color}`;
        messageDiv.style.padding = '30px';
        messageDiv.style.color = color;
        messageDiv.style.fontSize = '24px';
        messageDiv.style.fontFamily = 'monospace';
        messageDiv.style.fontWeight = 'bold';
        messageDiv.style.textAlign = 'center';
        messageDiv.style.zIndex = '10000';
        messageDiv.textContent = message;

        document.body.appendChild(messageDiv);

        // Remove after delay
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 1400);
    }
}
