import type { EiaRouteConfig, SourcesConfig } from "../config.js";
import type { InventoryAdapter, RawInventoryObservation } from "./SourceAdapter.js";
import { EiaHttpClient } from "./EiaHttpClient.js";

/** Real EIA Weekly Petroleum Status Report adapter. See EiaHttpClient for the unverified-live caveat. */
export class EiaInventoryAdapter implements InventoryAdapter {
  private readonly client: EiaHttpClient;
  private readonly route: EiaRouteConfig;

  constructor(config: SourcesConfig, apiKey: string) {
    this.client = new EiaHttpClient(config.apiBaseUrl, apiKey);
    this.route = config.sources.eiaInventory;
  }

  async fetchLatest(): Promise<RawInventoryObservation> {
    const points = await this.client.fetchSeries(this.route, { sort: "period", order: "desc", length: "1" });
    const latest = points[0];
    if (!latest) throw new Error("EIA inventory series returned no data points");
    return { asOfDate: latest.period, inventoryThousandBarrels: latest.value };
  }

  async fetchTrailingHistory(weeks: number): Promise<readonly RawInventoryObservation[]> {
    const points = await this.client.fetchSeries(this.route, { sort: "period", order: "desc", length: String(weeks) });
    return [...points].reverse().map((point) => ({ asOfDate: point.period, inventoryThousandBarrels: point.value }));
  }
}
