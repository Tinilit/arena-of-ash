# Art asset contract

M1 needs no assets. Future artwork must be original transparent PNG (sRGB, clean alpha, no baked shadows or background). Later atlases may preserve the same frame metadata. Files live under `public/assets/`.

Use names such as `body/torso.png`, `body/head.png`, `body/near-upper-arm.png`, `body/near-forearm.png`, `body/near-hand.png`, `body/near-thigh.png`, `body/near-shin.png`, `body/near-foot.png` and matching far-side parts. Equipment uses stable IDs: `equipment/iron.png`, `equipment/plate.png`, `equipment/cap.png`, `equipment/shield.png`.

Recommended source resolution is 2× logical size: torso 144×180; head 112×128; upper arm 64×104; forearm 64×96; hand 56×56; thigh 80×120; shin 64×116; foot 100×52; sword 64×240; spear 64×336; shield 136×184. These are recommendations, not fixed texture assumptions. Transparent margins should allow antialiasing (4 source pixels); do not add excessive padding merely to align parts.

Supply per-part metadata in logical pixels: `{ texture, logicalWidth, logicalHeight, pivot: {x,y}, attachments: {elbow:{x,y}} }`. For example an upper arm extends down from a shoulder pivot; elbow attachment is (0,38). A forearm extends down to hand (0,35). Use the documented rig's shoulder, hip, elbow and knee positions. A sword grip must align to the hand origin; the M1 source blade points toward negative Y; its hand attachment rotates it by π so it extends past the grip along the forearm. Chest artwork aligns to torso origin, helmet to head origin, shield to far hand origin. Keep pivots stable across replacement gear.

Depth is explicit container order: far limbs/shield → torso/chest → head/helmet → skirt → near leg → near arm/weapon. Keep face visible in side view; author characters facing positive X. Enemy mirroring happens at root, including equipment; do not duplicate mirrored PNGs. Avoid text baked into mirrored artwork.

Replace `part(scene,kind,color)` or `gear(scene,id)` with image objects in `rendering/parts.ts`. Set display size to logical size and normalized image origin to `pivot / logical dimensions`; return the same PartVisual union. Preload textures in BootScene before entering the menu. Keep procedural visuals as fallback for absent keys. No animator, combat formula, AI, save schema, or scene positioning should need to change. Start by integrating one complete fighter and verify every joint at idle, wind-up, impact, death and mirrored poses before expanding the catalog.
