# Arena of Ash

An original, single-player, real-time gladiator action RPG built with TypeScript, Phaser **3.90.0**, Vite and procedural artwork. The interface is English. The game uses **Ash Vanguard** artwork and **Grounded** joint mechanics exclusively. There is no style studio, alternate style selector or paired-blade item.

## Run

Use Node.js **22 LTS** and npm:

```sh
npm ci
npm run dev
```

The logical game area is 1280×720 with FIT scaling. The canvas backing buffer and text textures adapt to window size and device pixel ratio for sharp large-screen/Retina rendering. See [display scaling](docs/DISPLAY_SCALING.md). Portrait screens display a rotation message. No backend, login, app secrets or external art assets are required.

```sh
npm run typecheck
npm run lint
npm test
npm run check:content
npm run test:e2e
npm run build
npm run preview
npm run format
```

Install Playwright Chromium on a standard machine:

```sh
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install --with-deps chromium
```

On the managed cloud machine, system Chromium is detected automatically. Activate the prepared Node toolchain with `export PATH=/workspace/.arena-tools/node_modules/.bin:$PATH`. An alternative browser executable can be supplied with `CHROMIUM_PATH`. Browser tests start Vite when needed and write screenshots/traces under `test-results/`. Gameplay tests use deterministic seeded Canvas rendering on headless software graphics; a separate test covers the normal renderer. Development-only `seed=42` and `renderer=canvas` query parameters and the read-only `window.__arena.snapshot()` helper are unavailable in production.

## Play

Start from camp, enter the arena, buy equipment and manage your loadout in Character. Arena combat runs in real time. **A/D** or **Left/Right** move, **Shift** runs, **Space** jumps, **A/D+Space** performs a backward/forward hop relative to facing in the arena, **LMB/J/1** uses the front hand and **RMB/K/2** uses the rear hand. Weapons make light attacks; empty hands punch. Each hand has its own animation and cooldown, so both can strike together or at different times. **F/3** shoves with a front kick on the ground or in a jump/hop, dealing no HP damage and keeping a 20% knockdown chance. Heavy attacks are disabled. There are no attributes, character levels or energy costs. **R** changes relaxed/combat stance. Move, run and jump during an attack. **Ctrl+LMB/J** throws the front-hand weapon; **Ctrl+RMB/K** throws the rear-hand weapon. **Q/E** uses belt slots 1/2. All real throws are overarm, including in jumps. **Escape** returns to camp without a reward for an unresolved fight.

Mouse/touch users can hold the arrow/Run buttons, tap Jump or an attack. The free front arm stays behind the torso; each mouse button uses its own hand, including a bare fist when empty. Camp retains its movement demonstration buttons and keyboard controls; **T** previews underarm throwing and **Y** previews overarm throwing. **P** previews potion drinking. Character has **Underarm**, **Overarm** and **Drink potion** previews; these preserve inventory.

Damage requires an active blade/fist or flying projectile to contact a moving body part. A swing that misses deals no damage. Each swing can hit once; idle weapons, sword grips and spear shafts do not deal damage. Body and blade collision shapes follow the actual articulated rig, including jumps and mirrored facing. See [real-time combat](docs/REALTIME_COMBAT.md).

Victory earns 50 gold; defeat earns 10 gold. Saves are automatic in localStorage. Reset Progress requires confirmation. Version 2 saves retain coins and equipment while discarded attributes and leveling fields are removed.

## Equipment

The default catalog has **12 items** across weapon, helmet, chest and utility categories. Shields are temporarily removed while the character rig is refined. Character has explicit Helmet, Body, Right hand, Left hand and two Belt mounts. Select a slot, then equip an unequipped item; × returns worn gear to the backpack. Each hand can attack independently. The belt holds usable throwables or healing potions. Shop and the backpack have page controls; the backpack shows all unequipped categories together. Ashwood War Spear is on shop page 1 and Viking Warhelm is on page 2:

- **Ashwood War Spear** — 115 gold, +10 attack; wooden haft, leaf head and thrust animations.
- **Viking Warhelm** — 60 gold, +3 armor; horned fantasy helmet.

Training Spear also uses a real haft/head design. The starter belt holds a Throwing Knife and Throwing Axe. The shop sells replacement knives (25 gold), axes (45 gold) and Healing Potions (30 gold, up to 35 HP). Net and water flask have been removed. Released weapons and used potions are permanently consumed, saved immediately and can be bought again. A potion heals at the animated sip; a hit before the sip interrupts without consuming it. At full health its use is disabled. See [equipment](docs/EQUIPMENT.md).

Item definitions live in [`public/content/items.json`](public/content/items.json). Add images under `public/content/items/` and edit the catalog to add or rebalance equipment without rebuilding the game. Refresh to load changes; the public game reads content directly from `main`. See the [runtime content guide](docs/RUNTIME_CONTENT.md) for a complete record, pivots, validation and publishing.

## Scope and documentation

Six scenes, three enemy ranks, equipment-based bonuses, persistent saves and a modular articulated rig. Victories unlock stronger random enemy loadouts; some enemies wield two weapons. Fight health resets each battle; unfinished fight state is not saved, but consumed items remain spent. Artwork remains procedural, balance is basic, and there is no audio or backend. Storage failure permits session-only play with a warning. The Phaser bundle produces a size warning.

See [architecture](docs/ARCHITECTURE.md), [animation](docs/ANIMATION_SYSTEM.md), [anatomy and references](docs/ANTHROPOMETRY.md), [art contract](docs/ART_PIPELINE.md), [game design](docs/GAME_DESIGN.md), [roadmap](docs/ROADMAP.md), and [verification](docs/VERIFICATION.md).

[GitHub Pages deployment](docs/DEPLOYMENT.md) publishes validated pushes to `main` using `/arena-of-ash/` as the base path. The public site and local development server keep separate browser saves.

Character rig refinements cover shoulder placement, both legs beneath the skirt, the free front arm behind the torso and the armed rear arm in front, continuous elbow/knee silhouettes, calf-covering greaves, connected leather boots and smoother keyframe motion. See [rig refinement and references](docs/RIG_REFINEMENT.md).

Light hits interrupt actions with a short pain reaction/stun. A front kick drives a several-step backwards balance recovery. Each hand, fist and boot uses its actual rendered contact shape; the other hand cannot award a hit. See [melee controls and rules](docs/MELEE_COMBAT.md).
