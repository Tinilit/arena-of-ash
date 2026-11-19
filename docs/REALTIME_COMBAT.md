# Real-time arena combat

Arena combat supports walking forward/back, running, jumping, independent light hand attacks and a front kick and relaxed/combat stance. Actions and locomotion run together. The old turn-based Battle/AI and precomputed hit rolls have been removed.

## Simulation and contact

`RealtimeBattle` is Phaser-independent. Scene time is accumulated into 120 Hz steps (8.33 ms). The scene accepts at most 100 ms from a rendered frame and clears backlog on focus loss/resume. At each step:

1. Consume player commands and update the AI's movement/action decisions.
2. Advance action/cooldown/reaction and knockdown ages, horizontal position, ballistic jump height and body separation for both fighters.
3. Compose locomotion and upper-body action poses, apply them to the real Gladiator rig, then read its world matrices.
4. Build a capsule for the visible blade/leaf head and articulated body capsules for head, torso, pelvis, arms, hands, thighs, shins and feet.
5. Sweep both moving shapes through the same interval. Apply contact damage once per selected hand swing, then resolve victory/defeat/draw.

Head/torso/limb capsules approximate their drawn silhouettes. They are geometric collision shapes, not per-pixel alpha masks or rigid-body ragdolls. Equipped armor reduces damage through its stats. Shields remain absent from the shipped catalog. Weapon-on-weapon parrying is not implemented.

Light attacks are active during 45–67% of a 1000 ms action, followed by 280 ms cooldown. Each hand can start and recover independently; both may contact in the same step. The front kick deals zero HP damage and is active during 36–56% of 1050 ms with a 350 ms cooldown. Heavy attacks are disabled. Idle weapons, anticipation and recovery never deal damage. The sweep starts fresh when a contact window opens or either fighter flips facing, preventing phantom hits along an inactive/teleported path. Motion sampling uses endpoint travel and the smaller capsule radius; a coarse swept bounds test only rejects clearly separated pairs. It never directly awards damage.

The resolver records the blade and body shape at the actual swept contact sample. Browser tests validate that they intersect and every HP decrement equals new contact events. No random hit/critical roll is used. A miss deals no damage. A confirmed contact always damages; fixed movement speeds do not depend on character attributes. Both lethal contacts in the same step produce a draw; further combat is frozen and rewards are granted once.

## Movement and animation

Horizontal position and jump altitude live in the battle state. Input works during attacks, with 70% horizontal speed during a hand attack and 50% while guarding. A flying kick preserves normal movement speed or a directional hop’s launch impulse; it adds no vertical impulse. A grounded jump cannot be repeated in the air. The free arm stays behind the torso; the rear arm and primary weapon stay in front. Both shoulders retain the same torso transform. The movement cycle supplies legs and passive arm; the action supplies the torso/head and weapon hand. Jumping uses released, folded legs and the simulated altitude, not a visual-only jump followed by ground-level hitboxes.

Fighters face the opponent when free and lock facing through an action or directional hop. Arena bounds and body separation prevent walking through a standing opponent. Running into a wall produces zero actual movement velocity, so the gait stops. The shadow stays on the floor during jumps.

## Controls and lifecycle

A/D or Left/Right move, Shift runs, Space jumps, A/D+Space hops backward/forward relative to facing, LMB/J/1 uses the front hand, RMB/K/2 uses the rear hand, F/3 kicks, and R toggles stance. Escape abandons the fight without a reward. Mouse/touch: hold arrow/Run buttons, tap Jump/attacks. Holding a direction while tapping Jump performs the matching hop; its caption shows the movement kind. Multiple pointers support movement plus actions. Jump/action buttons reflect the relevant movement, recovery and action state. Combat damage and AI stop on outcome. Defeat/draw transition after their short presentation. Victory keeps movement and grounded pickups available until Continue, including settling a lethal projectile onto the floor.

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

Each input explicitly selects the front/left or rear/right hand. An empty selected hand punches. The same selected weapon supplies animation, stats and the damaging capsule. The selected hand alone contributes the weapon bonus/contact; other equipped weapons never add an automatic second hit. Belt throwables use their own attack bonus; Q/E starts the rear-hand belt action. Potions heal once at the sip, without a projectile. Carried belt items do not add passive melee bonuses. See [equipment](EQUIPMENT.md).

See [independent hand collision, pain/stun and kicking](MELEE_COMBAT.md) for action interrupts, recovery locks and the displacement-driven backwards stagger.

## Knockdown and floor transfers

After confirmed boot/body contact, a separate injected random stream gives a 20% chance of knockdown. The threshold is strictly below 0.2. Misses and repeated contact frames do not roll. A 550 ms fall waits for actual ground contact if needed, then a 1000 ms grounded hold precedes an 1800 ms get-up. Movement, actions, guard, stance changes and jumping are locked throughout. Further contacts still deal damage without resetting the transfer. Floor support includes head, torso, skirt, palms, knees and boots; the rendered rig also keeps rotated helmets above the floor and bodies inside arena edges. See [floor transfer animation](KNOCKDOWN_ANIMATION.md).

Combat key commands use physical `KeyboardEvent.code`, with a symbol fallback for older/synthetic events. F works on the Ukrainian layout even when `event.key` is Cyrillic а. Ctrl+hand attack throws that hand weapon. Other Ctrl shortcuts, Alt/Meta shortcuts, repeats and paused input do not queue actions.

## Concurrent hands and random opponents

