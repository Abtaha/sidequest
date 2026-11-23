import { test, expect } from "@playwright/test";
test("real authentication, onboarding, saved memories, discovery and session recovery", async ({
  page,
  context,
}) => {
  const email = `synthetic-e2e-${Date.now()}@example.invalid`,
    password = "Synthetic-E2E-Password-2026!";
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Your name").fill("Synthetic Browser Tester");
  await page.getByLabel("School email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create my Scout" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByText("Games", { exact: true }).click();
  await page.getByText("Music & nightlife", { exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Ideal group size").selectOption("Small groups");
  await page.getByLabel("Personal Budget").selectOption("Under ₩10,000");
  await page.getByText("Weekends", { exact: true }).click();
  await page.locator('input[name="optIn"]').check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/personalize$/);
  await page.getByRole("button", { name: "Meet my Scout" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page
    .getByRole("button", { name: "Scout", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Preferred group size: Small groups", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  // Select the particular memory by its persisted content, not a local mock ID.
  const editor = page.getByLabel("Edit SOCIAL_PREFERENCE memory");
  await editor.fill("Prefers relaxed groups with room for conversation");
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes("memory.update") && response.ok(),
    ),
    editor
      .locator("..")
      .getByRole("button", { name: "Save memory", exact: true })
      .click(),
  ]);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByText("Prefers relaxed groups with room for conversation", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Scout", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Prefers relaxed groups with room for conversation", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Planning circle", { exact: true })
    .fill("synthetic-campus");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "People", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic Scout User 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Discover", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Synthetic board game meetup", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByLabel("School email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Log in to SideQuest", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await page
    .getByRole("button", { name: "Scout", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Prefers relaxed groups with room for conversation", {
      exact: true,
    }),
  ).toBeVisible();
  const anonymous = await context.browser()!.newContext();
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(new URL("/app", page.url()).toString());
  await expect(anonymousPage).toHaveURL(/\/login$/);
  await anonymous.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open profile settings", exact: true })
    .click();
  await expect(page.getByLabel("Planning circle", { exact: true })).toHaveValue(
    "synthetic-campus",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
});
