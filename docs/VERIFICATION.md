# Release verification — 2026-11-18

The draft uses Ash Vanguard art and Grounded motion. It adds the neck/shoulder redesign, rear-hand sword/spear attacks, a softly bent front arm with a neutral wrist, curved fingers and a separate equipment mount, forward/backward walking, forward/backward running, jumping and relaxed/combat idles. The original front-hand attack library remains available for future equipment. The default catalog still has nine items without shields.

## Local validation

Validated with Node.js 22, Phaser 3.90.0 and system Chromium:

| Check                   | Result                                 |
| ----------------------- | -------------------------------------- |
| Strict TypeScript check | Passed                                 |
| ESLint                  | Passed                                 |
| Vitest                  | 113 tests passed across 6 files        |
| Playwright              | 13 browser scenarios passed            |
| Pages production build  | Passed with `/arena-of-ash/` base path |

Unit checks cover combat, progression, equipment, saves, runtime content, fixed bone lengths, joint limits, foot/floor support and blade/face clearance. New movement checks cover stance-foot translation cancellation in both directions, matching foot velocity at contact boundaries, continuous cycle phase after overshooting a boundary, jump landing and returning once to the selected idle, including a stance change in flight. The free elbow stays softly flexed and its wrist neutral through actions and movement. Sword and longest-spear face clearance is sampled every 8 ms for every clip with either primary hand.

Browser checks cover complete victory/defeat, single rewards, all nine purchases, pagination, equipment/save persistence, attribute allocation, keyboard input, scene shutdown, reset and viewport scaling. They also cover runtime image-backed gear, changed live stats, invalid-content fallback, both legs below the skirt, the free front arm behind the torso and the armed rear arm in front, and their actual shoulder/hip transforms in both facing directions. The camp scenario exercises walking forward/back, running, jumping, both idle stances, rear-hand weapon grip and unchanged player progression. An equipped spear/helmet jump checks framing below the title. Every scenario checks console and uncaught errors. After the free-arm pose/art/layer refinement, the affected camp, equipped/mirrored rig and shoulder-attachment scenarios were rerun. Default-renderer startup is covered separately from deterministic Canvas gameplay.

Screenshots under `test-results/screenshots/` include `camp-walk-forward.png`, `camp-walk-backward.png`, `camp-run.png`, `camp-jump.png`, `camp-equipped-jump.png`, `camp-combat-idle.png`, `rear-hand-combat-idle.png`, `rear-hand-heavy.png` and equipped/mirrored fighters, guard, victory and defeat. These are review artifacts, not frame-rate measurements on every device. The existing Phaser bundle-size warning remains.

## References and controls

Shoulder construction follows the anatomy illustrations and cutout-rig guides linked in [rig refinement](RIG_REFINEMENT.md). The shared coordinate contract is in [anthropometry](ANTHROPOMETRY.md); hand selection, contact phases, jump support and transitions are in [animation](ANIMATION_SYSTEM.md).

In camp: **A/D** walk backward/forward, **Shift+A/D** run, **Space** jumps and **R** toggles stance. Mouse/touch buttons demonstrate a movement cycle or change stance. Arena remains turn-based and starts in combat idle.

## Publication status

The public playtest address is https://tinilit.github.io/arena-of-ash/. Publication is authorized for this change set. The `Validate and deploy game` workflow validates the pushed commit before publishing its Pages build. Verify the successful workflow's exact commit and compare the served JavaScript bundle with the local `/arena-of-ash/` build; local validation alone does not establish a public update. Cloud environment publication and GitHub Pages deployment are separate operations.