`handActions` and `handCooldowns` are keyed by front/rear; `bodyAction` and `bodyCooldown` handle kicks/recovery. `action` and `attackCooldown` are aggregate presentation views, never the eligibility lock for a hand. Input queues retain both hand requests from the same rendered frame. Contact sweep histories track each swing ID separately, and all hits are collected before shared pain/stun clears both hands. No idle or inactive hand inherits the other hand's hit window.

Enemy loadouts use a separate seeded stream from AI and kick knockdown. Wins are uncapped; three equipment tiers improve main/offhand weapon pools and helmet/body armor. AI considers each equipped hand's reach and cooldown, allowing overlapping attacks. Shields are absent and bots do not request belt actions, parries, pickups, kicks or forward hops. Rare weapon throws use their own RNG and interval. See [enemy generation](OPPONENTS.md).

## Released items and healing

Actual throws use the overarm clip retimed to 850 ms grounded or 650 ms when started airborne; release is at 60%. Spawn uses the rendered selected wrist, retaining the item’s catalog art and damaging profile. Knives/axes/swords rotate; spears follow velocity. Projectile gravity is 1000 units/s². Each step sweeps the previous/current blade capsule against the opponent’s previous/current body capsules. The owner is excluded; one contact marks the projectile spent and applies normal pain/stun. Landed objects cannot hit. These are capsule approximations, not per-pixel masks.

`consumedItems` records each release/sip once. ArenaScene removes those player IDs from persistent equipment and ownership and saves immediately, before rewards or scene exit. The battle model is a separate copy with matching consumption. G can recover a grounded thrown copy into an empty compatible slot or the backpack; collection immediately saves the new owner and count. Victory remains open until Continue. Unrecovered copies stay lost on defeat, leaving or reload; the shop permits consumable repurchase.

Drinking occupies the rear-hand track for 2100 ms, consumes/heals at 55% and clamps HP to its maximum. A pre-sip interruption retains the potion. Full-health use is rejected. Actual belt use temporarily hides the corresponding waist attachment and rear weapon while showing the held catalog item; the weapon returns during recovery.

## Timed parry

C creates a separate parry state, requiring a held weapon and no active action/stun/knockdown. Its 140 ms window is active immediately; the pose raises the selected weapon, then recovers through the 450 ms action. A further 750 ms cooldown prevents repeat spam. Input repeats cannot restart the timer. An interruption retains the remaining cooldown.

The resolver first gathers the same actual swept melee contacts used for damage. A frontal weapon/fist contact inside the window is marked `parried`, deals zero damage, and cancels both attacker hand tracks before applying 1000 ms stun. A confirmed success automatically extends the other open hand; 150 ms later it applies one 500 units/s shove with normal 600 units/s² friction. The 420 ms counter motion finishes before recovery. The shove adds no HP damage or knockdown and cannot reroll on repeated contact frames. Simultaneous hands are deflected together. Misses, late contacts, rear contacts, kicks and projectiles are not parried. Other hits cannot shorten the existing parry stun. No continuous player guard or energy resource is added.

## Counts, collection and aftermath

`domain/inventory.ts` separates total copies, equipped copies and available backpack copies. Slots always hold one copy. `consumedItems` includes the exact source slot; using belt1 cannot delete an identical item in belt2. No battle slot reloads from reserves.

G selects the nearest landed projectile within an 85-unit pickup reach of its grip/blade span. The collector must be alive, grounded and free of action/stun/knockdown. Airborne/spent/expired/already-collected projectiles cannot be collected. One transition to `pickedUp` adds one copy and records its collector/target slot in `collectedItems`. Original empty compatible slots are preferred; occupied equipment is preserved and a full loadout receives the item in its backpack. Scene cursors mirror consumption and collection to the persistent player exactly once. `ArenaMotion` refreshes hand animation libraries when a collected weapon changes sword/spear type.

`advanceAftermath` settles projectiles and moves the winner without further combat contacts. Continue opens ResultScene. This lets a lethal thrown item land and be recovered before the next match. Rewards remain idempotent and are granted on the original outcome, not on collection or Continue.

## Reactive backsteps and coupled grabs

Enemy backsteps use their own injected RNG. A grounded idle enemy notices each quick/kick action once between 120 ms and 45% of its duration, within weapon reach plus an approach margin. With at least 90 units behind, a 35% roll starts a regular backstep and a 2200 ms decision cooldown. There is no invulnerability; rendered weapons can still connect. Bots cannot forward-hop.

`combat/grapples.ts` owns a single coupled grab. H requires both actors grounded, alive and within 105 units; the lifter must be free of actions and pain. After 420 ms anticipation it rechecks range and captures the target, cancelling its actions. Moving out of reach or interrupting the lifter cancels capture. The 1000 ms lift translates and rotates the opponent above the lifter; both actors are locked until release, with the normal separator temporarily disabled. A second H queues the throw, including during anticipation/lifting. Hold otherwise waits for the command. Release at 170 ms starts a constrained ballistic flight (360 horizontal, 280 upward, normal arena gravity); the 480 ms lifter motion then finishes. Landing transfers to the existing grounded hold and heavy get-up. No HP damage, item consumption or random knockdown roll occurs. Leaving the fight cancels the hold.

`grappleMotion.ts` layers fixed-length IK hands and a horizontal carried-body pose over the pure state. `shootMotion.ts` provides separate harmless crossbow/rifle previews with two-handed aiming, one shot marker, recoil and controlled lowering; `rangedPreview.ts` draws their temporary props. Camp U/I and Character buttons expose them without changing catalog or combat.
