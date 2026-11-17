# Equipment

The default runtime catalog contains nine items: Wooden Sword, Rusty Sword, Iron Sword, Training Spear, Ashwood War Spear, Leather Vest, Iron Chestplate, Leather Helmet and Viking Warhelm. Slots currently used are weapon, chest and helmet. Shields are temporarily omitted from the catalog and all opponent loadouts. Dormant shield drawings/slot support remain available for a later explicit restoration.

Ashwood War Spear costs 115 gold and adds +10 attack. Viking Warhelm costs 60 gold and adds +3 armor. Spears have a wooden haft, socketed head and butt cap and use thrust animations. The helmet has a horned dome, riveted brow and nasal guard. All artwork uses Ash Vanguard colors.

Shop and inventory display eight definitions per page. In the default catalog, the war spear is on shop page 1 and the Viking helmet is on page 2. A purchased item retains its page while the scene refreshes. Buy once, then equip through the character screen. There is no paired weapon or studio.

Definitions live in `public/content/items.json`; images can be added under `public/content/items/`. Rendering uses the equipped item metadata, keeping gameplay rules independent of Phaser. No migration or refund logic is added for removed items. See [runtime content](RUNTIME_CONTENT.md) for validation and publication without a game rebuild.

The character uses continuous limb silhouettes, full-width calf greaves and leather ankle boots. The free front arm renders behind the torso, while the rear arm and primary weapon render in front; both thighs are under the skirt. See [rig refinement](RIG_REFINEMENT.md).
