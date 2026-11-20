import { createPlayer } from "../../src/domain/model";
import { enemySkills } from "../../src/domain/skills";
/** Existing mechanics fixtures explicitly learn the original abilities plus heavy armor. */
export function trainedGladiator() {
  return { ...createPlayer(), skills: [...enemySkills, 18 as const] };
}
