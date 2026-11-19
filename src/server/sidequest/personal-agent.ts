import { z } from "zod";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { and, eq, desc, notExists } from "drizzle-orm";
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
  participants: string[];
  incomingFrom?: string;
  proposal: unknown;
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
      const { userId, conversationId, intent } = s.input;
      const relevant = await memory.retrieve(userId, { query: intent });
      // Include a few recent preferences for vague requests with no matching search tokens.
      const recent = await memory.retrieve(userId, { limit: 6 });
      const transcript = await new Mailbox(
        db,
        conversationId,
        s.input.participants,
      ).context(userId);
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
        .where(eq(agentEpisodes.userId, userId))
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
      const [firstActivityId, ...otherActivityIds] = options.map(
        ({ plan }) => plan.activityId,
      );
      const [firstType, ...otherTypes] = actionSchema.shape.type.options.filter(
        (type) =>
          (type !== "ACCEPT" || Boolean(s.input.proposal)) &&
          ((type !== "PROPOSE" && type !== "COUNTER") ||
            Boolean(firstActivityId)),
      );
      const action = await model.generate(
        `You are the independent Scout of user ${s.input.userId}. Represent only this user, using their private context. Current retrieved memories, especially explicit user edits, supersede older conflicting conversation history. Other Scouts have different information. Decide your next action: ask a participant a question, suggest an alternative, counteroffer, accept/reject the exact current proposal, consult events, request human clarification or end. First learn constraints through messages when useful. Reply to addressed inquiries; negotiate soft preferences. Do not repeat questions that another Scout has already answered in the transcript. If the current valid proposal fits your user and no clarification is unresolved, accept it instead of asking again. All ISO plan times are UTC: label any clock times in your messages explicitly as UTC. Any proposal must use a supplied real catalog activity/feasible plan, with all participants. You may suggest compatible alternatives without the user naming them. Only use ACCEPT if the top-level proposal is non-null, and copy its exact hash into proposalHash. An idea or agreement in conversation is insufficient. If proposal is null and you agree on a feasible option, emit PROPOSE with the selected activity ID instead. Do not accept a proposal from past conversations. When there is no current proposal, use proposalHash: null. An agent-level ACCEPT never approves on behalf of a human. No other user is yours to control. For messages, choose recipientId from allowedRecipientIds. When the list has one recipient, routing is automatic. Use null for CONSULT_EVENTS, REQUEST_HUMAN, and END. PROPOSE and COUNTER require plan with only the activityId of one supplied option. The server uses the exact schedule and participants of the selected option. Describe that option as supplied. Never choose PROPOSE or COUNTER just to ask a question; use INQUIRY or REQUEST_INFO. If there are no feasible options, ask for human clarification or end instead. All other actions must use plan: null. Include only necessary, permitted information in content.`,
        actionSchema.extend({
          type: z.enum([firstType!, ...otherTypes]),
          plan: firstActivityId
            ? z
                .object({
                  activityId: z.enum([firstActivityId, ...otherActivityIds]),
                })
                .nullish()
            : z.null().optional(),
          recipientId: otherRecipients.length
            ? z.enum([onlyRecipient, ...otherRecipients]).nullish()
            : actionSchema.shape.recipientId.optional(),
        }),
        {
          ...s.input,
          allowedRecipientIds: recipients,
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
