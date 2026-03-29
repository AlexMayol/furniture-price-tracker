import type { Page } from "playwright";

export interface Item {
  id: string;
  name: string;
  url: string;
  shop: string;
}

export interface ScrapeResult {
  current_price: number;
  original_price: number | null;
  on_sale: boolean;
  discount_pct: number;
}

export interface PriceEntry extends ScrapeResult {
  date: string;
  shop: string;
}

export interface PriceDrop {
  id: string;
  name: string;
  url: string;
  shop: string;
  current_price: number;
  previous_price: number;
  drop_pct: number;
}

export type PriceHistory = Record<string, PriceEntry[]>;

export interface Adapter {
  scrape(page: Page, item: Item): Promise<ScrapeResult>;
}
