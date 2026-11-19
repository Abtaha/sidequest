import { Mailbox } from "./mailbox";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, desc, asc, gt, gte, isNull, or } from "drizzle-orm";
import {
  Annotation,
  StateGraph,
  START,
  END,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import * as s from "../db/schema";
import { type Database, type Store, lock } from "./storage";
import {
  DomainError,
  actionSchema,
  relativeTimeChange,
  type Constraints,
} from "./types";
import { type Model, log, modelLimits } from "./model";
import { type MemoryService } from "./memory";
import { createPersonalAgent } from "./personal-agent";
import {
  checkContacts,
  validatePlan,
  proposalHash,
  parseMemoryConstraint,
  type Participant,
} from "./constraints";
import { EventAgent } from "./events";
import { rankCandidatesByInterest } from "./discovery";
export const defaultLimits = {
  messages: 20,
  rounds: 3,
  calls: 40,
  tokens: 1_280_000,
  reservedTokensPerCall: modelLimits.reservedTokensPerCall,
};
export type Limits = typeof defaultLimits;
const running = ["DISCOVERING", "NEGOTIATING"];
export class NegotiationService {
  private personal;
  constructor(
    private db: Database,
    private model: Model,
    private memory: MemoryService,
    private limits: Limits = defaultLimits,
    private checkpointer?: BaseCheckpointSaver,
  ) {
    this.personal = createPersonalAgent(db, model, memory);
  }
  async load(id: string, store: Store = this.db) {
    const [n] = await store
      .select()
      .from(s.negotiations)
      .where(eq(s.negotiations.id, id));
    if (!n) throw new DomainError("NOT_FOUND", "Negotiation not found");
    const [conversation] = await store
      .select()
      .from(s.agentConversations)
      .where(eq(s.agentConversations.id, n.conversationId));
    const [quest] = await store
      .select()
      .from(s.sidequests)
      .where(eq(s.sidequests.id, conversation!.sidequestId));
    return { n, conversation: conversation!, quest: quest! };
  }
  async authorized(userId: string, id: string, store: Store = this.db) {
    const aggregate = await this.load(id, store);
    if (!aggregate.conversation.participants.includes(userId))
      throw new DomainError("NOT_FOUND", "Negotiation not found");
    return aggregate;
  }
  async participants(
    ids: string[],
    overrides: Record<string, Constraints>,
    store: Store = this.db,
  ): Promise<Participant[]> {
    const profiles = await store
      .select()
      .from(s.profiles)
      .where(inArray(s.profiles.userId, ids));
    if (profiles.length !== ids.length)
      throw new DomainError(
        "PRECONDITION_FAILED",
        "All participants need profiles",
      );
    const windows = await store
      .select()
      .from(s.availability)
      .where(inArray(s.availability.userId, ids));
    const hard = await store
      .select()
      .from(s.userMemories)
      .where(
        and(
          inArray(s.userMemories.userId, ids),
          inArray(s.userMemories.category, ["CONSTRAINT", "AVAILABILITY"]),
          inArray(s.userMemories.scope, ["PERSISTENT", "TEMPORARY"]),
          eq(s.userMemories.explicit, true),
          gte(s.userMemories.confidence, 80),
          eq(s.userMemories.status, "ACTIVE"),
          or(
            isNull(s.userMemories.expiresAt),
            gt(s.userMemories.expiresAt, new Date()),
          ),
        ),
      );
    return ids.map((userId) => ({
      ...profiles.find((p) => p.userId === userId)!,
      userId,
      session: overrides[userId] ?? {},
      windows: windows
        .filter((w) => w.userId === userId)
        .map((w) => ({
          start: w.start.toISOString(),
          end: w.end.toISOString(),
        })),
      unresolvedConstraints: hard.some(
        (m) => m.userId === userId && !parseMemoryConstraint(m.value),
      ),
      memoryConstraints: hard
        .filter((m) => m.userId === userId)
        .flatMap((m) => {
          const c = parseMemoryConstraint(m.value);
          return c ? [c] : [];
        }),
    }));
  }
  async create(
    userId: string,
    input: { requestId: string; intent: string; constraints: Constraints },
  ) {
    const [quest] = await this.db
      .insert(s.sidequests)
      .values({ ownerId: userId, ...input })
      .onConflictDoNothing()
      .returning();
    if (quest) return quest;
    const [prior] = await this.db
      .select()
      .from(s.sidequests)
      .where(
        and(
          eq(s.sidequests.ownerId, userId),
          eq(s.sidequests.requestId, input.requestId),
        ),
      );
    if (
      prior?.intent !== input.intent ||
      JSON.stringify(prior.constraints) !== JSON.stringify(input.constraints)
    )
      throw new DomainError(
        "CONFLICT",
        "Request ID reused with different input",
      );
    return prior;
  }
  async start(userId: string, questId: string, candidateIds?: string[]) {
    return this.db.transaction(async (tx) => {
      await lock(tx, `quest:${questId}`);
      const [quest] = await tx
        .select()
        .from(s.sidequests)
        .where(
          and(eq(s.sidequests.id, questId), eq(s.sidequests.ownerId, userId)),
        );
      if (!quest) throw new DomainError("NOT_FOUND", "SideQuest not found");
      const [existing] = await tx
        .select()
        .from(s.agentConversations)
        .where(eq(s.agentConversations.sidequestId, questId));
      if (existing)
        return (
          await tx
            .select()
            .from(s.negotiations)
            .where(eq(s.negotiations.conversationId, existing.id))
        )[0]!;
      let ids = candidateIds ? [userId, ...candidateIds] : [userId];
      if (!candidateIds) {
        const [own] = await tx
          .select()
          .from(s.profiles)
          .where(eq(s.profiles.userId, userId));
        if (!own)
          throw new DomainError(
            "PRECONDITION_FAILED",
            "Create your profile first",
          );
        const candidates = await tx
          .select()
          .from(s.profiles)
          .where(
            and(
              eq(s.profiles.circle, own.circle),
              eq(s.profiles.discoverable, true),
              eq(s.profiles.sharing, true),
            ),
          )
          .orderBy(asc(s.profiles.userId))
          .limit(100);
        const members = await this.participants(
          [
            ...new Set([
              userId,
              ...candidates.map((candidate) => candidate.userId),
            ]),
          ],
          {},
          tx,
        );
        const owner = members.find((member) => member.userId === userId)!;
        const permitted = members.filter((candidate) => {
          if (candidate.userId === userId) return false;
          try {
            checkContacts([owner, candidate], quest.constraints.excludedUsers);
            return true;
          } catch (error) {
            if (error instanceof DomainError) return false;
            throw error;
          }
        });
        const interests = await tx
          .select({
            userId: s.userMemories.userId,
            content: s.userMemories.content,
          })
          .from(s.userMemories)
          .where(
            and(
              inArray(s.userMemories.userId, [
                userId,
                ...permitted.map((candidate) => candidate.userId),
              ]),
              inArray(s.userMemories.category, ["INTEREST", "PREFERENCE"]),
              inArray(s.userMemories.scope, ["PERSISTENT", "TEMPORARY"]),
              eq(s.userMemories.status, "ACTIVE"),
              or(
                isNull(s.userMemories.expiresAt),
                gt(s.userMemories.expiresAt, new Date()),
              ),
            ),
          );
        const ranked = rankCandidatesByInterest(
          userId,
          quest.intent,
          permitted,
          interests,
        );
        const relevant = ranked.filter((candidate) => candidate.score > 0);
        const maxGroup = Math.min(
          5,
          quest.constraints.maxGroup ?? 5,
          own.constraints.maxGroup ?? 5,
        );
        const minGroup = Math.max(
          2,
          quest.constraints.minGroup ?? 2,
          own.constraints.minGroup ?? 2,
        );
        const eventAgent = new EventAgent(tx, this.model);
        const catalog = await eventAgent.catalog(quest.constraints);
        for (const pool of relevant.length ? [relevant, ranked] : [ranked]) {
          const group = [owner];
          for (const { candidate } of pool) {
            if (group.length >= maxGroup) break;
            const trial = [...group, candidate];
            try {
              checkContacts(trial, quest.constraints.excludedUsers);
            } catch (error) {
              if (error instanceof DomainError) continue;
              throw error;
            }
            // Before the required group size is reached, test schedule and other
            // constraints while leaving minimum group size for final validation.
            const partial = trial.map((member) => ({
              ...member,
              constraints: { ...member.constraints, minGroup: undefined },
              session: { ...member.session, minGroup: undefined },
              memoryConstraints: member.memoryConstraints?.map(
                (constraint) => ({
                  ...constraint,
                  minGroup: undefined,
                }),
              ),
            }));
            const options = eventAgent.optionsFor(catalog, partial, {
              ...quest.constraints,
              minGroup: undefined,
            });
            if (!options.length) continue;
            group.push(candidate);
            if (
              group.length >= minGroup &&
              eventAgent.optionsFor(catalog, group, quest.constraints).length
            ) {
              ids = group.map((member) => member.userId);
            }
          }
          if (ids.length > 1) break;
        }
        if (ids.length === 1) {
          throw new DomainError(
            "PRECONDITION_FAILED",
            "No one in your planning circle has a compatible upcoming activity. Try a different time or ask a specific person from People.",
          );
        }
      }
      ids = [...new Set(ids)];
      checkContacts(
        await this.participants(ids, {}, tx),
        quest.constraints.excludedUsers,
      );
      const [conversation] = await tx
        .insert(s.agentConversations)
        .values({ sidequestId: questId, participants: ids })
        .returning();
      const [n] = await tx
        .insert(s.negotiations)
        .values({ conversationId: conversation!.id })
        .returning();
      await tx.insert(s.negotiationEvents).values({
        negotiationId: n!.id,
        type: "STARTED",
        detail: { participants: ids, flexibleGroup: !candidateIds },
      });
      return n!;
    });
  }
  private async event(
    store: Store,
    id: string,
    type: string,
    detail: Record<string, unknown> = {},
  ) {
    await store
      .insert(s.negotiationEvents)
      .values({ negotiationId: id, type, detail });
    log("negotiation_event", {
      negotiationId: id,
      type,
      turn: detail.turn,
      version: detail.version,
      status: detail.status,
      action: detail.action,
      reason: detail.reason,
    });
  }
  private fail(id: string, turn: number, reason: string) {
    return this.db.transaction(async (tx) => {
      await lock(tx, `negotiation:${id}`);
      const { n } = await this.load(id, tx);
      if (!running.includes(n.status)) return false;
      if (n.turn !== turn) return true;
      await tx
        .update(s.negotiations)
        .set({
          status: "FAILED",
          failure: reason,
          pendingAction: null,
          updatedAt: new Date(),
        })
        .where(eq(s.negotiations.id, id));
      await this.event(tx, id, "FAILED", { reason });
      return false;
    });
  }
  async tick(id: string) {
    const { n, conversation, quest } = await this.load(id);
    if (!running.includes(n.status)) return false;
    const members = await this.participants(
      conversation.participants,
      n.constraints,
    );
    try {
      checkContacts(members, quest.constraints.excludedUsers);
    } catch {
      return this.fail(id, n.turn, "CONTACT_PERMISSION_CHANGED");
    }
    let pending = n.pendingAction;
    if (!pending) {
      const messages = await new Mailbox(
        this.db,
        conversation.id,
        conversation.participants,
      ).transcript();
      const [revision] = await this.db
        .select()
        .from(s.negotiationEvents)
        .where(
          and(
            eq(s.negotiationEvents.negotiationId, id),
            eq(s.negotiationEvents.type, "REVISION_REQUESTED"),
          ),
        )
        .orderBy(desc(s.negotiationEvents.createdAt))
        .limit(1);
      const revisionTurn =
        typeof revision?.detail.startTurn === "number"
          ? revision.detail.startTurn
          : undefined;
      const revisionOwner = revision?.detail.userId;
      const revisionInstruction =
        typeof revision?.detail.instruction === "string"
          ? revision.detail.instruction
          : undefined;
      const proposals = n.round
        ? await this.db
            .select()
            .from(s.proposals)
            .where(eq(s.proposals.negotiationId, id))
            .orderBy(desc(s.proposals.version))
        : [];
      const proposal = proposals.find((p) => p.id === n.activeProposalId);
      const priorProposal = revision
        ? proposals.find(
            (p) => p.createdAt <= revision.createdAt && p.id !== proposal?.id,
          )
        : undefined;
      const move =
        priorProposal && revisionInstruction
          ? relativeTimeChange(revisionInstruction)
          : undefined;
      const decisions = proposal
        ? await this.db
            .select()
            .from(s.proposalParticipants)
            .where(eq(s.proposalParticipants.proposalId, proposal.id))
        : [];
      // An acceptance is a vote, so its delivery should not pull a Scout
      // who already accepted back into a loop while other Scouts await a turn.
      const incoming = messages.find(
        (message) =>
          message.status === "PENDING" &&
          !(
            message.type === "ACCEPT" &&
            (message.proposalHash !== proposal?.hash ||
              decisions.some(
                (decision) =>
                  decision.userId === message.recipientId &&
                  decision.agentAccepted,
              ))
          ),
      );
      const actor =
        (n.turn === revisionTurn &&
        typeof revisionOwner === "string" &&
        conversation.participants.includes(revisionOwner)
          ? revisionOwner
          : incoming?.recipientId) ??
        decisions.find((decision) => !decision.agentAccepted)?.userId ??
        conversation.participants[n.turn % conversation.participants.length]!;
      const allowed = await this.db.transaction(async (tx) => {
        await lock(tx, `negotiation:${id}`);
        const { n: current } = await this.load(id, tx);
        if (
          current.turn !== n.turn ||
          current.pendingAction ||
          !running.includes(current.status)
        )
          return false;
        if (
          current.calls + 1 > this.limits.calls ||
          current.tokens + this.limits.reservedTokensPerCall >
            this.limits.tokens ||
          messages.length >= this.limits.messages
        )
          return false;
        await tx
          .update(s.negotiations)
          .set({
            calls: current.calls + 1,
            tokens: current.tokens + this.limits.reservedTokensPerCall,
            status: "NEGOTIATING",
            updatedAt: new Date(),
          })
          .where(eq(s.negotiations.id, id));
        return true;
      });
      if (!allowed) {
        const fresh = await this.load(id);
        if (fresh.n.turn === n.turn && !fresh.n.pendingAction)
          return this.fail(id, n.turn, "RESOURCE_BUDGET_EXHAUSTED");
        return running.includes(fresh.n.status);
      }
      try {
        const proposedHashes = new Set(proposals.map((p) => p.hash));
        const options = (
          await new EventAgent(this.db, this.model).options(
            members,
            quest.constraints,
            Boolean(proposal ?? move),
            move ? priorProposal?.plan.activityId : undefined,
          )
        ).filter(({ plan }) => {
          if (proposedHashes.has(proposalHash(plan))) return false;
          if (!move || !priorProposal) return true;
          return (
            plan.activityId === priorProposal.plan.activityId &&
            (move === "later"
              ? plan.start > priorProposal.plan.start
              : plan.start < priorProposal.plan.start)
          );
        });
        const [advice] = await this.db
          .select()
          .from(s.negotiationEvents)
          .where(
            and(
              eq(s.negotiationEvents.negotiationId, id),
              eq(s.negotiationEvents.type, "EVENT_OPTIONS"),
              revision
                ? gte(s.negotiationEvents.createdAt, revision.createdAt)
                : undefined,
            ),
          )
          .orderBy(desc(s.negotiationEvents.createdAt))
          .limit(1);
        const started = Date.now();
        const result =
          move && !options.length && !proposal
            ? {
                action: {
                  type: "REQUEST_HUMAN",
                  recipientId: null,
                  plan: null,
                  proposalHash: null,
                  content: `I couldn’t find an ${move === "later" ? "available later" : "available earlier"} time for everyone. Would a different day or activity work?`,
                },
              }
            : await this.personal.invoke({
                input: {
                  userId: actor,
                  conversationId: conversation.id,
                  intent: revision
                    ? "Renegotiate the existing plan with the same group."
                    : quest.intent,
                  revisionTurn,
                  previousActivity: priorProposal?.activitySnapshot.title,
                  previousStart: priorProposal?.plan.start,
                  revisionInstruction:
                    actor === revisionOwner ? revisionInstruction : undefined,
                  interestQuery: proposal?.activitySnapshot.title,
                  participants: conversation.participants,
                  incomingFrom: incoming?.senderId,
                  incomingMessageId: incoming?.id,
                  proposal: proposal ?? null,
                  constraints: members.find((p) => p.userId === actor),
                  options,
                  eventAdvice: advice?.detail ?? null,
                },
              });
        log("agent_invocation", {
          negotiationId: id,
          agentId: actor,
          latencyMs: Date.now() - started,
          turn: n.turn,
        });
        pending = {
          actor,
          action: actionSchema.parse(result.action),
          turn: n.turn,
          incomingMessageId: incoming?.id,
        };
        await this.db.transaction(async (tx) => {
          await lock(tx, `negotiation:${id}`);
          const { n: current } = await this.load(id, tx);
          if (
            current.turn === n.turn &&
            !current.pendingAction &&
            running.includes(current.status)
          )
            await tx
              .update(s.negotiations)
              .set({ pendingAction: pending, updatedAt: new Date() })
              .where(eq(s.negotiations.id, id));
        });
      } catch {
        return this.fail(id, n.turn, "MODEL_OR_CONTEXT_FAILURE");
      }
    }
    try {
      // External event consultation can be retried; only its committed event affects state.
      let advice: unknown = undefined;
      if (pending.action.type === "CONSULT_EVENTS") {
        const reserved = await this.db.transaction(async (tx) => {
          await lock(tx, `negotiation:${id}`);
          const { n: current } = await this.load(id, tx);
          if (
            current.turn !== pending.turn ||
            current.calls >= this.limits.calls ||
            current.tokens + this.limits.reservedTokensPerCall >
              this.limits.tokens
          )
            return false;
          await tx
            .update(s.negotiations)
            .set({
              calls: current.calls + 1,
              tokens: current.tokens + this.limits.reservedTokensPerCall,
            })
            .where(eq(s.negotiations.id, id));
          return true;
        });
        if (!reserved) {
          return this.fail(id, pending.turn, "RESOURCE_BUDGET_EXHAUSTED");
        }
        advice = await new EventAgent(this.db, this.model).consult(
          members,
          quest.constraints,
          pending.action.content,
        );
      }
      await this.execute(id, pending, advice);
    } catch (error) {
      const reason =
        error instanceof DomainError
          ? `INVALID_ACTION:${error.message}`
          : "ACTION_OR_DATABASE_FAILURE";
      return this.fail(id, pending.turn, reason);
    }
    return running.includes((await this.load(id)).n.status);
  }
  async execute(
    id: string,
    pending: NonNullable<typeof s.negotiations.$inferSelect.pendingAction>,
    advice?: unknown,
  ) {
    await this.db.transaction(async (tx) => {
      await lock(tx, `negotiation:${id}`);
      const { n, conversation, quest } = await this.load(id, tx);
      if (n.turn !== pending.turn || !running.includes(n.status)) return; // Already committed, safe replay.
      const { actor, action: raw } = pending;
      const action = actionSchema.parse(raw);
      for (const userId of [...conversation.participants].sort()) {
        await lock(tx, `profile:${userId}`);
        await lock(tx, `memory:${userId}`);
      }
      const members = await this.participants(
        conversation.participants,
        n.constraints,
        tx,
      );
      checkContacts(members, quest.constraints.excludedUsers);
      if (!conversation.participants.includes(actor))
        throw new DomainError("FORBIDDEN", "Unauthorized sender");
      const internal = [
        "CONSULT_EVENTS",
        "REQUEST_HUMAN",
        "END",
        "WITHDRAW",
      ].includes(action.type);
      if (
        !internal &&
        (!action.recipientId ||
          action.recipientId === actor ||
          !conversation.participants.includes(action.recipientId))
      )
        throw new DomainError("FORBIDDEN", "Unauthorized recipient");
      const transcript = await tx
        .select()
        .from(s.agentMessages)
        .where(eq(s.agentMessages.conversationId, conversation.id));
      if (transcript.length >= this.limits.messages)
        throw new DomainError("PRECONDITION_FAILED", "Message limit reached");
      if (
        transcript.some(
          (m) =>
            m.senderId === actor &&
            m.type === action.type &&
            m.content === action.content &&
            m.proposalHash === action.proposalHash,
        )
      )
        throw new DomainError(
          "PRECONDITION_FAILED",
          "Repeated identical message",
        );
      let activeId = n.activeProposalId;
      let hash = action.proposalHash;
      let status: typeof n.status = "NEGOTIATING";
      let round = n.round;
      if (action.type === "PROPOSE" || action.type === "COUNTER") {
        if (!action.plan)
          throw new DomainError(
            "BAD_REQUEST",
            "Proposal requires a typed plan",
          );
        const [activity] = await tx
          .select()
          .from(s.activities)
          .where(eq(s.activities.id, action.plan.activityId));
        if (!activity)
          throw new DomainError("BAD_REQUEST", "Unknown catalog activity");
        validatePlan(action.plan, activity, members, quest.constraints);
        hash = proposalHash(action.plan);
        const previous = await tx
          .select()
          .from(s.proposals)
          .where(eq(s.proposals.negotiationId, id));
        if (previous.some((p) => p.hash === hash))
          throw new DomainError(
            "PRECONDITION_FAILED",
            "Repeated identical proposal",
          );
        round++;
        if (round > this.limits.rounds)
          throw new DomainError(
            "PRECONDITION_FAILED",
            "Proposal revision limit reached",
          );
        const [proposal] = await tx
          .insert(s.proposals)
          .values({
            negotiationId: id,
            version: round,
            hash,
            plan: action.plan,
            activitySnapshot: {
              title: activity.title,
              location: activity.location,
              cost: activity.cost,
              capacity: activity.capacity,
              tags: activity.tags,
              start: activity.start.toISOString(),
              end: activity.end.toISOString(),
            },
          })
          .returning();
        activeId = proposal!.id;
        await tx.insert(s.proposalParticipants).values(
          conversation.participants.map((userId) => ({
            proposalId: activeId!,
            userId,
          })),
        );
        await this.event(tx, id, "PROPOSAL_CREATED", {
          proposalId: activeId,
          version: round,
          hash,
        });
      } else if (action.type === "ACCEPT") {
        const [proposal] = activeId
          ? await tx
              .select()
              .from(s.proposals)
              .where(eq(s.proposals.id, activeId))
          : [];
        if (hash !== proposal?.hash)
          throw new DomainError(
            "CONFLICT",
            "Acceptance refers to stale proposal",
          );
        const [activity] = await tx
          .select()
          .from(s.activities)
          .where(eq(s.activities.id, proposal.plan.activityId));
        if (!activity)
          throw new DomainError("BAD_REQUEST", "Activity no longer available");
        validatePlan(proposal.plan, activity, members, quest.constraints);
        await tx
          .update(s.proposalParticipants)
          .set({ agentAccepted: true })
          .where(
            and(
              eq(s.proposalParticipants.proposalId, proposal.id),
              eq(s.proposalParticipants.userId, actor),
            ),
          );
        const decisions = await tx
          .select()
          .from(s.proposalParticipants)
          .where(eq(s.proposalParticipants.proposalId, proposal.id));
        if (
          decisions.every((d) => d.agentAccepted) &&
          decisions.length === conversation.participants.length
        )
          status = "AWAITING_APPROVAL";
      } else if (action.type === "REJECT" && activeId) {
        const [proposal] = await tx
          .select()
          .from(s.proposals)
          .where(eq(s.proposals.id, activeId));
        if (hash !== proposal?.hash)
          throw new DomainError(
            "CONFLICT",
            "Rejection refers to stale proposal",
          );
        await tx
          .update(s.proposalParticipants)
          .set({ agentAccepted: false })
          .where(
            and(
              eq(s.proposalParticipants.proposalId, activeId),
              eq(s.proposalParticipants.userId, actor),
            ),
          );
      } else if (action.type === "REQUEST_HUMAN")
        status = "AWAITING_USER_INPUT";
      else if (action.type === "WITHDRAW") {
        const remaining = members.filter((member) => member.userId !== actor);
        const [started] = await tx
          .select()
          .from(s.negotiationEvents)
          .where(
            and(
              eq(s.negotiationEvents.negotiationId, id),
              eq(s.negotiationEvents.type, "STARTED"),
            ),
          );
        const [revision] = await tx
          .select({ id: s.negotiationEvents.id })
          .from(s.negotiationEvents)
          .where(
            and(
              eq(s.negotiationEvents.negotiationId, id),
              eq(s.negotiationEvents.type, "REVISION_REQUESTED"),
            ),
          )
          .limit(1);
        if (
          started?.detail.flexibleGroup === true &&
          !revision &&
          actor !== quest.ownerId &&
          remaining.length >= 2 &&
          n.round < this.limits.rounds &&
          (
            await new EventAgent(tx, this.model).options(
              remaining,
              quest.constraints,
            )
          ).length
        ) {
          const participants = remaining.map((member) => member.userId);
          await tx
            .update(s.agentConversations)
            .set({ participants })
            .where(eq(s.agentConversations.id, conversation.id));
          await tx
            .update(s.agentMessages)
            .set({ status: "PROCESSED" })
            .where(eq(s.agentMessages.conversationId, conversation.id));
          await this.event(tx, id, "GROUP_UPDATED", {
            turn: n.turn,
            participants,
            departed: actor,
          });
          activeId = null;
        } else status = "FAILED";
      } else if (action.type === "END") status = "FAILED";
      if (action.type === "CONSULT_EVENTS")
        await this.event(tx, id, "EVENT_OPTIONS", { result: advice });
      else if (!internal) {
        const messageType =
          action.type as typeof s.agentMessages.$inferInsert.type;
        await new Mailbox(tx, conversation.id, conversation.participants).emit({
          senderId: actor,
          recipientId: action.recipientId!,
          type: messageType,
          content: action.content,
          proposalId: activeId,
          proposalHash: hash,
          turn: n.turn,
        });
      }
      if (pending.incomingMessageId)
        await new Mailbox(
          tx,
          conversation.id,
          conversation.participants,
        ).markProcessed(actor, pending.incomingMessageId);
      await tx
        .update(s.negotiations)
        .set({
          activeProposalId: activeId,
          turn: n.turn + 1,
          round,
          status,
          pendingAction: null,
          failure:
            status === "FAILED"
              ? action.type === "WITHDRAW"
                ? "GROUP_NEEDS_ANOTHER_OPTION"
                : "AGENT_ENDED_NEGOTIATION"
              : null,
          updatedAt: new Date(),
        })
        .where(eq(s.negotiations.id, id));
      await this.event(
        tx,
        id,
        action.type === "REQUEST_HUMAN"
          ? "HUMAN_INPUT_REQUESTED"
          : "TURN_COMMITTED",
        {
          turn: n.turn,
          actor,
          action: action.type,
          status,
          ...(action.type === "REQUEST_HUMAN"
            ? { question: action.content }
            : {}),
        },
      );
    });
  }
  async run(userId: string, id: string) {
    await this.authorized(userId, id);
    const State = Annotation.Root({
      negotiationId: Annotation<string>(),
      keepGoing: Annotation<boolean>(),
    });
    const graph = new StateGraph(State)
      .addNode("route_personal_agent", async (state) => {
        await this.db
          .update(s.negotiations)
          .set({ leaseUntil: new Date(Date.now() + 180_000) })
          .where(eq(s.negotiations.id, state.negotiationId));
        return { keepGoing: await this.tick(state.negotiationId) };
      })
      .addEdge(START, "route_personal_agent")
      .addConditionalEdges("route_personal_agent", (state) =>
        state.keepGoing ? "route_personal_agent" : END,
      )
      .compile({ checkpointer: this.checkpointer });
    const lease = randomUUID();
    await this.db.transaction(async (tx) => {
      await lock(tx, `negotiation:${id}`);
      const { n } = await this.load(id, tx);
      if (n.leaseUntil && n.leaseUntil > new Date())
        throw new DomainError(
          "CONFLICT",
          "Negotiation is already running; poll its status",
        );
      await tx
        .update(s.negotiations)
        .set({ leaseOwner: lease, leaseUntil: new Date(Date.now() + 180_000) })
        .where(eq(s.negotiations.id, id));
    });
    try {
      // Checkpoints contain only domain IDs/control flags, never private memory or prompts.
      await graph.invoke(
        { negotiationId: id, keepGoing: true },
        {
          configurable: { thread_id: `negotiation:${id}` },
          recursionLimit: this.limits.calls + 10,
        },
      );
      return (await this.authorized(userId, id)).n;
    } finally {
      await this.db
        .update(s.negotiations)
        .set({ leaseOwner: null, leaseUntil: null })
        .where(
          and(eq(s.negotiations.id, id), eq(s.negotiations.leaseOwner, lease)),
        );
    }
  }

  async approve(
    userId: string,
    input: {
      negotiationId: string;
      proposalId: string;
      hash: string;
      approved: boolean;
    },
  ) {
    return this.db.transaction(async (tx) => {
      await lock(tx, `negotiation:${input.negotiationId}`);
      const { n, conversation, quest } = await this.authorized(
        userId,
        input.negotiationId,
        tx,
      );
      if (
        n.activeProposalId !== input.proposalId ||
        !["AWAITING_APPROVAL", "CONFIRMED"].includes(n.status)
      )
        throw new DomainError("CONFLICT", "Proposal is not awaiting approval");
      const [proposal] = await tx
        .select()
        .from(s.proposals)
        .where(eq(s.proposals.id, input.proposalId));
      if (input.hash !== proposal?.hash)
        throw new DomainError("CONFLICT", "Stale proposal hash");
      for (const userId of [...conversation.participants].sort()) {
        await lock(tx, `profile:${userId}`);
        await lock(tx, `memory:${userId}`);
      }
      const members = await this.participants(
        conversation.participants,
        n.constraints,
        tx,
      );
      const [activity] = await tx
        .select()
        .from(s.activities)
        .where(eq(s.activities.id, proposal.plan.activityId));
      if (!activity) throw new DomainError("CONFLICT", "Activity unavailable");
      validatePlan(proposal.plan, activity, members, quest.constraints);
      const [prior] = await tx
        .select()
        .from(s.approvals)
        .where(
          and(
            eq(s.approvals.proposalId, proposal.id),
            eq(s.approvals.userId, userId),
          ),
        );
      if (n.status === "CONFIRMED") {
        if (prior?.approved && input.approved) return n;
        throw new DomainError(
          "CONFLICT",
          "Confirmed plan must be revised before changing approval",
        );
      }
      await tx
        .insert(s.approvals)
        .values({
          proposalId: proposal.id,
          userId,
          hash: proposal.hash,
          approved: input.approved,
        })
        .onConflictDoUpdate({
          target: [s.approvals.proposalId, s.approvals.userId],
          set: {
            hash: proposal.hash,
            approved: input.approved,
            createdAt: new Date(),
          },
        });
      let status: typeof s.negotiations.$inferSelect.status = input.approved
        ? "AWAITING_APPROVAL"
        : "FAILED";
      const approvals = await tx
        .select()
        .from(s.approvals)
        .where(
          and(
            eq(s.approvals.proposalId, proposal.id),
            eq(s.approvals.hash, proposal.hash),
            eq(s.approvals.approved, true),
          ),
        );
      if (
        input.approved &&
        conversation.participants.every((u) =>
          approvals.some((a) => a.userId === u),
        )
      )
        status = "CONFIRMED";
      const [result] = await tx
        .update(s.negotiations)
        .set({
          status,
          failure: input.approved ? null : "HUMAN_REJECTED",
          updatedAt: new Date(),
        })
        .where(eq(s.negotiations.id, n.id))
        .returning();
      await this.event(
        tx,
        n.id,
        input.approved ? "HUMAN_APPROVED" : "HUMAN_REJECTED",
        { userId, proposalId: proposal.id, hash: proposal.hash, status },
      );
      if (status === "CONFIRMED")
        await tx.insert(s.agentEpisodes).values(
          conversation.participants.map((userId) => ({
            userId,
            kind: "PLAN_APPROVED",
            summary: `Approved catalog activity ${proposal.plan.activityId} for ${proposal.plan.start}; this records approval, not attendance.`,
          })),
        );
      return result!;
    });
  }
  async revise(
    userId: string,
    input: {
      negotiationId: string;
      constraints: Constraints;
      instruction: string;
      requestId: string;
    },
    store: Store = this.db,
  ) {
    return store.transaction(async (tx) => {
      await lock(tx, `negotiation:${input.negotiationId}`);
      const { n, conversation } = await this.authorized(
        userId,
        input.negotiationId,
        tx,
      );
      const events = await tx
        .select()
        .from(s.negotiationEvents)
        .where(
          and(
            eq(s.negotiationEvents.negotiationId, n.id),
            eq(s.negotiationEvents.type, "REVISION_REQUESTED"),
          ),
        );
      if (events.some((e) => e.detail.requestId === input.requestId)) return n;
      if (["CANCELLED"].includes(n.status))
        throw new DomainError("CONFLICT", "Cancelled negotiation");
      if (n.round >= this.limits.rounds)
        throw new DomainError(
          "PRECONDITION_FAILED",
          "Proposal revision limit reached",
        );
      if (n.activeProposalId) {
        await tx
          .delete(s.approvals)
          .where(eq(s.approvals.proposalId, n.activeProposalId));
        await tx
          .update(s.proposalParticipants)
          .set({ agentAccepted: false })
          .where(eq(s.proposalParticipants.proposalId, n.activeProposalId));
      }
      await tx
        .update(s.agentMessages)
        .set({ status: "PROCESSED" })
        .where(eq(s.agentMessages.conversationId, conversation.id));
      const [result] = await tx
        .update(s.negotiations)
        .set({
          status: "NEGOTIATING",
          turn: n.turn + 1,
          constraints: {
            ...n.constraints,
            [userId]: { ...n.constraints[userId], ...input.constraints },
          },
          activeProposalId: null,
          pendingAction: null,
          failure: null,
          updatedAt: new Date(),
        })
        .where(eq(s.negotiations.id, n.id))
        .returning();
      // A human instruction is data, auditable and delivered to their own Scout on its next turn.
      await this.event(tx, n.id, "REVISION_REQUESTED", {
        userId,
        instruction: input.instruction,
        constraints: input.constraints,
        requestId: input.requestId,
        startTurn: n.turn + 1,
      });
      return result!;
    });
  }
}
