import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import * as schema from "../src/server/db/schema";
import { seed, syntheticIds } from "../src/server/sidequest/seed";
import { MemoryService } from "../src/server/sidequest/memory";
import { NegotiationService } from "../src/server/sidequest/negotiation";
import { EventAgent } from "../src/server/sidequest/events";
import { proposalHash } from "../src/server/sidequest/constraints";
import { QueueModel } from "./scripted-model";
import type { AgentAction } from "../src/server/sidequest/types";
it.skipIf(!process.env.NATIVE_TEST_DATABASE_URL)(
  "native PostgreSQL persists checkpoints and serializes concurrent approvals without duplicate confirmation",
  async () => {
    const url = process.env.NATIVE_TEST_DATABASE_URL!;
    const conn = postgres(url),
      db = drizzle(conn, { schema }),
      saver = PostgresSaver.fromConnString(url, {
        schema: "sidequest_test_checkpoints",
      });
    try {
      await seed(db);
      await saver.setup();
      const [a, b, c] = syntheticIds as [string, string, string];
      const model = new QueueModel([]),
        service = new NegotiationService(
          db,
          model,
          new MemoryService(db, model),
          undefined,
          saver,
        );
      const options = await new EventAgent(db, model).options(
        await service.participants([a, b, c], {}),
      );
      const plan = options[0]!.plan,
        hash = proposalHash(plan);
      const action = (
        type: AgentAction["type"],
        recipientId: string,
        content: string,
        extra: Partial<AgentAction> = {},
      ): AgentAction => ({
        type,
        recipientId,
        content,
        plan: null,
        proposalHash: null,
        ...extra,
      });
      model.replies.push(
        action("INQUIRY", b, "What would you like?"),
        action("PROPOSE", c, "Try this feasible activity", { plan }),
        action("ACCEPT", a, "Works for C", { proposalHash: hash }),
        action("ACCEPT", b, "Works for A", { proposalHash: hash }),
        action("ACCEPT", c, "Works for B", { proposalHash: hash }),
      );
      const quest = await service.create(a, {
        requestId: randomUUID(),
        intent: "Synthetic native PostgreSQL integration test",
        constraints: {},
      });
      const n = await service.start(a, quest.id, [b, c]);
      const agreed = await service.run(a, n.id);
      expect(agreed.status).toBe("AWAITING_APPROVAL");
      const checkpoint = await saver.getTuple({
        configurable: { thread_id: `negotiation:${n.id}` },
      });
      expect(checkpoint?.checkpoint.channel_values.negotiationId).toBe(n.id);
      const restartedSaver = PostgresSaver.fromConnString(url, {
        schema: "sidequest_test_checkpoints",
      });
      try {
        expect(
          (
            await restartedSaver.getTuple({
              configurable: { thread_id: `negotiation:${n.id}` },
            })
          )?.checkpoint.id,
        ).toBe(checkpoint?.checkpoint.id);
      } finally {
        await restartedSaver.end();
      }
      const input = {
        negotiationId: n.id,
        proposalId: agreed.activeProposalId!,
        hash,
        approved: true,
      };
      await Promise.all(
        [a, b, c, a, b, c].map((userId) => service.approve(userId, input)),
      );
      expect((await service.load(n.id)).n.status).toBe("CONFIRMED");
      expect(
        await db
          .select()
          .from(schema.approvals)
          .where(eq(schema.approvals.proposalId, input.proposalId)),
      ).toHaveLength(3);
      const events = await db
        .select()
        .from(schema.negotiationEvents)
        .where(
          and(
            eq(schema.negotiationEvents.negotiationId, n.id),
            eq(schema.negotiationEvents.type, "HUMAN_APPROVED"),
          ),
        );
      expect(
        events.filter((event) => event.detail.status === "CONFIRMED"),
      ).toHaveLength(1);
      const turns = await db
        .select()
        .from(schema.agentMessages)
        .where(eq(schema.agentMessages.conversationId, n.conversationId));
      expect(turns).toHaveLength(5);
    } finally {
      await saver.end();
      await conn.end();
    }
  },
);
