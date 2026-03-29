import { chromium } from "playwright";
import type { Page } from "playwright";
import type { Item, Adapter, PriceEntry } from "./types";
import * as jysk from "./adapters/jysk";
import * as ikea from "./adapters/ikea";

const adapters: Record<string, Adapter> = {
  jysk,
  ikea,
};

async function scrapeProduct(page: Page, item: Item): Promise<PriceEntry | null> {
  console.log(`Scraping: ${item.name} [${item.shop}] (${item.url})`);

  const adapter = adapters[item.shop];
  if (!adapter) {
    console.error(`  Unknown shop "${item.shop}" for ${item.id}`);
    return null;
  }

  try {
    const result = await adapter.scrape(page, item);
    const entry: PriceEntry = {
      ...result,
      date: new Date().toISOString().split("T")[0],
      shop: item.shop,
    };

    const { current_price, original_price, on_sale, discount_pct } = entry;
    console.log(`  Price: ${current_price}€${on_sale ? ` (was ${original_price}€, -${discount_pct}%)` : ""}`);

    return entry;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  Error scraping ${item.id}: ${message}`);
    return null;
  }
}

export async function scrapeAll(items: Item[]): Promise<Record<string, PriceEntry>> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results: Record<string, PriceEntry> = {};

  for (const item of items) {
    const data = await scrapeProduct(page, item);
    if (data) {
      results[item.id] = data;
    }
  }

  await browser.close();
  return results;
}
