import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { database } from "./database";
import { QueueModel } from "./scripted-model";
import { MemoryService } from "../src/server/sidequest/memory";
import { ScoutService } from "../src/server/sidequest/scout";
import { NegotiationService } from "../src/server/sidequest/negotiation";
import { seed, syntheticIds } from "../src/server/sidequest/seed";
const mocks = vi.hoisted(() => ({ services: vi.fn() }));
vi.mock("../src/server/sidequest/services", () => ({
  services: mocks.services,
}));
vi.mock("../src/server/db", () => ({ db: {} }));
vi.mock("../src/server/better-auth", () => ({ auth: {} }));
import { appRouter } from "../src/server/api/root";
import type { createTRPCContext } from "../src/server/api/trpc";
let f: Awaited<ReturnType<typeof database>>;
type Context = Awaited<ReturnType<typeof createTRPCContext>>;
function caller(userId?: string) {
  const now = new Date();
  const session: Context["session"] = userId
    ? {
        user: {
          id: userId,
          name: "Synthetic user",
          email: `${userId}@example.invalid`,
          emailVerified: false,
          image: null,
          createdAt: now,
          updatedAt: now,
        },
        session: {
          id: randomUUID(),
          userId,
          token: "synthetic-test-session",
          createdAt: now,
          updatedAt: now,
          expiresAt: new Date(+now + 60000),
          ipAddress: null,
          userAgent: null,
        },
      }
    : null;
  return appRouter.createCaller({ db: f.db, session, headers: new Headers() });
}
beforeAll(async () => {
  f = await database();
  await seed(f.db, new Date("2099-01-01T00:00:00Z"));
  const model = new QueueModel([]),
    memory = new MemoryService(f.db, model),
    negotiation = new NegotiationService(f.db, model, memory);
  mocks.services.mockReturnValue({
    memory,
    scout: new ScoutService(f.db, model, memory, negotiation),
    negotiation,
  });
});
afterAll(async () => {
  await f.close();
});
it("requires a server session for every user-scoped router", async () => {
  const api = caller();
  for (const call of [
    () => api.profile.get(),
    () => api.memory.list(),
    () => api.scout.listConversations(),
    () => api.sidequest.list(),
  ])
    await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
it("derives ownership from session, ignoring an injected client userId", async () => {
  const a = caller(syntheticIds[0]),
    b = caller(syntheticIds[1]);
  const quest = await a.sidequest.create({
    intent: "Synthetic weekend",
    requestId: randomUUID(),
    constraints: {},
    userId: syntheticIds[1],
  } as Parameters<typeof a.sidequest.create>[0]);
  expect(quest.ownerId).toBe(syntheticIds[0]);
  await expect(b.sidequest.get({ id: quest.id })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("makes negotiation transcripts available only to authorized participants", async () => {
  const a = caller(syntheticIds[0]),
    outsider = caller(syntheticIds[7]);
  const quest = await a.sidequest.create({
    intent: "Synthetic weekend",
    requestId: randomUUID(),
    constraints: {},
  });
  const n = await a.sidequest.startNegotiation({
    sidequestId: quest.id,
    candidateIds: [syntheticIds[1]!, syntheticIds[2]!],
  });
  await expect(
    outsider.sidequest.getMessages({ id: n.id, afterTurn: -1 }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    outsider.sidequest.getNegotiation({ id: n.id }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const visible = await caller(syntheticIds[1]).sidequest.getNegotiation({
    id: n.id,
  });
  expect(visible.participants).toContain(syntheticIds[1]);
  expect(visible).not.toHaveProperty("constraints");
  expect(visible).not.toHaveProperty("pendingAction");
  expect(n).not.toHaveProperty("constraints");
});
it("isolates memory edit/delete operations across sessions", async () => {
  const own = await caller(syntheticIds[0]).memory.list();
  const memory = own[0]!;
  await expect(
    caller(syntheticIds[1]).memory.update({
      id: memory.id,
      content: "Malicious edit",
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    caller(syntheticIds[1]).memory.delete({
      id: memory.id,
      deleteSource: false,
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("persists onboarding choices, source messages and dated availability idempotently", async () => {
  const { user, userMemories, availability, scoutMessages } =
    await import("../src/server/db/schema");
  const { eq } = await import("drizzle-orm");
  const id = `onboarding-${randomUUID()}`;
  await f.db
    .insert(user)
    .values({
      id,
      name: "Synthetic onboarding user",
      email: `${id}@example.invalid`,
    });
  const api = caller(id),
    input = {
      requestId: randomUUID(),
      interests: ["Games", "Music"],
      socialStyle: "Small groups",
      budget: "Under ₩10,000",
      optIn: true,
      windows: [
        {
          start: new Date("2099-01-03T09:00:00Z"),
          end: new Date("2099-01-03T12:00:00Z"),
        },
      ],
    };
  await api.profile.onboard(input);
  await api.profile.onboard(input);
  const profile = await api.profile.get();
  expect(profile.profile?.sharing).toBe(true);
  expect(profile.profile?.discoverable).toBe(true);
  expect(profile.profile?.openDiscovery).toBe(true);
  expect(
    await f.db.select().from(userMemories).where(eq(userMemories.userId, id)),
  ).toHaveLength(4);
  expect(
    await f.db.select().from(availability).where(eq(availability.userId, id)),
  ).toHaveLength(1);
  expect(
    await f.db.select().from(scoutMessages).where(eq(scoutMessages.userId, id)),
  ).toHaveLength(1);
  expect(profile.profile?.constraints.maxCost).toBeUndefined();
  await api.profile.onboard({
    ...input,
    requestId: randomUUID(),
    openDiscovery: false,
  });
  expect((await api.profile.get()).profile).toMatchObject({
    discoverable: true,
    sharing: true,
    openDiscovery: false,
  });
  await api.profile.onboard({ ...input, requestId: randomUUID() });
  expect((await api.profile.get()).profile?.openDiscovery).toBe(false);
});
it("exposes only permitted public people and strips private negotiation state from lists", async () => {
  const api = caller(syntheticIds[0]);
  const people = await api.people.list();
  expect(people.length).toBeGreaterThan(0);
  for (const person of people)
    expect(Object.keys(person).sort()).toEqual(["id", "name"]);
  const rows = await api.sidequest.list();
  for (const row of rows) {
    if (row.negotiation) {
      expect(row.negotiation).not.toHaveProperty("constraints");
      expect(row.negotiation).not.toHaveProperty("pendingAction");
      expect(row.negotiation).not.toHaveProperty("leaseOwner");
    }
  }
});

it("matches strangers across circles only when both opt in", async () => {
  const [hostId, guestId, privateId] = syntheticIds;
  const host = caller(hostId);
  const guest = caller(guestId);
  const restricted = caller(privateId);
  const preferences = {
    discoverable: true,
    sharing: true,
    blockedUsers: [],
    constraints: {},
  };
  await host.profile.update({
    ...preferences,
    circle: "host-circle",
    openDiscovery: true,
  });
  await guest.profile.update({
    ...preferences,
    circle: "guest-circle",
    openDiscovery: true,
  });
  await restricted.profile.update({ ...preferences, circle: "private-circle" });

  expect(await host.people.list()).toEqual([
    { id: guestId, name: "Synthetic Scout User 2" },
  ]);
  expect(await restricted.people.list()).toEqual([]);
  await guest.profile.update({
    ...preferences,
    circle: "guest-circle",
    blockedUsers: [hostId!],
  });
  expect(await host.people.list()).toEqual([]);
  await guest.profile.update({ ...preferences, circle: "guest-circle" });
  const quest = await host.sidequest.create({
    requestId: randomUUID(),
    intent: "Find a board game meetup with one other person.",
    constraints: {},
  });
  await expect(
    host.sidequest.startNegotiation({
      sidequestId: quest.id,
      candidateIds: [privateId!],
    }),
  ).rejects.toThrow("Both people must opt into matching beyond their circle");
  const negotiation = await host.sidequest.startNegotiation({
    sidequestId: quest.id,
  });
  expect(
    (await guest.sidequest.getNegotiation({ id: negotiation.id })).participants,
  ).toEqual([hostId, guestId]);

  await guest.profile.update({
    ...preferences,
    circle: "guest-circle",
    openDiscovery: false,
  });
  expect(await host.people.list()).toEqual([]);
});
