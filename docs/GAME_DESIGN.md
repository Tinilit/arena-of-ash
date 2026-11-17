# M1 game design

The Wanderer begins at level 1 with 100 gold, zero XP, five attributes at 10, and a Wooden Sword. Strength adds physical attack; agility affects hit/crit; vitality adds health; defense reduces damage; endurance adds stamina. Gear modifies derived stats only.

HP = 60 + vitality × 4. Stamina = 50 + endurance × 5. Attack = 6 + strength × 0.9 + total gear attack. Armor is summed gear protection. Damage = max(1, round(attack × action multiplier − defender defense × 0.35 − armor)). Critical damage ×1.5; guard ×0.5; final rounded minimum 1. No passive HP regeneration in battle.

Quick: cost 12, accuracy 90%, multiplier 1. Heavy: cost 25, accuracy 72%, multiplier 1.6. Accuracy adds 1 percentage point per agility difference and clamps to 15–95%. Critical chance is agility ×0.5%, capped at 25%. Defend restores 8 stamina and halves the next incoming attack; the stance is consumed even on a miss. Recover restores 25 stamina. All restoration caps at maximum.

Enemy AI recovers below 12 stamina, otherwise has a 15% defend choice, a heavy choice when affordable, or quick. RNG is injected; seeded generation supports reproducible tests. Inputs are rejected during resolution and when unaffordable.

Opponents: Arena Novice → Iron Pit Fighter → Veteran Gladiator. Wins advance; the veteran repeats. Victory grants 50 gold / 40 XP. Defeat grants 10 gold / 10 XP. A new battle starts fully healed and rested. Esc abandons a battle without a reward. Persistent reward IDs prevent duplicate payouts.

Level threshold = 100 + 50 × (level − 1). Each level grants 2 attribute points. Excess XP carries over through multiple level gains. Spend points on any base attribute in the character scene.

Eight items cover four slots: four weapons (Wooden Sword, Rusty Sword, Iron Sword, Training Spear), two chest pieces (Leather Vest, Iron Chestplate), Leather Helmet and Wooden Shield. One instance per definition; no selling. Buy, then equip in the character scene. Weapons, chest, helmet and shield affect both stats and the modular rig.

## Expanded catalog

Four additions bring the catalog to twelve: Ashwood War Spear (+10 attack, 115 gold), Viking Warhelm (+3 armor, 60 gold), Tower Shield (+5 armor, 85 gold), and Ashfang Warglaives (+14 attack once for the pair, 160 gold). Paired blades occupy the shield hand; equipping them unequips an owned shield without removing it from inventory. See [equipment rules](EQUIPMENT.md). Presentation changes do not alter combat action costs or multipliers.
