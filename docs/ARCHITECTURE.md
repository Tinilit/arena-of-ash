# Architecture

`main.ts` owns one Phaser game and destroys it on hot replacement. `app/config.ts` defines a 1280×720 logical area with FIT scaling, WebGL preference/Canvas fallback, and six scenes. Boot loads `Services` into the Phaser registry; it owns the player and SaveStore. Appearance is fixed to Ash Vanguard and motion to Grounded, independently of any obsolete browser preference values.

Scene flow: Boot → MainMenu → Arena / Character / Shop. Arena → Result → MainMenu / Arena. Escape returns to camp and abandons unresolved combat. There is no studio or style-selection scene.

`domain` defines player attributes, inventory, equipment, derived statistics, transactions and progression. The external JSON has nine default equipment definitions; `data/catalog.ts` exposes the installed session catalog, three enemies and rewards. Pure `combat/realtime.ts` owns continuous fighter state, action/stamina rules, movement, jumping and outcomes. `combat/geometry.ts` handles moving capsule contact; `ArenaAI.ts` chooses movement/actions. None imports Phaser.

Battle flow is Fighting → Victory / Defeat / Draw. ArenaScene accumulates frame time into 120 Hz substeps, capped at 100 ms per rendered update to avoid fast-forwarding through a suspension. Each step advances both fighters, composes and renders their poses, then reads actual world-space body/blade geometry. Contact resolution sweeps both moving shapes over the same interval and applies damage only in active swing windows. A swing ID and hit flag prevent repeated damage. Both contacts in a simultaneous trade resolve before choosing an outcome. Animation impact markers do not apply damage. Rewards are persisted before ResultScene and use battle IDs to prevent duplicate payouts.

`characters/ArenaMotion.ts` layers action torso/weapon targets over locomotion legs and the passive arm. Ballistic jump height lives in the pure fighter state rather than in a second visual-only displacement. The original cutout shoulder hierarchy, fixed bone lengths, free-arm depth, future front-hand attacks and camp previews remain. Scene shutdown clears keys, pointer holds and focus handlers. Focus loss pauses combat; resume starts with no accumulated simulation backlog.

`characters` owns the articulated rig, pure keyframe playback, constrained two-bone IK and equipment-specific spear motion. `rendering` owns procedural Ash artwork and gear adapters. `ui` provides buttons, panels, bars and English strings. Scenes coordinate those components without duplicating damage formulas. Phaser scene-local objects/timers/tweens are disposed on shutdown; keyboard listeners and animator callbacks are explicitly cleaned up.

Persistence key: `arena-of-ash.v1`, format `{version:1,player:Player}`. Saved data includes identity, level/remaining XP, gold, base attributes, points, owned item IDs, equipped slots, opponent progression and reward IDs. Derived stats, battle HP/stamina and visual state are omitted. Essential fields, known catalog references and ownership are validated. Missing, malformed or unsupported saves use a default warrior. Storage exceptions preserve session play with a warning. No retired-equipment or appearance-setting migration is provided.

Shop and inventory page their lists without changing definitions or ownership. New equipment extends the catalog and renderer; art replacement preserves pivots and leaves game rules untouched. The read-only development snapshot is unavailable through the production entry point. See [animation](ANIMATION_SYSTEM.md), [anatomy](ANTHROPOMETRY.md), [equipment](EQUIPMENT.md) and [art contract](ART_PIPELINE.md).

## Runtime catalog

Boot fetches and validates `public/content/items.json`, installs a session catalog, decodes optional item images, then loads the player save and starts camp. Gameplay rules keep synchronous catalog lookups. `src/content/schema.ts` is independent of Phaser; `loadCatalog.ts` owns timeout/fallback behavior; `textures.ts` registers runtime artwork. `src/data/catalog.ts` retains opponent/reward definitions and the catalog lookup API. The JSON imported at build time is only an included fallback. See [runtime content](RUNTIME_CONTENT.md) for the separate publication path.

## Display density

`app/display.ts` manages physical canvas size, camera zoom and text raster resolution while retaining 1280×720 world coordinates. Every scene prepares its camera before creating content; the shared label factory registers text for density changes and removes destroyed labels. Window resizing and DPR changes update existing scenes without recreating combat or player state. Graphics render at the higher backing resolution; label textures are rerasterized rather than enlarged from a 1× bitmap. See [display scaling](DISPLAY_SCALING.md).
