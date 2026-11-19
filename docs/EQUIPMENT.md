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

Select a slot card, then equip an owned compatible item from the backpack. All unequipped categories appear together, eight per page. Backpack rows show the number of spare copies: total ownership minus the copies in slots. Each slot carries one item. Removing gear returns that copy to the backpack. When there is a spare, equipping it fills another compatible slot; otherwise the sole equipped copy moves between slots. Shop consumables (`use: "throw"` or `"drink"`) can be bought repeatedly in bundles of 1/5/10. Other equipment has one shop purchase per owned definition, but looted weapon copies can accumulate.

The starter owns a wooden sword and both belt throwables. The knife costs 25 gold and supplies +3 attack to its own throw; the axe costs 45 and supplies +8. A potion costs 30 and restores up to 35 HP. Carried utility bonuses do not stack into melee. Each action uses base attack plus active armor bonuses and its own weapon/throwable bonus; other hand weapons never add a hit or bonus.

All actual throws are overarm and can run during jumps. The selected weapon leaves its hand at release; belt throwing temporarily stows the rear weapon and retains it afterward. Release removes one owned copy and empties its source slot immediately. Reserves remain in the backpack and never auto-refill the slot during battle. Projectiles deal damage only on a swept blade/head/body contact, once, and settle harmlessly on the floor. G collects a nearby landed item, including an enemy weapon, once. The empty original slot is preferred, then another empty compatible position; if all are occupied, the copy enters the backpack. Collection immediately restores ownership and saves. Victory keeps the arena open for collection until Continue. Unrecovered items are lost on leaving; consumed potions cannot be recovered.

A potion uses a 2100 ms rear-hand drinking action: raise, touch the open vial to the mouth, tilt for a sip, lower and stow. Healing/consumption occurs once at 55%. Before that point a hit interrupts without consuming it. Healing cannot exceed 100 HP; use is disabled at full HP. The other hand retains its independent action track. Camp P and Character's Drink potion button preview the same animation without consuming gear or healing.

Shop pages show eight definitions. The second page contains Viking Warhelm, both throwables and the potion. Runtime JSON/art updates remain file-based; supported `use` values are `throw` and `drink`. See [runtime content](RUNTIME_CONTENT.md), [throwing](THROW_ANIMATION.md) and [combat](REALTIME_COMBAT.md).

Ownership uses unique definition IDs plus optional total `quantities`. Missing counts mean one for old saves. Save validation requires enough copies for every occupied slot; two identical weapons/consumables require two owned copies. Neither quantity nor the other hand stacks extra passive bonuses into an action.

## Two-handed weapons

The default catalog has 15 definitions. Greatsword, War Hammer and Battle Axe have `hands: 2` and live on shop page 2. Equip them in Right hand; Left hand displays Supporting grip and cannot carry another item. The item is owned once. Explicitly equipping a one-handed item into Left hand returns the two-handed weapon to the backpack; no ownership is deleted. Ground pickups preserve occupied hands and go into the backpack if both hands are not free.

Either ordinary hand-attack input starts the shared rear-hand swing. The support hand is not an empty fist; Ctrl+front attack cannot throw it. Ctrl+rear attack can release the actual weapon. V pushes with the shaft; X performs a physical-contact finisher against a downed target. New weapon attack bonuses are 13/18/16, with 1150/1350/1250 ms swings and 400 ms shared recovery.
