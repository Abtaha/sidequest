import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  agentConversations,
  approvals,
  negotiations,
  proposals,
  sidequests,
  user,
} from "../db/schema";
import type { Store } from "./storage";
import { activityLabels } from "./activity-labels";

const planningStatuses = [
  "DISCOVERING",
  "NEGOTIATING",
  "AWAITING_USER_INPUT",
] as const;
function currentPlanRows(store: Store, userId: string, otherThan?: string) {
  const futureStart = sql`(${proposals.plan}->>'start')::timestamptz > now()`;
  const upcoming = or(
    and(eq(negotiations.status, "AWAITING_APPROVAL"), futureStart),
    and(
      eq(negotiations.status, "CONFIRMED"),
      sql`(${proposals.plan}->>'end')::timestamptz > now()`,
    ),
  );
  return store
    .select({
      id: negotiations.id,
      ownerId: sidequests.ownerId,
      members: agentConversations.participants,
      intent: sidequests.intent,
      title: sql<string | null>`${proposals.activitySnapshot}->>'title'`,
      location: sql<string | null>`${proposals.activitySnapshot}->>'location'`,
      start: sql<string | null>`${proposals.plan}->>'start'`,
      end: sql<string | null>`${proposals.plan}->>'end'`,
      status: negotiations.status,
      approved: approvals.approved,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(negotiations)
    .innerJoin(
      agentConversations,
      eq(agentConversations.id, negotiations.conversationId),
    )
    .innerJoin(sidequests, eq(sidequests.id, agentConversations.sidequestId))
    .leftJoin(proposals, eq(proposals.id, negotiations.activeProposalId))
    .leftJoin(
      approvals,
      and(eq(approvals.proposalId, proposals.id), eq(approvals.userId, userId)),
    )
    .where(
      and(
        sql`${agentConversations.participants} @> ${JSON.stringify([userId])}::jsonb`,
        otherThan
          ? and(ne(agentConversations.id, otherThan), upcoming)
          : or(
              and(
                inArray(negotiations.status, [...planningStatuses]),
                or(sql`${proposals.id} is null`, futureStart),
              ),
              upcoming,
            ),
      ),
    )
    .orderBy(
      sql`case when ${negotiations.status} = 'AWAITING_APPROVAL' and ${approvals.approved} is null then 0 else 1 end`,
      asc(sql`(${proposals.plan}->>'start')::timestamptz`),
      desc(negotiations.updatedAt),
    )
    .limit(24);
}

export async function currentPlansForChat(store: Store, userId: string) {
  const rows = await currentPlanRows(store, userId);
  if (!rows.length) return { total: 0, plans: [] };
  const people = await store
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, [...new Set(rows.flatMap((row) => row.members))]));
  const names = new Map(people.map((person) => [person.id, person.name]));
  let bytes = 0;
  const plans = rows
    .map((row) => ({
      title: (row.title
        ? activityLabels({ title: row.title, location: row.location ?? "" })
            .title
        : row.intent
      ).slice(0, 140),
      status: row.status,
      role: row.ownerId === userId ? "organizer" : "participant",
      people: row.members
        .filter((id) => id !== userId)
        .map((id) => names.get(id)?.slice(0, 60))
        .filter(Boolean),
      start: row.start,
      end: row.end,
      yourDecision:
        row.approved === true
          ? "approved"
          : row.status === "AWAITING_APPROVAL"
            ? "needs approval"
            : undefined,
    }))
    .filter(
      (plan) => (bytes += Buffer.byteLength(JSON.stringify(plan))) <= 6500,
    );
  return { total: rows[0]!.total, plans };
}

export async function planningCommitmentsForScout(
  store: Store,
  userId: string,
  conversationId: string,
) {
  const rows = await currentPlanRows(store, userId, conversationId);
  // Times can inform the Scout's vote. Titles and people from other groups stay out of the turn.
  return rows.map((row) => ({
    start: row.start,
    end: row.end,
    status:
      row.status === "CONFIRMED"
        ? "confirmed"
        : row.approved
          ? "approved, awaiting others"
          : "tentative",
  }));
}
