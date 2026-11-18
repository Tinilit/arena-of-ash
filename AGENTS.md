# Repository conventions

- Write source code, identifiers, comments, UI strings, documentation and commit messages in English.
- Converse with the user in Ukrainian unless they request another language.
- Use Ash Vanguard art and Grounded motion only. Do not reintroduce Style Studio, alternate visual styles or paired warglaives unless the user requests them.
- Keep gameplay rules independent of Phaser. Use the existing checkout, Node.js 22 and the commands documented in README.md.

- Keep both legs below the skirt and the free front arm behind the torso and the armed rear arm in the foreground, with their own shoulder attachments. Shields are temporarily omitted from the default catalog and opponent loadouts.

- The primary weapon uses the rear/far hand; keep the front/near hand relaxed, with a softly flexed elbow and neutral wrist. Keep arm depth separate from shoulder transforms: front/free behind torso, rear/armed in front. Retain front-hand attack support and explicit hand mounts for future equipment. Camp movement previews must not deal damage or change saved progression. Arena combat is real time: HP changes require blade/body contact during an active swing, at most once per swing. Keep simulation and collision geometry independent of Phaser; read the actual rendered joint transforms for arena hitboxes.
