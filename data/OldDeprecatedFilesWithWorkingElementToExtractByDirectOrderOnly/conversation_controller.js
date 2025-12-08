// BROWSERFIREFOXHIDE conversation_controller.js

class ConversationController {
    constructor() {
        this.phraseDatabase = [];
        this.appraisalDatabase = null;
        this.currentConversation = null;

        // State Machine Variables
        this.awaitingChoice = false;
        this.choiceTimer = 0;
        this.currentChoiceConfig = null;
        this.sequenceTimer = 0;
        this.conversationStep = 'idle'; // idle, appraisal, greeting, replying, responding, choice
    }

    loadPhrases(phraseData) {
        if (phraseData && phraseData.phrases) {
            this.phraseDatabase.push(...phraseData.phrases);
        }
        if (phraseData && phraseData.descriptors) {
            this.appraisalDatabase = phraseData;
        }
    }

    // === UPDATE LOOP (Called from Game.update) ===
    update(deltaTime) {
        if (!this.currentConversation || (window.game && window.game.state.isPaused)) return;

        // 1. Distance Check (Abort if too far)
        if (this.currentConversation.initiator.mesh && this.currentConversation.target.mesh) {
            const dist = this.currentConversation.initiator.mesh.group.position.distanceTo(this.currentConversation.target.mesh.group.position);
            if (dist > 10.0) {
                // If they run away during a tense moment, trigger bad outcome
                if (this.currentConversation.tension < 0) {
                    this.triggerBadOutcome(this.currentConversation.initiator, this.currentConversation.target, -100);
                }
                this.conversationEnd(this.currentConversation.initiator, this.currentConversation.target);
                return;
            }
        }

        // 2. Sequence Logic (Timers for reading text)
        if (this.sequenceTimer > 0) {
            this.sequenceTimer -= deltaTime;
            if (this.sequenceTimer <= 0) {
                this.advanceSequence();
            }
        }

        // 3. Choice Timer (Q/E Input Timeout)
        if (this.awaitingChoice) {
            this.choiceTimer -= deltaTime;
            if (window.conversationUIManager) window.conversationUIManager.updateChoiceTimer(this.choiceTimer);
            if (this.choiceTimer <= 0) {
                console.log("Choice timed out. Triggering Default (Bad) Outcome.");
                this.handleChoice('timeout');
            }
        }
    }

    startConversation(initiator, target) {
        if (initiator.config.noConversation || target.config.noConversation) { return false; }

        if (window.conversationUIManager) {
            window.conversationUIManager.showConversationHud();
        }

        // Initialize Game State
        window.game.state.isConversationActive = true;

        // Set NPC State
        initiator.isConversing = true;
        initiator.currentState = 'CONVERSING';
        initiator.target = target;

        // Set Ally State
        target.isConversing = true;
        target.currentState = 'CONVERSING';
        target.target = initiator;

        // Physical Orientation
        if (initiator.mesh && target.mesh) {
            const lookAtTarget1 = target.mesh.group.position.clone();
            lookAtTarget1.y = initiator.mesh.group.position.y;
            initiator.mesh.group.lookAt(lookAtTarget1);

            const lookAtTarget2 = initiator.mesh.group.position.clone();
            lookAtTarget2.y = target.mesh.group.position.y;
            target.mesh.group.lookAt(lookAtTarget2);
        }

        // Calculate Initial Tension based on Faction Relationship
        // Relationship: 0 (Friendly) to 100 (Hostile)
        // Desired Tension: +50 (Friendly) to -50 (Hostile)
        // Formula: (50 - RelationshipDistance) * 2
        const relationDist = window.game.factionManager.getRelationship(initiator.faction, target.isAlly ? target.originalFaction : target.faction);
        const startTension = (50 - relationDist) * 2;

        this.currentConversation = {
            initiator: initiator, // NPC
            target: target,       // Ally
            tension: startTension,
            greetingTopic: 'none',
            relationDist: relationDist
        };

        // UI Setup
        if (window.conversationUIManager) {
            window.conversationUIManager.resetToPeekState(); // Clears old text
            window.conversationUIManager.showGauge(startTension); // Slides gauge up
            window.conversationUIManager.setHighlight(target, true);
            window.conversationUIManager.setHighlight(initiator, true);
            window.conversationUIManager.toggleAllyRingSolid(target, true);
        }

        if (window.conversationLogger) window.conversationLogger.start(initiator, target, "neutral");

        // Start Sequence: Step 1 - Appraisal
        this.conversationStep = 'appraisal';
        this.executeAppraisal();

        return true;
    }

