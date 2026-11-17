# M1 verification — 2026-11-17

Validated on Node.js v22.23.5, npm 11.9.0, Linux, system Chromium 156.0.8078.79, Phaser 3.90.0.

| Check                      | Actual result                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Frozen install             | `npm ci` passed; lockfile retained                                                                                             |
| Environment install script | Executed successfully, including Node activation, clean install, typecheck, lint, unit tests and build                         |
| TypeScript strict check    | Passed                                                                                                                         |
| ESLint                     | Passed                                                                                                                         |
| Vitest                     | 43 tests passed, none skipped                                                                                                  |
| Production build           | Passed; Vite reports Phaser bundle size warning (~350 KB gzip)                                                                 |
| Playwright                 | 6 tests passed, none skipped                                                                                                   |
| Console and runtime checks | All browser scenarios assert no console errors or uncaught exceptions                                                          |
| Production browser smoke   | Canvas/menu rendered, shop navigation checked, no failed requests or runtime/console errors, development diagnostic API absent |

Browser gameplay uses real pointer and keyboard interaction with a read-only snapshot for assertions. Full victory and defeat play through normal combat with seeded randomness. Shop, reset confirmation, equipment, reload, attribute allocation, scene shutdown during an attack, a 960×600 landscape viewport and a 390×844 portrait viewport are covered. A separate default-renderer startup check complements Canvas gameplay tests. The equipment/attribute test uses a valid earned-progress save fixture, then purchases, equips and allocates through actual controls.

An initial WebGL software-renderer run was slow. Tests use Canvas for stable gameplay timing. A later loaded-machine run exposed stretching caused by Phaser's default delta smoothing; disabling smoothing makes animation use actual elapsed time. Final browser checks all passed after that correction. These checks do not establish 60 FPS on every GPU or browser. GitHub Actions is configured but has not run remotely.

Screenshots are generated under `test-results/screenshots/`: `menu.png`, `arena.png`, `attack.png`, `victory.png`, `defeat.png`, `character.png`, `equipment.png`, `full-equipment.png`, `equipped-arena.png`, `shop.png`, `small-landscape.png`, `portrait.png`, `default-renderer.png`, `production-menu.png`, and `production-shop.png`. Screenshots were visually inspected for rig continuity, weapon grip, equipment alignment, readable layout, viewport fit and rotation messaging. Placeholder art remains intentionally simple.

The managed network blocks the Playwright download CDN; the installed system Chromium works through the configured fallback. No additional network domains or credentials are required for this current environment. Standard CI uses Playwright's normal Chromium installation.

The environment draft contains tested `install_script` and `start_skill` fields. Saving a draft does not publish the environment or prove restoration in a new task. The initial remote repository had no commits; this implementation is committed locally and is not pushed. Push the local commit to GitHub before depending on a fresh remote checkout. Local-only commit restoration has not been validated.
