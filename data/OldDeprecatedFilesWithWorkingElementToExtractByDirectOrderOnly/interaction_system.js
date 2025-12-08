// BROWSERFIREFOXHIDE interaction_system.js
class InteractionSystem {
    constructor() {
        this.interactiveObjects = [];
        this.currentTarget = null;
        this.createUI();
    }

    createUI() {
        const promptDiv = document.createElement('div');
        promptDiv.id = 'interaction-prompt';
        promptDiv.style.cssText = `
            position: fixed;
            top: 75%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 10px 20px;
            border: 2px solid #fff;
            border-radius: 5px;
            font-family: monospace;
            font-size: 18px;
            display: none;
            z-index: 999;
        `;
        document.body.appendChild(promptDiv);
        this.promptElement = promptDiv;
    }

    registerInteractiveObject(object, promptText, onInteract) {
        this.interactiveObjects.push({
            mesh: object,
            promptText: promptText,
            onInteract: onInteract
        });
    }

    update(player) {
        let closestObject = null;
        let minDistance = 2.5; // Max interaction distance - reduced to be more precise

        const playerPosition = player.position;
        const camera = window.game?.camera;

        for (const obj of this.interactiveObjects) {
            const distance = playerPosition.distanceTo(obj.mesh.position);

            // Check if object is within range
            if (distance < minDistance) {
                // Check if player is facing the object (if camera is available)
                if (camera) {
                    const directionToObject = new THREE.Vector3()
                        .subVectors(obj.mesh.position, playerPosition)
                        .normalize();

                    const cameraDirection = new THREE.Vector3();
                    camera.getWorldDirection(cameraDirection);
                    cameraDirection.y = 0; // Ignore vertical component
                    cameraDirection.normalize();

                    directionToObject.y = 0; // Ignore vertical component
                    directionToObject.normalize();

                    const dotProduct = cameraDirection.dot(directionToObject);

                    // Only show prompt if player is generally facing the object (> 45 degrees, dot > 0.5)
                    if (dotProduct > 0.5) {
                        minDistance = distance;
                        closestObject = obj;
                    }
                } else {
                    // Fallback if no camera available
                    minDistance = distance;
                    closestObject = obj;
                }
            }
        }

        if (closestObject) {
            this.currentTarget = closestObject;
            this.promptElement.textContent = `Press E to ${this.currentTarget.promptText}`;
            this.promptElement.style.display = 'block';
        } else {
            this.currentTarget = null;
            this.promptElement.style.display = 'none';
        }
    }

    handleKeyPress(key) {
        if (key === 'KeyE' && this.currentTarget) {
            this.currentTarget.onInteract();
        }
    }

    reset() {
        this.interactiveObjects = [];
        this.currentTarget = null;
        this.promptElement.style.display = 'none';
    }
}
