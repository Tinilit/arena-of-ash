# Equipment-only combat and floor transfer verification — 2026-11-18

This release removes attributes, levels, XP and energy from models, saves and UI. Combat uses fixed health/attack baselines plus active equipment. It lowers the ready hilt with a slightly upward rear blade, fixes physical F for Ukrainian layouts, gives real kick contacts a 20% knockdown chance with a one-second grounded hold and slow supported get-up, and replaces the throwing path with a continuous overarm arc.

## Validation

| Check               | Result                     |
| ------------------- | -------------------------- |
| TypeScript / ESLint | Passed                     |
| Unit tests          | 175 across 12 files        |
| Browser scenarios   | 30                         |
| Production build    | `/arena-of-ash/` base path |

New pure cases cover the exact probability boundary, no RNG draw on a miss/repeated contact, airborne ground entry, full grounded duration, locked controls, additional damage without restarting recovery, fixed bone lengths and full-body floor clearance. They check combat/relaxed blade directions, adjacent throwing IK samples, both loadouts on get-up exit, fixed combat baselines and version 2 save import. Existing geometry, inventory, persistence and anatomy cases remain.

New browser cases exercise physical KeyF with a Cyrillic key value, ignored modified shortcuts, absent leveling/energy fields, a seeded physical kick contact, the entire grounded hold and the rendered get-up. Existing tests use light attacks in place of the disabled heavy control and observe actual movement rather than a fixed delay when hit reactions can interrupt it. Large-display Canvas/WebGL, Retina, native 4K, fractional density and logical pointer targeting remain covered.

Screenshots include `mouse-rear-hand-light-attack.png`, `after-front-kick-stagger.png`, `backpack-all-unequipped-items.png` and preserved art/contact/loadout captures. Local pose reviews also inspect the bent elbow/hand behind the head and the extended front kick with sole facing the opponent. Body/strike capsules approximate the visible drawing; they are not alpha masks or a ragdoll simulation.

## Controls and scope

LMB/J/1: front hand. RMB/K/2: rear hand. F/3: grounded front kick. A/D/arrows, Shift, Space, direction+Space and R retain locomotion/stance behavior. Heavy actions are rejected in the rules layer and are absent from UI/AI. Both hands use their own geometry, while one global action and cooldown prevent alternating-button spam. Empty selected hands punch; the other weapon is never substituted.

Normal hits interrupt with 180 ms stun and a 280 ms pain response. Kicks apply 350 ms stun, an 850 ms balance recovery and a constrained impulse of roughly 210 pixels in free space. Energy and leveling fields are absent. Knockdown tests cover the exact 20% threshold, no roll on a miss, input locks, one-second ground hold, heavy get-up, floor support and continuous throwing IK. Pain/stagger uses actual body state and articulated joint transforms.

Camp T / Throw and Character Throw preview always use the rear hand. The hand coils above the rear shoulder on a continuous IK branch, releases once and returns; the head temporarily occludes the arm without moving its shoulder frame. Throwing remains an animation foundation with no projectile or item consumption. Belt items remain inactive. The inventory view derives its backpack by subtracting equipped IDs from owned IDs, preserving save/unequip behavior and all item categories.

See [melee rules](MELEE_COMBAT.md), [throw references](THROW_ANIMATION.md), [equipment](EQUIPMENT.md) and [runtime content](RUNTIME_CONTENT.md). Save version 3 removes leveling/attributes while importing valid coins, equipment and ownership from version 2.

## Publication

The public site is https://tinilit.github.io/arena-of-ash/. A successful `Validate and deploy game` run must match the pushed commit. Verify that its served JavaScript path and SHA-256 match the local Pages build. Production exposes no development snapshot API. Cloud environment publication and Pages deployment are separate operations.
