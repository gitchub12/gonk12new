// BROWSERFIREFOXHIDE character_upgrades.js

class CharacterUpgrades {
    constructor() {
        this.nodes = [];
        this.purchasedNodes = new Set(); // Stores "nodeId" for single nodes, or "nodeId:level" for stacked? 
        // Actually, let's store "nodeId" in purchasedNodes to mean "at least one level purchased".
        // And a separate map for levels? Or just store "nodeId:level" strings?
        // Let's use a Map for node levels: nodeId -> currentLevel (0 if not purchased)
        this.nodeLevels = new Map();

        this.pendingPurchases = new Map(); // nodeId -> level to purchase
        this.loadNodes();
        this.nodeImageCache = new Map();

        // Auto-unlock all Carry powers for testing
        this.autoUnlockCarryPowers();

        // Setup UI button handlers
        this.setupButtonHandlers();

        // Listen for D20/Character Sheet toggle
        this.d20SheetVisible = false;

        // Ensure we bind the tooltip to follow cursor if active (for the character sheet tooltips)
        document.addEventListener('mousemove', (e) => {
            const tooltip = document.getElementById('module-tooltip');
            if (tooltip && tooltip.style.display === 'block') {
                // Offset slightly so cursor doesn't cover text
                const offsetX = 15;
                const offsetY = 15;

                let left = e.clientX + offsetX;
                let top = e.clientY + offsetY;

                // Boundary checks
                if (left + tooltip.offsetWidth > window.innerWidth) {
                    left = e.clientX - tooltip.offsetWidth - offsetX;
                }
                if (top + tooltip.offsetHeight > window.innerHeight) {
                    top = e.clientY - tooltip.offsetHeight - offsetY;
                }

                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
            }
        });
    }

    getModuleData() {
        if (window.moduleManager && window.moduleManager.modules) {
            return window.moduleManager.modules;
        }
        return {};
    }

    getClassStartingModules(className) {
        if (!className) return [];
        // Normalized map - keys match standard class names
        const startingModules = {
            'Gonk': ['Intimidate', 'Repair', 'Running', 'Climb', 'Pamphlet Toss', 'Scavenge'],
            'Hunter Killer': ['Intimidate', 'Jump 3', 'Repair', 'Running 3', 'HK Quickcharge 5'],
            'Protocol': ['Jump 3', 'Persuasion', 'Perception', 'Medicine', 'Repair', 'Slicing', 'Speak Languages', 'Pamphlet Toss'],
            'Techie': ['Climb', 'Medicine', 'Repair', 'Slicing', 'Insight', 'Craft', 'Scavenge'],
            'Slicer': ['Climb', 'Medicine', 'Repair', 'Slicing', 'Insight', 'Craft', 'Scavenge'],
            'Adept': ['Perception', 'Jump 3', 'Persuasion', 'Medicine', 'Force Heal']
        };

        // Handle case-insensitive or loose matching
        const key = Object.keys(startingModules).find(k => k.toLowerCase() === className.toLowerCase() || k.toLowerCase().replace(' ', '') === className.toLowerCase().replace(' ', ''));
        return startingModules[key] || [];
    }

