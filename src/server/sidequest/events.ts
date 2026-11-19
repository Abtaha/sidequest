import { gte, lte, and } from "drizzle-orm";
import { activities } from "../db/schema";
import { type Store } from "./storage";
import { validatePlan, activityHash, type Participant } from "./constraints";
import { type Constraints, type Plan } from "./types";
import { type Model } from "./model";
import { z } from "zod";
export class EventAgent {
  constructor(
    private store: Store,
    private model: Model,
  ) {}
  async options(participants: Participant[], constraints: Constraints = {}) {
    return this.optionsFor(
      await this.catalog(constraints),
      participants,
      constraints,
    );
  }
  async catalog(constraints: Constraints) {
    return this.store
      .select()
      .from(activities)
      .where(
        and(
          gte(activities.end, new Date()),
          lte(activities.cost, constraints.maxCost ?? 2_000_000),
        ),
      )
      .orderBy(activities.start)
      .limit(100);
  }
  optionsFor(
    rows: (typeof activities.$inferSelect)[],
    participants: Participant[],
    constraints: Constraints,
  ) {
    const options: { activity: typeof activities.$inferSelect; plan: Plan }[] =
      [];
    for (const activity of rows) {
      // Enumerate starts at availability boundaries and explicit session windows.
      const starts = [
        activity.start.toISOString(),
        ...participants.flatMap((p) =>
          [
            ...p.windows,
            ...(p.session.windows ?? []),
            ...(p.constraints.windows ?? []),
            ...(p.memoryConstraints ?? []).flatMap((c) => c.windows ?? []),
          ].map((w) => w.start),
        ),
        ...(constraints.windows ?? []).map((w) => w.start),
      ];
      for (const start of new Set(starts)) {
        const actualStart = new Date(
          Math.max(+new Date(start), +activity.start),
        );
        const plan: Plan = {
          activityId: activity.id,
          catalogHash: activityHash(activity),
          start: actualStart.toISOString(),
          end: new Date(+actualStart + 60 * 60 * 1000).toISOString(),
          participantIds: participants.map((p) => p.userId),
        };
        try {
          validatePlan(plan, activity, participants, constraints);
          options.push({ activity, plan });
          break;
        } catch {
          /* This catalog entry is not feasible. */
        }
      }
      if (options.length >= 8) break;
    }
    return options;
  }
  async consult(
    participants: Participant[],
    constraints: Constraints,
    query: string,
  ) {
    const options = await this.options(participants, constraints);
    if (!options.length) return { options, recommendations: [] };
    const response = await this.model.generate(
      "You are the catalog event agent. Explain which supplied feasible options fit the query. Return ONLY supplied activity IDs, never invent events, prices, availability or reservations.",
      z.object({
        recommendations: z
          .array(
            z.object({
              activityId: z.string().uuid(),
              explanation: z.string().max(500),
            }),
          )
          .max(8),
      }),
      { query, options },
    );
    return {
      options,
      recommendations: response.recommendations.flatMap((r) => {
        const entry = options.find((o) => o.activity.id === r.activityId);
        if (!entry) return [];
        // The model ranks real IDs. Render facts from the catalog rather than
        // publishing potentially invented prices/venues in model explanations.
        return [
          {
            activityId: entry.activity.id,
            explanation: `${entry.activity.title}: ₩${entry.activity.cost}/person; ${entry.activity.tags.join(", ")}.`,
          },
        ];
      }),
    };
  }
}
