import type { OpecAnnouncementKind } from "../domain.js";

export interface RawInventoryObservation {
  /** ISO date the report covers, e.g. "2026-01-14". */
  readonly asOfDate: string;
  readonly inventoryThousandBarrels: number;
}

/** EIA Weekly Petroleum Status Report — US crude inventory levels. */
export interface InventoryAdapter {
  fetchLatest(): Promise<RawInventoryObservation>;
  /** Most recent `weeks` observations, most recent last, for trailing-average surprise detection. */
  fetchTrailingHistory(weeks: number): Promise<readonly RawInventoryObservation[]>;
}

export interface RawPriceObservation {
  readonly asOfDate: string;
  readonly pricePerBarrelUsd: number;
}

/** A single spot-price series (WTI or Brent), both served by EIA's petroleum price data. */
export interface PriceAdapter {
  fetchLatest(): Promise<RawPriceObservation>;
}

export interface RawOpecAnnouncement {
  readonly id: string;
  readonly announcedAt: string;
  readonly kind: OpecAnnouncementKind;
  readonly magnitudeBarrelsPerDay: number;
  readonly summary: string;
}

/** OPEC+ production announcements — a structured, operator-curated feed (see README: no scraping, no AI summarization). */
export interface OpecAnnouncementAdapter {
  /** Announcements after `lastSeenId` (feed order), or all of them if `lastSeenId` is undefined. */
  fetchNewAnnouncementsSince(lastSeenId: string | undefined): Promise<readonly RawOpecAnnouncement[]>;
}
