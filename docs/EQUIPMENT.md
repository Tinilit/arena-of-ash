# Equipment and loadout

The default runtime catalog contains eleven items: five swords/spears, two helmets, two chest pieces, Folded Arena Net and Clay Training Flask. Shields and paired warglaives remain absent. Item categories in JSON remain `weapon`, `helmet`, `chest` and `utility`; they are distinct from the character's equipment positions.

| Position    | Accepted category | Behavior                          |
| ----------- | ----------------- | --------------------------------- |
| Helmet      | helmet            | Head attachment and armor         |
| Body        | chest             | Torso attachment and armor        |
| Right hand  | weapon            | Rear-hand weapon, used by RMB/K   |
| Left hand   | weapon            | Front-hand weapon, used by LMB/J  |
| Belt slot 1 | utility           | Visible inactive waist attachment |
| Belt slot 2 | utility           | Visible inactive waist attachment |

Select a slot card on Character, then equip an owned compatible item from the paginated backpack, which includes every unequipped category. The × button removes gear without deleting ownership. Equipping an ID in another compatible position moves it instead of creating a duplicate. The save validator enforces category, ownership and one equipped instance per ID. Save version 2 starts a new loadout rather than migrating old layouts.

Right-hand attacks retain the rear/far shoulder. Front-hand input selects the front-hand action library and its actual weapon matrix for contact. Each action uses only its requested hand's weapon bonus and collision shape; an empty hand punches. The other hand never contributes an automatic extra hit. Active helmet/body and the selected hand's weapon bonuses are counted; the other hand and utility bonuses do not stack. Utility attachments contribute no stats or use actions. The starter owns and wears the net and flask on the two belt mounts. Their drawings follow the pelvis above the skirt and below the foreground arm.

Shop displays eight definitions per page. Ashwood War Spear remains on page 1 and Viking Warhelm on page 2. The backpack displays up to eight unequipped items per page, regardless of the selected category. The runtime catalog/image workflow remains file-based; adding a new utility item using the `net` or `flask` fallback requires no new game build. See [runtime content](RUNTIME_CONTENT.md).

Throwing is currently an animation preview: press T in camp or Throw preview on Character. It does not consume either hand weapon or belt item, spawn a damaging projectile or alter progression. The clip's single release marker is the future integration point for spear, net or grenade projectiles. See [throw animation](THROW_ANIMATION.md).
