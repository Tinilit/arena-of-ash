# Equipment and loadout

The default catalog has 24 definitions, including restored shields. Net, water flask and paired warglaives remain absent. JSON categories are separate from equipment positions. Item cards show learned-skill requirements before buying; locked owned items stay in the backpack. See [skill progression](SKILL_PROGRESSION.md).

| Position    | Category        | Behavior                                          |
| ----------- | --------------- | ------------------------------------------------- |
| Helmet      | helmet          | Head attachment and armor                         |
| Body        | chest           | Torso attachment and armor                        |
| Right hand  | weapon / shield | Rear hand: RMB/K attacks; Ctrl+RMB/K throws       |
| Left hand   | weapon          | Front hand: LMB/J attacks; Ctrl+LMB/J throws      |
| Belt slot 1 | utility         | Q uses its throwable or potion with the rear hand |
| Belt slot 2 | utility         | E uses its throwable or potion with the rear hand |

Select a slot card, then equip an owned compatible item from the backpack. All unequipped categories appear together, eight per page. Backpack rows show the number of spare copies: total ownership minus the copies in slots. Each slot carries one item. Removing gear returns that copy to the backpack. When there is a spare, equipping it fills another compatible slot; otherwise the sole equipped copy moves between slots. Shop consumables (`use: "throw"` or `"drink"`) can be bought repeatedly in bundles of 1/5/10. Other equipment has one shop purchase per owned definition, but looted weapon copies can accumulate.

The starter owns only a wooden sword. Belt throwables and potions must be bought. New games and resets leave the belt empty. Backpack Equip prefers an empty compatible position before replacing the selected occupied position, preserving two-handed reservations. The knife costs 25 gold and deals 15 raw damage on its own throw; the axe costs 45 and deals 20 raw damage. A potion costs 30 and restores up to 35 HP. Carried utility bonuses do not stack into melee. Each weapon or throwable supplies its complete fixed raw damage. Worn chest and helmet armor are subtracted from it, floored at zero; other equipment never adds damage. Learned Rage/Berserker and special strike modifiers are explicit exceptions to the ordinary raw value.

All actual throws are overarm and can run during jumps. The selected weapon leaves its hand at release; belt throwing temporarily stows the rear weapon and retains it afterward. Release removes one owned copy and empties its source slot immediately. Reserves remain in the backpack and never auto-refill the slot during battle. Projectiles deal damage only on a swept blade/head/body contact, once, and settle harmlessly on the floor. G collects a nearby landed item, including an enemy weapon, once. The empty original slot is preferred, then another empty compatible position; if all are occupied, the copy enters the backpack. Collection immediately restores ownership and saves. Victory keeps the arena open for collection until Continue. Unrecovered items are lost on leaving; consumed potions cannot be recovered.

A potion uses a 2100 ms rear-hand drinking action: raise, touch the open vial to the mouth, tilt for a sip, lower and stow. Healing/consumption occurs once at 55%. Before that point a hit interrupts without consuming it. Healing cannot exceed 100 HP; use is disabled at full HP. The other hand retains its independent action track. Camp P retains a harmless learned-Alchemy keyboard preview without consuming gear or healing.

Shop pages show eight definitions. Weapons, Armor and Misc each page their own list. Runtime JSON/art updates remain file-based; supported `use` values are `throw` and `drink`. See [runtime content](RUNTIME_CONTENT.md), [throwing](THROW_ANIMATION.md) and [combat](REALTIME_COMBAT.md).

Ownership uses unique definition IDs plus optional total `quantities`. Missing counts mean one for old saves. Save validation requires enough copies for every occupied slot; two identical weapons/consumables require two owned copies. Neither quantity nor the other hand stacks extra passive bonuses into an action.

## Two-handed weapons

The default catalog has 22 definitions. Greatsword, War Hammer and Battle Axe have `hands: 2` and live in Weapons. Equip them in Right hand; Left hand displays Supporting grip and cannot carry another item. The item is owned once. Explicitly equipping a one-handed item into Left hand returns the two-handed weapon to the backpack; no ownership is deleted. Ground pickups preserve occupied hands and go into the backpack if both hands are not free.

Either ordinary hand-attack input starts the shared rear-hand swing. The support hand is not an empty fist; Ctrl+front attack cannot throw it. Ctrl+rear attack can release the actual weapon. V pushes with the shaft; X binds a downed target into a guaranteed execution. New weapon raw damage values are 25/30/28, with 1150/1350/1250 ms swings and 400 ms shared recovery.

Steel Crossbow requires Marksmanship and is in Weapons for 180 gold. It reserves both hands and fires automatically reloaded bolts with either attack input. The rear trigger arm and elbow stay in front of the torso; the front support arm and elbow stay behind it. Shooting keeps the weapon and creates no collectible equipment copy. Throwing the actual crossbow still consumes/releases that item normally.

Closed Steel Helm (`closed-helm`, 110 gold, 5 armor) and Steel Cuirass (`cuirass`, 180 gold, 8 armor) are in Armor. The helm encloses the face with a visor, eye slit and vent holes; the cuirass has a ridged steel breastplate and articulated waist plates. Their procedural art uses the same fixed head/torso mounts as other armor.

Additional categorized items are Riveted Chainmail (`chainmail`, 95 gold, 4 armor), Roman Legionary Helm (`legionary-helm`, 155 gold, 6 armor), Two-handed War Trident (`trident`, 175 gold, 27 damage, `hands: 2`, `weaponType: "spear"`) and Potion of Haste (`speed-potion`, 55 gold). The helm follows an Imperial Gallic silhouette with an open face, bowl, reinforcing brow, cheek pieces and flared neck guard.

Haste is a stackable belt consumable with `use: "drink"`, `effect: "haste"`, `durationMs: 10000` and `speedMultiplier: 2`. It can be drunk at full HP, consumes at the normal sip marker and cannot stack/refresh while active. The transient fighter buff is not saved between matches; ownership consumption is saved immediately.

Backpack Sell exchanges one unequipped copy for half purchase price, rounded down. Repeated hits wear chest armor and helmets, including fully absorbed damage. Broken pieces visibly fly off and disappear permanently; exposed body/head overlays refresh immediately. Surviving gear repairs after battle, arena exit or reload; broken copies remain permanently lost. Wear is localized to the contacted head/body region, with faint cracks on heavily damaged pieces and no numeric durability counters.

## Skill eligibility and visits

Dual Wielding enables a second one-handed weapon; without it, Equip replaces the existing weapon instead of filling a second weapon slot. Heavy Weapons enables two-handed melee; Marksmanship alone enables the crossbow. Shield Mastery enables a rear-hand shield alongside a front-hand one-handed weapon without Dual Wielding. All drinks need Alchemy; belt and hand throws need Throwing Weapons. Light armor remains basic; Heavy Armor unlocks heavy helmets, body pieces and the Tower Shield. Weapons and armor expose light/heavy classes. Pickup keeps skill-locked items owned in the backpack.

Shop access is exclusively post-battle. Its Sell equipment control opens backpack sales within that visit; returning to Shop preserves the visit, while closing Shop completes it permanently. Camp inventory still equips/unequips but does not sell. Arena Buckler (+3 armor) and Tower Shield (+6 armor) add passive protection to worn helmet/body armor. Their art is always behind all body and limb layers. Active blocking and Shield Bash are disabled for now.
