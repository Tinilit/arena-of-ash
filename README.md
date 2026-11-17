# Arena of Ash

An original, single-player, turn-based gladiator RPG built with TypeScript, Phaser **3.90.0**, Vite and procedural artwork. The interface is English. The game uses **Ash Vanguard** artwork and **Grounded** joint mechanics exclusively. There is no style studio, alternate style selector or paired-blade item.

## Run

Use Node.js **22 LTS** and npm:

```sh
npm ci
npm run dev
```

The logical canvas is 1280×720 with FIT scaling. Portrait screens display a rotation message. No backend, login, app secrets or external art assets are required.

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

Start from camp, enter the arena, buy equipment and allocate level-up points in Character. Mouse/touch and keys **1–4** select Quick Attack, Heavy Attack, Defend and Recover. **Escape** returns to camp, abandoning an unresolved fight without rewards. Combat inputs lock while an action or enemy turn resolves.

Victory earns 50 gold and 40 XP; defeat earns 10 of each. Every level grants two attribute points. Saves are automatic in localStorage. Reset Progress requires confirmation. There is no special migration for retired catalog items or old appearance preferences.

## Equipment

The default catalog has **9 items** across weapon, helmet and chest slots. Shields are temporarily removed while the character rig is refined. Shop and inventory have page controls. Ashwood War Spear is on shop page 1 and Viking Warhelm is on page 2:

- **Ashwood War Spear** — 115 gold, +10 attack; wooden haft, leaf head and thrust animations.
- **Viking Warhelm** — 60 gold, +3 armor; horned fantasy helmet.

Training Spear also uses a real haft/head design. The other seven active definitions remain. See [equipment](docs/EQUIPMENT.md).

Item definitions live in [`public/content/items.json`](public/content/items.json). Add images under `public/content/items/` and edit the catalog to add or rebalance equipment without rebuilding the game. Refresh to load changes; the public game reads content directly from `main`. See the [runtime content guide](docs/RUNTIME_CONTENT.md) for a complete record, pivots, validation and publishing.

## Scope and documentation

Six scenes, three opponents, five attributes, leveling, persistent saves and a modular articulated rig. The veteran opponent repeats. Fight HP/stamina reset each battle; unfinished fights are not saved. Artwork remains procedural, balance is basic, and there is no audio or backend. Storage failure permits session-only play with a warning. The Phaser bundle produces a size warning.

See [architecture](docs/ARCHITECTURE.md), [animation](docs/ANIMATION_SYSTEM.md), [anatomy and references](docs/ANTHROPOMETRY.md), [art contract](docs/ART_PIPELINE.md), [game design](docs/GAME_DESIGN.md), [roadmap](docs/ROADMAP.md), and [verification](docs/VERIFICATION.md).

[GitHub Pages deployment](docs/DEPLOYMENT.md) publishes validated pushes to `main` using `/arena-of-ash/` as the base path. The public site and local development server keep separate browser saves.

Character rig refinements cover shoulder placement, both legs beneath the skirt, both arms above the torso, continuous elbow/knee silhouettes, calf-covering greaves, connected leather boots and smoother keyframe motion. See [rig refinement and references](docs/RIG_REFINEMENT.md).
