import { SaveStore } from "../persistence/save";
import { createPlayer, type Player } from "../domain/model";
import {
  loadStyle,
  saveStyle,
  type VisualStyle,
} from "../characters/presentation";
export class Services {
  style: VisualStyle = "original";
  selectStyle(style: VisualStyle) {
    this.style = style;
    return saveStyle(style);
  }
  store = new SaveStore();
  player: Player = createPlayer();
  load() {
    this.player = this.store.load();
    this.style = loadStyle();
  }
  save() {
    this.store.save(this.player);
  }
  reset() {
    this.player = createPlayer();
    this.save();
  }
}
