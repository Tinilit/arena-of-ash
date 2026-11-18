# Ash Vanguard animation

The game has one art direction and one Grounded rig. Root origin is the floor; logical coordinates use +X toward the opponent, +Y down and clockwise radians. Enemy mirroring occurs at the whole root, with mirrored root displacement/rotation. Do not mirror individual knee/elbow signs.

Root → pelvis/waist at (0,-120). Far hip (-8,10) → thigh 54 → shin 52 → foot. Near hip (+8,10) uses the same chain. Torso pivots at the waist; its drawing is offset (0,-76). Shoulders at (-24,-55) and (+24,-55) → upper arm 40 → forearm 34 → hand. Head attaches at (0,-92). Helmet follows head; weapon follows the active hand (right/rear by default); optional shield follows front hand. Shield fallback art is retained, but no shield equipment position is currently exposed. The free front arm renders behind the torso and skirt; the armed rear arm renders in front. Front/rear describe direction toward the opponent, not camera distance. The current catalog and opponents have no shields. See [render order](RENDER_ORDER.md).

`groundedMotion.ts` supplies eight clips: idle, quick, heavy, defend, recover, hit, death and victory. Poses carry root movement, torso/head rotation, hand/ankle targets, wrist angles and a foot-support weight. `kinematics.ts` converts those targets to constrained joint rotations with immutable segment lengths. Soles remain level and the rear foot stays planted through attacks; the front foot lifts, lands and returns. The fall releases support and prevents heel/toe penetration. See [anthropometry](ANTHROPOMETRY.md) for dimensions and references.

`Animator` accepts a clip library, derives its interpolation keys/rest pose from the library, and blends from the last displayed pose on interruption. Shape-preserving cubic Hermite interpolation shares tangents at interior keys, so motion flows through intermediate poses. Direction changes and clip boundaries ease to rest; values remain within their authored interval range. Actual elapsed milliseconds and disabled Phaser delta smoothing keep events aligned on slower renderers. Idle loops; action clips return to idle; death and victory hold their final pose.

Authored impact markers still fire once when crossed, including skipped frames, but Arena damage does not subscribe to them. Arena uses fixed-step active contact windows and actual blade/body geometry. Animation completion alone never changes HP. `stop()` removes callbacks on scene shutdown. See [real-time combat](REALTIME_COMBAT.md).

`equipmentMotion.ts` selects a spear-specific clip library for Training Spear and Ashwood War Spear; swords use the standard Ash library. The same event lifecycle and damage calculation apply. Add new motions using local targets, explicit impact frames and reachable support poses. Validate fixed lengths, flexion, foot support, blade/face clearance, interruption and actual rendered joint transforms.

`rendering/limbArt.ts` renders each complete arm/leg as tapered overlapping shapes centered on the actual joints. The full dark silhouette is painted before either skin segment, hiding interior outline rings at elbows and knees. Skin, cuffs and greaves follow the solved bend; no visual stretching changes bone lengths. Both leg branches render below the skirt. Matching background/foreground waist transforms carry the front/free arm behind the torso and the rear/armed arm above it. Both shoulders inherit the same torso rotation. See [rig refinement](RIG_REFINEMENT.md).

## Rear-hand combat and free front hand

`equipmentMotion(weapon, hand = "rear")` composes the action and movement libraries. `rearHandMotion.ts` authors low sword cuts and spear thrusts from the rear shoulder while keeping the front hand relaxed. Damage, impact keys and action durations are unchanged. The original front-hand sword/spear actions remain selectable with `hand = "front"`, without exposing a style selector.

`Gladiator.handMounts.rear/front` and `getHandMount(hand)` expose wrist containers for future shield or second-weapon attachments. Mirroring preserves these identities. Main gear is inserted below the closed palm; the free hand uses a compact curved-finger silhouette with a neutral wrist. An attachment alone does not author a shield-block or dual-wield action. Hand mounts also carry the second weapon; the belt mounts follow the pelvis.

## Locomotion and stances

`locomotion.ts` adds `idleRelaxed`, `idleCombat`, `walkForward`, `walkBackward`, `run`, `runBackward` and `jump`. Camp and Character start relaxed; Arena starts combat-ready. `idle` resolves to the selected stance, including after an action or jump. Changing stance during a non-idle action takes effect on return.

