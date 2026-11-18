# Repository conventions

- Write source code, identifiers, comments, UI strings, documentation and commit messages in English.
- Converse with the user in Ukrainian unless they request another language.
- Use Ash Vanguard art and Grounded motion only. Do not reintroduce Style Studio, alternate visual styles or paired warglaives unless the user requests them.
- Keep gameplay rules independent of Phaser. Use the existing checkout, Node.js 22 and the commands documented in README.md.

- Keep both legs below the skirt and the free front arm behind the torso and the armed rear arm in the foreground, with their own shoulder attachments. Shields are temporarily omitted from the default catalog and opponent loadouts.

- The right-hand primary weapon uses the rear/far hand; an empty right hand falls back to the equipped left/front hand using its own action library and collision transform. A second weapon is carried without automatic dual attacks. Belt items are visible but inactive. Keep the front/near hand relaxed, with a softly flexed elbow and neutral wrist. Keep arm depth separate from shoulder transforms: front/free behind torso, rear/armed in front. Retain front-hand attack support and explicit hand mounts for future equipment. Camp movement previews must not deal damage or change saved progression. Arena combat is real time: HP changes require blade/body contact during an active swing, at most once per swing. Keep simulation and collision geometry independent of Phaser; read the actual rendered joint transforms for arena hitboxes.

- Keep gameplay and UI coordinates in the 1280×720 logical space. Use the shared `label` factory for text so display density and texture cleanup are managed. Canvas backing dimensions are physical render pixels, not gameplay bounds.

- Item categories and equipment positions are separate. Keep slot compatibility, unique equipped IDs and primary-hand selection in the pure domain layer. Stamina regenerates throughout active combat; do not reintroduce player Defense/Recover buttons or bindings. Throw previews must not consume inventory or deal damage.
