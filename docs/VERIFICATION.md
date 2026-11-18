# Loadout, throwing and combat verification — 2026-11-18

This release adds continuously regenerating combat stamina, removes the player Defense/Recover controls, replaces the character equipment list with anatomical slot cards, and adds a reusable throw preview. Ash Vanguard, Grounded anatomy, player-only hops, active blade/body contact and adaptive display density remain.

## Checks

Validated with Node.js 22, Phaser 3.90.0 and Chromium:

| Check                  | Result                     |
| ---------------------- | -------------------------- |
| Strict TypeScript      | Passed                     |
| ESLint                 | Passed                     |
| Vitest                 | 163 tests across 10 files  |
| Playwright             | 24 browser scenarios       |
| Pages production build | `/arena-of-ash/` base path |

Thirteen new unit cases cover equipment category compatibility, unique equipped instances, moving/removing items, all-position persistence, primary-hand fallback, non-stacking secondary/belt stats, stamina regeneration during idle/attack/run/jump/hops, maximum/outcome behavior, both throw-hand libraries, immutable limb lengths, reachable hands, planted support a single release marker even across skipped frames, clean state on immediate replay, and preservation of live bonuses on active armor/weapon.

Three new browser scenarios inspect actual hand/belt transforms, move equipment between anatomical positions, persist/reload a left-hand primary weapon, observe a complete throw with held/released prop and weapon visibility, confirm return to idle without inventory/progression changes, and sample increasing stamina during simultaneous attack/hop with no Defense/Recover buttons or bindings. Existing shop/live-content/save scenarios use the new slot/category contract and save version 2. Input helpers observe frames after a click so deferred scene restarts have completed before assertions.

The retained scenarios exercise progression, victory/defeat, one-time rewards, runtime JSON/images and fallback, shoulder/arm/garment depth, camp locomotion, attacks while moving/airborne, recorded physical contacts, focus cleanup, bounds, large displays, Retina, native 4K, fractional DPI and logical pointer targeting. Body/blade shapes remain articulated capsules rather than per-pixel masks. Dormant guard/recover animation/engine checks are retained, but those player controls are not exposed.

Screenshots under `test-results/screenshots/` include `anatomical-loadout-both-hands-belt.png`, `left-hand-primary-arena.png`, `camp-throw-preview.png`, the updated Character/shop views and prior anatomy/contact/display captures.

## Controls and scope

Arena: A/D or arrows move, Shift runs, Space jumps, direction+Space hops, J/1 quick-attacks, K/2 heavy-attacks, R changes stance, Escape returns to camp. Stamina regenerates at 14/second throughout active simulation; running costs 10/second, leaving a positive net rate. L/3/F/4 do not start player actions. Bots wait for passive regeneration instead of requesting recovery; their existing ordinary jumps and occasional guard remain.

Camp T / Throw and Character Throw preview play the animation only. No spear/net/grenade projectile, belt activation, item consumption or thrown damage is implemented. A second hand weapon is carried; the right hand attacks by default and the left becomes active when the right is empty. Only the active weapon contributes attack stats/contact. Belt net/flask remain visible inactive attachments. See [equipment](EQUIPMENT.md), [throw motion and consulted guides](THROW_ANIMATION.md), [combat](REALTIME_COMBAT.md) and [runtime content](RUNTIME_CONTENT.md).

The new save key/format is `arena-of-ash.v2` / `{version:2,player}`. Old equipment layouts are not migrated. Fresh characters start with a wooden sword, folded net and clay flask. Shields and paired warglaives remain absent.

## Publication

The public playtest address is https://tinilit.github.io/arena-of-ash/. The `Validate and deploy game` workflow gates deployment on the pushed commit's full checks. Verify its successful deployment against the exact commit and compare the served JavaScript bundle with the local Pages build. Production must not expose the development snapshot API. Cloud environment publication and Pages deployment are separate operations.
