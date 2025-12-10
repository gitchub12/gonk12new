class TabGonkWeaponControls {
    constructor(playerWeaponSystem) {
        this.playerWeaponSystem = playerWeaponSystem;
    }

    addEventListeners() {
        document.querySelectorAll('.player-weapon-slider').forEach(el => el.addEventListener('input', () => this.updatePlayerWeaponFromUI()));
    }

    updatePlayerWeaponFromUI() {
        if (!window.playerWeaponSystem || !window.playerWeaponSystem.activeWeapon) return;

        const weapon = window.playerWeaponSystem.activeWeapon;
        const group = weapon.mesh.group;

        const posX = parseFloat(document.getElementById('weapon_posX').value);
        const posY = parseFloat(document.getElementById('weapon_posY').value);
        const posZ = parseFloat(document.getElementById('weapon_posZ').value);
        const rotX = parseFloat(document.getElementById('weapon_rotX').value);
        const rotY = parseFloat(document.getElementById('weapon_rotY').value);
        const rotZ = parseFloat(document.getElementById('weapon_rotZ').value);
        const scale = parseFloat(document.getElementById('weapon_scale').value);

        group.position.set(posX, posY, posZ);
        group.rotation.set(rotX, rotY, rotZ);
        group.scale.set(scale, scale, scale);

        // Update display values
        document.getElementById('weapon_posX_val').textContent = posX.toFixed(3);
        document.getElementById('weapon_posY_val').textContent = posY.toFixed(3);
        document.getElementById('weapon_posZ_val').textContent = posZ.toFixed(3);
        document.getElementById('weapon_rotX_val').textContent = rotX.toFixed(3);
        document.getElementById('weapon_rotY_val').textContent = rotY.toFixed(3);
        document.getElementById('weapon_rotZ_val').textContent = rotZ.toFixed(3);
        document.getElementById('weapon_scale_val').textContent = scale.toFixed(3);
    }
}
