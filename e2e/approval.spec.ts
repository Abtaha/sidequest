import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import * as schema from "../src/server/db/schema";
import { MemoryService } from "../src/server/sidequest/memory";
import { NegotiationService } from "../src/server/sidequest/negotiation";
import { EventAgent } from "../src/server/sidequest/events";
import { proposalHash } from "../src/server/sidequest/constraints";
import { QueueModel } from "../tests/scripted-model";
import type { AgentAction } from "../src/server/sidequest/types";
test("two signed-in humans approve independently, receive updates and lose stale approval after revision", async ({
  browser,
  baseURL,
}) => {
  test.skip(
    !process.env.PLAYWRIGHT_DATABASE_URL,
    "Requires a seeded isolated native PostgreSQL database matching the running app",
  );
  const url = process.env.PLAYWRIGHT_DATABASE_URL!;
  const conn = postgres(url),
    db = drizzle(conn, { schema });
  const saver = PostgresSaver.fromConnString(url);
  const firstContext = await browser.newContext({ baseURL }),
    secondContext = await browser.newContext({ baseURL });
  try {
    const identities: string[] = [];
    for (const [index, context] of [firstContext, secondContext].entries()) {
      const signup = await context.request.post("/api/auth/sign-up/email", {
        headers: { origin: baseURL! },
        data: {
          name: `Synthetic Approval Tester ${index + 1}`,
          email: `approval-${randomUUID()}@example.invalid`,
          password: "Synthetic-Approval-Test-2026!",
        },
      });
      expect(signup.ok()).toBe(true);
      identities.push(
        z
          .object({ user: z.object({ id: z.string() }) })
          .parse(await signup.json()).user.id,
      );
    }
    const circle = `e2e-${randomUUID()}`;
    const catalog = await db.select().from(schema.activities);
    const windowStart = new Date(Math.min(...catalog.map((a) => +a.start))),
      windowEnd = new Date(Math.max(...catalog.map((a) => +a.end)));
    for (const id of identities) {
      await db
        .insert(schema.profiles)
        .values({ userId: id, circle, sharing: true, discoverable: true });
      await db
        .insert(schema.availability)
        .values({ userId: id, start: windowStart, end: windowEnd });
    }
    const [a, b] = identities as [string, string];
    const model = new QueueModel([]),
      service = new NegotiationService(
        db,
        model,
        new MemoryService(db, model),
        undefined,
        saver,
      );
    const option = (
      await new EventAgent(db, model).options(
        await service.participants(identities, {}),
      )
    )[0]!;
    const initial = option.plan,
      firstHash = proposalHash(initial);
    const action = (
      type: AgentAction["type"],
      recipientId: string,
      content: string,
      extra: Partial<AgentAction> = {},
    ): AgentAction => ({
      type,
      recipientId,
      content,
      plan: null,
      proposalHash: null,
      ...extra,
    });
    model.replies.push(
      action("INQUIRY", b, "Would this activity suit you?"),
      action("PROPOSE", a, "This catalog option fits", { plan: initial }),
      action("ACCEPT", b, "Accepted by Scout A", { proposalHash: firstHash }),
      action("ACCEPT", a, "Accepted by Scout B", { proposalHash: firstHash }),
    );
    const quest = await service.create(a, {
      intent: "Synthetic browser approval scenario",
      requestId: randomUUID(),
      constraints: {},
    });
    const n = await service.start(a, quest.id, [b]);
    await service.run(a, n.id);
    const pageA = await firstContext.newPage(),
      pageB = await secondContext.newPage();
    for (const page of [pageA, pageB]) {
      await page.goto("/app");
      await page
        .getByRole("button", { name: "Plans", exact: true })
        .first()
        .click();
      await page
        .getByRole("button")
        .filter({ hasText: option.activity.title })
        .click();
      await expect(
        page.getByRole("button", { name: "Approve proposal v1", exact: true }),
      ).toBeVisible();
    }
    await pageA
      .getByRole("button", { name: "Approve proposal v1", exact: true })
      .click();
    await expect(
      pageA.getByText("1 of 2 humans have approved this version.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      pageA.getByText("Confirmed by every participant.", { exact: true }),
    ).toHaveCount(0);
    await pageB
      .getByRole("button", { name: "Approve proposal v1", exact: true })
      .click();
    await expect(
      pageA.getByText("Confirmed by every participant.", { exact: true }),
    ).toBeVisible();
    await expect(
      pageB.getByText("Confirmed by every participant.", { exact: true }),
    ).toBeVisible();
    const start = new Date(+new Date(initial.start) + 3_600_000).toISOString(),
      end = new Date(+new Date(initial.end) + 3_600_000).toISOString();
    await service.revise(a, {
      negotiationId: n.id,
      requestId: randomUUID(),
      instruction: "Please move one hour later",
      constraints: { windows: [{ start, end }] },
    });
    const revised = { ...initial, start, end },
      hash = proposalHash(revised);
    const current = (await service.load(n.id)).n;
    await service.execute(n.id, {
      actor: a,
      turn: current.turn,
      action: action("COUNTER", b, "Later time", { plan: revised }),
    });
    await service.execute(n.id, {
      actor: b,
      turn: current.turn + 1,
      action: action("ACCEPT", a, "New time accepted B", {
        proposalHash: hash,
      }),
    });
    await service.execute(n.id, {
      actor: a,
      turn: current.turn + 2,
      action: action("ACCEPT", b, "New time accepted A", {
        proposalHash: hash,
      }),
    });
    for (const page of [pageA, pageB]) {
      await expect(
        page.getByRole("button", { name: "Approve proposal v2", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("0 of 2 humans have approved this version.", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Confirmed by every participant.", { exact: true }),
      ).toHaveCount(0);
    }
  } finally {
    await firstContext.close();
    await secondContext.close();
    await saver.end();
    await conn.end();
  }
});
