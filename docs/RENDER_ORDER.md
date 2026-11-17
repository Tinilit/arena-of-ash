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

The shield is the first root child and therefore renders behind every body part, while staying in front of the arena background. The far arm keeps its normal position behind the torso. No tower-specific promotion of the arm or per-frame depth sorting is used. Both procedural shields and runtime image-backed shields use this policy.

The hand remains part of the articulated skeleton. After posing and positioning the root, `Gladiator.update` reads the actual far-hand world transform and converts its grip position into root-local coordinates using the inverse root matrix. The separate shield drawing is placed at that position. This keeps the grip aligned through facing changes, scale, body movement and rotation without inheriting the arm's rendering position. A zero local shield rotation preserves its upright orientation relative to the root, including the body's fall rotation. The initial pose is applied before the first render.

Browser coverage measures both facing directions through a heavy attack and guard. It checks the actual shield parent/order and world grip against the actual Phaser hand, rather than only comparing authored coordinates. Screenshots cover Character, both arena fighters and guard. Gameplay and inventory rules do not change.
