# Progressive random opponents

The player's `progress` is the number of victories and no longer stops at two. Saves retain this nonnegative integer without reintroducing levels or attributes. Camp shows the count and next rank. Defeats do not advance it.

| Victories | Rank              | Main/offhand weapon attack pool | Body / helmet                       |
| --------- | ----------------- | ------------------------------- | ----------------------------------- |
| 0–2       | Arena Novice      | 1–4                             | None                                |
| 3–5       | Iron Pit Fighter  | 4–9                             | Weakest available body and helmet   |
| 6+        | Veteran Gladiator | 9+                              | Strongest available body and helmet |

Pools come from the installed runtime catalog. If a band is empty, use the strongest available weapons within that tier’s upper budget. Offhand chance is `min(0.75, 0.2 + tier × 0.2 + victories × 0.01)`; the second weapon must have a different ID and compatible category. Its fallback uses the strongest other available weapon within the same upper budget when only one qualifies for the main-hand pool. Generated ownership contains exactly the equipped IDs. No shield or utility item is treated as a weapon.

A fresh production fight draws a new cryptographic seed. Loadout, melee AI, rare throws, reactive dodges and kick-outcome random streams remain independent. Development `?seed=` fixes all streams for repeatable tests. AI can start its free hand while the other swings or recovers, using each actual weapon's reach and contact geometry. Equipment quality eventually reaches the available catalog ceiling; there is no hidden stat inflation.

An idle armed opponent at 230–600 units can attempt one overarm weapon throw per fight. The first chance is after 1800 ms; eligible checks are separated by 9000 ms with a 12% success threshold. Attempts use a separate injected RNG and the same wind-up, release marker, contact geometry and ownership removal as player throws. A missed/interrupted attempt is not spammed. An empty hand continues punching. Landed enemy weapons can be collected and permanently owned by the player. Full AI can request parries, belt items, kicks, both hops, jumps, shoves, grabs/throws and armed ground finishers. A separate dodge RNG allows a 35% backward hop in response to each committed nearby player swing, with a 2200 ms cooldown and a wall-clearance check. No invulnerability is granted.

An idle grounded opponent requests a pickup for a landed weapon within the existing 85-unit grip/blade span reach when a compatible hand is free. A disarmed opponent also predicts its weapon's landing point and actively runs toward it; it may kick or grab/throw an opponent blocking the route. It never replaces equipped gear, collects belt utilities from the ground or treats a reserved two-handed support grip as empty. The same single-copy pickup transition serves both fighters; enemy collection never adds the item to the persistent player.

Timed AI parries use one decision per observed quick swing, with a 28% attempt probability and a varied wind-up threshold. Parry feasibility still uses the same actual weapon/body contact and cooldown as manual C. Tactical actions have their own decision intervals and RNG, keeping normal attack, dodge and rare-throw streams separate. B uses another full AI instance for the player.

AI waits at least six actor seconds between drink attempts, including interrupted wind-ups, so a wall-side fighter returns to combat rather than repeatedly attempting an unsafe sip.
