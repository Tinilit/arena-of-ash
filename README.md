# Arena of Ash

An original single-player gladiator action RPG built with TypeScript, Phaser **3.90.0** and Vite. The English interface, procedural **Ash Vanguard** artwork, **Grounded** articulated animation and physical combat engine are preserved.

## Run and verify

Use Node.js **22 LTS** and npm:

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run check:content
npm run test:e2e
npm run build
npm run preview
```

Install the browser with `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install --with-deps chromium` if system Chromium is unavailable. On the managed cloud workspace, activate `export PATH=/workspace/.arena-tools/node_modules/.bin:$PATH`. `CHROMIUM_PATH` selects another browser executable. Playwright starts Vite and stores screenshots/traces under `test-results/`.

## Progression

A new gladiator owns only a Wooden Sword, has 100 gold, empty belt slots and **zero advanced skills**. Basic movement, running, jumps/hops, one one-handed melee weapon, stance changes, light armor, inventory and pickups are available immediately. There are no levels, XP, attributes, stamina or skill upgrades.

Every completed victory, defeat or draw grants **one exclusive post-battle choice**:

- **Learn a Skill:** choose one of two random eligible abilities; learning is immediate. Offers persist across reloads.
- **Visit Shop:** buy equipment, bulk consumables and sell unequipped copies through the shop's equipment screen. Closing the shop ends this visit.

The shop is accessible only through this choice. Gladiator shows only learned skills; Camp has no separate Skills button. After all currently available skills are learned, only Visit Shop remains. The decision, selected branch and its consumption are saved immediately. Reload resumes the decision/training/shop visit; it never grants another reward or skill. Escape during an unfinished fight gives neither reward nor choice.

Victory grants 50 gold and advances the ladder; defeat/draw grant 10 gold without advancement. Victory keeps the arena open for grounded equipment collection until Continue. Defeat/draw proceed automatically after the short presentation. The 18-encounter ladder has a fixed boss after each five challengers; further wins unlock elite exhibition fights.

See [skills, prerequisites, balance and persistence](docs/SKILL_PROGRESSION.md).

## Controls

The arena legend follows the gladiator's learned skills. Combat uses the mouse and keyboard. The live Hit pause controls toggle the optional 200 ms impact pause and adjust its duration without stopping Auto Battle.

| Input                | Action                                         | Requirement                                      |
| -------------------- | ---------------------------------------------- | ------------------------------------------------ |
| A/D or arrows, Shift | Walk / run                                     | Basic                                            |
| Space, A/D+Space     | Jump / directional hop                         | Basic                                            |
| S, S again           | Planted lean dodge / sharp backward retreat    | Basic                                            |
| R, G                 | Stance / grounded equipment pickup             | Basic                                            |
| LMB/J/1, RMB/K/2     | Front / rear hand light attack                 | One melee weapon is basic; Dual Wielding for two |
| Mouse                | Slight melee aim / ranged aim                  | Marksmanship for ranged weapons                  |
| F/3                  | Ground or airborne front kick                  | Kicking                                          |
| H, A/D, H            | Lift, carry/turn, throw opponent               | Wrestling                                        |
| X                    | Bind and execute a grounded opponent           | Execution                                        |
| C                    | Timed parry, shove or a chance counter, disarm | Parrying                                         |
| Ctrl+hand attack     | Throw that hand's weapon                       | Throwing Weapons                                 |
| Q/E                  | Use the corresponding belt slot                | Throwing Weapons / Alchemy by item               |
| V                    | Two-handed shaft shove                         | Heavy Weapons                                    |
| Z                    | Battle Rage, once per fight                    | Battle Rage                                      |
| T                    | Forward jumping weapon strike                  | Superman Punch + one-handed melee weapon         |
| B                    | Resume / stop Auto Battle                      | Basic                                            |
| Escape               | Abandon unfinished combat / close a shop visit | No reward for abandonment                        |

Kip-Up, Berserker, Counterstrike and Second Wind are automatic learned abilities. Shield Bash requires Shield Mastery; Counterstrike requires Parrying. These are the only skill prerequisites. Crossbows require Marksmanship, independently of Heavy Weapons. Two-handed melee weapons require Heavy Weapons. Either hand input uses the same reserved two-handed weapon; one-handed attacks remain independent after Dual Wielding.

Auto Battle starts enabled and follows the player's actual skills, equipment and consumables. Enemies receive the same number of skills as the player and wear compatible equipment. Auto Battle schedules a usable skill after 1–3 accepted normal attacks; defensive reactions and useful drinks retain priority. Any gameplay key/button takes manual control; mouse movement only aims. Alt/Meta shortcuts preserve the mode. Focus loss releases held input while combat continues through headless background updates, including when RAF stops.

## Equipment, combat and saves

The default runtime catalog has 24 items in **Weapons, Armor and Misc**. Item cards show skill requirements before purchase; skill-locked owned equipment remains in the backpack. Equip fills eligible empty slots first, and replacing a single weapon without Dual Wielding keeps a valid one-weapon configuration. A two-handed item reserves both hands. Shields occupy the front hand and provide physical interception rather than passive armor.

Belt slots hold one copy each; consumable bundles of 1/5/10 accumulate in the backpack. Releasing a throw or sipping a potion consumes one copy and saves immediately. Interrupted wind-ups preserve it. G can recover landed thrown equipment, including enemy weapons, into an eligible empty slot or the backpack. Spare copies never refill battle slots automatically. Used potions and unrecovered equipment remain spent. Selling trades only an unequipped copy for half its purchase price, rounded down.

Combat retains 120 Hz simulation and actual swept weapon/projectile contact with the articulated body. Ordinary damage is the weapon's complete raw attack minus total worn helmet/body and rear-shield armor, floored at zero. Explicit learned skill modifiers are deterministic. Kicks and shaft shoves deal zero HP damage; valid bound executions are the guaranteed-impact exception. The rear-hand Arena Buckler (+3) and Tower Shield (+6) provide passive armor only. Shield Mastery unlocks them; heavy gear additionally requires Heavy Armor. Idle weapons and missed attacks deal no damage.

Head contacts wear the helmet; torso/limb contacts wear chest armor. Subtle cracks appear after 55% wear. Broken copies fly off and disappear permanently; surviving armor repairs after combat/exit/reload. Numeric popups show resolved damage.

Save **format 4** stores skills and the durable post-battle state, using the existing `arena-of-ash.v3` localStorage key so existing browsers retain their data. Formats 2/3 migrate explicitly: inventory, quantities, gold and progression survive; no advanced skills are granted, and restricted equipment returns to the backpack. Reset Progress clears skills, decisions and progression. Storage failures retain the existing session-only warning behavior. Unfinished combat itself is not serialized.

## Runtime content and rendering

Edit [`public/content/items.json`](public/content/items.json) and place optional art under `public/content/items/` to add/rebalance equipment without rebuilding. The public game loads validated content directly from `main`; malformed/unavailable content falls back to the bundled catalog. Skill requirements derive from equipment functionality. See [runtime content](docs/RUNTIME_CONTENT.md) and [equipment](docs/EQUIPMENT.md).

The logical area is 1280×720 with FIT scaling. Physical canvas/text density adapts to window size and DPR, retaining sharp large-screen text. See [display scaling](docs/DISPLAY_SCALING.md). The existing shoulder layers, exact bone lengths, two-hand grips and all attack/throw/get-up animations remain; new skill poses reuse that rig.

## Architecture and validation

See [architecture](docs/ARCHITECTURE.md), [game design](docs/GAME_DESIGN.md), [skill progression](docs/SKILL_PROGRESSION.md), [real-time combat](docs/REALTIME_COMBAT.md), [animation](docs/ANIMATION_SYSTEM.md) and [deployment](docs/DEPLOYMENT.md). GitHub Pages deploys validated pushes to `main` with `/arena-of-ash/` as the base path.

Development-only seeded Canvas rendering and read-only `window.__arena.snapshot()` support repeatable browser tests; production exposes no diagnostic API. Existing mechanics fixtures explicitly learn the original abilities plus Heavy Armor; separate basic-player scenarios exercise actual zero-skill restrictions and the complete choice flow. No production permission bypass exists. Artwork remains procedural; there is no audio, account system or backend. The Phaser bundle retains its existing size warning.

The shop's **Only items my skills allow** checkbox hides skill-locked equipment and consumables before paging. It stays selected across categories, quantities, purchases and inventory visits.

Battle Rage plays a short brace and roar; red eyes and an angry snarl last for its eight-second buff. Shield hands return smoothly to a forward carry after drinks. Counterstrike has a separate 20% roll per eligible successful parry; its armed hit replaces the palm shove, while misses on the roll retain the ordinary zero-damage shove.
