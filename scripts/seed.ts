import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";
import { seed } from "../src/server/sidequest/seed";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const conn = postgres(process.env.DATABASE_URL);
try {
  console.info(await seed(drizzle(conn, { schema })));
} finally {
  await conn.end();
}
