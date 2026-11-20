# Skill-based gladiator progression

`domain/skills.ts` owns stable numeric IDs, prerequisites, equipment eligibility and balance. New gladiators have no learned skills. IDs 1–17 are preserved; Heavy Armor is ID 18. Shield Bash (14) is dormant while shields provide passive armor only, so 17 skills are currently offered.

| ID  | Skill            | Function                                                            |
| --- | ---------------- | ------------------------------------------------------------------- |
| 1   | Dual Wielding    | Independent one-handed weapons, LMB/J and RMB/K                     |
| 2   | Heavy Weapons    | Heavy melee weapons and two-handed shaft shove, V                   |
| 3   | Kicking          | Ground/air zero-damage kick, F                                      |
| 4   | Wrestling        | Lift, carry and throw, H                                            |
| 5   | Execution        | Bound grounded execution, X                                         |
| 6   | Parrying         | Timed weapon and bolt parries, C                                    |
| 7   | Throwing Weapons | Ctrl+hand attack and belt throwables, Q/E                           |
| 8   | Marksmanship     | Crossbow aim/fire/reload; independent of Heavy Weapons              |
| 9   | Alchemy          | Belt potions, Q/E                                                   |
| 10  | Shield Mastery   | Rear-hand passive shields                                           |
| 11  | Battle Rage      | Eight seconds: ×1.3 attack speed, ×1.2 damage, ×0.75 armor, Z       |
| 12  | Kip-Up           | Half-second supported jumping get-up                                |
| 13  | Superman Punch   | One-handed melee leap, T; needs at least 175 × actor scale units    |
| 14  | Shield Bash      | Dormant; retained in existing saves, unavailable for training/input |
| 15  | Berserker        | Below half health, up to +30% damage and +25% attack speed          |
| 16  | Counterstrike    | 20% physical counter instead of the palm shove; requires Parrying   |
| 17  | Second Wind      | Recover 30 HP below 20% health, once per fight                      |
| 18  | Heavy Armor      | Wear heavy helmets, chest armor and shields                         |

## Training and persistence

Every completed victory, defeat or draw persists one exclusive skill-or-shop decision alongside its once-only reward. Two distinct random, unlearned skills with satisfied prerequisites are sampled and saved in `postBattle.offers`. Reload keeps the same offers. If one eligible skill remains, only that skill appears; if none remain, only Shop is available.

Selecting an offered card learns it immediately, saves once and returns to camp. There is no confirmation modal. The pure domain also rejects skills outside the saved offers. Gladiator lists only learned skills; Camp has no separate Skills collection. Unfinished decision/training/shop visits resume on reload; abandonment creates no reward or decision.

Save format 4 continues using `arena-of-ash.v3`. Older format 2/3 saves retain possessions, quantities, gold and victories, but receive zero advanced skills; restricted worn items return to the backpack. Existing format 4 decisions without offers receive offers once on load. The old front-hand shield slot migrates to an empty rear slot, otherwise its owned copy returns to the backpack. No copy is deleted by eligibility migration.

## Equipment classes and shields

Runtime definitions accept `equipmentClass: "light" | "heavy"`. The bundled catalog explicitly classifies all weapons, helmets, body armor and shields. Missing metadata in older custom catalogs defaults to light, except two-handed melee weapons, which default to heavy. Crossbows remain light and require only Marksmanship.

Heavy weapons require Heavy Weapons; heavy helmets/body armor require Heavy Armor. Arena Buckler gives 3 armor and requires Shield Mastery. Tower Shield gives 6 armor and additionally requires Heavy Armor. Both occupy only the rear/right slot. A front-hand weapon plus rear shield needs no Dual Wielding. Two-handed weapons reserve the other hand as before.

Shield armor joins helmet/body armor in deterministic damage subtraction. Shields do not intercept attacks, bash, parry independently or use S. Their artwork sits first in the pelvis container, behind both legs, torso, head and arms. Its position is derived from the rear hand's world transform converted into pelvis coordinates; render depth never changes the arm's joint transforms.

## Enemies and automatic combat

Each challenger and boss receives exactly the player's learned skill count, with randomized unique skills and satisfied prerequisites. Boss names, body scale, health, movement and strike specialties remain. Their preferred gear is used when eligible, with compatible catalog fallbacks otherwise. No combat constructor grants extra enemy skills. With every active skill already assigned, the dormant legacy ID may fill an existing player's full 18-ID budget without enabling shield actions.

