import { type z } from "zod";
import { type Model } from "../src/server/sidequest/model";
export class QueueModel implements Model {
  readonly inputs: { task: string; data: unknown }[] = [];
  constructor(public replies: unknown[]) {}
  async generate<T>(
    task: string,
    schema: z.ZodType<T>,
    data: unknown,
  ): Promise<T> {
    this.inputs.push({ task, data });
    if (!this.replies.length) throw new Error("No scripted model response");
    return schema.parse(this.replies.shift());
  }
}
