# Game design

Arena of Ash develops a gladiator through binary learned combat skills and post-battle equipment choices. There are no character levels, XP, attributes, energy costs, rarity rolls or multilevel skill upgrades. Ash Vanguard artwork, Grounded animation, physical collision and the existing ladder remain.

## Starting gladiator and arena loop

A new gladiator has 100 HP, 100 gold, one Wooden Sword, empty belts and no advanced skills. Basic actions are walking/running, jumping and directional hops, one one-handed melee weapon attack, stance changes, pickups, ordinary armor and inventory management. Empty fists remain disabled.

Every completed victory/defeat/draw creates a persistent exclusive decision. Learn a Skill opens all 17 skills, with permanent confirmation of exactly one eligible ability. Visit Shop opens buying and selling but cannot grant a skill. Finishing that branch returns to camp. Neither the shop nor skill learning is freely accessible from camp; camp's Skills collection is read-only. After all skills are learned, only the shop branch remains. Escape from unresolved combat gives no reward or decision. Once an outcome exists, Escape/Continue/reload leads to its outstanding decision.

Victory awards 50 gold and advances the uncapped victory count; defeat/draw awards 10 gold and retries the encounter. The ladder has 18 encounters: five challengers then a fixed boss, repeated three times. Cassian, Brakka and Vesper retain fixed equipment, different movement/attack modifiers, maximum HP and 120/130/125% scale. Beyond the ladder, elite exhibitions continue. Equipment quality and dual-wield frequency scale with victories. Enemies retain their established capabilities instead of inheriting the player's skill restrictions.

## Combat

The simulation runs at 120 Hz. Damage requires swept selected weapon/projectile contact with a moving body part during the action window, once per swing/projectile. Valid paired executions are the explicit guaranteed-impact exception. Base weapon damage is the complete catalog attack value, minus total helmet/body armor with a zero floor. Learned Rage/Berserker/Superman/Counterstrike provide deterministic, configurable modifiers. There is no random accuracy or critical multiplier.

Walk/run speeds are 110/200 logical units/s; normal jump gravity is 1350 units/s² and launch speed is 500 units/s. Directional hops retain their authored anticipation, ballistic flight and landing. Actions, pain, stun, grabs and floor transfers preserve their existing interrupt rules. Both legs remain under the skirt; fixed shoulder attachments, arm layers and bone lengths are unchanged.

Learned Dual Wielding retains independent per-hand animations, clocks and contact IDs. Heavy Weapons enables the existing two-handed swings and zero-damage physical shaft shove, reserving both hand slots. Marksmanship independently enables two-handed crossbows: physical bolts from the rendered muzzle, mouse aim and automatic reload; the crossbow remains owned and bolts are not equipment pickups.

Kicking unlocks the existing zero-damage front kick, including air kicks, stagger/push and a 20% knockdown chance. Standard floor recovery remains a 550 ms fall, 1000 ms grounded hold and 1800 ms supported get-up; damage does not reset it and it grants no invulnerability. Kip-Up replaces only get-up with a half-second tucked spring and soft landing.

Wrestling enables the existing reach/lift/carry/turn/throw mechanics without HP damage. Execution binds a nearby grounded target and guarantees a fatal impact at 680 ms; falling or getting-up targets cannot start an execution. Second Wind does not cancel an execution.

Parrying enables a 140 ms precision window inside the existing 450 ms action and 750 ms recovery. Frontal weapon contact produces a one-second attacker stun, automatic zero-damage counter-shove, and one 20% disarm roll. Actual bolt interception deflects a still-dangerous bolt randomly, without remotely stunning or disarming its shooter. Counterstrike adds a fast armed follow-up after the successful melee counter-shove or a real bolt deflection; its blade/bolt must still physically hit.

Shields require Shield Mastery, occupy the front hand and supply no passive armor. Holding S raises a directional shield surface; only an intercepted frontal blade/projectile is blocked. Rear attacks and shield misses can hit the body. Shield Bash uses that same rendered surface for a separate damaging, stunning, pushing strike.

See [all 17 skills and centralized balance](SKILL_PROGRESSION.md).

## Equipment and economy

Weapons, Armor and Misc contain the 24 default definitions. Item cards show functional skill requirements before purchase. Locked owned items remain in the backpack; invalid equipment is prevented and normalized on load. A second one-handed weapon needs Dual Wielding; a weapon and shield do not. Two-handed melee requires Heavy Weapons, while a crossbow needs only Marksmanship. Ordinary helmet/body armor stays basic.

Consumables accumulate through repeated/bulk purchases; each belt slot carries one copy and reserves never auto-refill. Throwing Weapons enables hand throws and belt knives/axes; all use the existing airborne-capable overarm animation. Alchemy enables every drink item, including healing and ten-second double-speed haste. Throws/sips save consumption at release, while interrupted wind-ups preserve ownership. G recovers grounded equipment into a skill-eligible empty slot or the backpack. Unrecovered equipment and consumed potions stay spent.

Selling is available during the shop visit and trades one unequipped copy for half its price, rounded down. Equipped copies are never sold. Head contacts wear helmets and other body contacts wear chest armor; heavily worn pieces show subtle cracks. Broken pieces disappear permanently. Surviving armor repairs after battle, exit or reload.

## Input, AI and persistence

The control legend follows learned abilities. Auto Battle starts enabled, uses actual learned skills/gear, and can be resumed with B. Gameplay input takes manual control; Alt/Meta navigation shortcuts preserve it. Losing focus clears held/queued input while combat continues, with headless timer updates when RAF stops. Long suspended intervals retain their simulation backlog.

Save format 4 retains identity, inventory/quantities, gear, gold, victory count, reward IDs, skills and a durable post-battle decision. Reward IDs prevent duplicate payouts; consumed/completed branch state prevents a second skill/shop option. Formats 2/3 explicitly migrate with no advanced skills, retaining ownership/progress and unequipping restricted items. Reset clears skills and decisions. Fight HP and unfinished combat are not saved.
