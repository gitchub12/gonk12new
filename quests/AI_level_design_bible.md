# AI Level Design Bible

## Feedback Analysis (Level 20 Retrospective)
1.  **Scale & Tiling**: The initial Level 20 used `size: 20` for floor textures, causing extreme stretching. **Correction**: Use `size: 0.25` (or similar) to tile textures 4x4 per unit, or place individual 1x1 tiles for precise control.
2.  **Wall Verticality**: Walls appeared as flat "L-shapes" because they lacked height segments. **Correction**: All wall objects MUST have `level2` (mid-section) and `level3` (top-section) properties defined.
3.  **Room Definition**: The layout consisted of disconnected segments. **Correction**: Walls must form continuous, closed loops to define distinct rooms and corridors.
4.  **Atmosphere**: The level felt like a void due to missing environmental settings. **Correction**: `skybox` and `ceiling` definitions in `settings.defaults` are mandatory.
5.  **Navigation Logic**: Docks looped back to the same level. **Correction**: Docks must target *different* valid level IDs to create a playable flow.

## Level Design Rules (The 10 Commandments)
1.  **Mandatory Skybox**: Every level JSON must define a `skybox` key in `settings.defaults` (e.g., `"key": "hyper"`).
2.  **Ceiling Configuration**: `settings.defaults.ceiling` must be defined with `heightMultiplier` (e.g., `3`) and a `wallside` texture path.
3.  **Wall Layering**: Every object in the `wall` layer **MUST** include `properties.level2` and `properties.level3` pointing to valid texture paths (e.g., `/data/pngs/wall/wall2/w2_default.png`).
4.  **Floor Tiling**: Use `size: 0.25` for standard floor textures to ensure high-resolution tiling. Avoid large `size` values unless specifically creating a giant, single-image decal.
5.  **Room Enclosure**: Build walls in continuous, closed loops. Use `H_x_y` and `V_x_y` coordinates to snap walls perfectly together.
6.  **Consistent Texture Sets**: Match floor and subfloor textures (e.g., `floor_6.png` with `subfloor_6.png`) to maintain visual consistency.
7.  **Dock Targets**: Docks must have a `target` property with a valid string containing the destination level ID (e.g., "TO LEVEL 21").
8.  **Spawn Alignment**: Spawn points (`spawns` layer) must be placed to align with the `autoSpawnFor` property of the corresponding entrance Dock.
9.  **NPC Grouping**: Place NPCs in logical squads or patrol groups. Use the `rotation` property to face them towards expected player approach vectors.
10. **Asset Validation**: Before using any `key` (texture or NPC), verify the file exists in the `data/` directory to prevent "pink box" missing asset errors.

## Advanced Design Guidelines

### Floor & Room Structure
*   **Size Standard**: Floors should generally be `size: 1` (unless tiling requires `0.25`).
*   **Contiguity**: Floors within a room must be contiguous. Gaps should only exist where there is a physical void or wall.
*   **Connectivity**: Every room must have at least one **DOOR** connecting to another room or a **DOCK** to exit the level. Dead ends should be rare and purposeful (e.g., containing a secret or reward).
*   **Variety**: Avoid repetitive layouts. Mix small corridors, large halls, and irregular shaped rooms.

### Theming & Atmosphere
Levels should tell a story through their environment. Use the existing style folders to create cohesive themes:
*   `E:\gonk\data\pngs\ceiling\imperialstyle`
*   `E:\gonk\data\pngs\ceiling\neutralstyle`
*   `E:\gonk\data\pngs\ceiling\rebelstyle`
*   (Same structure applies to `wall` directories)

**Narrative Transitions**: Use subfolders like `damaged`, `normal`, `overgrown`, and `slimy` to show progression.
*   *Example*: A level might start in a `slimy` sewer section, transition through a `damaged` basement, and open up into an `overgrown` courtyard. This visual storytelling implies a history (e.g., an abandoned facility reclaimed by nature).

## Level Concepts (20 Ideas)
1.  **Droid Factory**: Assembly lines, conveyor belts, half-built droids, industrial hazards.
2.  **Imperial Outpost**: Sterile white corridors, detention blocks, command centers, hangars.
3.  **Arboretum**: Glass domes, giant trees, overgrown paths, botanical experiments gone wrong.
4.  **Trash Recycling**: Compactors, scrap piles, incinerators, conveyor mazes.
5.  **Droid Separatist Workshop**: Makeshift repairs, scavenged parts, rogue AI experiments.
6.  **Taker Hive**: Organic corruption, sticky webs, egg sacs, dark and claustrophobic tunnels.
7.  **Clone Cantina**: Neon lights, bar counters, pazaak tables, jukeboxes, brawl areas.
8.  **Clone Barracks**: Rows of bunks, lockers, armories, training mats.
9.  **Sith Temple Ruins**: Ancient stone, red lighting, statues, ritual chambers.
10. **Smuggler's Cargo Bay**: Crates, hidden compartments, gambling dens, messy workshops.
11. **Cybernetic Hospital**: Operating theaters, bacta tanks, morgues, waiting rooms.
12. **Podracing Pit Stop**: Grease pits, engine parts, fuel tanks, mechanic crews.
13. **Asteroid Mining Facility**: Rock walls, drills, minecarts, vacuum airlocks.
14. **Underwater Gungan City**: Bubble walls, water effects, organic architecture, bioluminescence.
15. **Coruscant Underworld**: Grimy alleys, neon signs, noodle shops, verticality.
16. **Jedi Library Archive**: Holobooks, study desks, quiet zones, secret vaults.
17. **Bounty Hunter Guild Hall**: Trophy walls, mission boards, weapon checks, interrogation rooms.
18. **Ewok Treetop Village**: Wooden bridges, huts, net traps, forest canopy.
19. **Geonosian Catacombs**: Sandstone tunnels, sonic weaponry factories, insect hives.
20. **Cloud City Promenade**: Clean white aesthetics, orange sunsets, luxury suites, carbon freezing chambers.

### Quest & Interaction Rules
*   **Quest Items**: To make an NPC drop a specific quest item, add the `loot` property to their definition in the level JSON (e.g., `"loot": "gold_key_card"`). This item will be added to the player's "modules" inventory upon pickup.
*   **Locked Docks**: To lock a level exit, add the `requiredItem` property to the Dock definition (e.g., `"requiredItem": "gold_key_card"`). The player must possess this item to use the dock.
*   **Door Messages**: To display a message when a player tries to open a door (e.g., for flavor or locked status hints), add the `message` property to the Door definition (e.g., `"message": "Restricted Area"`).
*   **Notifications**: The game system now supports `window.game.showNotification(text, duration, color)` to display on-screen messages. This is automatically used by the Quest Item and Locked Dock systems.
