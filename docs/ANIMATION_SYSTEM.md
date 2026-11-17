# Ash Vanguard animation

The game has one art direction and one Grounded rig. Root origin is the floor; logical coordinates use +X toward the opponent, +Y down and clockwise radians. Enemy mirroring occurs at the whole root, with mirrored root displacement/rotation. Do not mirror individual knee/elbow signs.

Root → pelvis/waist at (0,-120). Far hip (-8,10) → thigh 54 → shin 52 → foot. Near hip (+8,10) uses the same chain. Torso pivots at the waist; its drawing is offset (0,-76). Shoulders at (-14,-59) and (+14,-59) → upper arm 40 → forearm 34 → hand. Head attaches at (0,-84). Helmet follows head; weapon follows near hand; shield follows far hand. Tower Shield renders over the torso below the weapon arm. Other far-side parts render behind the torso.

`groundedMotion.ts` supplies eight clips: idle, quick, heavy, defend, recover, hit, death and victory. Poses carry root movement, torso/head rotation, hand/ankle targets, wrist angles and a foot-support weight. `kinematics.ts` converts those targets to constrained joint rotations with immutable segment lengths. Soles remain level and the rear foot stays planted through attacks; the front foot lifts, lands and returns. The fall releases support and prevents heel/toe penetration. See [anthropometry](ANTHROPOMETRY.md) for dimensions and references.

`Animator` accepts a clip library, derives its interpolation keys/rest pose from the library, and blends from the last displayed pose on interruption. Smoothstep interpolation, actual elapsed milliseconds and disabled Phaser delta smoothing keep events aligned on slower renderers. Idle loops; action clips return to idle; death and victory hold their final pose.

Impact frames fire once when crossed, including skipped frames. The presentation layer applies the precomputed combat event then updates HP/stamina and reactions. Completion advances the battle state only after impact and animation completion. `stop()` removes callbacks on scene shutdown. No scene-specific attack timers guess impact timing.

`equipmentMotion.ts` selects a spear-specific clip library for Training Spear and Ashwood War Spear; swords use the standard Ash library. The same event lifecycle and damage calculation apply. Add new motions using local targets, explicit impact frames and reachable support poses. Validate fixed lengths, flexion, foot support, blade/face clearance, interruption and actual rendered joint transforms.
