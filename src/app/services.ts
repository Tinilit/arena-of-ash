import { SaveStore } from "../persistence/save";
import { createPlayer, type Player } from "../domain/model";
export class Services {
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
