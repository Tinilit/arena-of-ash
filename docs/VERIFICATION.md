# Real-time arena verification — 2026-11-18

This change replaces turn-based combat with continuous movement, running, jumping and overlapping rear-hand attacks. The free front arm, refined shoulders, Ash Vanguard artwork, Grounded rig and nine-item shield-free catalog remain. Damage requires active blade/body contact; no animation marker or random accuracy roll changes HP.

## Checks

Validated with Node.js 22, Phaser 3.90.0 and system Chromium:

| Check                  | Result                                 |
| ---------------------- | -------------------------------------- |
| Strict TypeScript      | Passed                                 |
| ESLint                 | Passed                                 |
| Vitest                 | 128 tests passed across 7 files        |
| Playwright             | 15 browser scenarios                   |
| Pages production build | Passed with `/arena-of-ash/` base path |

The 26 new real-time unit checks cover capsule intersections, parallel/degenerate segments, fast sweeps, simultaneously moving targets, near misses, anticipation/recovery exclusion, facing changes, one hit per swing, guard, stamina, jumping, landing, bounds/body separation, simultaneous lethal trades, outcomes, recovery caps, source-model isolation, action/clip timing, layered locomotion, death continuity from the displayed composite pose, affordable AI decisions and runtime weapon geometry validation. Existing tests retain progression, equipment, saves, runtime content, IK constraints, fixed bone lengths, planted support, interpolation continuity and blade/face clearance.

Browser scenarios cover a distant missed attack, approaching and making real contact, full victory/defeat, single rewards, fresh battles, all purchases/equipment persistence, live item images/stats, invalid-art fallback, keyboard shutdown, responsive views, body/arm draw order and shoulder attachments, camp controls and arena run/jump/attack composition. The added contact scenario samples both HP counters and recorded contact shapes: every decrement equals new collision events, each recorded blade/body pair intersects and both fighters deal contact damage. The hold-control scenario covers mouse movement, guard toggling, jumping, bounds, stopped wall movement, focus pause and abandoning without rewards.

GitHub publishing CI passed all 15 scenarios. Local runs exposed timing-sensitive camp assertions under a throttled renderer: they now observe movement state, sample at the actual direction change and track the whole jump rather than an arbitrary delayed frame. The corrected camp scenario also passed locally. The production entry exposes no development snapshot or hitbox overlay.

Screenshots under `test-results/screenshots/` include `attack-missed-at-distance.png`, `arena-running-attack.png`, `arena-jumping-attack.png`, `realtime-contact-combat.png`, `arena-touch-jump.png`, full battle results and the preserved equipped/arm/shoulder/camp views. Capsule shapes approximate drawn body/blade silhouettes; these are not per-pixel alpha collisions or frame-rate measurements on every device. The existing Phaser bundle-size warning remains.

## Controls and publication

A/D or Left/Right move; Shift runs; Space jumps; J/1 quick-attacks; K/2 heavy-attacks; hold L/3 to guard; F/4 recovers; R toggles stance; Escape returns to camp. Mouse/touch supports held movement/run buttons, Jump, attacks and a Defend toggle. See [real-time combat](REALTIME_COMBAT.md), [animation](ANIMATION_SYSTEM.md) and [runtime collision metadata](RUNTIME_CONTENT.md#weapon-contact-shape).

The public playtest address is https://tinilit.github.io/arena-of-ash/. The `Validate and deploy game` workflow gates publication on the pushed commit's checks. Match its successful deployment to the exact commit and compare the served JavaScript bundle with the local `/arena-of-ash/` build; local test success alone does not establish a public update. Cloud environment publication and GitHub Pages deployment are separate operations.
