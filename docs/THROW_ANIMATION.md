# Throw animation foundation

`throwMotion.ts` supplies a 1700 ms one-shot rear-hand throw with a low backswing. The hand travels behind the rear hip during 16–34%, holds the loaded position through 44%, then swings forward/up through the 62% release. A planted front step and trunk rotation lead delivery. Follow-through decelerates the arm before returning to the selected idle. Arm lengths remain 40/34 and leg lengths 54/52; shoulder attachments and joint limits stay unchanged.

The head stays permanently inside the torso plane. The rear arm is always in the later foreground plane, including preparation, release, follow-through and repeat throws. There is no head-over-arm channel, depth swap or occlusion used to conceal the throwing hand. Mirroring the whole rig preserves this order.

Camp uses T or Throw preview; Character has its own Throw preview button. Repeated preview requests are ignored until completion. The normal weapon is temporarily hidden; a small training prop is shown in the actual hand mount until release, then hidden while an open palm is displayed. No inventory ID is removed, no arena action begins and no projectile or HP effect is created. The existing Animator marker callback fires once even if a frame skips over release. Preview/release states use discrete channels, so a new throw cannot inherit the previous clip's released state through entry blending. Future spear/net/grenade mechanics should subscribe to release and use the actual hand transform, then define projectile physics, ownership and collision independently. The preview prop is not a grenade mechanic.

The backswing uses negative hand X below the shoulder and keeps targets within anatomical shoulder extension. It avoids the former route above/around the head. Tests check the actual hand moving behind the hip, returning forward before release, reachable targets, fixed bones and continuous adjacent IK samples. Rendered browser checks verify stable head/rear-arm depth for every sampled preview frame.

## Guides consulted

- [OpenStax, Types of Body Movements](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/modules/m46398/index.cnxml): elbow extension, shoulder internal/external rotation, and scapular protraction during a throw. The chapter distinguishes forearm pronation from rotation at the shoulder, so weapon/item grip rotation is not used to fake elbow movement.
- [OpenStax, Muscles of the Pectoral Girdle and Upper Limbs](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/modules/m46495/index.cnxml): pectoralis/shoulder rotation in throwing and rotator cuff attachment. This informs the shoulder-driven motion and forearm follow-through while retaining the existing shoulder anchors.
- [Javelin throw kinematics study](https://github.com/nithin-sudarsan/javelin-throw-analysis): whole-body delivery sequences legs, hips and trunk before the arm. Its technique discussion informs sequencing, not the game’s numerical targets or athletic performance claims.
- [Godot AnimationTree, OneShot and filtering](https://github.com/godotengine/godot-docs/blob/master/tutorials/animation/animation_tree.rst): execute once, blend from the current pose, and return to idle. The game uses its own Phaser-independent Animator and marker lifecycle.

This is an authored two-dimensional projection. It does not attempt to reproduce all three-dimensional scapular motion or prescribe clinical throwing angles. Phase timing and hand targets are game tuning; they are not numeric recommendations from the anatomy references. The clip is shared preparation for future thrown objects, not a complete javelin run-up or a working net/grenade system.

Verification samples both hand libraries for reachable fixed-length limbs, joint limits, floor support and one release/completion. Browser checks inspect actual prop/weapon visibility, open/released states, return to relaxed idle and unchanged saved inventory/progression.

The same rear-hand clip is included in both equipment libraries. The head stays behind the rear arm throughout the clip without moving either shoulder. The front weapon remains attached to its own hand. See [melee rules and rear-hand layering](MELEE_COMBAT.md).

## Overarm serve variant

The original `throw` clip remains the underarm throw (T). `throwOverhand` is a separate 1850 ms clip (Y), with one release at 60%. Both are available on Character equipment previews and camp buttons. The overarm motion loads the body, raises the elbow, cocks the forearm beside/behind the head, extends toward a high release, then decelerates forward/down. The elbow is flexed near a right angle in the cocked pose and approaches extension at release. Head depth is unchanged: the throwing arm stays in front for the entire clip.

Additional guide consulted: [SpikeSight volleyball serve analysis](https://github.com/aleung910/spike-sight/blob/main/README.md), including its stance → trophy pose → acceleration → contact → follow-through sequence and measurements of elbow flexion and extension. This is a secondary coaching/analysis project, not a clinical standard; the game's 2D targets and timing are authored. [Volleyball serve motion analysis](https://github.com/jiaxuan1006/Motion-Analysis-System-for-Volleyball-Serve-using-Computer-Vision-Techniques) also tracks shoulder/elbow/wrist phases. No code, API integration or external dependencies from those projects are incorporated.
