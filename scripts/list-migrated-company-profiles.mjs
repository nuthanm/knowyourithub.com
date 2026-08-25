import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl || dbUrl.includes("replace") || dbUrl.includes("user:password")) {
  console.error("DATABASE_URL is missing or placeholder. Aborting report.");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  const rows = await sql`
    SELECT slug, name, verification_status, last_verified
    FROM company_profiles
    WHERE last_verified = ${new Date().toISOString().slice(0, 10)}
      AND verification_status = 'verified'
    ORDER BY slug ASC
  `;
  console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}