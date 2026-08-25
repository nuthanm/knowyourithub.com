import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const [, , idArg, statusArg] = process.argv;
const id = String(idArg || "").trim();
const status = String(statusArg || "").trim();

const allowed = new Set(["awaiting_review", "in_progress", "verified", "rejected"]);
if (!id || !status || !allowed.has(status)) {
  console.error("Usage: node scripts/set-submission-status.mjs <id> <awaiting_review|in_progress|verified|rejected>");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl || dbUrl.includes("replace") || dbUrl.includes("user:password")) {
  console.error("DATABASE_URL is missing or placeholder. Aborting status update.");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  const rows = await sql`
    UPDATE company_submissions
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, company_name, company_slug, status, updated_at
  `;

  if (!rows.length) {
    console.error(`No submission found for id: ${id}`);
    process.exit(1);
  }

  console.log(JSON.stringify(rows[0], null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
