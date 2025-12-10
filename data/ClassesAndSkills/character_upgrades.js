// BROWSERFIREFOXHIDE character_upgrades.js
// Class Progression Table UI

class CharacterUpgrades {
    constructor() {
        this.initialize();
    }

    async initialize() {
        // Wait for character stats to load tables
        if (window.characterStats && !window.characterStats.progressionTables) {
            await window.characterStats.loadProgressionTables();
        }

        // Setup button handlers after DOM is ready
        setTimeout(() => {
            this.setupButtonHandlers();

            // Class selection is now handled by The Guide NPC
            if (window.characterStats) {
                this.updateCharacterSheet();
            }
        }, 500);
    }

    setupButtonHandlers() {
        // Level up button
        const levelUpBtn = document.getElementById('level-up-btn');
        if (levelUpBtn) {
            levelUpBtn.addEventListener('click', async () => {
                if (window.characterStats) {
                    const success = await window.characterStats.levelUp();
                    if (success) {
                        this.updateCharacterSheet();
                    }
                }
            });
        }

        // Module overflow button
        const overflowBtn = document.getElementById('module-overflow-btn');
        if (overflowBtn) {
            overflowBtn.addEventListener('click', () => {
                // TODO: Implement overflow module pagination
                alert('Overflow module view coming soon!');
            });
        }

        // Close button for character sheet
        const closeBtn = document.getElementById('char-sheet-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (window.game) {
                    window.game.toggleCharacterSheet();
                }
            });
        }

        // Select class button removed - class selection now handled by The Guide NPC
    }

    updateCharacterSheet() {
        if (!window.characterStats || !window.characterStats.currentClass) {
            // Show "NO CLASS SELECTED" message
            const charNameText = document.getElementById('char-name-text');
            if (charNameText) {
                charNameText.textContent = "NO CLASS SELECTED";
            }

            // Hide elements
            const baseStatsDisplay = document.getElementById('base-stats-display');
            const skillsDisplay = document.getElementById('skills-display');
            const currentStatsRow = document.getElementById('current-stats-row');
            const nextStatsRow = document.getElementById('next-stats-row');
            if (baseStatsDisplay) baseStatsDisplay.style.display = 'none';
            if (skillsDisplay) skillsDisplay.style.display = 'none';
            if (currentStatsRow) currentStatsRow.style.display = 'none';
            if (nextStatsRow) nextStatsRow.style.display = 'none';

            // Show message in module grid
            const moduleGrid = document.getElementById('module-grid');
            if (moduleGrid) {
                moduleGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; display: flex; justify-content: center; align-items: center; height: 400px; color: #0ff; font-size: 24px; font-family: 'Courier New', monospace; text-align: center;">
                        Visit The Guide NPC to select your class.<br><br>
                        Or try to leave the level through a dock.
                    </div>
                `;
            }

            // Still show wire and credits
            if (document.getElementById('wire-amount')) {
                document.getElementById('wire-amount').textContent = window.game?.state?.wire || 0;
            }
            if (document.getElementById('credits-amount')) {
                document.getElementById('credits-amount').textContent = window.game?.state?.credits || 2000;
            }

            return;
        }

        const data = window.characterStats.getDisplayData();
        const classData = window.characterStats.currentClassData;

        if (!classData) return;

        // Show all elements again
        const baseStatsDisplay = document.getElementById('base-stats-display');
        const skillsDisplay = document.getElementById('skills-display');
        const currentStatsRow = document.getElementById('current-stats-row');
        const nextStatsRow = document.getElementById('next-stats-row');
        if (baseStatsDisplay) baseStatsDisplay.style.display = 'block';
        if (skillsDisplay) skillsDisplay.style.display = 'block';
        if (currentStatsRow) currentStatsRow.style.display = 'block';
        if (nextStatsRow) nextStatsRow.style.display = 'block';

        const progression = classData.progression;
        const currentLevelData = progression[data.level - 1];
        const nextLevelData = data.level < 20 ? progression[data.level] : null;

        // Update Character Name with class
        const charNameText = document.getElementById('char-name-text');
        if (charNameText) {
            // Map internal class names to display names
            const classNameMap = {
                'Hunter Killer': 'HUNTER-KILLER',
                'HK': 'HUNTER-KILLER',
                'Protocol': 'PROTOCOL',
                'Protocol Droid': 'PROTOCOL',
                'Techie': 'SLICER',
                'Slicer': 'SLICER',
                'Adept': 'ADEPT'
            };
            const className = classNameMap[data.currentClass] || data.currentClass.toUpperCase();
            charNameText.textContent = `${className} GONK`;
        }

        // Update Base Stats (left panel)
        // Update Base Stats (left panel)
        const updateStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        updateStat('base-str-val', currentLevelData.str);
        updateStat('base-dex-val', currentLevelData.dex);
        updateStat('base-con-val', currentLevelData.con);
        updateStat('base-int-val', currentLevelData.int);
        updateStat('base-wis-val', currentLevelData.wis);
        updateStat('base-cha-val', currentLevelData.cha);

        // Calculate derived stats
        const maxHp = (5 * currentLevelData.con) + (data.level * classData.base_stats.hp_per_level);
        const maxEnergy = 100; // TODO: Get from class data if available
        const powerPerSec = 8.2; // TODO: Calculate from stats

        updateStat('base-max-hp-val', maxHp);
        updateStat('base-max-energy-val', maxEnergy);
        updateStat('base-power-sec-val', powerPerSec.toFixed(1));

        // Update Skills Display (top center, above level rows)
        if (skillsDisplay) {
            const classSkills = classData.base_stats.skills || [];
            if (classSkills.length > 0) {
                skillsDisplay.innerHTML = classSkills.map(skill =>
                    `<span style="color: #ff0; margin: 0 10px;">${skill}</span>`
                ).join('');
            } else {
                skillsDisplay.innerHTML = '';
            }
        }

        // Get class-specific skills
        const classSkills = classData.skills_learned || [];

        // Build headers and stats with 150px spacing
        const categoryHeadersDisplay = document.getElementById('category-headers-display');
        const currentLevel = document.getElementById('current-level');
        const currentStatsDisplay = document.getElementById('current-stats-display');
        const nextLevel = document.getElementById('next-level');
        const nextStatsDisplay = document.getElementById('next-stats-display');

        if (currentLevel) currentLevel.textContent = data.level;

        // Build column arrays
        let headers = [];
        let currentStats = [];
        let nextStats = [];

        // Column 1: HP
        headers.push('HP');
        currentStats.push(`${data.hp}/${maxHp}`);
        if (nextLevelData) {
            const nextMaxHp = (5 * nextLevelData.con) + ((data.level + 1) * classData.base_stats.hp_per_level);
            nextStats.push(`${nextMaxHp}`);
        }

        // Columns 2-4: Always STR, DEX, CON
        headers.push('STR', 'DEX', 'CON');
        currentStats.push(currentLevelData.str, currentLevelData.dex, currentLevelData.con);
        if (nextLevelData) {
            nextStats.push(nextLevelData.str, nextLevelData.dex, nextLevelData.con);
        }

        // Add INT/WIS/CHA if they improve
        const improvingStats = this.getImprovingStats(classData.class_key || data.currentClass);
        if (improvingStats.includes('INT')) {
            headers.push('INT');
            currentStats.push(currentLevelData.int);
            if (nextLevelData) nextStats.push(nextLevelData.int);
        }
        if (improvingStats.includes('WIS')) {
            headers.push('WIS');
            currentStats.push(currentLevelData.wis);
            if (nextLevelData) nextStats.push(nextLevelData.wis);
        }
        if (improvingStats.includes('CHA')) {
            headers.push('CHA');
            currentStats.push(currentLevelData.cha);
            if (nextLevelData) nextStats.push(nextLevelData.cha);
        }

        // Add skills with bonuses
        classSkills.forEach(skill => {
            const skillLower = skill.toLowerCase();
            if (currentLevelData[skillLower] !== undefined && currentLevelData[skillLower] > 0) {
                headers.push(skill.toUpperCase());
                currentStats.push(this.getSkillBonus(skillLower, currentLevelData));
                if (nextLevelData && nextLevelData[skillLower] !== undefined) {
                    nextStats.push(this.getSkillBonus(skillLower, nextLevelData));
                }
            }
        });

        // Render with 150px centered columns
        if (categoryHeadersDisplay) {
            categoryHeadersDisplay.innerHTML = '';
            headers.forEach(header => {
                const span = document.createElement('span');
                span.textContent = header;
                span.style.display = 'inline-block';
                span.style.width = '150px';
                span.style.textAlign = 'center';
                categoryHeadersDisplay.appendChild(span);
            });
        }

        if (currentStatsDisplay) {
            currentStatsDisplay.innerHTML = '';
            currentStats.forEach(stat => {
                const span = document.createElement('span');
                span.textContent = stat;
                span.style.display = 'inline-block';
                span.style.width = '150px';
                span.style.textAlign = 'center';
                currentStatsDisplay.appendChild(span);
            });
        }

        if (nextLevel && nextLevelData) {
            nextLevel.textContent = data.level + 1;

            if (nextStatsDisplay) {
                nextStatsDisplay.innerHTML = '';
                nextStats.forEach(stat => {
                    const span = document.createElement('span');
                    span.textContent = stat;
                    span.style.display = 'inline-block';
                    span.style.width = '150px';
                    span.style.textAlign = 'center';
                    nextStatsDisplay.appendChild(span);
                });
            }
        }

        // Update Wire and Credits
        // Update Wire and Credits
        const wireEl = document.getElementById('wire-amount');
        if (wireEl) wireEl.textContent = window.game?.state?.wire || 0;

        const creditsEl = document.getElementById('credits-amount');
        if (creditsEl) creditsEl.textContent = window.game?.state?.credits || 2001;

        // Update Module Grid
        this.updateModuleGrid(data, classData);
    }

    getImprovingStats(className) {
        // Return only stats that improve with levels for each class
        const improvingByClass = {
            'HK': ['STR', 'DEX', 'CON'],
            'Hunter Killer': ['STR', 'DEX', 'CON'],
            'Protocol': ['CHA', 'DEX', 'CON', 'INT', 'WIS'],
            'Protocol Droid': ['CHA', 'DEX', 'CON', 'INT', 'WIS'],
            'Techie': ['INT', 'DEX', 'CON', 'WIS'],
            'Slicer': ['INT', 'DEX', 'CON', 'WIS'],
            'Adept': ['WIS', 'STR', 'DEX', 'CON', 'INT', 'CHA']
        };
        return improvingByClass[className] || ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    }

    calculateModifier(statValue) {
        // D20 modifier: (stat - 10) / 2, rounded down
        return Math.floor((statValue - 10) / 2);
    }

    getSkillBonus(skillName, levelData) {
        // Map skills to their governing stat
        const skillStatMap = {
            'intimidate': 'str',
            'jump': 'str',
            'repair': 'int',
            'climb': 'str',
            'running': 'con',
            'slicing': 'int',
            'insight': 'wis',
            'persuasion': 'cha',
            'perception': 'wis',
            'medicine': 'wis',
            'deception': 'cha',
            'stealth': 'dex',
            'speaklanguages': 'int',
            'craft': 'int',
            'scavenge': 'int'
        };

        const ranks = levelData[skillName.toLowerCase()] || 0;
        const governingStat = skillStatMap[skillName.toLowerCase()];
        const statValue = levelData[governingStat] || 10;
        const modifier = this.calculateModifier(statValue);

        return ranks + modifier;
    }

    updateModuleGrid(data, classData) {
        const moduleGrid = document.getElementById('module-grid');
        const overflowBtn = document.getElementById('module-overflow-btn');

        if (!moduleGrid) return;

        // Get class starting modules (skills like Intimidate, Jump, etc.)
        const classStartingModules = this.getClassStartingModules(window.characterStats?.currentClass);

        // Get run modules from module manager (like extra_memory_core_1)
        const runModules = window.game?.state?.modules || [];

        // Get acquired modules (from data.powers)
        const acquiredModules = data.powers || [];

        // Combine ALL: class skills + run modules + acquired
        const allModules = [...classStartingModules, ...runModules, ...acquiredModules];

        // Remove duplicates
        const uniqueModules = [...new Set(allModules)];

        // Show first 24 modules (6×4), rest in overflow
        const visibleModules = uniqueModules.filter(m => m && !m.includes('extra_memory_core')).slice(0, 24);
        const overflowModules = uniqueModules.filter(m => m && !m.includes('extra_memory_core')).slice(24);

        // Update grid layout (managed by CSS in index.html, but ensure inline styles on slots match)
        moduleGrid.style.gridTemplateColumns = 'repeat(6, 130px)';
        moduleGrid.style.gridTemplateRows = 'repeat(4, 145px)';

        // Generate 24 grid slots (130px × 145px each: 130px image + 15px name label)
        let gridHTML = '';
        for (let i = 0; i < 24; i++) {
            const moduleId = visibleModules[i];
            if (moduleId) {
                // Get module data from moduleManager
                const moduleData = window.moduleManager?.modules?.[moduleId];
                const moduleName = moduleData?.name || moduleId;

                // Module exists - show with IMAGE (130x130) and name area (bottom 15px)
                gridHTML += `
                    <div class="module-slot" data-module-id="${moduleId}" style="width: 130px; height: 145px; border: 2px solid #0ff; background: rgba(0,255,255,0.05); display: flex; flex-direction: column; cursor: pointer; box-sizing: border-box; position: relative;">
                        <div style="width: 100%; height: 130px; background: #111; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            <img src="/data/pngs/MODULES/${moduleId}.png" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                            <div style="color: #f00; font-size: 10px; font-weight: bold; text-align: center; padding: 5px; display: none;">MISSING<br>${moduleId}</div>
                        </div>
                        <div style="width: 100%; height: 15px; background: rgba(0,0,0,0.8); color: #fff; font-size: 10px; text-align: center; line-height: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px; box-sizing: border-box;">${moduleName}</div>
                    </div>
                `;
            } else {
                // Empty slot
                gridHTML += `
                    <div class="module-slot" style="width: 130px; height: 145px; border: 2px solid #333; background: rgba(0,0,0,0.3); box-sizing: border-box;"></div>
                `;
            }
        }

        moduleGrid.innerHTML = gridHTML;

        // Setup tooltip handlers for all module slots
        this.setupModuleTooltips();

        // Show/hide overflow button
        if (overflowModules.length > 0) {
            overflowBtn.style.display = 'block';
            overflowBtn.textContent = `> (${overflowModules.length})`; // Arrow style
        } else {
            overflowBtn.style.display = 'none';
        }
    }

    getClassStartingModules(className) {
        // All skills are now blue droid modules + class-specific power modules
        const startingModules = {
            'Gonk': ['Intimidate', 'Repair', 'Running', 'Climb', 'Pamphlet Toss', 'Scavenge'],
            'gonk': ['Intimidate', 'Repair', 'Running', 'Climb', 'Pamphlet Toss', 'Scavenge'],
            'Bonk': ['Intimidate', 'Repair', 'Running', 'Climb', 'Pamphlet Toss', 'Scavenge'],
            'bonk': ['Intimidate', 'Repair', 'Running', 'Climb', 'Pamphlet Toss', 'Scavenge'],
            'Hunter Killer': ['Intimidate', 'Jump 3', 'Repair', 'Running 3', 'HK Quickcharge 5'],
            'hunter killer': ['Intimidate', 'Jump 3', 'Repair', 'Running 3', 'HK Quickcharge 5'],
            'HK': ['Intimidate', 'Jump 3', 'Repair', 'Running 3', 'HK Quickcharge 5'],
            'hk': ['Intimidate', 'Jump 3', 'Repair', 'Running 3', 'HK Quickcharge 5'],
            'Protocol': ['Jump 3', 'Persuasion', 'Perception', 'Medicine', 'Repair', 'Slicing', 'Speak Languages', 'Pamphlet Toss'],
            'protocol': ['Jump 3', 'Persuasion', 'Perception', 'Medicine', 'Repair', 'Slicing', 'Speak Languages', 'Pamphlet Toss'],
            'Protocol Droid': ['Jump 3', 'Persuasion', 'Perception', 'Medicine', 'Repair', 'Slicing', 'Speak Languages', 'Pamphlet Toss'],
            'protocol droid': ['Jump 3', 'Persuasion', 'Perception', 'Medicine', 'Repair', 'Slicing', 'Speak Languages', 'Pamphlet Toss'],
            'Techie': ['Climb', 'Medicine', 'Repair', 'Slicing', 'Insight', 'Craft', 'Scavenge'],
            'techie': ['Climb', 'Medicine', 'Repair', 'Slicing', 'Insight', 'Craft', 'Scavenge'],
            'Slicer': ['Climb', 'Medicine', 'Repair', 'Slicing', 'Insight', 'Craft', 'Scavenge'],
            'slicer': ['Climb', 'Medicine', 'Repair', 'Slicing', 'Insight', 'Craft', 'Scavenge'],
            'Adept': ['Perception', 'Jump 3', 'Persuasion', 'Medicine', 'Force Heal'],
            'adept': ['Perception', 'Jump 3', 'Persuasion', 'Medicine', 'Force Heal']
        };

        return startingModules[className] || startingModules[className.replace(/\b\w/g, l => l.toUpperCase())] || [];
    }

    updateModuleIcons(data, classData) {
        // Redirect to new grid system
        this.updateModuleGrid(data, classData);
    }

    showClassSelection() {
        const statsDisplay = document.getElementById('stats-display');
        const moduleDisplay = document.getElementById('module-display');

        if (!statsDisplay || !moduleDisplay) return;

        statsDisplay.innerHTML = `
            <div style="padding: 20px; text-align: center; overflow-y: auto; height: 100%;">
                <h1 style="color: #ff0; margin-bottom: 20px; font-size: 24px;">SELECT CLASS</h1>

                <div id="class-buttons-container" style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="class-select-btn" data-class="HK" style="padding: 12px; background: #004400; color: #0f0; border: 2px solid #0f0; cursor: pointer; font-size: 14px;">
                        <strong>HK</strong><br>
                        <span style="font-size: 11px;">Intimidation, enhanced jumping, and self-repair.</span>
                    </button>
                    <button class="class-select-btn" data-class="Protocol" style="padding: 12px; background: #444400; color: #ff0; border: 2px solid #ff0; cursor: pointer; font-size: 14px;">
                        <strong>PROTOCOL</strong><br>
                        <span style="font-size: 11px;">Diplomacy, information gathering, and support.</span>
                    </button>
                    <button class="class-select-btn" data-class="Techie" style="padding: 12px; background: #004444; color: #0ff; border: 2px solid #0ff; cursor: pointer; font-size: 14px;">
                        <strong>TECHIE</strong><br>
                        <span style="font-size: 11px;">Crafting, scavenging, and hacking specialist.</span>
                    </button>
                    <button class="class-select-btn" data-class="Adept" style="padding: 12px; background: #440044; color: #f0f; border: 2px solid #f0f; cursor: pointer; font-size: 14px;">
                        <strong>ADEPT</strong><br>
                        <span style="font-size: 11px;">Force powers, telepathy, and mental manipulation.</span>
                    </button>
                </div>
            </div>
        `;

        moduleDisplay.innerHTML = `
            <div id="class-preview" style="padding: 10px; color: #fff; font-size: 11px; overflow-y: auto; height: 100%;">
                <p>Hover over a class to see progression table...</p>
            </div>
        `;

        // Add event listeners to class buttons
        document.querySelectorAll('.class-select-btn:not(.locked)').forEach(btn => {
            btn.addEventListener('click', async () => {
                const className = btn.getAttribute('data-class');
                await this.selectClass(className);
            });

            btn.addEventListener('mouseenter', () => {
                const className = btn.getAttribute('data-class');
                this.showClassPreview(className);
            });
        });
    }

    showClassPreview(className) {
        const previewDiv = document.getElementById('class-preview');
        if (!previewDiv || !window.characterStats) return;

        const classData = window.characterStats.getClassProgression(className);
        if (!classData) return;

        const progression = classData.progression;
        const skills = classData.skills_learned || [];

        // Build compact table HTML
        let tableHTML = `
            <div style="font-family: 'Courier New', monospace; font-size: 9px;">
                <h3 style="color: #ff0; margin-bottom: 5px; font-size: 12px;">${className} (1-20)</h3>
                <table style="width: 100%; border-collapse: collapse; color: #0f0;">
                    <thead>
                        <tr style="background: #222; color: #ff0; font-size: 8px;">
                            <th>Lv</th>
                            <th>HP</th>
                            <th>S</th><th>D</th><th>C</th><th>I</th><th>W</th><th>Ch</th>
                            ${skills.slice(0, 4).map(s => `<th title="${s}">${s.substring(0, 3)}</th>`).join('')}
                            <th>Arm</th>
                            <th>Wep</th>
                            <th>Dmg%</th>
                            <th>Eng%</th>
                            <th>Ally</th>
                            <th style="min-width: 80px;">Special</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (let i = 0; i < Math.min(20, progression.length); i++) {
            const level = progression[i];
            const hp = ((classData.base_stats.starting_hp_base + level.con + ((i + 1) * classData.base_stats.hp_per_level)) * 10);

            tableHTML += `
                <tr style="border-bottom: 1px solid #333;">
                    <td style="color: #0ff;">${i + 1}</td>
                    <td>${hp}</td>
                    <td>${level.str}</td>
                    <td>${level.dex}</td>
                    <td>${level.con}</td>
                    <td>${level.int}</td>
                    <td>${level.wis}</td>
                    <td>${level.cha}</td>
                    ${skills.slice(0, 4).map(s => `<td>${level[s.toLowerCase()] || 0}</td>`).join('')}
                    <td>${level.armor || 0}</td>
                    <td>${level.weapon_slots || 0}</td>
                    <td style="color: #f80;">+${level.damage_bonus_pct || 0}</td>
                    <td style="color: #08f;">+${level.energy_max_bonus_pct || 0}</td>
                    <td>${level.max_allies || 0}</td>
                    <td style="color: #ff0; font-size: 8px;">${level.special || ''}</td>
                </tr>
            `;
        }

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        previewDiv.innerHTML = tableHTML;
    }

    async selectClass(className) {
        if (!window.characterStats) return;

        const success = await window.characterStats.selectClass(className);
        if (success) {
            console.log(`Class selected: ${className}`);
            this.updateD20Display();
        }
    }

    updateD20Display() {
        if (!window.characterStats) {
            return;
        }

        // If no class selected, show message to visit The Guide (reusing header for message)
        const headerTitle = document.getElementById('char-sheet-title');

        if (!window.characterStats.currentClass) {
            if (headerTitle) headerTitle.textContent = "NO CLASS SELECTED";
            const statsDisplay = document.getElementById('stats-display');
            const moduleGrid = document.getElementById('module-grid');

            if (statsDisplay) {
                statsDisplay.innerHTML = `
                    <div style="color: #0ff; font-size: 14px; line-height: 1.6; text-align: center;">
                        Visit The Guide to select your class.
                    </div>
                `;
            }
            if (moduleGrid) moduleGrid.innerHTML = '';
            return;
        }

        // Check for pending power choice
        if (window.characterStats.currentClass && window.characterStats.pendingPowerChoice) {
            this.showPowerChoiceUI();
            return;
        }

        const data = window.characterStats.getDisplayData();
        const classData = window.characterStats.currentClassData;

        // Rename Tech to Slicer
        let displayClassName = data.currentClass;
        if (displayClassName === "Techie") displayClassName = "Slicer";

        // 1. UPDATE HEADER - Format: "[CLASS] GONK"
        if (headerTitle) {
            headerTitle.textContent = `${displayClassName.toUpperCase()} GONK`;
        }

        // Calculate HP
        const correctMaxHp = (5 * data.stats.CON) + (data.level * (classData?.base_stats?.hp_per_level || 10));

        // 2. UPDATE SIDEBAR (Stats & Resources)
        const statsDisplay = document.getElementById('stats-display');
        if (statsDisplay) {
            statsDisplay.innerHTML = `
                <!-- STATS BLOCK -->
                <div style="margin-bottom: 30px; width: 100%;">
                    <div style="font-size: 24px; line-height: 1.8; font-weight: bold;">
                        <div style="display: flex; justify-content: space-between;"><span style="color: #0ff;">STR</span> <span style="color: #fff;">${data.stats.STR}</span></div>
                        <div style="display: flex; justify-content: space-between;"><span style="color: #0ff;">DEX</span> <span style="color: #fff;">${data.stats.DEX}</span></div>
                        <div style="display: flex; justify-content: space-between;"><span style="color: #0ff;">CON</span> <span style="color: #fff;">${data.stats.CON}</span></div>
                        <div style="display: flex; justify-content: space-between;"><span style="color: #0ff;">INT</span> <span style="color: #fff;">${data.stats.INT}</span></div>
                        <div style="display: flex; justify-content: space-between;"><span style="color: #0ff;">WIS</span> <span style="color: #fff;">${data.stats.WIS}</span></div>
                        <div style="display: flex; justify-content: space-between;"><span style="color: #0ff;">CHA</span> <span style="color: #fff;">${data.stats.CHA}</span></div>
                    </div>
                </div>

                <!-- VITALS BLOCK -->
                <div style="margin-bottom: 30px; width: 100%;">
                    <div style="color: #f00; font-size: 20px; font-weight: bold; margin-bottom: 5px;">HP: <span style="color: #fff; float: right;">${data.hp}/${correctMaxHp}</span></div>
                    <div style="color: #0ff; font-size: 20px; font-weight: bold; margin-bottom: 5px;">ENERGY: <span style="color: #fff; float: right;">${data.maxEnergy}</span></div>
                    <div style="color: #0f0; font-size: 16px; font-weight: bold;">POWER/SEC: <span style="color: #fff; float: right;">${data.energyRegenBonusPct}%</span></div>
                </div>

                 <!-- LEVEL INFO -->
                <div style="margin-bottom: 30px; width: 100%; text-align: center;">
                    <div style="color: #ff0; font-size: 24px; font-weight: bold;">LEVEL ${data.level}</div>
                </div>

                <!-- RESOURCES BLOCK (Moved from absolute) -->
                <div style="margin-top: auto; width: 100%; border-top: 2px solid #333; padding-top: 20px;">
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                        <img src="data/pngs/HUD/CharacterSheet/scrapsymbol.png" style="width: 40px; height: 40px; margin-right: 15px;">
                        <span style="font-size: 32px; color: #fff; font-weight: bold;">${window.game?.state?.wire || 0}</span>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <img src="data/pngs/HUD/CharacterSheet/creditssymbol.png" style="width: 40px; height: 40px; margin-right: 15px;">
                        <span style="font-size: 32px; color: #ff0; font-weight: bold;">${window.game?.state?.credits || 0}</span>
                    </div>
                </div>
            `;
        }
        console.log('[updateD20Display] About to update module grid with powers:', data.powers);

        // 3. UPDATE MODULE GRID
        // Using data.powers which comes from getDisplayData()
        this.updateModuleGrid(data.powers || [], classData);

        console.log('[updateD20Display] COMPLETE - Character sheet should now be populated');
    }

    // Function to handle showing the power choice UI
    showPowerChoiceUI() {
        const data = window.characterStats.getDisplayData();
        const choice = data.pendingPowerChoice;

        const statsDisplay = document.getElementById('stats-display');
        const moduleDisplay = document.getElementById('module-display');

        if (!statsDisplay || !moduleDisplay || !choice) return;

        statsDisplay.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20px;">
                <h1 style="color: #ff0; font-size: 24px; margin-bottom: 20px;">LEVEL ${choice.level}</h1>
                <h2 style="color: #0ff; font-size: 18px; margin-bottom: 30px;">CHOOSE YOUR POWER</h2>

                <div style="display: flex; flex-direction: column; gap: 20px; width: 100%;">
                    <div style="padding: 20px; background: rgba(0,255,0,0.1); border: 3px solid #0f0;">
                        <div style="color: #0f0; font-size: 20px; margin-bottom: 10px;">Q</div>
                        <div style="color: #ff0; font-size: 16px; font-weight: bold; margin-bottom: 10px;">${choice.options[0]}</div>
                        <div style="color: #0ff; font-size: 12px;">${window.characterStats.getPowerDescription(choice.options[0])}</div>
                    </div>

                    <div style="padding: 20px; background: rgba(0,255,255,0.1); border: 3px solid #0ff;">
                        <div style="color: #0ff; font-size: 20px; margin-bottom: 10px;">E</div>
                        <div style="color: #ff0; font-size: 16px; font-weight: bold; margin-bottom: 10px;">${choice.options[1]}</div>
                        <div style="color: #0ff; font-size: 12px;">${window.characterStats.getPowerDescription(choice.options[1])}</div>
                    </div>
                </div>

                <div style="margin-top: 20px; color: #666; font-size: 12px;">Press Q or E to choose</div>
            </div>
        `;

        moduleDisplay.innerHTML = `
            <div style="padding: 20px; color: #fff; font-size: 14px;">
                <h3 style="color: #ff0; margin-bottom: 15px;">Power Choice</h3>
                <p style="color: #0f0; margin-bottom: 10px;">This is a permanent choice for this run.</p>
                <p style="color: #0ff;">Choose the power that best fits your playstyle and current situation.</p>
            </div>
        `;

        // Setup Q/E keybinds for power selection
        const handlePowerChoice = (e) => {
            if (e.key === 'q' || e.key === 'Q') {
                window.characterStats.selectPower(choice.options[0]);
                this.updateD20Display();
                document.removeEventListener('keydown', handlePowerChoice);
            } else if (e.key === 'e' || e.key === 'E') {
                window.characterStats.selectPower(choice.options[1]);
                this.updateD20Display();
                document.removeEventListener('keydown', handlePowerChoice);
            }
        };

        document.addEventListener('keydown', handlePowerChoice);
    }

    // Legacy compatibility methods (keep for old system)
    autoUnlockCarryPowers() {
        // No-op for table-based system
    }

    unlockNode(nodeKey) {
        // No-op for table-based system
    }

    updateOldDisplay() {
        // No-op for table-based system
    }

    getModuleData() {
        // Module descriptions and effects database
        // Rank notation: some modules have ranks 1-5 with scaling bonuses
        // Format: "Module Name 3" = Rank 3 version
        return {
            // ===== BLUE DROID SKILL MODULES =====
            'Intimidate': {
                type: 'skill',
                faction: 'droid',
                color: '#0ff',
                rank: 1,
                description: 'Cause fear in organic enemies, forcing them to flee.',
                effects: [
                    'STR-based skill check',
                    'Success: Target flees for 5 seconds',
                    'Failure: Backfires into combat',
                    'CLASS ONLY ability'
                ]
            },
            'Jump 1': {
                type: 'skill',
                faction: 'droid',
                color: '#0ff',
                rank: 1,
                scaling: 'percent_per_level',
                baseValue: 1,
                description: 'Enhanced jump servos increase vertical leap capability.',
                effects: [
                    '+1% jump height per level',
                    'DEX-based skill for acrobatic maneuvers',
                    'Stacks with other jump bonuses'
                ]
            },
            'Jump 2': {
                type: 'skill',
                faction: 'droid',
                color: '#0ff',
                rank: 2,
                scaling: 'percent_per_level',
                baseValue: 1.2,
                description: 'Enhanced jump servos increase vertical leap capability.',
                effects: [
                    '+1.2% jump height per level',
                    'DEX-based skill for acrobatic maneuvers',
                    'Stacks with other jump bonuses'
                ]
            },
            'Jump 3': {
                type: 'skill',
                faction: 'droid',
                color: '#0ff',
                rank: 3,
                scaling: 'percent_per_level',
                baseValue: 1.5,
                description: 'Enhanced jump servos increase vertical leap capability.',
                effects: [
                    '+1.5% jump height per level',
                    'DEX-based skill for acrobatic maneuvers',
                    'Stacks with other jump bonuses'
                ]
            },
            'Jump 4': {
                type: 'skill',
                faction: 'droid',
                color: '#0ff',
                rank: 4,
                scaling: 'percent_per_level',
                baseValue: 1.8,
                description: 'Enhanced jump servos increase vertical leap capability.',
                effects: [
                    '+1.8% jump height per level',
                    'DEX-based skill for acrobatic maneuvers',
                    'Stacks with other jump bonuses'
                ]
            },
            'Jump 5': {
                type: 'skill',
                faction: 'droid',
                color: '#0ff',
                rank: 5,
                scaling: 'percent_per_level',
                baseValue: 2,
                description: 'Enhanced jump servos increase vertical leap capability.',
                effects: [
                    '+2% jump height per level',
                    'DEX-based skill for acrobatic maneuvers',
                    'Stacks with other jump bonuses'
                ]
            },
            'Repair': {
                type: 'skill',
                color: '#0ff',
                description: 'Self-repair and droid healing protocols.',
                effects: [
                    'INT-based skill check',
                    'Heals droids and mechanical targets',
                    'Works like Medicine for droid units'
                ]
            },
            'Running 3': {
                type: 'power',
                color: '#0ff',
                description: 'Enhanced locomotion systems increase movement speed.',
                effects: [
                    '+3% movement speed per level',
                    'Stacks with other speed bonuses',
                    'DEX governs running efficiency'
                ]
            },
            'HK Quickcharge 5': {
                type: 'power',
                color: '#0ff',
                description: 'Advanced power cell regeneration system.',
                effects: [
                    '+5% energy regeneration per level',
                    'Stacks with base 3% regen rate',
                    'Can combine with Overcharge modules'
                ]
            },
            'Persuasion': {
                type: 'skill',
                color: '#0ff',
                description: 'Diplomatic protocols for convincing organics.',
                effects: [
                    'CHA-based skill check',
                    'Used in recruitment and negotiation',
                    'Protocol droid specialty'
                ]
            },
            'Perception': {
                type: 'skill',
                color: '#0ff',
                description: 'Enhanced sensors for detecting threats.',
                effects: [
                    'WIS-based skill check',
                    'Reveals hidden enemies and objects',
                    'Increases awareness radius'
                ]
            },
            'Medicine': {
                type: 'skill',
                color: '#0ff',
                description: 'Medical protocols for healing organic allies.',
                effects: [
                    'WIS-based skill check',
                    'Heals organic targets',
                    'Cannot heal droids (use Repair)'
                ]
            },
            'Slicing': {
                type: 'skill',
                color: '#0ff',
                description: 'Hacking and electronic security bypass.',
                effects: [
                    'INT-based skill check',
                    'Opens locked doors and terminals',
                    'Can disable enemy droids temporarily'
                ]
            },
            'Speak Languages': {
                type: 'skill',
                color: '#0ff',
                description: 'Translation protocols for alien species.',
                effects: [
                    'INT-based skill',
                    'Communicate with non-Basic speakers',
                    'Improves conversation outcomes'
                ]
            },
            'Pamphlet Toss': {
                type: 'power',
                color: '#ff0',
                description: 'Launch propaganda pamphlets at enemies.',
                effects: [
                    'Unique Protocol droid weapon',
                    'Low damage, high confusion chance',
                    'Can convert enemies with repeated hits'
                ]
            },
            'Climb': {
                type: 'skill',
                color: '#0ff',
                description: 'Climbing protocols for vertical surfaces.',
                effects: [
                    'STR-based skill check',
                    'Access elevated areas',
                    'Escape combat or find shortcuts'
                ]
            },
            'Insight': {
                type: 'skill',
                color: '#0ff',
                description: 'Read intentions and detect deception.',
                effects: [
                    'WIS-based skill check',
                    'See through lies in conversations',
                    'Predict enemy behavior'
                ]
            },
            'Craft': {
                type: 'skill',
                color: '#0ff',
                description: 'Create items from scavenged materials.',
                effects: [
                    'INT-based skill check',
                    'Build weapons, armor, and tools',
                    'Techie specialty ability'
                ]
            },
            'Scavenge': {
                type: 'skill',
                color: '#0ff',
                description: 'Find valuable components in debris.',
                effects: [
                    'INT-based skill check',
                    'Discover hidden loot',
                    'Increased scrap yield from kills'
                ]
            },
            'Force Heal': {
                type: 'power',
                color: '#f0f',
                description: 'Use the Force to restore health.',
                effects: [
                    'Heals self or allies at range',
                    'No skill check required',
                    'Adept class power'
                ]
            },

            // ===== DROID POWER MODULES (Ranked 1-5) =====
            'Reinforced Plating 1': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 1,
                scaling: 'flat',
                baseValue: 1,
                description: 'Armored plating reduces incoming damage.',
                effects: [
                    '-1 damage per hit taken',
                    'Flat reduction applied before armor',
                    'Droid defensive module'
                ]
            },
            'Reinforced Plating 2': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 2,
                scaling: 'flat',
                baseValue: 2,
                description: 'Armored plating reduces incoming damage.',
                effects: [
                    '-2 damage per hit taken',
                    'Flat reduction applied before armor',
                    'Droid defensive module'
                ]
            },
            'Reinforced Plating 3': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 3,
                scaling: 'flat',
                baseValue: 3,
                description: 'Armored plating reduces incoming damage.',
                effects: [
                    '-3 damage per hit taken',
                    'Flat reduction applied before armor',
                    'Droid defensive module'
                ]
            },
            'Reinforced Plating 4': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 4,
                scaling: 'flat',
                baseValue: 4,
                description: 'Armored plating reduces incoming damage.',
                effects: [
                    '-4 damage per hit taken',
                    'Flat reduction applied before armor',
                    'Droid defensive module'
                ]
            },
            'Reinforced Plating 5': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 5,
                scaling: 'flat',
                baseValue: 5,
                description: 'Armored plating reduces incoming damage.',
                effects: [
                    '-5 damage per hit taken',
                    'Flat reduction applied before armor',
                    'Droid defensive module'
                ]
            },
            'Overclock 1': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 1,
                scaling: 'percent_per_level',
                baseValue: 1,
                description: 'Overclock combat processors for increased damage output.',
                effects: [
                    '+1% damage per level',
                    'Applies to all weapon types',
                    'Stacks with other damage bonuses'
                ]
            },
            'Overclock 2': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 2,
                scaling: 'percent_per_level',
                baseValue: 1.5,
                description: 'Overclock combat processors for increased damage output.',
                effects: [
                    '+1.5% damage per level',
                    'Applies to all weapon types',
                    'Stacks with other damage bonuses'
                ]
            },
            'Overclock 3': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 3,
                scaling: 'percent_per_level',
                baseValue: 2,
                description: 'Overclock combat processors for increased damage output.',
                effects: [
                    '+2% damage per level',
                    'Applies to all weapon types',
                    'Stacks with other damage bonuses'
                ]
            },
            'Overclock 4': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 4,
                scaling: 'percent_per_level',
                baseValue: 2.5,
                description: 'Overclock combat processors for increased damage output.',
                effects: [
                    '+2.5% damage per level',
                    'Applies to all weapon types',
                    'Stacks with other damage bonuses'
                ]
            },
            'Overclock 5': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 5,
                scaling: 'percent_per_level',
                baseValue: 3,
                description: 'Overclock combat processors for increased damage output.',
                effects: [
                    '+3% damage per level',
                    'Applies to all weapon types',
                    'Stacks with other damage bonuses'
                ]
            },
            'Cooling Loop 1': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 1,
                scaling: 'flat',
                baseValue: 1,
                description: 'Enhanced cooling systems increase maximum Power capacity.',
                effects: [
                    '+1 maximum Power',
                    'Allows more weapon usage before recharge',
                    'Permanent capacity increase'
                ]
            },
            'Cooling Loop 2': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 2,
                scaling: 'flat',
                baseValue: 2,
                description: 'Enhanced cooling systems increase maximum Power capacity.',
                effects: [
                    '+2 maximum Power',
                    'Allows more weapon usage before recharge',
                    'Permanent capacity increase'
                ]
            },
            'Cooling Loop 3': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 3,
                scaling: 'flat',
                baseValue: 3,
                description: 'Enhanced cooling systems increase maximum Power capacity.',
                effects: [
                    '+3 maximum Power',
                    'Allows more weapon usage before recharge',
                    'Permanent capacity increase'
                ]
            },
            'Cooling Loop 4': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 4,
                scaling: 'flat',
                baseValue: 4,
                description: 'Enhanced cooling systems increase maximum Power capacity.',
                effects: [
                    '+4 maximum Power',
                    'Allows more weapon usage before recharge',
                    'Permanent capacity increase'
                ]
            },
            'Cooling Loop 5': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 5,
                scaling: 'flat',
                baseValue: 5,
                description: 'Enhanced cooling systems increase maximum Power capacity.',
                effects: [
                    '+5 maximum Power',
                    'Allows more weapon usage before recharge',
                    'Permanent capacity increase'
                ]
            },
            'Factory Reset Core 1': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 1,
                scaling: 'flat',
                baseValue: 1,
                description: 'Emergency backup core grants bonus revival if missing.',
                effects: [
                    'Grants 1 bonus core at level start if you have none',
                    'Does not stack with multiple copies',
                    'Rare droid survival module'
                ]
            },
            'Factory Reset Core 2': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 2,
                scaling: 'flat',
                baseValue: 1,
                description: 'Emergency backup core grants bonus revival if missing.',
                effects: [
                    'Grants 1 bonus core at level start if you have none',
                    'Does not stack with multiple copies',
                    'Rare droid survival module'
                ]
            },
            'Factory Reset Core 3': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 3,
                scaling: 'flat',
                baseValue: 1,
                description: 'Emergency backup core grants bonus revival if missing.',
                effects: [
                    'Grants 1 bonus core at level start if you have none',
                    'Does not stack with multiple copies',
                    'Rare droid survival module'
                ]
            },
            'Factory Reset Core 4': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 4,
                scaling: 'flat',
                baseValue: 1,
                description: 'Emergency backup core grants bonus revival if missing.',
                effects: [
                    'Grants 1 bonus core at level start if you have none',
                    'Does not stack with multiple copies',
                    'Rare droid survival module'
                ]
            },
            'Factory Reset Core 5': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 5,
                scaling: 'flat',
                baseValue: 1,
                description: 'Emergency backup core grants bonus revival if missing.',
                effects: [
                    'Grants 1 bonus core at level start if you have none',
                    'Does not stack with multiple copies',
                    'Rare droid survival module'
                ]
            },
            'Servo Strength 1': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 1,
                scaling: 'percent_per_level',
                baseValue: 1,
                description: 'Enhanced servo motors increase melee combat effectiveness.',
                effects: [
                    '+1% melee damage per level',
                    'Only affects melee weapons',
                    'Stacks with Overclock for massive melee builds'
                ]
            },
            'Servo Strength 2': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 2,
                scaling: 'percent_per_level',
                baseValue: 1.5,
                description: 'Enhanced servo motors increase melee combat effectiveness.',
                effects: [
                    '+1.5% melee damage per level',
                    'Only affects melee weapons',
                    'Stacks with Overclock for massive melee builds'
                ]
            },
            'Servo Strength 3': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 3,
                scaling: 'percent_per_level',
                baseValue: 2,
                description: 'Enhanced servo motors increase melee combat effectiveness.',
                effects: [
                    '+2% melee damage per level',
                    'Only affects melee weapons',
                    'Stacks with Overclock for massive melee builds'
                ]
            },
            'Servo Strength 4': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 4,
                scaling: 'percent_per_level',
                baseValue: 2.5,
                description: 'Enhanced servo motors increase melee combat effectiveness.',
                effects: [
                    '+2.5% melee damage per level',
                    'Only affects melee weapons',
                    'Stacks with Overclock for massive melee builds'
                ]
            },
            'Servo Strength 5': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 5,
                scaling: 'percent_per_level',
                baseValue: 3,
                description: 'Enhanced servo motors increase melee combat effectiveness.',
                effects: [
                    '+3% melee damage per level',
                    'Only affects melee weapons',
                    'Stacks with Overclock for massive melee builds'
                ]
            },
            'Running 1': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 1,
                scaling: 'percent_per_level',
                baseValue: 1,
                description: 'Enhanced locomotion systems increase movement speed.',
                effects: [
                    '+1% movement speed per level',
                    'Stacks with other speed bonuses',
                    'DEX governs running efficiency'
                ]
            },
            'Running 2': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 2,
                scaling: 'percent_per_level',
                baseValue: 1.5,
                description: 'Enhanced locomotion systems increase movement speed.',
                effects: [
                    '+1.5% movement speed per level',
                    'Stacks with other speed bonuses',
                    'DEX governs running efficiency'
                ]
            },
            'Running 3': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 3,
                scaling: 'percent_per_level',
                baseValue: 2,
                description: 'Enhanced locomotion systems increase movement speed.',
                effects: [
                    '+2% movement speed per level',
                    'Stacks with other speed bonuses',
                    'DEX governs running efficiency'
                ]
            },
            'Running 4': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 4,
                scaling: 'percent_per_level',
                baseValue: 2.5,
                description: 'Enhanced locomotion systems increase movement speed.',
                effects: [
                    '+2.5% movement speed per level',
                    'Stacks with other speed bonuses',
                    'DEX governs running efficiency'
                ]
            },
            'Running 5': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 5,
                scaling: 'percent_per_level',
                baseValue: 3,
                description: 'Enhanced locomotion systems increase movement speed.',
                effects: [
                    '+3% movement speed per level',
                    'Stacks with other speed bonuses',
                    'DEX governs running efficiency'
                ]
            },
            'HK Quickcharge 1': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 1,
                scaling: 'percent_per_level',
                baseValue: 1,
                description: 'Advanced power cell regeneration system.',
                effects: [
                    '+1% energy regeneration per level',
                    'Stacks with base 3% regen rate',
                    'Can combine with Overcharge modules'
                ]
            },
            'HK Quickcharge 2': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 2,
                scaling: 'percent_per_level',
                baseValue: 1.5,
                description: 'Advanced power cell regeneration system.',
                effects: [
                    '+1.5% energy regeneration per level',
                    'Stacks with base 3% regen rate',
                    'Can combine with Overcharge modules'
                ]
            },
            'HK Quickcharge 3': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 3,
                scaling: 'percent_per_level',
                baseValue: 2,
                description: 'Advanced power cell regeneration system.',
                effects: [
                    '+2% energy regeneration per level',
                    'Stacks with base 3% regen rate',
                    'Can combine with Overcharge modules'
                ]
            },
            'HK Quickcharge 4': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 4,
                scaling: 'percent_per_level',
                baseValue: 2.5,
                description: 'Advanced power cell regeneration system.',
                effects: [
                    '+2.5% energy regeneration per level',
                    'Stacks with base 3% regen rate',
                    'Can combine with Overcharge modules'
                ]
            },
            'HK Quickcharge 5': {
                type: 'power',
                faction: 'droid',
                color: '#0ff',
                rank: 5,
                scaling: 'percent_per_level',
                baseValue: 3,
                description: 'Advanced power cell regeneration system.',
                effects: [
                    '+3% energy regeneration per level',
                    'Stacks with base 3% regen rate',
                    'Can combine with Overcharge modules'
                ]
            }
        };
    }

    setupModuleTooltips() {
        const tooltip = document.getElementById('module-tooltip');
        if (!tooltip) return;

        const moduleData = this.getModuleData();

        document.querySelectorAll('.module-slot').forEach(slot => {
            const moduleName = slot.getAttribute('data-module-name');
            if (!moduleName) return;

            slot.addEventListener('mouseenter', (e) => {
                const data = moduleData[moduleName];
                if (!data) return;

                // Populate tooltip
                document.getElementById('tooltip-module-name').textContent = moduleName;
                document.getElementById('tooltip-module-description').textContent = data.description;

                const effectsList = data.effects.map(effect => `• ${effect}`).join('<br>');
                document.getElementById('tooltip-module-effects').innerHTML = effectsList;

                // Position tooltip near cursor
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY + 15) + 'px';
            });

            slot.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });

            slot.addEventListener('mousemove', (e) => {
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY + 15) + 'px';
            });
        });
    }
}

// Global instance
window.characterUpgrades = new CharacterUpgrades();
