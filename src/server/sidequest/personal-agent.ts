import { z } from "zod";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { and, eq, ne, desc, notExists } from "drizzle-orm";
import { agentEpisodes, scoutMessages, userMemories } from "../db/schema";
import { Mailbox } from "./mailbox";
import { type Database } from "./storage";
import { type MemoryService } from "./memory";
import { type Model } from "./model";
import { type EventAgent } from "./events";
import { actionSchema, type AgentAction } from "./types";
export type Turn = {
  userId: string;
  conversationId: string;
  intent: string;
  revisionTurn?: number;
  previousActivity?: string;
  revisionInstruction?: string;
  interestQuery?: string;
  participants: string[];
  incomingFrom?: string;
  proposal: { hash: string } | null;
  constraints: unknown;
  options: ReturnType<EventAgent["optionsFor"]>;
  eventAdvice: unknown;
};
export function createPersonalAgent(
  db: Database,
  model: Model,
  memory: MemoryService,
) {
  const State = Annotation.Root({
    input: Annotation<Turn>(),
    context: Annotation<unknown>(),
    action: Annotation<AgentAction>(),
  });
  return new StateGraph(State)
    .addNode("receive_message", (s) => ({ input: s.input }))
    .addNode("retrieve_memory", async (s) => {
      const {
        userId,
        conversationId,
        intent,
        revisionTurn,
        revisionInstruction,
        interestQuery,
      } = s.input;
      const relevant = await memory.retrieve(userId, {
        query: revisionInstruction ?? interestQuery ?? intent,
      });
      // Include a few recent preferences for vague requests with no matching search tokens.
      const recent = await memory.retrieve(userId, { limit: 6 });
      const transcript = await new Mailbox(
        db,
        conversationId,
        s.input.participants,
      ).context(userId, revisionTurn);
      const history = await db
        .select({
          role: scoutMessages.role,
          content: scoutMessages.content,
          at: scoutMessages.createdAt,
        })
        .from(scoutMessages)
        .where(
          and(
            eq(scoutMessages.userId, userId),
            notExists(
              db
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
        .limit(6);
      const episodes = await db
        .select({ kind: agentEpisodes.kind, summary: agentEpisodes.summary })
        .from(agentEpisodes)
        .where(
          and(
            eq(agentEpisodes.userId, userId),
            ne(agentEpisodes.kind, "REVISION_REQUESTED"),
          ),
        )
        .orderBy(desc(agentEpisodes.createdAt))
        .limit(3);
      return {
        context: {
          memories: [
            ...new Map(
              [...relevant, ...recent].map((m) => [
                m.id,
                {
                  id: m.id,
                  content: m.content,
                  confidence: m.confidence,
                  explicit: m.explicit,
                  updatedAt: m.updatedAt,
                },
              ]),
            ).values(),
          ].slice(0, 12),
          history: history
            .reverse()
            .map((m) => ({ ...m, content: m.content.slice(0, 600) })),
          transcript: transcript
            .reverse()
            .slice(-8)
            .map((m) => ({ ...m, content: m.content.slice(0, 800) })),
          episodes,
        },
      };
    })
    .addNode("reason_and_choose_action", async (s) => {
      const recipients = s.input.participants.filter(
        (id) => id !== s.input.userId,
      );
      const [onlyRecipient, ...otherRecipients] = recipients;
      if (!onlyRecipient)
        throw new Error("No other Scout belongs to this negotiation");
      const replyTo = recipients.find((id) => id === s.input.incomingFrom);
      const { options } = s.input;
      const availableActivityIds = options.map(({ plan }) => plan.activityId);
      const [firstType, ...otherTypes] = actionSchema.shape.type.options.filter(
        (type) =>
          (type !== "ACCEPT" || Boolean(s.input.proposal)) &&
          (type !== "PROPOSE" || !s.input.proposal) &&
          ((type !== "PROPOSE" && type !== "COUNTER") ||
            availableActivityIds.length > 0),
      );
      const action = await model.generate(
        `You are the independent Scout of user ${s.input.userId}. Represent only this user using their private context. Use the latest explicit preferences and corrections. Share only necessary planning details.

${s.input.proposal ? "Your task this turn is to vote on the active proposal. Accept it if it fits your user's needs. A COUNTER is a different plan, so never select the active activity as a counter." : "Your task this turn is to help the group find a new plan."}

A revision keeps the same participants. If revisionInstruction is supplied, it is your user's latest change to this plan. Follow it ahead of older requests. Keep previousActivity if the user only asked about scheduling. If no supplied option fits the requested change, use REQUEST_HUMAN. When reviewing another Scout's revised proposal, evaluate the new activity against your own user's preferences and constraints. If it fits, ACCEPT. Counter only for a concrete unmet need or strong preference of your user, and choose an option that supports the activity change. A soft preference may be compromised.

Use PROPOSE when there is no active proposal and a supplied option fits. Use COUNTER to suggest a different supplied option. For either action, set plan.activityId to one of availableActivityIds. The server uses that option's exact time and participants. For all other actions use plan: null. Refer to the proposal card for exact times and capacity. Group size is the number of participants. Venue capacity is the maximum it can hold.

Use ACCEPT when the top-level proposal fits your user. The server records votes against the version shown to you. Agent acceptance never approves for a human. Ask other Scouts about their own users if you need missing information. Do not repeat a question already answered. Use REQUEST_HUMAN for a decision only your own human can make. Use null for recipientId on CONSULT_EVENTS, REQUEST_HUMAN, and END. For other actions choose an allowedRecipientIds entry. One-to-one routing is automatic.`,
        actionSchema.extend({
          type: z.enum([firstType!, ...otherTypes]),
          plan: z.object({ activityId: z.string() }).nullish(),
          proposalHash: actionSchema.shape.proposalHash.optional(),
          recipientId: otherRecipients.length
            ? z.enum([onlyRecipient, ...otherRecipients]).nullish()
            : actionSchema.shape.recipientId.optional(),
        }),
        {
          ...s.input,
          allowedRecipientIds: recipients,
          availableActivityIds,
          privateContext: s.context,
        },
      );
      const internal =
        action.type === "CONSULT_EVENTS" ||
        action.type === "REQUEST_HUMAN" ||
        action.type === "END";
      const proposesPlan =
        action.type === "PROPOSE" || action.type === "COUNTER";
      const plan = proposesPlan
        ? options.find(
            (option) => option.plan.activityId === action.plan?.activityId,
          )?.plan
        : null;
      if (proposesPlan && !plan)
        throw new Error("Scout must select a feasible activity");
      return {
        action: {
          ...action,
          plan: plan ?? null,
          proposalHash:
            action.type === "ACCEPT" || action.type === "REJECT"
              ? (s.input.proposal?.hash ?? null)
              : (action.proposalHash ?? null),
          recipientId: internal
            ? null
            : otherRecipients.length
              ? (action.recipientId ?? replyTo ?? onlyRecipient)
              : onlyRecipient,
        },
      };
    })
    .addNode("persist_state", (s) => ({ action: actionSchema.parse(s.action) }))
    .addEdge(START, "receive_message")
    .addEdge("receive_message", "retrieve_memory")
    .addEdge("retrieve_memory", "reason_and_choose_action")
    .addEdge("reason_and_choose_action", "persist_state")
    .addEdge("persist_state", END)
    .compile();
}
