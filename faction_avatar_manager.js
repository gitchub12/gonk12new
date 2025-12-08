// BROWSERFIREFOXHIDE faction_avatar_manager.js
// update: Integrated the Mandalorian faction into the avatar system.
// update: Implemented the 'hidden until encountered' logic based on player stats to hide faction avatars until discovered.
// update: Implemented dynamic pixel offset positioning based on relationship score (1px per 10 points from 4px base).
// update: Removed excessive directory listing console logs.

class FactionAvatarManager {
    constructor() {
        this.container = null;
        this.avatars = {}; // { faction: { state: [urls] } }
        this.factionAvatars = []; // { el, imgEl, factionKey, currentState, animTimer, nextAnimTime, currentFrame, isAnimating }
        this.initialized = false;
        this.stateThresholds = {
            h3: 15,       // 0-15
            h2: 25,       // 16-25
            h1: 35,       // 26-35
            i1: 50,       // 36-50 (Neutral)
            m1: 65,       // 51-65
            m2: 75,       // 66-75
            m3: Infinity  // 76+
        };

        // Define the 3x3 grid order
        this.FACTION_GRID_ORDER = [
            'takers', 'imperials', 'sith',
            'clones', 'player_droid', 'droids',
            'mandalorians', 'aliens', 'rebels'
        ];
    }

    async initialize() {
        this.container = document.createElement('div');
        this.container.id = 'faction-avatar-container';
        this.container.style.zIndex = '100'; // Changed from 4 to 100 for easier z-index adjustment
        this.container.style.position = 'absolute'; // Allows HUD controls to move the whole grid
        document.querySelector('.game-hud-container').appendChild(this.container);

        await this.discoverFactionAvatars();

        const factionColors = {
            rebels: { bg: '#a12a2a', border: '#d94242' },
            aliens: { bg: '#004d00', border: '#008000' },
            clones: { bg: '#b05c00', border: '#ff8c00' },
            imperials: { bg: '#101010', border: '#444444' },
            droids: { bg: '#003366', border: '#0066cc' },
            mandalorians: { bg: '#DAA520', border: '#FFC72C' },
            sith: { bg: '#330000', border: '#990000' },
            takers: { bg: '#2E2E2E', border: '#C0C0C0' },
            player_droid: { bg: 'transparent', border: 'transparent' } // Gonk has no border/background
        };

        // Create avatar elements in the DOM based on the fixed grid order
        for (const factionKey of this.FACTION_GRID_ORDER) {
            const avatarBox = document.createElement('div');
            avatarBox.className = 'faction-avatar-box';
            avatarBox.id = `faction-avatar-${factionKey}`; // Assign unique ID

            // If it's the Gonk slot, use the existing animated image element directly.
            if (factionKey === 'player_droid') {
                avatarBox.classList.add('gonk-avatar-box');

                // Get the relocated animated element from main.js and put it inside the box.
                const animatedGonk = document.getElementById('hologonk-avatar-relocated');
                if (animatedGonk) {
                    animatedGonk.style.display = 'block';
                    avatarBox.appendChild(animatedGonk);
                } else {
                    // Fallback image if JS doesn't move the animated element yet.
                    const fallbackImg = document.createElement('img');
                    fallbackImg.src = 'data/pngs/HUD/hologonk/hologonk_1.png';
                    avatarBox.appendChild(fallbackImg);
                }

            } else if (this.avatars[factionKey]) {
                const avatarImg = document.createElement('img');
                const avatarName = document.createElement('span');
                avatarName.className = 'faction-avatar-name';
                const relationshipValue = document.createElement('span');
                relationshipValue.className = 'faction-avatar-relationship';

                avatarBox.style.setProperty('--faction-avatar-border-color', factionColors[factionKey]?.border || '#444');
                const textColor = (factionColors[factionKey]?.border === '#444444') ? '#FFF' : (factionColors[factionKey]?.border || '#CCC');
                const textShadow = (factionColors[factionKey]?.border === '#444444') ? '0 0 3px #000' : '0 0 3px #000, 0 0 3px #000';
                avatarName.style.color = textColor;
                avatarName.style.textShadow = textShadow;
                avatarName.style.fontSize = 'calc(76px / 6)';
                avatarName.textContent = factionKey.charAt(0).toUpperCase() + factionKey.slice(1);

                avatarBox.appendChild(avatarImg);
                avatarBox.appendChild(avatarName);
                avatarBox.appendChild(relationshipValue);
            } else {
                avatarBox.style.display = 'none';
            }

            this.container.appendChild(avatarBox);

            // Populate the factionAvatars array with references
            const imgEl = avatarBox.querySelector('img:not(#hologonk-avatar-relocated)');
            const nameEl = avatarBox.querySelector('.faction-avatar-name');
            const relationshipEl = avatarBox.querySelector('.faction-avatar-relationship');

            this.factionAvatars.push({
                el: avatarBox,
                imgEl: imgEl,
                nameEl: nameEl,
                relationshipEl: relationshipEl,
                factionKey: factionKey,
                color: factionColors[factionKey]?.border || '#444',
                lastRelationshipValue: -999,
                currentState: null,
                currentAnimImages: [],
                animTimer: 0,
                nextAnimTime: 5 + Math.random() * 10,
                currentFrame: 0,
                isAnimating: false
            });
        }
        this.initialized = true;
    }

