import postgres from "postgres";
import { loadScriptEnv } from "./load-env.mjs";

await loadScriptEnv();

const dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl || dbUrl.includes("replace") || dbUrl.includes("user:password")) {
  console.error("DATABASE_URL is missing or placeholder. Aborting diagnostic.");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1, prepare: false });

try {
  const [result] = await sql`
    SELECT
      current_database() AS database,
      current_schema() AS schema,
      COALESCE(inet_server_addr()::text, 'local') AS host,
      (SELECT COUNT(*)::int FROM company_profiles) AS profiles,
      (SELECT COUNT(*)::int FROM company_submissions WHERE status = 'verified') AS verified_submissions
  `;
  console.log(JSON.stringify(result));
} finally {
  await sql.end({ timeout: 5 });
}