# Verification — 2026-11-17

The current game uses Ash Vanguard artwork and Grounded motion exclusively. Style Studio, the other art and motion variants, paired warglaives and their offhand rules have been removed. The catalog contains eleven items, including Ashwood War Spear, Viking Warhelm and Tower Shield. No retired-item migration or refund logic is implemented.

Validated locally on Node.js 22, Phaser 3.90.0 and system Chromium:

| Check                   | Result                                 |
| ----------------------- | -------------------------------------- |
| Strict TypeScript check | Passed                                 |
| ESLint                  | Passed                                 |
| Vitest                  | 92 tests passed across 4 files         |
| Playwright              | 5 affected browser scenarios passed    |
| Pages production build  | Passed with `/arena-of-ash/` base path |

Unit coverage includes combat and progression, reward idempotency, save validation, all remaining equipment, spear-specific animation impact events, fixed bone lengths, joint limits, planted feet, collapse floor clearance and sword/spear face clearance. Obsolete style, studio and paired-weapon tests were removed with their features.

Browser tests use actual pointer and keyboard controls with a read-only development snapshot. They cover full victory and defeat, one reward payout, all eleven purchases across shop pages, inventory pagination, the complete spear/helmet/tower kit and reload persistence, attribute allocation, scene shutdown during an attack, reset confirmation, landscape scaling and portrait messaging. Actual Phaser joint transforms verify both facing directions, level soles, rear-foot support and a front-foot step. Old appearance preference keys cannot re-enable removed styles; no studio or paired-blade purchase control exists. Every scenario asserts no console errors or uncaught exceptions. Canvas gameplay and default-renderer startup are both exercised.

Screenshots under `test-results/screenshots/` include `menu.png`, `arena.png`, `attack.png`, `victory.png`, `defeat.png`, `character.png`, `new-equipment-shop.png`, `new-equipment-character.png`, `new-equipment-arena.png`, `spear-thrust.png`, `anatomy-idle.png`, `small-landscape.png`, `portrait.png` and `default-renderer.png`. Visual review checks the simplified menu, three-item second shop page, readable equipment UI, spear silhouette, horned helmet and visible tower shield. Screenshot/input helpers wait for two rendered animation frames when scenes restart.

The existing Phaser bundle-size warning remains. Browser checks do not establish frame rate on every device. GitHub's management API and the public Pages hostname are blocked from this environment, so local checks do not verify remote deployment completion. The existing workflow validates pushes to main before publishing the game at https://tinilit.github.io/arena-of-ash/.

A production preview smoke check navigated from camp to the second shop page through pointer input. The three retained additions rendered, no assets failed to load, no console or uncaught errors occurred, and the development diagnostic API was absent. `pages-menu.png` and `pages-equipment.png` record this check.

## Runtime equipment content

Definitions now load from an external JSON catalog before saves are read. The code keeps a validated snapshot for the session and can load optional item image attachments. Production reads the public raw catalog on main; local development reads the same content directory through Vite. Content-only pushes run validation without building or redeploying the game.

The 24 content tests validate the actual publication file and referenced local images, reject duplicate IDs, invalid slots/visuals/numbers/paths/versions, exercise live purchasing/equipping/saving, and cover network/HTTP/JSON/schema failures and timeout fallback. Gameplay unit and browser tests use a fixed catalog fixture so future balance edits do not invalidate foundation assertions.

Browser tests add a new image-backed spear from a routed external JSON response, buy and equip it through normal controls, and check its texture attachment and exact damage. Changing only the external response and image filename affects the next refresh, preserves ownership, requests the new revision's artwork and applies the changed damage. The active battle retains its original stats. Invalid JSON definitions and undecodable image data exercise included catalog and procedural-art fallback. Frame measurements now sample inside the browser on every animation frame without screenshots interrupting the brief foot lift.

A separate production preview test adds a spear and changes a purchase price using only externally delivered JSON. Purchases, equipment and reload persistence succeed through pointer input; the JavaScript bundle SHA-256 stays unchanged. No asset, console or uncaught errors occur, and the development diagnostic API is absent. `runtime-production-shop.png`, `runtime-production-character.png` and `runtime-image-equipped.png` record the relevant views. Test-only items are not published in the default catalog.

## Shield layer correction

Shield artwork now renders as the first child of the character root, below the entire body hierarchy. The far arm retains its normal place behind the torso. Its hand position is copied through world-to-root coordinates after each pose, so mirroring, movement and scaling retain the grip without mixed subtree ordering. This applies to procedural and optional runtime shield images. References and conventions are in [render order](RENDER_ORDER.md).

The current checks include 92 unit tests, strict type checking, lint, the Pages build and five affected browser scenarios: full paginated spear-kit purchase/equipment/reload, both-facing shield layering and grip during a heavy attack and guard, actual limb/support measurements, external image-backed equipment, and invalid-content/art fallback. `tower-shield-character.png`, `tower-shield-both-facing.png` and `tower-shield-guard.png` were visually reviewed. The previous ten-scenario browser baseline predates this correction; the new shield regression scenario is added to CI.

The Pages production build was also opened with the default WebGL renderer. Character and arena views with tower shields in both facing directions rendered without failed assets, console errors or uncaught exceptions; the development API was absent. `tower-shield-production-character.png` and `tower-shield-production-arena.png` were visually reviewed. Remote deployment completion remains unverified.
