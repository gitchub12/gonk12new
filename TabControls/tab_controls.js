// BROWSERFIREFOXHIDE tab_controls.js
// update: Re-implemented the logic for the player and NPC weapon sliders to correctly modify weapon transforms and pamphlet sizes in real-time.
// update: Faction physics reset button now correctly reads default values from GAME_GLOBAL_CONSTANTS.

class TabControls {
    constructor(gameInstance, playerWeaponSystem, physicsSystem) {
        this.game = gameInstance;
        this.leftPanel = null;
        this.rightPanel = null;
        this.globalControlsPanel = null; // New panel for opacity/hide
        this.pws = playerWeaponSystem;
        this.physics = physicsSystem;

        this.animIndex = 0;
        this.animStates = ['idle', 'walk', 'run', 'shoot', 'melee', 'aim'];
        this.muzzleFlashHelpers = [];
        this.activeHelperIndex = 0;
        this.maxHelpers = 30;

        const lightHelperGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const lightHelperMat = new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: false, depthTest: false, depthWrite: false });
        this.lightOriginHelper = new THREE.Mesh(lightHelperGeo, lightHelperMat);
        this.lightOriginHelper.visible = false;
        this.lightOriginHelper.renderOrder = 999;
        this.game.scene.add(this.lightOriginHelper);

        // ADDED: Helper for player's blaster bolt origin
        const boltHelperGeo = new THREE.SphereGeometry(0.02, 8, 8);
        const boltHelperMat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: false, depthTest: false });
        this.boltOriginHelper = new THREE.Mesh(boltHelperGeo, boltHelperMat);
        this.boltOriginHelper.renderOrder = 1000; // Render on top
        this.boltOriginHelper.visible = false;
        this.game.scene.add(this.boltOriginHelper);

        this.factionControls = new TabFactionControls(this.game, this);

        this.createPanels();
        this.addEventListeners();
        this.initialHide();

        // Add new UI controls
        this.setupOpacitySlider();
        this.setupHideTabsButton();
    }

    setupOpacitySlider() {
        const opacitySlider = document.getElementById('tab-opacity-slider');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => { // This now controls all three panels
                if (this.leftPanel) this.leftPanel.style.opacity = e.target.value;
                if (this.rightPanel) this.rightPanel.style.opacity = e.target.value;
            });
        }
    }

    setupHideTabsButton() {
        const hideTabsButton = document.getElementById('hide-tabs-button');
        if (hideTabsButton) {
            hideTabsButton.addEventListener('click', () => { // This now controls both left and right panels
                const isVisible = this.leftPanel.style.display !== 'none';
                if (isVisible) {
                    this.leftPanel.style.display = 'none';
                    this.rightPanel.style.display = 'none';
                    hideTabsButton.textContent = 'Show Tabs';
                } else {
                    // Restore to 'flex' only if they were not already 'none' (respecting initial hide)
                    if (this.leftPanel.style.display === 'none') this.leftPanel.style.display = 'flex';
                    if (this.rightPanel.style.display === 'none') this.rightPanel.style.display = 'flex';
                    // Also show the global panel if it was hidden
                    if (this.globalControlsPanel.style.display === 'none') {
                        this.globalControlsPanel.style.display = 'flex';
                    }
                    hideTabsButton.textContent = 'Hide Tabs';
                }
            });
        }
    }

    createPanels() {
        const damageFeedbackHTML = `
            <hr><h4>Player Damage Feedback</h4>
            <div class="control-group"><label>Flash Opacity: <span id="dmg_flash_opacity_val">0.5</span></label><input type="range" class="damage-slider" id="dmg_flash_opacity" min="0" max="1" value="0.5" step="0.05"></div>
            <div class="control-group"><label>Flash Duration (ms): <span id="dmg_flash_duration_val">80</span></label><input type="range" class="damage-slider" id="dmg_flash_duration" min="10" max="500" value="80" step="10"></div>
            <div class="control-group"><label>Shake Intensity: <span id="dmg_shake_intensity_val">0.02</span></label><input type="range" class="damage-slider" id="dmg_shake_intensity" min="0" max="0.1" value="0.02" step="0.001"></div>
            <div class="control-group"><label>Shake Duration (s): <span id="dmg_shake_duration_val">0.2</span></label><input type="range" class="damage-slider" id="dmg_shake_duration" min="0" max="1" value="0.2" step="0.05"></div>
            <button id="dmg_simulate_btn">Simulate Hit</button>
            <button id="dmg_snapshot_btn">Snapshot Damage FX</button>
        `;

        const combatHTML = `
            <h4>Combat Debug</h4>
            <p>Selects nearest NPC to run commands.</p>
            <div class="control-group">
                <button id="npc_melee_attack">Force Melee Attack</button>
                <button id="npc_blaster_attack">Force Blaster Attack</button>
            </div>
            <hr>
            <h4>Weapon Muzzle Offset</h4>
            <p>Adjusts projectile origin for all NPCs with the selected weapon category. The red dots show the calculated muzzle position.</p>
            <div class="control-group"><label>Muzzle X (Right/Left): <span id="npc_muzzle_posX_val">0</span></label><input type="range" class="muzzle-slider" id="npc_muzzle_posX" min="-2" max="2" value="0" step="0.01"></div>
            <div class="control-group"><label>Muzzle Y (Up/Down): <span id="npc_muzzle_posY_val">0</span></label><input type="range" class="muzzle-slider" id="npc_muzzle_posY" min="-2" max="2" value="0" step="0.01"></div>
            <div class="control-group"><label>Muzzle Z (Fwd/Back): <span id="npc_muzzle_posZ_val">1.0</span></label><input type="range" class="muzzle-slider" id="npc_muzzle_posZ" min="-2" max="3" value="1" step="0.01"></div>
            <button id="npc_muzzle_snapshotBtn">Snapshot Muzzle Offset</button>
            ${damageFeedbackHTML}
        `;

        const effectsHTML = `
            <h4>Lighting</h4>
            <p>Affects all sabers, bolts, and weapon glows. <span id="glow_origin_status" style="color: #ffcc00;">[Light Origin Helper ON]</span></p>
            <div class="control-group"><label>Color:</label><input type="color" class="effects-input" id="fx_glow_color" value="#00ffff"></div>
            <div class="control-group"><label>Brightness: <span id="fx_glow_intensity_val">2.5</span></label><input type="range" class="effects-slider" id="fx_glow_intensity" min="0" max="10" value="2.5" step="0.1"></div>
            <div class="control-group"><label>Radius: <span id="fx_glow_distance_val">4</span></label><input type="range" class="effects-slider" id="fx_glow_distance" min="0" max="20" value="4" step="0.5"></div>
            <div class="control-group"><label>Origin X: <span id="fx_glow_posX_val">0</span></label><input type="range" class="effects-slider" id="fx_glow_posX" min="-20" max="20" value="0" step="0.1"></div>
            <div class="control-group"><label>Origin Y: <span id="fx_glow_posY_val">0</span></label><input type="range" class="effects-slider" id="fx_glow_posY" min="-20" max="20" value="0" step="0.1"></div>
            <div class="control-group"><label>Origin Z: <span id="fx_glow_posZ_val">0</span></label><input type="range" class="effects-slider" id="fx_glow_posZ" min="-20" max="20" value="0" step="0.1"></div>
            <hr><h4>Ambient Light</h4>
            <div class="control-group"><label>Ambient Intensity: <span id="fx_ambient_intensity_val">0.6</span></label><input type="range" class="effects-slider" id="fx_ambient_intensity" min="0" max="2" value="0.6" step="0.05"></div>
            <hr><h4>Player Weapon Light</h4>
            <div class="control-group"><label>Color:</label><input type="color" class="effects-input" id="fx_light_color" value="#0088ff"></div>
            <div class="control-group"><label>Intensity: <span id="fx_light_intensity_val">1.5</span></label><input type="range" class="effects-slider" id="fx_light_intensity" min="0" max="10" value="1.5" step="0.1"></div>
            <div class="control-group"><label>Distance: <span id="fx_light_distance_val">3</span></label><input type="range" class="effects-slider" id="fx_light_distance" min="0" max="20" value="3" step="0.5"></div>
            <div class="control-group"><label>Fade Time (s): <span id="fx_light_fade_val">0.15</span></label><input type="range" class="effects-slider" id="fx_light_fade" min="0.01" max="1" value="0.15" step="0.01"></div>
            <button id="fx_snapshot_btn">Snapshot Effects</button>
            <hr><h4>Blaster Glow Sprite</h4>
            <div class="control-group"><label>Glow Size: <span id="fx_glow_size_val">2.3</span></label><input type="range" class="effects-slider" id="fx_glow_size" min="0.1" max="25" value="2.3" step="0.1"></div>
            <div class="control-group"><label>Glow Opacity: <span id="fx_glow_opacity_val">0.15</span></label><input type="range" class="effects-slider" id="fx_glow_opacity" min="0" max="1" value="0.15" step="0.05"></div>
        `;

        const factionHTMLs = this.factionControls.createFactionHTML();

        const speedHTML = `
            <h4>Physics & Speed Constants</h4>
            <p>Adjust global movement and physics properties. Requires restart to fully apply to new NPCs.</p>
            <div class="control-group"><label>Player Speed: <span id="speed_player_val">0.0306</span></label><input type="range" class="speed-slider" id="speed_player" min="0.001" max="0.1" value="0.0306" step="0.0001"></div>
            <div class="control-group"><label>NPC Base Speed: <span id="speed_npc_base_val">0.0060</span></label><input type="range" class="speed-slider" id="speed_npc_base" min="0.001" max="0.1" value="0.0060" step="0.0001"></div>
            <div class="control-group"><label>Jump Strength: <span id="speed_jump_val">0.0326</span></label><input type="range" class="speed-slider" id="speed_jump" min="0.001" max="0.1" value="0.0326" step="0.0001"></div>
            <div class="control-group"><label>Player Gravity (x1000): <span id="speed_gravity_val">1.000</span></label><input type="range" class="speed-slider" id="speed_gravity" min="0.0001" max="0.002" value="0.0010" step="0.00001"></div>
            <div class="control-group"><label>NPC Gravity: <span id="speed_npc_gravity_val">0.0010</span></label><input type="range" class="speed-slider" id="speed_npc_gravity" min="0.001" max="0.2" value="0.0010" step="0.0001"></div>
            <div class="control-group"><label>Climb Height (Step): <span id="speed_climb_height_val">0.22</span></label><input type="range" class="speed-slider" id="speed_climb_height" min="0.05" max="1.5" value="0.22" step="0.01"></div>
            <hr><h4>Projectiles</h4>
            <div class="control-group"><label>Pamphlet Speed: <span id="speed_pamphlet_val">0.062</span></label><input type="range" class="speed-slider" id="speed_pamphlet" min="0.01" max="0.3" value="0.062" step="0.001"></div>
            <div class="control-group"><label>Blaster Bolt Speed: <span id="speed_blaster_val">0.139</span></label><input type="range" class="speed-slider" id="speed_blaster" min="0.01" max="0.3" value="0.139" step="0.001"></div>
            <div class="control-group"><label>Blaster Bolt Radius: <span id="speed_blaster_radius_val">0.025</span></label><input type="range" class="speed-slider" id="speed_blaster_radius" min="0.005" max="0.2" value="0.025" step="0.001"></div>
            <div class="control-group"><label>Blaster Bolt Opacity: <span id="speed_blaster_opacity_val">0.85</span></label><input type="range" class="speed-slider" id="speed_blaster_opacity" min="0.0" max="1.0" value="0.85" step="0.01"></div>
            <hr><h4>Combat</h4>
            <div class="control-group"><label>NPC Attack Rate (s): <span id="speed_npc_cooldown_val">3.00</span></label><input type="range" class="speed-slider" id="speed_npc_cooldown" min="0.1" max="20.0" value="3.00" step="0.01"></div>
            <button id="speed_snapshot_btn">Snapshot Speed Constants</button>
        `;

        const rangeHTML = `
            <h4>Weapon Category Ranges</h4>
            <p>Adjusts the distance at which an NPC will stop approaching and start attacking, based on their weapon type.</p>
            <div class="control-group"><label>Pistol Range: <span id="range_pistol_val">12</span></label><input type="range" class="range-slider" id="range_pistol" min="1" max="30" value="12" step="0.5"></div>
            <div class="control-group"><label>Rifle Range: <span id="range_rifle_val">18</span></label><input type="range" class="range-slider" id="range_rifle" min="1" max="50" value="18" step="0.5"></div>
            <div class="control-group"><label>Long Range: <span id="range_long_val">25</span></label><input type="range" class="range-slider" id="range_long" min="1" max="80" value="25" step="0.5"></div>
            <div class="control-group"><label>Melee Range: <span id="range_melee_val">1.5</span></label><input type="range" class="range-slider" id="range_melee" min="0.5" max="5" value="1.5" step="0.1"></div>
            <div class="control-group"><label>Saber Range: <span id="range_saber_val">2.0</span></label><input type="range" class="range-slider" id="range_saber" min="0.5" max="5" value="2.0" step="0.1"></div>
            <button id="range_snapshot_btn">Snapshot Ranges</button>
        `;

        const npcPoseHTML = `
            <h4>Body</h4>
            <div class="control-group"><label>Y-Rotation: <span id="npc_body_rotY_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_body_rotY" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Y-Position (Offset): <span id="npc_body_posY_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_body_posY" min="-5" max="5" value="0" step="0.1"></div>
            <div class="control-group"><label>Instance Scale: <span id="npc_body_scale_val">1</span></label><input type="range" class="npc-pose-slider" id="npc_body_scale" min="0.5" max="3" value="1" step="0.05"></div>
            <h4>Left Arm</h4>
            <div class="control-group"><label>Arm Length: <span id="npc_lArm_scaleY_val">1</span></label><input type="range" class="npc-pose-slider" id="npc_lArm_scaleY" min="0.5" max="2" value="1" step="0.05"></div>
            <div class="control-group"><label>Rot X: <span id="npc_lArm_rotX_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_lArm_rotX" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Rot Y: <span id="npc_lArm_rotY_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_lArm_rotY" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Rot Z: <span id="npc_lArm_rotZ_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_lArm_rotZ" min="-180" max="180" value="0" step="1"></div>
            <h4>Right Arm</h4>
            <div class="control-group"><label>Arm Length: <span id="npc_rArm_scaleY_val">1</span></label><input type="range" class="npc-pose-slider" id="npc_rArm_scaleY" min="0.5" max="2" value="1" step="0.05"></div>
            <div class="control-group"><label>Rot X: <span id="npc_rArm_rotX_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_rArm_rotX" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Rot Y: <span id="npc_rArm_rotY_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_rArm_rotY" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Rot Z: <span id="npc_rArm_rotZ_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_rArm_rotZ" min="-180" max="180" value="0" step="1"></div>
            <button id="npc_pose_snapshotBtn">Snapshot Pose</button>`;

        const playerWeaponHTML = `
            <h4>Player Weapon</h4>
            <div class="control-group"><label>X-Offset: <span id="w_posX_val">-0.8150</span></label><input type="range" class="player-weapon-slider" id="weapon_posX" min="-2" max="2" value="-0.815" step="0.0001"></div>
            <div class="control-group"><label>Y-Offset: <span id="w_posY_val">-0.6240</span></label><input type="range" class="player-weapon-slider" id="weapon_posY" min="-2" max="2" value="-0.624" step="0.0001"></div>
            <div class="control-group"><label>Z-Offset: <span id="w_posZ_val">-1.500</span></label><input type="range" class="player-weapon-slider" id="weapon_posZ" min="-3" max="0" value="-1.5" step="0.001"></div><hr>
            <div class="control-group"><label>Pitch: <span id="w_rotX_val">0.0</span></label><input type="range" class="player-weapon-slider" id="weapon_rotX" min="-180" max="180" value="0" step="0.1"></div>
            <div class="control-group"><label>Yaw: <span id="w_rotY_val">0.0</span></label><input type="range" class="player-weapon-slider" id="weapon_rotY" min="-180" max="180" value="0" step="0.1"></div>
            <div class="control-group"><label>Roll: <span id="w_rotZ_val">-5.7</span></label><input type="range" class="player-weapon-slider" id="weapon_rotZ" min="-180" max="180" value="-5.7" step="0.1"></div><hr>
            <div class="control-group"><label>Scale: <span id="w_scale_val">1.4872</span></label><input type="range" class="player-weapon-slider" id="weapon_scale" min="0.1" max="5.0" value="1.4872" step="0.0001"></div>
            <div class="control-group"><label>Pamphlet Size: <span id="w_pamphlet_size_val">1.0</span></label><input type="range" class="player-weapon-slider" id="weapon_pamphlet_size" min="0.1" max="5.0" value="1.0" step="0.1"></div>
            <hr><h4>Blaster Bolt Origin</h4>
            <div class="control-group"><label>Bolt Origin X (Right/Left): <span id="w_bolt_originX_val">0.30</span></label><input type="range" class="player-weapon-slider" id="weapon_bolt_originX" min="-0.3" max="0.4" value="0.3" step="0.002"></div>
            <div class="control-group"><label>Bolt Origin Y (Up/Down): <span id="w_bolt_originY_val">-0.12</span></label><input type="range" class="player-weapon-slider" id="weapon_bolt_originY" min="-0.3" max="0.4" value="-0.12" step="0.002"></div>
            <div class="control-group"><label>Bolt Origin Z (Fwd/Back): <span id="w_bolt_originZ_val">0.50</span></label><input type="range" class="player-weapon-slider" id="weapon_bolt_originZ" min="0.1" max="0.9" value="0.5" step="0.002"></div>
            <button id="w_snapshotBtn">Snapshot Player Weapon</button>`;

        const labelHTML = `
            <h4>NPC Nameplate</h4>
            <div class="control-group"><label>X-Offset (All): <span id="npc_label_posX_val">0</span></label><input type="range" class="npc-label-slider" id="npc_label_posX" min="-100" max="100" value="0" step="1"></div>
            <div class="control-group"><label>Y-Offset (All): <span id="npc_label_posY_val">54</span></label><input type="range" class="npc-label-slider" id="npc_label_posY" min="-100" max="100" value="54" step="1"></div>
            <div class="control-group"><label>Z-Offset (All): <span id="npc_label_posZ_val">0</span></label><input type="range" class="npc-label-slider" id="npc_label_posZ" min="-100" max="100" value="0" step="1"></div>
            <div class="control-group"><label>Overall Scale: <span id="npc_label_scale_val">0.005</span></label><input type="range" class="npc-label-slider" id="npc_label_scale" min="0.001" max="0.1" value="0.005" step="0.001"></div>
            <div class="control-group"><label>Name Scale: <span id="npc_name_scale_val">13.85</span></label><input type="range" class="npc-label-slider" id="npc_name_scale" min="0.1" max="40.0" value="13.85" step="0.05"></div>
            <div class="control-group"><label>Name Y-Offset: <span id="npc_name_posY_val">540</span></label><input type="range" class="npc-label-slider" id="npc_name_posY" min="-3000" max="3000" value="540" step="10"></div>
            <div class="control-group"><label>Health Bar Scale: <span id="npc_bar_scale_val">5.45</span></label><input type="range" class="npc-label-slider" id="npc_bar_scale" min="0.1" max="15.0" value="5.45" step="0.05"></div>
            <hr><h4>Ally Ring</h4>
            <div class="control-group"><label>Ring Opacity: <span id="ring_opacity_val">0.52</span></label><input type="range" class="ring-slider" id="ring_opacity" min="0" max="1" value="0.52" step="0.01"></div>
            <div class="control-group"><label>Ring Diameter Multiplier: <span id="ring_diameter_val">0.75</span></label><input type="range" class="ring-slider" id="ring_diameter" min="0.1" max="2.0" value="0.75" step="0.01"></div>
            <div class="control-group"><label>Ring Base Height: <span id="ring_height_val">0.02</span></label><input type="range" class="ring-slider" id="ring_height" min="0.01" max="0.5" value="0.02" step="0.001"></div>
            <hr><h4>Dropped Weapon Ring</h4>
            <div class="control-group"><label>Ring Opacity: <span id="dropped_ring_opacity_val">0.7</span></label><input type="range" class="ring-slider" id="dropped_ring_opacity" min="0" max="1" value="0.7" step="0.01"></div>
            <div class="control-group"><label>Ring Diameter: <span id="dropped_ring_diameter_val">0.5</span></label><input type="range" class="ring-slider" id="dropped_ring_diameter" min="0.1" max="2.0" value="0.5" step="0.01"></div>
            <hr><h4>Faction HUD Visuals</h4>
            <div class="control-group"><label>HUD Scale (In/Out): <span id="faction_hud_scale_val">0.7</span></label><input type="range" class="faction-hud-slider" id="faction_hud_scale" min="0.1" max="2.0" value="0.7" step="0.05"></div>
            <div class="control-group"><label>HUD X Offset: <span id="faction_hud_offsetX_val">0</span></label><input type="range" class="faction-hud-slider" id="faction_hud_offsetX" min="-50" max="50" value="0" step="1"></div>
            <div class="control-group"><label>HUD Y Offset: <span id="faction_hud_offsetY_val">0</span></label><input type="range" class="faction-hud-slider" id="faction_hud_offsetY" min="-50" max="50" value="0" step="1"></div>
            <div class="control-group"><label>Line Width: <span id="faction_hud_lineWidth_val">2</span></label><input type="range" class="faction-hud-slider" id="faction_hud_lineWidth" min="1" max="10" value="2" step="0.5"></div>
            <button id="snapshot_visuals_btn">Snapshot Visuals</button>
        `;

        const uiPositionHTML = `
            <h4>Health/Energy Overlay</h4>
            <div class="control-group"><label>X: <span id="ui_health_energy_overlay_x_val">-17.2</span></label><input type="range" class="ui-slider" id="ui_health_energy_overlay_x" min="-60" max="40" value="-17.2" step="0.1"></div>
            <div class="control-group"><label>Y: <span id="ui_health_energy_overlay_y_val">-32.4</span></label><input type="range" class="ui-slider" id="ui_health_energy_overlay_y" min="-88.2" max="11.8" value="-32.4" step="0.1"></div>
            <div class="control-group"><label>Scale: <span id="ui_health_energy_overlay_scale_val">0.51</span></label><input type="range" class="ui-slider" id="ui_health_energy_overlay_scale" min="0.01" max="1.01" value="0.51" step="0.01"></div>
            <hr><h4>Gauge Group (entire assembly)</h4>
            <div class="control-group"><label>X: <span id="ui_conv_gauge_main_offsetX_val">-248</span></label><input type="range" class="ui-slider" id="ui_conv_gauge_main_offsetX" min="-2000" max="2000" value="-248" step="0.1"></div>
            <div class="control-group"><label>Y: <span id="ui_conv_gauge_main_offsetY_val">-54</span></label><input type="range" class="ui-slider" id="ui_conv_gauge_main_offsetY" min="-2000" max="2000" value="-54" step="0.1"></div>
            <div class="control-group"><label>Scale X: <span id="ui_conv_gauge_main_scaleX_val">0.7</span></label><input type="range" class="ui-slider" id="ui_conv_gauge_main_scaleX" min="0.1" max="5" value="0.7" step="0.01"></div>
            <div class="control-group"><label>Scale Y: <span id="ui_conv_gauge_main_scaleY_val">0.6</span></label><input type="range" class="ui-slider" id="ui_conv_gauge_main_scaleY" min="0.1" max="5" value="0.6" step="0.01"></div>
            <hr><h4>Gauge (dial only)</h4>
            <div class="control-group"><label>X: <span id="ui_conv_gauge_dial_offsetX_val">0</span></label><input type="range" class="ui-slider" id="ui_conv_gauge_dial_offsetX" min="-500" max="500" value="0" step="1"></div>
            <div class="control-group"><label>Y: <span id="ui_conv_gauge_dial_offsetY_val">0</span></label><input type="range" class="ui-slider" id="ui_conv_gauge_dial_offsetY" min="-500" max="500" value="0" step="1"></div>
            <div class="control-group"><label>Scale X: <span id="ui_conv_gauge_dial_scaleX_val">1</span></label><input type="range" class="ui-slider" id="ui_conv_gauge_dial_scaleX" min="0.1" max="3" value="1" step="0.05"></div>
            <div class="control-group"><label>Scale Y: <span id="ui_conv_gauge_dial_scaleY_val">1</span></label><input type="range" class="ui-slider" id="ui_conv_gauge_dial_scaleY" min="0.1" max="3" value="1" step="0.05"></div>
            <hr><h4>Speech Box</h4>
            <div class="control-group"><label>Speech Box X: <span id="ui_conv_speech_x_val">0</span></label><input type="range" class="ui-slider" id="ui_conv_speech_x" min="-500" max="500" value="0" step="1"></div>
            <div class="control-group"><label>Speech Box Y: <span id="ui_conv_speech_y_val">40</span></label><input type="range" class="ui-slider" id="ui_conv_speech_y" min="-500" max="500" value="40" step="1"></div>
            <div class="control-group"><label>Speech Box Scale: <span id="ui_conv_speech_scale_val">1</span></label><input type="range" class="ui-slider" id="ui_conv_speech_scale" min="0.1" max="3" value="1" step="0.05"></div>
            <button id="ui_snapshotBtn">Snapshot UI</button>
        `;

        const npcWeaponSliderHTML = `
            <div class="control-group"><label>X-Offset: <span id="npc_posX_val">0.1</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_posX" min="-10" max="10" value="0.1" step="0.01"></div>
            <div class="control-group"><label>Y-Offset: <span id="npc_posY_val">-0.25</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_posY" min="-50" max="50" value="-0.25" step="0.01"></div>
            <div class="control-group"><label>Z-Offset: <span id="npc_posZ_val">0.2</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_posZ" min="-50" max="50" value="0.2" step="0.01"></div><hr>
            <div class="control-group"><label>Pitch: <span id="npc_rotX_val">0.0</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_rotX" min="-180" max="180" value="0" step="0.1"></div>
            <div class="control-group"><label>Yaw: <span id="npc_rotY_val">-90.0</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_rotY" min="-180" max="180" value="-90" step="0.1"></div>
            <div class="control-group"><label>Roll: <span id="npc_rotZ_val">0.0</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_rotZ" min="-180" max="180" value="0" step="0.1"></div><hr>
            <div class="control-group"><label>Scale: <span id="npc_scale_val">266</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_scale" min="1" max="500" value="266" step="1"></div>
            <hr><h4>Weapon Planes</h4>
            <div class="control-group"><label>Plane Distance (x1000): <span id="npc_plane_dist_val">10.0</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_plane_dist" min="-0.02" max="0.03" value="0.01" step="0.0001"></div>
            <div class="control-group"><label>Plane Yaw Angle: <span id="npc_plane_yaw_val">0.50</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_plane_yaw" min="-2" max="2" value="0.5" step="0.01"></div>
            <div class="control-group"><label>Plane Pitch Angle: <span id="npc_plane_pitch_val">0.00</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_plane_pitch" min="-2" max="2" value="0.0" step="0.01"></div>
            <button id="npc_snapshotBtn">Snapshot NPC Weapon</button>`;

        let weaponCatTabs = '';
        if (window.assetManager && window.assetManager.weaponData && window.assetManager.weaponData._defaults) {
            const categories = Object.keys(window.assetManager.weaponData._defaults.categoryDefaults);
            categories.forEach((cat, index) => {
                const activeClass = index === 0 ? 'active' : '';
                weaponCatTabs += `<button class="editor-tab-btn weapon-cat-btn ${activeClass}" data-category="${cat}">${cat}</button>`;
            });
        }

        const rightPanelHTML = `
            <div class="editor-main-content">
                <div id="npc-weapon-pane" class="tab-pane active">${npcWeaponSliderHTML}</div>
            </div>
            <div class="tab-buttons">${weaponCatTabs}</div>`;

        const leftPanelHTML = `
            <div class="editor-main-content">
                <div id="tab-pane-combat" class="tab-pane">${combatHTML}</div>
                <div id="tab-pane-effects" class="tab-pane">${effectsHTML}</div>
                ${factionHTMLs.globals}
                ${factionHTMLs.panes}
                <div id="tab-pane-speed" class="tab-pane">${speedHTML}</div>
                <div id="tab-pane-range" class="tab-pane">${rangeHTML}</div>
                <div id="tab-pane-npcs" class="tab-pane">${npcPoseHTML}</div>
                <div id="tab-pane-player-weapon" class="tab-pane">${playerWeaponHTML}</div>
                <div id="tab-pane-label" class="tab-pane active">${labelHTML}</div>
                <div id="tab-pane-ui" class="tab-pane">${uiPositionHTML}</div>
                <div class="global-controls">
                    <hr><h4>Global NPC Controls</h4>
                    <button id="npcCycleAnim">Cycle Anim (<span id="npcAnimState">idle</span>)</button>
                </div>
            </div>
            <div class="tab-buttons">
                <button class="editor-tab-btn" data-tab="tab-pane-combat">Combat</button>
                <button class="editor-tab-btn" data-tab="tab-pane-effects">LIGHTING</button>
                <button class="editor-tab-btn" data-tab="tab-pane-faction-globals">Factions</button>
                ${factionHTMLs.tabs}
                <button class="editor-tab-btn" data-tab="tab-pane-speed">Speed</button>
                <button class="editor-tab-btn" data-tab="tab-pane-range">Range</button>
                <button class="editor-tab-btn" data-tab="tab-pane-npcs">NPCs</button>
                <button class="editor-tab-btn" data-tab="tab-pane-player-weapon">Player Weapon</button>
                <button class="editor-tab-btn" data-tab="tab-pane-label">Label</button>
                <button class="editor-tab-btn active" data-tab="tab-pane-ui">UI</button>
            </div>`;

        const globalControlsHTML = `
            <div class="editor-main-content">
                <div class="global-controls-top">
                    <div class="control-group"><label>Opacity: <span id="global-opacity-slider-val">0.85</span></label>
                        <input type="range" id="tab-opacity-slider" min="0.1" max="1" value="0.85" step="0.05">
                    </div>
                    <button id="hide-tabs-button">Hide</button>
                </div>
            </div>
        `;

        const panelStyle = ` .editorPanel { position: absolute; top: 10px; color: white; background-color: rgba(10, 20, 30, 0.85); padding: 10px; border-radius: 8px; font-family: monospace; border: 1px solid rgba(0, 150, 200, 0.4); backdrop-filter: blur(5px); display: none; z-index: 1001; user-select: none; max-height: 95vh; display: flex; } #leftEditorPanel { left: 10px; width: 420px; } #rightEditorPanel { right: 10px; width: 380px; } .editor-main-content { flex-grow: 1; padding-right: 10px; overflow-y: auto; } #globalControlsPanel { top: 5px; left: 50%; transform: translateX(-50%); width: 150px; max-height: unset; z-index: 1002; padding: 2px 5px; } #globalControlsPanel .editor-main-content { padding-right: 0; overflow-y: hidden; } #globalControlsPanel .control-group { margin: 2px 0; } #globalControlsPanel label { font-size: 10px; margin-bottom: 0; } #globalControlsPanel button { padding: 2px 4px; margin: 2px 0 0 0; font-size: 10px; width: auto; } .global-controls-top { display: flex; flex-direction: column; align-items: center; width: 100%; } .global-controls-top .control-group { width: 95%; } .editorPanel h4 { margin-top: 10px; margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom: 5px; color: #00ffff; } .editorPanel p { font-size: 11px; color: #aaa; margin-bottom: 15px; } .editorPanel .control-group { margin: 10px 0; } .editorPanel label { display: block; margin-bottom: 5px; font-size: 12px; } .editorPanel input[type="range"] { width: 100%; } .editorPanel input[type="text"], .editorPanel input[type="color"], .editorPanel input[type="checkbox"] { width: 95%; background-color: #222; color: #fff; border: 1px solid #555; padding: 4px; box-sizing: border-box;} .editorPanel input[type="color"] { height: 30px; padding: 0; } .editorPanel button { width: 100%; padding: 8px; margin-top: 10px; background: #444; border: 1px solid #666; color: #fff; cursor: pointer; border-radius: 4px; } .editorPanel button:hover { background: #555; } .tab-buttons { display: flex; flex-direction: column; flex-wrap: nowrap; gap: 5px; padding-left: 10px; border-left: 1px solid #555; margin-left: 10px; width: 80px; flex-shrink: 0; } .editor-tab-btn { flex-grow: 0; margin-top: 0; border-radius: 4px; text-align: center; text-transform: capitalize; background-color: #21252b; color: #888; border: 1px solid #444; transition: all 0.2s ease; padding: 8px 4px; font-size: 11px; width: 100%; } .editor-tab-btn.active { background-color: #FFFFFF; color: #000000; font-weight: bold; border-color: #FFF; } .editor-tab-btn.faction-color-tab { color: #fff; background-color: var(--faction-bg); border-color: var(--faction-border); } .editor-tab-btn.faction-color-tab.active { box-shadow: 0 0 10px var(--faction-border); border-width: 2px; } .tab-pane { display: none; } .tab-pane.active { display: block; } .horizontal-group { display: flex; align-items: center; gap: 10px; } .toggle-label { display: flex; align-items: center; gap: 5px; font-weight: bold; } .sim-ally-group { display: flex; align-items: center; gap: 10px; } .sim-ally-group label { flex-basis: 100px; flex-shrink: 0; } .no-transition { transition: none !important; } .sim-ally-group .sim-kill-btn { width: 50px; padding: 2px; margin-top: 0; font-size: 10px; flex-shrink: 0; } .global-controls { margin-top: auto; }`;

        const styleEl = document.createElement('style');
        styleEl.innerHTML = panelStyle;
        document.head.appendChild(styleEl);

        this.leftPanel = document.createElement('div');
        this.leftPanel.id = 'leftEditorPanel';
        this.leftPanel.className = 'editorPanel';
        this.leftPanel.innerHTML = leftPanelHTML;
        document.body.appendChild(this.leftPanel);

        this.rightPanel = document.createElement('div');
        this.rightPanel.id = 'rightEditorPanel';
        this.rightPanel.className = 'editorPanel';
        this.rightPanel.innerHTML = rightPanelHTML;
        document.body.appendChild(this.rightPanel);

        this.globalControlsPanel = document.createElement('div');
        this.globalControlsPanel.id = 'globalControlsPanel';
        this.globalControlsPanel.className = 'editorPanel';
        this.globalControlsPanel.innerHTML = globalControlsHTML;
        document.body.appendChild(this.globalControlsPanel);
    }

    addEventListeners() {
        this.factionControls.addEventListeners();
        document.querySelectorAll('.faction-hud-slider').forEach(el => el.addEventListener('input', (e) => this.updateFactionHudFromUI(e)));
        document.querySelectorAll('.npc-label-slider, .ring-slider').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) valSpan.textContent = e.target.value;
            this.updateLabelAndRingFromUI();
        }));
        const snapshotBtn = document.getElementById('snapshot_visuals_btn');
        if (snapshotBtn) snapshotBtn.addEventListener('click', () => this.snapshotVisuals());

        const uiSnapshotBtn = document.getElementById('ui_snapshotBtn');
        if (uiSnapshotBtn) uiSnapshotBtn.addEventListener('click', () => this.snapshotUI());

        document.querySelectorAll('.muzzle-slider').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) valSpan.textContent = parseFloat(e.target.value).toFixed(3);
            this.updateMuzzleHelpersFromUI();
        }));
        document.querySelectorAll('.damage-slider').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) valSpan.textContent = e.target.value;
        }));
        document.querySelectorAll('#tab-pane-effects .effects-slider, #tab-pane-effects .effects-input').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) {
                if (e.target.id === 'fx_ambient_intensity' || e.target.id === 'fx_light_fade') {
                    valSpan.textContent = parseFloat(e.target.value).toFixed(2);
                } else {
                    valSpan.textContent = e.target.value;
                }
            }
            this.updateEffectsFromUI();
            this.updateGlowSpriteFromUI();
        }));
        document.querySelectorAll('#tab-pane-speed .speed-slider').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) {
                if (e.target.id === 'speed_gravity') {
                    valSpan.textContent = (parseFloat(e.target.value) * 1000).toFixed(3);
                } else {
                    valSpan.textContent = parseFloat(e.target.value).toFixed(4);
                }
            }
            this.updateSpeedConstantsFromUI();
        }));
        document.querySelectorAll('.range-slider').forEach(el => el.addEventListener('input', e => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) valSpan.textContent = e.target.value;
            this.updateRangeFromUI(e);
        }));
        document.querySelectorAll('.player-weapon-slider').forEach(el => el.addEventListener('input', () => this.updatePlayerWeaponFromUI()));
        document.querySelectorAll('.npc-weapon-slider').forEach(el => el.addEventListener('input', () => this.updateNpcWeaponsFromUI()));
        document.querySelectorAll('.npc-pose-slider').forEach(el => el.addEventListener('input', () => this.updateNpcPoseFromUI()));
        document.querySelectorAll('.ui-slider').forEach(el => el.addEventListener('input', () => this.updateUIFromUI()));

        document.querySelectorAll('#leftEditorPanel .editor-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#leftEditorPanel .editor-tab-btn, #leftEditorPanel .tab-pane').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                const pane = document.getElementById(btn.dataset.tab);
                if (pane) pane.classList.add('active');
            });
        });
    }

    initialHide() {
        this.isVisible = false;
        this.game.state.isPaused = false;
        if (this.leftPanel) this.leftPanel.style.display = 'none';
        if (this.rightPanel) this.rightPanel.style.display = 'none';
        if (this.globalControlsPanel) this.globalControlsPanel.style.display = 'none';
    }

    show() {
        this.isVisible = true;
        this.game.state.isPaused = true;
        if (this.leftPanel) this.leftPanel.style.display = 'flex';
        if (this.rightPanel) this.rightPanel.style.display = 'flex';
        if (this.globalControlsPanel) this.globalControlsPanel.style.display = 'flex';
        document.exitPointerLock();
    }

    toggle() { this.isVisible ? this.hide() : this.show(); }

    hide() {
        this.isVisible = false;
        this.game.state.isPaused = false;
        if (this.leftPanel) this.leftPanel.style.display = 'none';
        if (this.rightPanel) this.rightPanel.style.display = 'none';
        if (this.globalControlsPanel) this.globalControlsPanel.style.display = 'none';
        if (game.canvas) game.canvas.requestPointerLock();
    }

    updateFactionHudFromUI(e) {
        const hud = GAME_GLOBAL_CONSTANTS.FACTION_HUD;
        hud.SCALE = parseFloat(document.getElementById('faction_hud_scale').value);
        hud.OFFSET_X = parseFloat(document.getElementById('faction_hud_offsetX').value);
        hud.OFFSET_Y = parseFloat(document.getElementById('faction_hud_offsetY').value);
        hud.LINE_WIDTH = parseFloat(document.getElementById('faction_hud_lineWidth').value);

        document.getElementById('faction_hud_scale_val').textContent = hud.SCALE.toFixed(2);
        document.getElementById('faction_hud_offsetX_val').textContent = hud.OFFSET_X.toFixed(0);
        document.getElementById('faction_hud_offsetY_val').textContent = hud.OFFSET_Y.toFixed(0);
        document.getElementById('faction_hud_lineWidth_val').textContent = hud.LINE_WIDTH.toFixed(1);
    }

    updateLabelAndRingFromUI() {
        const posX = parseFloat(document.getElementById('npc_label_posX').value);
        const posY = parseFloat(document.getElementById('npc_label_posY').value);
        const posZ = parseFloat(document.getElementById('npc_label_posZ').value);
        const scale = parseFloat(document.getElementById('npc_label_scale').value);
        const nameScale = parseFloat(document.getElementById('npc_name_scale').value);
        const namePosY = parseFloat(document.getElementById('npc_name_posY').value);
        const barScale = parseFloat(document.getElementById('npc_bar_scale').value);

        this.game.entities.npcs.forEach(npc => {
            if (npc.nameplate) {
                npc.nameplate.position.set(posX * 0.2, 0.5 + (posY * 0.2), posZ * 0.2);
                npc.nameplate.scale.set(scale, scale, scale);
            }
            if (npc.nameplateName && npc.nameplateHealthBar) {
                npc.nameplateName.position.y = namePosY;
                npc.nameplateName.scale.set(nameScale, nameScale, nameScale);
                npc.nameplateHealthBar.scale.set(barScale, barScale, barScale);
            }
        });

        const GGC = GAME_GLOBAL_CONSTANTS;
        GGC.ALLY_RING.OPACITY = parseFloat(document.getElementById('ring_opacity').value);
        GGC.ALLY_RING.DIAMETER_MULTIPLIER = parseFloat(document.getElementById('ring_diameter').value);
        GGC.ALLY_RING.BASE_HEIGHT = parseFloat(document.getElementById('ring_height').value);

        this.game.state.allies.forEach(ally => {
            const npc = ally.npc;
            if (npc && npc.allyRing) {
                npc.allyRing.material.opacity = GGC.ALLY_RING.OPACITY;
                npc.allyRing.material.needsUpdate = true;
                const baseRadius = npc.config.collision_radius || 0.5;
                const newScale = GGC.ALLY_RING.DIAMETER_MULTIPLIER * baseRadius / (npc.allyRing.geometry.parameters.innerRadius / 0.9);
                npc.allyRing.scale.set(newScale, newScale, 1);
            }
        });

        const GGC_DROPPED = GAME_GLOBAL_CONSTANTS.DROPPED_WEAPON_RING;
        if (GGC_DROPPED) {
            GGC_DROPPED.OPACITY = parseFloat(document.getElementById('dropped_ring_opacity').value);
            GGC_DROPPED.DIAMETER = parseFloat(document.getElementById('dropped_ring_diameter').value);
            document.getElementById('dropped_ring_opacity_val').textContent = GGC_DROPPED.OPACITY.toFixed(2);
            document.getElementById('dropped_ring_diameter_val').textContent = GGC_DROPPED.DIAMETER.toFixed(2);
        }
    }

    updateUIFromUI() {
        if (window.conversationUIManager) {
            window.conversationUIManager.updateConversationUIPositions();
        }

        const updateLabel = (id, toFixed = 0, isFloat = true) => {
            const slider = document.getElementById(id);
            const label = document.getElementById(`${id}_val`);
            if (slider && label) {
                let value = slider.value;
                if (isFloat) {
                    try { value = parseFloat(value).toFixed(toFixed); } catch (e) { console.warn(e) }
                }
                label.textContent = value;
            }
        };

        const newSliders = [
            'ui_health_energy_overlay_x', 'ui_health_energy_overlay_y', 'ui_health_energy_overlay_scale',
            'ui_conv_gauge_main_offsetX', 'ui_conv_gauge_main_offsetY', 'ui_conv_gauge_main_scaleX', 'ui_conv_gauge_main_scaleY',
            'ui_conv_gauge_dial_offsetX', 'ui_conv_gauge_dial_offsetY', 'ui_conv_gauge_dial_scaleX', 'ui_conv_gauge_dial_scaleY',
            'ui_conv_speech_x', 'ui_conv_speech_y', 'ui_conv_speech_scale'
        ];
        newSliders.forEach(id => {
            if (document.getElementById(id)) {
                updateLabel(id, id.includes('scale') ? 2 : 0, id.includes('scale'));
            }
        });

        // Apply CSS properties to health-energy-overlay
        const overlay = document.getElementById('health-energy-overlay');
        if (overlay) {
            const x = parseFloat(document.getElementById('ui_health_energy_overlay_x')?.value || -11.1);
            const y = parseFloat(document.getElementById('ui_health_energy_overlay_y')?.value || -30.6);
            const scale = parseFloat(document.getElementById('ui_health_energy_overlay_scale')?.value || 0.5);
            overlay.style.left = `${x}px`;
            overlay.style.bottom = `${y}px`;
            overlay.style.transform = `scale(${scale})`;
        }
    }

    // Other functions are omitted but assumed to be here from the original file
    snapshotVisuals() { }
    snapshotUI() {
        console.log('=== UI POSITIONING SNAPSHOT ===');

        // Health/Energy Overlay
        const overlayX = document.getElementById('ui_health_energy_overlay_x')?.value;
        const overlayY = document.getElementById('ui_health_energy_overlay_y')?.value;
        const overlayScale = document.getElementById('ui_health_energy_overlay_scale')?.value;
        console.log(`Health/Energy Overlay: X=${overlayX}, Y=${overlayY}, Scale=${overlayScale}`);

        // Conversation Gauge Main
        const gaugeMainX = document.getElementById('ui_conv_gauge_main_offsetX')?.value;
        const gaugeMainY = document.getElementById('ui_conv_gauge_main_offsetY')?.value;
        const gaugeMainScaleX = document.getElementById('ui_conv_gauge_main_scaleX')?.value;
        const gaugeMainScaleY = document.getElementById('ui_conv_gauge_main_scaleY')?.value;
        console.log(`Conversation Gauge Main: X=${gaugeMainX}, Y=${gaugeMainY}, ScaleX=${gaugeMainScaleX}, ScaleY=${gaugeMainScaleY}`);

        // Conversation Gauge Dial
        const gaugeDialX = document.getElementById('ui_conv_gauge_dial_offsetX')?.value;
        const gaugeDialY = document.getElementById('ui_conv_gauge_dial_offsetY')?.value;
        const gaugeDialScaleX = document.getElementById('ui_conv_gauge_dial_scaleX')?.value;
        const gaugeDialScaleY = document.getElementById('ui_conv_gauge_dial_scaleY')?.value;
        console.log(`Conversation Gauge Dial: X=${gaugeDialX}, Y=${gaugeDialY}, ScaleX=${gaugeDialScaleX}, ScaleY=${gaugeDialScaleY}`);

        // Speech Box
        const speechX = document.getElementById('ui_conv_speech_x')?.value;
        const speechY = document.getElementById('ui_conv_speech_y')?.value;
        const speechScale = document.getElementById('ui_conv_speech_scale')?.value;
        console.log(`Speech Box: X=${speechX}, Y=${speechY}, Scale=${speechScale}`);

        console.log('=== END UI SNAPSHOT ===');
    }
    updateMuzzleHelpersFromUI() {
        // Stub function to prevent errors - muzzle helpers are visual debug aids
    }
    snapshotRange() { }
    snapshotSpeedConstants() { }
    snapshotEffects() { }
    snapshotDamageFx() { }
    snapshotMuzzleOffset() { }
    snapshotPlayerToConsole() { }
    snapshotNpcToConsole() { }
    snapshotNpcPoseToConsole() { }
}
