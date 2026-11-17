# Grounded rig: proportions, joints and support

## Diagnosis

The prior rig rotated its torso around the upper chest rather than the waist. Both legs used independently keyed angles, including a negative far-knee bend. Feet inherited thigh and shin rotation. Large root translations slid the entire body without a supporting step. The sword was locked along the forearm, without a wrist. These faults were visible even when all health, stamina and animation event tests passed.

The game uses the corrected Grounded rig and Ash Vanguard artwork exclusively. Alternate styles, legacy-motion selection and the studio have been removed. The player save schema remains unchanged.

## References consulted

- [OpenSim Arm26 model](https://github.com/opensim-org/opensim-models/blob/master/Models/Arm26/arm26.osim): shoulder/elbow chain, segment attachment offsets and a model elbow-flexion range of 0–130 degrees. Its shoulder coordinate spans -90–180 degrees. Its axes differ from our screen coordinates.
- [OpenSim Gait2392 model](https://github.com/opensim-org/opensim-models/blob/master/Models/Gait2392_Simbody/gait2392_thelen2003muscle.osim): hip/knee/ankle hierarchy, separate foot body, knee flexion and a tibia-to-ankle offset of 0.43 m. The model knee coordinate spans -120–10 degrees with its own axis convention.
- [Unity Two Bone IK documentation](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html), read through the [published-package documentation mirror](https://github.com/needle-mirror/com.unity.animation.rigging/blob/master/Documentation~/constraints/TwoBoneIKConstraint.md): root/mid/tip chain, target position, bend hint and weighted constraint release.

These references inform joint mechanics, not a claim of clinical or population-average anthropometry. This remains a stylized cartoon character, approximately 4.7 heads tall. The implementation uses its own analytic two-bone solution and poses; no external engine or anatomy assets are copied into the game.

## Coordinate and proportion contract

Logical units are pixels before display scale. +X faces the opponent; +Y points down; a zero-angle bone points down. Mirror the whole rig, not individual knee/elbow signs.

| Measurement                         | Grounded value         |
| ----------------------------------- | ---------------------- |
| Pelvis / waist origin               | (0, -120)              |
| Hip centers                         | (+8, -110), (-8, -110) |
| Shoulder centers, relative to waist | (+27, -63), (-27, -63) |
| Upper arm / forearm                 | 40 / 34                |
| Thigh / shin                        | 54 / 52                |
| Head joint relative to waist        | (0, -84)               |
| Resting head-to-floor height        | approximately 244      |
| Sole below ankle                    | 14                     |
| Neutral ankle targets               | (+32, -14), (-28, -14) |

Legs are longer relative to the torso than in the earlier rig. Bone lengths are immutable during playback. Procedural limb envelopes are drawn directly at these lengths and updated from the solved bend. The drawing is not stretched. The torso rotates at the waist, while torso/chest drawings are offset upward by 76 units. Head, shoulders and gear inherit that waist rotation.

## Joint and foot rules

`kinematics.ts` solves target positions using the cosine rule. Knees use the forward-bending solution; elbows use the opposite bend sign. Flexion is limited to 120 degrees for knees and 130 for elbows, with a small soft bend before full extension. Shoulder motion is constrained to forward elevation up to 180 degrees and extension up to 45 degrees in the selected screen-plane convention. Wrist rotation is independently limited to roughly -37–75 degrees.

Targets outside a limb's reachable annulus are clamped instead of stretching a bone or reversing its bend. Authored standing and attack foot targets are checked to remain reachable. Hands may saturate the elbow limit during interpolation; the bones still retain their exact lengths.

Ankle targets live in the initial floor frame. Inverse root transformation removes body translation and rotation before solving the two leg chains. Ankle rotation counters thigh, knee and root rotation, keeping the sole level. Idle breathing therefore does not lift the feet. The rear foot stays planted throughout quick/heavy attacks; the front foot lifts, advances, lands before impact, and steps back during recovery. Smaller root travel and a closer fighting distance replace the old large body slide. The fall gradually releases foot support before using constrained folded-leg poses; a collapsed fighter is no longer treated as a standing support chain.

The sword mount is perpendicular to a neutral forearm grip, with the hand/wrist supplying the additional cut angle. A carried shield uses the character root frame to remain upright during guard; its separate rear drawing follows the actual far-hand transform. Both stay attached to their hands.

## State, tests and visual review

Appearance and motion are fixed, not loaded from old preference keys. There is no settings migration.

Unit tests sample every grounded clip for Ash Vanguard: segment lengths, joint limits, reachable planted targets, rear-foot stability, finite transforms, and single impact/completion events. Browser tests measure the actual Phaser hip/knee/ankle/shoulder/elbow/hand transforms, verify level heel/toe points in both facing directions, track the planted rear foot through an entire heavy attack, and verify a real front-foot lift. They also verify that old appearance preferences cannot re-enable removed styles. These checks run in the arena, where preview framing cannot conceal sliding. The browser samples actual transforms on every animation frame without taking screenshots during the short foot-lift interval.

Review artifacts include `arena.png`, `anatomy-idle.png`, `new-equipment-character.png` and `new-equipment-arena.png` in `test-results/screenshots/`, alongside the normal full-battle screenshots.

A further sampled check transforms the sword/spear blade centerline into the moving head's frame and tests it against the central facial region. The longest catalog blade is checked every 8 ms for every Ash clip. Heavy wind-up and victory now lift the hilt outside the face before drawing the weapon overhead; a separate forward keyframe precedes the cut. This supplements joint-limit tests, which alone cannot detect a weapon passing through a face. It is a presentation clearance check, not gameplay collision detection.

Released feet also have a heel/toe floor constraint during the fall. Any interpolated sole penetration translates the already-solved assembly upward without changing bone lengths or feeding the correction back into the IK solution. The held collapse uses folded legs and a raised root so the corpse remains on the sand rather than extending into the action controls. Sampled tests cover both sole endpoints throughout this transition.

The shoulders now align to the torso contour, 27 units to either side of center and 13 units below the torso artwork origin. Both hip pivots remain at ±8, 10 relative to the waist, inside the skirt. Both legs render beneath the garment. Both shoulders live in a foreground waist transform with exactly the same torso rotation; this separates draw order from anatomical placement. See [rig refinement and references](RIG_REFINEMENT.md).

Both arms are drawn in front of the torso and skirt, with the far arm below the near arm. Greave width follows the full calf profile and overlaps the boot shaft; the shaped leather foot keeps its sole at the same support height. Shields are paused in the active catalog and enemy loadouts.
