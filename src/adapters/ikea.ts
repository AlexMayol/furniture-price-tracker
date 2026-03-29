import type { Page } from "playwright";
import type { Item, ScrapeResult } from "../types";

function parsePrice(text: string): number | null {
  const match = text.match(/([\d.,]+)\s*€/);
  if (!match) return null;
  return parseFloat(match[1].replace(".", "").replace(",", "."));
}

export async function scrape(page: Page, item: Item): Promise<ScrapeResult> {
  await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".pipcom-price-module__current-price", { timeout: 10000 });

  const srText = await page.$eval(
    ".pipcom-price-module__current-price .pipcom-price__sr-text",
    (el) => el.textContent
  );
  const currentPrice = parsePrice(srText || "");

  if (currentPrice === null) {
    throw new Error("Could not parse current price");
  }

  let originalPrice: number | null = null;

  const addon = await page.$(".pipcom-price-module__addon");
  if (addon) {
    const addonText = await addon.textContent();
    const prevMatch = addonText?.match(/Precio anterior:\s*([\d.,]+)\s*€/);
    if (prevMatch) {
      originalPrice = parseFloat(prevMatch[1].replace(".", "").replace(",", "."));
    }
  }

  let discount: number | null = null;
  if (originalPrice && originalPrice > currentPrice) {
    discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  }

  const onSale = originalPrice !== null && currentPrice < originalPrice;

  return {
    current_price: currentPrice,
    original_price: originalPrice,
    on_sale: onSale,
    discount_pct: discount || 0,
  };
}
