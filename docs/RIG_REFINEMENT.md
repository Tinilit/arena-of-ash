# Limb attachment, garment overlap and motion continuity

## Guides consulted

- [Synfig Basic Bone Tutorial — Prepare the joints](https://synfig.readthedocs.io/en/latest/quick_start/bones_cutout.html#prepare-the-joints), read through the [official documentation source](https://github.com/synfig/synfig-docs/blob/master/source/quick_start/bones_cutout.rst). It aligns the ends of adjoining pieces to the same circular joint center, avoids redundant outlines at the seam, and places the parent arm bone at the shoulder with children at elbow and wrist. Its leg example applies the same construction to thigh and calf.
- [Unity Two Bone IK documentation](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html), read through the [published-package mirror](https://github.com/needle-mirror/com.unity.animation.rigging/blob/master/Documentation~/constraints/TwoBoneIKConstraint.md). Root/mid/tip form a parent chain, and a bend hint controls the chosen side of the joint. Our analytic IK uses fixed bend signs and limits rather than importing a Unity constraint.
- [SciPy PchipInterpolator notes](https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.PchipInterpolator.html), read in the [documentation embedded in its source](https://github.com/scipy/scipy/blob/main/scipy/interpolate/_cubic.py). Shape-preserving cubic Hermite interpolation keeps a continuous first derivative and avoids interval overshoot by selecting monotone tangents. The game implements the small scalar interpolation rule directly; it has no SciPy dependency.
- [Phaser 3.90 Container API](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/container/Container.js) establishes that subtree/list order controls overlap. Moving a hip pivot to imitate a different drawing layer would change the anatomy unnecessarily.
- [OpenStax Anatomy and Physiology 2e — Pectoral Girdle](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-1-the-pectoral-girdle) and [shoulder-joint](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/media/914_Shoulder_Joint.jpg) / [humerus-muscle illustrations](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/media/1119_Muscles_that_Move_the_Humerus.jpg), checked against the [OpenStax source](https://github.com/openstax/osbooks-anatomy-physiology). The clavicle/acromion lead to the shoulder socket and the deltoid covers the humeral head. These inform the visible neck, sloping shoulder and concealed arm-root seam.
- [Godot cutout animation guide](https://docs.godotengine.org/en/stable/tutorials/animation/cutout_animation.html): place pivots at joints and use a parent hierarchy, independent of sprite bounds. The game keeps Phaser containers and its own IK.

These references inform the stylized rig and its joint silhouettes. Artwork remains the original Ash Vanguard design; no external character assets are copied.

## Attachment contract

The waist remains (0,-120), with hip pivots at (−8,10) and (+8,10) relative to the waist. Both lie inside the garment. The pelvis child order is far leg, near leg, background arm plane, torso, skirt and foreground arm plane. The skirt therefore covers both thigh roots. The free front arm belongs to the background plane; the armed rear arm belongs to the foreground plane. Both planes have the same position and rotation as the anatomical torso.

The torso artwork starts at waist-relative Y = −76. Shoulder pivots are (−24,−55) and (+24,−55) in the waist frame, beneath the sloping clavicle/deltoid contour. A narrow neck joins the head at Y = −92. The humeral head belongs beneath the acromion, inside the deltoid, rather than at the jaw. The arm root covers the torso seam; only its exposed outer arc is outlined, avoiding a separate circular socket. Far and near arms have their own shoulder roots, identical 40/34 segment lengths and consistent elbow bend direction. Mirroring happens at the whole character root, preserving side identity.

Hip/shoulder coordinates are shared with the analytic solver. The renderer uses the hip offset derived from the same waist/hip constants instead of a second magic offset. Existing floor constraints, 54/52 leg lengths, joint limits and weapon/shield hand attachments remain active.

## Elbow and knee artwork

Independent outlines around every bone made two overlapping circles visible at the hinge. A single `LimbArt` graphics object now draws each complete two-bone limb in upper-bone coordinates. Two tapered, joint-centered envelopes form its silhouette. The renderer paints both ink envelopes before either skin envelope, so the skin covers interior borders while the outside remains outlined. A small crease suggests the fold. There is no separate ring or gap at the knee/elbow.

Greaves and cuffs transform with the lower segment's bend. Greaves now follow the full tapered calf width, including both sides, rather than leaving exposed skin beside a narrow front plate. Their lower edges overlap the leather boot shafts. Low, shaped toes and thin soles replace the former rectangular foot blocks while keeping the same Y=14 floor-support plane. The far side uses a slightly darker skin color for depth. Rendering updates only the affected shape as the bend changes, and does not move or scale a bone to hide a seam.

## Temporal continuity

The previous smoothstep reset velocity to zero at every authored key, producing a succession of short eases. Motion now uses a shared weighted-harmonic tangent at monotone interior keys and zero tangents at direction reversals. Cubic Hermite evaluation keeps that velocity continuous through an intermediate pose without overshooting its authored interval. Clip endpoints ease to zero velocity so held poses and idle can settle. Interruption still begins from the last displayed pose; a reaction can intentionally change velocity.

Key times, durations and impact events remain authored exactly as before. The change does not retime combat. Fixed-length IK and face/floor checks sample the resulting curves, rather than assuming a smooth scalar curve proves anatomical correctness.

## Verification

Unit checks cover nonzero continuous speed through a monotone key, interval bounds with irregular timing, turnaround/end behavior, fixed bone lengths, joint limits, foot support and full blade/shaft clearance. Browser checks inspect actual Phaser transforms for both facing directions during motion: hip placement inside the garment, both leg branches below the skirt, the free front arm behind the torso and the rear arm above it, and shoulders at the torso silhouette. Screenshots include unarmored idle/heavy, equipped spear/helmet, guard, victory and collapse. Production WebGL is reviewed separately from the Canvas gameplay tests.

Shields are temporarily absent from the current catalog and all opponents. The optional rendering/slot support is retained for a later restoration, while the character screen hides inactive slots.

## Free arm and hand

The [OpenStax upper-limb anatomy chapter source](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/modules/m46495/index.cnxml), [forearm muscle plate](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/media/1120_Muscles_that_Move_the_Forearm.jpg) and [hand/wrist skeleton](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/media/806_Hand_and_Wrist.jpg) were inspected for elbow flexion, the forearm's muscle-to-tendon taper, wrist continuity and separate palm/finger/thumb structure.

The previous free arm nearly straightened into a flat extended hand. The new authored rest target (14,69) gives a soft elbow bend, while the wrist stays within two degrees of the forearm. The relaxed side-view hand has a palm arch, curved finger cascade and a distinct thumb. Its 20-unit silhouette replaces the long straight finger extensions. Forearm skin widens below the elbow before tapering into a narrower cuff/wrist. These are stylized pose choices informed by the reference structure, not prescribed clinical rest angles.

Walking swings the upper arm with a stable, softly flexed elbow; running increases the shoulder swing and bends the elbow to about 66 degrees. It does not pull a nearly straight arm back and forth by the wrist. The active weapon remains in the rear hand and the free-hand attachment stays at the actual wrist.

## Camera depth versus front/rear names

The Godot guide's [depth-ordering example](https://docs.godotengine.org/en/stable/tutorials/animation/cutout_animation.html#remote-transform2d-node) and [completed rig illustration](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/animation/img/tuto_cutout10.png) separate drawing order from shoulder inheritance. The camera-far arm belongs behind the torso while retaining the torso's motion; an arm passing in front of the chest belongs in the foreground. The guide also describes changing depth for poses that cross behind/in front of the body, rather than sorting by a limb's name.

In our authored three-quarter pose, the free arm toward the opponent is on the camera-far side. It draws behind the torso/chest/skirt; the rear shoulder's armed chain crosses the chest in front. `backTorso` and `frontTorso` carry the same torso rotation, so changing depth never moves a shoulder. The existing `near*`/`far*` solver identifiers are historical: the public hand roles are `front`/`rear` and do not mean camera distance. Whole-root mirroring preserves this depth order. Future front-hand or dual-wield poses may need authored depth changes when crossing the body; attaching an item does not automatically change camera depth.
