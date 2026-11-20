import type { Player } from "./model";
import { reward } from "./progression";
import { allSkillIds, canLearn, type SkillId } from "./skills";
export interface PostBattle {
  battleId: string;
  outcome: "Victory" | "Defeat" | "Draw";
  opponent: string;
  gold: number;
  choice: "pending" | "skill" | "shop";
  consumed: boolean;
  completed: boolean;
}
export const pendingDecision = (p: Player) =>
  Boolean(p.postBattle && !p.postBattle.completed);
export function progressionScene(p: Player) {
  return !pendingDecision(p)
    ? "MainMenuScene"
    : p.postBattle!.choice === "skill"
      ? "SkillScene"
      : p.postBattle!.choice === "shop"
        ? "ShopScene"
        : "ResultScene";
}
export const shopAccess = (p: Player) =>
  p.postBattle?.choice === "shop" &&
  !p.postBattle.completed &&
  p.postBattle.consumed;
export function completeBattle(
  p: Player,
  battleId: string,
  outcome: PostBattle["outcome"],
  opponent: string,
) {
  if (pendingDecision(p)) return null;
  const payout = reward(p, battleId, outcome === "Victory");
  if (!payout) return null;
  p.postBattle = {
    battleId,
    outcome,
    opponent,
    gold: payout.gold,
    choice: "pending",
    consumed: false,
    completed: false,
  };
  return payout;
}
export function choosePostBattle(p: Player, choice: "skill" | "shop") {
  const s = p.postBattle;
  if (
    !s ||
    s.completed ||
    s.consumed ||
    s.choice !== "pending" ||
    (choice === "skill" && allSkillIds.every((id) => p.skills?.includes(id)))
  )
    return false;
  s.choice = choice;
  s.consumed = true;
  return true;
}
export function learnSkill(p: Player, id: SkillId) {
  const s = p.postBattle;
  if (
    !s ||
    s.choice !== "skill" ||
    !s.consumed ||
    s.completed ||
    !canLearn(p, id)
  )
    return false;
  (p.skills ??= []).push(id);
  s.completed = true;
  return true;
}
export function closeShop(p: Player) {
  if (!shopAccess(p)) return false;
  p.postBattle!.completed = true;
  return true;
}
