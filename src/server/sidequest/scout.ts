import { and, eq, desc, notExists } from "drizzle-orm";
import { z } from "zod";
import {
  scoutConversations,
  scoutMessages,
  sidequests,
  userMemories,
} from "../db/schema";
import { type Database, lock } from "./storage";
import { type Model } from "./model";
import { type MemoryService } from "./memory";
import { DomainError } from "./types";
export class ScoutService {
  constructor(
    private db: Database,
    private model: Model,
    private memory: MemoryService,
  ) {}
  async send(
    userId: string,
    input: { conversationId?: string; requestId: string; content: string },
  ) {
    const source = await this.db.transaction(async (tx) => {
      await lock(tx, `scout:${userId}`);
      const [prior] = await tx
        .select()
        .from(scoutMessages)
        .where(
          and(
            eq(scoutMessages.userId, userId),
            eq(scoutMessages.requestId, input.requestId),
            eq(scoutMessages.role, "user"),
          ),
        );
      if (prior) {
        if (
          prior.content !== input.content ||
          (input.conversationId &&
            prior.conversationId !== input.conversationId)
        )
          throw new DomainError(
            "CONFLICT",
            "Request ID reused with different input",
          );
        return prior;
      }
      let conversationId = input.conversationId;
      if (conversationId) {
        const [conversation] = await tx
          .select()
          .from(scoutConversations)
          .where(
            and(
              eq(scoutConversations.id, conversationId),
              eq(scoutConversations.userId, userId),
            ),
          );
        if (!conversation)
          throw new DomainError("NOT_FOUND", "Conversation not found");
      } else {
        const [conversation] = await tx
          .insert(scoutConversations)
          .values({ userId })
          .returning();
        conversationId = conversation!.id;
      }
      const [message] = await tx
        .insert(scoutMessages)
        .values({
          conversationId,
          userId,
          content: input.content,
          requestId: input.requestId,
          role: "user",
        })
        .returning();
      return message!;
    });
    const [priorReply] = await this.db
      .select()
      .from(scoutMessages)
      .where(
        and(
          eq(scoutMessages.userId, userId),
          eq(scoutMessages.requestId, input.requestId),
          eq(scoutMessages.role, "assistant"),
        ),
      );
    const resultFor = async (message: typeof scoutMessages.$inferSelect) => {
      const [quest] = await this.db
        .select({ id: sidequests.id })
        .from(sidequests)
        .where(
          and(
            eq(sidequests.ownerId, userId),
            eq(sidequests.requestId, source.id),
          ),
        );
      return {
        conversationId: source.conversationId,
        message,
        planningQuestId: quest?.id,
      };
    };
    if (priorReply) return resultFor(priorReply);
    try {
      // Inline for the prototype: corrections/temporary constraints take effect before the reply.
      await this.memory.extract(userId, source.id);
      const relevant = await this.memory.retrieve(userId, {
        query: input.content,
        conversationId: source.conversationId,
      });
      const fallback = await this.memory.retrieve(userId, {
        conversationId: source.conversationId,
        limit: 6,
      });
      const history = await this.db
        .select({ role: scoutMessages.role, content: scoutMessages.content })
        .from(scoutMessages)
        .where(
          and(
            eq(scoutMessages.conversationId, source.conversationId),
            eq(scoutMessages.userId, userId),
            notExists(
              this.db
                .select({ id: userMemories.id })
                .from(userMemories)
                .where(
                  and(
                    eq(
                      userMemories.conversationId,
                      scoutMessages.conversationId,
                    ),
                    eq(userMemories.status, "DELETED"),
                  ),
                ),
            ),
          ),
        )
        .orderBy(desc(scoutMessages.createdAt))
        .limit(10);
      const reply = await this.model.generate(
        "Reply conversationally as the user's personal Scout. Use relevant retrieved memories, including corrections and confidence. Inspect only the latest message for a direct request from the user to find, organize, or coordinate an activity. If it is such a request, set planningIntent to a concise standalone summary of the activity and necessary preferences, dates and limits, in the user's language. Omit private or unrelated details. Vague activity requests such as 'Find me something fun this weekend' count. For casual chat, preference updates, hypothetical or quoted requests, and requests to modify an existing plan, omit planningIntent. Do not say agents have been contacted or anything has been confirmed. Remembered soft preferences are not hard constraints.",
        z.object({
          content: z.string().min(1).max(3000),
          planningIntent: z.string().trim().min(1).max(2000).nullish(),
        }),
        {
          message: input.content,
          memories: [
            ...new Map(
              [...relevant, ...fallback].map((m) => [m.id, m]),
            ).values(),
          ].slice(0, 12),
          messages: history.reverse(),
        },
      );
      const message = await this.db.transaction(async (tx) => {
        const [savedReply] = await tx
          .insert(scoutMessages)
          .values({
            userId,
            conversationId: source.conversationId,
            role: "assistant",
            requestId: input.requestId,
            content: reply.content,
            status: "COMPLETE",
          })
          .onConflictDoNothing()
          .returning();
        if (savedReply && reply.planningIntent) {
          await tx
            .insert(sidequests)
            .values({
              ownerId: userId,
              requestId: source.id,
              intent: reply.planningIntent,
              constraints: {},
            })
            .onConflictDoNothing();
        }
        return savedReply;
      });
      await this.db
        .update(scoutMessages)
        .set({ status: "COMPLETE" })
        .where(eq(scoutMessages.id, source.id));
      const stored =
        message ??
        (
          await this.db
            .select()
            .from(scoutMessages)
            .where(
              and(
                eq(scoutMessages.userId, userId),
                eq(scoutMessages.requestId, input.requestId),
                eq(scoutMessages.role, "assistant"),
              ),
            )
        )[0]!;
      return resultFor(stored);
    } catch {
      await this.db
        .update(scoutMessages)
        .set({ status: "FAILED" })
        .where(eq(scoutMessages.id, source.id));
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Scout could not finish. Retry with the same request ID; no agreement was made.",
      );
    }
  }
}
