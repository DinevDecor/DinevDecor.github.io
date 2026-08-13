import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { InvalidConfigError, loadSourcesConfig, readOpecAnnouncementFeed } from "../src/config.js";
import { DOMAIN } from "../src/domain.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/test -> package root -> config/
const configDir = join(here, "..", "..", "config");

test("PA-001 config: config/sources.json loads and validates against the agent's own Domain", () => {
  const config = loadSourcesConfig(join(configDir, "sources.json"), DOMAIN);
  assert.equal(config.domain, DOMAIN);
  assert.ok(config.sources.eiaInventory.enabled);
  assert.ok(config.sources.eiaWtiPrice.enabled);
  assert.ok(config.sources.eiaBrentPrice.enabled);
  assert.ok(config.sources.opecAnnouncements.enabled);
  assert.equal(config.apiKeyEnvVar, "EIA_API_KEY");
});

test("PA-001 config: a config whose domain disagrees with the agent's Domain is rejected", () => {
  // Reads from the source tree (not dist/) — this fixture is a raw JSON
  // file read via node:fs at runtime, not a module the compiler copies.
  const badPath = join(here, "..", "..", "test", "fixtures-data", "sources.wrong-domain.json");
  assert.throws(() => loadSourcesConfig(badPath, DOMAIN), InvalidConfigError);
});

test("PA-001 config: the example OPEC+ announcement feed parses into structured entries", () => {
  const entries = readOpecAnnouncementFeed(join(configDir, "opec-announcements.example.json"));
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.kind, "cut");
});
