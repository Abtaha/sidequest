import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import * as s from "../db/schema";
import { type Database } from "./storage";
export const syntheticIds = Array.from(
  { length: 8 },
  (_, i) => `synthetic-user-${i + 1}`,
);
export async function seed(db: Database, date = new Date()) {
  // Next Saturday, UTC times correspond to afternoon/evening Asia/Seoul.
  const saturday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + ((6 - date.getUTCDay() + 7) % 7 || 7),
    ),
  );
  const at = (hour: number) => new Date(+saturday + hour * 3_600_000);
  const interests = [
    "Enjoys indie music and small groups",
    "Prefers indoor board games",
    "Enjoys shoegaze; available only in the evening",
    "Enjoys climbing",
    "Prefers quiet museums",
    "Enjoys picnics",
    "Enjoys films",
    "Enjoys live music but avoids expensive activities",
  ];
  const budgets = [15000, 12000, 15000, 25000, 5000, 10000, 8000, 2000];
  await db.transaction(async (tx) => {
    for (let i = 0; i < syntheticIds.length; i++) {
      const userId = syntheticIds[i]!;
      await tx
        .insert(s.user)
        .values({
          id: userId,
          name: `Synthetic Scout User ${i + 1}`,
          email: `synthetic-${i + 1}@example.invalid`,
          emailVerified: false,
        })
        .onConflictDoNothing();
      await tx
        .insert(s.profiles)
        .values({
          userId,
          sharing: true,
          discoverable: true,
          circle: "synthetic-campus",
          constraints: { maxCost: budgets[i], maxGroup: i === 7 ? 2 : 5 },
        })
        .onConflictDoUpdate({
          target: s.profiles.userId,
          set: {
            constraints: { maxCost: budgets[i], maxGroup: i === 7 ? 2 : 5 },
          },
        });
      await tx.delete(s.availability).where(eq(s.availability.userId, userId));
      await tx.insert(s.availability).values({
        userId,
        start: at(i === 2 ? 9 : i === 7 ? 1 : 5),
        end: at(i === 7 ? 3 : 14),
      });
      const [existing] = await tx
        .select()
        .from(s.userMemories)
        .where(eq(s.userMemories.userId, userId))
        .limit(1);
      if (!existing) {
        const [conversation] = await tx
          .insert(s.scoutConversations)
          .values({ userId })
          .returning();
        const [message] = await tx
          .insert(s.scoutMessages)
          .values({
            userId,
            conversationId: conversation!.id,
            role: "user",
            content: interests[i]!,
            requestId: randomUUID(),
            status: "COMPLETE",
          })
          .returning();
        const [memory] = await tx
          .insert(s.userMemories)
          .values({
            userId,
            category: "PREFERENCE",
            key: "social:activity",
            content: interests[i]!,
            scope: "PERSISTENT",
            confidence: 100,
            explicit: true,
            sourceMessageId: message!.id,
            conversationId: conversation!.id,
          })
          .returning();
        await tx
          .insert(s.memoryRevisions)
          .values({ userId, memoryId: memory!.id, reason: "SYNTHETIC_SEED" });
      }
    }
    const entries = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "Synthetic campus indie listening lounge",
        category: "MUSIC",
        cost: 10000,
        capacity: 5,
        tags: ["indie", "indoor", "quiet"],
        start: at(6),
        end: at(13),
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        title: "Synthetic board game meetup",
        category: "GAMES",
        cost: 8000,
        capacity: 5,
        tags: ["indoor", "games", "small-group"],
        start: at(5),
        end: at(14),
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        title: "Synthetic campus park picnic",
        category: "OUTDOOR",
        cost: 3000,
        capacity: 8,
        tags: ["outdoor", "park"],
        start: at(5),
        end: at(9),
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        title: "Synthetic climbing workshop",
        category: "SPORT",
        cost: 22000,
        capacity: 4,
        tags: ["indoor", "sport"],
        start: at(7),
        end: at(10),
      },
      {
        id: "00000000-0000-4000-8000-000000000005",
        title: "Synthetic gallery open hour",
        category: "ART",
        cost: 0,
        capacity: 3,
        tags: ["indoor", "quiet", "art"],
        start: at(5),
        end: at(8),
      },
      {
        id: "00000000-0000-4000-8000-000000000006",
        title: "Synthetic campus short film screening",
        category: "ART",
        cost: 6000,
        capacity: 5,
        tags: ["indoor", "movie", "film", "small-group"],
        start: at(10),
        end: at(12),
      },
    ];
    for (const entry of entries)
      await tx
        .insert(s.activities)
        .values({
          ...entry,
          location: "Fictional campus demo area (synthetic)",
          description:
            "Synthetic demonstration option; not an actual venue, ticket or reservation.",
          synthetic: true,
        })
        .onConflictDoUpdate({ target: s.activities.id, set: entry });
  });
  return { users: syntheticIds, saturday: saturday.toISOString() };
}