Rage activation braces the body into a short roar, while red eyes and an angry mouth persist for the full real-time buff. Pain can still close the red eyelids; helmets remain above the face. Auto Battle lets this entry animation finish; manual attacks can override the cosmetic activation.

`combat/skillCadence.ts` counts accepted normal attack IDs, including misses, and samples a threshold of 1–3. A usable learned skill follows that sequence, then the counter resets. Each hand has its own accepted attack ID. Impossible skills do not stall ordinary combat. The AI approaches for close skills; urgent healing, recovery of dropped weapons and defensive parries retain priority. Passive-only builds naturally continue ordinary attacks. Superman checks minimum distance in both AI and engine, before consuming an action or cooldown.

## Optional hit-pause experiment

The arena starts with **Hit pause: On, 200 ms**. Its live header controls toggle the experiment and adjust duration in 50 ms steps from 0 to 1000 ms. Clicking them preserves Auto Battle and never attacks. Settings apply to both fighters; turning it off clears active pauses immediately. These settings are not character progression or save data.

`combat/hitStop.ts` owns the isolated experiment. Positive HP damage freezes the victim and attacker in real time. For a dual-wielding attacker, only the contacting hand's action/cooldown and animation stop; the other hand and movement remain available. One-handed and two-handed attackers pause as complete actors. Victim pain stun/recovery elapses during the pause. Misses, fully absorbed damage, kicks, shoves and parries do not trigger it. Haste and Rage countdowns retain real time, including partial-expiry steps.

For removal, stop configuring `battle.hitStop` in ArenaScene and remove its header controls; an unconfigured HitStop controller is inactive. The controller, per-hand animation deltas and contact hook are localized, without modifying skill/save/catalog formats.

## Pain expression and visual references

Positive damage starts a 420 ms facial reaction with quick onset and eased release: lowered brow, squeezed closed eyelids and a tense mouth. A separate facial graphics layer lives above the head shape and below the helmet. It uses the real-time pain clock during hit pause; existing body recoil, fixed bones and permanent shoulder planes remain.

References consulted:

- [Official Phaser Container API documentation](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/container/Container.js): children render in internal list order, nested transforms affect their children, and `sendToBack` changes rendering order. The shield therefore belongs to the first pelvis slot, with its wrist position explicitly converted into that parent's coordinate space.
- [OpenFace Action Units guide](https://github.com/TadasBaltrusaitis/OpenFace/wiki/Action-Units): facial expressions decompose into individual movements with continuous intensity. The stylized pain expression blends eyelid, brow and mouth changes independently rather than replacing or scaling the head.

The Phaser documentation site and the attempted medical reference were blocked by the cloud proxy (403); the available GitHub sources above were retrieved instead. The result is a stylized game reaction, not a diagnostic facial-pain model.

## Verification

Pure tests cover stable offers, immediate single learning, prerequisite edges, all enemy budgets across challenger/boss tiers, compatible equipment, both shield classes, exact hit-pause expiry, independent dual-hand clocks/poses, live disable/duration changes, attack cadence and point-blank launch rejection. Browser tests cover the actual two-card flow/reload, locked equipment, passive shield depth, live controls preserving Auto Battle and ordinary gameplay regressions.

## Skill filter and parry follow-up

Shop's checkbox uses `itemUsable` rather than ownership or currently free slots. Filtering happens before page counts and clamps the page; empty categories show an explicit message. The preference stays on while changing categories/quantities, buying or visiting the inventory, for the current game session.

A learned Counterstrike rolls exactly once per eligible successful parry, with an independent RNG and strict `< 0.2` threshold. A melee success keeps the normal one-second attacker stun. At the follow-up, a selected physical riposte replaces the palm shove in both pose and movement; the failed roll keeps the ordinary zero-damage shove. Bolt deflections can roll the same counter but never remotely shove, stun or disarm their shooter. A reloading crossbow cannot select an unavailable counter.

Shield carry uses a forward wrist target, shared by camp and battle rigs. Runtime prop flags clear when the actual action ends, and the normal return blend takes the drinking arm back to the shield hold. The shield artwork remains behind all body/limb layers throughout.
