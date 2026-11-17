import Phaser from "phaser";
import { Services } from "../app/services";
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }
  create() {
    const services = new Services();
    services.load();
    this.registry.set("services", services);
    this.scene.start("MainMenuScene");
  }
}
