# Arena of Ash — M1: Playable Foundation

An original single-player gladiator RPG built with TypeScript, Phaser **3.90.0**, and Vite. The interface is English. All artwork is procedural; no external assets, accounts, services, or credentials are required.

## Run

Use **Node.js 22 LTS**, npm, and an ordinary landscape desktop browser.

```sh
npm ci
npm run dev
```

The server binds to `0.0.0.0:5173`. Open the locally served application in your browser. The 1280 × 720 canvas scales to fit. Portrait screens display a rotation message.

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npm run preview
npm run format
```

## Browser tests

```sh
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install --with-deps chromium
npm run test:e2e
```

On this managed cloud machine, a system Chromium is already available; the browser download domain is blocked. Use:

```sh
export PATH=/workspace/.arena-tools/node_modules/.bin:$PATH
export CHROMIUM_PATH=/usr/bin/chromium
npm run test:e2e
```

Playwright starts Vite automatically when needed. Tests interact with actual canvas controls. They select Canvas rendering for predictable speed on machines without hardware GPU acceleration; normal builds prefer WebGL and fall back to Canvas. A separate test checks default renderer startup. Development-only query parameters `seed=42` and `renderer=canvas` support deterministic tests. `window.__arena.snapshot()` exposes a cloned, read-only snapshot only in development; production builds have no diagnostic API or test controls.

Screenshots are written to `test-results/screenshots/`; failures include screenshots and traces. CI uploads those artifacts. Browser tests cover victory, defeat, purchases, equipment, persistence, keyboard input, scene shutdown, reset confirmation, and viewport scaling.

## Play

Enter the arena from camp. Keys **1–4** select Quick Attack, Heavy Attack, Defend, and Recover. Mouse and touch also work. **Escape** returns to camp and abandons the current fight without rewards. Action controls lock during animation and the enemy turn. Recover restores stamina; Defend mitigates the next attack. Victory earns 50 gold and 40 XP; defeat earns 10 of each. Spend gold at the shop, equip owned items, and allocate two attribute points per level in the character screen. Progress saves automatically in localStorage; reset requires confirmation.

## Scope

Six scenes, three increasingly strong opponents, eight equipment definitions, five attributes, leveling, versioned saves, and modular keyframed character animation. The final enemy repeats. Fight health and stamina reset each battle; unfinished fights are not saved. Placeholder art, no audio, no backend, no mobile app, no production balance pass. Browser saves are local to their origin and device. Browser storage failure falls back to session-only play with a warning. The Phaser bundle is large (~350 KB gzip), reported by Vite as a size warning.

See [architecture](docs/ARCHITECTURE.md), [animation](docs/ANIMATION_SYSTEM.md), [art contract](docs/ART_PIPELINE.md), [game design](docs/GAME_DESIGN.md), and [roadmap](docs/ROADMAP.md).

## Public playtesting

[GitHub Pages deployment instructions](docs/DEPLOYMENT.md) describe the one-time repository setting and automatic deployment after validated pushes to `main`. The public build uses `/arena-of-ash/` as its base path. Saves remain in each tester's browser across compatible updates.

## Choose character art and animation

Open **Style Studio** in camp to compare **Original**, **Bronze Hero**, and **Ash Vanguard**. Preview all animations, toggle demonstration equipment, mirror the figures, and select a style for actual battles. Selection persists independently of game progress. The original graphics and animations are preserved and remain selectable at any time. See [visual variants](docs/VISUAL_VARIANTS.md).
