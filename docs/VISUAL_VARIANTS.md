# Character art and motion variants

Open **Style Studio** from the camp menu to compare three complete presentation options. The default remains **Original**. All previous artwork and animation data are retained.

| Option       | Artwork                                                                                               | Motion                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Original     | Unchanged M1 procedural parts and equipment                                                           | Unchanged M1 clip library                                                            |
| Bronze Hero  | Bold face with beard, warm bronze trim, modeled limbs, leather wraps, detailed weapon grip and shield | Short anticipation, clear impact, follow-through, recovery and secondary body motion |
| Ash Vanguard | Angular face with scar, cool steel, dark cloth and restrained highlights                              | Slower, deliberate quick/heavy attacks and measured idle breathing                   |

Each option includes the same eight clips: idle, quick, heavy, defend, recover, hit, death and victory. Enhanced attacks add staggered arm/torso/head motion, leg bracing and follow-through keyframes. The weapon remains attached to the hand; equipment and mirrored opponents share the existing skeleton.

## Comparison and rollback

The studio previews all three styles side by side, with buttons for every animation. **Preview gear** toggles between the player's current gear and a complete demonstration kit; it never grants or equips items on the real player. **Mirror previews** checks the opposite facing direction. The comparison stage automatically frames each articulated pose to keep raised weapons and collapses clear of the controls. The short preview lunge is deliberately reduced to keep each figure within its comparison card; actual arena attacks retain full travel.

**Use this style** selects artwork and motion together for subsequent scenes and battles. To restore the previous presentation at any time, select **Original**. No option is removed when another is selected. The pre-variant implementation is also available in Git commit `d1370bc`.

Selection uses a separate localStorage key, `arena-of-ash.presentation.v1`, whose value is `original`, `bronze`, or `ash`. Invalid values fall back to `original`; unavailable storage permits session-only selection. The existing player save, equipment ownership, attributes, rewards and damage rules are unchanged. Resetting game progression does not erase the presentation choice.

## Code boundaries

- `rendering/parts.ts`: preserved original visuals.
- `rendering/characterVisuals.ts`: style-aware drawing adapters and two additional procedural visual sets.
- `characters/animation.ts`: original clip data plus the animator, which accepts a clip library.
- `characters/motionProfiles.ts`: additional immutable motion libraries; `original` directly references the preserved original library.
- `characters/presentation.ts`: valid style identifiers and resilient preference persistence.
- `scenes/StyleStudioScene.ts`: comparison controls and preview-only models.

Styles change presentation only. Combat still resolves one pending event at its selected clip's impact keyframe. The same cancellation, shutdown and completion lifecycle applies to every library. Adding another option requires a style identifier, visual palette/geometry, motion library and centralized English captions; it must preserve existing options.

Unit tests exercise each profile's impact once, interruption, stopped callbacks, held death, keyframe integrity and unchanged library data. Browser tests preview animations, compare equipped/current gear and mirroring, check reload persistence, perform real attacks in both new styles, and restore Original without changing player progression.

Procedural Graphics do not supply geometry bounds in Phaser. The visual adapters wrap each drawing with a non-rendering Zone that carries its conservative local art bounds. The studio uses their transformed union to frame complete poses, and browser assertions check those bounds against the preview stage. Zones have no pointer handlers and do not alter combat or render visible artwork.

## Grounded and Legacy motion

Style Studio now has an independent **Motion: Grounded / Motion: Legacy** switch. Grounded is the default correction for limb proportions, waist pivot, elbow/knee mechanics, wrist grip and planted feet. Legacy restores the original skeleton and previously supplied motion sets for every style. Selecting Original preserves the original artwork; combine it with Legacy to restore the full M1 presentation. Motion choice persists under its own key and never changes progression. See [anthropometry](ANTHROPOMETRY.md).
