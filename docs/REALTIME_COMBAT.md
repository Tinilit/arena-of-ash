# Real-time arena combat

Arena combat supports walking forward/back, running, jumping, independent light hand attacks and a front kick and relaxed/combat stance. Actions and locomotion run together. The old turn-based Battle/AI and precomputed hit rolls have been removed.

## Simulation and contact

`RealtimeBattle` is Phaser-independent. Scene time is accumulated into 120 Hz steps (8.33 ms). The scene accepts at most 100 ms from a rendered frame and clears backlog on focus loss/resume. At each step:

1. Consume player commands and update the AI's movement/action decisions.
2. Advance action/cooldown/reaction and knockdown ages, horizontal position, ballistic jump height and body separation for both fighters.
3. Compose locomotion and upper-body action poses, apply them to the real Gladiator rig, then read its world matrices.
4. Build a capsule for the visible blade/leaf head and articulated body capsules for head, torso, pelvis, arms, hands, thighs, shins and feet.
5. Sweep both moving shapes through the same interval. Apply contact damage once per swing, then resolve victory/defeat/draw.

Head/torso/limb capsules approximate their drawn silhouettes. They are geometric collision shapes, not per-pixel alpha masks or rigid-body ragdolls. Equipped armor reduces damage through its stats. Shields remain absent from the shipped catalog. Weapon-on-weapon parrying is not implemented.

Light attacks are active during 45–67% of a 1000 ms action, followed by 280 ms cooldown. The front kick is active during 36–56% of 1050 ms with a 350 ms cooldown. Heavy attacks are disabled. Idle weapons, anticipation and recovery never deal damage. The sweep starts fresh when a contact window opens or either fighter flips facing, preventing phantom hits along an inactive/teleported path. Motion sampling uses endpoint travel and the smaller capsule radius; a coarse swept bounds test only rejects clearly separated pairs. It never directly awards damage.

The resolver records the blade and body shape at the actual swept contact sample. Browser tests validate that they intersect and every HP decrement equals new contact events. No random hit/critical roll is used. A miss deals no damage. A confirmed contact always damages; fixed movement speeds do not depend on character attributes. Both lethal contacts in the same step produce a draw; further combat is frozen and rewards are granted once.

## Movement and animation

Horizontal position and jump altitude live in the battle state. Input works during attacks, with 70% horizontal speed during a hand attack and 50% while guarding. A flying kick preserves normal movement speed or a directional hop’s launch impulse; it adds no vertical impulse. A grounded jump cannot be repeated in the air. The free arm stays behind the torso; the rear arm and primary weapon stay in front. Both shoulders retain the same torso transform. The movement cycle supplies legs and passive arm; the action supplies the torso/head and weapon hand. Jumping uses released, folded legs and the simulated altitude, not a visual-only jump followed by ground-level hitboxes.

Fighters face the opponent when free and lock facing through an action or directional hop. Arena bounds and body separation prevent walking through a standing opponent. Running into a wall produces zero actual movement velocity, so the gait stops. The shadow stays on the floor during jumps.

## Controls and lifecycle

A/D or Left/Right move, Shift runs, Space jumps, A/D+Space hops backward/forward relative to facing, LMB/J/1 uses the front hand, RMB/K/2 uses the rear hand, F/3 kicks, and R toggles stance. Escape abandons the fight without a reward. Mouse/touch: hold arrow/Run buttons, tap Jump/attacks. Holding a direction while tapping Jump performs the matching hop; its caption shows the movement kind. Multiple pointers support movement plus actions. Jump/action buttons reflect the relevant movement, recovery and action state. Movement, input and combat stop on outcome; a short death/victory presentation precedes ResultScene.

Losing focus pauses simulation, clears queued/held input and discards backlog. Shutdown removes focus, keyboard and pointer listeners. Restarting the scene creates fresh HP/action/contact state. Read-only development snapshots include fighter motion, composed rigs, collision geometry and recent contacts; production exposes no diagnostic API. `?hitboxes=1` draws shapes only in development.

