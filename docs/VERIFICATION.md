# Concurrent hands, two throwing styles and enemy loadouts — 2026-11-18

Underarm throwing remains on T; Y adds an overarm volleyball-style serve, with a raised cocked elbow, high extension/release and follow-through. Both previews keep the throwing arm in front of the head, release once and preserve inventory. Each hand now owns its action, cooldown, animator and contact ID, supporting simultaneous and staggered attacks. Victory count drives random enemy weapon/armor pools, including occasional dual wielding. Kicks deal zero HP damage while retaining pushback, stun and 20% knockdown.

## Validation

| Check | Result |
| --- | --- |
| TypeScript / ESLint | Passed |
| Unit tests | 191 across 14 files |
| Browser scenarios | 35 |
| Production build | `/arena-of-ash/` base path |

Pure tests cover two simultaneous hits, independent wind-up/cooldown, unchanged first-arm animation when the second begins, four-hit trades, shared interruption, zero-damage kick reactions, separate throwing clips and high release, repeatable/random enemy equipment, unique ownership, gear floors, uncapped wins/save round trips and dual-hand AI. Existing floor-transfer, airborne kick, geometry, live catalog, display and anatomy tests remain.

Browser scenarios inspect both preview controls and keys, head depth on every throwing frame, independently staggered hand clocks, two rendered blade/body contacts from one pair of inputs, and high-tier generated equipment after reload. Existing victory verification uses owned armor for a controlled result through real contacts. Large-screen Canvas/WebGL, Retina, 4K and logical pointer tests remain.

Pose reviews inspect both facing directions at preparation, trophy pose, high release and follow-through. These are authored 2D projections with fixed bone lengths, not rigid-body ragdolls or pixel-perfect collision masks. The common waist/shoulder frame is shared by both independent arm tracks. No projectile or belt action is added.

## Publication

The public site is https://tinilit.github.io/arena-of-ash/. A successful `Validate and deploy game` run must match the pushed commit. Verify the served module path and SHA-256 against the Pages build. Production exposes no development snapshot API. Cloud environment publication and Pages deployment are separate operations.
