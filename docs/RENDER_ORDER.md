# Character render order

## Phaser references

This game uses Phaser 3.90.0. The official API documentation embedded in that version's source states that Container children render in their list order and nested Containers render their own children together:

- [Container class description](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/container/Container.js#L20): children render in the order in which they exist within the Container; child depth is less flexible than the Scene display list.
- [Container.addAt](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/container/Container.js#L549) and [sendToBack](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/container/Container.js#L1009): insert at an explicit local index or render below other children in the same Container.
- [Transform.getWorldTransformMatrix](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/components/Transform.js#L500): includes the transforms of parent Containers.

These versioned API references were checked against the installed Phaser source and the published 3.90.0 Container source. The renderers iterate each Container's list recursively. A depth value on a shield nested inside an arm cannot move that shield behind a leg in another subtree. Moving the entire arm above the torso also moves its shield over the torso, creating the unwanted overlap.

## Layer contract

The character root has two rendering branches, in this order:

1. Shield artwork, when equipped.
2. The pelvis/body hierarchy, including both legs, torso, chest armor, head, helmet, arms, hands and weapon.

The shield is the first root child and renders behind every body part, while staying in front of the arena background. Inside the pelvis, draw both legs, the background arm plane, torso/head/chest, skirt, then the foreground arm plane. The free front/near arm lives in `backTorso`; the armed rear/far arm lives in `frontTorso`. Both planes inherit the same waist position and torso rotation. The free arm is camera-far in this authored three-quarter view even though it is toward the opponent. The historical solver names `near`/`far` do not define camera depth.

After posing and positioning the root, `Gladiator.update` reads the front-hand world transform and converts its grip position into root-local coordinates using the inverse root matrix. The optional shield drawing follows that position without inheriting the arm's drawing layer. A zero local shield rotation keeps it upright relative to the root, including during a fall. Shields remain omitted from the default catalog and opponents.

Browser checks inspect the actual background/foreground parents and child order in both facing directions through a heavy attack and guard. Moving an arm to a deeper drawing plane must not move its shoulder or alter its bone lengths. The Godot cutout guide and camera-depth reasoning are linked in [rig refinement](RIG_REFINEMENT.md). Future poses that cross behind/in front of the body can author their own depth transition; there is no per-frame Y sort or automatic promotion based only on weapon ownership.
