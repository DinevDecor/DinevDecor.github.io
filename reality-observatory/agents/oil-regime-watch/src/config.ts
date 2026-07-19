import { readFileSync } from "node:fs";

export interface EiaRouteConfig {
  readonly enabled: boolean;
  readonly route: string;
  readonly facets: Readonly<Record<string, string>>;
  readonly frequency: "weekly" | "daily";
  readonly unit: string;
}

export interface OpecFeedConfig {
  readonly enabled: boolean;
  readonly feedPath: string;
}

export interface ThresholdsConfig {
  readonly inventorySurpriseThousandBarrels: number;
  readonly inventoryTrailingWeeks: number;
  readonly priceMoveEvidenceThresholdPercent: number;
  readonly priceMoveConfirmationThresholdPercent: number;
  readonly predictionHorizonHours: number;
}

export interface SourcesConfig {
  readonly domain: string;
  readonly sources: {
    readonly eiaInventory: EiaRouteConfig;
    readonly eiaWtiPrice: EiaRouteConfig;
    readonly eiaBrentPrice: EiaRouteConfig;
    readonly opecAnnouncements: OpecFeedConfig;
  };
  readonly thresholds: ThresholdsConfig;
  readonly apiKeyEnvVar: string;
  readonly apiBaseUrl: string;
}

const REQUIRED_SOURCE_KEYS = ["eiaInventory", "eiaWtiPrice", "eiaBrentPrice", "opecAnnouncements"] as const;

export class InvalidConfigError extends Error {
  constructor(reason: string) {
    super(`Oil Regime Watch config is invalid: ${reason}`);
    this.name = "InvalidConfigError";
  }
}

/**
 * Loads and validates config/sources.json. Fails closed: any missing
 * required source, or the config's own `domain` disagreeing with the
 * hardcoded `DOMAIN` this agent operates in, is a startup error rather
 * than a silently degraded agent (see "Do not add features" — this is
 * validation of an existing, documented config shape, not new behavior).
 */
export function loadSourcesConfig(configPath: string, expectedDomain: string): SourcesConfig {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as SourcesConfig;

  if (parsed.domain !== expectedDomain) {
    throw new InvalidConfigError(`config domain "${parsed.domain}" does not match agent domain "${expectedDomain}"`);
  }
  for (const key of REQUIRED_SOURCE_KEYS) {
    if (!(key in parsed.sources)) {
      throw new InvalidConfigError(`missing required source "${key}"`);
    }
  }
  return parsed;
}

/** Reads the EIA API key from the environment variable named in config. Returns undefined if unset — the real adapters fail loudly at call time rather than silently, see EiaHttpClient. */
export function readEiaApiKey(config: SourcesConfig): string | undefined {
  return process.env[config.apiKeyEnvVar];
}

export interface OpecAnnouncementFeedEntry {
  readonly id: string;
  readonly announcedAt: string;
  readonly kind: "cut" | "increase" | "disruption";
  readonly magnitudeBarrelsPerDay: number;
  readonly summary: string;
}

/** Reads the operator-curated OPEC+ announcement feed file (see config/opec-announcements.example.json). */
export function readOpecAnnouncementFeed(feedPath: string): readonly OpecAnnouncementFeedEntry[] {
  const raw = readFileSync(feedPath, "utf-8");
  const parsed = JSON.parse(raw) as { announcements: OpecAnnouncementFeedEntry[] };
  return parsed.announcements;
}
