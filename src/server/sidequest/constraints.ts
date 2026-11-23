import { createHash } from "node:crypto";
import {
  constraintsSchema,
  type Constraints,
  type Plan,
  DomainError,
} from "./types";
export type Activity = {
  id: string;
  start: Date;
  end: Date;
  cost: number;
  capacity: number;
  tags: string[];
  title?: string;
  location?: string;
  description?: string;
  category?: string;
  synthetic?: boolean;
};
export type Participant = {
  userId: string;
  circle: string;
  openDiscovery: boolean;
  sharing: boolean;
  discoverable: boolean;
  blockedUsers: string[];
  constraints: Constraints;
  windows: { start: string; end: string }[];
  session: Constraints;
  memoryConstraints?: Constraints[];
  unresolvedConstraints?: boolean;
};
export function activityHash(activity: Activity) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: activity.id,
        title: activity.title,
        location: activity.location,
        description: activity.description,
        category: activity.category,
        synthetic: activity.synthetic,
        start: activity.start.toISOString(),
        end: activity.end.toISOString(),
        cost: activity.cost,
        capacity: activity.capacity,
        tags: [...activity.tags].sort(),
      }),
    )
    .digest("hex");
}
export function proposalHash(plan: Plan) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        activityId: plan.activityId,
        catalogHash: plan.catalogHash,
        start: new Date(plan.start).toISOString(),
        end: new Date(plan.end).toISOString(),
        participantIds: [...plan.participantIds].sort(),
      }),
    )
    .digest("hex");
}
export function checkContacts(
  participants: Participant[],
  excludedUsers: string[] = [],
) {
  if (participants.some((p) => excludedUsers.includes(p.userId)))
    throw new DomainError("FORBIDDEN", "Participant contact excluded");
  if (
    participants.length < 2 ||
    participants.length > 5 ||
    new Set(participants.map((p) => p.userId)).size !== participants.length
  )
    throw new DomainError("BAD_REQUEST", "Require 2–5 distinct participants");
  for (const p of participants) {
    if (!p.sharing || !p.discoverable)
      throw new DomainError(
        "FORBIDDEN",
        "Participant has not opted into negotiation",
      );
    if (
      participants.some(
        (q) => q.circle !== p.circle && !(p.openDiscovery && q.openDiscovery),
      )
    )
      throw new DomainError(
        "FORBIDDEN",
        "Both people must opt into matching beyond their circle",
      );
    if (
      participants.some(
        (q) =>
          q.userId !== p.userId &&
          (p.blockedUsers.includes(q.userId) ||
            (p.constraints.excludedUsers?.includes(q.userId) ?? false) ||
            (p.session.excludedUsers?.includes(q.userId) ?? false) ||
            (p.memoryConstraints ?? []).some((c) =>
              c.excludedUsers?.includes(q.userId),
            )),
      )
    )
      throw new DomainError("FORBIDDEN", "Participant contact excluded");
  }
}
export function validatePlan(
  plan: Plan,
  activity: Activity,
  participants: Participant[],
  quest: Constraints = {},
) {
  checkContacts(participants, quest.excludedUsers);
  const ids = participants.map((p) => p.userId).sort();
  if (JSON.stringify([...plan.participantIds].sort()) !== JSON.stringify(ids))
    throw new DomainError(
      "BAD_REQUEST",
      "Proposal membership must match authorized humans",
    );
  const start = new Date(plan.start),
    end = new Date(plan.end);
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    start >= end ||
    start < new Date()
  )
    throw new DomainError("BAD_REQUEST", "Invalid or past proposal time");
  if (
    plan.activityId !== activity.id ||
    start < activity.start ||
    end > activity.end ||
    activity.capacity < ids.length
  )
    throw new DomainError(
      "BAD_REQUEST",
      "Activity time/capacity is not feasible",
    );
  for (const p of participants) {
    if (p.unresolvedConstraints)
      throw new DomainError(
        "PRECONDITION_FAILED",
        "An explicit constraint needs typed clarification",
      );
    if (
      !p.windows.some(
        (w) => +start >= +new Date(w.start) && +end <= +new Date(w.end),
      )
    )
      throw new DomainError(
        "BAD_REQUEST",
        "Missing or incompatible availability",
      );
    // Session constraints can narrow the feasible set, never loosen permissions or hard limits.
    for (const c of [
      quest,
      p.constraints,
      p.session,
      ...(p.memoryConstraints ?? []),
    ]) {
      if (c.maxCost !== undefined && activity.cost > c.maxCost)
        throw new DomainError("BAD_REQUEST", "Budget ceiling exceeded");
      if (
        (c.minGroup && ids.length < c.minGroup) ||
        (c.maxGroup && ids.length > c.maxGroup)
      )
        throw new DomainError("BAD_REQUEST", "Group size restriction");
      if (
        c.windows &&
        !c.windows.some(
          (w) => +start >= +new Date(w.start) && +end <= +new Date(w.end),
        )
      )
        throw new DomainError("BAD_REQUEST", "Explicit time restriction");
      if (
        c.excludedUsers?.some((u) => ids.includes(u)) ||
        c.excludedTags?.some((t) => activity.tags.includes(t))
      )
        throw new DomainError("FORBIDDEN", "Explicit exclusion");
    }
  }
  if (plan.catalogHash !== activityHash(activity))
    throw new DomainError(
      "CONFLICT",
      "Catalog terms changed; request a new proposal",
    );
}

export function parseMemoryConstraint(value: unknown): Constraints | undefined {
  const parsed = constraintsSchema.safeParse(value);
  return parsed.success && Object.keys(parsed.data).length
    ? parsed.data
    : undefined;
}
