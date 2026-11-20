import { createPlayer } from "../../src/domain/model";
import { enemySkills } from "../../src/domain/skills";
/** Existing mechanics fixtures explicitly learn the original ten advanced abilities. */
export function trainedGladiator() {
  return { ...createPlayer(), skills: [...enemySkills] };
}
