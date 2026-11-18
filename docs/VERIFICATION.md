# Inventory quantities, parry and equipment recovery — 2026-11-18

Consumables support repeated purchases and bundles of 1/5/10. Equipment slots carry one copy each; backpack rows show reserves after subtracting equipped copies. Release/use consumes one source copy without auto-refill. G recovers landed player/enemy equipment into an empty compatible slot or the backpack and immediately persists ownership. A victorious player may collect a lethal thrown weapon before Continue; it remains equipped in the next match.

C provides an immediate 140 ms weapon parry window, a 450 ms action and 750 ms recovery. A confirmed frontal melee contact is deflected for zero damage and gives the attacker 1000 ms stun/off-balance recoil. Late/behind contacts, kicks and projectiles are not parried. The enemy has a separate rare-throw RNG, 12% eligible chance, a nine-second check interval and at most one attempt per fight.

## Validation

| Check               | Result                                  |
| ------------------- | --------------------------------------- |
| TypeScript / ESLint | Passed                                  |
| Unit tests          | 232 across 19 files                     |
| Browser scenarios   | 44, including successful focused reruns |
| Production build    | `/arena-of-ash/` base path              |

Unit coverage includes repeated/bulk purchases, exact source-slot consumption, spare-copy counts, two identical equipped copies, legacy saves and invalid count rejection. Parry tests cover real contact, exact timing limits, facing, miss/kick behavior, simultaneous attacker hands, a full second of stun, cooldown/repeat rejection and fixed-length reachable guard poses. Recovery tests cover original slots, full-loadout backpack fallback, enemy ownership transfer, duplicate prevention, grounded reach across the blade span, and settling/collection after victory. Rare AI checks use a separate deterministic stream and verify the one-attempt limit while another weapon remains held.

New browser scenarios purchase/equip reserves, consume one copy from each belt without auto-refill, perform a real timed C parry, recover a lethal thrown weapon after victory, and collect an enemy weapon into persistent player ownership. Existing victory/defeat, two-hand hits, airborne kicks/throws, knockdown, external JSON, Canvas/WebGL, Retina, 4K and logical pointer checks remain. A production WebGL smoke check verifies bulk quantities, a lethal throw, post-victory collection, persistence after reload and the absence of the development snapshot API. Pose assertions wait for the complete stance transition before judging knee angles. Floor-transfer poses are sampled inside the browser at 20 ms intervals to retain full down/get-up coverage without one protocol call per pose.

Collision uses authored 2D capsule approximations rather than per-pixel masks. Pickup ownership is transferred once; leaving without recovery loses the item. Used potions are consumed. Only the player requests parries/pickups; bots retain their regular attacks/guards/jumps and rare weapon throw.

## Publication

The public site is https://tinilit.github.io/arena-of-ash/. A successful `Validate and deploy game` run must match the pushed commit. Compare the served module path and SHA-256 with the Pages build. Production exposes no development snapshot API. Cloud environment publication and Pages deployment are separate operations.
