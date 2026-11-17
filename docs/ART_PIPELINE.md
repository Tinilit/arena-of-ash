# Ash Vanguard art contract

The sole supported visual style is Ash Vanguard: cool steel, dark blue cloth, angular features and restrained highlights. Procedural parts in `rendering/characterVisuals.ts` and equipment in `rendering/extendedGear.ts` keep the game independent of external assets. Future PNG/atlas artwork should replace these visuals while retaining the Grounded rig's pivots and attachment rules.

Use original transparent sRGB PNGs with clean alpha, no baked backgrounds or ground shadows. Recommended source scale is 2× logical dimensions: torso 144×180, head 112×128, upper arm 64×104, forearm 64×96, hand 56×56, thigh 80×136, shin 64×128, foot 100×52, sword 64×240, spear 80×500, helmet 240×208 and tower shield 168×338. These are art recommendations, not hard texture requirements. Allow four source pixels for antialiasing rather than excessive alignment padding.

Name parts `body/torso.png`, `body/head.png`, `body/near-upper-arm.png`, `body/near-forearm.png`, `body/near-hand.png`, `body/near-thigh.png`, `body/near-shin.png`, `body/near-foot.png`, with matching far-side parts. Equipment uses stable definition/visual IDs, such as `equipment/war-spear.png`, `equipment/viking.png` and `equipment/tower.png`.

Supply metadata in logical pixels: `{texture, logicalWidth, logicalHeight, pivot:{x,y}, attachments:{...}}`. Shoulder/elbow/hip/knee pivots begin each limb; the distal joint must match the documented 40/34 arm and 54/52 leg lengths. The torso drawing sits 76 units above the waist joint; head origin is (0,-84) relative to waist. See [anatomy](ANTHROPOMETRY.md).

A weapon's local grip is (0,0), with its blade toward negative Y. The hand mount rotates it by π/2, with separate wrist rotation. Shield artwork centers on its grip and is counter-rotated upright; helmet aligns to the head. Author parts facing +X; root mirroring handles the opponent. Do not duplicate mirrored assets or bake text into them.

The adapters return containers with visuals and non-rendering local bounds Zones. Texture-backed images can replace the procedural drawing while preserving the bounds/pivots. Graphics alone do not supply geometry bounds in Phaser. Layer far limbs behind torso, then chest/head/helmet, near limbs and weapon; place the tower-shield arm above the torso below the weapon arm. Preload required textures in BootScene and keep procedural fallback for missing keys. Combat rules, AI, progression and saves must remain unchanged when art is replaced.

## Runtime item images

Optional item PNG/WebP images are loaded from `public/content/items/` through the external catalog. They replace the selected gear drawing in every scene while retaining joint attachment and sword/spear behavior. The catalog specifies dimensions and normalized pivots. See [runtime content](RUNTIME_CONTENT.md). Body-part and animation replacement still requires code changes.
