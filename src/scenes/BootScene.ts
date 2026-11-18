import Phaser from "phaser";
import { Services } from "../app/services";
import { installCatalog } from "../data/catalog";
import { loadCatalog, publishedCatalogUrl } from "../content/loadCatalog";
import { loadItemTextures } from "../content/textures";
import { prepareDisplay } from "../app/display";
import { label } from "../ui/widgets";
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }
  create() {
    prepareDisplay(this);
    label(this, 640, 360, "Loading equipment…", 24, "#e6d3ab").setOrigin(0.5);
    void this.initialize();
  }
  private async initialize() {
    const url = new URL(
      import.meta.env.VITE_CATALOG_URL ||
        (import.meta.env.PROD
          ? publishedCatalogUrl
          : `${import.meta.env.BASE_URL}content/items.json`),
      location.href,
    ).href;
    const fallbackUrl = new URL(
      `${import.meta.env.BASE_URL}content/items.json`,
      location.href,
    ).href;
    const catalog = await loadCatalog(url, fetch, fallbackUrl);
    installCatalog(catalog.items);
    const failedImages = await loadItemTextures(this, catalog.items);
    const services = new Services();
    services.content = {
      source: catalog.source,
      revision: catalog.revision,
      count: catalog.items.length,
      failedImages,
    };
    services.load();
    this.registry.set("services", services);
    this.scene.start("MainMenuScene");
  }
}
