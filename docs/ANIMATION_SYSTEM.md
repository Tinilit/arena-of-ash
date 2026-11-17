# Ash Vanguard animation

The game has one art direction and one Grounded rig. Root origin is the floor; logical coordinates use +X toward the opponent, +Y down and clockwise radians. Enemy mirroring occurs at the whole root, with mirrored root displacement/rotation. Do not mirror individual knee/elbow signs.

Root → pelvis/waist at (0,-120). Far hip (-8,10) → thigh 54 → shin 52 → foot. Near hip (+8,10) uses the same chain. Torso pivots at the waist; its drawing is offset (0,-76). Shoulders at (-24,-55) and (+24,-55) → upper arm 40 → forearm 34 → hand. Head attaches at (0,-92). Helmet follows head; weapon follows rear/far hand; optional shield follows front hand. Shield artwork renders behind the entire body in root space, while its grip follows the front hand every frame. The free front arm renders behind the torso and skirt; the armed rear arm renders in front. Front/rear describe direction toward the opponent, not camera distance. The current catalog and opponents have no shields. See [render order](RENDER_ORDER.md).

`groundedMotion.ts` supplies eight clips: idle, quick, heavy, defend, recover, hit, death and victory. Poses carry root movement, torso/head rotation, hand/ankle targets, wrist angles and a foot-support weight. `kinematics.ts` converts those targets to constrained joint rotations with immutable segment lengths. Soles remain level and the rear foot stays planted through attacks; the front foot lifts, lands and returns. The fall releases support and prevents heel/toe penetration. See [anthropometry](ANTHROPOMETRY.md) for dimensions and references.

`Animator` accepts a clip library, derives its interpolation keys/rest pose from the library, and blends from the last displayed pose on interruption. Shape-preserving cubic Hermite interpolation shares tangents at interior keys, so motion flows through intermediate poses. Direction changes and clip boundaries ease to rest; values remain within their authored interval range. Actual elapsed milliseconds and disabled Phaser delta smoothing keep events aligned on slower renderers. Idle loops; action clips return to idle; death and victory hold their final pose.

Impact frames fire once when crossed, including skipped frames. The presentation layer applies the precomputed combat event then updates HP/stamina and reactions. Completion advances the battle state only after impact and animation completion. `stop()` removes callbacks on scene shutdown. No scene-specific attack timers guess impact timing.

`equipmentMotion.ts` selects a spear-specific clip library for Training Spear and Ashwood War Spear; swords use the standard Ash library. The same event lifecycle and damage calculation apply. Add new motions using local targets, explicit impact frames and reachable support poses. Validate fixed lengths, flexion, foot support, blade/face clearance, interruption and actual rendered joint transforms.

`rendering/limbArt.ts` renders each complete arm/leg as tapered overlapping shapes centered on the actual joints. The full dark silhouette is painted before either skin segment, hiding interior outline rings at elbows and knees. Skin, cuffs and greaves follow the solved bend; no visual stretching changes bone lengths. Both leg branches render below the skirt. Matching background/foreground waist transforms carry the front/free arm behind the torso and the rear/armed arm above it. Both shoulders inherit the same torso rotation. See [rig refinement](RIG_REFINEMENT.md).

## Rear-hand combat and free front hand

`equipmentMotion(weapon, hand = "rear")` composes the action and movement libraries. `rearHandMotion.ts` authors low sword cuts and spear thrusts from the rear shoulder while keeping the front hand relaxed. Damage, impact keys and action durations are unchanged. The original front-hand sword/spear actions remain selectable with `hand = "front"`, without exposing a style selector.

`Gladiator.handMounts.rear/front` and `getHandMount(hand)` expose wrist containers for future shield or second-weapon attachments. Mirroring preserves these identities. Main gear is inserted below the closed palm; the free hand uses a compact curved-finger silhouette with a neutral wrist. An attachment alone does not author a shield-block or dual-wield action. The optional shield branch currently follows the front hand and remains dormant with the shipped catalog.

## Locomotion and stances

`locomotion.ts` adds `idleRelaxed`, `idleCombat`, `walkForward`, `walkBackward`, `run`, `runBackward` and `jump`. Camp and Character start relaxed; Arena starts combat-ready. `idle` resolves to the selected stance, including after an action or jump. Changing stance during a non-idle action takes effect on return.

Walk cycles last 1000 ms at ±60 logical units/second; running cycles last 640 ms at ±120. During stance, each foot moves opposite actor translation at exactly the same speed. The swing foot follows a lifted arc with endpoint tangents matching contact travel, avoiding a velocity snap at toe-off and heel-strike. Walking has 60% contact per leg with double support; running has 35% with flight intervals. Fixed-length IK poses the legs, counter-rotates soles and retains floor contact. Entry/exit blends cover 160–180 ms; initial transition frames intentionally blend toward the new support pattern. Procedural phase sampling preserves excess elapsed time at loop boundaries.

The 1000 ms jump has anticipation, takeoff, folded airborne legs, descent and a bent-knee landing. Foot support is released in flight and restored on landing, with existing sole-floor protection. Completion returns once to the chosen idle. `CampMovement` moves the preview within bounds; this does not change turn-based combat or persistent progression.

In camp: **A/D** walk backward/forward, **Shift+A/D** run, **Space** jumps, **R** changes stance. Touch/mouse buttons demonstrate one movement cycle or toggle stance. Key-down events capture short jump/stance taps even between render frames. Both arm roles remain consistent through all motions.
