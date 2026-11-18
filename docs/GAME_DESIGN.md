# Game design

The Wanderer begins at level 1 with 100 gold, zero XP, five attributes at 10, and a Wooden Sword. Strength adds physical attack; agility scales movement speed by 1% per point relative to 10 (clamped to 80–150%); vitality adds health; defense reduces damage; endurance adds stamina. Gear modifies derived stats only.

HP = 60 + vitality × 4. Stamina = 50 + endurance × 5. Attack = 6 + strength × 0.9 + total gear attack. Armor is summed gear protection. Contact damage = max(1, round(attack × action multiplier − defender defense × 0.35 − armor)), then guard halves it with rounding and a minimum of 1. Hit/miss is geometric, with no random accuracy or critical rolls. There is no passive HP regeneration.

Quick costs 12 stamina and lasts 650 ms; heavy costs 25 and lasts 1100 ms, with multipliers 1 and 1.6. Stamina is spent at action start, including on a miss. Their active contact intervals are 30–70% and 46–80%. An active blade/leaf head must touch an opponent's body capsule. One swing can damage that opponent once; recovery, anticipation and idle weapons do no damage. Running and jumping can overlap a swing. Sword grips and spear shafts are excluded from damaging geometry.

Walk/run speeds start at 110/200 logical units per second. Running costs 10 stamina/second; a grounded jump costs 10, with gravity 1350 and initial vertical speed 500. No mid-air second jump is allowed. Guard costs 8 stamina/second and halves contact damage while held or toggled; a fresh guard needs 10 stamina. Recover takes 750 ms and restores 25 once on completion. Idle/walking regenerate 14 stamina/second when not attacking, guarding or running. Restoration is capped at maximum. Bounds and body separation prevent walking through the arena walls or a standing opponent.

The AI moves into weapon reach, attacks with affordable actions, backs away when crowded, and sometimes guards, jumps or recovers. Its decisions use injected randomness; damage does not. Both fighters update at the same fixed 120 Hz step. Simultaneous lethal contacts produce a draw with the defeat payout. Losing focus pauses simulation and clears held input.

Opponents: Arena Novice → Iron Pit Fighter → Veteran Gladiator. Wins advance; the veteran repeats. Victory grants 50 gold / 40 XP. Defeat grants 10 gold / 10 XP. A new battle starts fully healed and rested. Esc abandons a battle without a reward. Persistent reward IDs prevent duplicate payouts.

Level threshold = 100 + 50 × (level − 1). Each level grants 2 attribute points. Excess XP carries over through multiple level gains. Spend points on any base attribute in the character scene.

The default catalog currently contains nine definitions across weapon, helmet and chest slots: Wooden Sword, Rusty Sword, Iron Sword, Training Spear, Ashwood War Spear, Leather Vest, Iron Chestplate, Leather Helmet and Viking Warhelm. There is one owned copy per definition and no selling. Buy, then equip in the character scene. Shields are temporarily removed from the catalog and all opponent loadouts.

Ashwood War Spear adds +10 attack for 115 gold and Viking Warhelm +3 armor for 60 gold. Spears use a proper haft/head drawing and thrust motion. Ash Vanguard is the only artwork and Grounded the only motion system. There is no studio or paired weapon. See [equipment](EQUIPMENT.md).
