import { beforeEach } from "vitest";
import fixture from "../fixtures/catalog.json";
import { parseCatalog } from "../../src/content/schema";
import { installCatalog } from "../../src/data/catalog";
// Keep game-rule assertions independent of later live balance/content edits.
beforeEach(() => installCatalog(parseCatalog(fixture).items));
