import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import type { Constraints, Plan, AgentAction } from "../sidequest/types";
const id = () => uuid("id").defaultRandom().primaryKey();
const time = (name: string) =>
  timestamp(name, { withTimezone: true }).defaultNow().notNull();
const owner = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
export const memoryCategory = pgEnum("sq_memory_category", [
  "INTEREST",
  "PREFERENCE",
  "DISLIKE",
  "CONSTRAINT",
  "AVAILABILITY",
  "SOCIAL_PREFERENCE",
  "FEEDBACK",
  "EXPERIENCE",
]);
export const memoryScope = pgEnum("sq_memory_scope", [
  "PERSISTENT",
  "TEMPORARY",
  "SESSION",
]);
export const negotiationStatus = pgEnum("sq_negotiation_status", [
  "DISCOVERING",
  "NEGOTIATING",
  "AWAITING_USER_INPUT",
  "AWAITING_APPROVAL",
  "CONFIRMED",
  "FAILED",
  "CANCELLED",
]);
export const profiles = pgTable("sq_profiles", {
  userId: owner().primaryKey(),
  discoverable: boolean().default(false).notNull(),
  circle: text().default("campus").notNull(),
  blockedUsers: jsonb().$type<string[]>().default([]).notNull(),
  sharing: boolean().default(false).notNull(),
  constraints: jsonb().$type<Constraints>().default({}).notNull(),
  updatedAt: time("updated_at"),
});
export const availability = pgTable(
  "sq_availability",
  {
    id: id(),
    userId: owner(),
    start: timestamp({ withTimezone: true }).notNull(),
    end: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    index("sq_availability_user").on(t.userId),
    check("sq_availability_order", sql`${t.end} > ${t.start}`),
  ],
);
export const scoutConversations = pgTable(
  "sq_scout_conversations",
  { id: id(), userId: owner(), createdAt: time("created_at") },
  (t) => [index("sq_scout_owner").on(t.userId)],
);
export const scoutMessages = pgTable(
  "sq_scout_messages",
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => scoutConversations.id, { onDelete: "cascade" }),
    userId: owner(),
    role: text({ enum: ["user", "assistant"] }).notNull(),
    content: text().notNull(),
    requestId: uuid().notNull(),
    status: text({ enum: ["PENDING", "COMPLETE", "FAILED"] })
      .default("PENDING")
      .notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    uniqueIndex("sq_scout_idempotency").on(t.userId, t.requestId, t.role),
    index("sq_scout_history").on(t.conversationId, t.createdAt),
  ],
);
export const userMemories = pgTable(
  "sq_user_memories",
  {
    id: id(),
    userId: owner(),
    category: memoryCategory().notNull(),
    key: text().notNull(),
    content: text().notNull(),
    value: jsonb().$type<Record<string, unknown>>(),
    scope: memoryScope().notNull(),
    confidence: integer().notNull(),
    explicit: boolean().notNull(),
    sourceMessageId: uuid().references(() => scoutMessages.id, {
      onDelete: "set null",
    }),
    conversationId: uuid().references(() => scoutConversations.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp({ withTimezone: true }),
    status: text({ enum: ["ACTIVE", "SUPERSEDED", "DELETED"] })
      .default("ACTIVE")
      .notNull(),
    createdAt: time("created_at"),
    updatedAt: time("updated_at"),
  },
  (t) => [
    index("sq_memory_owner_status").on(t.userId, t.status, t.category),
    index("sq_memory_key").on(t.userId, t.key),
    index("sq_memory_fts").using(
      "gin",
      sql`to_tsvector('english', ${t.content})`,
    ),
    check("sq_memory_confidence", sql`${t.confidence} BETWEEN 0 AND 100`),
  ],
);
export const memoryRevisions = pgTable("sq_memory_revisions", {
  id: id(),
  memoryId: uuid()
    .notNull()
    .references(() => userMemories.id, { onDelete: "cascade" }),
  userId: owner(),
  supersedesId: uuid().references(() => userMemories.id, {
    onDelete: "set null",
  }),
  reason: text().notNull(),
  createdAt: time("created_at"),
});
export const agentEpisodes = pgTable(
  "sq_agent_episodes",
  {
    id: id(),
    userId: owner(),
    summary: text().notNull(),
    kind: text().notNull(),
    createdAt: time("created_at"),
  },
  (t) => [index("sq_episode_owner").on(t.userId, t.createdAt)],
);
export const activities = pgTable(
  "sq_activities",
  {
    id: id(),
    title: text().notNull(),
    description: text().notNull(),
    category: text().notNull(),
    location: text().notNull(),
    start: timestamp({ withTimezone: true }).notNull(),
    end: timestamp({ withTimezone: true }).notNull(),
    cost: integer().notNull(),
    capacity: integer().notNull(),
    tags: jsonb().$type<string[]>().default([]).notNull(),
    synthetic: boolean().default(true).notNull(),
  },
  (t) => [
    check(
      "sq_activity_valid",
      sql`${t.end} > ${t.start} AND ${t.cost} >= 0 AND ${t.capacity} > 0`,
    ),
    index("sq_activity_time").on(t.start, t.end),
  ],
);
export const sidequests = pgTable(
  "sq_sidequests",
  {
    id: id(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    intent: text().notNull(),
    requestId: uuid().notNull(),
    constraints: jsonb().$type<Constraints>().default({}).notNull(),
    createdAt: time("created_at"),
  },
  (t) => [uniqueIndex("sq_quest_request").on(t.ownerId, t.requestId)],
);
export const agentConversations = pgTable("sq_agent_conversations", {
  id: id(),
  sidequestId: uuid()
    .notNull()
    .unique()
    .references(() => sidequests.id, { onDelete: "cascade" }),
  participants: jsonb().$type<string[]>().notNull(),
  createdAt: time("created_at"),
});
export const negotiations = pgTable("sq_negotiations", {
  id: id(),
  conversationId: uuid()
    .notNull()
    .unique()
    .references(() => agentConversations.id, { onDelete: "cascade" }),
  status: negotiationStatus().default("DISCOVERING").notNull(),
  turn: integer().default(0).notNull(),
  round: integer().default(0).notNull(),
  calls: integer().default(0).notNull(),
  tokens: integer().default(0).notNull(),
  activeProposalId: uuid(),
  failure: text(),
  leaseOwner: text(),
  leaseUntil: timestamp({ withTimezone: true }),
  constraints: jsonb()
    .$type<Record<string, Constraints>>()
    .default({})
    .notNull(),
  pendingAction: jsonb().$type<{
    actor: string;
    action: AgentAction;
    turn: number;
  }>(),
  updatedAt: time("updated_at"),
});
export const proposals = pgTable(
  "sq_proposals",
  {
    id: id(),
    negotiationId: uuid()
      .notNull()
      .references(() => negotiations.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    hash: text().notNull(),
    plan: jsonb().$type<Plan>().notNull(),
    activitySnapshot: jsonb()
      .$type<{
        title: string;
        location: string;
        cost: number;
        capacity: number;
        tags: string[];
        start: string;
        end: string;
      }>()
      .notNull(),
    createdAt: time("created_at"),
  },
  (t) => [uniqueIndex("sq_proposal_version").on(t.negotiationId, t.version)],
);
export const proposalParticipants = pgTable(
  "sq_proposal_participants",
  {
    id: id(),
    proposalId: uuid()
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    userId: owner(),
    agentAccepted: boolean().default(false).notNull(),
  },
  (t) => [uniqueIndex("sq_proposal_user").on(t.proposalId, t.userId)],
);
export const agentMessages = pgTable(
  "sq_agent_messages",
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => agentConversations.id, { onDelete: "cascade" }),
    senderId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipientId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text({
      enum: [
        "INQUIRY",
        "INFORM",
        "PROPOSE",
        "COUNTER",
        "ACCEPT",
        "REJECT",
        "REQUEST_INFO",
        "WITHDRAW",
      ],
    }).notNull(),
    content: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    proposalId: uuid().references(() => proposals.id, { onDelete: "set null" }),
    proposalHash: text(),
    turn: integer().notNull(),
    status: text({ enum: ["PENDING", "PROCESSED"] })
      .default("PENDING")
      .notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    uniqueIndex("sq_message_turn").on(t.conversationId, t.turn),
    index("sq_mailbox").on(t.conversationId, t.recipientId, t.status),
  ],
);
export const negotiationEvents = pgTable("sq_negotiation_events", {
  id: id(),
  negotiationId: uuid()
    .notNull()
    .references(() => negotiations.id, { onDelete: "cascade" }),
  type: text().notNull(),
  detail: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: time("created_at"),
});
export const approvals = pgTable(
  "sq_approvals",
  {
    id: id(),
    proposalId: uuid()
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    userId: owner(),
    hash: text().notNull(),
    approved: boolean().notNull(),
    createdAt: time("created_at"),
  },
  (t) => [uniqueIndex("sq_approval_user").on(t.proposalId, t.userId)],
);