    executeAppraisal() {
        const ally = this.currentConversation.target;
        const npc = this.currentConversation.initiator;
        const dist = this.currentConversation.relationDist;

        // Pick Descriptor based on 1-100 Relationship Scale
        let rangeKey = "31-50";
        if (dist <= 15) rangeKey = "1-15";
        else if (dist <= 30) rangeKey = "16-30";
        else if (dist <= 50) rangeKey = "31-50";
        else if (dist <= 70) rangeKey = "51-70";
        else rangeKey = "71+";

        const descriptors = this.appraisalDatabase ? this.appraisalDatabase.descriptors[rangeKey] : ["unknown"];
        const desc = descriptors ? descriptors[Math.floor(Math.random() * descriptors.length)] : "unknown";

        const templates = this.appraisalDatabase ? this.appraisalDatabase.templates : ["{faction}, {descriptor}."];
        const template = templates[Math.floor(Math.random() * templates.length)];

        const rawFactionName = npc.faction.replace(/_/g, ' ');
        const factionName = rawFactionName.charAt(0).toUpperCase() + rawFactionName.slice(1);

        let text = template.replace('{descriptor}', desc);
        if (text.includes('A(n)')) {
            const article = /^[aeiou]/i.test(factionName) ? 'An' : 'A';
            text = text.replace('A(n)', article);
        }
        text = text.replace('{faction}', factionName);


        // Show Text (Slot 0)
        this.showPhrase(0, ally, { text: text }, 'appraisal');

        // Highlight Ally
        if (window.conversationUIManager) window.conversationUIManager.highlightAllyBox(ally, 'speaking');

        this.sequenceTimer = 3.5; // Time to read appraisal
    }

    advanceSequence() {
        if (this.conversationStep === 'appraisal') {
            this.conversationStep = 'greeting';
            this.executeGreeting();
        } else if (this.conversationStep === 'greeting') {
            this.conversationStep = 'replying';
            this.executeReply();
        } else if (this.conversationStep === 'replying') {
            this.conversationStep = 'responding';
            this.executeResponse();
        }
    }

    executeGreeting() {
        const npc = this.currentConversation.initiator;
        const ally = this.currentConversation.target;

        // 1. Guard Defense Roll (Insight/Suspicion)
        // Simulates the guard "checking" the player. Moves gauge towards Red.
        const npcStats = npc.config || {};
        const suspicion = npcStats['suspicion'] || 40;
        const roll = suspicion + (Math.random() * 20);

        // Apply negative shift
        const tensionChange = -roll;
        this.currentConversation.tension += tensionChange;

        // Update UI
        if (window.conversationUIManager) {
            window.conversationUIManager.updateGauge(this.currentConversation.tension);
            window.conversationUIManager.showStatPopup(npc.name, "Suspicion", tensionChange, "red");
            window.conversationUIManager.highlightAllyBox(ally, null);
        }
        npc.startHighlight('#FF0000'); // Red highlight for threat

        // Select Phrase (m1 if tension is bad, i1 if neutral)
        const attitude = this.currentConversation.tension < -20 ? 'm1' : 'i1';
        const phrase = this.findPhrase(npc, ally, "greeting", attitude, "none");
        this.currentConversation.greetingTopic = phrase ? phrase.topic : 'none';

        // Show Text (Slot 1)
        this.showPhrase(1, npc, phrase || { text: "Halt." }, attitude);

        this.sequenceTimer = 4.0; // Time to read greeting
    }

