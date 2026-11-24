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
import { activityLabels } from "../src/server/sidequest/activity-labels";
import { proposalHash } from "../src/server/sidequest/constraints";
import { QueueModel } from "../tests/scripted-model";
import type { AgentAction } from "../src/server/sidequest/types";
import SuperJSON from "superjson";
test("participants approve independently, revise and decline while another account stays excluded", async ({
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
    secondContext = await browser.newContext({ baseURL }),
    thirdContext = await browser.newContext({ baseURL }),
    outsiderContext = await browser.newContext({ baseURL });
  try {
    const identities: string[] = [];
    for (const [index, context] of [
      firstContext,
      secondContext,
      thirdContext,
      outsiderContext,
    ].entries()) {
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
    const participants = identities.slice(0, 3);
    const [a, b, c] = participants as [string, string, string];
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
        await service.participants(participants, {}),
      )
    )[0]!;
    const initial = option.plan,
      firstHash = proposalHash(initial);
    const activityTitle = activityLabels(option.activity).title;
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
      action("PROPOSE", c, "This catalog option fits", { plan: initial }),
      action("ACCEPT", a, "Accepted by Scout C", { proposalHash: firstHash }),
      action("ACCEPT", b, "Accepted by Scout A", { proposalHash: firstHash }),
      action("ACCEPT", c, "Accepted by Scout B", { proposalHash: firstHash }),
    );
    const quest = await service.create(a, {
      intent: "Synthetic browser approval scenario",
      requestId: randomUUID(),
      constraints: {},
    });
    const n = await service.start(a, quest.id, [b, c]);
    const agreed = await service.run(a, n.id);
    expect(agreed.activeProposalId).not.toBeNull();
    const query = (procedure: string, input: unknown) =>
      `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(SuperJSON.serialize(input)))}`;
    const outsiderPage = await outsiderContext.newPage();
    await outsiderPage.goto("/app");
    await outsiderPage
      .getByRole("button", { name: "Plans", exact: true })
      .first()
      .click();
    await expect(
      outsiderPage.getByText("No upcoming plans yet.", { exact: true }),
    ).toBeVisible();
    const outsiderDetail = await outsiderContext.request.get(
      query("sidequest.getNegotiation", { id: n.id }),
    );
    const outsiderMessages = await outsiderContext.request.get(
      query("sidequest.getMessages", { id: n.id, afterTurn: -1 }),
    );
    expect(outsiderDetail.status()).toBe(404);
    expect(outsiderMessages.status()).toBe(404);
    const pageA = await firstContext.newPage(),
      pageB = await secondContext.newPage(),
      pageC = await thirdContext.newPage();
    const pages = [pageA, pageB, pageC];
    const browserErrors: string[] = [];
    for (const page of pages) {
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && message.text().includes("same key"))
          browserErrors.push(message.text());
      });
      await page.goto("/app");
      await page
        .getByRole("button", { name: "Plans", exact: true })
        .first()
        .click();
      const proposalRow = page
        .getByRole("region", { name: "Awaiting Approval" })
        .getByRole("button")
        .filter({ hasText: activityTitle });
      await expect(proposalRow.getByText("Awaiting approvals")).toBeVisible();
      await proposalRow.click();
      await expect(
        page.getByRole("button", { name: "Approve proposal v1", exact: true }),
      ).toBeVisible();
    }
    await pageA
      .getByRole("button", { name: "Approve proposal v1", exact: true })
      .click();
    await expect(
      pageA.getByText("1 of 3 humans have approved this version.", {
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
      pageA.getByText("2 of 3 humans have approved this version.", {
        exact: false,
      }),
    ).toBeVisible();
    await pageC.getByRole("button", { name: "Approve proposal v1" }).click();
    for (const page of pages)
      await expect(
        page.getByText("Confirmed by every participant.", { exact: true }),
      ).toBeVisible();
    await pageA.keyboard.press("Escape");
    const confirmed = pageA
      .getByRole("region", { name: "Upcoming Plans" })
      .getByRole("button")
      .filter({ hasText: "Confirmed by everyone" });
    await expect(confirmed).toBeVisible();
    await expect(
      confirmed.getByText("3 participants", { exact: true }),
    ).toBeVisible();
    await expect(
      pageA
        .getByRole("region", { name: "Awaiting Approval" })
        .getByRole("button"),
    ).toHaveCount(0);
    await confirmed.click();
    const details = pageA.getByRole("dialog");
    await expect(
      details.getByText(/With .*Synthetic Approval Tester 2/),
    ).toBeVisible();
    await expect(
      details.getByText("Confirmed by every participant.", { exact: true }),
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
    await service.execute(n.id, {
      actor: c,
      turn: current.turn + 3,
      action: action("ACCEPT", a, "New time accepted C", {
        proposalHash: hash,
      }),
    });
    for (const page of pages) {
      await expect(
        page.getByRole("button", { name: "Approve proposal v2", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("0 of 3 humans have approved this version.", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Confirmed by every participant.", { exact: true }),
      ).toHaveCount(0);
    }
    await pageA.keyboard.press("Escape");
    await expect(confirmed).toHaveCount(0);
    const revisedRow = pageA
      .getByRole("region", { name: "Awaiting Approval" })
      .getByRole("button")
      .filter({ hasText: activityTitle });
    await expect(revisedRow).toBeVisible();
    await revisedRow.click();
    await expect(
      pageA.getByRole("button", { name: "Approve proposal v2" }),
    ).toBeVisible();
    const staleApproval = await secondContext.request.post(
      "/api/trpc/sidequest.approveProposal",
      {
        headers: { origin: baseURL! },
        data: SuperJSON.serialize({
          negotiationId: n.id,
          proposalId: agreed.activeProposalId,
          hash: firstHash,
        }),
      },
    );
    expect(staleApproval.status()).toBe(409);
    await pageB.getByRole("button", { name: "Decline proposal" }).click();
    for (const page of pages) {
      await expect(page.getByText(/human rejected/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Approve proposal v2" }),
      ).toHaveCount(0);
    }
    await pageA.keyboard.press("Escape");
    await expect(confirmed).toHaveCount(0);
    await expect(
      pageA
        .getByRole("region", { name: "Awaiting Approval" })
        .getByRole("button"),
    ).toHaveCount(0);
    await expect(
      pageA.getByText("A participant declined the proposal."),
    ).toHaveCount(0);
    await pageA
      .getByRole("button", { name: "View Failed & Declined Plans" })
      .click();
    const declined = pageA
      .getByRole("button")
      .filter({ hasText: activityTitle });
    await expect(declined.getByText("Declined", { exact: true })).toBeVisible();
    await expect(
      declined.getByText("A participant declined the proposal."),
    ).toBeVisible();
    await pageA.getByRole("button", { name: "Back to Plans" }).click();
    await expect(declined).toHaveCount(0);
    expect(browserErrors).toEqual([]);
  } finally {
    await firstContext.close();
    await secondContext.close();
    await thirdContext.close();
    await outsiderContext.close();
    await saver.end();
    await conn.end();
  }
});
