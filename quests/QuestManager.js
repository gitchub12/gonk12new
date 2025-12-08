class QuestManager {
    constructor() {
        this.quests = new Map(); // Loaded quest definitions
        this.activeQuests = new Map(); // Currently active quests (id -> state)
        this.completedQuests = new Set(); // IDs of completed quests
        this.failedQuests = new Set(); // IDs of failed quests

        // Event Hooks
        this.listeners = new Map(); // eventType -> [callbacks]
    }

    // --- Initialization ---
    async init() {
        console.log("QuestManager: Initializing...");
        await this.loadDefinitions();
        // Load save data if exists (TODO)
    }

    async loadDefinitions() {
        try {
            // Load Demo Quests
            const demoResponse = await fetch('quests/definitions/demo_quests.json');
            const demoData = await demoResponse.json();
            for (const [id, def] of Object.entries(demoData)) {
                this.quests.set(id, def);
            }

            // Load Main Story Quests
            const mainResponse = await fetch('quests/definitions/main_story.json');
            const mainData = await mainResponse.json();
            for (const [id, def] of Object.entries(mainData)) {
                this.quests.set(id, def);
            }

            console.log(`QuestManager: Loaded ${this.quests.size} quests.`);
        } catch (e) {
            console.error("QuestManager: Failed to load definitions", e);
        }
    }

    // --- Quest State Management ---
    acceptQuest(questId) {
        if (this.activeQuests.has(questId) || this.completedQuests.has(questId) || this.failedQuests.has(questId)) {
            console.warn(`QuestManager: Quest ${questId} already active, completed, or failed.`);
            return false;
        }

        const def = this.quests.get(questId);
        if (!def) {
            console.error(`QuestManager: Quest ${questId} not found.`);
            return false;
        }

        // Initialize State
        const state = {
            id: questId,
            stepIndex: 0,
            objectives: def.steps[0].objectives.map(obj => ({
                ...obj,
                current: 0,
                completed: false
            })),
            startTime: Date.now()
        };

        this.activeQuests.set(questId, state);
        console.log(`QuestManager: Accepted quest ${def.title}`);

        // UI Notification
        if (window.questUI) window.questUI.showNotification("Quest Started", def.title);
        if (window.questUI) window.questUI.updateTracker();

        // Play Audio Hook
        this.playAudio(def.id, 'start');

        return true;
    }

    updateObjective(questId, objectiveIndex, amount = 1) {
        const state = this.activeQuests.get(questId);
        if (!state) return;

        const objective = state.objectives[objectiveIndex];
        if (!objective || objective.completed) return;

        objective.current += amount;

        // Check Completion
        if (objective.current >= objective.required) {
            objective.current = objective.required;
            objective.completed = true;
            console.log(`QuestManager: Objective ${objectiveIndex} completed for ${questId}`);
            // Notify UI
            if (window.questUI) window.questUI.showNotification("Objective Complete", objective.description);
        }

        // Check Step Completion
        if (state.objectives.every(obj => obj.completed)) {
            this.advanceStep(questId);
        } else {
            if (window.questUI) window.questUI.updateTracker();
        }
    }

    advanceStep(questId) {
        const state = this.activeQuests.get(questId);
        const def = this.quests.get(questId);

        state.stepIndex++;

        if (state.stepIndex >= def.steps.length) {
            this.completeQuest(questId);
        } else {
            // Setup next step
            state.objectives = def.steps[state.stepIndex].objectives.map(obj => ({
                ...obj,
                current: 0,
                completed: false
            }));
            console.log(`QuestManager: Advanced to step ${state.stepIndex} for ${questId}`);
            if (window.questUI) window.questUI.updateTracker();
            this.playAudio(def.id, `step_${state.stepIndex}`);
        }
    }

    completeQuest(questId) {
        const state = this.activeQuests.get(questId);
        const def = this.quests.get(questId);

        this.activeQuests.delete(questId);
        this.completedQuests.add(questId);

        console.log(`QuestManager: Completed quest ${def.title}`);

        // Rewards
        this.grantRewards(def.rewards);

        // UI Notification
        if (window.questUI) window.questUI.showNotification("Quest Completed", def.title, "gold");
        if (window.questUI) window.questUI.updateTracker();

        this.playAudio(def.id, 'complete');
    }

    failQuest(questId) {
        const state = this.activeQuests.get(questId);
        if (!state) return;

        const def = this.quests.get(questId);

        this.activeQuests.delete(questId);
        this.failedQuests.add(questId);

        console.log(`QuestManager: Failed quest ${def.title}`);

        // UI Notification
        if (window.questUI) window.questUI.showNotification("Quest Failed", def.title, "red");
        if (window.questUI) window.questUI.updateTracker();

        this.playAudio(def.id, 'fail');
    }

    grantRewards(rewards) {
        if (!rewards) return;

        if (rewards.wire) {
            window.game.state.wire += rewards.wire;
            console.log(`Granted ${rewards.wire} wire.`);
        }
        if (rewards.xp) {
            // TODO: XP System
        }
        if (rewards.items) {
            rewards.items.forEach(itemId => {
                if (window.questItemManager) window.questItemManager.addItem(itemId);
            });
        }
        if (rewards.reputation) {
            for (const [faction, amount] of Object.entries(rewards.reputation)) {
                window.game.factionManager.shiftFactionBase('player', faction, -amount); // Negative is better
            }
        }
    }

    // --- Event Handling ---
    // Called by external systems: window.questManager.notify('kill', { type: 'stormtrooper' })
    notify(eventType, data) {
        this.activeQuests.forEach(state => {
            state.objectives.forEach((obj, index) => {
                if (!obj.completed && obj.type === eventType) {
                    // Check conditions
                    let match = true;
                    if (obj.target && obj.target !== data.target) match = false;
                    if (obj.targetTag && !data.tags.includes(obj.targetTag)) match = false;
                    if (obj.zoneId && obj.zoneId !== data.zoneId) match = false;

                    if (match) {
                        this.updateObjective(state.id, index, 1);
                    }
                }
            });
        });
    }

    playAudio(questId, type) {
        // e.g., data/audio/voice/quests/MQ_20/start.mp3
        // TODO: Implement audio system hook
    }
}

window.questManager = new QuestManager();
