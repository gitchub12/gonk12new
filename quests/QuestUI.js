class QuestUI {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'quest-tracker';
        this.container.style.position = 'absolute';
        this.container.style.top = '100px';
        this.container.style.right = '20px';
        this.container.style.color = '#fff';
        this.container.style.fontFamily = 'Arial, sans-serif';
        this.container.style.pointerEvents = 'none';
        this.container.style.textAlign = 'right';
        this.container.style.textShadow = '1px 1px 2px black';
        this.container.style.zIndex = '900'; // Below HUD but above game
        document.body.appendChild(this.container);
    }

    showNotification(title, message, color = '#FFD700') {
        // Use game's notification system if available, or create a custom one
        if (window.game && window.game.showNotification) {
            window.game.showNotification(`${title}: ${message}`, 4000, color);
        } else {
            console.log(`[Quest Notification] ${title}: ${message}`);
        }
    }

    updateTracker() {
        this.container.innerHTML = '';
        if (!window.questManager) return;

        window.questManager.activeQuests.forEach(quest => {
            const questDef = window.questManager.quests.get(quest.id);
            if (!questDef) return;

            const questDiv = document.createElement('div');
            questDiv.style.marginBottom = '15px';

            const title = document.createElement('div');
            title.textContent = questDef.title;
            title.style.fontWeight = 'bold';
            title.style.color = '#FFD700';
            title.style.marginBottom = '5px';
            questDiv.appendChild(title);

            quest.objectives.forEach(obj => {
                const objDiv = document.createElement('div');
                objDiv.textContent = `${obj.description} (${obj.current}/${obj.count || 1})`;
                if (obj.completed) {
                    objDiv.style.color = '#00FF00';
                    objDiv.style.textDecoration = 'line-through';
                } else {
                    objDiv.style.color = '#FFF';
                }
                objDiv.style.fontSize = '14px';
                questDiv.appendChild(objDiv);
            });

            this.container.appendChild(questDiv);
        });
    }
}

window.questUI = new QuestUI();
