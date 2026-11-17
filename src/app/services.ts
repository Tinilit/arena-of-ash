import { SaveStore } from "../persistence/save";
import { createPlayer, type Player } from "../domain/model";
export class Services {
  readonly style = "ash" as const;
  readonly motion = "grounded" as const;
  content = {
    source: "bundled" as "live" | "bundled",
    revision: "",
    count: 0,
    failedImages: 0,
  };
  store = new SaveStore();
  player: Player = createPlayer();
  load() {
    this.player = this.store.load();
  }
  save() {
    this.store.save(this.player);
  }
  reset() {
    this.player = createPlayer();
    this.save();
  }
}