Walk cycles last 1000 ms at ±60 logical units/second; running cycles last 640 ms at ±120. During stance, each foot moves opposite actor translation at exactly the same speed. The swing foot follows a lifted arc with endpoint tangents matching contact travel, avoiding a velocity snap at toe-off and heel-strike. Walking has 60% contact per leg with double support; running has 35% with flight intervals. Fixed-length IK poses the legs, counter-rotates soles and retains floor contact. Stance and gait entry/exit blends cover 300 ms; initial transition frames intentionally blend toward the new support pattern. Procedural phase sampling preserves excess elapsed time at loop boundaries.

The 1000 ms jump has anticipation, takeoff, folded airborne legs, descent and a bent-knee landing. Foot support is released in flight and restored on landing, with existing sole-floor protection. Completion returns once to the chosen idle. `CampMovement` moves the preview within bounds; this does not deal damage or change persistent progression.

In camp: **A/D** walk backward/forward, **Shift+A/D** run, **Space** jumps, **R** changes stance. Touch/mouse buttons demonstrate one movement cycle or toggle stance. Key-down events capture short jump/stance taps even between render frames. Both arm roles remain consistent through all motions.

## Arena composition

`ArenaMotion` samples the movement cycle at a speed proportional to actual horizontal velocity, so planted travel still matches actor movement. Locomotion supplies the legs/root and free arm; light weapon/punch actions supply the torso, head and selected hand. An attack never replaces a running or airborne lower-body pose. Jump height comes from `RealtimeBattle` gravity; the rig releases foot support and folds its legs without adding the camp jump's vertical root track a second time. Landing uses a short knee compression. Facing follows the opponent outside an action and remains locked during a swing.

Light attacks last 1000 ms with 45–67% contact and 280 ms cooldown. Heavy actions remain dormant. Kicks last 1050 ms with 36–56% boot contact, dorsiflexed foot and planted support leg. Anticipation/recovery contacts and orientation flips are never swept into active damage. Physical contact flashes the defender and places damage text at the contact point. No critical/accuracy roll substitutes for collision.

Death/victory playback is primed from the last displayed composite pose before switching back to the rig animator. A running or airborne actor therefore does not snap to an old idle before falling.

## Upright relaxed stance and carried weapons

Relaxed idle has a vertical torso/root, feet at ±14, and approximately 0.06 radians of knee flexion (no hyperextension). Root height is solved from the immutable 54/52 leg lengths and the ankle support plane. Breathing does not bob the hips and bend the otherwise straight legs. Both feet remain planted. Combat idle retains its wider, bent-knee ready stance.

The rear hand hangs beside the body with a neutral wrist. A separate `weaponGrip` rotates the weapon inside its wrist mount so the blade points forward and down without forcing the anatomical wrist beyond its limit. The renderer and collision geometry use this same transform. Stance/gait transitions stage weapon rotation and hand movement: lower the hand before turning into carry, and turn below the face before lifting to ready. `Animator.blendRanges` provides per-channel timing within the 300 ms transition. Arena attacks/guard similarly prepare a carried weapon before raising the hand, while retaining the authored contact-window timing.

The posture references are [OpenStax Anatomical Terminology](https://openstax.org/books/anatomy-and-physiology-2e/pages/1-6-anatomical-terminology), checked against its [chapter source](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/modules/m45990/index.cnxml), and [Types of Body Movements](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements), checked against its [source](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/modules/m46398/index.cnxml). Upright alignment, parallel planted feet and knee extension inform the stylized neutral pose. This is a relaxed side-view carry pose, not a literal palms-forward anatomical illustration.

Arena directional hops use explicit anticipation/air/landing phases, with folded-leg blending around launch and touchdown. See [hop physics, controls and references](REALTIME_COMBAT.md#player-only-directional-hops). Bots retain their existing locomotion library without gaining the player hop commands.

## Throw preview and anatomical equipment

Both equipment motion libraries include the shared one-shot throw clip and a single release marker. The current preview temporarily substitutes a harmless training prop and opens the palm after release; the real weapon returns during recovery. See [throw motion, guides and future projectile hook](THROW_ANIMATION.md). Equipment positions are described in [equipment](EQUIPMENT.md). Each front/rear input selects its own library and real hand transform; an empty selected hand punches. Both equipment libraries share a rear-only throw.

Pain is a short interrupted-action overlay. Kick stagger uses an 800 ms backwards step cycle at 200 units/second, with phase driven by actual push displacement and planted support. See [melee composition](MELEE_COMBAT.md).
