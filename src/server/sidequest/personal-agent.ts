import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { and, eq, desc, notExists } from "drizzle-orm";
import { agentEpisodes, scoutMessages, userMemories } from "../db/schema";
import { Mailbox } from "./mailbox";
import { type Database } from "./storage";
import { type MemoryService } from "./memory";
import { type Model } from "./model";
import { actionSchema, type AgentAction } from "./types";
export type Turn = {
  userId: string;
  conversationId: string;
  intent: string;
  participants: string[];
  proposal: unknown;
  constraints: unknown;
  options: unknown;
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
    .addNode("reason_and_choose_action", async (s) => ({
      action: await model.generate(
        `You are the independent Scout of user ${s.input.userId}. Represent only this user, using their private context. Current retrieved memories, especially explicit user edits, supersede older conflicting conversation history. Other Scouts have different information. Decide your next action: ask a participant a question, suggest an alternative, counteroffer, accept/reject the exact current proposal, consult events, request human clarification or end. First learn constraints through messages when useful. Reply to addressed inquiries; negotiate soft preferences. Any proposal must use a supplied real catalog activity/feasible plan, with all participants. You may suggest compatible alternatives without the user naming them. ACCEPT requires the exact current proposal hash. An agent-level ACCEPT never approves on behalf of a human. No other user is yours to control. recipientId must be an authorized participant other than you for messages; null for CONSULT_EVENTS/REQUEST_HUMAN/END. plan is null except PROPOSE/COUNTER. Include only necessary, permitted information in content.`,
        actionSchema,
        { ...s.input, privateContext: s.context },
      ),
    }))
    .addNode("persist_state", (s) => ({ action: actionSchema.parse(s.action) }))
    .addEdge(START, "receive_message")
    .addEdge("receive_message", "retrieve_memory")
    .addEdge("retrieve_memory", "reason_and_choose_action")
    .addEdge("reason_and_choose_action", "persist_state")
    .addEdge("persist_state", END)
    .compile();
}
