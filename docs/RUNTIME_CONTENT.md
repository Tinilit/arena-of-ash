# Runtime equipment content

Equipment is data loaded over HTTP at startup. Updating item definitions or image files does not require compiling or deploying the game JavaScript. There is no in-game editor or database server.

## Edit and publish

1. Add a PNG or WebP file to `public/content/items/`, if a new picture is needed. Keep the Ash Vanguard art direction. Existing procedural visuals can be reused without an image.
2. Add or edit a record in the `items` array of `public/content/items.json`.
3. Change the top-level `revision`, for example to `2026-11-18-1`. This also refreshes image URLs, including when overwriting an existing filename.
4. Run `npm run check:content` locally, then commit and push the content files to `main`.
5. Refresh the game page. A running session keeps its original catalog until refresh, so publishing balance changes cannot alter a battle halfway through.

In development, the catalog is fetched from `/content/items.json`. The public Pages build fetches [the same file on main](https://raw.githubusercontent.com/Tinilit/arena-of-ash/main/public/content/items.json), and images are resolved beside that file. GitHub's raw-content service allows browser requests. Repository content must remain publicly readable; this mechanism does not expose private-repository credentials. GitHub/CDN propagation may briefly delay an update even though the loader requests a fresh catalog.

Content-only changes under `public/content/**` run **Validate runtime content**. They skip **Validate and deploy game**, including both game builds and Pages deployment. The raw files become available from main independently of the validation job; validate before pushing or use a pull request. Mixed content/code changes run the normal game workflow as well.

The loader must first ship through one normal game build. Subsequent item/image updates require only content publication. On another static host, uploading those files beside the catalog is sufficient; no build tool is needed. A deployment can set `VITE_CATALOG_URL` at build time to select that host's catalog URL. A separate origin must allow CORS for JSON and image requests. For a same-origin production installation use an absolute public catalog URL, including any site subdirectory.

## Add an item

Append this object to the existing `items` array; do not replace the entire catalog with this example:

```json
{
  "id": "frost-spear",
  "name": "Frost Spear",
  "slot": "weapon",
  "price": 140,
  "attack": 13,
  "armor": 0,
  "visual": "war-spear",
  "weaponType": "spear",
  "description": "A steel spear with an ashwood haft.",
  "image": {
    "src": "items/frost-spear.png",
    "width": 38,
    "height": 244,
    "originX": 0.5,
    "originY": 0.63
  }
}
```

Supply your own `frost-spear.png`, or omit `image` to use the existing war-spear drawing. The example item is not included in the live catalog. New valid definitions appear automatically in the paginated shop and inventory. Purchasing, equipping, combat stats and saves all use the loaded catalog. Existing item IDs keep ownership while changes to their stats and art take effect on refresh.

## Fields

The top level contains `version: 1`, a nonempty `revision` up to 64 characters, and `items` (6–1000 definitions). Array order determines shop order.

| Field             | Contract                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`              | Unique stable ID, up to 64 characters; starts with a lowercase letter and contains only lowercase letters, digits or hyphens |
| `name`            | English display name, 1–36 characters                                                                                        |
| `slot`            | `weapon`, `helmet`, `chest`, `utility` or `shield`                                                                           |
| `price`           | Integer, 0–1,000,000 gold                                                                                                    |
| `attack`, `armor` | Integer bonuses, 0–10,000 each                                                                                               |
| `visual`          | Procedural fallback from the slot's list below; required even with a custom image                                            |
| `weaponType`      | Weapon animation: `sword` (default) or `spear`; spears must use a spear fallback                                             |
| `description`     | Optional English text, 1–64 characters                                                                                       |
| `use`             | Optional utility action: `throw` or `drink`                                                                                  |
| `heal`            | Required for `drink`, integer 1–100 HP; invalid on other items                                                               |
| `image`           | Optional image path, logical dimensions and normalized pivot coordinates                                                     |

| Slot    | Valid procedural fallbacks                         |
| ------- | -------------------------------------------------- |
| Weapon  | `wood`, `rust`, `iron`, `spear`, `war-spear`       |
| Helmet  | `cap`, `viking`                                    |
| Chest   | `leather`, `plate`                                 |
| Utility | `throwing-knife`, `throwing-axe`, `healing-potion` |
| Shield  | `shield`, `tower`                                  |

New sword or spear designs, helmets, chest pieces and utility attachments need no new game code. Shield drawings can be defined, but restoring an equippable shield position requires a game change. New slots, effects, weapon behaviors or animations require an engine change. A database can later serve the same JSON contract through an API; a browser cannot directly query a private database.

Keep IDs `wood`, `rust`, `iron`, `leather`, `plate`, `cap`, `throwing-knife` and `throwing-axe` in their existing slots because the starter and opponents reference them. Their names, prices, bonuses and images may change. Removed net/flask IDs are discarded from saves without resetting coins or other equipment. Other unknown IDs retain the existing reset behavior.

## Image alignment

Use transparent PNG/WebP artwork facing right. The weapon image points upward before mounting; the wrist supplies the in-game rotation. `src` is a relative path beneath the catalog directory, ending in `.png`, `.webp`, `.jpg` or `.jpeg`. Parent-directory traversal, absolute URLs and query strings are rejected. The loader adds the revision query itself.

`width` and `height` are logical rendered dimensions (1–600), independent of the source resolution. `originX` and `originY` range from 0 to 1 and locate the grip/attachment within the full image rectangle. `(0, 0)` is the top-left; `(1, 1)` is the bottom-right. That attachment is placed at the hand, head or chest joint. The same image appears in the shop, camp, character screen and arena, inheriting movement and facing from the rig.

Useful starting values matching existing silhouettes:

| Art           | Width × height | Origin X / Y |
| ------------- | -------------- | ------------ |
| War spear     | 38 × 244       | 0.5 / 0.63   |
| Sword         | 44 × 128       | 0.5 / 0.78   |
| Tower shield  | 84 × 169       | 0.5 / 0.42   |
| Horned helmet | 120 × 104      | 0.5 / 0.80   |
| Chest armor   | 70 × 59        | 0.5 / 0.05   |

Shields are not currently equippable; restoring them requires an explicit position/renderer rule. See [render order](RENDER_ORDER.md). Artwork is a rigid attachment; an image cannot introduce extra moving joints. Inspect grip, face clearance and UI framing after adding a new silhouette. Existing anatomy checks establish the authored motion, not clearance for every possible custom drawing.

## Failure handling

The catalog is fetched and fully validated before the save is read. A network error, timeout, invalid JSON or invalid definition selects the catalog bundled with that game build and displays a short notice. No partial catalog is installed. Optional images load with bounded concurrency and a shared eight-second budget; unavailable or undecodable artwork uses the item's procedural fallback while its live stats remain active. JSON fetching has its own eight-second timeout. The included fallback's images resolve against the site's bundled `content/` folder.

No polling, filesystem watching, arbitrary script execution or mid-session catalog mutation is exposed. Browser games need an explicit JSON index: simply uploading an unreferenced image cannot create an item.

Gameplay tests use a fixed catalog fixture so new live definitions, reordering or balance edits do not require changing gameplay assertions. Content validation reads the actual publication file and checks every referenced local image.

The current default catalog has twelve items and intentionally omits shields. Shield fallback drawings are retained for a later explicit restoration, but there is no active shield equipment position; no opponent currently references a shield definition, so the old `shield` ID is no longer mandatory. The character UI exposes Helmet, Body, Right hand, Left hand and two Belt positions, filtering compatible catalog categories for each.

## Weapon contact shape

Real-time combat uses a capsule along the weapon's local Y axis. Only a sword blade or spear leaf head deals damage; the grip/haft is excluded. Optional weapon or throwable metadata can author this independently of the image size, without rebuilding:

```json
"hitbox": { "startY": -150, "endY": -113, "radius": 6 }
```

Coordinates are logical pixels relative to the image grip before the rig's rotation, scale and facing. Negative Y points toward the blade tip. `startY` must be less than `endY`, both within -600…600; radius must be 0.5…40. These endpoints bound the whole capsule, including its round ends. Put the shape inside the visible damaging blade. There is one damaging capsule per weapon. Body collision remains rig-authored.

If omitted, included drawings use their authored blade/head dimensions. Runtime images use a conservative estimated blade/head region; supply `hitbox` to align unusual artwork. If an image fails to decode, both the visual and collision profile use the procedural fallback, while live stats remain active. Existing session definitions stay stable until refresh. See [real-time combat](REALTIME_COMBAT.md).

Utility records with `use: "throw"` launch from a belt with Q/E; `attack` supplies the throwable bonus. Optional `hitbox` also applies to throwables. `use: "drink"` requires a positive `heal` (1–100). The built-in potion uses `visual: "healing-potion"`, `heal: 35` and price 30. Carried utility stats do not stack into other actions. Each use consumes one copy at release/sip; thrown copies can be recovered from the ground with G, while used potions remain consumed. Consumables support repeat/bulk purchases and one copy per battle slot; prices, healing and artwork can be edited in JSON.

`hands` is an optional weapon-only integer (1 or 2). Two-handed items reserve both hand slots but store one ID in `rightHand`. New fallback visuals are `greatsword`, `war-hammer` and `battle-axe`; all require `hands: 2`. Their matching weapon types are `sword`, `hammer` and `axe`. Hammer/axe types require the matching heavy fallback. Default hitboxes damage only the blade or heavy head; the shaft is reserved for the separate zero-damage shove. Valid custom definitions can use these existing animation/visual families without rebuilding.

The `crossbow` fallback uses `weaponType: "crossbow"` and `hands: 2`. Its `attack` bonus applies to each bolt, not held-stock melee. The built-in renderer animates string tension and the loaded bolt. Bolts are runtime projectiles rather than catalog ownership records.

Additional procedural visuals are `chainmail` (chest), `legionary-helm` (helmet), `trident` (weapon, `hands: 2`, `weaponType: "spear"`) and `speed-potion` (utility). The haste consumable uses `use: "drink"`, `effect: "haste"`, `durationMs: 10000`, `speedMultiplier: 2` and no heal field. Its displayed default duration and multiplier are validated together. The trident head hitbox is -195 to -144 with radius 17; its shaft cannot award damage.
