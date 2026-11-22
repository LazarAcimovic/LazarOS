import { test, expect, type Page } from "@playwright/test";

// Each journey registers its own user, so journeys are independent of each other.
let counter = 0;
async function registerFreshUser(page: Page) {
  const email = `journey-${Date.now()}-${counter++}@lazaros.test`;
  await page.goto("/register");
  await page.getByLabel("First Name").fill("Journey");
  await page.getByLabel("Last Name").fill("Tester");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill("Passw0rd!x");
  await page.locator("#confirm_password").fill("Passw0rd!x");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
}

// Local YYYY-MM-DD, offset by whole days (same clock the browser uses for getLocalToday).
function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Creates a task through the New Task modal on the Today page.
async function createTask(page: Page, title: string, dueDate: string) {
  await page.getByRole("button", { name: "+ Add Task" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("New Task")).toBeVisible();
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Due Date").fill(dueDate);
  await dialog.getByRole("button", { name: "Create Task" }).click();
  await expect(dialog).toBeHidden();
}

const section = (page: Page, heading: string) =>
  page.locator("section.task-section").filter({
    has: page.getByRole("heading", { name: heading, level: 2, exact: true }),
  });
const card = (scope: ReturnType<typeof section> | Page, title: string) =>
  scope.locator(".task-card").filter({ hasText: title });

test("create a task due today and one due yesterday; the late one shows an overdue badge", async ({ page }) => {
  await registerFreshUser(page);

  await createTask(page, "Due today task", localDate(0));
  await expect(card(section(page, "Today"), "Due today task")).toBeVisible();

  await createTask(page, "Due yesterday task", localDate(-1));
  const overdue = card(section(page, "Overdue"), "Due yesterday task");
  await expect(overdue).toBeVisible();
  await expect(overdue.getByText("1 day overdue", { exact: true })).toBeVisible();
  // The today task stays in Today, not Overdue.
  await expect(card(section(page, "Overdue"), "Due today task")).toHaveCount(0);
});

test("a completed task moves to Completed and leaves the dashboard the next day", async ({ page }) => {
  await registerFreshUser(page);
  await createTask(page, "Finish me", localDate(0));

  await card(section(page, "Today"), "Finish me").getByRole("button", { name: "Toggle complete" }).click();
  await expect(card(section(page, "Completed"), "Finish me")).toBeVisible();
  await expect(card(section(page, "Today"), "Finish me")).toHaveCount(0);

  // Advance the browser clock by one day; getLocalToday() reads new Date(), so the dashboard
  // request is made with today + 1.
  await page.clock.install({ time: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  await page.reload();

  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(page.getByText("Nothing due today. Enjoy your day!")).toBeVisible();
  await expect(page.locator(".task-card").filter({ hasText: "Finish me" })).toHaveCount(0);
});

test("a deleted task moves to Archive and can be restored to the dashboard", async ({ page }) => {
  await registerFreshUser(page);
  await createTask(page, "Archive me", localDate(0));

  await card(section(page, "Today"), "Archive me").getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText('Delete "Archive me"?')).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".task-card").filter({ hasText: "Archive me" })).toHaveCount(0);

  await page.goto("/archive");
  await expect(page.getByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
  const archived = card(page, "Archive me");
  await expect(archived).toBeVisible();

  await archived.getByRole("button", { name: "Restore" }).click();
  await expect(page.locator(".task-card").filter({ hasText: "Archive me" })).toHaveCount(0);
  await expect(page.getByText("No archived tasks.")).toBeVisible();

  await page.goto("/");
  await expect(card(section(page, "Today"), "Archive me")).toBeVisible();
});

test("logging out redirects to /login and Back does not reveal an authenticated page", async ({ page }) => {
  await registerFreshUser(page);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log Out" })).toHaveCount(0);
});
