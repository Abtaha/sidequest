import "server-only";
import { z } from "zod";
import { defaultLimits } from "./negotiation";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { db } from "../db";
import { OpenRouterModel } from "./model";
import { MemoryService } from "./memory";
import { ScoutService } from "./scout";
import { NegotiationService } from "./negotiation";
let instance: ReturnType<typeof create> | undefined;
function create() {
  const model = {
    generate: <T>(task: string, schema: z.ZodType<T>, data: unknown) =>
      new OpenRouterModel().generate(task, schema, data),
  };
  const memory = new MemoryService(db, model);
  const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  // Run pnpm db:checkpoints once during setup, not on every API invocation.
  const negotiation = new NegotiationService(
    db,
    model,
    memory,
    {
      ...defaultLimits,
      calls: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(process.env.SIDEQUEST_MAX_LLM_CALLS ?? defaultLimits.calls),
      tokens: z.coerce
        .number()
        .int()
        .min(1)
        .parse(process.env.SIDEQUEST_TOKEN_BUDGET ?? defaultLimits.tokens),
    },
    checkpointer,
  );
  return {
    memory,
    scout: new ScoutService(db, model, memory, negotiation),
    negotiation,
  };
}
export function services() {
  return (instance ??= create());
}
