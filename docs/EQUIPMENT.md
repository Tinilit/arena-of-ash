# Equipment and loadout

The catalog contains twelve items: five swords/spears, two helmets, two chest pieces, Throwing Knife, Throwing Axe and Healing Potion. Shields, net, water flask and paired warglaives are absent. JSON categories are separate from equipment positions.

| Position    | Category | Behavior                                          |
| ----------- | -------- | ------------------------------------------------- |
| Helmet      | helmet   | Head attachment and armor                         |
| Body        | chest    | Torso attachment and armor                        |
| Right hand  | weapon   | Rear hand: RMB/K attacks; Ctrl+RMB/K throws       |
| Left hand   | weapon   | Front hand: LMB/J attacks; Ctrl+LMB/J throws      |
| Belt slot 1 | utility  | Q uses its throwable or potion with the rear hand |
| Belt slot 2 | utility  | E uses its throwable or potion with the rear hand |

Select a slot card, then equip an owned compatible item from the backpack. All unequipped categories appear together, eight per page. Equipped IDs are excluded. Removing gear restores it to the backpack without destroying ownership. Moving an ID between compatible positions cannot duplicate it. There is one owned copy per definition; a consumed item can be purchased again.

The starter owns a wooden sword and both belt throwables. The knife costs 25 gold and supplies +3 attack to its own throw; the axe costs 45 and supplies +8. A potion costs 30 and restores up to 35 HP. Carried utility bonuses do not stack into melee. Each action uses base attack plus active armor bonuses and its own weapon/throwable bonus; other hand weapons never add a hit or bonus.

All actual throws are overarm and can run during jumps. The selected weapon leaves its hand at release; belt throwing temporarily stows the rear weapon and retains it afterward. A released item is removed from equipment and ownership, saved immediately, even if it misses, the player loses or abandons the fight. Projectiles deal damage only on a swept blade/head/body contact, once, and settle harmlessly on the floor. No pickup mechanic is implemented.

A potion uses a 2100 ms rear-hand drinking action: raise, touch the open vial to the mouth, tilt for a sip, lower and stow. Healing/consumption occurs once at 55%. Before that point a hit interrupts without consuming it. Healing cannot exceed 100 HP; use is disabled at full HP. The other hand retains its independent action track. Camp P and Character's Drink potion button preview the same animation without consuming gear or healing.

Shop pages show eight definitions. The second page contains Viking Warhelm, both throwables and the potion. Runtime JSON/art updates remain file-based; supported `use` values are `throw` and `drink`. See [runtime content](RUNTIME_CONTENT.md), [throwing](THROW_ANIMATION.md) and [combat](REALTIME_COMBAT.md).
