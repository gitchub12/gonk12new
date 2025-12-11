// BROWSERFIREFOXHIDE editor_ui_and_assets.js
// update: The asset manager now correctly reads and stores the `soundSet` property from charactersdotjson, fixing the NPC hurt sound data pipeline.
// update: Rewrote the skybox palette UI to use a clearer "None/Static/Animated" selection method.
// fix: Skybox discovery now stores full paths for static files, fixing 404 errors in editor palette previews.
// fix: Skybox folders now display as folder icons instead of attempting to load them as images.
// fix: Skybox key extraction now properly saves just the filename to level JSON for game compatibility.
// fix: Furniture discovery now auto-scans models/block/ folder instead of relying on manual furniture_config.json.
class EditorAssetManager {
    constructor(modelSystem) {
        this.modelSystem = modelSystem;
        this.npcGroups = {}; // This will be populated by discoverAssets
        this.npcIcons = new Map();
        this.isCharacterDataDirty = false;
        this.furnitureJsons = new Map();
        this.assetIcons = new Map();
        this.nameData = {};
        this.nameData = {};
        this.npcWeaponData = {};
        this.speciesData = {}; // Initialize speciesData
        this.npcClasses = {};  // Initialize npcClasses
        this.weaponPaths = [];
        this.textureLayers = [
            'subfloor', 'floor', 'water', 'floater', 'decor', 'ceiling', 'ceilingsides', 'sky',
            'wall', 'door', 'dock', 'screen', 'panel', 'dangler', 'spawn', 'loadscreens',
            'skybox', 'elevation', 'elevationsides', 'pillar'
        ];
        this.layerTextures = {};
        this.textureLayers.forEach(type => this.layerTextures[type] = []);
        this.skyboxStaticFiles = [];
        this.skyboxAnimationFolders = [];
        this.musicLibrary = {}; // { category: [trackPath, ...], ... }
        this.musicCategories = [];
        this.editorConfig = null; // Will be loaded from data/editor_config.json
    }

    async fetchDirectoryListing(path, extensions = ['.png'], allowDirectories = false) {
        try {
            const response = await fetch(path);
            if (!response.ok) return [];
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => {
                    if (!href || href.startsWith('?') || href.startsWith('../')) return false;
                    const isDir = href.endsWith('/');
                    if (allowDirectories && isDir) return true;
                    return !isDir && extensions.some(ext => href.endsWith(ext));
                });
        } catch (e) {
            console.warn(`Could not fetch directory listing for "${path}".`);
            return [];
        }
    }

    async fetchDirectoryListingRecursive(path, extensions = ['.png'], maxDepth = 3, currentDepth = 0) {
        if (currentDepth >= maxDepth) return [];

        try {
            const items = await this.fetchDirectoryListing(path, extensions, true);
            const files = items.filter(item => !item.endsWith('/'));
            const dirs = items.filter(item => item.endsWith('/'));

            // Get files from current directory
            const allFiles = files.map(file => `${path}${file}`);

            // Recursively scan subdirectories
            for (const dir of dirs) {
                const subFiles = await this.fetchDirectoryListingRecursive(`${path}${dir}`, extensions, maxDepth, currentDepth + 1);
                allFiles.push(...subFiles);
            }

            return allFiles;
        } catch (e) {
            console.warn(`Could not recursively fetch directory listing for "${path}".`);
            return [];
        }
    }

    async loadEditorConfig() {
        try {
            const response = await fetch('/data/editor_config.json');
            const text = await response.text();
            const cleanText = text.split('\n').filter(line => !line.trim().startsWith('#') && !line.trim().startsWith('//')).join('\n');
            this.editorConfig = JSON.parse(cleanText);
            console.log('[EditorAssetManager] Loaded editor config');
        } catch (e) {
            console.error('[EditorAssetManager] Failed to load editor_config.json:', e);
            // Provide fallback defaults
            this.editorConfig = {
                furnitureIconPatterns: [
                    "/data/furniture/textures/blocks/${modelKey}pic.png",
                    "/data/furniture/textures/items/${modelKey}pic.png",
                    "/data/furniture/textures/blocks/${modelKey}_pic.png",
                    "/data/furniture/textures/items/${modelKey}_pic.png"
                ],
                furnitureIconOverrides: {}
            };
        }
    }

    async discoverAssets() {
        // Load config first
        await this.loadEditorConfig();

        // Load Prerequisites (Species, Classes, Weapons)
        await Promise.all([
            this.loadSpeciesData(),
            this.loadNPCClasses(),
            this.loadNpcWeaponMasterList()
        ]);

        this.npcGroups = {
            _globals: {},
            _base_type_defaults: {}
        };

        const characterDataFiles = [
            '0_globals.json', '1_aliens.json', '2_clones.json', '3_rebels.json',
            '4_mandolorians.json', '5_sith.json', '6_imperials.json', '7_takers.json',
            '8_droids.json'
        ];

        for (const fileName of characterDataFiles) {
            try {
                const path = fileName === '0_globals.json'
                    ? `/data/${fileName}`
                    : `/data/factionJSONs/${fileName}`;
                const response = await fetch(path);
                // Fetch as text first to strip out comments (lines starting with #)
                let text = await response.text();

                // Attempt to fix unterminated strings, a common manual JSON editing error.
                if (text.includes('Unterminated string in JSON')) {
                    text = text.replace(/:\s*"([^"\n]*)$/gm, ' "$1",');
                }

                const cleanText = text.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
                const data = JSON.parse(cleanText);

                if (data.defaults) { // From 0_globals.json
                    this.npcGroups._globals = { ...this.npcGroups._globals, ...data.defaults };
                }
                if (data.base_type_defaults) { // From other files
                    this.npcGroups._base_type_defaults = { ...this.npcGroups._base_type_defaults, ...data.base_type_defaults };
                }
                // Add the main character groups, skipping special keys
                Object.keys(data).filter(key => !['_comment', 'defaults', 'base_type_defaults'].includes(key)).forEach(key => {
                    this.npcGroups[key] = data[key];
                });
            } catch (e) {
                console.error(`Failed to load or parse ${fileName}`, e);
            }
        }

        // Load name data here to make it globally available
        try {
            const response = await fetch('/data/npc_names.json');
            this.nameData = await response.json();
            // The JSON file has a _comment key, which should be removed.
            if (this.nameData._comment) {
                delete this.nameData._comment;
            }
        } catch (e) {
            console.error("Failed to load npc_names.json", e);
        }

        // Load NPC weapon data
        try {
            const response = await fetch('/data/npc_weapons.json');
            const text = await response.text();
            const cleanText = text.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
            this.npcWeaponData = JSON.parse(cleanText);
        } catch (e) {
            console.error("Failed to load npc_weapons.json", e);
        }

        for (const layerType of this.textureLayers) {
            if (layerType === 'skybox') {
                const skyboxPath = `/data/pngs/skybox/`;
                const serverItems = await this.fetchDirectoryListing(skyboxPath, ['.png', '.jpg', '.jpeg'], true);
                // Store full paths for static files so they can be previewed
                this.skyboxStaticFiles = serverItems.filter(item => !item.endsWith('/')).map(f => `${skyboxPath}${f}`);
                // Store folder names (without trailing slash) for animated/random folders
                this.skyboxAnimationFolders = serverItems.filter(item => item.endsWith('/')).map(item => item.slice(0, -1));
            }

            // Layers that have style/theme subdirectories need recursive scanning
            const recursiveLayers = ['floor', 'ceiling', 'door', 'ceilingsides', 'wall'];

            if (recursiveLayers.includes(layerType)) {
                const path = `/data/pngs/${layerType}/`;
                const allFiles = await this.fetchDirectoryListingRecursive(path, ['.png']);
                this.layerTextures[layerType].push(...allFiles);
            } else {
                let pathsToSearch = [`/data/pngs/${layerType}/`];
                for (const path of pathsToSearch) {
                    const textureFiles = await this.fetchDirectoryListing(path, ['.png']);
                    this.layerTextures[layerType].push(...textureFiles.map(file => `${path}${file}`));
                }
            }
        }

        await this.generateNpcIcons();

        // FIX: Scan all subdirectories within NPConlyweapons to correctly discover all weapon assets.
        const weaponRoot = '/data/NPConlyweapons/';
        const weaponCategories = ['longarm', 'melee', 'pistol', 'rifle', 'saber', 'unique'];
        const allWeaponPaths = [];
        for (const category of weaponCategories) {
            const categoryPath = `${weaponRoot}${category}/`;
            try {
                const files = await this.fetchDirectoryListing(categoryPath, ['.png']);
                files.forEach(file => {
                    allWeaponPaths.push(`${categoryPath}${file}`);
                });
            } catch (e) { console.warn(`Could not discover NPC weapons in ${categoryPath}`); }
        }
        this.weaponPaths = allWeaponPaths;

        // Auto-discover furniture models from models/block/ folder
        try {
            const blockPath = '/data/furniture/models/block/';
            const response = await fetch(blockPath);
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = Array.from(doc.querySelectorAll('a'))
                    .map(a => a.getAttribute('href'))
                    .filter(href => href && href.endsWith('.json') && !href.includes('/'));

                console.log(`Discovered ${links.length} furniture models from models/block/`);

                // Load all furniture icons in parallel - local server can handle it
                const iconPromises = links.map(async (jsonFile) => {
                    const modelKey = jsonFile.replace('.json', '');
                    this.furnitureJsons.set(modelKey, `${blockPath}${jsonFile}`);

                    try {
                        const response = await fetch(`${blockPath}${jsonFile}`);
                        const data = await response.json();
                        if (data.textures && data.textures.all) {
                            const texturePath = data.textures.all.replace(/^[^:]+:/, ''); // remove namespace
                            const fullTexturePath = `/data/furniture/textures/${texturePath}.png`;

                            // Verify the texture exists
                            const res = await fetch(fullTexturePath, { method: 'HEAD' });
                            if (res.ok) {
                                this.assetIcons.set(modelKey, fullTexturePath);
                                return;
                            }
                        }
                    } catch (e) {
                        console.warn(`Could not read furniture json ${jsonFile} for icon path`, e);
                    }

                    // Fallback to old logic if 'all' texture is not defined or not found
                    // Check for override first
                    const override = this.editorConfig?.furnitureIconOverrides?.[modelKey];
                    if (override) {
                        const paths = [
                            `/data/furniture/textures/blocks/${override}`,
                            `/data/furniture/textures/items/${override}`
                        ];
                        for (const path of paths) {
                            try {
                                const res = await fetch(path, { method: 'HEAD' }); // HEAD request is faster
                                if (res.ok) {
                                    this.assetIcons.set(modelKey, path);
                                    return;
                                }
                            } catch (e) { }
                        }
                    }

                    // Try standard patterns
                    const patterns = [
                        `/data/furniture/textures/blocks/${modelKey}pic.png`,
                        `/data/furniture/textures/items/${modelKey}pic.png`,
                        `/data/furniture/textures/blocks/${modelKey}_pic.png`,
                        `/data/furniture/textures/items/${modelKey}_pic.png`
                    ];

                    for (const path of patterns) {
                        try {
                            const res = await fetch(path, { method: 'HEAD' });
                            if (res.ok) {
                                this.assetIcons.set(modelKey, path);
                                return;
                            }
                        } catch (e) { }
                    }

                    // Fallback to placeholder
                    this.assetIcons.set(modelKey, this.createPlaceholderIcon(modelKey));
                });

                await Promise.all(iconPromises);
                console.log(`Loaded ${this.furnitureJsons.size} furniture models`);
            } else {
                console.warn("Could not fetch furniture models/block/ directory listing.");
            }
        } catch (e) { console.error("Failed to discover furniture assets:", e); }

        // Discover music categories and tracks
        await this.discoverMusic();

        return true;
    }

    async discoverMusic() {
        const musicRoot = '/data/sounds/MUSIC/';
        try {
            const response = await fetch(musicRoot);
            if (!response.ok) {
                console.warn(`Music directory not found: ${musicRoot}`);
                return;
            }
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href'));

            for (const href of links) {
                if (href.endsWith('/') && !href.startsWith('..') && !href.startsWith('?')) {
                    const categoryName = href.slice(0, -1);
                    await this.discoverTracksInCategory(categoryName, musicRoot);
                }
            }
            this.musicCategories = Object.keys(this.musicLibrary);
            console.log(`Discovered ${this.musicCategories.length} music categories.`);
        } catch (e) {
            console.warn(`Could not scan music root directory: ${musicRoot}`, e);
        }
    }

    async discoverTracksInCategory(category, musicRoot) {
        const categoryPath = `${musicRoot}${category}/`;
        try {
            const response = await fetch(categoryPath);
            if (!response.ok) return;

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href'));

            const tracks = [];
            for (const href of links) {
                if (href.endsWith('.mp3') || href.endsWith('.ogg') || href.endsWith('.wav')) {
                    tracks.push(`${categoryPath}${href}`);
                }
            }

            if (tracks.length > 0) {
                this.musicLibrary[category] = tracks;
            }
        } catch (e) {
            console.warn(`Could not scan music category: ${categoryPath}`, e);
        }
    }

    createPlaceholderIcon(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#555'; ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; ctx.fillText(name, 32, 32);
        return canvas.toDataURL();
    }

    detectArmType(image) {
        if (image.width < 64 || image.height < 64) return 'steve';

        if (!image.canvas) {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(image, 0, 0);
            image.canvas = canvas;
            image.canvasContext = ctx;
        }

        const ctx = image.canvasContext;
        const scale = image.width / 64;
        const pixelX = 54 * scale;
        const pixelY = 20 * scale;

        try {
            const pixelData = ctx.getImageData(pixelX, pixelY, 1, 1).data;
            return pixelData[3] === 0 ? 'alex' : 'steve';
        } catch (e) {
            console.warn("Could not detect arm type due to canvas security restrictions.", e);
            return 'steve';
        }
    }

    async generateNpcIcons() {
        const iconPromises = [];
        const skinPathPrefix = '/data/skins/';
        for (const groupKey in this.npcGroups) {
            if (groupKey === "_comment") continue;
            const group = this.npcGroups[groupKey];
            if (!group.path || !group.textures) continue;

            for (const textureEntry of group.textures) {
                const isStringEntry = typeof textureEntry === 'string';
                let textureFile = isStringEntry ? textureEntry : textureEntry.file;
                let armType = isStringEntry ? 'steve' : (textureEntry.armType || 'unknown'); // FIX: Correctly read snake_case properties from JSON
                const defaultWeapon = isStringEntry ? null : textureEntry.default_weapon;
                const soundSet = isStringEntry ? null : textureEntry.soundSet;

                if (!textureFile) continue;

                const skinName = textureFile.replace('.png', '');
                const fullPath = `${skinPathPrefix}${group.path}${textureFile}`;

                const promise = new Promise(resolve => {
                    const loader = new THREE.TextureLoader();
                    loader.load(fullPath, async (loadedTexture) => {
                        if (armType === 'unknown') {
                            armType = this.detectArmType(loadedTexture.image);
                            if (isStringEntry) {
                                const index = group.textures.indexOf(textureEntry);
                                if (index !== -1) {
                                    group.textures[index] = { file: textureFile, armType: armType };
                                }
                            } else {
                                textureEntry.armType = armType;
                            }
                            this.isCharacterDataDirty = true;
                        }

                        const iconDataUrl = await window.generateNpcIconDataUrl(loadedTexture);
                        if (iconDataUrl) {
                            this.npcIcons.set(skinName, {
                                icon: iconDataUrl,
                                group: groupKey,
                                // --- Start of Data Consolidation ---
                                // Combine global, base type, and individual texture properties
                                config: {
                                    ...this.npcGroups._globals, // Universal defaults
                                    ...(this.npcGroups._base_type_defaults[group.baseType] || {}), // Base type defaults
                                    ...(typeof textureEntry === 'object' ? textureEntry : { file: textureEntry }), // Individual overrides
                                    // Ensure critical properties are set
                                    file: textureFile,
                                    armType: armType,
                                    soundSet: soundSet,
                                    default_weapon: defaultWeapon,
                                    baseType: group.baseType,
                                    faction: group.faction,
                                    macroCategory: group.macroCategory
                                }
                                // --- End of Data Consolidation ---
                            });
                            const img = new Image();
                            img.src = iconDataUrl;
                            window[skinName + '_icon_img'] = img;
                        }
                        resolve();
                    }, undefined, () => resolve());
                });
                iconPromises.push(promise);
            }
        }
        await Promise.all(iconPromises);
    }

    getNpcsByCriteria(criteria) {
        const { threat, macroCategory, subgroup } = criteria;
        const matchingNpcs = [];

        console.log(`[getNpcsByCriteria] Query: threat=${threat}, macroCategory=${macroCategory}, subgroup=${subgroup}, total npcIcons=${this.npcIcons.size}`);

        // This mapping logic translates a subgroup string into a check against an NPC's config.
        const subgroupDefs = {
            'gamorrean': (cfg) => cfg.baseType === 'gamorrean',
            'gungan': (cfg) => cfg.baseType === 'gungan',
            'wookiee': (cfg) => cfg.baseType === 'wookiee',
            'ewok': (cfg) => cfg.baseType === 'halfpint',
            'jawa': (cfg) => cfg.baseType === 'quarterpint',
            'rebel_male': (cfg) => cfg.faction === 'rebels' && cfg.soundSet !== 'female',
            'rebel_female': (cfg) => cfg.faction === 'rebels' && cfg.soundSet === 'female',
            'human_male': (cfg) => cfg.baseType === 'human_male',
            'human_female': (cfg) => cfg.baseType === 'human_female',
            'droid_humanoid': (cfg) => cfg.baseType === 'droid_humanoid'
        };

        for (const [skinName, iconData] of this.npcIcons.entries()) {
            const config = iconData.config;
            if (!config) continue;

            // Check threat level and macro-category
            if (config.threat === threat && config.macroCategory === macroCategory) {
                // Check subgroup if specified
                if (subgroup && subgroup !== 'all') {
                    const subgroupCheck = subgroupDefs[subgroup.toLowerCase()];
                    if (subgroupCheck && subgroupCheck(config)) {
                        matchingNpcs.push(skinName);
                    } else if (!subgroupCheck && config.groupKey === subgroup) {
                        matchingNpcs.push(skinName);
                    }
                } else {
                    matchingNpcs.push(skinName);
                }
            }
        }
        console.log(`[getNpcsByCriteria] Returning ${matchingNpcs.length} matching NPCs`);
        return matchingNpcs;
    }

    async loadSpeciesData() {
        try {
            const response = await fetch('/data/factionJSONs/species/species.json');
            const data = await response.json();
            this.speciesData = data;
            console.log('[EditorAssetManager] Loaded species data');
        } catch (error) {
            console.error("Failed to load Species data:", error);
            this.speciesData = {};
        }
    }

    async loadNPCClasses() {
        this.npcClasses = {};
        try {
            // Load original classes
            const response = await fetch('/data/ClassesAndSkills/npc_classes.json');
            const data = await response.json();
            this.npcClasses = data.npc_classes || {};

            // Load new BASIC class files
            const newClasses = [
                'BASIC_ANY_WIS', 'BASIC_ANY_CHA', 'BASIC_ANY_CON',
                'BASIC_ANY_DEX', 'BASIC_ANY_FORCE', 'BASIC_ANY_INT', 'BASIC_ANY_STR'
            ];

            for (const className of newClasses) {
                try {
                    const res = await fetch(`/data/ClassesAndSkills/NPC_ClassesAndSkills/${className}.json`);
                    const classData = await res.json();
                    this.npcClasses[className] = classData;
                } catch (err) {
                    console.warn(`Failed to load class ${className}`, err);
                }
            }
            console.log("[EditorAssetManager] Loaded NPC Classes:", Object.keys(this.npcClasses));
        } catch (error) {
            console.error("Failed to load NPC classes:", error);
            this.npcClasses = this.npcClasses || {};
        }
    }
    async loadNpcWeaponMasterList() {
        try {
            const response = await fetch('/data/NPConlyweapons/npc_weapons_master.json');
            const data = await response.json();
            // Data is an array. Convert to object keyed by weaponname (including .png) for easy lookup.
            this.npcWeaponData = {};
            data.forEach(weapon => {
                if (weapon.weaponname) {
                    this.npcWeaponData[weapon.weaponname] = weapon;
                    // Also store by name without extension for fallback lookup
                    const shortName = weapon.weaponname.replace('.png', '');
                    if (!this.npcWeaponData[shortName]) {
                        this.npcWeaponData[shortName] = weapon;
                    }
                }
            });
            console.log(`[EditorAssetManager] Loaded ${data.length} weapon definitions from master list.`);
        } catch (e) {
            console.error("Failed to load npc_weapons_master.json:", e);
        }
    }
}

