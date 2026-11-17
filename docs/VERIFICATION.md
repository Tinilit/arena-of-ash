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

## Visual variants update — 2026-11-17

The earlier M1 handoff above predates the GitHub Pages setup, which subsequently pushed the implementation to GitHub. The visual-variants update adds Original / Bronze Hero / Ash Vanguard without removing the original art or clip data.

Current local checks: strict type checking passed; lint passed; **74 unit tests passed** (43 domain/lifecycle tests plus 31 profile/preference tests); **9 browser tests passed**. The Pages production build passed with `/arena-of-ash/` as its base path. The existing large-bundle warning remains (~354 KB gzip). Screenshots of the three-way comparison, unarmored variants, mirrored poses, heavy wind-up, held death/victory, both new arena styles and killing blows were visually inspected. Browser checks assert no console or uncaught runtime errors, unchanged progression during style selection, persisted selection, restoration of Original, single reward payout and preview bounds clear of UI controls.

New screenshot artifacts include `style-comparison.png`, `style-unarmored.png`, `style-heavy.png`, `style-death.png`, `style-victory.png`, `style-mirrored.png`, `bronze-arena.png`, `ash-arena.png`, `bronze-death-arena.png`, and `ash-death-arena.png` under `test-results/screenshots/`.

This environment still blocks GitHub's management API and direct access to the Pages hostname, so local validation does not establish that a new public deployment has completed. The existing deployment workflow publishes validated pushes to `main`; its remote result must be checked separately.

After the final adjustment that keeps the collapsed fighter above the arena controls, all 74 unit tests and the Pages build passed again; the 3 affected browser checks (studio and both killing-blow presentations) were rerun and passed. The other 6 browser checks had passed in the preceding full 9-test run.

## Grounded anatomy update — 2026-11-17

The default motion now uses a waist pivot, fixed 40/34 arm and 54/52 leg segments, constrained two-bone IK, level soles, a planted rear foot and a timed front-foot step. Wrist articulation replaces the former inline weapon grip. The legacy rigs, art and previous motion libraries remain selectable under Motion: Legacy. References and conventions are documented in [ANTHROPOMETRY.md](ANTHROPOMETRY.md).

Final local results: strict type check passed; ESLint passed; **109 unit tests passed**; **11 browser tests passed**; the Pages production build passed. New checks sample limb lengths, flexion limits, support targets, rolling heel/toe floor clearance and sword/spear face clearance. Browser measurements check actual Phaser joint transforms in both facing directions and through the heavy attack, not only pure calculations. Legacy restore/persistence and unchanged player progression are covered. A transient test read before a queued scene restart completed was corrected to wait for the actual rendered mode; the final full suite passed.

Visual review included idle, wind-up, impact, recovery, mirrored/full-equipment views, both new held collapses, menu and character-screen layout. One late review found a collapsed foot entering the controls; final poses and the sampled heel/toe floor constraint corrected it, followed by another full browser pass. Initial standing joint angles were not accepted as adequate evidence for the whole animation.

The production bundle retains the existing size warning (~357 KB gzip). Remote CI/deployment completion remains unverified from this environment because GitHub's management API and Pages hostname are blocked. The unchanged deployment workflow runs these checks before publishing pushes to main.