    executeReply() {
        const npc = this.currentConversation.initiator;
        const ally = this.currentConversation.target;

        // 2. Ally Attack Roll (Charm/Lie)
        // Simulates ally trying to recover the gauge. Moves gauge towards Green.
        const allyStats = ally.config || window.game.state.playerStats;
        const charm = allyStats['charm_attack'] || 50;
        const lie = allyStats['lie_attack'] || 10;

        // Weighted selection based on stats
        const total = charm + lie;
        const isCharm = Math.random() * total > lie; // Higher stat = higher chance
        const skillName = isCharm ? "Charm" : "Lie";
        const roll = (isCharm ? charm : lie) + (Math.random() * 50); // Stat + d50

        // Apply positive shift
        const tensionChange = roll;
        this.currentConversation.tension += tensionChange;

        // Update UI
        if (window.conversationUIManager) {
            window.conversationUIManager.updateGauge(this.currentConversation.tension);
            window.conversationUIManager.showStatPopup(ally.name, "Suspicion", tensionChange, "green");
            window.conversationUIManager.highlightAllyBox(ally, 'replying');
        }
        npc.stopHighlight();

        // Select Phrase based on Style (Charm->Diplomatic, Lie->Bluff)
        const style = isCharm ? ['diplomatic', 'flattery', 'earnest'] : ['bluff', 'deceptive', 'intimidation', 'deflection'];
        const phrase = this.findPhrase(ally, npc, "reply", "neutral", this.currentConversation.greetingTopic, style);

        // Show Text (Slot 2)
        this.showPhrase(2, ally, phrase || { text: "..." }, "neutral");

        this.sequenceTimer = 3.5; // Time to read reply
    }

    executeResponse() {
        const npc = this.currentConversation.initiator;
        const ally = this.currentConversation.target;
        const tension = this.currentConversation.tension;

        if (tension > 0) {
            // --- GOOD OUTCOME ---
            const outcome = tension > 50 ? 'h2' : 'h1';
            const phrase = this.findPhrase(npc, ally, "response", outcome, "none");

            // Show Text (Slot 3)
            this.showPhrase(3, npc, phrase || { text: "Move along." }, outcome);

            // Slight relationship improvement
            const shift = tension > 50 ? -3 : -1; // Negative distance = closer relationship
            this.finishConversation(shift);
        } else {
            // --- BAD OUTCOME ---
            this.triggerBadOutcome(npc, ally, tension);
        }
    }

    triggerBadOutcome(initiator, target, tension) {
        const isAuthoritative = ['imperials', 'clones', 'mandalorians', 'takers', 'rebels'].includes(initiator.faction);

        // 30% chance of "Han Shot First" instant combat, or if faction isn't authoritative (like wild animals/aliens)
        if (Math.random() < 0.3 || !isAuthoritative) {
            // Quip + Shoot
            const quipPhrase = this.findPhrase(target, initiator, "quip", "m1", "none") || { text: "Boring conversation anyway!" };

            // Show Text (Slot 3 - Final action)
            if (window.conversationUIManager) window.conversationUIManager.showPhrase(3, quipPhrase.text, target, '#FF0000', target.name);

            setTimeout(() => {
                // Instant Hit Logic
                initiator.takeDamage(50);
                initiator.aggro(target);
                this.finishConversation(10); // +10 Distance (Worsen relationship)
            }, 1000);
        } else {
            // Choice (Q/E)
            this.conversationStep = 'choice';
            this.awaitingChoice = true;
            this.choiceTimer = 5.0;

            // Bribe calc: based on how bad the tension is
            const bribeCost = Math.max(5, Math.ceil(Math.abs(tension) / 2));

            this.setupChoice(`Bribe (${bribeCost})`, "Threaten",
                () => { // Left (Bribe)
                    if (window.game.state.wire >= bribeCost) {
                        window.game.state.wire -= bribeCost;
                        this.showPhrase(3, initiator, { text: "Acceptable. Get out of here." }, 'h1');
                        this.finishConversation(0); // No relationship change, just survival
                    } else {
                        this.showPhrase(3, initiator, { text: "Insufficient funds! Blast them!" }, 'm1');
                        initiator.aggro(target);
                        this.finishConversation(5);
                    }
                },
                () => { // Right (Threaten)
                    // One last roll
                    const finalRoll = Math.random() * 100;
                    if (finalRoll > 50) {
                        this.showPhrase(3, initiator, { text: "Fine, fine! We don't want trouble." }, 'h1');
                        this.finishConversation(-2); // Respect earned
                    } else {
                        this.showPhrase(3, initiator, { text: "You will regret that!" }, 'm1');
                        initiator.aggro(target);
                        this.finishConversation(10);
                    }
                }
            );
        }
    }

