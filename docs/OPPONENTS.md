# Arena ladder and opponents

The player's `progress` is the number of victories and no longer stops at two. Saves retain this nonnegative integer without reintroducing levels or attributes. Camp shows the next round and opponent; View ladder shows all 18 slots. Defeats do not advance it.

| Victories | Rank              | Main/offhand weapon attack pool | Body / helmet                       |
| --------- | ----------------- | ------------------------------- | ----------------------------------- |
| 0–2       | Arena Novice      | 13–16                           | None                                |
| 3–5       | Iron Pit Fighter  | 16–21                           | Weakest available body and helmet   |
| 6+        | Veteran Gladiator | 21+                             | Strongest available body and helmet |

Pools come from the installed runtime catalog. If a band is empty, use the strongest available weapons within that tier’s upper budget. Offhand chance is `min(0.75, 0.2 + tier × 0.2 + victories × 0.01)`; the second weapon must have a different ID and compatible category. Its fallback uses the strongest other available weapon within the same upper budget when only one qualifies for the main-hand pool. Generated ownership contains exactly the equipped IDs. No shield or utility item is treated as a weapon.

A fresh production fight draws a new cryptographic seed. Loadout, melee AI, rare throws, reactive dodges and kick-outcome random streams remain independent. Development `?seed=` fixes all streams for repeatable tests. AI can start its free hand while the other swings or recovers, using each actual weapon's reach and contact geometry. Ordinary equipment quality eventually reaches the available catalog ceiling. Named boss modifiers are explicit fixed encounter data.

An idle armed opponent at 230–600 units can attempt one overarm weapon throw per fight. The first chance is after 1800 ms; eligible checks are separated by 9000 ms with a 12% success threshold. Attempts use a separate injected RNG and the same wind-up, release marker, contact geometry and ownership removal as player throws. A missed/interrupted attempt is not spammed. An empty hand continues punching. Landed enemy weapons can be collected and permanently owned by the player. Full AI can request parries, belt items, kicks, both hops, jumps, shoves, grabs/throws and armed ground finishers. A separate dodge RNG allows a 35% backward hop in response to each committed nearby player swing, with a 2200 ms cooldown and a wall-clearance check. No invulnerability is granted.

An idle grounded opponent requests a pickup for a landed weapon within the existing 85-unit grip/blade span reach when a compatible hand is free. A disarmed opponent also predicts its weapon's landing point and actively runs toward it; it may kick or grab/throw an opponent blocking the route. It never replaces equipped gear, collects belt utilities from the ground or treats a reserved two-handed support grip as empty. The same single-copy pickup transition serves both fighters; enemy collection never adds the item to the persistent player.

Timed AI parries use one decision per observed quick swing, with a 28% attempt probability and a varied wind-up threshold. Parry feasibility still uses the same actual weapon/body contact and cooldown as manual C. Tactical actions have their own decision intervals and RNG, keeping normal attack, dodge and rare-throw streams separate. B uses another full AI instance for the player.

AI waits at least six actor seconds between drink attempts, including interrupted wind-ups, so a wall-side fighter returns to combat rather than repeatedly attempting an unsafe sip.

The ladder places Cassian the Red at progress 5 (round 6), Brakka Stonefist at 11 (round 12) and Vesper Ashwind at 17 (round 18). Their immutable definitions live in `src/domain/ladder.ts`, including names, HP, scale, independent movement/attack multipliers and all equipped slots. Creation clones the definition and gives the enemy exactly the worn quantities, so consumptions/disarms never mutate the next retry. Custom catalogs fall back to compatible available gear. Defeat preserves progress; after 18 wins, all ladder entries remain defeated and ordinary elite exhibition matches continue uncapped.

Boss AI makes tactical decisions every 450–900 actor milliseconds, prioritizes useful belt drinks and has an 80% eligible offensive belt-throw decision. Each belt slot contains one owned copy, consumed only at its normal release/sip. Healing thresholds use the fighter’s maximum HP. Vesper’s ranged policy continuously aims at the target torso or downed body; projectile travel remains physical. Timed AI bolt interceptions have a separate per-projectile attempt (45% for bosses, 28% otherwise) and require actual weapon contact.

AI maintains a deadband around the longest equipped weapon reach instead of closing to an empty offhand. It retreats when crowded and deliberately approaches grab range for a chosen grapple. Empty hands never request light attacks.
