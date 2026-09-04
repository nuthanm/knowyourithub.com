import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let hasLoadedServerEnv = false;

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const normalized = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trim()
    : trimmed;
  const separator = normalized.indexOf("=");
  if (separator <= 0) return null;

  const key = normalized.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  const value = normalized.slice(separator + 1).trim();
  const unquoted = (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  return { key, value: unquoted ? value.slice(1, -1) : value };
}

/** Load local server credentials stored outside Next.js's root .env convention. */
export function loadServerEnv() {
  if (hasLoadedServerEnv) return;
  hasLoadedServerEnv = true;

  const filePath = resolve(process.cwd(), "data", ".env");
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (parsed && process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}