class EditorUI {
    constructor(editor) {
        this.editor = editor; this.assetManager = editor.assetManager;
        this.layerSelector = document.getElementById('layer-selector'); this.paletteContainer = document.getElementById('palette-container');
        this.templateBuilderContainer = document.getElementById('template-builder-container');
        this.gridWidthInput = document.getElementById('grid-width-input'); this.gridHeightInput = document.getElementById('grid-height-input');
        this.levelNumberInput = document.getElementById('level-number-input'); this.levelDisplay = document.getElementById('level-display');
        this.elevationDisplay = document.getElementById('elevation-level-display');
        this.ceilingDisplay = document.getElementById('ceiling-height-display');
        this.pillarDisplay = document.getElementById('pillar-height-display');
        this.propertiesPanel = document.getElementById('properties-panel');
        this.propContent = document.getElementById('prop-content');
        this.currentPropItem = null;
        this.defaultTextureSelects = {};
        this.layerButtons = {};

        const defaultLayers = ['water', 'floater', 'sky'];
        defaultLayers.forEach(id => {
            const el = document.getElementById(`default-${id}-select`);
            if (el) this.defaultTextureSelects[id] = el;
        });
        const ceilingHeightEl = document.getElementById('default-ceiling-height');
        if (ceilingHeightEl) this.defaultTextureSelects['ceilingHeight'] = ceilingHeightEl;

        this.elevationBrushTextures = { wallside: null };
        this.elevationLevel = 1;
        this.ceilingHeight = 1;
        this.pillarHeight = 3;

        this.toolButtons = {
            template: document.getElementById('tool-template'), paint: document.getElementById('tool-paint'),
            erase: document.getElementById('tool-erase'), rotate: document.getElementById('tool-rotate'),
            spawn: document.getElementById('tool-spawn'), fill: document.getElementById('tool-fill'),
            room: document.getElementById('tool-room')
        };
        this.roomPanel = document.getElementById('room-panel');
        this._roomPanelInitialized = false;
        // This is a global reference for the asset manager to call
        window.editorUI = this;
    }

