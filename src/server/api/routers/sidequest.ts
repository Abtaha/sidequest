import { and, eq, desc, or, sql, gt, inArray, gte, ne } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import * as s from "@/server/db/schema";
import { services } from "@/server/sidequest/services";
import { constraintsSchema, DomainError } from "@/server/sidequest/types";
import { checkContacts } from "@/server/sidequest/constraints";
import { discoveryScope } from "@/server/sidequest/discovery";
import { lock } from "@/server/sidequest/storage";
// Domain errors carry public-safe messages. Database/provider details never reach clients.
const p = protectedProcedure.use(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    const cause = result.error.cause;
    if (cause instanceof DomainError)
      throw new TRPCError({ code: cause.code, message: cause.message });
    if (result.error.code === "INTERNAL_SERVER_ERROR")
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Request failed; retry or check server configuration",
      });
  }
  return result;
});
const idInput = z.object({ id: z.string().uuid() });
export const scoutRouter = createTRPCRouter({
  sendMessage: p
    .input(
      z.object({
        conversationId: z.string().uuid().optional(),
        revisionNegotiationId: z.string().uuid().optional(),
        requestId: z.string().uuid(),
        content: z.string().min(1).max(6000),
      }),
    )
    .mutation(({ ctx, input }) =>
      services().scout.send(ctx.session.user.id, input),
    ),
  listConversations: p.query(({ ctx }) =>
    ctx.db
      .select()
      .from(s.scoutConversations)
      .where(eq(s.scoutConversations.userId, ctx.session.user.id))
      .orderBy(desc(s.scoutConversations.createdAt))
      .limit(100),
  ),
  getConversation: p.input(idInput).query(async ({ ctx, input }) => {
    const [conversation] = await ctx.db
      .select()
      .from(s.scoutConversations)
      .where(
        and(
          eq(s.scoutConversations.id, input.id),
          eq(s.scoutConversations.userId, ctx.session.user.id),
        ),
      );
    if (!conversation)
      throw new DomainError("NOT_FOUND", "Conversation not found");
    const messages = await ctx.db
      .select()
      .from(s.scoutMessages)
      .where(
        and(
          eq(s.scoutMessages.conversationId, input.id),
          eq(s.scoutMessages.userId, ctx.session.user.id),
        ),
      )
      .orderBy(desc(s.scoutMessages.createdAt))
      .limit(100);
    return { conversation, messages: messages.reverse() };
  }),
  deleteConversation: p.input(idInput).mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(s.scoutConversations)
      .where(
        and(
          eq(s.scoutConversations.id, input.id),
          eq(s.scoutConversations.userId, ctx.session.user.id),
        ),
      );
    return { deleted: true };
  }),
});
const memoryFilter = z
  .object({
    query: z.string().max(500).optional(),
    categories: z.array(z.enum(s.memoryCategory.enumValues)).optional(),
    scopes: z.array(z.enum(s.memoryScope.enumValues)).optional(),
    conversationId: z.string().uuid().optional(),
    since: z.date().optional(),
    limit: z.number().int().min(1).max(30).default(12),
  })
  .default({});
