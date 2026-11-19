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

Start from camp, enter the arena, buy equipment and manage your loadout in Character. Arena combat runs in real time. **A/D** or **Left/Right** move, **Shift** runs, **Space** jumps, **A/D+Space** performs a backward/forward hop relative to facing in the arena, **LMB/J/1** uses the front hand and **RMB/K/2** uses the rear hand. Weapons make light attacks; empty hands punch. Each one-handed weapon has its own animation and cooldown, so both can strike together or at different times. Bare fists deal exactly **1 HP** per hit, including against armor/guard. A two-handed item reserves both hands: either attack input swings the same weapon, with shared recovery. **V** shoves with the held two-handed shaft (zero damage, push/stagger, no fall). **X** binds a nearby downed opponent into a guaranteed execution: the character moves into position and stays attached until the fatal strike. The victim cannot get up during the action; an already standing or getting-up target cannot start it. **F/3** shoves with a front kick on the ground or in a jump/hop, dealing no HP damage and keeping a 20% knockdown chance. Heavy attacks are disabled. There are no attributes, character levels or energy costs. **R** changes relaxed/combat stance. Move, run and jump during an attack. **Ctrl+LMB/J** throws the front-hand weapon; **Ctrl+RMB/K** throws the rear-hand weapon. **Q/E** uses belt slots 1/2. **C** performs a timed weapon parry; a successful frontal melee deflection stuns the attacker for one second and automatically follows with an open-palm shove, without knockdown. A successful weapon parry has one 20% chance to disarm the contacting hand; its dropped weapon can be recovered. **G** picks up nearby grounded equipment. **H** starts a close-range opponent lift; press **H** again to throw (the command can be queued during lifting). While holding, **A/D** walks and turns with the captive; the throw follows the current facing direction. A grab can miss or be interrupted during its 420 ms reach. The throw deals no HP damage and ends in the existing supported floor recovery. All real throws are overarm, including in jumps. **Escape** returns to camp without a reward for an unresolved fight.

Camp and Character have no demonstration buttons; active combat has no on-screen action buttons. Use the mouse and keyboard, following the static legend below the arena. Normal navigation, shop/equipment controls and post-victory Continue remain. The front arm and elbow stay behind the torso; the complete rear arm, elbow and weapon stay in front during a two-handed hold. Relaxed melee idle carries the weapon on the rear shoulder with the front arm down; R returns to the two-handed combat grip. Two-handed swings use a broad backward wind-up and a forward body drive. Keyboard-only animation previews remain available in camp. Both fighters can hop in either direction. AI sometimes parries committed swings and actively recovers disarmed weapons, using kicks and opponent throws to clear a blocked route.

Steel Crossbow costs 180 gold on shop page 2 and reserves both hands. Either normal attack fires one physical bolt, then automatically reloads. Shooting retains the crossbow and does not require an ammunition inventory item. Bolts cannot be picked up as equipment. [Crossbow artwork and references](docs/CROSSBOW_ART.md).

Damage requires an active blade/fist or flying projectile to contact a moving body part. A swing that misses deals no damage. The paired X execution is the explicit guaranteed-impact exception after a valid local bind. Each swing can hit once; idle weapons, sword grips and spear shafts do not deal damage. Body and blade collision shapes follow the actual articulated rig, including jumps and mirrored facing. See [real-time combat](docs/REALTIME_COMBAT.md).

After victory, collect equipment on the sand and choose **Continue**. Victory earns 50 gold; defeat earns 10 gold. Saves are automatic in localStorage. Reset Progress requires confirmation. Version 2 saves retain coins and equipment while discarded attributes and leveling fields are removed.

## Equipment

The default catalog has **22 items** across weapon, helmet, chest and utility categories. Shields are temporarily removed while the character rig is refined. Character has explicit Helmet, Body, Right hand, Left hand and two Belt mounts. Equip fills a free compatible hand/belt slot first; when all compatible slots are occupied, the selected slot is replaced; × returns worn gear to the backpack. Each hand can attack independently. The belt holds one usable throwable or potion per slot. The shop supports consumable bundles of **1/5/10**; quantities accumulate in the backpack. Multiple owned copies may occupy different compatible slots, one each. Battle slots do not automatically refill from reserves. Shop and the backpack have page controls; the backpack shows all unequipped categories together. Ashwood War Spear is on shop page 1 and Viking Warhelm is on page 2:

- **Ashwood War Spear** — 115 gold, +10 attack; wooden haft, leaf head and thrust animations.
- **Viking Warhelm** — 60 gold, +3 armor; horned fantasy helmet.

Training Spear also uses a real haft/head design. New games and Reset Progress own only the Wooden Sword. Throwing Knives, Throwing Axes and potions must be bought; the belt starts empty. The shop sells replacement knives (25 gold), axes (45 gold) and Healing Potions (30 gold, up to 35 HP). Net and water flask have been removed. Release/use removes one owned copy and immediately saves the empty slot. Grounded thrown equipment, including enemy weapons, can be collected with G and retained for later matches. An empty original/compatible slot receives it; occupied slots keep their items and the pickup goes into the backpack. Unrecovered equipment is lost when leaving. Used potions are consumed. A potion heals at the animated sip; a hit before the sip interrupts without consuming it. At full health its use is disabled. See [equipment](docs/EQUIPMENT.md).

