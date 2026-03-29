import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeAll } from "./scraper";
import { sendEmail } from "./notifier";
import type { Item, PriceEntry, PriceDrop, PriceHistory } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");
const ITEMS_PATH = path.join(DATA_DIR, "items.json");
const HISTORY_PATH = path.join(DATA_DIR, "price_history.json");

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function saveHistory(history: PriceHistory): void {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n");
}

function findDrops(items: Item[], scrapedData: Record<string, PriceEntry>, history: PriceHistory): PriceDrop[] {
  const drops: PriceDrop[] = [];

  for (const item of items) {
    const scraped = scrapedData[item.id];
    if (!scraped) continue;

    const past = history[item.id] || [];
    const lastEntry = past.length > 0 ? past[past.length - 1] : null;

    if (lastEntry && scraped.current_price < lastEntry.current_price) {
      drops.push({
        id: item.id,
        name: item.name,
        url: item.url,
        shop: item.shop,
        current_price: scraped.current_price,
        previous_price: lastEntry.current_price,
        drop_pct: Math.round(
          ((lastEntry.current_price - scraped.current_price) / lastEntry.current_price) * 100
        ),
      });
    }
  }

  return drops;
}

function updateHistory(items: Item[], scrapedData: Record<string, PriceEntry>, history: PriceHistory): PriceHistory {
  for (const item of items) {
    const scraped = scrapedData[item.id];
    if (!scraped) continue;

    if (!history[item.id]) {
      history[item.id] = [];
    }

    const past = history[item.id];
    const lastEntry = past.length > 0 ? past[past.length - 1] : null;

    const priceChanged = !lastEntry || lastEntry.current_price !== scraped.current_price;
    if (priceChanged) {
      history[item.id].push(scraped);
    }
  }

  return history;
}

async function main(): Promise<void> {
  console.log("=== Furniture Price Tracker ===");
  console.log(`Date: ${new Date().toISOString().split("T")[0]}\n`);

  const items = loadJson<Item[]>(ITEMS_PATH, []);
  if (items.length === 0) {
    console.log("No items to track. Add items to data/items.json");
    return;
  }
  console.log(`Tracking ${items.length} item(s)\n`);

  const scrapedData = await scrapeAll(items);
  console.log(`\nSuccessfully scraped ${Object.keys(scrapedData).length}/${items.length} items\n`);

  const history = loadJson<PriceHistory>(HISTORY_PATH, {});
  const drops = findDrops(items, scrapedData, history);

  if (drops.length > 0) {
    console.log(`Price drops detected on ${drops.length} item(s):`);
    for (const d of drops) {
      console.log(`  - ${d.name}: ${d.previous_price}€ → ${d.current_price}€ (-${d.drop_pct}%)`);
    }
    console.log("");
    await sendEmail(drops);
  } else {
    console.log("No new price drops detected");
  }

  const updatedHistory = updateHistory(items, scrapedData, history);
  saveHistory(updatedHistory);
  console.log("\nPrice history updated");
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