    updateD20Display() {
        const statsDisplay = document.getElementById('stats-display');
        const moduleGrid = document.getElementById('module-grid');
        const cs = window.characterStats;

        if (!statsDisplay || !moduleGrid || !cs) return;

        // --- 1. POPULATE STATS SIDEBAR (Perfect Layout Restoration) ---
        const stats = cs.stats || { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };

        // Helper to calc mod
        const getMod = (val) => Math.floor((val - 10) / 2);
        const mods = {
            STR: getMod(stats.STR), DEX: getMod(stats.DEX), CON: getMod(stats.CON),
            INT: getMod(stats.INT), WIS: getMod(stats.WIS), CHA: getMod(stats.CHA)
        };

        const level = cs.level || 1;
        const currentHp = Math.floor(window.game?.state?.health || cs.hp || 0);
        const maxHp = cs.maxHp || 100;
        const currentEnergy = Math.floor(window.game?.state?.energy || 0);
        const maxEnergy = cs.maxEnergy || 100;
        const regenRate = cs.energyRegenRate || 20;
        const wire = window.game?.state?.wire || 0;
        const credits = window.game?.state?.credits || 0;

        const displayClass = (cs.currentClass === 'Techie') ? 'SLICER' : (cs.currentClass || 'GONK').toUpperCase();

        // Header Update (if element exists outside stats-display)
        const headerTitle = document.getElementById('char-sheet-title');
        if (headerTitle) headerTitle.textContent = `${displayClass} GONK`;

        statsDisplay.innerHTML = `
            <!-- STATS BLOCK -->
            <div style="margin-bottom: 30px; width: 100%;">
                <style>
                    .stat-row { position: relative; cursor: default; margin-bottom: 5px; }
                    .stat-row:hover .stat-tooltip { display: block; }
                    .stat-tooltip {
                        display: none; position: absolute; left: 100%; top: 0;
                        width: 200px; background: rgba(0,0,0,0.9); border: 1px solid #0ff;
                        color: #fff; font-size: 12px; padding: 10px; z-index: 1000;
                        border-radius: 4px; margin-left: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.5);
                        pointer-events: none; font-weight: normal; line-height: 1.4; text-align: left;
                    }
                </style>
                <div style="font-size: 24px; line-height: 1.8; font-weight: bold;">
                    <div class="stat-row" style="display: flex; justify-content: space-between;">
                        <span style="color: #0ff;">STR</span> 
                        <span style="color: #fff;">${stats.STR} (${mods.STR >= 0 ? '+' : ''}${mods.STR})</span>
                        <div class="stat-tooltip">Melee Damage bonus equal to the modifier. Weight limit for wielding is 15 pounds per point.</div>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between;">
                        <span style="color: #0ff;">DEX</span> 
                        <span style="color: #fff;">${stats.DEX} (${mods.DEX >= 0 ? '+' : ''}${mods.DEX})</span>
                        <div class="stat-tooltip">Ranged Attack bonus. Reflex Save bonus. Armor Class bonus. Affects accuracy with blasters/dodging.</div>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between;">
                        <span style="color: #0ff;">CON</span> 
                        <span style="color: #fff;">${stats.CON} (${mods.CON >= 0 ? '+' : ''}${mods.CON})</span>
                        <div class="stat-tooltip">Hit Point bonus per level. Stamina and resistance to physical trauma.</div>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between;">
                        <span style="color: #0ff;">INT</span> 
                        <span style="color: #fff;">${stats.INT} (${mods.INT >= 0 ? '+' : ''}${mods.INT})</span>
                        <div class="stat-tooltip">Skill points per level. Bonus to Energy Max (+5 per modifier). Essential for Slicing/Repair.</div>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between;">
                        <span style="color: #0ff;">WIS</span> 
                        <span style="color: #fff;">${stats.WIS} (${mods.WIS >= 0 ? '+' : ''}${mods.WIS})</span>
                        <div class="stat-tooltip">Willpower Save bonus. Bonus to Regen (+0.5/sec per mod) and Max Energy (+5 per mod). Force power critical.</div>
                    </div>
                    <div class="stat-row" style="display: flex; justify-content: space-between;">
                        <span style="color: #0ff;">CHA</span> 
                        <span style="color: #fff;">${stats.CHA} (${mods.CHA >= 0 ? '+' : ''}${mods.CHA})</span>
                        <div class="stat-tooltip">Social skill bonus. Affects Force Power effectiveness and leadership.</div>
                    </div>
                </div>
            </div>

            <!-- VITALS BLOCK -->
            <div style="margin-bottom: 40px; width: 100%;">
                <div class="stat-row" style="color: #ff3333; font-size: 24px; font-weight: bold; margin-bottom: 10px; display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 5px;">
                    <span>HEALTH</span>
                    <span style="color: #fff;">${currentHp} / ${maxHp}</span>
                    <div class="stat-tooltip">Health Points (HP).<br>Determined by Constitution stats, Level, and Armor.</div>
                </div>
                <div class="stat-row" style="color: #00ffff; font-size: 24px; font-weight: bold; margin-bottom: 10px; display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 5px;">
                    <span>ENERGY</span>
                    <span style="color: #fff;">${maxEnergy}</span>
                    <div class="stat-tooltip">Energy Capacity.<br>Available energy for abilities.<br>Increased by Intelligence and Level.</div>
                </div>
                <div class="stat-row" style="color: #33ff33; font-size: 20px; font-weight: bold; display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 5px;">
                    <span>POWER/SEC</span>
                    <span style="color: #fff;">${regenRate.toFixed(1)}</span>
                    <div class="stat-tooltip">Energy Regeneration Rate.<br>Energy restored per second.<br>Increased by Wisdom and Modules.</div>
                </div>
            </div>

             <!-- LEVEL INFO -->
            <div style="margin-bottom: 30px; width: 100%; text-align: center;">
                <div style="color: #ff0; font-size: 28px; font-weight: bold; text-shadow: 0 0 10px #ff0;">LEVEL ${level}</div>
            </div>

            <!-- RESOURCES BLOCK -->
            <div style="margin-top: auto; width: 100%; border-top: 2px solid #333; padding-top: 20px;">
                <div class="stat-row" style="display: flex; align-items: center; margin-bottom: 20px;">
                    <img src="data/pngs/HUD/CharacterSheet/scrapsymbol.png" style="width: 50px; height: 50px; margin-right: 20px;">
                    <span style="font-size: 36px; color: #e0e0e0; font-weight: bold; text-shadow: 0 0 5px #fff;">${wire}</span>
                    <div class="stat-tooltip">Scrap.<br>Used for crafting and upgrading modules.</div>
                </div>
                <div class="stat-row" style="display: flex; align-items: center;">
                    <img src="data/pngs/HUD/CharacterSheet/creditssymbol.png" style="width: 50px; height: 50px; margin-right: 20px;">
                    <span style="font-size: 36px; color: #ffd700; font-weight: bold; text-shadow: 0 0 5px #ff0;">${credits}</span>
                    <div class="stat-tooltip">Credits.<br>Used for purchasing items and services.</div>
                </div>
            </div>
        `;

        // --- 2. POPULATE MODULE GRID (Combined Logic) ---
        // Restore Grid Layout using Flexbox to guarantee wrapping and NO scrollbars
        moduleGrid.style.cssText = `
            display: flex; flex-wrap: wrap; justify-content: center;
            gap: 15px; padding: 10px; width: 100%;
            height: auto; overflow: visible;
        `;
        moduleGrid.innerHTML = '';

        // Gather modules
        const classStartIds = this.getClassStartingModules(cs.currentClass);
        const activeIds = window.moduleManager?.activeModules || [];

        // Combine, removing filtered
        const allModuleStrings = [...classStartIds, ...activeIds]
            .filter(id => id && !id.includes('extra_memory_core'));

        // Parse Logic: Aggregating "Jump 3" into { name: 'Jump', level: 3 }
        const moduleCounts = {};

        allModuleStrings.forEach(modStr => {
            // Check for "Name X" format
            const match = modStr.match(/^(.+?)\s+(\d+)$/);
            if (match) {
                const name = match[1];
                const lvl = parseInt(match[2]);
                moduleCounts[name] = (moduleCounts[name] || 0) + lvl;
            } else {
                // Just a name or ID
                moduleCounts[modStr] = (moduleCounts[modStr] || 0) + 1;
            }
        });

        // If strict unique slot limit needed, slicing might be required, but display all unique for now
        // But limited to 24 slots visual
        const uniqueKeys = Object.keys(moduleCounts);

        // Create Cards
        uniqueKeys.slice(0, 24).forEach(modKey => {
            const count = moduleCounts[modKey];
            const modData = window.moduleManager?.modules?.[modKey] || { name: modKey, faction: null, description: 'Unknown Module' };
            let faction = modData.faction;

            // FORCE GONK FACTION FOR BASE MODULES
            const gonkBaseModules = [
                'Intimidate', 'Repair', 'Running', 'Climb', 'Pamphlet Toss', 'Scavenge',
                'Jump', 'HK Quickcharge', 'Persuasion', 'Perception', 'Medicine',
                'Slicing', 'Speak Languages', 'Insight', 'Craft', 'Force Heal'
            ];

            const checkKey = modKey.replace(/_/g, ' ').toLowerCase();
            const checkName = (modData.name || '').replace(/_/g, ' ').toLowerCase();

            const isGonk = gonkBaseModules.some(base => {
                const baseLower = base.toLowerCase();
                return checkKey.startsWith(baseLower) || checkName.startsWith(baseLower);
            });

            if (isGonk) {
                faction = 'gonk';
            }

            // Faction Fallback Logic (if not already set to gonk or valid)
            if ((!faction || faction === 'neutral') && !isGonk) {
                const nameLower = (modData.name || modKey).toLowerCase();
                if (nameLower.includes('clone') || nameLower.includes('republic')) faction = 'clones';
                else if (nameLower.includes('mandalorian')) faction = 'mandalorians';
                else if (nameLower.includes('droid') || nameLower.includes('hk')) faction = 'droids';
                else if (nameLower.includes('rebel')) faction = 'rebels';
                else if (nameLower.includes('imperial')) faction = 'imperials';
                else if (nameLower.includes('sith')) faction = 'sith';
                else faction = 'neutral';
            }

            // Card Creation (Root Style) - Updated Size & No Scrollbars
            const card = document.createElement('div');
            card.className = 'module-card';
            card.style.cssText = `
                position: relative; width: 140px; height: 160px;
                background: rgba(0,0,0,0.8); border: 2px solid #444; border-radius: 5px;
                display: flex; flex-direction: column; align-items: center; padding: 0;
                box-sizing: border-box; transition: border-color 0.2s;
                flex-shrink: 0; /* Prevent shrinking in flex container */
                cursor: default !important; /* Added cursor style */
            `;

            const getFactionColor = (f) => {
                switch (f?.toLowerCase()) {
                    case 'rebels': case 'rebel': return '#d94242';
                    case 'imperials': case 'imperial': return '#ffffff';
                    case 'aliens': case 'alien': return '#00ff00';
                    case 'droids': case 'droid': return '#003366'; // Regular Dark Blue
                    case 'gonk': return '#001a4d'; // Darker Deep Blue for Base Classes
                    case 'clones': case 'clone': return '#ff8c00';
                    case 'mandalorians': case 'mandalorian': return '#ffd700'; // Yellow for Mandos
                    case 'sith': return '#990000';
                    case 'takers': case 'taker': return '#C0C0C0';
                    default: return '#888';
                }
            };

            const factionColor = getFactionColor(faction);
            card.style.borderColor = factionColor;

            // Determine text color based on background brightness
            // Simple heuristic: lighter colors get black text, dark get white
            const isLightColor = (color) => {
                // Handle named colors or known hex
                if (color === '#ffffff' || color === '#ffd700' || color === '#ff8c00' || color === '#00ff00' || color === '#00d2ff' || color === '#C0C0C0') return true;
                return false;
            };
            const badgeTextColor = isLightColor(factionColor) ? '#000' : '#fff';
            const badgeBorderColor = isLightColor(factionColor) ? '#fff' : '#000';

            // Icon - Fills width, aligned top
            const iconDiv = document.createElement('div');
            iconDiv.style.cssText = `
                width: 100%; height: 125px; /* Leaves 35px for text */
                background-image: url('data/pngs/MODULES/${modKey}.png'), url('data/pngs/MODULES/placeholder.png'); 
                background-size: cover; background-position: top center;
                border-bottom: 1px solid #333;
                border-radius: 3px 3px 0 0;
            `;

            // Faction Colored Rank Badge
            const rankBadge = document.createElement('div');
            rankBadge.textContent = count;
            rankBadge.style.cssText = `
                position: absolute; bottom: 5px; right: 5px; 
                background: ${factionColor}; color: ${badgeTextColor}; 
                font-weight: bold; border-radius: 50%;
                width: 24px; height: 24px; display: flex; align-items: center;
                justify-content: center; font-size: 14px; 
                border: 1px solid ${badgeBorderColor};
                z-index: 20; box-shadow: 0 0 3px #000;
                cursor: default; /* Added cursor style */
            `;

            // Name
            const nameDiv = document.createElement('div');
            nameDiv.textContent = modData.name || modKey;
            nameDiv.style.cssText = `
                font-size: 12px; text-align: center; color: ${factionColor};
                font-weight: bold; line-height: 1.1; height: 35px; width: 100%;
                display: flex; align-items: flex-end; /* Changed to flex-end */
                justify-content: center;
                overflow: hidden; padding: 0 5px 2px 5px; /* Added padding-bottom */
                box-sizing: border-box;
                position: absolute; bottom: 0; left: 0;
                cursor: default; /* Added cursor style */
            `;

            card.appendChild(iconDiv);
            card.appendChild(rankBadge);
            card.appendChild(nameDiv);

            // Hover Events
            card.addEventListener('mouseenter', () => {
                const tooltip = document.getElementById('module-tooltip');
                const ttName = document.getElementById('tooltip-module-name');
                const ttDesc = document.getElementById('tooltip-module-description');
                const ttEffects = document.getElementById('tooltip-module-effects');

                if (tooltip && ttName && ttDesc && ttEffects) {
                    // 1. Calculate Rarity
                    let rarity = "Common";
                    if (count >= 12) rarity = "Unique";
                    else if (count >= 11) rarity = "Legendary";
                    else if (count >= 10) rarity = "Epic";
                    else if (count >= 7) rarity = "Rare";
                    else if (count >= 4) rarity = "Uncommon";

                    // 2. Format Faction Adjective
                    let factionAdj = "Standard";
                    switch (faction?.toLowerCase()) {
                        case 'gonk': factionAdj = "Gonk"; break;
                        case 'droids': case 'droid': factionAdj = "Droid"; break;
                        case 'aliens': case 'alien': factionAdj = "Alien"; break;
                        case 'clones': case 'clone': factionAdj = "Clone"; break;
                        case 'mandalorians': case 'mandalorian': factionAdj = "Mandalorian"; break;
                        case 'rebels': case 'rebel': factionAdj = "Rebel"; break;
                        case 'imperials': case 'imperial': factionAdj = "Imperial"; break;
                        case 'sith': factionAdj = "Sith"; break;
                        case 'takers': case 'taker': factionAdj = "Taker"; break;
                        default: factionAdj = "Standard";
                    }

                    // 3. Construct Header
                    const headerHtml = `
                        <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; color: ${factionColor}; border-bottom: 1px solid #555; padding-bottom: 4px; width: 100%;">
                            ${rarity} ${factionAdj} Module
                        </div>
                    `;

                    // Force vertical stacking
                    ttName.style.display = 'flex';
                    ttName.style.flexDirection = 'column';
                    ttName.style.alignItems = 'flex-start';
                    ttName.style.width = '100%';

                    ttName.innerHTML = `
                        ${headerHtml}
                        <div style="margin-top: 2px; color: #fff; width: 100%; text-align: left;">
                            <span style="font-size: 14px; font-weight: bold;">${modData.name || modKey}</span>
                            <span style="font-size: 0.8em; color: #ccc; margin-left: 5px;">(Rank ${count})</span>
                        </div>
                    `;
                    // Note: ttName color styling is overridden by inner elements, which is intended

                    let desc = modData.description || "No description available.";
                    ttDesc.innerHTML = desc.replace(/\n/g, '<br>');

                    let effectsHtml = '';
                    if (modData.effects) {
                        effectsHtml += '<strong>Effects:</strong><br>';
                        for (const key in modData.effects) {
                            if (typeof modData.effects[key] === 'object') continue;
                            effectsHtml += `${key}: ${modData.effects[key]}<br>`;
                        }
                    }
                    ttEffects.innerHTML = effectsHtml;

                    tooltip.style.display = 'block';
                    tooltip.style.borderColor = factionColor;
                }
            });

            card.addEventListener('mouseleave', () => {
                const tooltip = document.getElementById('module-tooltip');
                if (tooltip) tooltip.style.display = 'none';
            });

            moduleGrid.appendChild(card);
        });

        // Fill empty slots visually
        const emptySlots = 24 - uniqueKeys.length;
        for (let i = 0; i < emptySlots; i++) {
            const emptyCard = document.createElement('div');
            emptyCard.style.cssText = `
                width: 140px; height: 160px; border: 2px solid #333;
                background: rgba(0,0,0,0.3); box-sizing: border-box;
            `;
            moduleGrid.appendChild(emptyCard);
        }
    }

