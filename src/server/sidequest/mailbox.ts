import { and, asc, desc, eq, gte, or } from "drizzle-orm";
import { agentMessages } from "../db/schema";
import { type Store } from "./storage";
import { DomainError } from "./types";
/** Persistent addressed mail. The scheduler authorizes bilateral permissions before
 * constructing it; no model receives a store handle or may choose its own membership. */
export class Mailbox {
  constructor(
    private store: Store,
    private conversationId: string,
    private participants: string[],
  ) {}
  async transcript() {
    return this.store
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.conversationId, this.conversationId))
      .orderBy(asc(agentMessages.turn));
  }
  async context(userId: string, fromTurn?: number) {
    if (!this.participants.includes(userId))
      throw new DomainError("FORBIDDEN", "Unauthorized mailbox");
    return this.store
      .select()
      .from(agentMessages)
      .where(
        and(
          eq(agentMessages.conversationId, this.conversationId),
          fromTurn === undefined
            ? undefined
            : gte(agentMessages.turn, fromTurn),
          or(
            eq(agentMessages.senderId, userId),
            eq(agentMessages.recipientId, userId),
          ),
        ),
      )
      .orderBy(desc(agentMessages.turn))
      .limit(12);
  }
  async emit(input: Omit<typeof agentMessages.$inferInsert, "conversationId">) {
    if (
      !this.participants.includes(input.senderId) ||
      !this.participants.includes(input.recipientId) ||
      input.senderId === input.recipientId
    )
      throw new DomainError("FORBIDDEN", "Unauthorized recipient");
    const [message] = await this.store
      .insert(agentMessages)
      .values({ ...input, conversationId: this.conversationId })
      .returning();
    return message!;
  }
  async markProcessed(userId: string, messageId: string) {
    if (!this.participants.includes(userId))
      throw new DomainError("FORBIDDEN", "Unauthorized mailbox");
    await this.store
      .update(agentMessages)
      .set({ status: "PROCESSED" })
      .where(
        and(
          eq(agentMessages.conversationId, this.conversationId),
          eq(agentMessages.recipientId, userId),
          eq(agentMessages.id, messageId),
        ),
      );
  }
}
