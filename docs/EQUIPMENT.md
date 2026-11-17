# Expanded equipment catalog

The catalog contains twelve definitions across the existing four slots. No prior item IDs, prices, bonuses or owned instances are removed. Player saves remain version 1.

| New item           | ID          | Slot   | Gold | Bonus      | Presentation                                                          |
| ------------------ | ----------- | ------ | ---- | ---------- | --------------------------------------------------------------------- |
| Ashwood War Spear  | `war-spear` | Weapon | 115  | +10 attack | Long wooden haft, socketed leaf head, wrapped grip and metal butt cap |
| Viking Warhelm     | `viking`    | Helmet | 60   | +3 armor   | Fantasy horns, steel dome, riveted brow and nasal guard               |
| Tower Shield       | `tower`     | Shield | 85   | +5 armor   | Tall reinforced wooden boards, iron bands and central boss            |
| Ashfang Warglaives | `glaives`   | Weapon | 160  | +14 attack | A pair of original green crescent blades, one mounted to each hand    |

The Viking helmet is a fantasy design. The warglaives are an original interpretation of twin curved fantasy blades, not imported franchise artwork. All graphics are procedural and require no external assets.

## Spear and paired-weapon motion

Training Spear also receives a proper haft/head visual in Grounded mode, without changing its ID, price or bonus. Its previous long-blade placeholder remains available with Motion: Legacy. The new War Spear always uses its distinct new artwork.

`equipmentMotion.ts` chooses presentation by optional item `weaponType`. Spears use retraction, thrust and recovery instead of the sword's overhead cut. Their victory pose carries the pole upright. Warglaives use low lead-hand cuts with a visible offhand follow-through. Their two rendered weapons still resolve one normal Quick/Heavy combat action: stamina, accuracy, damage multipliers and reward rules are unchanged. Legacy motion remains usable with the new gear while retaining the previous library for existing Training Spear.

The tower shield stays attached to the shield hand but renders over the torso and below the weapon arm, so its complete tall silhouette remains readable. Helmet, shield and weapon drawings share the existing art-style adapters and mirroring behavior.

## Two-hand rule

Ashfang Warglaives are one owned item definition representing a matched pair. Their +14 attack bonus is counted once. Equipping them automatically removes the equipped shield from its slot, preserving ownership. A shield cannot be equipped while the pair is active: equip another weapon first. Character displays a blocked shield control and an explanation. Equipping an unowned/invalid weapon does not remove a shield.

An imported save containing both the pair and a shield is normalized by clearing the shield slot without resetting gold, inventory or progression. Derived stats defensively exclude that conflicting shield bonus as well. No item is silently sold or destroyed.

## Browsing and previews

Shop uses eight cards per page, with real equipment thumbnails, names, bonuses, prices and item descriptions. The new items occupy page 2. Inventory also uses eight rows per page, preserving the current page after purchases, equipment changes and attribute allocation.

Style Studio's gear button cycles **Classic kit → Equipped items → Spear & tower → Twin glaives**. Preview loadouts use cloned models and never grant ownership, deduct gold or alter real equipped slots. Every art style and both motion modes remain selectable.

## Extension and verification

Item definitions live in `data/catalog.ts`; optional `weaponType`, `occupiesOffhand` and `description` fields extend the original model. Shared crescent outline data is in `data/gearGeometry.ts`, drawing code in `rendering/extendedGear.ts`, and demonstration sets in `data/showcase.ts`. Conservative bounds feed the existing studio framing system. New art does not overwrite `rendering/parts.ts`.

Unit tests cover price/ownership transactions, save round-trips, slot conflicts, single-count bonuses, unchanged base animation libraries, one impact per action, and valid articulated limb mechanics for every style and motion mode. Sampled grounded checks test the full spear shaft and both crescent outlines against the moving facial region. Browser tests buy all items across both pages, equip new gear, exercise hand conflicts, check actual hand-to-weapon transforms, make real arena attacks and reload saves. A separate defeat case exercises the paired-weapon death/result lifecycle.
