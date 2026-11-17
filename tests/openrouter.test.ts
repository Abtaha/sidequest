import "dotenv/config";
import { it, expect } from "vitest";
import { z } from "zod";
import { OpenRouterModel } from "../src/server/sidequest/model";
import { extractionSchema } from "../src/server/sidequest/types";
it.skipIf(
  process.env.RUN_OPENROUTER_SMOKE !== "1" ||
    !process.env.OPENROUTER_API_KEY ||
    !process.env.OPENROUTER_MODEL,
)("optional real OpenRouter structured extraction and reply", async () => {
  const model = new OpenRouterModel();
  const facts = await model.generate(
    "Extract separate explicit preferences with exact evidence and stable keys; use null for missing optional values. Do not invent facts.",
    extractionSchema,
    {
      message: "I love indie music and prefer small groups",
      now: new Date().toISOString(),
    },
  );
  expect(facts.memories.length).toBeGreaterThanOrEqual(2);
  const response = await model.generate(
    "Reply as Scout, using the supplied memories. Do not claim approval or bookings.",
    z.object({ content: z.string().min(1) }),
    { memories: facts.memories, message: "What could we do together?" },
  );
  expect(response.content.length).toBeGreaterThan(0);
});
it.skipIf(
  process.env.RUN_OPENROUTER_SMOKE !== "1" ||
    !process.env.OPENROUTER_API_KEY ||
    !process.env.OPENROUTER_MODEL,
)(
  "optional real OpenRouter independent agent conversation",
  async () => {
    const { database } = await import("./database");
    const { seed, syntheticIds } = await import("../src/server/sidequest/seed");
    const { MemoryService } = await import("../src/server/sidequest/memory");
    const { NegotiationService } =
      await import("../src/server/sidequest/negotiation");
    const { agentMessages } = await import("../src/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const { randomUUID } = await import("node:crypto");
    const f = await database();
    try {
      await seed(f.db);
      const model = new OpenRouterModel();
      const service = new NegotiationService(
        f.db,
        model,
        new MemoryService(f.db, model),
      );
      const quest = await service.create(syntheticIds[0]!, {
        intent:
          "Find a relaxed indoor hangout this weekend. First ask the other Scouts about their users' preferences, then negotiate a feasible activity.",
        requestId: randomUUID(),
        constraints: { maxCost: 15000 },
      });
      const n = await service.start(syntheticIds[0]!, quest.id, [
        syntheticIds[1]!,
        syntheticIds[2]!,
      ]);
      const result = await service.run(syntheticIds[0]!, n.id);
      const transcript = await f.db
        .select()
        .from(agentMessages)
        .where(eq(agentMessages.conversationId, n.conversationId))
        .orderBy(agentMessages.turn);
      console.info(
        transcript
          .map(
            (m) => `${m.senderId} → ${m.recipientId} [${m.type}]: ${m.content}`,
          )
          .join("\n"),
      );
      expect(transcript.length).toBeGreaterThanOrEqual(2);
      expect(
        new Set(transcript.map((m) => m.senderId)).size,
      ).toBeGreaterThanOrEqual(2);
      expect(result.status).not.toBe("CONFIRMED");
    } finally {
      await f.close();
    }
  },
  300_000,
);
