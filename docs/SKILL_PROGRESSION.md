# Skill-based gladiator progression

`domain/skills.ts` is the stable numeric catalog and the single source of prerequisites, item requirements and balance. All 17 skills are binary and initially unlearned. There are no hidden prerequisite edges: Shield Bash requires Shield Mastery, and Counterstrike requires Parrying. Superman Punch requires a held one-handed melee weapon at use time, without an additional learned prerequisite. Crossbows require Marksmanship independently of Heavy Weapons.

| ID  | Skill            | Real functionality / input                                              |
| --- | ---------------- | ----------------------------------------------------------------------- |
| 1   | Dual Wielding    | Equip two one-handed weapons; independent LMB/J and RMB/K action tracks |
| 2   | Heavy Weapons    | Two-handed melee weapons and physical zero-damage shaft shove, V        |
| 3   | Kicking          | F/3, ground/air kick, stagger/push and existing 20% fall chance         |
| 4   | Wrestling        | H, lift/carry/turn/throw using the existing paired controller           |
| 5   | Execution        | X, bind and fatally execute a valid grounded opponent                   |
| 6   | Parrying         | C, timed weapon/bolt parries, melee stun/shove and disarm               |
| 7   | Throwing Weapons | Ctrl+hand attack and Q/E throwables, including air throws               |
| 8   | Marksmanship     | Equip, aim, fire and reload crossbows                                   |
| 9   | Alchemy          | Use all healing, haste and future drink items with Q/E                  |
| 10  | Shield Mastery   | Equip a front-hand shield; hold S for physical frontal blocking         |
| 11  | Battle Rage      | Z, eight real combat seconds, once per fight                            |
| 12  | Kip-Up           | Automatic half-second jumping get-up after the grounded hold            |
| 13  | Superman Punch   | T, forward airborne one-handed weapon strike and landing recovery       |
| 14  | Shield Bash      | V with an equipped shield; physical damage, stun, push and cooldown     |
| 15  | Berserker        | Automatic low-health damage and attack-speed scaling                    |
| 16  | Counterstrike    | Automatic fast blade/bolt follow-up after a successful parry            |
| 17  | Second Wind      | Automatic emergency healing once per fight                              |

## Balance

`skillBalance` centralizes tuning. Rage gives ×1.3 attack speed, ×1.2 damage and ×0.75 effective helmet/body armor for 8000 real milliseconds. Its timer is not accelerated by haste. Berserker grows linearly below half maximum health, approaching +30% damage/+25% attack speed at zero health. Their multipliers combine multiplicatively. Haste retains its separate actor-time multiplier.

Superman uses ×1.4 damage, 380 units/s forward momentum, a 390 units/s upward launch and a 650 ms attack recovery after its clip. Shield Bash uses 12 raw damage, 700 ms stun, normal 500 units/s kick-strength displacement and a 2500 actor-ms cooldown. Counterstrike uses a 480 ms clip, ×1.15 damage and forward pursuit; it follows the existing melee parry shove instead of replacing it, or follows a real bolt deflection without remotely stunning or shoving its shooter. Crossbow counters launch a real bolt and retain reload restrictions. No new attack is awarded a distance-only hit.

Kip-Up changes the get-up animation from 1800 to 500 actor-ms, retaining the fall/grounded hold and vulnerability. Second Wind restores 30 HP after an ordinary damaging contact leaves health below 20%, once per fight; it can rescue an otherwise lethal ordinary hit, but not a paired execution. Each new fighter instance resets temporary buffs, cooldowns and once-per-fight flags.

Normal weapon raw values remain fixed. Rage/Berserker modify raw damage; the special strike's multiplier then applies; raw damage and final HP loss are rounded to whole points. Rage reduces effective armor before subtraction. Shield interception is separate from worn armor, does not fatigue helmet/body armor and gives no passive armor bonus.

## Authoritative access checks

- `hasSkill`, `prerequisitesMet`, `canLearn`: catalog-backed checks.
- `itemRequirements`, `itemUsable`, `equipmentAllowed`, `sanitizeEquipment`: eligibility and safe loadouts. Requirements derive from functionality, including future throw/drink items.
- `actionRequirement`, `actionAllowed`, `permittedInput`: shared combat policy. Both player AI and the realtime engine filter commands; direct inputs also receive locked-skill feedback.
- `canEquip`, free slot selection and pickups respect the same policy. Restricted pickups remain owned in the backpack.
- Generated opponents/bosses explicitly keep the original ten combat abilities. They do not copy player skills; the player AI has no privilege override.

Both attack inputs still address the single rear two-handed swing. No unarmed hand receives a replacement weapon. Ranged and two-handed counters retain their actual weapon geometry and paired grips.

## Durable post-battle state

`domain/postBattle.ts` owns the decision protocol. Completing an arena outcome atomically saves the once-only reward and `{battleId, outcome, opponent, gold, choice, consumed, completed}`. Branch progression:

```text
Completed fight -> pending decision
  -> skill (consumed) -> confirm one eligible skill -> completed -> camp
  -> shop (consumed) -> buy/sell/reload within visit -> close -> completed -> camp
```

Selecting a branch saves immediately, even before learning/buying. Cancelling a skill confirmation returns to the same skill grid, not the shop option. An unfinished training/shop branch survives reload. All learned skills disable training. Escape from an unresolved fight creates no decision; after an outcome, navigation resumes its pending branch.

Boot and scene-entry guards route from this saved state. The shop's equipment screen supports selling/equipping and returns to the same visit; only leaving the shop completes it. Camp has no free shop and its skill collection cannot teach abilities. Scene switching cannot grant another branch, reward or skill.

## Save migration

The existing localStorage key `arena-of-ash.v3` now contains format `{version:4,player}`. This avoids orphaning existing browser data. Formats 2/3 retain identity, gold, quantities, owned items, armor and victory/reward progress, but migrate to `skills:[]` with no retroactive skill grants. Skill-locked equipped items return to the backpack without deleting ownership. Format 4 validates unique known IDs, prerequisites and coherent decision flags referencing a rewarded battle. Services writes the canonical state on load; Reset Progress starts a new zero-skill gladiator.

## Verification

Unit tests cover all 17 unlocks, dependencies, basic equipment/actions, independent hands, enemy/player AI separation, actual new skill effects, shields, counters, once-only decisions/rewards, migration, reset and reload. Browser scenarios cover zero-skill play, locked notifications, the complete 17-card grid and confirmation, exclusive shop/sales, migration, reset and actual shield/rage/Superman poses. Legacy mechanics fixtures explicitly learn their original abilities; they do not bypass production rules. Production builds expose no diagnostic mutation API.
