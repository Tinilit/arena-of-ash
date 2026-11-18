# Belt throwables, weapon throwing and healing potion — 2026-11-18

Q/E uses a belt knife, axe or healing potion. Ctrl+the selected mouse/keyboard hand attack throws that hand weapon. Every real throw uses the overarm clip, including in the air; the hands remain independent. Release spawns the actual item at the rendered wrist. Swept blade/head/body contact is required for projectile damage, once. A released item is permanently consumed and saved immediately, including misses or abandoned battles; the shop permits repurchase.

The shop sells a 30-gold healing potion for up to 35 HP. Its 2100 ms animation raises an open vial to the mouth, tilts for a sip and lowers it. Healing/consumption occurs once at 55%; interruption before the sip retains the potion. Full-health use is disabled. Camp P and Character's Drink potion button provide harmless previews. Net and water flask are removed.

## Validation

| Check               | Result                                  |
| ------------------- | --------------------------------------- |
| TypeScript / ESLint | Passed                                  |
| Unit tests          | 210 across 16 files                     |
| Browser scenarios   | 40, including successful focused reruns |
| Production build    | `/arena-of-ash/` base path              |

Pure tests cover selected-hand release, independent simultaneous throws, one-time consumption, pre-release interruption, airborne gravity/release, fast swept projectile/body contact, owner exclusion, harmless landed objects, rendered fallback profiles, potion healing/cap/interruption, repurchase/save round trips and runtime use/heal validation. Drink pose tests check fixed bones, reachable targets, smooth motion and the vial neck reaching within six logical pixels of the mouth. Existing zero-damage kicks, floor transfers, hand collision, enemy progression, live content, display and anatomy checks remain.

New browser scenarios exercise a real knife hit, airborne axe plus independent front-hand attack, Ctrl+both mouse buttons, empty hands after release, immediate persistent consumption after reload, replacement purchases, potion purchase/equip/drinking/healing and preview return to idle. Screenshots capture the shop, real contacts, airborne throw, two released weapons and the actual potion sip. The runtime catalog count assertion follows the fixture length; hold-input timing uses the controlled browser clock. A production WebGL smoke check also verifies the Pages path, inventory loss after airborne/hand throws, reload persistence and the absence of the development snapshot API. Existing victory/defeat and Canvas/WebGL, Retina, 4K and logical pointer scenarios remain.

Pose reviews inspect both facing directions. The common waist/shoulder frame is unchanged; an active front-hand throw temporarily uses the foreground plane, then returns behind the torso. These are authored 2D projections with capsule collision approximations, not rigid-body ragdolls or per-pixel masks. Projectiles settle visibly but cannot be picked up. One copy per catalog ID is owned at a time.

## Publication

The public site is https://tinilit.github.io/arena-of-ash/. A successful `Validate and deploy game` run must match the pushed commit. Verify the served module path and SHA-256 against the Pages build. Production exposes no development snapshot API. Cloud environment publication and Pages deployment are separate operations.
