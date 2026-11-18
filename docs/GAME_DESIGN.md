# Game design

The Wanderer begins with 100 gold, a Wooden Sword, Training Net and Clay Flask. There are no character attributes, levels, experience, allocation points or energy/stamina resource. Every fighter has 100 health, base unarmed attack 12 and fixed movement speeds. Equipment changes attack and armor; the selected hand supplies its own weapon bonus. Armor in helmet/body slots also contributes. The other hand and inactive belt items do not stack bonuses.

Contact damage is max(1, round(12 + active gear attack − defender armor)), halved with rounding and a minimum of one while the AI guards. A kick deals max(1, round(12 − defender armor × 0.5)), also halved by guarding. There is no random accuracy or passive health regeneration.

Light attacks last 1000 ms, active at 45–67%, followed by 280 ms cooldown. Heavy attacks are disabled. F/3 performs a grounded 1050 ms front kick, active at 36–56%, followed by 350 ms cooldown. Only actual selected blade, fist or boot contact damages an opponent, once per action. Anticipation, recovery and idle equipment do no damage. Sword grips and spear shafts are excluded from damaging geometry.

A kick hit pushes back and has a 20% chance to knock the opponent down. Knockdown takes 550 ms (and waits for ground contact if airborne), followed by a full 1000 ms on the ground and an 1800 ms supported get-up. These states lock actions and movement without granting invulnerability. Further contacts damage but do not restart the floor transfer. A normal kick staggers for 850 ms.

Walk/run speeds are 110/200 logical units per second. Jump gravity is 1350 units/s² and initial vertical speed is 500 units/s. No mid-air second jump is allowed. Player-only directional hops have their own anticipation, ballistic arc, landing and cooldown. No action consumes a hidden resource. Bounds and separation prevent walking through walls or a standing opponent.

The AI moves into weapon reach, makes light attacks, backs away when crowded, and sometimes guards or performs an ordinary jump. It does not kick or use special hops. Simulation runs at 120 Hz. Simultaneous lethal contacts produce a draw with the defeat payout. Losing focus pauses simulation and clears held input.

Opponents: Arena Novice → Iron Pit Fighter → Veteran Gladiator. Wins advance; the veteran repeats. Difficulty comes from equipment rather than attributes. Victory grants 50 gold; defeat grants 10. A new battle starts fully healed. Esc abandons a battle without a reward. Persistent reward IDs prevent duplicate payouts.

The default catalog contains eleven definitions, including two inactive belt items. Inventory records ownership; the backpack shows all unequipped items and equipment cards show worn gear. There is one owned copy per definition and no selling. Shields remain temporarily absent. Spears use a haft/leaf head and thrust motion. Ash Vanguard and Grounded are the only appearance and motion systems. See [equipment](EQUIPMENT.md).