    setupChoice(leftText, rightText, leftCallback, rightCallback) {
        this.currentChoiceConfig = { left: leftCallback, right: rightCallback };
        if (window.conversationUIManager) {
            window.conversationUIManager.showChoicePrompt(leftText, rightText);
        }
    }

    handleChoice(side) {
        this.awaitingChoice = false;
        if (window.conversationUIManager) window.conversationUIManager.hideChoicePrompt();

        if (side === 'timeout') {
            if (this.currentChoiceConfig && this.currentChoiceConfig.right) this.currentChoiceConfig.right(); // Default to Threaten/Fail
        } else if (side === 'left') {
            if (this.currentChoiceConfig && this.currentChoiceConfig.left) this.currentChoiceConfig.left();
        } else if (side === 'right') {
            if (this.currentChoiceConfig && this.currentChoiceConfig.right) this.currentChoiceConfig.right();
        }
        this.currentChoiceConfig = null;
    }

    finishConversation(relChange) {
        if (!this.currentConversation) return; // Guard against multiple calls
        const npc = this.currentConversation.initiator;
        const ally = this.currentConversation.target;

        if (relChange !== 0) {
            // Shift faction base. Negative relChange = Closer (Better). Positive = Further (Worse).
            window.game.factionManager.shiftFactionBase(npc.faction, ally.originalFaction, relChange);
        }

        // Keep gauge up for a moment to show result
        setTimeout(() => {
            if (window.conversationUIManager) {
                window.conversationUIManager.endConversation(npc.faction, relChange);
            }
            this.conversationEnd(npc, ally);
        }, 2500);
    }

