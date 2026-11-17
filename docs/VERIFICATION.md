# Verification — 2026-11-17

The current game uses Ash Vanguard artwork and Grounded motion exclusively. Style Studio, the other art and motion variants, paired warglaives and their offhand rules have been removed. The catalog contains eleven items, including Ashwood War Spear, Viking Warhelm and Tower Shield. No retired-item migration or refund logic is implemented.

Validated locally on Node.js 22, Phaser 3.90.0 and system Chromium:

| Check                   | Result                                 |
| ----------------------- | -------------------------------------- |
| Strict TypeScript check | Passed                                 |
| ESLint                  | Passed                                 |
| Vitest                  | 68 tests passed across 3 files         |
| Playwright              | All 8 browser tests passed             |
| Pages production build  | Passed with `/arena-of-ash/` base path |

Unit coverage includes combat and progression, reward idempotency, save validation, all remaining equipment, spear-specific animation impact events, fixed bone lengths, joint limits, planted feet, collapse floor clearance and sword/spear face clearance. Obsolete style, studio and paired-weapon tests were removed with their features.

Browser tests use actual pointer and keyboard controls with a read-only development snapshot. They cover full victory and defeat, one reward payout, all eleven purchases across shop pages, inventory pagination, the complete spear/helmet/tower kit and reload persistence, attribute allocation, scene shutdown during an attack, reset confirmation, landscape scaling and portrait messaging. Actual Phaser joint transforms verify both facing directions, level soles, rear-foot support and a front-foot step. Old appearance preference keys cannot re-enable removed styles; no studio or paired-blade purchase control exists. Every scenario asserts no console errors or uncaught exceptions. Canvas gameplay and default-renderer startup are both exercised.

Screenshots under `test-results/screenshots/` include `menu.png`, `arena.png`, `attack.png`, `victory.png`, `defeat.png`, `character.png`, `new-equipment-shop.png`, `new-equipment-character.png`, `new-equipment-arena.png`, `spear-thrust.png`, `anatomy-heavy-2.png`, `anatomy-heavy-5.png`, `anatomy-heavy-8.png`, `small-landscape.png`, `portrait.png` and `default-renderer.png`. Visual review checks the simplified menu, three-item second shop page, readable equipment UI, spear silhouette, horned helmet and visible tower shield. Screenshot/input helpers wait for two rendered animation frames when scenes restart.

The existing Phaser bundle-size warning remains. Browser checks do not establish frame rate on every device. GitHub's management API and the public Pages hostname are blocked from this environment, so local checks do not verify remote deployment completion. The existing workflow validates pushes to main before publishing the game at https://tinilit.github.io/arena-of-ash/.

A production preview smoke check navigated from camp to the second shop page through pointer input. The three retained additions rendered, no assets failed to load, no console or uncaught errors occurred, and the development diagnostic API was absent. `pages-menu.png` and `pages-equipment.png` record this check.