export const memoryRouter = createTRPCRouter({
  list: p
    .input(
      z
        .object({
          afterId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(30),
          categories: z.array(z.enum(s.memoryCategory.enumValues)).optional(),
          scopes: z.array(z.enum(s.memoryScope.enumValues)).optional(),
        })
        .default({}),
    )
    .query(({ ctx, input }) =>
      services().memory.list(ctx.session.user.id, input),
    ),
  search: p
    .input(memoryFilter)
    .query(({ ctx, input }) =>
      services().memory.retrieve(ctx.session.user.id, input),
    ),
  update: p
    .input(
      z.object({
        id: z.string().uuid(),
        content: z.string().min(1).max(500),
        constraints: constraintsSchema.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      services().memory.update(
        ctx.session.user.id,
        input.id,
        input.content,
        input.constraints,
      ),
    ),
  delete: p
    .input(
      z.object({
        id: z.string().uuid(),
        deleteSource: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await services().memory.delete(
        ctx.session.user.id,
        input.id,
        input.deleteSource,
      );
      return { deleted: true };
    }),
});
export const profileRouter = createTRPCRouter({
  onboard: p
    .input(
      z.object({
        requestId: z.string().uuid(),
        interests: z.array(z.string().min(1).max(80)).min(2).max(12),
        socialStyle: z.string().max(80),
        budget: z.string().max(80),
        optIn: z.boolean(),
        openDiscovery: z.boolean().optional(),
        windows: z
          .array(
            z
              .object({ start: z.date(), end: z.date() })
              .refine((w) => w.end > w.start, "Invalid availability"),
          )
          .min(1)
          .max(30),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const userId = ctx.session.user.id;
        await lock(tx, `profile:${userId}`);
        await lock(tx, `memory:${userId}`);
        const [prior] = await tx
          .select({ id: s.scoutMessages.id })
          .from(s.scoutMessages)
          .where(
            and(
              eq(s.scoutMessages.userId, userId),
              eq(s.scoutMessages.requestId, input.requestId),
              eq(s.scoutMessages.role, "user"),
            ),
          );
        if (prior) return { saved: true };
        await tx
          .insert(s.profiles)
          .values({
            userId,
            discoverable: input.optIn,
            sharing: input.optIn,
            openDiscovery: input.openDiscovery,
          })
          .onConflictDoUpdate({
            target: s.profiles.userId,
            set: {
              discoverable: input.optIn,
              sharing: input.optIn,
              openDiscovery: input.openDiscovery,
              updatedAt: new Date(),
            },
          });
        await tx
          .delete(s.availability)
          .where(eq(s.availability.userId, userId));
        await tx
          .insert(s.availability)
          .values(input.windows.map((w) => ({ userId, ...w })));
        const [conversation] = await tx
          .insert(s.scoutConversations)
          .values({ userId })
          .returning();
        const content = `My interests: ${input.interests.join(", ")}. Social preference: ${input.socialStyle}. Usual budget preference: ${input.budget}.`;
        const [source] = await tx
          .insert(s.scoutMessages)
          .values({
            userId,
            conversationId: conversation!.id,
            role: "user",
            content,
            requestId: input.requestId,
            status: "COMPLETE",
          })
          .returning();
        const choices = [
          ...input.interests.map((interest) => ({
            key: `interest:${interest.toLowerCase()}`,
            category: "INTEREST" as const,
            content: `Enjoys ${interest}`,
          })),
          {
            key: "social:group-preference",
            category: "SOCIAL_PREFERENCE" as const,
            content: `Preferred group size: ${input.socialStyle}`,
          },
          {
            key: "budget:preference",
            category: "PREFERENCE" as const,
            content: `Usual budget preference: ${input.budget}`,
          },
        ];
        for (const choice of choices) {
          await tx
            .update(s.userMemories)
            .set({ status: "SUPERSEDED", updatedAt: new Date() })
            .where(
              and(
                eq(s.userMemories.userId, userId),
                eq(s.userMemories.key, choice.key),
                eq(s.userMemories.status, "ACTIVE"),
              ),
            );
          const [memory] = await tx
            .insert(s.userMemories)
            .values({
              userId,
              ...choice,
              scope: "PERSISTENT",
              confidence: 100,
              explicit: true,
              sourceMessageId: source!.id,
              conversationId: conversation!.id,
            })
            .returning();
          await tx.insert(s.memoryRevisions).values({
            userId,
            memoryId: memory!.id,
            reason: "USER_ONBOARDING",
          });
        }
        return { saved: true };
      }),
    ),
  get: p.query(async ({ ctx }) => {
    const [profile] = await ctx.db
      .select()
      .from(s.profiles)
      .where(eq(s.profiles.userId, ctx.session.user.id));
    const availability = await ctx.db
      .select()
      .from(s.availability)
      .where(eq(s.availability.userId, ctx.session.user.id));
    return { profile: profile ?? null, availability };
  }),
  update: p
    .input(
      z.object({
        discoverable: z.boolean(),
        openDiscovery: z.boolean().optional(),
        sharing: z.boolean(),
        circle: z.string().min(1).max(80),
        blockedUsers: z.array(z.string().max(100)).max(100),
        constraints: constraintsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        await lock(tx, `profile:${ctx.session.user.id}`);
        const [profile] = await tx
          .insert(s.profiles)
          .values({ userId: ctx.session.user.id, ...input })
          .onConflictDoUpdate({
            target: s.profiles.userId,
            set: { ...input, updatedAt: new Date() },
          })
          .returning();
        return profile!;
      });
    }),
  updateAvailability: p
    .input(
      z.object({
        windows: z
          .array(
            z
              .object({ start: z.date(), end: z.date() })
              .refine((w) => w.end > w.start, "End must follow start"),
          )
          .max(30),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        await lock(tx, `profile:${ctx.session.user.id}`);
        await tx
          .delete(s.availability)
          .where(eq(s.availability.userId, ctx.session.user.id));
        if (input.windows.length)
          await tx
            .insert(s.availability)
            .values(
              input.windows.map((w) => ({ userId: ctx.session.user.id, ...w })),
            );
        return { updated: true };
      }),
    ),
});

function publicState(n: typeof s.negotiations.$inferSelect) {
  return {
    id: n.id,
    conversationId: n.conversationId,
    status: n.status,
    turn: n.turn,
    round: n.round,
    calls: n.calls,
    activeProposalId: n.activeProposalId,
    failure: n.failure,
    updatedAt: n.updatedAt,
  };
}

const decision = z.object({
  negotiationId: z.string().uuid(),
  proposalId: z.string().uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const sidequestRouter = createTRPCRouter({
  create: p
    .input(
      z.object({
        intent: z.string().min(1).max(2000),
        requestId: z.string().uuid(),
        constraints: constraintsSchema.default({}),
      }),
    )
    .mutation(({ ctx, input }) =>
      services().negotiation.create(ctx.session.user.id, input),
    ),
  list: p.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        sidequest: s.sidequests,
        negotiation: s.negotiations,
        proposal: s.proposals,
      })
      .from(s.sidequests)
      .leftJoin(
        s.agentConversations,
        eq(s.agentConversations.sidequestId, s.sidequests.id),
      )
      .leftJoin(
        s.negotiations,
        eq(s.negotiations.conversationId, s.agentConversations.id),
      )
      .leftJoin(
        s.proposals,
        eq(s.proposals.id, s.negotiations.activeProposalId),
      )
      .where(
        or(
          eq(s.sidequests.ownerId, ctx.session.user.id),
          sql`${s.agentConversations.participants} @> ${JSON.stringify([ctx.session.user.id])}::jsonb`,
        ),
      )
      .orderBy(desc(s.sidequests.createdAt))
      .limit(100);
    return rows.map((row) => ({
      ...row,
      negotiation: row.negotiation ? publicState(row.negotiation) : null,
    }));
  }),
  get: p.input(idInput).query(async ({ ctx, input }) => {
    const [quest] = await ctx.db
      .select()
      .from(s.sidequests)
      .where(eq(s.sidequests.id, input.id));
    if (!quest) throw new DomainError("NOT_FOUND", "SideQuest not found");
    if (quest.ownerId !== ctx.session.user.id) {
      const [conversation] = await ctx.db
        .select()
        .from(s.agentConversations)
        .where(eq(s.agentConversations.sidequestId, quest.id));
      if (!conversation?.participants.includes(ctx.session.user.id))
        throw new DomainError("NOT_FOUND", "SideQuest not found");
    }
    return quest;
  }),
  startNegotiation: p
    .input(
      z.object({
        sidequestId: z.string().uuid(),
        candidateIds: z
          .array(z.string().min(1).max(100))
          .min(1)
          .max(4)
          .optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      services()
        .negotiation.start(
          ctx.session.user.id,
          input.sidequestId,
          input.candidateIds,
        )
        .then(publicState),
    ),
  // Explicit resumable mutation. The UI starts it, then polls getNegotiation/getMessages.
  resumeNegotiation: p
    .input(idInput)
    .mutation(({ ctx, input }) =>
      services()
        .negotiation.run(ctx.session.user.id, input.id)
        .then(publicState),
    ),
  getNegotiation: p.input(idInput).query(async ({ ctx, input }) => {
    const { n, conversation } = await services().negotiation.authorized(
      ctx.session.user.id,
      input.id,
    );
    const participants = await ctx.db
      .select({ id: s.user.id, name: s.user.name })
      .from(s.user)
      .where(inArray(s.user.id, conversation.participants));
    const proposals = await ctx.db
      .select()
      .from(s.proposals)
      .where(eq(s.proposals.negotiationId, n.id))
      .orderBy(desc(s.proposals.version));
    const approvals = n.activeProposalId
      ? await ctx.db
          .select()
          .from(s.approvals)
          .where(eq(s.approvals.proposalId, n.activeProposalId))
      : [];
    const events = await ctx.db
      .select()
      .from(s.negotiationEvents)
      .where(eq(s.negotiationEvents.negotiationId, n.id))
      .orderBy(desc(s.negotiationEvents.createdAt))
      .limit(100);
    // Private per-user constraints and pending model actions are deliberately excluded.
    return {
      id: n.id,
      status: n.status,
      turn: n.turn,
      round: n.round,
      calls: n.calls,
      reservedTokens: n.tokens,
      failure: n.failure,
      activeProposalId: n.activeProposalId,
      participants: conversation.participants,
      participantNames: participants,
      proposals,
      approvals,
      events: events.filter(
        (e) =>
          (e.type !== "REVISION_REQUESTED" ||
            e.detail.userId === ctx.session.user.id) &&
          (e.type !== "HUMAN_INPUT_REQUESTED" ||
            e.detail.actor === ctx.session.user.id),
      ),
    };
  }),
  getMessages: p
    .input(
      z.object({
        id: z.string().uuid(),
        afterTurn: z.number().int().min(-1).default(-1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { conversation } = await services().negotiation.authorized(
        ctx.session.user.id,
        input.id,
      );
      return ctx.db
        .select()
        .from(s.agentMessages)
        .where(
          and(
            eq(s.agentMessages.conversationId, conversation.id),
            gt(s.agentMessages.turn, input.afterTurn),
          ),
        )
        .orderBy(s.agentMessages.turn)
        .limit(100);
    }),
  approveProposal: p.input(decision).mutation(({ ctx, input }) =>
    services()
      .negotiation.approve(ctx.session.user.id, { ...input, approved: true })
      .then(publicState),
  ),
  rejectProposal: p.input(decision).mutation(({ ctx, input }) =>
    services()
      .negotiation.approve(ctx.session.user.id, { ...input, approved: false })
      .then(publicState),
  ),
  requestRevision: p
    .input(
      z.object({
        negotiationId: z.string().uuid(),
        instruction: z.string().min(1).max(1000),
        constraints: constraintsSchema,
        requestId: z.string().uuid(),
      }),
    )
    .mutation(({ ctx, input }) =>
      services()
        .negotiation.revise(ctx.session.user.id, input)
        .then(publicState),
    ),
});

export const activityRouter = createTRPCRouter({
  list: p.query(({ ctx }) =>
    ctx.db
      .select()
      .from(s.activities)
      .where(gte(s.activities.end, new Date()))
      .orderBy(s.activities.start)
      .limit(100),
  ),
});
export const peopleRouter = createTRPCRouter({
  list: p.query(async ({ ctx }) => {
    const [own] = await ctx.db
      .select()
      .from(s.profiles)
      .where(eq(s.profiles.userId, ctx.session.user.id));
    if (!own?.discoverable || !own.sharing) return [];
    const candidates = await ctx.db
      .select({
        id: s.user.id,
        name: s.user.name,
        blocked: s.profiles.blockedUsers,
        constraints: s.profiles.constraints,
      })
      .from(s.profiles)
      .innerJoin(s.user, eq(s.user.id, s.profiles.userId))
      .where(
        and(
          eq(s.profiles.discoverable, true),
          eq(s.profiles.sharing, true),
          discoveryScope(own),
          ne(s.profiles.userId, own.userId),
        ),
      )
      .limit(100);
    const service = services().negotiation;
    const visible: { id: string; name: string }[] = [];
    for (const candidate of candidates) {
      try {
        checkContacts(
          await service.participants([own.userId, candidate.id], {}),
        );
        visible.push({ id: candidate.id, name: candidate.name });
      } catch {
        /* Bilateral exclusions also cover learned hard boundaries. */
      }
    }
    return visible;
  }),
});
