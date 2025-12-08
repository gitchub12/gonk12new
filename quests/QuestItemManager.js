class QuestItemManager {
    constructor() {
        this.items = new Map(); // Definitions
        this.inventory = new Set(); // Owned Item IDs
    }

    async init() {
        await this.loadDefinitions();
    }

    async loadDefinitions() {
        try {
            const response = await fetch('quests/definitions/items.json');
            const data = await response.json();
            for (const [id, def] of Object.entries(data)) {
                this.items.set(id, def);
            }
        } catch (e) {
            console.error("QuestItemManager: Failed to load items", e);
        }
    }

    addItem(itemId) {
        if (!this.items.has(itemId)) {
            console.error(`QuestItemManager: Unknown item ${itemId}`);
            return;
        }
        this.inventory.add(itemId);
        console.log(`QuestItemManager: Added ${itemId}`);
        if (window.questUI) window.questUI.showNotification("Item Received", this.items.get(itemId).name, "cyan");
    }

    removeItem(itemId) {
        this.inventory.delete(itemId);
    }

    hasItem(itemId) {
        return this.inventory.has(itemId);
    }

    getItemDef(itemId) {
        return this.items.get(itemId);
    }
}

window.questItemManager = new QuestItemManager();
