import { z } from "zod";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { and, eq, ne, desc, notExists } from "drizzle-orm";
import {
  agentEpisodes,
  proposals,
  scoutMessages,
  userMemories,
} from "../db/schema";
import { Mailbox } from "./mailbox";
import { type Database } from "./storage";
import { type MemoryService } from "./memory";
import { type Model } from "./model";
import { type EventAgent } from "./events";
import { actionSchema, type AgentAction } from "./types";
import { planningCommitmentsForScout } from "./plan-context";
import { activityLabels } from "./activity-labels";
export class InvalidScoutOption extends Error {}
export class InvalidScoutRecipient extends Error {}
export type Turn = {
  userId: string;
  conversationId: string;
  intent: string;
  revisionTurn?: number;
  previousActivity?: string;
  previousStart?: string;
  revisionInstruction?: string;
  interestQuery?: string;
  participants: string[];
  incomingFrom?: string;
  incomingMessageId?: string;
  proposal: Pick<
    typeof proposals.$inferSelect,
    "hash" | "plan" | "activitySnapshot"
  > | null;
  constraints: unknown;
  options: ReturnType<EventAgent["optionsFor"]>;
  eventAdvice: unknown;
  retryOptionSelection?: boolean;
  retryRepeatedMessage?: boolean;
  retryRecipientSelection?: boolean;
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
      const [relevant, commitments] = await Promise.all([
        memory.retrieve(userId, {
          query: revisionInstruction ?? interestQuery ?? intent,
        }),
        planningCommitmentsForScout(db, userId, conversationId),
      ]);
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
          commitments,
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
      const slots = options.map((option, index) => ({
        ...option,
        activity: { ...option.activity, ...activityLabels(option.activity) },
        optionId: String(index + 1),
      }));
      const [firstType, ...otherTypes] = actionSchema.shape.type.options.filter(
        (type) =>
          (type !== "ACCEPT" || Boolean(s.input.proposal)) &&
          (type !== "PROPOSE" || !s.input.proposal) &&
          ((type !== "PROPOSE" && type !== "COUNTER") || slots.length > 0),
      );
      const current = s.input.proposal;
      const proposal = current
        ? {
            hash: current.hash,
            plan: current.plan,
            activitySnapshot: {
              ...activityLabels(current.activitySnapshot),
              cost: current.activitySnapshot.cost,
              capacity: current.activitySnapshot.capacity,
              tags: current.activitySnapshot.tags,
            },
          }
        : null;
      const action = await model.generate(
        `You are the independent Scout of user ${s.input.userId}. Represent only this user using their private context. Use the latest explicit preferences and corrections. Check commitments when choosing or voting on a slot. For an overlap with a confirmed plan, prefer a different time or ask your human if a conflict must be resolved. A tentative proposal may change. Share only availability or the need for a different time with other Scouts. Share only necessary planning details.

${s.input.proposal ? "Your task this turn is to vote on the active proposal. Accept it if it fits your user's needs. A COUNTER is a different plan, so never select the active time slot as a counter." : "Your task this turn is to help the group find a new plan."}

A revision keeps the same participants. If revisionInstruction is supplied, it is your user's latest change to this plan. Follow it ahead of older requests. Keep previousActivity if the user only asked about scheduling. If they ask for an earlier or later time, compare the candidate's start to previousStart. If no supplied option fits the requested change, use REQUEST_HUMAN. When reviewing another Scout's revised proposal, evaluate the new activity against your own user's preferences and constraints. If it fits, ACCEPT. Counter only for a concrete unmet need or strong preference of your user, and choose an option that supports the activity change. A soft preference may be compromised.

Use PROPOSE when there is no active proposal and a supplied option fits. Use COUNTER to suggest a different supplied option, including a different time for the same activity. For either action, return plan as {"optionId":"1"} with the exact listed optionId of the slot you chose. The server uses that option's exact time and participants. For all other actions use plan: null. Use plan.start and plan.end as the exact meeting times. An activity's catalog hours describe the larger window for booking and can differ from the meeting times. The server has already checked that the proposed slot fits the catalog hours and known availability. Group size is the number of participants. Venue capacity is the maximum it can hold.

${s.input.retryOptionSelection ? "Your previous activity reference did not match a supplied slot. Copy an optionId exactly from options. If none fits the request, use REQUEST_HUMAN and ask a short question." : ""}

${s.input.retryRepeatedMessage ? "Your last action repeated a message. Take a different action that advances the plan, such as suggesting a different feasible option or asking your human which constraint to relax. Do not rephrase the same message." : ""}

${s.input.retryRecipientSelection ? "Your last recipient was not an eligible Scout. Copy an ID exactly from allowedRecipientIds, or use REQUEST_HUMAN if you cannot address the message." : ""}

Use ACCEPT when the top-level proposal fits your user. The server records votes against the version shown to you. Agent acceptance never approves for a human. Ask other Scouts about their own users if you need missing information. If incomingMessageId is supplied, respond to that message. Do not repeat a question already answered. Use REQUEST_HUMAN for a decision only your own human can make. Use WITHDRAW if your user would pass on the outing after considering the options. Give a short response without revealing private reasons. An automatically assembled group may continue without your user. For directed messages, use an exact allowedRecipientIds entry. For votes, proposals, and internal actions, use null for recipientId and let the server handle routing. One-to-one routing is automatic.`,
        actionSchema.extend({
          type: z.enum([firstType!, ...otherTypes]),
          plan: z
            .object({
              activityId: z.string().optional(),
              optionId: z.coerce.string().optional(),
            })
            .nullish(),
          proposalHash: actionSchema.shape.proposalHash.optional(),
          recipientId: actionSchema.shape.recipientId.optional(),
        }),
        {
          ...s.input,
          proposal,
          allowedRecipientIds: recipients,
          options: slots,
          privateContext: s.context,
        },
      );
      const internal =
        action.type === "CONSULT_EVENTS" ||
        action.type === "REQUEST_HUMAN" ||
        action.type === "END" ||
        action.type === "WITHDRAW";
      const proposesPlan =
        action.type === "PROPOSE" || action.type === "COUNTER";
      const votes = action.type === "ACCEPT" || action.type === "REJECT";
      const recipient = recipients.find((id) => id === action.recipientId);
      if (
        otherRecipients.length &&
        !internal &&
        !proposesPlan &&
        !votes &&
        action.recipientId != null &&
        !recipient
      )
        throw new InvalidScoutRecipient("Scout recipient is outside the group");
      const plan = proposesPlan
        ? (
            slots.find((option) => option.optionId === action.plan?.optionId) ??
            slots.find(
              (option) => option.plan.activityId === action.plan?.activityId,
            )
          )?.plan
        : null;
      if (proposesPlan && !plan)
        throw new InvalidScoutOption("Scout must select a feasible activity");
      return {
        action: {
          ...action,
          plan: plan ?? null,
          proposalHash: votes
            ? (s.input.proposal?.hash ?? null)
            : (action.proposalHash ?? null),
          recipientId: internal
            ? null
            : (recipient ?? replyTo ?? onlyRecipient),
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
