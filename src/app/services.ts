import { SaveStore } from "../persistence/save";
import { createPlayer, type Player } from "../domain/model";
import {
  loadMotion,
  saveMotion,
  type MotionMode,
  loadStyle,
  saveStyle,
  type VisualStyle,
} from "../characters/presentation";
export class Services {
  motion: MotionMode = "grounded";
  selectMotion(mode: MotionMode) {
    this.motion = mode;
    return saveMotion(mode);
  }
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
    this.motion = loadMotion();
  }
  save() {
    this.store.save(this.player);
  }
  reset() {
    this.player = createPlayer();
    this.save();
  }
}
