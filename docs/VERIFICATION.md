# Current verification

The follow-up shop/Gladiator/Rage/shield/Counterstrike update passed type checking, lint, all 488 unit tests across 31 files and the production Pages build. All nine new browser scenarios passed, followed by a 13-scenario regression run after the final layout and Rage-entry adjustments. Coverage includes skill-only stock filtering through purchases and inventory returns, empty categories, zero/two/all learned skills, Rage entry and face expiry, both shield types after actual potion consumption, and a real AI enemy drinking and recovering its forward shield hold. Counterstrike tests verify the strict 20% threshold, one roll per parry and replacement of the palm shove with a physical weapon counter. The complete browser suite now contains 92 scenarios and runs in CI before deployment.

The first full follow-up CI run passed 91 scenarios and exposed a timing race in the older armor-feedback scenario: its 700 ms damage label could expire before inspection, or another live hit could break armor while the test captured its surviving equipment. That scenario now advances a controlled browser clock to each impact/wear threshold and keeps combat paused through screenshots and exit. All three isolated repeats passed, and type checking and lint passed again.

The 2026-11-20 skill/loadout/impact update passed type checking, lint, all 474 unit tests and the production build. All 83 browser scenarios were exercised: 78 passed on the complete run; five older assertions assumed an empty settings panel, no enemy Kip-Up/Second Wind, or no crossbow bolts. After correcting those fixtures/assertions, a nine-scenario focused run, including all five cases, passed. It also rechecked the compact inventory, immediate two-offer learning, exclusive shop and tower-shield layers during movement/jumps. Pain eye closure/recovery and both shield poses were inspected visually.

For skill progression, run `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:content`, `npm run test:e2e` and `npm run build`. The GitHub validation/deployment workflow runs the complete browser suite before publishing. [Skill progression](SKILL_PROGRESSION.md) documents the current feature contract and tests; the older evidence below records earlier foundation milestones.

The previous release's production smoke scenario used real WebGL and automatic fights without a diagnostic API. It completed a victory, learned Kicking through the earlier confirmation flow, completed a defeat, resumed the exclusive shop after reload, bought and sold equipment, then verified one skill and two reward IDs. Hidden fights retain actual physical contacts and persistent outcomes.

# Inventory quantities, parry and equipment recovery — 2026-11-18

Consumables support repeated purchases and bundles of 1/5/10. Equipment slots carry one copy each; backpack rows show reserves after subtracting equipped copies. Release/use consumes one source copy without auto-refill. G recovers landed player/enemy equipment into an empty compatible slot or the backpack and immediately persists ownership. A victorious player may collect a lethal thrown weapon before Continue; it remains equipped in the next match.

C provides an immediate 140 ms weapon parry window, a 450 ms action and 750 ms recovery. A confirmed frontal melee contact is deflected for zero damage and gives the attacker 1000 ms stun/off-balance recoil. Late/behind contacts, kicks and projectiles are not parried. The enemy has a separate rare-throw RNG, 12% eligible chance, a nine-second check interval and at most one attempt per fight.

## Validation

| Check               | Result                                  |
| ------------------- | --------------------------------------- |
| TypeScript / ESLint | Passed                                  |
| Unit tests          | 232 across 19 files                     |
| Browser scenarios   | 44, including successful focused reruns |
| Production build    | `/arena-of-ash/` base path              |

Unit coverage includes repeated/bulk purchases, exact source-slot consumption, spare-copy counts, two identical equipped copies, legacy saves and invalid count rejection. Parry tests cover real contact, exact timing limits, facing, miss/kick behavior, simultaneous attacker hands, a full second of stun, cooldown/repeat rejection and fixed-length reachable guard poses. Recovery tests cover original slots, full-loadout backpack fallback, enemy ownership transfer, duplicate prevention, grounded reach across the blade span, and settling/collection after victory. Rare AI checks use a separate deterministic stream and verify the one-attempt limit while another weapon remains held.

New browser scenarios purchase/equip reserves, consume one copy from each belt without auto-refill, perform a real timed C parry, recover a lethal thrown weapon after victory, and collect an enemy weapon into persistent player ownership. Existing victory/defeat, two-hand hits, airborne kicks/throws, knockdown, external JSON, Canvas/WebGL, Retina, 4K and logical pointer checks remain. A production WebGL smoke check verifies bulk quantities, a lethal throw, post-victory collection, persistence after reload and the absence of the development snapshot API. Pose assertions wait for the complete stance transition before judging knee angles. Floor-transfer poses are sampled inside the browser at 20 ms intervals to retain full down/get-up coverage without one protocol call per pose.

Collision uses authored 2D capsule approximations rather than per-pixel masks. Pickup ownership is transferred once; leaving without recovery loses the item. Used potions are consumed. Only the player requests parries/pickups; bots retain their regular attacks/guards/jumps and rare weapon throw.

## Publication

The public site is https://tinilit.github.io/arena-of-ash/. A successful `Validate and deploy game` run must match the pushed commit. Compare the served module path and SHA-256 with the Pages build. Production exposes no development snapshot API. Cloud environment publication and Pages deployment are separate operations.
