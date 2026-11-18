# Knockdown, recovery and ready guard

A contacting kick has a 20% chance to trigger a 550 ms fall, 1000 ms motionless ground hold, and 1800 ms get-up. These are authored gameplay timings. An airborne target must land before the hold begins. State transitions own control locks; pose sampling never changes HP, random outcomes or simulation altitude.

The transfer rolls from a reclined pose, collects the legs, leans over a supporting free palm, plants a front foot with the other knee low, then extends the knees/hips in two slow stages. The final pose matches the combat idle without a takeoff impulse. Bone lengths, shoulder anchors and joint limits stay fixed. Whole-body floor support keeps head/body art, palms, knees and boots above the floor. Rotated helmet bounds are checked by the renderer. Held weapons turn to a clear, nearly horizontal carry while down, then return to ready during the final rise. No equipment is deleted or consumed.

The rear combat guard now holds its hilt near the hip with a softly bent elbow and the blade pointing forward about 19 degrees above horizontal. Relaxed idle lowers it. This is a readable stylized guard for the existing 2D projection, not a reconstruction of a historical discipline.

## References consulted

- [L’Abbat, The Art of Fencing, Chapter II: Of Guard](https://github.com/GITenberg/The-Art-of-Fencing--Or-The-Use-of-the-Small-Sword_12135/blob/master/12135.txt): hilt a little above the hip, arm neither straight nor excessively bent, point toward the opponent’s shoulder. This small-sword source informs the supported hilt and rising point, not every detail of a gladiator stance.
- [Strong Together floor-transfer instructions](https://github.com/nivimey-007/strong-together/blob/main/index.html), `floorToChair` and `halfKneel`: roll to the side, hands/knees, front foot flat, lean forward and push through the front heel. This secondary implementation cites NHS Falls; the NHS site itself was unavailable from the managed build network. The arena animation adapts the sequence without a chair and with a free-hand support.
- [OpenStax, Types of Body Movements](https://github.com/openstax/osbooks-anatomy-physiology/blob/main/modules/m46398/index.cnxml): constrained knee/elbow flexion and extension rather than stretching bones.
- [Game Programming Patterns: State](https://github.com/munificent/game-programming-patterns/blob/master/book/state.markdown): explicit phases prevent competing actions from overriding recovery.

Tests cover exact probability boundaries, missing/repeated contacts, airborne ground entry, the full hold duration, locked controls, no jump impulse, later damage without a reset, constant segment lengths, floor clearance and actual rendered recovery in both facing directions.
