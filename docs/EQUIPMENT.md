# Equipment and loadout

The default runtime catalog contains eleven items: five swords/spears, two helmets, two chest pieces, Folded Arena Net and Clay Training Flask. Shields and paired warglaives remain absent. Item categories in JSON remain `weapon`, `helmet`, `chest` and `utility`; they are distinct from the character's equipment positions.

| Position    | Accepted category | Behavior                                                         |
| ----------- | ----------------- | ---------------------------------------------------------------- |
| Helmet      | helmet            | Head attachment and armor                                        |
| Body        | chest             | Torso attachment and armor                                       |
| Right hand  | weapon            | Primary rear-hand weapon                                         |
| Left hand   | weapon            | Carried second weapon; becomes active if the right hand is empty |
| Belt slot 1 | utility           | Visible inactive waist attachment                                |
| Belt slot 2 | utility           | Visible inactive waist attachment                                |

Select a slot card on Character, then equip an owned compatible item from the filtered, paginated list. The × button removes gear without deleting ownership. Equipping an ID in another compatible position moves it instead of creating a duplicate. The save validator enforces category, ownership and one equipped instance per ID. Save version 2 starts a new loadout rather than migrating old layouts.

Right-hand attacks retain the rear/far shoulder. Left-hand fallback selects the existing front-hand action library and its actual weapon matrix for contact. When both hands are equipped, only the right weapon contributes attack stats or damage; the left weapon remains carried. Active helmet/body/primary-weapon bonuses are counted; carried offhand and utility bonuses are excluded. Utility attachments contribute no stats or use actions. The starter owns and wears the net and flask on the two belt mounts. Their drawings follow the pelvis above the skirt and below the foreground arm.

Shop displays eight definitions per page. Ashwood War Spear remains on page 1 and Viking Warhelm on page 2. Character inventory displays up to eight compatible owned items per page. The runtime catalog/image workflow remains file-based; adding a new utility item using the `net` or `flask` fallback requires no new game build. See [runtime content](RUNTIME_CONTENT.md).

Throwing is currently an animation preview: press T in camp or Throw preview on Character. It does not consume either hand weapon or belt item, spawn a damaging projectile or alter progression. The clip's single release marker is the future integration point for spear, net or grenade projectiles. See [throw animation](THROW_ANIMATION.md).
