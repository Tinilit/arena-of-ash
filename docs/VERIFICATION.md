# Independent-hand melee verification — 2026-11-18

This release maps LMB/J to the front hand and RMB/K to the rear hand, adds empty-hand punches, longer light wind-up and shared cooldown, disables heavy attacks, adds pain/stun and contact-based front kicks with several backward recovery steps, fixes rear-only overarm throwing, and shows all unequipped items together in the backpack.

## Validation

| Check               | Result                     |
| ------------------- | -------------------------- |
| TypeScript / ESLint | Passed                     |
| Unit tests          | 176 across 11 files        |
| Browser scenarios   | 28                         |
| Production build    | `/arena-of-ash/` base path |

New pure combat cases cover exact hand/weapon/stat selection, bare fists, disabled heavy requests, active windows/cooldown, action interruption and stun, one kick contact, bounded impulse travel, grounded kick eligibility, a reachable rear-hand coil, nearly straight kicking leg/sole presentation, and planted feet through actual knockback displacement. Existing contact, progression, persistence, live JSON, display and anatomy cases remain.

New browser cases exercise actual left/right mouse buttons and right-click cleanup, bare front/rear hand selection, heavy-button absence, real boot/body kick contact followed by forced stagger, and all-category backpack rows that disappear/reappear on equip/remove. Existing tests use light attacks in place of the disabled heavy control and observe actual movement rather than a fixed delay when hit reactions can interrupt it. Large-display Canvas/WebGL, Retina, native 4K, fractional density and logical pointer targeting remain covered.

Screenshots include `mouse-rear-hand-light-attack.png`, `after-front-kick-stagger.png`, `backpack-all-unequipped-items.png` and preserved art/contact/loadout captures. Local pose reviews also inspect the bent elbow/hand behind the head and the extended front kick with sole facing the opponent. Body/strike capsules approximate the visible drawing; they are not alpha masks or a ragdoll simulation.

## Controls and scope

LMB/J/1: front hand. RMB/K/2: rear hand. F/3: grounded front kick. A/D/arrows, Shift, Space, direction+Space and R retain locomotion/stance behavior. Heavy actions are rejected in the rules layer and are absent from UI/AI. Both hands use their own geometry, while one global action and cooldown prevent alternating-button spam. Empty selected hands punch; the other weapon is never substituted.

Normal hits interrupt with 180 ms stun and a 280 ms pain response. Kicks apply 350 ms stun, an 850 ms balance recovery and a constrained impulse of roughly 210 pixels in free space. Passive stamina regeneration continues. Pain/stagger uses actual body state and articulated joint transforms.

Camp T / Throw and Character Throw preview always use the rear hand. The hand coils behind the head, releases once and returns; the head temporarily occludes the arm without moving its shoulder frame. Throwing remains an animation foundation with no projectile or item consumption. Belt items remain inactive. The inventory view derives its backpack by subtracting equipped IDs from owned IDs, preserving save/unequip behavior and all item categories.

See [melee rules](MELEE_COMBAT.md), [throw references](THROW_ANIMATION.md), [equipment](EQUIPMENT.md) and [runtime content](RUNTIME_CONTENT.md). Save version 2 remains unchanged; this update does not reset the current loadout.

## Publication

The public site is https://tinilit.github.io/arena-of-ash/. A successful `Validate and deploy game` run must match the pushed commit. Verify that its served JavaScript path and SHA-256 match the local Pages build. Production exposes no development snapshot API. Cloud environment publication and Pages deployment are separate operations.
