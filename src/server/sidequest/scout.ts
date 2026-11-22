import { and, eq, desc, inArray, notExists, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  scoutConversations,
  scoutMessages,
  sidequests,
  agentConversations,
  negotiationEvents,
  negotiations,
  proposals,
  userMemories,
} from "../db/schema";
import { type Database, lock } from "./storage";
import { type Model } from "./model";
import { type MemoryService } from "./memory";
import { type NegotiationService } from "./negotiation";
import { DomainError, relativeTimeChange } from "./types";
import { currentPlansForChat } from "./plan-context";
import { requestedGroupSize } from "./discovery";
export class ScoutService {
  constructor(
    private db: Database,
    private model: Model,
    private memory: MemoryService,
    private negotiation: NegotiationService,
  ) {}
  async send(
    userId: string,
    input: {
      conversationId?: string;
      requestId: string;
      content: string;
      revisionNegotiationId?: string;
    },
  ) {
    if (input.revisionNegotiationId) {
      if (!input.content.trim() || input.content.trim().length > 1000)
        throw new DomainError(
          "BAD_REQUEST",
          "Enter a revision of up to 1,000 characters",
        );
      await this.negotiation.authorized(userId, input.revisionNegotiationId);
    }
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
      const [revision] = await this.db
        .select({ id: negotiationEvents.negotiationId })
        .from(negotiationEvents)
        .where(
          and(
            eq(negotiationEvents.type, "REVISION_REQUESTED"),
            sql`${negotiationEvents.detail}->>'requestId' = ${source.id}`,
            sql`${negotiationEvents.detail}->>'userId' = ${userId}`,
          ),
        )
        .limit(1);
      if (
        input.revisionNegotiationId &&
        revision?.id !== input.revisionNegotiationId
      )
        throw new DomainError(
          "CONFLICT",
          "Request ID reused for a different plan",
        );
      return {
        conversationId: source.conversationId,
        message,
        planningQuestId: quest?.id,
        revisedNegotiationId: revision?.id,
      };
    };
    if (priorReply) return resultFor(priorReply);
    try {
      const replyToChat = async () => {
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
        const [currentPlans, history] = await Promise.all([
          currentPlansForChat(this.db, userId),
          this.db
            .select({
              role: scoutMessages.role,
              content: scoutMessages.content,
            })
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
            .limit(10),
        ]);
        return this.model.generate(
          "Reply conversationally as the user's personal Scout. Use relevant retrieved memories, including corrections and confidence. Use currentPlans as the source of truth about their existing plans. Distinguish confirmed plans, proposals needing the user's approval, proposals awaiting others, and conversations still in progress. Flag scheduling overlaps when relevant and label any UTC times. If total exceeds the number of plan summaries supplied, say the list is partial when asked for all plans. Never invent plans or infer that a pending proposal is confirmed. Asking about existing plans or availability is read-only. A gap between plans does not prove availability. If a proposal needs the user's decision, direct them to the plan card or Plans to approve or pass. Inspect only the latest message for a direct planning request. For a change to an existing group plan, such as 'let’s go to a movie instead', set revisionInstruction to a concise summary of the requested change and omit planningIntent. For a new activity search or coordination request, set planningIntent to a concise standalone summary with preferences, dates and limits and omit revisionInstruction. Vague requests such as 'Find me something fun this weekend' count. For casual chat, memory updates, hypothetical or quoted requests, omit both fields. Omit private or unrelated details from any group-planning intent or revision. Do not claim agents have been contacted or a new plan has been confirmed. Remembered soft preferences are not hard constraints.",
          z.object({
            content: z.string().min(1).max(3000),
            planningIntent: z.string().trim().min(1).max(2000).nullish(),
            revisionInstruction: z.string().trim().min(1).max(1000).nullish(),
          }),
          {
            message: input.content,
            currentPlans,
            memories: [
              ...new Map(
                [...relevant, ...fallback].map((m) => [m.id, m]),
              ).values(),
            ].slice(0, 12),
            messages: history.reverse().map((entry) => ({
              ...entry,
              content: entry.content.slice(0, 600),
            })),
          },
        );
      };
      const reply = input.revisionNegotiationId
        ? {
            content: "",
            planningIntent: undefined,
            revisionInstruction: undefined,
          }
        : await replyToChat();
      const directReplacement =
        /^\s*(?:let['’]s|can we|could we|how about we)\s+[^\n]+\binstead\s*[.!?]?\s*$/iu.test(
          input.content,
        ) ||
        /^\s*(?:can|could) we (?:do|go|meet|make it) (?:earlier|later|after .+|before .+)\s*[.!?]?\s*$/iu.test(
          input.content,
        );
      const revisionInstruction =
        input.revisionNegotiationId !== undefined ||
        relativeTimeChange(input.content) !== undefined
          ? input.content.trim()
          : (reply.revisionInstruction ??
            (directReplacement && input.content.trim().length <= 1000
              ? input.content.trim()
              : undefined));
      const message = await this.db.transaction(async (tx) => {
        const linked = eq(scoutMessages.conversationId, source.conversationId);
        const candidates =
          revisionInstruction && !input.revisionNegotiationId
            ? await tx
                .select({ id: negotiations.id, linked })
                .from(negotiations)
                .innerJoin(
                  agentConversations,
                  eq(negotiations.conversationId, agentConversations.id),
                )
                .innerJoin(
                  sidequests,
                  eq(agentConversations.sidequestId, sidequests.id),
                )
                .leftJoin(
                  scoutMessages,
                  eq(sidequests.requestId, scoutMessages.id),
                )
                .leftJoin(
                  proposals,
                  eq(negotiations.activeProposalId, proposals.id),
                )
                .where(
                  and(
                    sql`${agentConversations.participants} @> ${JSON.stringify([userId])}::jsonb`,
                    or(
                      eq(negotiations.status, "AWAITING_USER_INPUT"),
                      and(linked, eq(negotiations.status, "FAILED")),
                      and(
                        inArray(negotiations.status, [
                          "AWAITING_APPROVAL",
                          "CONFIRMED",
                        ]),
                        sql`(${proposals.plan}->>'end')::timestamptz > now()`,
                      ),
                    ),
                  ),
                )
                .orderBy(
                  sql`${linked} desc nulls last`,
                  desc(sidequests.createdAt),
                )
                .limit(2)
            : [];
        const target = input.revisionNegotiationId
          ? { id: input.revisionNegotiationId }
          : candidates[0]?.linked || candidates.length === 1
            ? candidates[0]
            : undefined;
        const [savedReply] = await tx
          .insert(scoutMessages)
          .values({
            userId,
            conversationId: source.conversationId,
            role: "assistant",
            requestId: input.requestId,
            content: revisionInstruction
              ? target
                ? "I’ll take that change back to the Scouts in this plan."
                : "Open the plan you want to change in Plans and send your revision there."
              : reply.content,
            status: "COMPLETE",
          })
          .onConflictDoNothing()
          .returning();
        if (savedReply && revisionInstruction && target) {
          await this.negotiation.revise(
            userId,
            {
              negotiationId: target.id,
              instruction: revisionInstruction,
              constraints: {},
              requestId: source.id,
            },
            tx,
          );
        } else if (savedReply && !revisionInstruction && reply.planningIntent) {
          await tx
            .insert(sidequests)
            .values({
              ownerId: userId,
              requestId: source.id,
              intent: reply.planningIntent,
              constraints: requestedGroupSize(input.content) ?? {},
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
    } catch (error) {
      await this.db
        .update(scoutMessages)
        .set({ status: "FAILED" })
        .where(eq(scoutMessages.id, source.id));
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        "PRECONDITION_FAILED",
        "Scout could not finish. Retry with the same request ID; no agreement was made.",
      );
    }
  }
}
