import type { EiaRouteConfig } from "../config.js";

export interface EiaDataPoint {
  readonly period: string;
  readonly value: number;
}

/**
 * Thin HTTP client for the EIA Open Data API v2 (https://www.eia.gov/opendata/).
 *
 * IMPORTANT — unverified live: this session's network policy blocks
 * outbound requests to api.eia.gov (verified during development: the
 * CONNECT tunnel was denied with HTTP 403 by the environment's proxy), so
 * the exact route/facet parameters configured in config/sources.json could
 * not be exercised against the real API here. The request/response
 * envelope shape below follows EIA's documented v2 API conventions
 * (`GET /v2/{route}/data/?api_key=...&facets[x][]=y&data[]=value`, response
 * wrapped in `{ response: { data: [...] } }`). Verify the configured
 * `route`/`facets` against EIA's current API documentation before relying
 * on this in production — see README, "Known limitations".
 */
export class EiaHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async fetchSeries(
    route: EiaRouteConfig,
    params: Readonly<Record<string, string>> = {}
  ): Promise<readonly EiaDataPoint[]> {
    const url = new URL(`${this.baseUrl}/${route.route}/data/`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("frequency", route.frequency);
    url.searchParams.set("data[0]", "value");
    for (const [facet, value] of Object.entries(route.facets)) {
      url.searchParams.set(`facets[${facet}][0]`, value);
    }
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`EIA API request failed: ${response.status} ${response.statusText} (route: ${route.route})`);
    }
    const body = (await response.json()) as { response?: { data?: Array<{ period: string; value: string | number }> } };
    const data = body.response?.data;
    if (!Array.isArray(data)) {
      throw new Error(`EIA API response for route "${route.route}" did not include the expected response.data array`);
    }
    return data.map((point) => ({ period: point.period, value: Number(point.value) }));
  }
}
