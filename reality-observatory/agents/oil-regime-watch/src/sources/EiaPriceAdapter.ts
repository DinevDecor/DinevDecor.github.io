import type { EiaRouteConfig, SourcesConfig } from "../config.js";
import type { PriceAdapter, RawPriceObservation } from "./SourceAdapter.js";
import { EiaHttpClient } from "./EiaHttpClient.js";
import type { PriceInstrument } from "../domain.js";

/** Real EIA spot-price adapter, shared by WTI and Brent (EIA publishes both under petroleum price data). See EiaHttpClient for the unverified-live caveat. */
export class EiaPriceAdapter implements PriceAdapter {
  private readonly client: EiaHttpClient;
  private readonly route: EiaRouteConfig;

  constructor(config: SourcesConfig, apiKey: string, instrument: PriceInstrument) {
    this.client = new EiaHttpClient(config.apiBaseUrl, apiKey);
    this.route = instrument === "wti" ? config.sources.eiaWtiPrice : config.sources.eiaBrentPrice;
  }

  async fetchLatest(): Promise<RawPriceObservation> {
    const points = await this.client.fetchSeries(this.route, { sort: "period", order: "desc", length: "1" });
    const latest = points[0];
    if (!latest) throw new Error("EIA price series returned no data points");
    return { asOfDate: latest.period, pricePerBarrelUsd: latest.value };
  }
}
