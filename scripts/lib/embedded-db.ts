import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import * as schema from "../../src/server/db/schema";
import type { Database } from "../../src/server/sidequest/storage";
export async function database() {
  const client = new PGlite();
  for (const file of (await readdir(new URL("../../drizzle/", import.meta.url)))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await client.exec(
      await readFile(new URL(`../../drizzle/${file}`, import.meta.url), "utf8"),
    );
  }
  // PGlite executes transactions serially and lacks server advisory locks. Production
  // uses native PostgreSQL pg_advisory_xact_lock; these tests do not prove PG races.
  await client.exec(
    "CREATE FUNCTION pg_advisory_xact_lock(integer) RETURNS void LANGUAGE SQL AS 'SELECT';",
  );
  return {
    db: drizzle(client, { schema }) as unknown as Database,
    close: () => client.close(),
  };
}
