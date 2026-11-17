# Architecture

`main.ts` owns one Phaser instance and destroys it on hot replacement. `app/config.ts` sets the logical resolution, FIT scaling, centered canvas, 60 FPS target, and renderer fallback. `BootScene` loads a single `Services` instance into the Phaser registry. Services owns the player and SaveStore; scene-local objects never enter saves.

`domain` defines player identity, attributes, equipment references, inventory, derived statistics, progression and transactions. `data` holds typed items, enemy definitions and reward configuration. `combat` is independent of Phaser: Battle owns two combat snapshots and its finite state machine; AI uses the same action definitions as the player. `utils/random` supplies injectable deterministic randomness.

`characters` owns the articulated rig and pure keyframe animator. `rendering` supplies procedural scenery and replaceable part visuals. `ui` supplies panels, buttons, bars and centralized English strings. Scenes coordinate presentation and commands, without implementing damage formulas.

Scene flow: Boot → MainMenu → Arena / Character / Shop. Arena → Result → MainMenu / Arena. Escape returns to MainMenu and abandons unresolved battle state. Scene-local timers, game objects and tweens are disposed by Phaser; keyboard listeners and animator callbacks are explicitly stopped on shutdown.

Battle flow: PlayerTurn → PlayerAnimating → EnemyThinking → EnemyAnimating → PlayerTurn. Each side's completion can instead lead to Victory or Defeat. A pending event locks input. `begin` calculates a result; the animator's impact callback calls `impact` once, which mutates HP, stamina and guard. `complete` requires impact and advances the state after animation ends. A unique event ID and pending-event identity reject duplicate/stale impacts. The event carries attacker/defender, damage, critical, hit, cost, HP delta and outcome. Enemy decisions occur after a Phaser-owned thinking timer, not a guessed animation delay.

Rewards are applied before ResultScene. A unique battle ID in the player's rewarded list makes reward transactions idempotent, including after serialization. The result scene only displays its supplied payout.

## Persistence

Key: `arena-of-ash.v1`. Format: `{ "version": 1, "player": Player }`. Player contains identity, level, remaining XP, gold, base attributes, unspent points, owned definition IDs, slot-to-definition references, enemy progression index and completed reward IDs. Derived stats, HP, stamina and visual state are omitted. Definitions are separate from ownership; M1 allows one owned copy of each definition.

Loading validates essential numeric fields, attributes, known inventory definitions, matching equipment slots and ownership. Missing, malformed or unknown-version saves start a default warrior. Storage access errors never crash gameplay; saving failures show a warning on subsequent scene entry. Future schema changes should add explicit migrations before accepting a new version. Saves are untrusted local state, not an anti-cheat boundary.

## Extension points

Add typed data for new gear, opponents and actions. Extend centralized stat calculations rather than scenes. Replace `part` and `gear` factories with texture-backed GameObjects using the same joint origins. Add animations as clip data. Add localization by replacing the centralized string table and localized data names. Domain logic must never import Phaser or scenes.