    autoUnlockCarryPowers() {
        // Wait for nodes AND game state to load, then unlock all carry powers
        const checkReady = setInterval(() => {
            if (this.nodes.length > 0 && window.game && window.game.state && window.game.state.playerStats) {
                clearInterval(checkReady);

                // Find and auto-purchase all carry nodes (including carry_uniques)
                const carryNodes = ['storage_starter', 'carry_pistol', 'carry_rifle', 'carry_longarm', 'carry_uniques', 'carry_saber'];
                carryNodes.forEach(nodeId => {
                    const node = this.nodes.find(n => n.id === nodeId);
                    if (node) {
                        this.setNodeLevel(nodeId, 1);
                        this.applyNodeEffects(node, 1);
                    }
                });
                console.log('Auto-unlocked Carry powers for testing');

                // Auto-unlock social training and pamphlet speed
                const socialNode = this.nodes.find(n => n.id === 'social_starter');
                if (socialNode) {
                    this.setNodeLevel('social_starter', 1);
                    this.applyNodeEffects(socialNode, 1);
                    console.log('Auto-unlocked Social Training');
                }

                const pamphletSpeedNode = this.nodes.find(n => n.id === 'pamphlet_speed_1');
                if (pamphletSpeedNode) {
                    this.setNodeLevel('pamphlet_speed_1', 1);
                    this.applyNodeEffects(pamphletSpeedNode, 1);
                    console.log('Auto-unlocked Pamphlet Speed');
                }
            }
        }, 100);
    }

