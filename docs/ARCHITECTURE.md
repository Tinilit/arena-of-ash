# Architecture

`main.ts` owns one Phaser game and destroys it on hot replacement. `app/config.ts` defines 1280×720 FIT scaling, WebGL preference/Canvas fallback, and six scenes. Boot loads `Services` into the Phaser registry; it owns the player and SaveStore. Appearance is fixed to Ash Vanguard and motion to Grounded, independently of any obsolete browser preference values.

Scene flow: Boot → MainMenu → Arena / Character / Shop. Arena → Result → MainMenu / Arena. Escape returns to camp and abandons unresolved combat. There is no studio or style-selection scene.

`domain` defines player attributes, inventory, equipment, derived statistics, transactions and progression. `data/catalog.ts` holds eleven equipment definitions, three enemies and rewards. `combat` owns a pure Battle state machine and AI, with injected seeded randomness. None of these rules import Phaser.

Battle flow is PlayerTurn → PlayerAnimating → EnemyThinking → EnemyAnimating → PlayerTurn, or Victory/Defeat. `begin` creates a pending result and locks input. The animator's impact calls `impact` once; `complete` advances the state after animation completion. Pending-event identity and event IDs reject repeated impacts. Rewards are persisted before ResultScene and use battle IDs to prevent duplicate payouts.

`characters` owns the articulated rig, pure keyframe playback, constrained two-bone IK and equipment-specific spear motion. `rendering` owns procedural Ash artwork and gear adapters. `ui` provides buttons, panels, bars and English strings. Scenes coordinate those components without duplicating damage formulas. Phaser scene-local objects/timers/tweens are disposed on shutdown; keyboard listeners and animator callbacks are explicitly cleaned up.

Persistence key: `arena-of-ash.v1`, format `{version:1,player:Player}`. Saved data includes identity, level/remaining XP, gold, base attributes, points, owned item IDs, equipped slots, opponent progression and reward IDs. Derived stats, battle HP/stamina and visual state are omitted. Essential fields, known catalog references and ownership are validated. Missing, malformed or unsupported saves use a default warrior. Storage exceptions preserve session play with a warning. No retired-equipment or appearance-setting migration is provided.

Shop and inventory page their lists without changing definitions or ownership. New equipment extends the catalog and renderer; art replacement preserves pivots and leaves game rules untouched. The read-only development snapshot is unavailable through the production entry point. See [animation](ANIMATION_SYSTEM.md), [anatomy](ANTHROPOMETRY.md), [equipment](EQUIPMENT.md) and [art contract](ART_PIPELINE.md).

## Runtime catalog

Boot fetches and validates `public/content/items.json`, installs a session catalog, decodes optional item images, then loads the player save and starts camp. Gameplay rules keep synchronous catalog lookups. `src/content/schema.ts` is independent of Phaser; `loadCatalog.ts` owns timeout/fallback behavior; `textures.ts` registers runtime artwork. `src/data/catalog.ts` retains opponent/reward definitions and the catalog lookup API. The JSON imported at build time is only an included fallback. See [runtime content](RUNTIME_CONTENT.md) for the separate publication path.