Custom weapon art can declare a capsule in catalog JSON; see [runtime content](RUNTIME_CONTENT.md). Future dual-wield, shield blocking or new poses need explicit geometry and action rules rather than a distance-only damage shortcut.

## Player-only directional hops

A direction held when Space is pressed selects a backstep (away from the opponent) or forward hop (toward the opponent). With the initial right-facing player these are A+Space and D+Space. Left-facing controls mirror by direction; the motion kind is relative to facing. Space alone keeps the higher vertical jump. Both directions held cancel into a vertical jump. Movement at the time of the key press is captured, so releasing the direction does not cancel the impulse.

`hops.ts` defines anticipation, launch velocity, horizontal impulse, landing and cooldown. Backstep: 60 ms anticipation, 280 units/s horizontal speed, 260 units/s upward launch, 100 ms landing. Forward hop: 75 ms anticipation, 270 units/s horizontal speed, 340 units/s upward launch, 110 ms landing. Both use the normal 1350 units/s² gravity and a 180 ms post-landing cooldown. The resulting unobstructed travel is about 108/136 units with 25/43 units of altitude. These are game tuning values, not numbers prescribed by a guide.

Only a living, grounded player without stun, knockdown, a current hop or cooldown can start one. Anticipation and landing stop horizontal input; flight preserves the launch direction, respects walls and body separation, and cannot retrigger in the air. Bots cannot request these hops, even through the core API; their pre-existing ordinary jumps remain. A hop never starts a swing or awards invulnerability. Physical contact still damages the player. A separately requested attack may overlap the hop using the existing blade-contact rules.

`hopPose.ts` compresses planted knees, folds/re-extends the legs smoothly around takeoff/touchdown, and absorbs the landing. Actual world altitude comes from the simulation, not an extra vertical animation offset. The same rendered transforms feed collision geometry.

References consulted: [Godot CharacterBody2D platformer example](https://docs.godotengine.org/en/stable/tutorials/physics/using_character_body_2d.html) for delta-scaled gravity, a grounded launch impulse and landing reset; [Game Programming Patterns: State](https://gameprogrammingpatterns.com/state.html) for explicit movement phases and preventing invalid airborne transitions. The implementation remains Phaser-independent and does not import either engine's controller.

## Fixed baselines and active hands

Every fighter has 100 health and base unarmed attack 12. Equipment supplies attack and armor bonuses. There are no attributes, levels, XP or energy/stamina resource. Attack, hop and jump eligibility depends on physical state, stun and cooldowns. Player Defense/Recover controls remain absent; the AI can guard without energy costs.

Each input explicitly selects the front/left or rear/right hand. An empty selected hand punches. The same selected weapon supplies animation, stats and the damaging capsule. The selected hand alone contributes the weapon bonus/contact; other equipped weapons never add an automatic second hit. Belt attachments have no usable action, damage or stat effect yet. See [equipment](EQUIPMENT.md).

See [independent hand collision, pain/stun and kicking](MELEE_COMBAT.md) for action interrupts, recovery locks and the displacement-driven backwards stagger.

## Knockdown and floor transfers

After confirmed boot/body contact, a separate injected random stream gives a 20% chance of knockdown. The threshold is strictly below 0.2. Misses and repeated contact frames do not roll. A 550 ms fall waits for actual ground contact if needed, then a 1000 ms grounded hold precedes an 1800 ms get-up. Movement, actions, guard, stance changes and jumping are locked throughout. Further contacts still deal damage without resetting the transfer. Floor support includes head, torso, skirt, palms, knees and boots; the rendered rig also keeps rotated helmets above the floor and bodies inside arena edges. See [floor transfer animation](KNOCKDOWN_ANIMATION.md).

Combat key commands use physical `KeyboardEvent.code`, with a symbol fallback for older/synthetic events. F works on the Ukrainian layout even when `event.key` is Cyrillic а. Ctrl/Alt/Meta shortcuts, repeats and paused input do not queue attacks.
