class NarrativeManager {
    constructor() {
        this.flags = new Set(); // Story flags (e.g., "met_r2")
    }

    setFlag(flag) {
        this.flags.add(flag);
    }

    hasFlag(flag) {
        return this.flags.has(flag);
    }

    triggerEvent(eventId) {
        console.log(`NarrativeManager: Triggering event ${eventId}`);
        // This will hook into ConversationUIManager to show dialogue
        // Example:
        // const event = this.events.get(eventId);
        // window.conversationUIManager.showNarrative(event.lines);
    }
}

window.narrativeManager = new NarrativeManager();
