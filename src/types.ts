import type { Page } from "playwright";

export type Shop = "jysk" | "ikea";

export interface Item {
  id: string;
  name: string;
  url: string;
  shop: Shop;
}

export interface ScrapeResult {
  current_price: number;
  original_price: number | null;
  on_sale: boolean;
  discount_pct: number;
}

export interface PriceEntry extends ScrapeResult {
  date: string;
  shop: Shop;
}

export interface PriceDrop {
  id: string;
  name: string;
  url: string;
  shop: Shop;
  current_price: number;
  previous_price: number;
  drop_pct: number;
}

export type PriceHistory = Record<string, PriceEntry[]>;

export interface Adapter {
  scrape(page: Page, item: Item): Promise<ScrapeResult>;
}
