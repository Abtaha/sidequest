import { sql } from "drizzle-orm";
import type { db } from "../db";
export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Store = Database | Transaction;
// All writes to a domain aggregate acquire this transaction-scoped lock. Hash
// collisions only serialize unrelated requests, never compromise ownership.
export async function lock(tx: Store, key: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}
