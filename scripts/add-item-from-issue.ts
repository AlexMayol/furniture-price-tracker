import { randomUUID } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Item, Shop } from "../src/types";

const allowedShops = new Set<Shop>(["jysk", "ikea"]);

interface IssueEvent {
  issue?: {
    body?: string | null;
    number?: number;
  };
}

function parseIssueFormBody(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let currentLabel: string | null = null;
  let currentValue: string[] = [];

  const flush = () => {
    if (currentLabel) {
      fields.set(currentLabel, currentValue.join("\n").trim());
    }
  };

  for (const line of lines) {
    if (line.startsWith("### ")) {
      flush();
      currentLabel = line.slice(4).trim();
      currentValue = [];
    } else if (currentLabel) {
      currentValue.push(line);
    }
  }

  flush();
  return fields;
}

function requiredField(fields: Map<string, string>, label: string): string {
  const value = fields.get(label)?.trim();

  if (!value || value === "_No response_") {
    throw new Error(`Missing required issue field: ${label}`);
  }

  return value;
}

function isShop(value: string): value is Shop {
  return allowedShops.has(value as Shop);
}

function normalizeShop(value: string): Shop {
  const shop = value.trim().toLowerCase();

  if (!isShop(shop)) {
    throw new Error(`Unsupported shop "${value}". Expected one of: ${Array.from(allowedShops).join(", ")}`);
  }

  return shop;
}

function normalizeUrl(value: string): string {
  try {
    return new URL(value.trim()).toString();
  } catch {
    throw new Error(`Invalid item URL: ${value}`);
  }
}

function generateItemId(existingItems: Item[]): string {
  const existingIds = new Set(existingItems.map((item) => item.id));

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = `item-${randomUUID()}`;

    if (!existingIds.has(id)) {
      return id;
    }
  }

  throw new Error("Could not generate a unique item id");
}

async function writeGithubOutput(values: Record<string, string>): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    return;
  }

  const content = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  await appendFile(outputPath, `${content}\n`);
}

function isItemArray(value: unknown): value is Item[] {
  return Array.isArray(value);
}

async function main(): Promise<void> {
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is not set");
  }

  const event = JSON.parse(await readFile(eventPath, "utf8")) as IssueEvent;
  const issueBody = event.issue?.body;

  if (!issueBody) {
    throw new Error("Issue body is empty");
  }

  const fields = parseIssueFormBody(issueBody);
  const name = requiredField(fields, "Item name");
  const url = normalizeUrl(requiredField(fields, "Item URL"));
  const shop = normalizeShop(requiredField(fields, "Shop"));

  const itemsPath = resolve("data/items.json");
  const items = JSON.parse(await readFile(itemsPath, "utf8")) as unknown;

  if (!isItemArray(items)) {
    throw new Error("data/items.json must contain an array");
  }

  const item: Item = {
    id: generateItemId(items),
    name,
    url,
    shop,
  };

  items.push(item);
  await writeFile(itemsPath, `${JSON.stringify(items, null, 2)}\n`);
  await writeGithubOutput({
    item_id: item.id,
    item_name: item.name,
    item_shop: item.shop,
  });

  console.log(`Added ${item.name} (${item.shop}) as ${item.id}`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exitCode = 1;
});