Item definitions live in [`public/content/items.json`](public/content/items.json). Add images under `public/content/items/` and edit the catalog to add or rebalance equipment without rebuilding the game. Refresh to load changes; the public game reads content directly from `main`. See the [runtime content guide](docs/RUNTIME_CONTENT.md) for a complete record, pivots, validation and publishing.

## Scope and documentation

Six scenes, three enemy ranks, equipment-based bonuses, persistent saves and a modular articulated rig. Victories unlock stronger random enemy loadouts; some enemies wield two weapons and occasionally attempt a weapon throw. They collect nearby landed weapons when a compatible hand is empty. Fight health resets each battle; unfinished fight state is not saved, but consumed items remain spent. Artwork remains procedural, balance is basic, and there is no audio or backend. Storage failure permits session-only play with a warning. The Phaser bundle produces a size warning.

See [architecture](docs/ARCHITECTURE.md), [animation](docs/ANIMATION_SYSTEM.md), [anatomy and references](docs/ANTHROPOMETRY.md), [art contract](docs/ART_PIPELINE.md), [game design](docs/GAME_DESIGN.md), [roadmap](docs/ROADMAP.md), and [verification](docs/VERIFICATION.md).

[GitHub Pages deployment](docs/DEPLOYMENT.md) publishes validated pushes to `main` using `/arena-of-ash/` as the base path. The public site and local development server keep separate browser saves.

Character rig refinements cover shoulder placement, both legs beneath the skirt, the free front arm behind the torso and the armed rear arm in front, continuous elbow/knee silhouettes, calf-covering greaves, connected leather boots and smoother keyframe motion. See [rig refinement and references](docs/RIG_REFINEMENT.md).

Light hits interrupt actions with a short pain reaction/stun. A front kick drives a several-step backwards balance recovery. Each hand, fist and boot uses its actual rendered contact shape; the other hand cannot award a hit. See [melee controls and rules](docs/MELEE_COMBAT.md).

Two-handed Greatsword (140 gold), War Hammer (165 gold) and Battle Axe (155 gold) are on shop page 2. Their distinct overhead swings use one rear-hand weapon mount and an exact second grip on the same handle. Equipping one reserves the left hand and returns its old item to the backpack. These weapons have slower shared swings (1150/1350/1250 ms), not the disabled heavy-attack action.

Closed Steel Helm (110 gold, +5 armor) and Steel Cuirass (180 gold, +8 armor) are on shop page 3. An unblocked nonlethal melee hammer hit has independent 10% chances to knock down and to push with kick-strength stagger; both effects can occur together.

Auto Battle starts enabled in every fight. Any key or mouse button immediately takes manual control and performs its normal action; moving the mouse only aims. **B** resumes Auto Battle (or stops it when active). The full AI controls actual movement, independent hand attacks, parries, kicks, hops, jumps, belt uses, ranged weapons, weapon throws, two-handed shoves, opponent lifts/throws, pickups and ground executions. Equipped consumables and thrown gear follow normal ownership rules. Continue remains manual after victory.

Shop page 3 also has Riveted Chainmail (95 gold, 4 armor), Roman Legionary Helm (155 gold, 6 armor), Two-handed War Trident (175 gold, +15 attack) and Potion of Haste (55 gold). The trident has three real tines, a long shaft, a wide two-hand grip and a dedicated thrust/withdrawal animation. Haste doubles movement and action/animation speed for ten real active-combat seconds after the sip, including cooldowns and reload, without speeding up the opponent or its own countdown. A visible timer tracks the effect; drinking another dose while already hasted is disabled.

The camp’s **View ladder** opens all 18 encounters: five challengers followed by a boss, repeated across three stages. Only victories advance the ladder. Defeat retries the same fight; completing all three stages unlocks elite exhibition matches.

| Round | Boss             | Fixed equipment                                                                      | Specialty                                                   |
| ----- | ---------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 6     | Cassian the Red  | Iron Sword, Rusty Sword, Riveted Chainmail, Closed Steel Helm, knife, healing potion | 120% size, 125 HP, 25% faster weapon attacks                |
| 12    | Brakka Stonefist | War Hammer, Steel Cuirass, Viking Helm, axe, healing potion                          | 130% size, 160 HP, heavy armor, 10% slower movement/attacks |
| 18    | Vesper Ashwind   | Steel Crossbow, Riveted Chainmail, Roman Legionary Helm, haste potion, knife         | 125% size, 140 HP, 30% faster movement, 10% faster attacks  |

Move the mouse to aim a held crossbow, including down toward fallen opponents. Either hand attack fires the two-handed crossbow; the bolt starts at its rendered muzzle with gravity compensation. **C** can physically deflect a bolt with the weapon during the normal 140 ms window, sending it in a random direction. A reflected bolt can hurt its original shooter. It grants no remote stun or counter-shove; thrown knives and axes retain their normal behavior.
