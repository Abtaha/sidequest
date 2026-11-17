import { z } from "zod";
export {
  constraintsSchema,
  type Constraints,
} from "@/lib/sidequest-constraints";
export const planSchema = z
  .object({
    activityId: z.string().uuid(),
    catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
    start: z.string().datetime(),
    end: z.string().datetime(),
    participantIds: z.array(z.string()).min(2).max(5),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export const candidateSchema = z
  .object({
    key: z.string().min(1).max(100),
    category: z.enum([
      "INTEREST",
      "PREFERENCE",
      "DISLIKE",
      "CONSTRAINT",
      "AVAILABILITY",
      "SOCIAL_PREFERENCE",
      "FEEDBACK",
      "EXPERIENCE",
    ]),
    content: z.string().min(1).max(500),
    value: z.record(z.unknown()).nullable(),
    scope: z.enum(["PERSISTENT", "TEMPORARY", "SESSION"]),
    confidence: z.number().int().min(0).max(100),
    explicit: z.boolean(),
    expiresAt: z.string().datetime().nullable(),
    supersedesId: z.string().uuid().nullable(),
    evidence: z.string().min(1).max(500),
  })
  .strict();
export type Candidate = z.infer<typeof candidateSchema>;
export const extractionSchema = z.object({
  memories: z.array(candidateSchema).max(12),
});
export const actionSchema = z
  .object({
    type: z.enum([
      "INQUIRY",
      "INFORM",
      "PROPOSE",
      "COUNTER",
      "ACCEPT",
      "REJECT",
      "REQUEST_INFO",
      "WITHDRAW",
      "CONSULT_EVENTS",
      "REQUEST_HUMAN",
      "END",
    ]),
    recipientId: z.string().nullable(),
    content: z.string().min(1).max(1200),
    plan: planSchema.nullable(),
    proposalHash: z.string().nullable(),
  })
  .strict();
export type AgentAction = z.infer<typeof actionSchema>;
export class DomainError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "BAD_REQUEST"
      | "PRECONDITION_FAILED",
    message: string,
  ) {
    super(message);
  }
}
