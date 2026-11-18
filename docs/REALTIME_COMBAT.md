# Real-time arena combat

Arena combat supports walking forward/back, running, jumping, quick/heavy attacks, guard, recovery and relaxed/combat stance. Actions and locomotion run together. The old turn-based Battle/AI and precomputed hit rolls have been removed.

## Simulation and contact

`RealtimeBattle` is Phaser-independent. Scene time is accumulated into 120 Hz steps (8.33 ms). The scene accepts at most 100 ms from a rendered frame and clears backlog on focus loss/resume. At each step:

1. Consume player commands and update the AI's movement/action decisions.
2. Advance stamina, action ages, horizontal position, ballistic jump height and body separation for both fighters.
3. Compose locomotion and upper-body action poses, apply them to the real Gladiator rig, then read its world matrices.
4. Build a capsule for the visible blade/leaf head and articulated body capsules for head, torso, pelvis, arms, hands, thighs, shins and feet.
5. Sweep both moving shapes through the same interval. Apply contact damage once per swing, then resolve victory/defeat/draw.

Head/torso/limb capsules approximate their drawn silhouettes. They are geometric collision shapes, not per-pixel alpha masks or rigid-body ragdolls. Equipped armor reduces damage through its stats. Shields remain absent from the shipped catalog. Weapon-on-weapon parrying is not implemented.

Quick/heavy are active during 30–70% / 46–80% of their 650/1100 ms animations. Idle weapons, anticipation and recovery never deal damage. The sweep starts fresh when a contact window opens or either fighter flips facing, preventing phantom hits along an inactive/teleported path. Motion sampling uses endpoint travel and the smaller capsule radius; a coarse swept bounds test only rejects clearly separated pairs. It never directly awards damage.

The resolver records the blade and body shape at the actual swept contact sample. Browser tests validate that they intersect and every HP decrement equals new contact events. No random hit/critical roll is used. A miss spends attack stamina. A confirmed contact damages even a target with high agility; agility instead changes movement speed. Both lethal contacts in the same step produce a draw; further combat is frozen and rewards are granted once.

## Movement and animation

Horizontal position and jump altitude live in the battle state. Input works during attacks, with 70% horizontal speed during an action and 50% while guarding. A grounded jump costs stamina and cannot be repeated in the air. The free arm stays behind the torso; the rear arm and primary weapon stay in front. Both shoulders retain the same torso transform. The movement cycle supplies legs and passive arm; the action supplies the torso/head and weapon hand. Jumping uses released, folded legs and the simulated altitude, not a visual-only jump followed by ground-level hitboxes.

Fighters face the opponent when free and lock facing through an action. Arena bounds and body separation prevent walking through a standing opponent. Running into a wall produces zero actual movement velocity, so the gait stops. The shadow stays on the floor during jumps.

## Controls and lifecycle

A/D or Left/Right move, Shift runs, Space jumps, J/1 quick-attacks, K/2 heavy-attacks, L/3 holds guard, F/4 recovers, and R toggles stance. Escape abandons the fight without a reward. Mouse/touch: hold arrow/Run buttons, tap Jump/attacks and toggle Defend. Multiple pointers support movement plus actions. Jump/action buttons reflect affordability and action state. Movement, input and combat stop on outcome; a short death/victory presentation precedes ResultScene.

Losing focus pauses simulation, clears queued/held input and discards backlog. Shutdown removes focus, keyboard and pointer listeners. Restarting the scene creates fresh HP/stamina/action/contact state. Read-only development snapshots include fighter motion, composed rigs, collision geometry and recent contacts; production exposes no diagnostic API. `?hitboxes=1` draws shapes only in development.

Custom weapon art can declare a capsule in catalog JSON; see [runtime content](RUNTIME_CONTENT.md). Future dual-wield, shield blocking or new poses need explicit geometry and action rules rather than a distance-only damage shortcut.
