import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { type z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import * as s from "../src/server/db/schema";
import { database } from "./lib/embedded-db";
import { seed, syntheticIds } from "../src/server/sidequest/seed";
import { OpenRouterModel, type Model } from "../src/server/sidequest/model";
import { MemoryService } from "../src/server/sidequest/memory";
import { NegotiationService } from "../src/server/sidequest/negotiation";
import { EventAgent } from "../src/server/sidequest/events";
import { proposalHash } from "../src/server/sidequest/constraints";
import { type AgentAction } from "../src/server/sidequest/types";
import type { Database } from "../src/server/sidequest/storage";
const embedded = process.argv.includes("--embedded"),
  real = process.argv.includes("--real");
let db: Database, close: () => Promise<void>;
if (embedded) ({ db, close } = await database());
else {
  if (!process.env.DATABASE_URL)
    throw new Error("Configure DATABASE_URL, or use pnpm demo:local");
  const conn = postgres(process.env.DATABASE_URL);
  db = drizzle(conn, { schema: s });
  close = () => conn.end();
}
const saver = embedded
  ? new MemorySaver()
  : PostgresSaver.fromConnString(process.env.DATABASE_URL!);
class DemoModel implements Model {
  constructor(public replies: unknown[]) {}
  async generate<T>(
    _task: string,
    schema: z.ZodType<T>,
    _data: unknown,
  ): Promise<T> {
    if (!this.replies.length) throw new Error("Demo script exhausted");
    return schema.parse(this.replies.shift());
  }
}
function message(
  type: AgentAction["type"],
  recipientId: string | null,
  content: string,
  other: Partial<AgentAction> = {},
): AgentAction {
  return {
    type,
    recipientId,
    content,
    plan: null,
    proposalHash: null,
    ...other,
  };
}
try {
  await seed(db);
  if (saver instanceof PostgresSaver) await saver.setup();
  const [a, b, c] = syntheticIds as [string, string, string];
  const scripted = new DemoModel([]),
    model = real ? new OpenRouterModel() : scripted;
  const memory = new MemoryService(db, model),
    service = new NegotiationService(db, model, memory, undefined, saver);
  const quest = await service.create(a, {
    requestId: randomUUID(),
    intent:
      "I want to hang out with people this weekend. Something relaxed near campus would be fun.",
    constraints: { maxCost: 15000 },
  });
  const n = await service.start(a, quest.id, [b, c]);
  const options = await new EventAgent(db, model).options(
    await service.participants([a, b, c], {}),
  );
  const music = options.find((o) => o.activity.category === "MUSIC")!,
    games = options.find((o) => o.activity.category === "GAMES")!;
  const hash = proposalHash(games.plan);
  scripted.replies.push(
    message(
      "INQUIRY",
      b,
      "My user wants a relaxed weekend hangout. What would yours enjoy?",
    ),
    message(
      "INQUIRY",
      c,
      "An indoor activity would suit mine. Are you free Saturday afternoon?",
    ),
    message(
      "INFORM",
      a,
      "My user can join only after 6 PM. Could we find a quiet evening option?",
    ),
    message(
      "CONSULT_EVENTS",
      null,
      "Find indoor activities after 6 PM for three people, under ₩12,000 each.",
    ),
    {
      recommendations: [
        {
          activityId: music.activity.id,
          explanation:
            "Quiet indoor music with sufficient capacity and budget.",
        },
        {
          activityId: games.activity.id,
          explanation: "Small indoor game session also fits the group.",
        },
      ],
    },
    message(
      "PROPOSE",
      a,
      "The event catalog has a quiet indie listening lounge at 6 PM for ₩10,000. Would that work?",
      { plan: music.plan },
    ),
    message(
      "COUNTER",
      c,
      "Could we try the ₩8,000 board game meetup at 6 PM instead? It gives us more time to talk.",
      { plan: games.plan },
    ),
    message(
      "ACCEPT",
      b,
      "6 PM fits the time restriction. The indoor game meetup is acceptable to my Scout.",
      { proposalHash: hash },
    ),
    message(
      "ACCEPT",
      a,
      "Board games fit my user's indoor preference. Ask the humans before confirming.",
      { proposalHash: hash },
    ),
    message(
      "ACCEPT",
      c,
      "Agreed at agent level. Sending the identical proposal for human approval.",
      { proposalHash: hash },
    ),
  );
  console.info(
    `\nSYNTHETIC DEMO — ${real ? "REAL OpenRouter decisions" : "scripted model responses"}; actual graphs, database, routing and validators.\n`,
  );
  const result = await service.run(a, n.id);
  const transcript = await db
    .select()
    .from(s.agentMessages)
    .where(eq(s.agentMessages.conversationId, n.conversationId))
    .orderBy(s.agentMessages.turn);
  for (const m of transcript)
    console.info(
      `[${m.type}] Scout(${m.senderId}) → Scout(${m.recipientId}): ${m.content}`,
    );
  console.info(
    `\nStatus: ${result.status}; proposal rounds: ${result.round}; calls reserved: ${result.calls}`,
  );
  if (result.status === "AWAITING_APPROVAL" && result.activeProposalId) {
    const [proposal] = await db
      .select()
      .from(s.proposals)
      .where(eq(s.proposals.id, result.activeProposalId));
    console.info(
      `Exact proposal v${proposal!.version}: ${JSON.stringify(proposal!.plan)}\nHash: ${proposal!.hash}`,
    );
    console.info(
      "Simulating explicit approval by each SYNTHETIC human (demo only):",
    );
    for (const userId of [a, b, c]) {
      const approved = await service.approve(userId, {
        negotiationId: n.id,
        proposalId: proposal!.id,
        hash: proposal!.hash,
        approved: true,
      });
      console.info(`${userId} approved → ${approved.status}`);
    }
  } else if (result.status === "FAILED")
    throw new Error(`Demo negotiation failed: ${result.failure}`);
} finally {
  if (saver instanceof PostgresSaver) await saver.end();
  await close();
}
