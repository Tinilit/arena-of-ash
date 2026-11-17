# Limb attachment, garment overlap and motion continuity

## Guides consulted

- [Synfig Basic Bone Tutorial — Prepare the joints](https://synfig.readthedocs.io/en/latest/quick_start/bones_cutout.html#prepare-the-joints), read through the [official documentation source](https://github.com/synfig/synfig-docs/blob/master/source/quick_start/bones_cutout.rst). It aligns the ends of adjoining pieces to the same circular joint center, avoids redundant outlines at the seam, and places the parent arm bone at the shoulder with children at elbow and wrist. Its leg example applies the same construction to thigh and calf.
- [Unity Two Bone IK documentation](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html), read through the [published-package mirror](https://github.com/needle-mirror/com.unity.animation.rigging/blob/master/Documentation~/constraints/TwoBoneIKConstraint.md). Root/mid/tip form a parent chain, and a bend hint controls the chosen side of the joint. Our analytic IK uses fixed bend signs and limits rather than importing a Unity constraint.
- [SciPy PchipInterpolator notes](https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.PchipInterpolator.html), read in the [documentation embedded in its source](https://github.com/scipy/scipy/blob/main/scipy/interpolate/_cubic.py). Shape-preserving cubic Hermite interpolation keeps a continuous first derivative and avoids interval overshoot by selecting monotone tangents. The game implements the small scalar interpolation rule directly; it has no SciPy dependency.
- [Phaser 3.90 Container API](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/container/Container.js) establishes that subtree/list order controls overlap. Moving a hip pivot to imitate a different drawing layer would change the anatomy unnecessarily.

These are rigging and interpolation references, not a clinical anthropometry claim. Artwork remains the original stylized Ash Vanguard design; no external character assets are copied.

## Attachment contract

The waist remains (0,-120), with hip pivots at (−8,10) and (+8,10) relative to the waist. Both lie inside the garment. The pelvis child order is far leg, near leg, torso, skirt and foreground torso. The skirt therefore covers both thigh roots. Both arms belong to the foreground torso container so they cross in front of the torso and skirt, far arm first and near arm second. That container has the same position and rotation as the anatomical torso.

The torso artwork starts at waist-relative Y = −76. Its shoulder contour is around local X = ±27, Y = 13, so shoulder pivots are now (−27,−63) and (+27,−63) in the waist frame. They are no longer inset toward the middle of the chest. Far and near arms have their own shoulder roots, identical 40/34 segment lengths and consistent elbow bend direction. Mirroring happens at the whole character root, preserving side identity.

Hip/shoulder coordinates are shared with the analytic solver. The renderer uses the hip offset derived from the same waist/hip constants instead of a second magic offset. Existing floor constraints, 54/52 leg lengths, joint limits and weapon/shield hand attachments remain active.

## Elbow and knee artwork

Independent outlines around every bone made two overlapping circles visible at the hinge. A single `LimbArt` graphics object now draws each complete two-bone limb in upper-bone coordinates. Two tapered, joint-centered envelopes form its silhouette. The renderer paints both ink envelopes before either skin envelope, so the skin covers interior borders while the outside remains outlined. A small crease suggests the fold. There is no separate ring or gap at the knee/elbow.

Greaves and cuffs transform with the lower segment's bend. Greaves now follow the full tapered calf width, including both sides, rather than leaving exposed skin beside a narrow front plate. Their lower edges overlap the leather boot shafts. Low, shaped toes and thin soles replace the former rectangular foot blocks while keeping the same Y=14 floor-support plane. The far side uses a slightly darker skin color for depth. Rendering updates only the affected shape as the bend changes, and does not move or scale a bone to hide a seam.

## Temporal continuity

The previous smoothstep reset velocity to zero at every authored key, producing a succession of short eases. Motion now uses a shared weighted-harmonic tangent at monotone interior keys and zero tangents at direction reversals. Cubic Hermite evaluation keeps that velocity continuous through an intermediate pose without overshooting its authored interval. Clip endpoints ease to zero velocity so held poses and idle can settle. Interruption still begins from the last displayed pose; a reaction can intentionally change velocity.

Key times, durations and impact events remain authored exactly as before. The change does not retime combat. Fixed-length IK and face/floor checks sample the resulting curves, rather than assuming a smooth scalar curve proves anatomical correctness.

## Verification

Unit checks cover nonzero continuous speed through a monotone key, interval bounds with irregular timing, turnaround/end behavior, fixed bone lengths, joint limits, foot support and full blade/shaft clearance. Browser checks inspect actual Phaser transforms for both facing directions during motion: hip placement inside the garment, both leg branches below the skirt, both arms above the garment, and shoulders at the torso silhouette. Screenshots include unarmored idle/heavy, equipped spear/helmet, guard, victory and collapse. Production WebGL is reviewed separately from the Canvas gameplay tests.

Shields are temporarily absent from the current catalog and all opponents. The optional rendering/slot support is retained for a later restoration, while the character screen hides inactive slots.