    init() {
        document.querySelectorAll('.tab-button').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-button, .tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active'); document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');
        }));
        this.createLayerSelector();
        this.createNpcPalette(); // Create the new NPC palette
        document.getElementById('load-level-btn').addEventListener('click', () => this.editor.loadLevel(parseInt(this.levelNumberInput.value) || 1));
        document.getElementById('save-level-btn').addEventListener('click', () => this.editor.saveLevel());
        document.getElementById('reset-layer-btn').addEventListener('click', () => this.editor.resetLayer());
        document.getElementById('reset-map-btn').addEventListener('click', () => this.editor.resetMap());
        document.getElementById('playtest-button').addEventListener('click', () => {
            if (this.editor.levelData['spawns'].size === 0) {
                alert('Cannot play level: No spawn point has been placed.');
                return;
            }
            const levelObject = this.editor.getLevelDataObject();
            localStorage.setItem('gonk_level_to_play', JSON.stringify(levelObject));
            window.open('../index.html', 'GonkPlayWindow');
        });

        this.gridWidthInput.addEventListener('change', () => { this.editor.gridWidth = parseInt(this.gridWidthInput.value) || 64; this.editor.modifyState(() => { }); });
        this.gridHeightInput.addEventListener('change', () => { this.editor.gridHeight = parseInt(this.gridHeightInput.value) || 64; this.editor.modifyState(() => { }); });

        for (const [layer, select] of Object.entries(this.defaultTextureSelects)) {
            const sizeSelect = document.getElementById(`default-${layer}-size`);
            const updateDefaultTexture = () => {
                this.editor.defaultTextures.ceiling = this.editor.defaultTextures.ceiling || {};
                if (layer === 'ceilingHeight') { this.editor.defaultTextures.ceiling.heightMultiplier = parseInt(select.value) || 1; }
                else { this.editor.defaultTextures[layer] = this.editor.defaultTextures[layer] || {}; this.editor.defaultTextures[layer].key = select.value; }
                if (sizeSelect) this.editor.defaultTextures[layer].size = parseInt(sizeSelect.value) || 1;
                this.editor.modifyState(() => { }); this.editor.render();
            };
            select.addEventListener('change', updateDefaultTexture);
            if (sizeSelect) sizeSelect.addEventListener('change', updateDefaultTexture);
        }

        Object.entries(this.toolButtons).forEach(([toolName, button]) => {
            if (button) {
                button.addEventListener('click', () => this.setActiveTool(toolName));
            }
        });

        this.propertiesPanel.addEventListener('click', e => e.stopPropagation());

        this.populateDefaultTextureSettings();
        this.setActiveLayer(this.editor.activeLayerName);
    }

    createNpcPalette() {
        const npcPaletteContainer = document.getElementById('npc-palette-container');
        npcPaletteContainer.innerHTML = '';

        const macroCategories = {
            'Takers': { icon: '/data/pngs/icons for UI/factions/takersicon.png', layer: 'npcs' },
            'Imperials': { icon: '/data/pngs/icons for UI/stormiesicon.png', layer: 'npcs' },
            'Sith': { icon: '/data/pngs/icons for UI/factions/darthsicon.png', layer: 'npcs' },
            'Clones': { icon: '/data/pngs/factions/clones/i1/clone_1.png', layer: 'npcs' },
            'spawns': { icon: '/data/pngs/icons for UI/spawn/hologonk_1.png', layer: 'spawns' },
            'Droids': { icon: '/data/pngs/icons for UI/droidicon.png', layer: 'npcs' },
            'Mandalorians': { icon: '/data/pngs/factions/mandalorians/i1/mando_1.png', layer: 'npcs' },
            'Aliens': { icon: '/data/pngs/icons for UI/aliensicon.png', layer: 'npcs' },
            'Rebels': { icon: '/data/pngs/icons for UI/humanicon.png', layer: 'npcs' }
        };

        const npcGridOrder = [
            'Takers', 'Clones', 'Mandalorians',
            'Imperials', 'spawns', 'Aliens',
            'Sith', 'Droids', 'Rebels'
        ];

        npcGridOrder.forEach(catName => {
            const info = macroCategories[catName];
            const btn = this.createButton(info.layer, catName, info.icon);
            btn.dataset.macroCategory = catName;
            btn.addEventListener('click', () => this.setActiveLayer(info.layer, catName));
            npcPaletteContainer.appendChild(btn);
        });
    }

    createLayerSelector() {
        this.layerSelector.innerHTML = '';
        const layerGroups = {
            'Ground': ['subfloor', 'floor', 'water'], 'Scenery': ['floater', 'decor', 'dangler', 'pillar'],
            'Structure': ['wall', 'door', 'dock', 'screen', 'panel'],
            'Sky & Ceiling': ['ceiling', 'sky', 'skybox'], 'Heightmap': ['elevation']
        };

        const utilityGroup = {
            'Entities': ['assets', 'keys', 'enemy_spawn_points']
        };


        for (const groupName in layerGroups) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'layer-group';
            this.layerSelector.appendChild(groupDiv);

            layerGroups[groupName].forEach(layerName => {
                const btn = this.createButton(layerName, layerName, null);
                btn.addEventListener('click', () => this.setActiveLayer(layerName));
                groupDiv.appendChild(btn);
            });
        }

        const secondRowContainer = document.createElement('div');
        secondRowContainer.style.flexBasis = '100%';
        secondRowContainer.style.height = '0';
        this.layerSelector.appendChild(secondRowContainer);


        for (const groupName in utilityGroup) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'layer-group';
            this.layerSelector.appendChild(groupDiv);

            utilityGroup[groupName].forEach(layerName => {
                const label = layerName === 'enemy_spawn_points' ? 'Spawn' : layerName;
                const btn = this.createButton(layerName, label, null);
                btn.addEventListener('click', () => this.setActiveLayer(layerName));
                groupDiv.appendChild(btn);
            });
        }
    }

    createButton(layerName, label, overrideIcon) {
        const button = document.createElement('button');
        button.dataset.layer = layerName;
        button.title = label.charAt(0).toUpperCase() + label.slice(1);
        let iconSrc = overrideIcon;
        if (!iconSrc) {
            const iconMap = {
                'assets': '/data/pngs/icons for UI/crate.png', 'spawns': '/data/pngs/icons for UI/spawn/hologonk_1.png',
                'wall': '/data/pngs/icons for UI/wallsicon.png', 'door': '/data/pngs/icons for UI/dooricon.png',
                'dock': '/data/pngs/icons for UI/dockicon.png', 'panel': '/data/pngs/icons for UI/panelicon.png',
                'screen': '/data/pngs/icons for UI/screenicon.png', 'elevation': '/data/pngs/icons for UI/elevationicon.png',
                'skybox': '/data/pngs/icons for UI/skyboxicon.png', 'ceiling': '/data/pngs/icons for UI/ceilingicon.png',
                'pillar': '/data/pngs/icons for UI/pillaricon.png',
                'keys': '/data/pngs/icons for UI/key.png',
                'stations': '/data/pngs/icons for UI/crate.png',
                'enemy_spawn_points': '/data/pngs/icons for UI/NPCspawnericon.png'
            };
            iconSrc = iconMap[layerName] || (this.assetManager.layerTextures[layerName]?.[0]);
        }
        if (iconSrc) {
            const img = document.createElement('img'); img.src = iconSrc; button.appendChild(img);
        }
        const labelSpan = document.createElement('span'); labelSpan.className = 'layer-label';
        labelSpan.textContent = label.charAt(0).toUpperCase() + label.slice(1); button.appendChild(labelSpan);
        if (!this.layerButtons[layerName]) this.layerButtons[layerName] = [];
        this.layerButtons[layerName].push(button);
        return button;
    }

    setActiveLayer(layerName, subGroup = null) {
        document.querySelector('.tab-button[data-tab="editor"]').click();
        if (this.editor.placementPreview) {
            this.editor.placementPreview = null;
            this.editor.statusMsg.textContent = 'Overlay placement cancelled.';
        }
        this.editor.activeBrush = null;
        this.editor.isTemplateCloned = false; // Reset template tool on layer change
        this.elevationDisplay.style.display = layerName === 'elevation' ? 'block' : 'none';
        this.ceilingDisplay.style.display = layerName === 'ceiling' ? 'block' : 'none';
        if (this.pillarDisplay) this.pillarDisplay.style.display = layerName === 'pillar' ? 'block' : 'none';
        this.editor.activeLayerName = layerName;
        document.querySelectorAll('#layer-selector button').forEach(btn => btn.classList.remove('active'));
        const buttons = this.layerButtons[layerName];
        if (buttons) {
            let targetButton = buttons.find(b => b.dataset.macroCategory === subGroup) || buttons[0];
            if (targetButton) targetButton.classList.add('active');
        }
        this.setActiveTool(layerName === 'spawns' ? 'spawn' : 'paint');
        this.updatePalette(subGroup);
    }

    setActiveTool(toolName) {
        this.editor.activeTool = toolName;
        this.editor.isTemplateCloned = false; // Reset template tool on any tool change
        Object.values(this.toolButtons).forEach(btn => { if (btn) btn.classList.remove('active'); });
        if (this.toolButtons[toolName]) this.toolButtons[toolName].classList.add('active');
        const cursors = { paint: 'default', erase: 'not-allowed', rotate: 'grab', spawn: 'pointer', fill: 'copy', template: 'copy' };
        this.editor.canvas.style.cursor = cursors[toolName] || 'default';
        this.updatePalette(document.querySelector('#layer-selector button.active')?.dataset.macroCategory);
    }

    updateUIForNewLevel() {
        this.levelNumberInput.value = this.editor.currentLevel;
        const sublevelSelect = document.getElementById('level-sublevel-select');
        const sublevel = sublevelSelect ? sublevelSelect.value : '';
        const levelName = sublevel ? `${this.editor.currentLevel}${sublevel}` : `${this.editor.currentLevel}`;
        this.levelDisplay.textContent = `Level: ${levelName}`;
    }

    updateElevationLevel(newLevel) {
        this.elevationLevel = Math.max(1, Math.min(30, newLevel));
        const paletteInput = document.getElementById('elevation-level-input');
        if (paletteInput) paletteInput.value = this.elevationLevel;
        if (this.elevationDisplay) this.elevationDisplay.textContent = this.elevationLevel;
        const wallSelect = document.getElementById('elevation-wall-select');
        if (wallSelect) {
            this.editor.activeBrush = {
                type: 'elevation', key: `/data/pngs/elevation/${this.elevationLevel}.png`,
                properties: { elevation: this.elevationLevel, wallsideTexture: wallSelect.value }
            };
            this.editor.render();
        }
    }

    updateCeilingHeight(newHeight) {
        this.ceilingHeight = Math.max(1, Math.min(10, newHeight));
        const paletteInput = document.getElementById('ceiling-height-input');
        if (paletteInput) paletteInput.value = this.ceilingHeight;
        if (this.ceilingDisplay) this.ceilingDisplay.textContent = `${this.ceilingHeight}x Height`;
        const activeItem = document.querySelector('#ceiling-base-palette .palette-item.active');
        const wallsideSelect = document.getElementById('ceiling-wallside-select');
        if (activeItem && wallsideSelect) {
            this.editor.activeBrush = {
                type: 'ceiling', key: activeItem.dataset.key,
                properties: { heightMultiplier: this.ceilingHeight, wallsideTexture: wallsideSelect.value }
            };
            this.editor.render();
        }
    }

    updatePillarHeight(newHeight) {
        this.pillarHeight = Math.max(1, Math.min(30, newHeight));
        const paletteInput = document.getElementById('pillar-height-input');
        if (paletteInput) paletteInput.value = this.pillarHeight;
        if (this.pillarDisplay) this.pillarDisplay.textContent = `Height: ${this.pillarHeight}`;

        const activeItem = document.querySelector('#pillar-base-palette .palette-item.active');
        if (activeItem) {
            const width = parseInt(document.getElementById('pillar-width-slider').value, 10);
            const placement = document.getElementById('pillar-placement-select').value;
            this.editor.setPillarPlacementMode(placement);
            this.editor.activeBrush = {
                type: 'pillar',
                key: activeItem.dataset.key,
                properties: {
                    width: width,
                    height: this.pillarHeight
                }
            };
            this.editor.render();
        }
    }

    updatePalette(subGroup = null) {
        const activeTool = this.editor.activeTool;
        this.templateBuilderContainer.style.display = 'none'; // Obsolete, always hide
        const showPalette = ['paint', 'fill', 'template'].includes(activeTool);
        document.querySelector('.content-group h4').style.display = showPalette ? 'block' : 'none';
        this.paletteContainer.style.display = 'block';
        document.getElementById('palette-controls').style.display = ['paint', 'fill'].includes(activeTool) ? 'flex' : 'none';

        if (activeTool === 'template') {
            document.querySelector('.content-group h4').textContent = 'Clone/Stamp Tool';
            this.paletteContainer.innerHTML = `<p style="padding: 10px; text-align: center;">Click on a map tile to clone its contents. Right-click to clear selection.</p>`;
            return;
        }
        document.querySelector('.content-group h4').textContent = 'Asset Palette';

        ['#elevation-extras', '#ceiling-extras', '#wall-extras', '#npc-extras'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        if (!showPalette) { this.paletteContainer.innerHTML = ''; this.editor.activeBrush = null; return; }

        if (this.editor.activeLayerName === 'npcs') this.populateNpcPalette(subGroup);
        else if (this.editor.activeLayerName === 'assets' || this.editor.activeLayerName === 'keys') this.populateAssetPalette();
        else if (this.editor.activeLayerName === 'enemy_spawn_points') this.populateEnemySpawnPointPalette();
        else if (this.editor.activeLayerName === 'pillar') this.populatePillarPalette();
        else if (this.editor.activeLayerName === 'elevation') this.populateElevationPalette();
        else if (this.editor.activeLayerName === 'ceiling') this.populateCeilingPalette();
        else if (this.editor.lineLayers.includes(this.editor.activeLayerName)) this.populateStackedWallPalette(this.editor.activeLayerName);
        else if (this.editor.activeLayerName === 'skybox') this.populateSkyboxPalette();
        else this.populateTexturePalette();

        if (this.editor.activeBrush) {
            const currentItem = document.querySelector(`.palette-item[data-key="${this.editor.activeBrush.key}"]`);
            if (currentItem) currentItem.classList.add('active');
        } else {
            const firstItem = document.querySelector('.palette-item');
            if (firstItem) firstItem.click(); else this.editor.activeBrush = null;
        }
        if (subGroup) { const header = document.querySelector(`.palette-header[data-group-key="${subGroup}"]`); if (header) header.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }

    showPropertiesPanel(itemKey, itemData, layerName) {
        this.currentPropItem = { key: itemKey, data: itemData, layer: layerName };
        this.propContent.innerHTML = '';

        const npcConfig = this.assetManager.npcIcons.get(itemData.key)?.config || {};
        const props = itemData.properties || {};

        // Helper to generate inputs based on value type
        const createInput = (key, val, type = 'text', options = null) => {
            let html = `<div class="prop-group" data-prop-key="${key}">`;
            let label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            // Special labels
            if (key === 'interactionScreen') label = 'Conversations';
            if (key === 'damage_modifier') label = 'Damage Mod';

            html += `<label for="prop-${key}">${label}:</label>`;

            if (type === 'select' && options) {
                html += `<select id="prop-${key}">`;
                options.forEach(opt => {
                    const selected = opt.value === val ? 'selected' : '';
                    html += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                });
                html += `</select>`;
            } else if (type === 'checkbox') {
                // For checkboxes, wrap label and input differently to put them SIDE BY SIDE tightly
                html = `<div class="prop-group" data-prop-key="${key}" style="flex-direction: row; justify-content: flex-start; align-items: center; gap: 10px;">`;
                html += `<input type="checkbox" id="prop-${key}" ${val ? 'checked' : ''} style="margin: 0;">`;
                html += `<label for="prop-${key}" style="margin: 0; width: auto;">${label}</label>`;
                html += `</div>`; // Close group div immediately
                return html; // Return early because we built the whole structure
            } else if (type === 'number') {
                html += `<input type="number" id="prop-${key}" value="${val}" step="0.1">`;
            } else {
                html += `<input type="text" id="prop-${key}" value="${val === undefined || val === null ? '' : val}">`;
            }
            html += `</div>`;
            return html;
        };

        if (layerName === 'npcs') {
            const iconInfo = this.assetManager.npcIcons.get(itemData.key);
            const portraitSrc = iconInfo ? iconInfo.icon : '';
            const npcName = props.name || itemData.key.replace('.png', '').replace(/_/g, ' ');

            document.getElementById('prop-title').innerHTML = `
                <img src="${portraitSrc}" style="width: 48px; height: 48px; vertical-align: middle; margin-right: 10px; image-rendering: pixelated; border: 1px solid #666;">
                ${npcName}
            `;

            let propHtml = '';
            const usedKeys = new Set();

            // --- 1. Model Specific Group ---
            propHtml += `<div style="grid-column: 1 / -1; border-bottom: 2px solid #555; margin-bottom: 10px;"><h4 style="margin: 5px 0; color: #61dafb;">Model Specific</h4></div>`;

            // Config values (fallbacks)
            const currentSpecies = props.species || npcConfig.species || 'human';
            const currentClass = props.class || npcConfig.class || 'BASIC_ANY_DEX';

            // Define Model Specific Fields
            // Use props value if exists, else config value, else default
            const modelFields = [
                { key: 'name', val: props.name || '', type: 'text' },
                { key: 'health', val: props.health || npcConfig.health || 100, type: 'number' },
                { key: 'threat', val: props.threat || npcConfig.threat || 1, type: 'number' },
                { key: 'damage_modifier', val: props.damage_modifier || 0, type: 'number' }, // Renamed from extra_power
                { key: 'invincible', val: props.invincible || false, type: 'checkbox' },
                { key: 'immovable', val: props.immovable || false, type: 'checkbox' },
            ];

            modelFields.forEach(f => {
                propHtml += createInput(f.key, f.val, f.type);
                usedKeys.add(f.key);
            });

            // Faction Dropdown (New)
            const factions = ['neutral', 'rebels', 'imperials', 'clones', 'droids', 'mandalorians', 'aliens', 'sith', 'takers', 'jawa_trader'];
            const currentFaction = props.faction || npcConfig.faction || 'neutral';
            const factionOptions = factions.map(f => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }));
            propHtml += createInput('faction', currentFaction, 'select', factionOptions);
            usedKeys.add('faction');

            // Interaction Screen Dropdown
            const interactionOptions = [
                { value: '', label: 'None' },
                { value: 'the_guide', label: 'The Guide' },
                { value: 'droidsmith', label: 'Item Trader' },
                { value: 'weapon_vendor', label: 'Weapon Vendor' },
                { value: 'armorer', label: 'Armorer' }
            ];
            propHtml += createInput('interactionScreen', props.interactionScreen || '', 'select', interactionOptions);
            usedKeys.add('interactionScreen');

            // Species Dropdown
            const speciesOptions = Object.keys(this.assetManager.speciesData || {}).sort().map(k => ({ value: k, label: k }));
            propHtml += createInput('species', currentSpecies, 'select', speciesOptions);
            usedKeys.add('species');

            // Class Dropdown
            const classOptions = Object.keys(this.assetManager.npcClasses || {}).sort().map(k => ({ value: k, label: k }));
            propHtml += createInput('class', currentClass, 'select', classOptions);
            usedKeys.add('class');

            // Weapon Logic
            const classInfo = this.assetManager.npcClasses[currentClass] || {};
            const defaultWeapon = npcConfig.default_weapon || classInfo.default_weapon || '';
            let weaponDisplayVal = 'None';
            if (defaultWeapon) weaponDisplayVal = defaultWeapon.split('/').pop().replace('.png', '').replace(/_/g, ' ');

            propHtml += `<div class="prop-group"><label>Default Weapon:</label><div id="npc-default-weapon-display" style="padding: 5px; color: #888; font-style: italic;">${weaponDisplayVal}</div></div>`;

            // "None (Use Default)" implies falling back to config. default_weapon.
            // "None (No Weapon)" implies explicitly stripping the weapon.
            const weaponOptions = [
                { value: 'default', label: 'Use Default' },
                { value: 'none', label: 'None (Unarmed)' }
            ];

            this.assetManager.weaponPaths.forEach(path => {
                const name = path.split('/').pop().replace('.png', '').replace(/_/g, ' ');
                weaponOptions.push({ value: path, label: name.charAt(0).toUpperCase() + name.slice(1) });
            });
            // Handle custom weapon values not in path list
            let currentWeapon = props.weapon || 'default';

            if (currentWeapon !== 'default' && currentWeapon !== 'none' && !weaponOptions.find(o => o.value === currentWeapon)) {
                weaponOptions.push({ value: currentWeapon, label: currentWeapon.split('/').pop() });
            }

            propHtml += createInput('weapon', currentWeapon, 'select', weaponOptions);
            usedKeys.add('weapon');
            usedKeys.add('default_weapon'); // Mark as used to skip later

            // --- 2. Species Features Group ---
            propHtml += `<div style="grid-column: 1 / -1; border-bottom: 2px solid #555; margin: 15px 0 10px 0;"><h4 style="margin: 5px 0; color: #61dafb;">Species Features (${currentSpecies})</h4></div>`;

            const speciesInfo = this.assetManager.speciesData[currentSpecies] || {};
            // Filter keys
            const speciesKeys = Object.keys(speciesInfo).filter(k =>
                !k.startsWith('_') && k !== 'STAT_MODS' && !usedKeys.has(k)
            );

            if (speciesKeys.length === 0) {
                propHtml += `<div style="grid-column: 1 / -1; color: #777; font-style: italic;">No additional species features.</div>`;
            } else {
                speciesKeys.forEach(key => {
                    const val = props[key] !== undefined ? props[key] : speciesInfo[key];
                    const type = typeof val === 'number' ? 'number' : (typeof val === 'boolean' ? 'checkbox' : 'text');
                    // Skip complex objects for now unless specific handling
                    if (typeof val === 'object' && val !== null) return;

                    propHtml += createInput(key, val, type);
                    usedKeys.add(key);
                });
            }

            // --- 3. Class Features Group ---
            propHtml += `<div style="grid-column: 1 / -1; border-bottom: 2px solid #555; margin: 15px 0 10px 0;"><h4 style="margin: 5px 0; color: #61dafb;">Class Features (${currentClass})</h4></div>`;

            // Dictionary 'classInfo' is already declared/initialized above.
            // Filter keys
            const classKeys = Object.keys(classInfo).filter(k =>
                !k.startsWith('_') && k !== 'starting_attributes' && k !== 'GoldSilverBronzeStats' && !usedKeys.has(k)
            );

            if (classKeys.length === 0) {
                propHtml += `<div style="grid-column: 1 / -1; color: #777; font-style: italic;">No additional class features.</div>`;
            } else {
                classKeys.forEach(key => {
                    const val = props[key] !== undefined ? props[key] : classInfo[key];
                    const type = typeof val === 'number' ? 'number' : (typeof val === 'boolean' ? 'checkbox' : 'text');
                    // Skip complex objects
                    if (typeof val === 'object' && val !== null) return;

                    propHtml += createInput(key, val, type);
                    usedKeys.add(key);
                });
            }

            this.propContent.innerHTML = propHtml;

            // --- Event Listeners for Dynamic Updates ---

            // Helper to update default weapon display
            const updateDefWepDisplay = () => {
                const sKey = document.getElementById('prop-species').value;
                const cKey = document.getElementById('prop-class').value;
                // Ideally calculate from stats, but simple fallback for now:
                // In a full implementation, we'd query AssetManager.calculateNPCStats(sKey, cKey, 1)
                // For now, just keep static or try simple lookup if class has default_weapon
                const cls = this.assetManager.npcClasses[cKey];
                let dw = cls?.default_weapon || npcConfig.default_weapon || '';

                const dwDisplay = document.getElementById('npc-default-weapon-display');
                if (dwDisplay) dwDisplay.textContent = dw ? dw.split('/').pop().replace('.png', '').replace(/_/g, ' ') : 'None';
            };

            const sSelect = document.getElementById('prop-species');
            const cSelect = document.getElementById('prop-class');
            if (sSelect) sSelect.addEventListener('change', () => {
                // When species changes, ideally we'd refresh the panel to show new Species Features.
                // For a simple fix, we just update the property in memory so it saves?
                // Creating a refresh loop might be tricky without saving state first.
                // WE SHOULD PROBABLY RE-RENDER THE PANEL.
                // But first update the local data object so the re-render picks up the new species.
                this.currentPropItem.data.properties = this.currentPropItem.data.properties || {};
                this.currentPropItem.data.properties.species = sSelect.value;
                this.showPropertiesPanel(this.currentPropItem.key, this.currentPropItem.data, this.currentPropItem.layer);
            });
            if (cSelect) cSelect.addEventListener('change', () => {
                this.currentPropItem.data.properties = this.currentPropItem.data.properties || {};
                this.currentPropItem.data.properties.class = cSelect.value;
                this.showPropertiesPanel(this.currentPropItem.key, this.currentPropItem.data, this.currentPropItem.layer);
            });

        } else if (layerName === 'enemy_spawn_points') {
            document.getElementById('prop-title').textContent = 'Enemy Spawn Point Properties';
            const props = itemData.properties || {};
            let propHtml = `
                <div class="prop-group">
                    <label for="esp-attitude">Attitude:</label>
                    <select id="esp-attitude">
                        <option value="enemy" ${props.attitude === 'enemy' ? 'selected' : ''}>Enemy</option>
                        <option value="ally" ${props.attitude === 'ally' ? 'selected' : ''}>Ally</option>
                        <option value="primary" ${props.attitude === 'primary' ? 'selected' : ''}>Primary</option>
                        <option value="secondary" ${props.attitude === 'secondary' ? 'selected' : ''}>Secondary</option>
                        <option value="none" ${props.attitude === 'none' ? 'selected' : ''}>None</option>
                    </select>
                </div>
                <div class="prop-group">
                    <label for="esp-faction">Faction Override:</label>
                    <select id="esp-faction">
                        <option value="" ${!props.faction ? 'selected' : ''}>Auto (based on attitude)</option>
                        <option value="rebels" ${props.faction === 'rebels' ? 'selected' : ''}>Rebels</option>
                        <option value="imperials" ${props.faction === 'imperials' ? 'selected' : ''}>Imperials</option>
                        <option value="clones" ${props.faction === 'clones' ? 'selected' : ''}>Clones</option>
                        <option value="mandalorians" ${props.faction === 'mandalorians' ? 'selected' : ''}>Mandalorians</option>
                        <option value="sith" ${props.faction === 'sith' ? 'selected' : ''}>Sith</option>
                        <option value="aliens" ${props.faction === 'aliens' ? 'selected' : ''}>Aliens</option>
                        <option value="droids" ${props.faction === 'droids' ? 'selected' : ''}>Droids</option>
                        <option value="takers" ${props.faction === 'takers' ? 'selected' : ''}>Takers</option>
                    </select>
                </div>
                <!-- ... Rest of standard spawn point props, simplified for brevity but normally would preserve ... -->
                <div class="prop-group"><label for="esp-total-threat">Total Max Threat:</label><input type="number" id="esp-total-threat" value="${props.total_max_threat || 8}" min="1" step="1"></div>
            `;
            // Note: I am truncating some spawn point props to fit in the replacement block limit, 
            // but the prompt asked to fix NPC context. I should try to preserve as much as possible 
            // BUT strict instruction was to fix NPC context. 
            // Actually, I must ensure I don't break the Enemy Spawn Point UI. 
            // I will copy the original Enemy Spawn Point logic back in fully to be safe.
            // ... (Self-correction): Re-reading the original code, the ESP logic is long. 
            // I will use a second tool call for the ESP part if needed, OR just include it all here. I'll include it all.
            // The replacement content below includes the FULL ESP logic.
            propHtml += `
                 <div class="prop-group"><label for="esp-subgroup">Subgroup:</label><input type="text" id="esp-subgroup" value="${props.subgroup || ''}"></div>
                 <div class="prop-group"><label for="esp-max-threat">Max Individual Threat:</label><input type="number" id="esp-max-threat" value="${props.max_individual_threat || 3}"></div>
                 <div class="prop-group"><label for="esp-threat-per-min">Threat Per Spawn:</label><input type="number" id="esp-threat-per-min" value="${props.threat_per_minute || 4}"></div>
                 <div class="prop-group"><label for="esp-min-time">Min Time (s):</label><input type="number" id="esp-min-time" value="${props.min_time_between_spawns || 30}"></div>
                 <div class="prop-group"><label for="esp-max-time">Max Time (s):</label><input type="number" id="esp-max-time" value="${props.max_time_between_spawns || 100}"></div>
                 <div class="prop-group"><label for="esp-health">Health:</label><input type="number" id="esp-health" value="${props.health || 100}"></div>
                 <div class="prop-group"><label for="esp-max-health">Max Health:</label><input type="number" id="esp-max-health" value="${props.max_health || 100}"></div>
                 <div class="prop-group"><label for="esp-rotation">Rotation (0-3):</label><input type="number" id="esp-rotation" value="${itemData.rotation || 0}"></div>
            `;
            this.propContent.innerHTML = propHtml;
        }
        // If not an NPC, hide the weapon group
        if (layerName !== 'npcs') document.getElementById('npc-weapon-group').style.display = 'none';

        // Handle assets/furniture properties (vendor/quest items)
        if (layerName === 'assets' || layerName === 'keys') {
            const assetName = itemData.key || itemKey;
            document.getElementById('prop-title').textContent = `${assetName} Properties`;
            const interactionScreen = itemData.properties?.interactionScreen || '';
            const questItem = itemData.properties?.questItem || false;
            const questId = itemData.properties?.questId || '';
            const requiredFlag = itemData.properties?.requiredFlag || '';
            const promptText = itemData.properties?.promptText || '';

            propHtml = `
                <div class="prop-group">
                    <label for="asset-interaction">Interaction Screen:</label>
                    <select id="asset-interaction">
                        <option value="">None</option>
                        <option value="droidsmith" ${interactionScreen === 'droidsmith' ? 'selected' : ''}>Item Trader</option>
                        <option value="weapon_vendor" ${interactionScreen === 'weapon_vendor' ? 'selected' : ''}>Weapon Vendor</option>
                        <option value="armorer" ${interactionScreen === 'armorer' ? 'selected' : ''}>Armorer</option>
                    </select>
                </div>
                <div class="prop-group">
                    <label for="asset-prompt">Prompt Text:</label>
                    <input type="text" id="asset-prompt" value="${promptText}" placeholder="e.g., Press E for Droidsmith">
                </div>
                <div class="prop-group">
                    <label>
                        <input type="checkbox" id="asset-quest-item" ${questItem ? 'checked' : ''}> Quest Item
                    </label>
                </div>
                <div class="prop-group">
                    <label for="asset-quest-id">Quest ID:</label>
                    <input type="text" id="asset-quest-id" value="${questId}" placeholder="e.g., key_red">
                </div>
                <div class="prop-group">
                    <label for="asset-required-flag">Required Flag:</label>
                    <input type="text" id="asset-required-flag" value="${requiredFlag}" placeholder="Flag to unlock">
                </div>
            `;
            this.propContent.innerHTML = propHtml;
        }

        // Handle dock properties
        if (layerName === 'dock') {
            document.getElementById('prop-title').textContent = 'Dock Properties';
            const targetValue = itemData.properties?.target || '';
            propHtml = `
                <div class="prop-group">
                    <label for="dock-target">Target Level:</label>
                    <input type="text" id="dock-target" value="${targetValue}" placeholder="e.g., TO LEVEL 02A">
                </div>
            `;
            this.propContent.innerHTML = propHtml;
        }

        // Handle spawn point properties
        if (layerName === 'spawns') {
            document.getElementById('prop-title').textContent = 'Spawn Point Properties';
            const spawnId = itemData.id || '';
            const spawnRotation = itemData.rotation || 0;
            propHtml = `
                <div class="prop-group">
                    <label for="spawn-id">Spawn ID:</label>
                    <input type="text" id="spawn-id" value="${spawnId}" placeholder="e.g., FROM LEVEL 01">
                </div>
                <div class="prop-group">
                    <label for="spawn-rotation">Rotation (0-3):</label>
                    <input type="number" id="spawn-rotation" value="${spawnRotation}" min="0" max="3" step="1">
                </div>
                <div class="prop-group" style="grid-column: 1 / -1;">
                    <p style="font-size: 0.9em; color: #aaa;">Rotation: 0=Down, 1=Left, 2=Up, 3=Right</p>
                </div>
            `;
            this.propContent.innerHTML = propHtml;
        }

        const buttons = this.propertiesPanel.querySelector('.prop-buttons');
        buttons.innerHTML = `
            <button id="save-prop-btn">Save</button>
            <button id="delete-prop-btn" style="background-color: #dc3545;">Delete</button>
            <button id="cancel-prop-btn" style="background-color: #6c757d;">Cancel</button>
        `;
        buttons.querySelector('#save-prop-btn').addEventListener('click', e => { e.stopPropagation(); this.saveProperties(); });
        const deleteBtn = buttons.querySelector('#delete-prop-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', e => { e.stopPropagation(); this.editor.eraseItem(this.currentPropItem); this.hidePropertiesPanel(); });
        }
        buttons.querySelector('#cancel-prop-btn').addEventListener('click', e => { e.stopPropagation(); this.hidePropertiesPanel(); });

        this.propertiesPanel.style.display = 'block';
    } // End showPropertiesPanel

    saveProperties() {
        if (!this.currentPropItem) return;
        const { key, data, layer } = this.currentPropItem;
        const itemToModify = this.editor.levelData[layer].get(key);
        if (!itemToModify) { this.hidePropertiesPanel(); return; }
        itemToModify.properties = itemToModify.properties || {};

        this.editor.modifyState(() => {
            if (layer === 'npcs') {
                const propGroups = this.propContent.querySelectorAll('.prop-group');
                propGroups.forEach(group => {
                    const propKey = group.dataset.propKey;
                    const input = group.querySelector('input, select');
                    if (input) {
                        if (input.type === 'checkbox') {
                            if (input.checked) {
                                itemToModify.properties[propKey] = true;
                            } else {
                                delete itemToModify.properties[propKey];
                            }
                        } else if (input.type === 'number') {
                            const val = parseFloat(input.value);
                            if (!isNaN(val)) {
                                itemToModify.properties[propKey] = val;
                            }
                        } else {
                            // Text or Select
                            const val = input.value;
                            if (propKey === 'weapon') {
                                if (val === 'default') {
                                    delete itemToModify.properties[propKey];
                                } else if (val === 'none') {
                                    itemToModify.properties[propKey] = 'none';
                                } else {
                                    itemToModify.properties[propKey] = val;
                                }
                            } else {
                                if (val === '' || val === 'none') {
                                    delete itemToModify.properties[propKey];
                                } else {
                                    itemToModify.properties[propKey] = val;
                                }
                            }
                        }
                    }
                });
            } else if (layer === 'assets' || layer === 'keys') {
                const interactionScreen = document.getElementById('asset-interaction')?.value;
                const promptText = document.getElementById('asset-prompt')?.value;
                const questItem = document.getElementById('asset-quest-item')?.checked;
                const questId = document.getElementById('asset-quest-id')?.value;
                const requiredFlag = document.getElementById('asset-required-flag')?.value;

                if (interactionScreen) {
                    itemToModify.properties.interactionScreen = interactionScreen;
                } else {
                    delete itemToModify.properties.interactionScreen;
                }

                if (promptText) {
                    itemToModify.properties.promptText = promptText;
                } else {
                    delete itemToModify.properties.promptText;
                }

                if (questItem) {
                    itemToModify.properties.questItem = true;
                    if (questId) itemToModify.properties.questId = questId;
                } else {
                    delete itemToModify.properties.questItem;
                    delete itemToModify.properties.questId;
                }

                if (requiredFlag) {
                    itemToModify.properties.requiredFlag = requiredFlag;
                } else {
                    delete itemToModify.properties.requiredFlag;
                }
            } else if (layer === 'dock') { itemToModify.properties.target = document.getElementById('dock-target').value; }
            else if (layer === 'spawns') { itemToModify.id = document.getElementById('spawn-id').value; itemToModify.rotation = parseInt(document.getElementById('spawn-rotation').value, 10); }
            else if (layer === 'pillar') {
                itemToModify.properties.width = parseInt(document.getElementById('pillar-width').value, 10);
                itemToModify.properties.height = parseInt(document.getElementById('pillar-height').value, 10);
                itemToModify.properties.placement = document.getElementById('pillar-placement').value;
            } else if (layer === 'enemy_spawn_points') {
                itemToModify.properties.attitude = document.getElementById('esp-attitude').value;
                const factionVal = document.getElementById('esp-faction').value;
                itemToModify.properties.faction = factionVal === '' ? null : factionVal;
                const subgroupVal = document.getElementById('esp-subgroup').value.trim();
                itemToModify.properties.subgroup = subgroupVal === '' ? null : subgroupVal;
                itemToModify.properties.max_individual_threat = parseInt(document.getElementById('esp-max-threat').value, 10);
                itemToModify.properties.threat_per_minute = parseInt(document.getElementById('esp-threat-per-min').value, 10);
                itemToModify.properties.min_time_between_spawns = parseInt(document.getElementById('esp-min-time').value, 10);
                itemToModify.properties.max_time_between_spawns = parseInt(document.getElementById('esp-max-time').value, 10);
                itemToModify.properties.total_max_threat = parseInt(document.getElementById('esp-total-threat').value, 10);
                itemToModify.properties.health = parseInt(document.getElementById('esp-health').value, 10);
                itemToModify.properties.max_health = parseInt(document.getElementById('esp-max-health').value, 10);
                itemToModify.rotation = parseInt(document.getElementById('esp-rotation').value, 10);
            }
        });
        this.hidePropertiesPanel();
    }

    hidePropertiesPanel() {
        this.propertiesPanel.style.display = 'none';
        this.currentPropItem = null;
        // Hide the weapon group when the panel is hidden
        const npcWeaponGroup = document.getElementById('npc-weapon-group');
        if (npcWeaponGroup) {
            npcWeaponGroup.style.display = 'none';
        }
    }

    populateTexturePalette() {
        this.paletteContainer.style.display = 'grid';
        const textures = this.assetManager.layerTextures[this.editor.activeLayerName] || [];
        const groups = {};
        textures.forEach(path => { if (!path) return; const dir = path.split('/')[path.split('/').length - 2]; if (!groups[dir]) groups[dir] = []; groups[dir].push(path); });
        this.paletteContainer.innerHTML = '';
        for (const dir in groups) {
            const header = document.createElement('div'); header.className = 'palette-header'; header.textContent = dir.charAt(0).toUpperCase() + dir.slice(1); this.paletteContainer.appendChild(header);
            for (const path of groups[dir]) {
                const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = path;
                const img = new Image(); img.src = path; item.appendChild(img);
                const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', '').replace(/_/g, ' '); item.appendChild(label);
                item.addEventListener('click', () => { this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); this.editor.activeBrush = { type: 'texture', key: path }; this.editor.render(); });
                this.paletteContainer.appendChild(item);
            }
        }
    }

    populateAssetPalette() {
        this.paletteContainer.style.display = 'grid';
        const items = Array.from(this.assetManager.assetIcons.entries());
        this.paletteContainer.innerHTML = !items || items.length === 0 ? `<p>No assets found</p>` : '';

        // Add "Random Furniture" option at the top
        const randomItem = document.createElement('div');
        randomItem.className = 'palette-item';
        randomItem.dataset.key = '__RANDOM__';
        randomItem.style.backgroundColor = '#4a4a2a';
        randomItem.style.border = '2px solid #ffaa00';
        const randomImg = new Image();
        randomImg.src = '/data/pngs/icons for UI/crate.png';
        randomItem.appendChild(randomImg);
        const randomLabel = document.createElement('span');
        randomLabel.textContent = '🎲 RANDOM';
        randomLabel.style.fontWeight = 'bold';
        randomItem.appendChild(randomLabel);
        randomItem.addEventListener('click', () => {
            this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
            randomItem.classList.add('active');
            this.editor.activeBrush = { type: 'asset', key: '__RANDOM__' };
            this.editor.render();
        });
        this.paletteContainer.appendChild(randomItem);

        items.forEach(([name, iconUrl]) => {
            const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = name;
            const img = new Image(); img.src = iconUrl; window[name + '_icon_img'] = img; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = name; item.appendChild(label);
            item.addEventListener('click', () => { this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); this.editor.activeBrush = { type: 'asset', key: name }; this.editor.render(); });
            this.paletteContainer.appendChild(item);
        });
    }

    populateEnemySpawnPointPalette() {
        this.paletteContainer.style.display = 'grid';
        this.paletteContainer.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'palette-header';
        header.textContent = 'NPC Spawn Points';
        header.style.gridColumn = '1 / -1';
        this.paletteContainer.appendChild(header);

        // Define 5 spawn types with their defaults per level (1-5)
        const spawnTypes = [
            {
                key: 'spawnprimary',
                label: 'Primary',
                attitude: 'primary',
                iconBase: '/data/pngs/enemyspawns/spawnprimary_',
                color: '#4444aa',
                defaults: [
                    { total_max_threat: 4, max_individual_threat: 2, threat_per_minute: 2, min_time: 40, max_time: 120 },
                    { total_max_threat: 6, max_individual_threat: 3, threat_per_minute: 3, min_time: 35, max_time: 110 },
                    { total_max_threat: 8, max_individual_threat: 3, threat_per_minute: 4, min_time: 30, max_time: 100 },
                    { total_max_threat: 10, max_individual_threat: 4, threat_per_minute: 5, min_time: 25, max_time: 90 },
                    { total_max_threat: 12, max_individual_threat: 5, threat_per_minute: 6, min_time: 20, max_time: 80 }
                ]
            },
            {
                key: 'spawnsecondary',
                label: 'Secondary',
                attitude: 'secondary',
                iconBase: '/data/pngs/enemyspawns/spawnpsecondary_',
                color: '#666688',
                defaults: [
                    { total_max_threat: 4, max_individual_threat: 2, threat_per_minute: 2, min_time: 45, max_time: 130 },
                    { total_max_threat: 6, max_individual_threat: 3, threat_per_minute: 3, min_time: 40, max_time: 120 },
                    { total_max_threat: 8, max_individual_threat: 3, threat_per_minute: 4, min_time: 35, max_time: 110 },
                    { total_max_threat: 10, max_individual_threat: 4, threat_per_minute: 5, min_time: 30, max_time: 100 },
                    { total_max_threat: 12, max_individual_threat: 5, threat_per_minute: 6, min_time: 25, max_time: 90 }
                ]
            },
            {
                key: 'spawnally',
                label: 'Ally',
                attitude: 'ally',
                iconBase: '/data/pngs/enemyspawns/spawnally_',
                color: '#44aa44',
                defaults: [
                    { total_max_threat: 3, max_individual_threat: 2, threat_per_minute: 1, min_time: 60, max_time: 180 },
                    { total_max_threat: 5, max_individual_threat: 3, threat_per_minute: 2, min_time: 50, max_time: 160 },
                    { total_max_threat: 7, max_individual_threat: 3, threat_per_minute: 3, min_time: 45, max_time: 140 },
                    { total_max_threat: 9, max_individual_threat: 4, threat_per_minute: 4, min_time: 40, max_time: 120 },
                    { total_max_threat: 11, max_individual_threat: 5, threat_per_minute: 5, min_time: 35, max_time: 100 }
                ]
            },
            {
                key: 'spawnenemy',
                label: 'Enemy',
                attitude: 'enemy',
                iconBase: '/data/pngs/enemyspawns/spawnenemy_',
                color: '#aa4444',
                defaults: [
                    { total_max_threat: 4, max_individual_threat: 2, threat_per_minute: 3, min_time: 35, max_time: 100 },
                    { total_max_threat: 6, max_individual_threat: 3, threat_per_minute: 4, min_time: 30, max_time: 90 },
                    { total_max_threat: 8, max_individual_threat: 4, threat_per_minute: 5, min_time: 25, max_time: 80 },
                    { total_max_threat: 10, max_individual_threat: 4, threat_per_minute: 6, min_time: 20, max_time: 70 },
                    { total_max_threat: 12, max_individual_threat: 5, threat_per_minute: 7, min_time: 15, max_time: 60 }
                ]
            },
            {
                key: 'spawnfaction',
                label: 'Faction',
                attitude: 'none',
                iconBase: '/data/pngs/enemyspawns/spawnfactionorsubgroup_',
                color: '#888844',
                defaults: [
                    { total_max_threat: 4, max_individual_threat: 2, threat_per_minute: 2, min_time: 40, max_time: 120 },
                    { total_max_threat: 6, max_individual_threat: 3, threat_per_minute: 3, min_time: 35, max_time: 110 },
                    { total_max_threat: 8, max_individual_threat: 3, threat_per_minute: 4, min_time: 30, max_time: 100 },
                    { total_max_threat: 10, max_individual_threat: 4, threat_per_minute: 5, min_time: 25, max_time: 90 },
                    { total_max_threat: 12, max_individual_threat: 5, threat_per_minute: 6, min_time: 20, max_time: 80 }
                ]
            }
        ];

        // Create level selector
        const levelSelectorContainer = document.createElement('div');
        levelSelectorContainer.style.gridColumn = '1 / -1';
        levelSelectorContainer.style.padding = '10px';
        levelSelectorContainer.style.borderBottom = '1px solid #444';
        levelSelectorContainer.innerHTML = `
            <label style="display: block; margin-bottom: 5px;">Spawner Level (affects threat scaling):</label>
            <div style="display: flex; justify-content: center; gap: 10px;">
                ${[1, 2, 3, 4, 5].map(lvl => `
                    <button class="spawner-level-btn${lvl === 1 ? ' active' : ''}" data-level="${lvl}" style="
                        padding: 5px 15px;
                        background: ${lvl === 1 ? '#666' : '#333'};
                        border: 1px solid #888;
                        color: white;
                        cursor: pointer;
                        font-weight: bold;
                    ">Lvl ${lvl}</button>
                `).join('')}
            </div>
        `;
        this.paletteContainer.appendChild(levelSelectorContainer);

        let selectedLevel = 1;
        const spawnTypeImages = new Map(); // Store references to update all icons

        // Add level button click handlers
        levelSelectorContainer.querySelectorAll('.spawner-level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedLevel = parseInt(btn.dataset.level);
                levelSelectorContainer.querySelectorAll('.spawner-level-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '#333';
                });
                btn.classList.add('active');
                btn.style.background = '#666';

                // Update ALL spawn type icons to match the new level
                spawnTypeImages.forEach((img, spawnType) => {
                    img.src = `${spawnType.iconBase}0${selectedLevel}.png`;
                });

                // Re-select the active spawn type with new level defaults
                const activeItem = this.paletteContainer.querySelector('.palette-item.active');
                if (activeItem) activeItem.click();
            });
        });

        // Create spawn type items
        spawnTypes.forEach(spawnType => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            item.dataset.key = spawnType.key;
            item.style.backgroundColor = spawnType.color;
            item.style.position = 'relative';

            // Create icon image - use the actual spawner graphic
            const img = document.createElement('img');
            const currentIconPath = `${spawnType.iconBase}0${selectedLevel}.png`;
            img.src = currentIconPath;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.onerror = () => {
                img.style.display = 'none';
                const label = document.createElement('span');
                label.textContent = spawnType.label;
                label.style.fontSize = '10px';
                label.style.position = 'absolute';
                label.style.top = '50%';
                label.style.left = '50%';
                label.style.transform = 'translate(-50%, -50%)';
                item.appendChild(label);
            };
            item.appendChild(img);
            spawnTypeImages.set(spawnType, img); // Store reference for level updates

            // Level indicator
            const levelIndicator = document.createElement('div');
            levelIndicator.style.position = 'absolute';
            levelIndicator.style.bottom = '2px';
            levelIndicator.style.right = '2px';
            levelIndicator.style.fontSize = '9px';
            levelIndicator.style.background = 'rgba(0,0,0,0.7)';
            levelIndicator.style.padding = '1px 3px';
            levelIndicator.style.borderRadius = '2px';
            levelIndicator.textContent = spawnType.label;
            item.appendChild(levelIndicator);

            item.addEventListener('click', () => {
                this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                item.classList.add('active');

                // Update icon to match selected level (redundant but ensures consistency)
                img.src = `${spawnType.iconBase}0${selectedLevel}.png`;

                const levelDefaults = spawnType.defaults[selectedLevel - 1];
                const iconPath = `${spawnType.iconBase}0${selectedLevel}.png`;

                this.editor.activeBrush = {
                    type: 'enemy_spawn_point',
                    key: iconPath, // Use the actual PNG path as the key
                    properties: {
                        attitude: spawnType.attitude,
                        faction: null,
                        subgroup: null,
                        max_individual_threat: levelDefaults.max_individual_threat,
                        threat_per_minute: levelDefaults.threat_per_minute,
                        min_time_between_spawns: levelDefaults.min_time,
                        max_time_between_spawns: levelDefaults.max_time,
                        total_max_threat: levelDefaults.total_max_threat,
                        health: 100 + (selectedLevel - 1) * 50, // Scale health with level
                        max_health: 100 + (selectedLevel - 1) * 50,
                        spawner_level: selectedLevel,
                        spawner_type: spawnType.key // Store the type name for reference
                    }
                };
                this.editor.render();
            });

            this.paletteContainer.appendChild(item);
        });

        const infoText = document.createElement('p');
        infoText.style.gridColumn = '1 / -1';
        infoText.style.padding = '10px';
        infoText.style.fontSize = '11px';
        infoText.style.color = '#aaa';
        infoText.innerHTML = `
            <strong>NPC Spawn Points</strong><br>
            Select a level to scale threat and timing defaults.<br>
            <strong>Primary:</strong> Ship's dominant faction<br>
            <strong>Secondary:</strong> Ship's non-dominant faction<br>
            <strong>Ally:</strong> Closest faction to player<br>
            <strong>Enemy:</strong> Most hostile faction (auto-aggro)<br>
            <strong>Faction:</strong> Custom faction/subgroup selection<br><br>
            Right-click placed spawners to fine-tune properties.
        `;
        this.paletteContainer.appendChild(infoText);
    }

    populateNpcPalette(macroCategory) {
        this.paletteContainer.innerHTML = '';
        this.paletteContainer.style.display = 'grid';
        if (!macroCategory) return;

        const factionColors = {
            Aliens: '#008000', Takers: '#C0C0C0', Droids: '#0066cc', Rebels: '#b05c00',
            Mandalorians: '#FFC72C', Sith: '#990000', Imperials: '#444444', Clones: '#ff8c00'
        };
        const factionColor = factionColors[macroCategory] || '#555';

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'npc-extras';
        controlsContainer.style.gridColumn = '1 / -1';
        controlsContainer.innerHTML = `
            <div class="horizontal-group" style="padding: 5px 0; justify-content: space-around;">
                <label for="npc-alpha-select" style="width: auto;">Texture Cutout:</label>
                <select id="npc-alpha-select"><option value="false">No</option><option value="true">Yes</option></select>
            </div>
            <div class="horizontal-group" style="padding: 5px 0; justify-content: space-around;">
                <label for="npc-opacity-slider" style="width: auto;">Ghost Opacity: <span id="npc-opacity-val">100</span>%</label>
                <input type="range" id="npc-opacity-slider" min="10" max="100" value="100" step="5">
            </div>`;
        this.paletteContainer.appendChild(controlsContainer);
        controlsContainer.style.display = 'block';

        const opacitySlider = document.getElementById('npc-opacity-slider');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                document.getElementById('npc-opacity-val').textContent = e.target.value;
            });
        }

        for (const groupKey in this.assetManager.npcGroups) {
            const groupData = this.assetManager.npcGroups[groupKey];
            if (groupData.macroCategory !== macroCategory) continue;

            const subGroupHeader = document.createElement('div');
            subGroupHeader.className = 'palette-header';
            subGroupHeader.textContent = groupData.name;
            this.paletteContainer.appendChild(subGroupHeader);

            const subGroupRandomContainer = document.createElement('div');
            subGroupRandomContainer.className = 'random-npc-container';
            this.paletteContainer.appendChild(subGroupRandomContainer);

            for (let i = 1; i <= 5; i++) {
                const r_item = document.createElement('div');
                r_item.className = 'palette-item random-npc-item';
                r_item.style.backgroundColor = factionColor;
                r_item.dataset.key = `R${i}_${groupKey}`;
                const r_label = document.createElement('span');
                r_label.textContent = `R${i}`;
                r_item.appendChild(r_label);

                r_item.addEventListener('click', () => {
                    this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                    r_item.classList.add('active');
                    const brushProps = {
                        type: 'random_npc',
                        key: `R${i}_${groupKey}`,
                        properties: {
                            threat: i,
                            macroCategory: macroCategory,
                            subgroup: groupKey
                        }
                    };
                    this.editor.activeBrush = brushProps;
                    this.editor.render();
                });
                subGroupRandomContainer.appendChild(r_item);
            }

            groupData.textures.forEach(textureEntry => {
                const textureFile = typeof textureEntry === 'string' ? textureEntry : textureEntry.file;
                const skinName = textureFile.replace('.png', '');
                const iconInfo = this.assetManager.npcIcons.get(skinName);
                if (!iconInfo) return;

                const item = document.createElement('div');
                item.className = 'palette-item';
                item.dataset.key = skinName;
                const img = window[skinName + '_icon_img']?.cloneNode() || new Image();
                if (!img.src) img.src = iconInfo.icon;
                item.appendChild(img);
                const label = document.createElement('span');
                label.textContent = skinName.replace(/_/g, ' ');
                item.appendChild(label);
                item.addEventListener('click', () => {
                    this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                    item.classList.add('active');
                    this.editor.activeBrush = { type: 'npc', key: skinName, properties: { baseType: iconInfo.config.baseType } };
                    this.editor.render();
                });
                this.paletteContainer.appendChild(item);
            });
        }
    }

    populateDefaultPalette(layerName, textures) {
        const container = document.getElementById(`default-${layerName}-palette`);
        if (!container) return;

        container.innerHTML = ''; // Clear previous items

        const createItem = (key, isNone = false, isFolder = false) => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            if (key) item.dataset.key = key;

            if (isNone) {
                item.innerHTML = '<span>None</span>';
            } else if (isFolder) {
                // For folders (animated/random skyboxes), show folder icon with name
                item.innerHTML = `<span style="font-size: 24px;">📁</span><span style="font-size: 10px; display: block;">${key}</span>`;
            } else {
                const img = new Image();
                img.src = key;
                item.appendChild(img);
            }

            item.addEventListener('click', () => {
                // Remove active class from all items in this palette
                container.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                item.classList.add('active');

                // Update the editor's default texture object
                this.editor.defaultTextures[layerName] = this.editor.defaultTextures[layerName] || {};
                // For skybox, extract just the filename for the key
                let saveKey = key;
                if (layerName === 'skybox' && key && key.includes('/')) {
                    saveKey = key.split('/').pop();
                }
                this.editor.defaultTextures[layerName].key = isNone ? null : saveKey;

                // Trigger a state change and re-render
                this.editor.modifyState(() => { });
                this.editor.render();
            });
            return item;
        };

        // Add a "None" option
        container.appendChild(createItem(null, true));

        // Add items for each texture
        textures.forEach(path => {
            if (path) {
                // Check if this is a folder (for skybox animated/random types)
                const isFolder = layerName === 'skybox' && !path.includes('/');
                container.appendChild(createItem(path, false, isFolder));
            }
        });

        // Set the initial active item
        const currentDefault = this.editor.defaultTextures[layerName]?.key;
        const activeItem = currentDefault ? container.querySelector(`[data-key="${currentDefault}"]`) : container.firstChild;
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    populateDefaultTextureSettings() {
        // Keep dropdowns for layers that still use them
        const dropdownLayers = [];
        for (const layer of dropdownLayers) {
            const select = this.defaultTextureSelects[layer];
            if (!select) continue;
            select.innerHTML = '';
            select.add(new Option('None', ''));
            (this.assetManager.layerTextures[layer] || []).forEach(p => {
                if (p) select.add(new Option(p.split('/').pop(), p));
            });
            if (this.editor.defaultTextures[layer]) {
                select.value = this.editor.defaultTextures[layer].key;
            }
        }

        // Use new palette UI for other defaults
        this.populateDefaultPalette('subfloor', this.assetManager.layerTextures['subfloor'] || []);
        this.populateDefaultPalette('floor', this.assetManager.layerTextures['floor'] || []);
        this.populateDefaultPalette('ceiling', this.assetManager.layerTextures['ceiling'] || []);
        this.populateDefaultPalette('water', this.assetManager.layerTextures['water'] || []);
        this.populateDefaultPalette('floater', this.assetManager.layerTextures['floater'] || []);
        this.populateDefaultPalette('sky', this.assetManager.layerTextures['sky'] || []);

        // Special handling for skybox which has static and animated types
        const skyboxTextures = [
            ...this.assetManager.skyboxStaticFiles,
            ...this.assetManager.skyboxAnimationFolders
        ];
        this.populateDefaultPalette('skybox', skyboxTextures);


        const ceilingWallSelect = document.getElementById('default-ceiling-wall-select');
        if (ceilingWallSelect) {
            (this.assetManager.layerTextures['ceilingsides'] || []).forEach(p => { if (p) ceilingWallSelect.add(new Option(p.split('/').pop(), p)); });
            const dv = this.editor.defaultTextures.ceiling?.wallside;
            if (dv) ceilingWallSelect.value = dv;
            ceilingWallSelect.addEventListener('change', (e) => {
                this.editor.defaultTextures.ceiling = this.editor.defaultTextures.ceiling || {};
                this.editor.defaultTextures.ceiling.wallside = e.target.value;
                this.editor.modifyState(() => { });
            });
        }

        // Populate music settings
        this.populateMusicSettings();
    }

    populateMusicSettings() {
        const musicTypeSelect = document.getElementById('music-type-select');
        const musicCategoryContainer = document.getElementById('music-category-container');
        const musicTrackContainer = document.getElementById('music-track-container');
        const musicCategorySelect = document.getElementById('music-category-select');
        const musicTrackSelect = document.getElementById('music-track-select');

        if (!musicTypeSelect || !musicCategorySelect || !musicTrackSelect) return;

        // Populate category dropdown
        musicCategorySelect.innerHTML = '';
        this.assetManager.musicCategories.forEach(cat => {
            musicCategorySelect.add(new Option(cat, cat));
        });

        // Populate track dropdown (all tracks from all categories)
        const populateTrackSelect = () => {
            musicTrackSelect.innerHTML = '';
            for (const category of this.assetManager.musicCategories) {
                const tracks = this.assetManager.musicLibrary[category] || [];
                tracks.forEach(trackPath => {
                    let trackName = decodeURIComponent(trackPath.split('/').pop());
                    trackName = trackName.replace(/\.mp3|\.ogg|\.wav/gi, '');
                    musicTrackSelect.add(new Option(`${category}/${trackName}`, trackPath));
                });
            }
        };
        populateTrackSelect();

        // Handle type switching
        const updateMusicContainers = () => {
            const type = musicTypeSelect.value;
            musicCategoryContainer.style.display = type === 'category' ? 'flex' : 'none';
            musicTrackContainer.style.display = type === 'track' ? 'flex' : 'none';
        };

        musicTypeSelect.addEventListener('change', () => {
            updateMusicContainers();
            this.updateMusicSetting();
        });

        musicCategorySelect.addEventListener('change', () => this.updateMusicSetting());
        musicTrackSelect.addEventListener('change', () => this.updateMusicSetting());

        // Initialize display
        updateMusicContainers();

        // Load existing music settings if present
        const musicSettings = this.editor.defaultTextures.music;
        if (musicSettings) {
            if (musicSettings.type === 'category') {
                musicTypeSelect.value = 'category';
                musicCategorySelect.value = musicSettings.value || '';
            } else if (musicSettings.type === 'track') {
                musicTypeSelect.value = 'track';
                musicTrackSelect.value = musicSettings.value || '';
            } else {
                musicTypeSelect.value = 'random';
            }
            updateMusicContainers();
        }
    }

    updateMusicSetting() {
        const musicTypeSelect = document.getElementById('music-type-select');
        const musicCategorySelect = document.getElementById('music-category-select');
        const musicTrackSelect = document.getElementById('music-track-select');

        const type = musicTypeSelect.value;

        if (type === 'random') {
            // Remove music setting (use default random behavior)
            delete this.editor.defaultTextures.music;
        } else if (type === 'category') {
            this.editor.defaultTextures.music = {
                type: 'category',
                value: musicCategorySelect.value
            };
        } else if (type === 'track') {
            this.editor.defaultTextures.music = {
                type: 'track',
                value: musicTrackSelect.value
            };
        }

        this.editor.modifyState(() => { });
    }

    updateSettingsUI() {
        this.gridWidthInput.value = this.editor.gridWidth; this.gridHeightInput.value = this.editor.gridHeight;
        for (const [layer, defaultInfo] of Object.entries(this.editor.defaultTextures)) {
            const select = this.defaultTextureSelects[layer]; const sizeSelect = document.getElementById(`default-${layer}-size`);
            if (select) select.value = defaultInfo.key || ''; if (sizeSelect) sizeSelect.value = defaultInfo.size || '1';
        }
        const cws = document.getElementById('default-ceiling-wall-select'); if (cws && this.editor.defaultTextures.ceiling) cws.value = this.editor.defaultTextures.ceiling.wallside || '';
        const chs = this.defaultTextureSelects['ceilingHeight']; if (chs && this.editor.defaultTextures.ceiling) chs.value = this.editor.defaultTextures.ceiling.heightMultiplier || '1';

        // Update music settings UI
        const musicTypeSelect = document.getElementById('music-type-select');
        const musicCategorySelect = document.getElementById('music-category-select');
        const musicTrackSelect = document.getElementById('music-track-select');
        const musicCategoryContainer = document.getElementById('music-category-container');
        const musicTrackContainer = document.getElementById('music-track-container');

        if (musicTypeSelect) {
            const musicSettings = this.editor.defaultTextures.music;
            if (musicSettings) {
                if (musicSettings.type === 'category') {
                    musicTypeSelect.value = 'category';
                    if (musicCategorySelect) musicCategorySelect.value = musicSettings.value || '';
                    if (musicCategoryContainer) musicCategoryContainer.style.display = 'flex';
                    if (musicTrackContainer) musicTrackContainer.style.display = 'none';
                } else if (musicSettings.type === 'track') {
                    musicTypeSelect.value = 'track';
                    if (musicTrackSelect) musicTrackSelect.value = musicSettings.value || '';
                    if (musicCategoryContainer) musicCategoryContainer.style.display = 'none';
                    if (musicTrackContainer) musicTrackContainer.style.display = 'flex';
                } else {
                    musicTypeSelect.value = 'random';
                    if (musicCategoryContainer) musicCategoryContainer.style.display = 'none';
                    if (musicTrackContainer) musicTrackContainer.style.display = 'none';
                }
            } else {
                musicTypeSelect.value = 'random';
                if (musicCategoryContainer) musicCategoryContainer.style.display = 'none';
                if (musicTrackContainer) musicTrackContainer.style.display = 'none';
            }
        }
    }

    populateElevationPalette() {
        this.paletteContainer.innerHTML = ''; this.paletteContainer.style.display = 'block';
        const controlsContainer = document.createElement('div'); controlsContainer.id = 'elevation-extras';
        controlsContainer.innerHTML = `<div class="content-group"><h4>Elevation Details</h4><div class="horizontal-group"><label for="elevation-level-input">Height:</label><input type="number" id="elevation-level-input" value="1" min="1" max="30" step="1"></div><div class="horizontal-group"><label for="elevation-wall-select">Wallside:</label><select id="elevation-wall-select"></select></div></div>`;
        this.paletteContainer.appendChild(controlsContainer);
        const wallSelect = document.getElementById('elevation-wall-select'); const levelInput = document.getElementById('elevation-level-input');
        levelInput.addEventListener('change', () => this.updateElevationLevel(parseInt(levelInput.value, 10)));
        wallSelect.addEventListener('change', () => this.updateElevationLevel(this.elevationLevel));
        this.populateSelect(wallSelect, this.assetManager.layerTextures['elevationsides'] || [], '/data/pngs/elevationsides/eside_default.png');
        this.updateElevationLevel(1);
    }

    populateCeilingPalette() {
        this.paletteContainer.innerHTML = ''; this.paletteContainer.style.display = 'block';
        const controlsContainer = document.createElement('div'); controlsContainer.id = 'ceiling-extras';
        controlsContainer.innerHTML = `<div class="content-group"><h4>Ceiling Details</h4>
            <div class="horizontal-group">
                <label for="ceiling-height-input">Height Multiplier:</label>
                <input type="number" id="ceiling-height-input" value="1" min="1" max="10" step="1">
            </div>
            <div class="horizontal-group">
                <label for="ceiling-wallside-select">Wallside:</label>
                <select id="ceiling-wallside-select"></select>
            </div>
            <div id="ceiling-base-palette" class="palette"></div>
        </div>`;
        this.paletteContainer.appendChild(controlsContainer);

        const heightInput = document.getElementById('ceiling-height-input');
        const wallsideSelect = document.getElementById('ceiling-wallside-select');
        const basePaletteContainer = document.getElementById('ceiling-base-palette');

        const updateBrush = () => this.updateCeilingHeight(parseInt(heightInput.value, 10));
        heightInput.addEventListener('change', updateBrush);
        wallsideSelect.addEventListener('change', updateBrush);

        this.populateSelect(wallsideSelect, this.assetManager.layerTextures['ceilingsides'] || [], '/data/pngs/ceilingsides/cside_default.png');

        const baseTextures = this.assetManager.layerTextures['ceiling'] || [];
        basePaletteContainer.innerHTML = '';
        baseTextures.forEach(path => {
            const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = path;
            const img = new Image(); img.src = path; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', ''); item.appendChild(label);
            item.addEventListener('click', () => {
                basePaletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                item.classList.add('active');
                updateBrush();
            });
            basePaletteContainer.appendChild(item);
        });

        const firstItem = basePaletteContainer.querySelector('.palette-item');
        if (firstItem) {
            firstItem.classList.add('active');
            updateBrush();
        } else {
            this.editor.activeBrush = null;
        }
    }

    populateStackedWallPalette(layerName) {
        this.paletteContainer.innerHTML = ''; this.paletteContainer.style.display = 'block';
        const controlsContainer = document.createElement('div'); controlsContainer.id = 'wall-extras';
        controlsContainer.innerHTML = `<div class="content-group"><h4>Wall Details (3x Height)</h4><div class="horizontal-group"><label for="wall-level2-select" style="color:#f00;">Level 2:</label><select id="wall-level2-select"></select></div><div class="horizontal-group"><label for="wall-level3-select" style="color:#f00;">Level 3:</label><select id="wall-level3-select"></select></div></div><div class="content-group"><h4>Base Texture (Level 1)</h4><div id="wall-base-palette" class="palette"></div></div>`;
        this.paletteContainer.appendChild(controlsContainer);
        const level2Select = document.getElementById('wall-level2-select'); const level3Select = document.getElementById('wall-level3-select'); const basePaletteContainer = document.getElementById('wall-base-palette');
        const wall2Textures = this.assetManager.layerTextures['wall'].filter(p => p.includes('/wall2/')); const wall3Textures = this.assetManager.layerTextures['wall'].filter(p => p.includes('/wall3/'));

        this.populateSelect(level2Select, wall2Textures, '/data/pngs/wall/wall2/w2_default.png', true);
        this.populateSelect(level3Select, wall3Textures, '/data/pngs/wall/wall3/wall3_default.png', true);

        const baseTextures = this.assetManager.layerTextures[layerName].filter(p => !p.includes('/wall2/') && !p.includes('/wall3/'));
        basePaletteContainer.innerHTML = '';
        baseTextures.forEach(path => {
            const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = path;
            const img = new Image(); img.src = path; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', ''); item.appendChild(label);
            item.addEventListener('click', () => { basePaletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); updateBrush(); });
            basePaletteContainer.appendChild(item);
        });
        const updateBrush = () => {
            const activeBaseItem = basePaletteContainer.querySelector('.palette-item.active'); if (!activeBaseItem) return;
            this.editor.activeBrush = { type: 'texture', key: activeBaseItem.dataset.key, properties: { level2: level2Select.value !== 'none' ? level2Select.value : undefined, level3: level3Select.value !== 'none' ? level3Select.value : undefined } };
            this.editor.render();
        };
        level2Select.addEventListener('change', updateBrush); level3Select.addEventListener('change', updateBrush);
        const firstItem = basePaletteContainer.querySelector('.palette-item');
        if (firstItem) { firstItem.classList.add('active'); updateBrush(); } else { this.editor.activeBrush = null; }
    }

    populateSkyboxPalette() {
        this.paletteContainer.innerHTML = '';
        this.paletteContainer.style.display = 'block';

        const currentSkybox = this.editor.levelData.skybox.get('0,0');
        const currentType = currentSkybox ? (currentSkybox.properties?.type || (currentSkybox.key ? 'static' : 'none')) : 'none';
        const currentKey = currentSkybox ? currentSkybox.key : '';

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'skybox-extras';
        controlsContainer.innerHTML = `
            <div class="content-group">
                <h4>Skybox Selection</h4>
                <div class="horizontal-group" style="justify-content: space-around; padding: 10px 0; flex-wrap: wrap;">
                    <label><input type="radio" name="skybox-type" value="none" ${currentType === 'none' ? 'checked' : ''}> None</label>
                    <label><input type="radio" name="skybox-type" value="static" ${currentType === 'static' ? 'checked' : ''}> Static</label>
                    <label><input type="radio" name="skybox-type" value="random_static" ${currentType === 'random_static' ? 'checked' : ''}> Random Static</label>
                    <label><input type="radio" name="skybox-type" value="animation" ${currentType === 'animation' ? 'checked' : ''}> Animated</label>
                </div>
                <div id="skybox-static-container" class="horizontal-group" style="display: none;">
                    <label for="skybox-static-select">Image:</label>
                    <select id="skybox-static-select"></select>
                </div>
                <div id="skybox-random-container" class="horizontal-group" style="display: none;">
                    <label for="skybox-random-select">Folder:</label>
                    <select id="skybox-random-select"></select>
                </div>
                <div id="skybox-animated-container" class="horizontal-group" style="display: none;">
                    <label for="skybox-animated-select">Animation:</label>
                    <select id="skybox-animated-select"></select>
                </div>
            </div>`;
        this.paletteContainer.appendChild(controlsContainer);

        const staticContainer = document.getElementById('skybox-static-container');
        const randomContainer = document.getElementById('skybox-random-container');
        const animatedContainer = document.getElementById('skybox-animated-container');
        const staticSelect = document.getElementById('skybox-static-select');
        const randomSelect = document.getElementById('skybox-random-select');
        const animatedSelect = document.getElementById('skybox-animated-select');
        const radios = controlsContainer.querySelectorAll('input[name="skybox-type"]');

        this.populateSelect(staticSelect, this.assetManager.skyboxStaticFiles.map(f => f), '', true);
        this.populateSelect(randomSelect, this.assetManager.skyboxAnimationFolders, '', true);
        this.populateSelect(animatedSelect, this.assetManager.skyboxAnimationFolders, '', true);

        const updateSkybox = (type, key) => {
            this.editor.modifyState(() => {
                this.editor.levelData.skybox.clear();
                if (type === 'none') {
                    // Add an explicit 'none' entry. The game's createSkybox function
                    // will see the null key and correctly remove the skybox.
                    this.editor.levelData.skybox.set('0,0', { key: null, properties: { type: 'none' } });
                } else if (key) {
                    // Extract just the filename (without path) for the level JSON key
                    // The game's assetManager.skyboxSets uses base names as keys
                    let baseKey = key;
                    if (key.includes('/')) {
                        baseKey = key.split('/').pop(); // Get filename from full path
                    }
                    const skyboxData = { key: baseKey, properties: { type: type } };
                    this.editor.levelData.skybox.set('0,0', skyboxData);
                }
            });
        };

        const onTypeChange = () => {
            const selectedType = controlsContainer.querySelector('input[name="skybox-type"]:checked').value;
            staticContainer.style.display = selectedType === 'static' ? 'flex' : 'none';
            randomContainer.style.display = selectedType === 'random_static' ? 'flex' : 'none';
            animatedContainer.style.display = selectedType === 'animation' ? 'flex' : 'none';
            let key = '';
            if (selectedType === 'static') key = staticSelect.value;
            else if (selectedType === 'random_static') key = randomSelect.value;
            else if (selectedType === 'animation') key = animatedSelect.value;
            updateSkybox(selectedType, key);
        };

        radios.forEach(radio => radio.addEventListener('change', onTypeChange));
        staticSelect.addEventListener('change', () => updateSkybox('static', staticSelect.value));
        randomSelect.addEventListener('change', () => updateSkybox('random_static', randomSelect.value));
        animatedSelect.addEventListener('change', () => updateSkybox('animation', animatedSelect.value));

        // Helper to find matching option (handles both full paths and filenames)
        const findMatchingOption = (selectEl, key) => {
            if (!key) return;
            // Try direct match first
            for (let option of selectEl.options) {
                if (option.value === key) {
                    selectEl.value = key;
                    return;
                }
            }
            // Try matching by filename (option value ends with the key)
            for (let option of selectEl.options) {
                if (option.value.endsWith('/' + key) || option.value.endsWith(key)) {
                    selectEl.value = option.value;
                    return;
                }
            }
        };

        // Set initial state
        if (currentType === 'static') {
            findMatchingOption(staticSelect, currentKey);
        } else if (currentType === 'random_static') {
            randomSelect.value = currentKey;
        } else if (currentType === 'animation') {
            animatedSelect.value = currentKey;
        }
        onTypeChange();
    }

    populateSelect(selectEl, textures, defaultPath, allowNone = false) {
        selectEl.innerHTML = ''; if (allowNone) selectEl.add(new Option('None', ''));
        textures.forEach(path => { if (path) selectEl.add(new Option(path.split('/').pop(), path)); });
        if (defaultPath) selectEl.value = defaultPath;
    }

    populatePillarPalette() {
        this.paletteContainer.innerHTML = '';
        this.paletteContainer.style.display = 'block';

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'pillar-extras';
        controlsContainer.innerHTML = `
            <div class="content-group">
                <h4>Pillar Properties</h4>
                <div class="horizontal-group">
                    <label for="pillar-width-slider">Width: <span id="pillar-width-val">11</span>%</label>
                    <input type="range" id="pillar-width-slider" min="1" max="100" value="11" step="1">
                </div>
                <div class="horizontal-group">
                    <label for="pillar-height-input">Height:</label>
                    <input type="number" id="pillar-height-input" value="${this.pillarHeight}" min="1" max="30" step="1">
                </div>
                <div class="horizontal-group">
                    <label for="pillar-placement-select">Placement:</label>
                    <select id="pillar-placement-select">
                        <option value="center">Center</option>
                        <option value="topLeft">Top-Left</option>
                        <option value="topRight">Top-Right</option>
                        <option value="bottomLeft">Bottom-Left</option>
                        <option value="bottomRight">Bottom-Right</option>
                    </select>
                </div>
            </div>
            <div id="pillar-base-palette" class="palette"></div>
        `;
        this.paletteContainer.appendChild(controlsContainer);

        const widthSlider = document.getElementById('pillar-width-slider');
        const widthVal = document.getElementById('pillar-width-val');
        const heightInput = document.getElementById('pillar-height-input');
        const placementSelect = document.getElementById('pillar-placement-select');
        const basePaletteContainer = document.getElementById('pillar-base-palette');

        const updateBrush = () => {
            const activeBaseItem = basePaletteContainer.querySelector('.palette-item.active');
            if (!activeBaseItem) return;

            const width = parseInt(widthSlider.value, 10);
            const height = parseInt(heightInput.value, 10);
            const placement = placementSelect.value;

            widthVal.textContent = width;
            this.pillarHeight = height;
            if (this.pillarDisplay) this.pillarDisplay.textContent = `Height: ${this.pillarHeight}`;

            this.editor.setPillarPlacementMode(placement);

            this.editor.activeBrush = {
                type: 'pillar',
                key: activeBaseItem.dataset.key,
                properties: {
                    width: width,
                    height: height
                }
            };
            this.editor.render();
        };

        widthSlider.addEventListener('input', updateBrush);
        heightInput.addEventListener('change', updateBrush);
        placementSelect.addEventListener('change', updateBrush);

        const textures = this.assetManager.layerTextures['pillar'] || [];
        const groups = {};
        textures.forEach(path => { if (!path) return; const dir = path.split('/')[path.split('/').length - 2]; if (!groups[dir]) groups[dir] = []; groups[dir].push(path); });

        for (const dir in groups) {
            const header = document.createElement('div'); header.className = 'palette-header'; header.textContent = dir.charAt(0).toUpperCase() + dir.slice(1); basePaletteContainer.appendChild(header);
            for (const path of groups[dir]) {
                const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = path;
                const img = new Image(); img.src = path; item.appendChild(img);
                const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', '').replace(/_/g, ' '); item.appendChild(label);
                item.addEventListener('click', () => {
                    basePaletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                    item.classList.add('active');
                    updateBrush();
                });
                basePaletteContainer.appendChild(item);
            }
        }

        const firstItem = basePaletteContainer.querySelector('.palette-item');
        if (firstItem) {
            firstItem.click();
        } else {
            this.editor.activeBrush = null;
        }
    }

    initRoomPanel() {
        if (!this.roomPanel) return;

        // Populate wall2 and wall3 dropdowns
        const wall2Select = document.getElementById('room-wall2');
        const wall3Select = document.getElementById('room-wall3');
        const styleSelect = document.getElementById('room-style');

        const populateWallDropdowns = (selectedStyle) => {
            // Default texture mappings for each style
            const styleDefaultsWall2 = {
                'imperialstyle': '/data/pngs/wall/wall2/imperialwall2.png',
                'neutralstyle': '/data/pngs/wall/wall2/neutralwall2.png',
                'rebelstyle': '/data/pngs/wall/wall2/rebelwall2.png'
            };
            const styleDefaultsWall3 = {
                'imperialstyle': '/data/pngs/wall/wall3/imperialwall3.png',
                'neutralstyle': '/data/pngs/wall/wall3/neutralwall3.png',
                'rebelstyle': '/data/pngs/wall/wall3/rebelwall3.png'
            };

            if (wall2Select) {
                wall2Select.innerHTML = '<option value="auto">Auto (Style Default)</option>';
                const wall2Textures = this.assetManager.layerTextures['wall']?.filter(p => p.includes('/wall2/')) || [];
                // Put style default first if it exists
                const defaultWall2 = styleDefaultsWall2[selectedStyle];
                if (defaultWall2 && wall2Textures.includes(defaultWall2)) {
                    wall2Select.add(new Option(`${defaultWall2.split('/').pop()} (Style Default)`, defaultWall2));
                }
                wall2Textures.forEach(path => {
                    if (path !== defaultWall2) {
                        wall2Select.add(new Option(path.split('/').pop(), path));
                    }
                });
                // Auto-select the "auto" option so it uses style default
                wall2Select.value = 'auto';
            }

            if (wall3Select) {
                wall3Select.innerHTML = '<option value="auto">Auto (Style Default)</option>';
                const wall3Textures = this.assetManager.layerTextures['wall']?.filter(p => p.includes('/wall3/')) || [];
                // Put style default first if it exists
                const defaultWall3 = styleDefaultsWall3[selectedStyle];
                if (defaultWall3 && wall3Textures.includes(defaultWall3)) {
                    wall3Select.add(new Option(`${defaultWall3.split('/').pop()} (Style Default)`, defaultWall3));
                }
                wall3Textures.forEach(path => {
                    if (path !== defaultWall3) {
                        wall3Select.add(new Option(path.split('/').pop(), path));
                    }
                });
                // Auto-select the "auto" option so it uses style default
                wall3Select.value = 'auto';
            }
        };

        // Initialize dropdowns with current style
        if (styleSelect) {
            populateWallDropdowns(styleSelect.value);
            // Update dropdowns when style changes
            styleSelect.addEventListener('change', () => {
                populateWallDropdowns(styleSelect.value);
            });
        } else {
            populateWallDropdowns('imperialstyle');
        }

        // Handle faction change to populate subgroups
        const factionSelect = document.getElementById('room-npc-faction');
        const subgroupSelect = document.getElementById('room-npc-subgroup');

        if (factionSelect && subgroupSelect) {
            factionSelect.addEventListener('change', () => {
                const faction = factionSelect.value;
                subgroupSelect.innerHTML = '<option value="all">Any</option>';

                if (faction !== 'none') {
                    // Find all subgroups for this faction
                    for (const groupKey in this.assetManager.npcGroups) {
                        const groupData = this.assetManager.npcGroups[groupKey];
                        if (groupData.macroCategory === faction) {
                            subgroupSelect.add(new Option(groupData.name || groupKey, groupKey));
                        }
                    }
                }
            });
        }

        // Handle generate button
        const generateBtn = document.getElementById('generate-room-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateRoomFromPanel();
            });
        }

        // Handle cancel button
        const cancelBtn = document.getElementById('cancel-room-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideRoomPanel();
            });
        }

        // Handle shuffle button
        const shuffleBtn = document.getElementById('room-shuffle-btn');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                if (this.editor.pendingRoomBounds) {
                    this.generateRoomFromPanel(); // Regenerate with new random values
                }
            });
        }
    }

    showRoomPanel(bounds) {
        if (!this.roomPanel) return;

        // Initialize panel if first time
        if (!this._roomPanelInitialized) {
            this.initRoomPanel();
            this._roomPanelInitialized = true;
        }

        this.roomPanel.style.display = 'block';
        this.editor.render();
    }

    hideRoomPanel() {
        if (this.roomPanel) {
            this.roomPanel.style.display = 'none';
        }
        this.editor.pendingRoomBounds = null;
        this.editor.roomSelectionStart = null;
        this.editor.roomSelectionEnd = null;
        this.editor.render();
    }

    generateRoomFromPanel() {
        if (!this.editor.pendingRoomBounds) return;

        const style = document.getElementById('room-style').value;
        const theme = document.getElementById('room-theme').value;
        const wall2Val = document.getElementById('room-wall2').value;
        const wall3Val = document.getElementById('room-wall3').value;

        // Auto-select wall2/wall3 based on style if set to auto
        let wall2Key = wall2Val;
        let wall3Key = wall3Val;

        if (wall2Val === 'auto') {
            const styleMap = {
                'imperialstyle': '/data/pngs/wall/wall2/imperialwall2.png',
                'neutralstyle': '/data/pngs/wall/wall2/neutralwall2.png',
                'rebelstyle': '/data/pngs/wall/wall2/rebelwall2.png'
            };
            wall2Key = styleMap[style] || undefined;
        }

        if (wall3Val === 'auto') {
            const styleMap = {
                'imperialstyle': '/data/pngs/wall/wall3/imperialwall3.png',
                'neutralstyle': '/data/pngs/wall/wall3/neutralwall3.png',
                'rebelstyle': '/data/pngs/wall/wall3/rebelwall3.png'
            };
            wall3Key = styleMap[style] || undefined;
        }

        const config = {
            style: style,
            theme: theme,
            wall2Key: wall2Key,
            wall3Key: wall3Key,
            ceilingHeight: parseInt(document.getElementById('room-ceiling-height').value) || 1,
            elevation: parseInt(document.getElementById('room-elevation').value) || 0,
            hasWater: document.getElementById('room-water').checked,
            furnitureCount: parseInt(document.getElementById('room-furniture-count').value) || 0,
            npcConfig: {
                faction: document.getElementById('room-npc-faction').value,
                subgroup: document.getElementById('room-npc-subgroup').value,
                totalThreat: parseInt(document.getElementById('room-total-threat').value) || 0,
                maxIndividualThreat: parseInt(document.getElementById('room-max-individual-threat').value) || 5,
                noRepeats: document.getElementById('room-no-repeats').checked
            },
            randomPerGame: document.getElementById('room-random-per-game').checked
        };

        this.editor.generateRoom(this.editor.pendingRoomBounds, config);
        this.hideRoomPanel();
    }
}

