import type { Page } from "playwright";
import type { Item, ScrapeResult } from "../types";

function parsePrice(text: string): number | null {
  const match = text.match(/([\d.,]+)\s*€/);
  if (!match) return null;
  return parseFloat(match[1].replace(".", "").replace(",", "."));
}

function parseDiscount(text: string): number | null {
  const match = text.match(/-(\d+)%/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export async function scrape(page: Page, item: Item): Promise<ScrapeResult> {
  await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('[data-testid="product-price"]', { timeout: 10000 });

  const ariaLabel = await page.$eval(
    '[data-testid="product-price"]',
    (el) => el.getAttribute("aria-label")
  );
  const currentPrice = parsePrice(ariaLabel || "");

  if (currentPrice === null) {
    throw new Error("Could not parse current price");
  }

  const purchaseInfo = await page.$('[data-testid="product-purchase-info"]');

  let originalPrice: number | null = null;
  let discount: number | null = null;

  if (purchaseInfo) {
    const infoText = await purchaseInfo.textContent();

    const normalMatch = infoText?.match(/Precio normal:\s*([\d.,]+)\s*€/);
    const inicialMatch = infoText?.match(/Precio inicial\s*([\d.,]+)\s*€/);

    if (normalMatch) {
      originalPrice = parseFloat(normalMatch[1].replace(".", "").replace(",", "."));
    } else if (inicialMatch) {
      originalPrice = parseFloat(inicialMatch[1].replace(".", "").replace(",", "."));
    }

    const discountBadge = await purchaseInfo.$(".bg-discount");
    if (discountBadge) {
      const badgeText = await discountBadge.textContent();
      discount = parseDiscount(badgeText || "");
    }
  }

  if (!discount && originalPrice && originalPrice > currentPrice) {
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
