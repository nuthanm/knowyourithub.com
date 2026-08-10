import postgres from "postgres";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

let sql: ReturnType<typeof postgres> | null = null;
const LOCAL_SUBSCRIBERS_PATH = resolve(process.cwd(), "data", "subscribers.json");

type LocalSubscriber = {
  id: string;
  email: string;
  name?: string;
  source?: string;
  createdAt: string;
};

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || url.includes("replace") || url.includes("user:password")) return null;
  if (!sql) sql = postgres(url, { max: 1, prepare: false });
  return sql;
}

async function readLocalSubscribers(): Promise<LocalSubscriber[]> {
  try {
    const raw = await readFile(LOCAL_SUBSCRIBERS_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is LocalSubscriber => Boolean(item && typeof item === "object"))
      .filter((item) => typeof item.email === "string" && item.email.trim().length > 0)
      .map((item) => ({
        ...item,
        email: item.email.trim().toLowerCase(),
        createdAt: item.createdAt || new Date(0).toISOString(),
      }));
  } catch {
    return [];
  }
}

async function writeLocalSubscribers(items: LocalSubscriber[]) {
  await mkdir(dirname(LOCAL_SUBSCRIBERS_PATH), { recursive: true });
  await writeFile(LOCAL_SUBSCRIBERS_PATH, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export async function saveSubscriber(input: { id: string; email: string; name?: string; source?: string }) {
  const db = getSql();
  if (!db) {
    const email = input.email.trim().toLowerCase();
    if (!email) return { stored: false as const };
    const existing = await readLocalSubscribers();
    if (existing.some((item) => item.email === email)) return { stored: true as const };
    existing.unshift({
      id: input.id,
      email,
      name: input.name,
      source: input.source ?? "submit_form",
      createdAt: new Date().toISOString(),
    });
    await writeLocalSubscribers(existing.slice(0, 5000));
    return { stored: true as const };
  }
  await db`
    INSERT INTO catalog_subscribers (id, email, name, source)
    VALUES (${input.id}, ${input.email}, ${input.name ?? null}, ${input.source ?? "submit_form"})
    ON CONFLICT (email) DO NOTHING
  `;
  return { stored: true as const };
}

export async function listSubscribers(limit = 300) {
  const db = getSql();
  if (!db) {
    const safeLimit = Math.min(Math.max(limit, 1), 2000);
    const local = await readLocalSubscribers();
    return local.slice(0, safeLimit).map((item) => ({ email: item.email, name: item.name ?? null }));
  }
  const safeLimit = Math.min(Math.max(limit, 1), 2000);
  const rows = await db<Array<{ email: string; name: string | null }>>`
    SELECT email, name
    FROM catalog_subscribers
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `;
  return rows;
}
