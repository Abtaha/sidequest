import { z } from "zod";
export const constraintsSchema = z
  .object({
    maxCost: z.number().int().nonnegative().optional(),
    minGroup: z.number().int().min(2).max(5).optional(),
    maxGroup: z.number().int().min(2).max(5).optional(),
    windows: z
      .array(
        z
          .object({ start: z.string().datetime(), end: z.string().datetime() })
          .refine((w) => w.end > w.start, "Invalid time window"),
      )
      .max(30)
      .optional(),
    excludedUsers: z.array(z.string()).max(100).optional(),
    excludedTags: z.array(z.string().max(80)).max(30).optional(),
  })
  .strict();
export type Constraints = z.infer<typeof constraintsSchema>;