    async fetchDirectoryListing(path, extensions = [], allowDirectories = false) {
        try {
            const response = await fetch(path);
            if (!response.ok) return [];
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href && !href.startsWith('?') && !href.startsWith('../'));

            const filteredLinks = links.filter(href => (allowDirectories && href.endsWith('/')) || extensions.some(ext => href.endsWith(ext)));
            return filteredLinks;
        } catch (e) {
            console.warn(`Could not fetch directory listing for "${path}". Error:`, e);
            return [];
        }
    }

    async discoverFactionAvatars() {
        const basePath = '/data/pngs/factions/';
        const factionKeys = (await this.fetchDirectoryListing(basePath, [], true)).map(dir => dir.replace('/', '')).filter(f => f !== 'happysymbols' && f !== 'madsymbols' && f !== 'emotesymbols');
        const states = ['h1', 'h2', 'h3', 'i1', 'i2', 'i3', 'm1', 'm2', 'm3', 's1'];

        for (const faction of factionKeys) {
            this.avatars[faction] = {};
            for (const state of states) {
                const path = `${basePath}${faction}/${state}/`;
                const files = await this.fetchDirectoryListing(path, ['.png', '.jpg']);
                if (files.length > 0) {
                    this.avatars[faction][state] = files.sort().map(file => path + file);
                }
            }
        }
        return Object.keys(this.avatars).filter(key => Object.keys(this.avatars[key]).length > 0);
    }

    getStateFromScore(score) {
        if (score <= this.stateThresholds.h3) return 'h3';
        if (score <= this.stateThresholds.h2) return 'h2';
        if (score <= this.stateThresholds.h1) return 'h1';
        if (score <= this.stateThresholds.i1) return 'i1';
        if (score <= this.stateThresholds.m1) return 'm1';
        if (score <= this.stateThresholds.m2) return 'm2';
        return 'm3';
    }

    triggerSpecialAnimation(factionKey, stateKey) {
        const avatar = this.factionAvatars.find(a => a.factionKey === factionKey);
        if (!avatar || !this.avatars[factionKey]?.[stateKey]) return;

        const animImages = this.avatars[factionKey][stateKey];
        if (animImages && animImages.length > 0) {
            avatar.isAnimating = true;
            avatar.currentAnimImages = animImages;
            avatar.currentFrame = 0;
            avatar.animTimer = 0;
            avatar.nextAnimTime = 5 + Math.random() * 5;
        }
    }

    getFallbackState(factionKey, desiredState) {
        if (this.avatars[factionKey]?.[desiredState]) {
            return desiredState;
        }
        if (this.avatars[factionKey]?.['i1']) return 'i1';
        if (this.avatars[factionKey]?.['i2']) return 'i2';
        if (this.avatars[factionKey]?.['i3']) return 'i3';
        return null;
    }

    // NEW: Function to calculate and apply the pixel offset based on relationship score
    _updateAvatarPosition(avatar, relationshipScore) {
        // Movement based on relationship is disabled as per user request.
        avatar.el.style.transform = `translate(0, 0)`;

        // Keep border style update
        const borderWidth = 2; // Set to 2px as requested for the gap calculation
        avatar.el.style.borderWidth = `${borderWidth}px`;
    }

    update(deltaTime) {
        if (!this.initialized || !window.game || !window.game.factionManager || !window.game.state.playerStats) return;

        this.factionAvatars.forEach((avatar) => {
            const factionKey = avatar.factionKey;
            const encounteredFlag = `encountered_${factionKey}`;
            const isEncountered = window.game.state.playerStats[encounteredFlag];

            // Handle visibility based on encountered flag
            if (factionKey === 'player_droid') {
                avatar.el.style.display = 'grid'; // Use grid for Gonk to correctly center animated content
            } else if (isEncountered) {
                avatar.el.style.display = 'block';
            } else {
                avatar.el.style.display = 'none';
                return;
            }

            const relationship = window.game.factionManager.getRelationship('player_droid', factionKey);
            const trend = window.game.factionManager.getRelationshipTrend('player_droid', factionKey);
            let newState = this.getStateFromScore(relationship);
            newState = this.getFallbackState(factionKey, newState);

            this._updateAvatarPosition(avatar, relationship); // Apply dynamic positioning

            if (avatar.relationshipEl) {
                const roundedRelationship = Math.round(relationship);
                if (avatar.lastRelationshipValue !== roundedRelationship) {
                    avatar.lastRelationshipValue = roundedRelationship;
                    avatar.relationshipEl.textContent = roundedRelationship;
                    avatar.relationshipEl.style.color = avatar.color;
                }
            }

            if (!newState && factionKey !== 'player_droid') return;

            // Update avatar image display and animation
            if (factionKey === 'player_droid') {
                // Gonk will be handled differently (already a live element)
                return;
            }

            if (avatar.isAnimating) {
                avatar.animTimer += deltaTime;
                if (avatar.animTimer >= 0.1) {
                    avatar.animTimer = 0;
                    avatar.currentFrame++;
                    if (avatar.currentFrame >= avatar.currentAnimImages.length) {
                        avatar.currentFrame = 0;
                        avatar.isAnimating = false;
                        avatar.nextAnimTime = 5 + Math.random() * 10;
                    }
                    if (avatar.imgEl) avatar.imgEl.src = avatar.currentAnimImages[avatar.currentFrame];
                }
            } else {
                avatar.animTimer += deltaTime;
                if (avatar.animTimer >= avatar.nextAnimTime) {
                    const availableStates = this.avatars[factionKey];
                    if (availableStates && availableStates[newState]) {
                        const images = availableStates[newState];
                        if (images.length > 0) {
                            avatar.isAnimating = true;
                            avatar.currentAnimImages = images;
                            avatar.currentFrame = 0;
                            avatar.animTimer = 0;
                        }
                    }
                }
            }

            if (avatar.currentState !== newState) {
                avatar.currentState = newState;
                const availableStates = this.avatars[factionKey];
                if (availableStates && availableStates[newState]) {
                    const images = availableStates[newState];
                    if (images.length > 0 && avatar.imgEl) {
                        avatar.imgEl.src = images[0];
                    }
                }
            }
        });
    }
}