# Equipment

Eleven definitions use the existing four slots and one owned copy per definition. The original eight items remain. These three additions occupy shop page 2:

| Item              | ID          | Slot   | Price | Bonus      |
| ----------------- | ----------- | ------ | ----- | ---------- |
| Ashwood War Spear | `war-spear` | Weapon | 115   | +10 attack |
| Viking Warhelm    | `viking`    | Helmet | 60    | +3 armor   |
| Tower Shield      | `tower`     | Shield | 85    | +5 armor   |

The spear has a wooden haft, socketed leaf head, wrapped grip and butt cap. Training Spear also uses a proper pole-and-head model. Both use retraction/thrust/recovery animations instead of the sword's overhead cut, and carry the spear upright for victory. Combat costs, accuracy, multipliers and single-impact rules are unchanged.

The Viking helmet is a horned fantasy design with a metal dome, riveted brow and nasal guard. Tower Shield uses tall reinforced boards and a metal boss; it renders over the torso but below the weapon arm. Every drawing uses Ash Vanguard colors and the existing head/hand attachment system. Procedural bounds support thumbnails and layout checks.

Shop has eight cards per page with actual item icons, bonuses, prices and descriptions. Inventory has eight rows per page; purchases, equipping and attribute allocation preserve the current page. Purchases validate gold and ownership, and equipment bonuses never mutate base attributes. Saves retain the version-1 schema.

Paired warglaives and their special offhand rules have been removed. No retired-item migration or refunds are implemented. There is no equipment studio or free preview loadout.

Definitions live in `data/catalog.ts`, pole/helmet/shield drawing in `rendering/extendedGear.ts`, and spear motion in `characters/equipmentMotion.ts`. Unit tests cover exact purchase costs, valid slots, persistence, single impact events, joint constraints and full-shaft face clearance. Browser tests buy every remaining item across both pages, equip the spear kit, use it in a real battle and verify reload persistence.

## External definitions

The eleven initial definitions now live in `public/content/items.json`. The runtime catalog can add, rebalance or reskin items without recompiling gameplay. Optional image metadata supplies the source file, logical dimensions and attachment pivot; missing art uses the selected Ash Vanguard procedural fallback. See [runtime content](RUNTIME_CONTENT.md).
