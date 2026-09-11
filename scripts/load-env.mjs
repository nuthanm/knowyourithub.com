import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function cleanValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isPlaceholderValue(value) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized.includes("replace") ||
    normalized.includes("example.com") ||
    normalized.includes("your@gmail.com") ||
    normalized.includes("user:password") ||
    normalized.includes("localhost") && normalized.includes("127.0.0.1")
  );
}

function shouldUseFileValue(key, currentValue, fileValue) {
  if (currentValue === undefined) return true;
  if (!currentValue.trim()) return true;
  if (isPlaceholderValue(currentValue)) return true;

  if (key === "DATABASE_URL") {
    const currentIsLocal = currentValue.includes("localhost") || currentValue.includes("127.0.0.1");
    const fileIsLocal = fileValue.includes("localhost") || fileValue.includes("127.0.0.1");
    if (currentIsLocal && !fileIsLocal) return true;
  }

  if (key === "SMTP_HOST" && fileValue && !fileValue.includes("example.com") && currentValue.includes("example.com")) {
    return true;
  }

  return false;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const exportPrefix = "export ";
  const normalized = trimmed.startsWith(exportPrefix)
    ? trimmed.slice(exportPrefix.length).trim()
    : trimmed;

  const separator = normalized.indexOf("=");
  if (separator <= 0) return null;

  const key = normalized.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  const rawValue = normalized.slice(separator + 1);
  return { key, value: cleanValue(rawValue) };
}

export async function loadScriptEnv() {
  const root = process.cwd();
  const candidates = [
    resolve(root, ".env.local"),
    resolve(root, ".env"),
    resolve(root, "data", ".env"),
  ];

  for (const filePath of candidates) {
    try {
      const raw = await readFile(filePath, "utf8");
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        const parsed = parseEnvLine(line);
        if (!parsed) continue;
        const currentValue = process.env[parsed.key];
        if (shouldUseFileValue(parsed.key, currentValue ?? "", parsed.value)) {
          process.env[parsed.key] = parsed.value;
        }
      }
    } catch {
      // Ignore missing or unreadable env files and continue.
    }
  }
}