    findPhrase(speaker, listener, type, attitude, topicReceived, allowedStyles = null) {
        const speakerFaction = speaker.isAlly ? speaker.originalFaction : speaker.faction;
        const speakerLang = speaker.config.language || "language_basic";

        const filter = (p) => {
            if (!p.type || !p.type.includes(type)) return false;
            // Relax attitude check for Replies/Quips
            if (type !== 'reply' && type !== 'quip' && p.attitude && p.attitude !== attitude) return false;
            if (p.language !== speakerLang) return false;

            if (type === 'reply') {
                // Topic Strictness
                if (topicReceived === 'none' || !topicReceived) {
                    if (p.topic && p.topic !== 'generic' && p.topic !== 'none') return false;
                } else {
                    if (p.topic && p.topic !== topicReceived && p.topic !== 'generic') return false;
                }
                // Style Matching
                if (allowedStyles && p.style && !allowedStyles.includes(p.style)) return false;
            }

            const factionMatch = p.from_faction.includes("any") || p.from_faction.includes(speakerFaction);
            if (!factionMatch) return false;
            return true;
        };

        let candidates = this.phraseDatabase.filter(filter);
        // Fallback if no specific phrase found
        if (candidates.length === 0 && type === 'reply') {
            // Try generic fallback
            candidates = this.phraseDatabase.filter(p => p.type.includes('reply') && p.topic === 'generic');
        }

        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    showPhrase(slotIndex, speaker, phrase, attitude) {
        const speakerFaction = speaker.isAlly ? speaker.originalFaction : speaker.faction;
        let factionDisplayName = speakerFaction.replace(/_/g, ' ');
        const factionColor = GAME_GLOBAL_CONSTANTS.FACTION_COLORS[speakerFaction] || '#888';

        // Trigger Audio based on slot/tone
        let soundName;
        if (slotIndex === 0) soundName = 'idle1'; // Appraisal
        else if (slotIndex === 1) soundName = attitude === 'm1' ? 'mad1' : 'idle1'; // Greeting
        else if (slotIndex === 2) soundName = 'reply2'; // Reply
        else soundName = attitude === 'm1' ? 'mad1' : 'happy1'; // Response

        this.playConversationSound(speaker, soundName);

        if (window.conversationUIManager) {
            window.conversationUIManager.showPhrase(slotIndex, `${phrase.text}`, speaker, factionColor, factionDisplayName);
        }
    }

    playConversationSound(npc, phrase) {
        if (!npc.mesh || !window.audioSystem) return;

        const soundSet = npc.itemData.properties?.soundSet || 'default';
        // const category = phrase.category || 'greetings'; // e.g., 'greetings', 'responses', 'replies'
        const faction = npc.faction;
        const path = this.getSpeakerSoundPath(npc);
        let extension = '.mp3';
        if (npc.config.baseType === 'wookiee') extension = '.wav';
        const fullSoundPath = `${path}${phrase}${extension}`;
        const voiceVolume = window.audioSystem.voiceVolume || 1.0;
        window.audioSystem.playPositionalSound(fullSoundPath, npc.mesh.group.position, voiceVolume);
    }

    getSpeakerSoundPath(speaker) {
        const basePath = '/data/speech/conversation/';
        const baseType = speaker.config.baseType;
        const faction = speaker.config.faction;

        if (faction === 'rebels') {
            if (baseType === 'human_male') return `${basePath}rebels/males/`;
            if (baseType === 'human_female') return `${basePath}rebels/females/`;
        }

        switch (baseType) {
            case 'gamorrean': return `${basePath}aliens/humanoid/gamorrean/`;
            case 'wookiee': return `${basePath}aliens/humanoid/wookiee/`;
            case 'gungan': return `${basePath}aliens/humanoid/gungan/`;
            case 'ewok': return `${basePath}aliens/humanoid/halfpints/ewok/`;
            case 'jawa': return `${basePath}aliens/humanoid/halfpints/jawa/`;
            case 'human_male': return `${basePath}rebels/males/`;
            case 'human_female': return `${basePath}rebels/females/`;
            case 'clone': return `${basePath}clones/`;
            case 'mandalorian': return `${basePath}mandolorians/`;
            case 'stormtrooper': return `${basePath}stormtrooper/stormtrooper/`;
            case 'imperial_officer': return `${basePath}stormtrooper/imperial officer/`;
            case 'darth': return `${basePath}sith/`;
            case 'taker': return `${basePath}takers/`;
            case 'r2d2': return `${basePath}droids/humanoid/r2d2/`;
            case 'gonk': return `${basePath}droids/slime/gonk/`;
            case 'probe': return `${basePath}droids/spider/probe/`;
            default:
                if (speaker.faction === 'droids') return `${basePath}droids/humanoid/generic/`;
                if (speaker.faction === 'aliens') return `${basePath}aliens/humanoid/generic/`;
                return `${basePath}rebels/males/`;
        }
    }

    conversationEnd(initiator, target) {
        this.currentConversation = null;
        this.awaitingChoice = false;

        if (window.game) {
            window.game.conversationCooldownTimer = 10.0;
            window.game.state.isConversationActive = false;
        }

        if (initiator) {
            initiator.isConversing = false;
            initiator.hasSpoken = true;
            initiator.stopHighlight();
            initiator.currentState = 'IDLING';
            initiator.target = null;
            if (window.conversationUIManager) {
                window.conversationUIManager.setHighlight(initiator, false);
            }
        }
        if (target) {
            target.isConversing = false;
            target.hasSpoken = true;
            target.stopHighlight();
            target.currentState = 'IDLING';
            target.target = null;
            if (window.conversationUIManager) {
                window.conversationUIManager.setHighlight(target, false);
                window.conversationUIManager.toggleAllyRingSolid(target, false);
                window.conversationUIManager.resetAllyBoxes();
            }
        }

        if (window.conversationUIManager) {
            window.conversationUIManager.hideConversationHud();
        }
    }
}

window.conversationController = new ConversationController();