    setupButtonHandlers() {
        // Close button handler - CLONE to strip ghosts
        let closeBtn = document.getElementById('upgrade-close-btn');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            closeBtn = newCloseBtn; // Update reference

            closeBtn.onclick = (e) => {
                e.preventDefault();
                // Simulate C key press to leverage exact game logic
                document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', bubbles: true }));
            };
        }

        // Undo button handler
        const undoBtn = document.getElementById('upgrade-undo-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                this.undoPendingPurchases();
            });
        }

        // Confirm button handler
        const confirmBtn = document.getElementById('upgrade-confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.confirmPendingPurchases();
            });
        }
    }

    undoPendingPurchases() {
        // Remove all pending purchases and revert their effects
        this.pendingPurchases.forEach((level, nodeId) => {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) {
                // Refund wire cost
                const cost = this.getNodeCostForLevel(node, level);
                if (window.game && window.game.state) {
                    window.game.state.wire += cost;
                }
                this.revertNodeEffects(node, level);

                // Decrement level
                const currentLevel = this.nodeLevels.get(nodeId) || 0;
                if (currentLevel > 0) {
                    this.nodeLevels.set(nodeId, currentLevel - 1);
                    if (this.nodeLevels.get(nodeId) === 0) {
                        this.nodeLevels.delete(nodeId);
                    }
                }
            }
        });
        this.pendingPurchases.clear();
        this.hideActionButtons();
        this.drawUpgradeUI();
        console.log('Pending purchases undone and wire refunded');
    }

    confirmPendingPurchases() {
        // Confirm all pending purchases (they're already applied, just clear pending status)
        this.pendingPurchases.clear();
        this.hideActionButtons();
        console.log('Purchases confirmed');
    }

    showActionButtons() {
        const actionButtons = document.getElementById('upgrade-action-buttons');
        if (actionButtons) {
            actionButtons.style.display = 'flex';
        }
    }

    hideActionButtons() {
        const actionButtons = document.getElementById('upgrade-action-buttons');
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }
    }

    revertNodeEffects(node, level) {
        // Revert the effects of a specific level of a node
        if (!window.game || !window.game.state || !window.game.state.playerStats) return;

        let effects = node.effects;
        // If stacked, get effects for specific level
        if (node.levels) {
            if (level > 0 && level <= node.levels.length) {
                effects = node.levels[level - 1].effects;
            } else {
                return;
            }
        }

        if (!effects) return;

        const stats = window.game.state.playerStats;

        // Revert stat changes
        if (effects.max_health) stats.max_health -= effects.max_health;
        if (effects.max_energy) stats.max_energy -= effects.max_energy;
        if (effects.max_modules) stats.max_modules -= effects.max_modules;

        // Revert weapon slots
        if (effects.weapon_slots && window.playerWeaponSystem) {
            window.playerWeaponSystem.removeSlots(effects.weapon_slots);
        }

        // Handle other specific effects...
        // Note: This needs to be robust for all effect types
        // For now, focusing on stats and Slicing

        if (effects.slicing_bonus && window.game.slicingSystem) {
            window.game.slicingSystem.addSlicingBonus(-effects.slicing_bonus);
        }

        if (effects.enable_slicing && window.game.slicingSystem) {
            // Cannot easily re-lock slicing if it was enabled, 
            // but if level 1 enables it and we revert level 1, we could disable it.
            // Assuming level 1 is the only one that enables it.
            if (level === 1) {
                // window.game.slicingSystem.disableSlicing(); // If method exists
            }
        }

        if (effects.spare_core) {
            if (stats.spare_cores) stats.spare_cores -= effects.spare_core;
            const spareCoreCount = document.getElementById('spare-core-count');
            if (spareCoreCount) spareCoreCount.textContent = stats.spare_cores;
        }

        console.log(`Reverted effects for node: ${node.id} level ${level}`);
    }

    async loadNodes() {
        try {
            const response = await fetch('data/upgrade_nodes_stacked.json');
            const data = await response.json();
            this.nodes = data.nodes;
            this.preloadNodeImages();
            console.log('Upgrade nodes loaded successfully (Stacked Version).');
        } catch (error) {
            console.error('Error loading upgrade nodes:', error);
        }
    }

    preloadNodeImages() {
        this.nodes.forEach(node => {
            if (node.icon) {
                const img = new Image();
                img.src = node.icon;
                img.onload = () => {
                    this.nodeImageCache.set(node.id, { img, loaded: true });
                };
                img.onerror = () => {
                    this.nodeImageCache.set(node.id, { loaded: false });
                };
            } else {
                this.nodeImageCache.set(node.id, { loaded: false });
            }
        });
    }

    // Get current level of a node
    getNodeLevel(nodeId) {
        return this.nodeLevels.get(nodeId) || 0;
    }

    setNodeLevel(nodeId, level) {
        this.nodeLevels.set(nodeId, level);
    }

    // Calculate cost for the NEXT level
    getNodeCost(node) {
        const currentLevel = this.getNodeLevel(node.id);
        if (node.levels) {
            if (currentLevel < node.levels.length) {
                return node.levels[currentLevel].cost;
            }
            return 0; // Max level reached
        }
        // Legacy/Single node cost
        return node.cost !== undefined ? node.cost : Math.pow(2, node.position.x);
    }

    // Get cost for a specific level (used for undo)
    getNodeCostForLevel(node, level) {
        if (node.levels) {
            if (level > 0 && level <= node.levels.length) {
                return node.levels[level - 1].cost;
            }
            return 0;
        }
        return node.cost !== undefined ? node.cost : Math.pow(2, node.position.x);
    }

    purchaseNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        if (this.canPurchaseNode(nodeId)) {
            const cost = this.getNodeCost(node);

            if (game.state.wire >= cost) {
                game.state.wire -= cost;

                const currentLevel = this.getNodeLevel(nodeId);
                const newLevel = currentLevel + 1;

                this.setNodeLevel(nodeId, newLevel);
                this.pendingPurchases.set(nodeId, newLevel); // Track specific level purchase

                this.applyNodeEffects(node, newLevel);

                console.log(`Purchased upgrade: ${node.name} (Level ${newLevel})`);
                this.showActionButtons();
                this.drawUpgradeUI();

                if (window.audioSystem) {
                    window.audioSystem.playSound('newnodeSelected', 0.7);
                }
            } else {
                console.log('Not enough wire to purchase this upgrade.');
                if (window.audioSystem) {
                    window.audioSystem.playSound('nodeCannotbeselected', 0.7);
                }
            }
        } else {
            console.log('Cannot purchase this upgrade yet.');
            if (window.audioSystem) {
                window.audioSystem.playSound('nodeCannotbeselected', 0.7);
            }
        }
    }

    severNode(nodeId) {
        // Simplified sever: only allow if no dependencies and max level?
        // Or allow severing one level at a time?
        // For now, let's stick to the original behavior: remove entirely if possible.
        // BUT with stacks, maybe we just remove the top level?

        const node = this.nodes.find(n => n.id === nodeId);
        const currentLevel = this.getNodeLevel(nodeId);

        if (!node || currentLevel === 0) return;

        // Check dependencies (only if removing level 1)
        if (currentLevel === 1) {
            const isPrerequisiteForOthers = this.nodes.some(n =>
                this.getNodeLevel(n.id) > 0 && n.prerequisites.includes(nodeId)
            );

            if (isPrerequisiteForOthers) {
                console.log("Cannot sever this node, other purchased nodes depend on it.");
                if (window.audioSystem) {
                    window.audioSystem.playSound('nodeCannotbeselected', 0.7);
                }
                return;
            }
        }

        // Refund half cost of current level
        const cost = this.getNodeCostForLevel(node, currentLevel);
        game.state.wire += Math.floor(cost / 2);

        this.removeNodeEffects(node, currentLevel); // Remove effects of TOP level
        this.setNodeLevel(nodeId, currentLevel - 1);
        if (this.getNodeLevel(nodeId) === 0) {
            this.nodeLevels.delete(nodeId);
        }

        console.log(`Severed upgrade level: ${node.name}`);
        this.drawUpgradeUI();
        if (window.audioSystem) {
            window.audioSystem.playSound('nodeDeselected', 0.7);
        }
    }

    canPurchaseNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return false;

        // Check if max level reached
        const currentLevel = this.getNodeLevel(nodeId);
        if (node.levels) {
            if (currentLevel >= node.levels.length) {
                return false;
            }
        } else if (currentLevel >= 1) {
            return false;
        }

        // Cannot purchase nodes damaged by DroidSlayer
        if (window.droidSlayerSystem && window.droidSlayerSystem.isNodeDamaged(nodeId)) {
            return false;
        }

        // Check node-level prerequisites
        if (!node.prerequisites.every(prereqId => this.getNodeLevel(prereqId) > 0)) {
            return false;
        }

        // Check level-specific prerequisites
        if (node.levels) {
            const nextLevelIndex = currentLevel; // 0 for level 1, 1 for level 2, etc.
            const nextLevelData = node.levels[nextLevelIndex];
            if (nextLevelData && nextLevelData.prerequisites) {
                return nextLevelData.prerequisites.every(prereqId => this.getNodeLevel(prereqId) > 0);
            }
        }

        return true;
    }

    applyNodeEffects(node, level) {
        let effects = node.effects;
        // If stacked, get effects for specific level
        if (node.levels) {
            if (level > 0 && level <= node.levels.length) {
                effects = node.levels[level - 1].effects;
            } else {
                return;
            }
        }

        if (!effects) return;

        for (const effect in effects) {
            const value = effects[effect];
            console.log(`Applying effect: ${effect} = ${value}`);

            switch (effect) {
                // STORAGE & WEAPONS
                case 'unlock_slot':
                    const categoryIndex = window.playerWeaponSystem.categories.indexOf(value);
                    if (categoryIndex !== -1) {
                        window.playerWeaponSystem.unlockedSlots = Math.max(window.playerWeaponSystem.unlockedSlots, categoryIndex + 1);
                        if (window.playerWeaponSystem.slotCapacity[categoryIndex] === 0) {
                            window.playerWeaponSystem.slotCapacity[categoryIndex] = 1;
                        }
                    }
                    break;
                case 'add_extra_slot':
                    const extraSlotIndex = window.playerWeaponSystem.categories.indexOf(value);
                    if (extraSlotIndex !== -1) {
                        window.playerWeaponSystem.slotCapacity[extraSlotIndex]++;
                    }
                    break;
                case 'mass_storage':
                    if (value) {
                        for (let i = 0; i < window.playerWeaponSystem.slotCapacity.length; i++) {
                            if (window.playerWeaponSystem.slotCapacity[i] > 1) {
                                window.playerWeaponSystem.slotCapacity[i]++;
                            }
                        }
                    }
                    break;
                case 'starting_weapon':
                    window.playerWeaponSystem.setStartingWeapon(value.category, value.weapon);
                    break;
                case 'max_modules':
                    game.state.playerStats.max_modules = value;
                    break;
                case 'pamphlet_generator':
                    game.state.playerStats.pamphlet_generator = value;
                    break;
                case 'pamphlet_speed_bonus':
                    if (!game.state.playerStats.pamphlet_speed_bonus) game.state.playerStats.pamphlet_speed_bonus = 0;
                    game.state.playerStats.pamphlet_speed_bonus += value;
                    break;
                case 'spare_core':
                    // Add spare cores (extra lives)
                    if (!game.state.playerStats.spare_cores) {
                        game.state.playerStats.spare_cores = 0;
                    }
                    game.state.playerStats.spare_cores += value;
                    // Update the spare core display
                    const spareCoreCount = document.getElementById('spare-core-count');
                    if (spareCoreCount) {
                        spareCoreCount.textContent = game.state.playerStats.spare_cores;
                    }
                    break;
                case 'neighborhood_watch':
                    game.state.playerStats.neighborhood_watch = value;
                    break;
                case 'spy_network':
                    game.state.playerStats.spy_network = value;
                    break;
                case 'prophets':
                    game.state.playerStats.prophets = value;
                    break;

                // SLICING
                case 'enable_slicing':
                    if (window.game && window.game.slicingSystem) {
                        window.game.slicingSystem.enableSlicing();
                    }
                    break;
                case 'slicing_bonus':
                    if (window.game && window.game.slicingSystem) {
                        window.game.slicingSystem.addSlicingBonus(value);
                    }
                    break;

                // GONK
                case 'max_energy':
                    game.state.maxEnergy += value;
                    game.state.energy += value;
                    break;
                // ... (rest of the cases from previous step)
                default:
                // console.warn(`Unknown upgrade effect: ${effect}`);
            }
        }
        game.updateCharacterSheet();
    }

    removeNodeEffects(node, level) {
        // This is the inverse of applyNodeEffects
        // ... (Use revertNodeEffects logic, essentially same as before but targeted)
        this.revertNodeEffects(node, level);
    }

    revertNodeEffects(node, level) {
        let effects = node.effects;
        // If stacked, get effects for specific level
        if (node.levels) {
            if (level > 0 && level <= node.levels.length) {
                effects = node.levels[level - 1].effects;
            } else {
                return;
            }
        }

        if (!effects) return;

        for (const effect in effects) {
            const value = effects[effect];
            console.log(`Reverting effect: ${effect} = ${value}`);

            switch (effect) {
                // STORAGE & WEAPONS
                case 'unlock_slot':
                    // Difficult to revert without full recalc
                    break;
                case 'add_extra_slot':
                    const extraSlotIndex = window.playerWeaponSystem.categories.indexOf(value);
                    if (extraSlotIndex !== -1) {
                        window.playerWeaponSystem.slotCapacity[extraSlotIndex]--;
                    }
                    break;
                case 'mass_storage':
                    if (value) {
                        for (let i = 0; i < window.playerWeaponSystem.slotCapacity.length; i++) {
                            if (window.playerWeaponSystem.slotCapacity[i] > 1) {
                                window.playerWeaponSystem.slotCapacity[i]--;
                            }
                        }
                    }
                    break;
                case 'starting_weapon':
                    break;
                case 'max_modules':
                    // Revert to default if this was the source
                    if (game.state.playerStats.max_modules === value) {
                        game.state.playerStats.max_modules = 4; // Default
                    }
                    break;
                case 'pamphlet_generator':
                    game.state.playerStats.pamphlet_generator = false;
                    break;
                case 'pamphlet_speed_bonus':
                    if (game.state.playerStats.pamphlet_speed_bonus) {
                        game.state.playerStats.pamphlet_speed_bonus -= value;
                    }
                    break;
                case 'spare_core':
                    if (game.state.playerStats.spare_cores) {
                        game.state.playerStats.spare_cores -= value;
                    }
                    const spareCoreCount = document.getElementById('spare-core-count');
                    if (spareCoreCount) {
                        spareCoreCount.textContent = game.state.playerStats.spare_cores;
                    }
                    break;
                case 'neighborhood_watch':
                    game.state.playerStats.neighborhood_watch = 0;
                    break;
                case 'spy_network':
                    game.state.playerStats.spy_network = 0;
                    break;
                case 'prophets':
                    game.state.playerStats.prophets = 0;
                    break;

                // SLICING
                case 'enable_slicing':
                    if (window.game && window.game.slicingSystem) {
                        window.game.slicingSystem.disableSlicing();
                    }
                    break;
                case 'slicing_bonus':
                    if (window.game && window.game.slicingSystem) {
                        window.game.slicingSystem.addSlicingBonus(-value);
                    }
                    break;

                // GONK
                case 'max_energy':
                    game.state.maxEnergy -= value;
                    game.state.energy = Math.min(game.state.energy, game.state.maxEnergy);
                    break;
                case 'energy_regen':
                    game.state.energyRegenRate -= value;
                    break;
                case 'movement_speed':
                    game.state.playerStats.speed -= value;
                    break;
                case 'armor':
                    game.state.playerStats.armor -= value;
                    break;
                case 'weapon_energy_cost':
                    game.state.playerStats.weapon_energy_cost_reduction -= value;
                    break;

                // RANGED
                case 'longarm_damage_bonus':
                    game.state.playerStats.longarm_damage_bonus -= value;
                    break;
                case 'bolt_speed_bonus':
                    game.state.playerStats.bolt_speed_bonus -= value;
                    break;

                // MELEE
                case 'melee_damage_bonus':
                    game.state.playerStats.melee_damage_bonus -= value;
                    break;
                case 'melee_speed_bonus':
                    game.state.playerStats.melee_speed_bonus -= value;
                    break;
                case 'saber_damage_bonus':
                    game.state.playerStats.saber_damage_bonus -= value;
                    break;
                case 'saber_block_chance':
                    game.state.playerStats.saber_block_chance -= value;
                    break;
                case 'instant_kill_chance':
                    game.state.playerStats.instant_kill_chance -= value;
                    break;

                // SOCIAL
                case 'pamphlet_effectiveness_bonus':
                    game.state.playerStats.pamphlet_effectiveness_bonus -= value;
                    break;
                case 'ally_lie_attack_bonus':
                    game.state.playerStats.ally_lie_attack_bonus -= value;
                    break;
                case 'bartering_bonus':
                    game.state.playerStats.bartering_bonus -= value;
                    break;
                case 'intimidation_chance':
                    game.state.playerStats.intimidation_chance -= value;
                    break;

                default:
                    console.warn(`Unknown upgrade effect to revert: ${effect}`);
            }
        }
        game.updateCharacterSheet();
    }

    drawUpgradeUI() {
        // NOTE: Old 3D Upgrade Board - Can be deleted in next passthrough if authorized.
        // Disabled in favor of D20 Character Sheet.
        /*
        const container = document.getElementById('upgrade-container');
        const tooltip = document.getElementById('upgrade-tooltip');
        const closeBtn = document.getElementById('upgrade-close-btn');
        if (!container || !tooltip) {
            console.error('Required UI elements (upgrade-container or upgrade-tooltip) not found!');
            return;
        }
        container.innerHTML = ''; // Clear previous content

        // Show close button
        if (closeBtn) closeBtn.style.display = 'block';

        const GRID_SPACING_X = 104; // Horizontal spacing
        const GRID_SPACING_Y = 80; // Increased vertical spacing for 3D height
        const NODE_SIZE = 60;
        const TOP_PADDING = 50;

        // Draw lines first so they are behind nodes
        this.drawConnections(container, GRID_SPACING_X, GRID_SPACING_Y, NODE_SIZE, NODE_SIZE, TOP_PADDING);

        this.nodes.forEach(node => {
            const nodeElement = document.createElement('div');
            nodeElement.className = 'upgrade-node';
            nodeElement.style.left = `${node.position.x * GRID_SPACING_X}px`;
            nodeElement.style.top = `${TOP_PADDING + node.position.y * GRID_SPACING_Y}px`;

            // Calculate stack height
            const currentLevel = this.getNodeLevel(node.id);
            const maxLevel = node.levels ? node.levels.length : 1;
            const displayLevel = Math.max(1, currentLevel); // Show at least 1 unit high even if 0
            const stackHeight = 10 + (displayLevel * 5); // Base 10px + 5px per level
            nodeElement.style.setProperty('--stack-height', `${stackHeight}px`);

            // Create 3D Cube Structure
            const cube = document.createElement('div');
            cube.className = 'node-cube';

            const faces = ['top', 'front', 'right', 'left', 'back'];
            faces.forEach(face => {
                const faceEl = document.createElement('div');
                faceEl.className = `node-face ${face}`;
                if (face === 'top') {
                    const cachedImage = this.nodeImageCache.get(node.id);
                    if (cachedImage && cachedImage.loaded) {
                        faceEl.style.backgroundImage = `url('${cachedImage.img.src}')`;
                    } else {
                        faceEl.style.backgroundColor = node.color || '#333';
                        if (!cachedImage) faceEl.textContent = node.name; // Only show text if no image
                        faceEl.style.fontSize = '10px';
                        faceEl.style.textAlign = 'center';
                        faceEl.style.color = '#fff';
                        faceEl.style.textShadow = '0 0 2px #000';
                    }
                }
                cube.appendChild(faceEl);
            });

            // Ghost Node for Next Level
            if (node.levels && currentLevel < node.levels.length) {
                const ghost = document.createElement('div');
                ghost.className = 'node-ghost';

                const ghostFaces = ['top', 'front', 'right', 'left', 'back'];
                ghostFaces.forEach(face => {
                    const faceEl = document.createElement('div');
                    faceEl.className = `ghost-face ${face}`;
                    ghost.appendChild(faceEl);
                });

                cube.appendChild(ghost);
            }

            nodeElement.appendChild(cube);

            // Check status
            const isDamaged = window.droidSlayerSystem && window.droidSlayerSystem.isNodeDamaged(node.id);
            const canPurchase = this.canPurchaseNode(node.id);

            if (currentLevel > 0) {
                nodeElement.classList.add('purchased');
            } else if (canPurchase) {
                nodeElement.classList.add('available');
            }

            // Level Badge
            if (node.levels || currentLevel > 0) {
                const levelBadge = document.createElement('div');
                levelBadge.className = 'node-level-badge';
                levelBadge.textContent = currentLevel;
                nodeElement.appendChild(levelBadge);
            }

            // Interaction Events
            nodeElement.addEventListener('mouseenter', (e) => {
                // Calculate cost and description for NEXT level
                let cost = this.getNodeCost(node);
                let description = node.description;
                let name = node.name;

                if (node.levels) {
                    const nextLevelIndex = currentLevel;
                    if (nextLevelIndex < node.levels.length) {
                        const nextLevelData = node.levels[nextLevelIndex];
                        cost = nextLevelData.cost;
                        description = nextLevelData.description;
                        // Update name if needed, or keep base name
                    } else {
                        cost = "MAX";
                        description = "Maximum level reached.";
                    }
                }

                tooltip.style.display = 'block';
                tooltip.style.left = `${e.pageX + 15}px`;
                tooltip.style.top = `${e.pageY + 15}px`;

                let tooltipHTML = `<strong>${name}</strong><br>${description}<br>`;
                if (node.levels) {
                    tooltipHTML += `<span style="color: #aaa;">Level: ${currentLevel} / ${node.levels.length}</span><br>`;
                }
                tooltipHTML += `<span style="color: ${canPurchase ? '#0f0' : '#f00'}">Cost: ${cost}</span>`;

                if (isDamaged) {
                    tooltipHTML += `<br><span style="color: red; font-weight: bold;">DAMAGED BY DROIDSLAYER</span>`;
                }

                tooltip.innerHTML = tooltipHTML;
            });

            nodeElement.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });

            nodeElement.addEventListener('click', (e) => {
                if (e.shiftKey) {
                    // Sever logic
                    if (currentLevel > 0) {
                        this.severNode(node.id);
                        window.audioSystem.playSound('ui_sever');
                        this.drawUpgradeUI();
                    }
                } else {
                    // Purchase logic
                    if (this.canPurchaseNode(node.id)) {
                        // Add to pending purchases
                        // For stacked nodes, we purchase the NEXT level
                        const nextLevel = currentLevel + 1;
                        this.purchaseNode(node.id);
                        window.audioSystem.playSound('ui_purchase');
                        this.drawUpgradeUI();
                    } else {
                        window.audioSystem.playSound('ui_error');
                    }
                }
            });

            container.appendChild(nodeElement);
        });
        */
    }

    drawConnections(container, spacingX, spacingY, nodeWidth, nodeHeight, topPadding) {
        // NOTE: Old 3D Upgrade Board - Can be deleted in next passthrough if authorized.
        /*
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, 'svg');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.transform = 'translateZ(0)'; // Ensure it's on the floor

        this.nodes.forEach(node => {
            node.prerequisites.forEach(prereqId => {
                const prereqNode = this.nodes.find(n => n.id === prereqId);
                if (prereqNode) {
                    const line = document.createElementNS(svgNS, 'line');
                    const x1 = node.position.x * spacingX + nodeWidth / 2;
                    const y1 = topPadding + node.position.y * spacingY + nodeHeight / 2;
                    const x2 = prereqNode.position.x * spacingX + nodeWidth / 2;
                    const y2 = topPadding + prereqNode.position.y * spacingY + nodeHeight / 2;

                    line.setAttribute('x1', x1);
                    line.setAttribute('y1', y1);
                    line.setAttribute('x2', x2);
                    line.setAttribute('y2', y2);
                    line.setAttribute('class', 'upgrade-connection'); // Add class for styling
                    line.setAttribute('stroke', '#333'); // Darker base color
                    line.setAttribute('stroke-width', '4'); // Thicker lines for traces

                    if (this.getNodeLevel(node.id) > 0 && this.getNodeLevel(prereqId) > 0) {
                        line.classList.add('active');
                        line.setAttribute('stroke', '#00ffff'); // Cyan for active traces
                        line.style.filter = 'drop-shadow(0 0 2px #00ffff)';
                    }
                    svg.appendChild(line);
                }
            });
        });
        container.appendChild(svg);
        */
    }
}

// Instantiate the upgrade system
window.characterUpgrades = new CharacterUpgrades();
