# Progressive random opponents

The player's `progress` is the number of victories and no longer stops at two. Saves retain this nonnegative integer without reintroducing levels or attributes. Camp shows the count and next rank. Defeats do not advance it.

| Victories | Rank              | Main/offhand weapon attack pool | Body / helmet                       |
| --------- | ----------------- | ------------------------------- | ----------------------------------- |
| 0–2       | Arena Novice      | 1–4                             | None                                |
| 3–5       | Iron Pit Fighter  | 4–9                             | Weakest available body and helmet   |
| 6+        | Veteran Gladiator | 9+                              | Strongest available body and helmet |

Pools come from the installed runtime catalog. If a band is empty, use the strongest available weapons within that tier’s upper budget. Offhand chance is `min(0.75, 0.2 + tier × 0.2 + victories × 0.01)`; the second weapon must have a different ID and compatible category. Its fallback uses the strongest other available weapon within the same upper budget when only one qualifies for the main-hand pool. Generated ownership contains exactly the equipped IDs. No shield or utility item is treated as a weapon.

A fresh production fight draws a new cryptographic seed. Loadout, AI and kick-outcome random streams remain independent. Development `?seed=` fixes all three for repeatable tests. AI can start its free hand while the other swings or recovers, using each actual weapon's reach and contact geometry. Equipment quality eventually reaches the available catalog ceiling; there is no hidden stat inflation.
