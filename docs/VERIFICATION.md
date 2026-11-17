# Current release verification — 2026-11-17

The release uses Ash Vanguard art and Grounded motion. The default catalog has nine items; shields are temporarily omitted from the catalog and opponent loadouts. Both arms render in front of the torso, both leg branches render below the skirt, and cuffs/greaves/boots follow the articulated skeleton. No retired-item migration or refunds are implemented.

## Local validation

Validated in the restored cloud workspace with Node.js 22, Phaser 3.90.0 and system Chromium:

| Check                   | Result                                 |
| ----------------------- | -------------------------------------- |
| Strict TypeScript check | Passed                                 |
| ESLint                  | Passed                                 |
| Vitest                  | 94 tests passed across 5 files         |
| Playwright              | 12 browser scenarios passed            |
| Pages production build  | Passed with `/arena-of-ash/` base path |

The unit suite covers combat, progression, purchase/equipment/save behavior, fixed bone lengths and joint limits, foot support, collapse floor clearance and sword/spear face clearance. Three motion tests check continuous nonzero speed through a monotone key, interval bounds with irregular timing, and settled turnaround/end poses. The 24 content tests validate the actual published JSON and referenced image files, failure handling and runtime item installation.

Browser scenarios exercise complete victory and defeat, single reward payouts, all nine purchases and inventory pagination, spear/helmet/chest equipment with reload persistence, attribute allocation, keyboard input, scene shutdown, reset confirmation and landscape/portrait scaling. Additional scenarios cover runtime image-backed equipment and changed stats after refresh, invalid-content/image fallback, shields absent from the shop and veteran, foreground arm ordering, both legs below the skirt and actual shoulder/hip transforms in both facing directions during motion. Each scenario checks console and uncaught errors. Canvas gameplay and default-renderer startup are covered.

Screenshot artifacts include `rig-revised-idle.png`, `rig-revised-heavy.png`, `rig-armored-character.png`, `rig-armored-both-facing.png`, `rig-armored-guard.png`, `new-equipment-arena.png` and the normal menu/battle/result views under `test-results/screenshots/`. These show the current recovered implementation. The Phaser bundle-size warning remains; these checks do not establish frame rate on every device.

## Release scope

This release publishes the working changes recovered from the previous cloud environment: garment/limb ordering, shoulder offsets, continuous limb envelopes, calf-covering greaves, shaped leather boots, smoother keyframe interpolation and the catalog without shields. References and coordinate contracts are in [rig refinement](RIG_REFINEMENT.md).

The request to make the rear hand the primary weapon hand and the subsequent request for a further neck/shoulder redesign were interrupted before implementation. They are not included in this recovered release. The existing front-hand weapon animations remain present.

## Publishing verification

Before this release, GitHub Actions and the public site's script URL identified the deployed version as `5a534e3`, with bundle `index-nCMPcdIk.js`. The recovered local Pages build produces `index-V0npRWeu.js`, confirming that the saved working changes differ from the live site. The latest earlier deployment workflow completed successfully; the previously reported missing-Pages-artifact failure is not the latest workflow outcome.

Publishing is validated by matching the pushed commit to its successful deployment run and checking the served script/bundle after deployment. Local test success alone is not evidence of a completed public deployment.
