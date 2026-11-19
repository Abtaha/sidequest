import { gte, lte, and, eq } from "drizzle-orm";
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
  async options(
    participants: Participant[],
    constraints: Constraints = {},
    includeLaterSlots = false,
    activityId?: string,
  ) {
    return this.optionsFor(
      await this.catalog(constraints, activityId),
      participants,
      constraints,
      includeLaterSlots,
    );
  }
  async catalog(constraints: Constraints, activityId?: string) {
    return this.store
      .select()
      .from(activities)
      .where(
        and(
          gte(activities.end, new Date()),
          lte(activities.cost, constraints.maxCost ?? 2_000_000),
          activityId ? eq(activities.id, activityId) : undefined,
        ),
      )
      .orderBy(activities.start)
      .limit(100);
  }
  optionsFor(
    rows: (typeof activities.$inferSelect)[],
    participants: Participant[],
    constraints: Constraints,
    includeLaterSlots = false,
  ) {
    const options: { activity: typeof activities.$inferSelect; plan: Plan }[] =
      [];
    const later: typeof options = [];
    for (const activity of rows) {
      // Enumerate starts at availability boundaries and explicit session windows.
      const windows = [
        ...participants.flatMap((p) => [
          ...p.windows,
          ...(p.session.windows ?? []),
          ...(p.constraints.windows ?? []),
          ...(p.memoryConstraints ?? []).flatMap((c) => c.windows ?? []),
        ]),
        ...(constraints.windows ?? []),
      ];
      const hour = 60 * 60 * 1000;
      const starts = [
        +activity.start,
        ...windows.map((w) => +new Date(w.start)),
      ];
      if (includeLaterSlots) {
        starts.push(
          ...[+activity.end, ...windows.map((w) => +new Date(w.end))]
            .map((end) => Math.min(end, +activity.end) - hour)
            .sort((a, b) => b - a),
        );
      }
      let firstSlot: Plan | undefined;
      for (const start of new Set(
        starts.map((start) => Math.max(start, +activity.start)),
      )) {
        const actualStart = new Date(start);
        const plan: Plan = {
          activityId: activity.id,
          catalogHash: activityHash(activity),
          start: actualStart.toISOString(),
          end: new Date(start + hour).toISOString(),
          participantIds: participants.map((p) => p.userId),
        };
        try {
          validatePlan(plan, activity, participants, constraints);
          if (firstSlot) {
            later.push({ activity, plan });
            break;
          }
          options.push({ activity, plan });
          if (!includeLaterSlots) break;
          firstSlot = plan;
        } catch {
          /* This catalog entry is not feasible. */
        }
      }
      if (options.length >= 8) break;
    }
    return [...options, ...later].slice(0, 8);
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
