import { test, expect } from "@playwright/test";
// Imported by Playwright through the matching config; no app server or database backend needed.
const base = "http://127.0.0.1:8000/";
async function demo(page) {
  await page.goto(base + "login.html");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex." }),
  ).toBeVisible();
}
async function staff(page) {
  await page.route("**/js/demo.js", async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace(/role:\s*["']player["']/, 'role: "administrator"');
    await route.fulfill({ response: res, body });
  });
  await demo(page);
}
test("protected routes, membership form and demo entry", async ({ page }) => {
  await page.goto(base + "schedule.html");
  await expect(page).toHaveURL(/login.html/);
  await page
    .getByRole("button", { name: "Request membership", exact: true })
    .click();
  await expect(page.locator("[name=display_name]")).toBeVisible();
  await page.getByRole("button", { name: "Already a member? Sign in" }).click();
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Alex." }),
  ).toBeVisible();
});
test("calendar navigation, filters, details and attendance persistence", async ({
  page,
}) => {
  await demo(page);
  await page.goto(base + "schedule.html");
  await page.getByRole("button", { name: "Tuesday rugby training" }).click();
  await page.getByRole("button", { name: "attending", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "attending", exact: true }),
  ).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".schedule-item")).toHaveCount(5);
  await page.locator("#type-filter").selectOption("match");
  await expect(page.locator(".schedule-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Next period" }).click();
  await expect(
    page.getByText("No sessions this week. Try another date or filter."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.locator("#type-filter").selectOption("");
  await page.reload();
  await page.getByRole("button", { name: "Tuesday rugby training" }).click();
  await expect(
    page.getByRole("button", { name: "attending", exact: true }),
  ).toHaveClass(/selected/);
});
test("workout drafts, completion, saved progress and exercise history", async ({
  page,
}) => {
  await demo(page);
  await page.goto(base + "programmes.html");
  await page.getByRole("button", { name: "View programme" }).first().click();
  await page.getByRole("button", { name: "Start / resume workout" }).click();
  await page.locator(".weight").first().fill("60");
  await page.locator(".reps").first().fill("6");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await page.getByRole("button", { name: "View programme" }).first().click();
  await page.getByRole("button", { name: "Start / resume workout" }).click();
  await expect(page.locator(".weight").first()).toHaveValue("60");
  await page.locator("[name=complete]").check();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await page.getByRole("button", { name: "View programme" }).first().click();
  await page
    .getByRole("button", { name: "Workout history", exact: true })
    .click();
  await expect(page.locator(".history-table")).toContainText("60 kg × 6");
  await page.goto(base + "dashboard.html");
  await expect(page.locator(".stat-value").last()).toHaveText("33%");
  await page.goto(base + "programmes.html");
  await page.getByRole("tab", { name: "On-Field Training" }).click();
  await page.getByRole("button", { name: "View programme" }).click();
  await expect(
    page.getByText("10 m acceleration", { exact: true }),
  ).toBeVisible();
});
test("bulletin safe rendering, search, edit, expiry and delete confirmation", async ({
  page,
}) => {
  await demo(page);
  await page.goto(base + "bulletin.html");
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  await page.locator("[name=title]").fill("Team test");
  await page
    .locator("[name=message]")
    .fill("<img src=x onerror=alert(1)> Training together");
  await page.getByRole("button", { name: "Publish post" }).click();
  await expect(
    page.getByRole("heading", { name: "Team test", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".post-card")
      .filter({
        has: page.getByRole("heading", { name: "Team test", exact: true }),
      })
      .locator(".post-message"),
  ).toContainText("<img");
  await expect(page.locator(".post-message img")).toHaveCount(0);
  await page.reload();
  await page.locator("#post-search").fill("Team test");
  await expect(page.locator(".post-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit Team test" }).click();
  await page.locator("[name=title]").fill("Updated team test");
  await page.getByRole("button", { name: "Save post", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Updated team test" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete Updated team test" }).click();
  await expect(
    page.getByRole("heading", { name: "Updated team test" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Updated team test" }).click();
  await expect(page.locator(".post-card")).toHaveCount(0);
});
test("administrator session, programme, library, assignment and member workflows", async ({
  page,
}) => {
  await staff(page);
  await page.goto(base + "schedule.html");
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  await page.locator("[name=title]").fill("Coaching test");
  await page.locator("[name=location]").fill("Test pitch");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Coaching test" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Coaching test" }).click();
  await page.getByRole("button", { name: "Edit / reschedule" }).click();
  await page.locator("[name=start]").fill("18:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Coaching test" }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Cancel session", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancelled · Coaching test" }).click();
  await expect(page.locator(".badge.cancelled")).toBeVisible();
  await page.goto(base + "programmes.html");
  await page.getByRole("button", { name: "Drill / exercise library" }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.locator("[name=name]").fill("Test press");
  await page.locator("[name=instructions]").fill("Control the movement.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Create programme" }).click();
  await page.locator("[name=title]").fill("Test programme");
  await page.locator("[name=objective]").fill("Build strength");
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test programme", exact: true }),
  ).toBeVisible();
  await page
    .locator(".programme-card")
    .filter({
      has: page.getByRole("heading", { name: "Test programme", exact: true }),
    })
    .getByRole("button", { name: "View programme" })
    .click();
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .locator(".programme-card")
    .filter({
      has: page.getByRole("heading", { name: "Test programme", exact: true }),
    })
    .getByRole("button", { name: "View programme" })
    .click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test programme (copy)", exact: true }),
  ).toBeVisible();
  await page.goto(base + "admin.html");
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await page.locator("[name=name]").fill("Test senior team");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Test senior team", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Manage", exact: true })
    .first()
    .click();
  await expect(page.locator("[name=role]")).toBeVisible();
});
test("phone navigation, no page overflow, theme and all pages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await expect(page.locator("body")).not.toHaveClass(/light/);
  await page.getByRole("button", { name: "Toggle light or dark mode" }).click();
  await expect(page.locator("body")).toHaveClass(/light/);
  for (const target of ["dashboard", "schedule", "programmes", "bulletin"]) {
    await page.goto(base + target + ".html");
    await expect(page.locator(".page-heading")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.locator("#sidebar")).toHaveClass(/open/);
    await page.keyboard.press("Escape");
    await expect(page.locator("#sidebar")).not.toHaveClass(/open/);
  }
  await page.screenshot({ path: "/tmp/mackie-mobile.png", fullPage: true });
});
test("all main pages load without JavaScript or HTTP failures", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await demo(page);
  for (const target of ["dashboard", "schedule", "programmes", "bulletin"]) {
    await page.goto(base + target + ".html");
    await expect(page.locator(".page-heading")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("configured auth adapter signs in, refreshes, checks approval and signs out", async ({
  page,
}) => {
  const calls = [];
  await page.route("**/js/config.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export const config={supabaseUrl:"https://mackie-test.supabase.co",supabaseAnonKey:"sb_publishable_test",timeZone:"Europe/London"};',
    }),
  );
  const user = {
    id: "00000000-0000-4000-a000-000000000003",
    email: "player@example.org",
  };
  await page.route("https://mackie-test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    calls.push({
      url: req.url(),
      headers: req.headers(),
      body: req.postDataJSON(),
    });
    let result = [];
    if (url.pathname === "/auth/v1/token")
      result = {
        access_token:
          url.searchParams.get("grant_type") === "refresh_token"
            ? "refreshed-token"
            : "first-token",
        refresh_token: "refresh-token",
        expires_in:
          url.searchParams.get("grant_type") === "refresh_token" ? 3600 : 1,
        user,
      };
    else if (url.pathname === "/rest/v1/profiles")
      result = [
        {
          id: user.id,
          display_name: "Live Test Player",
          role: "player",
          approved: true,
        },
      ];
    else if (url.pathname === "/auth/v1/logout") result = {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto(base + "login.html");
  await page.locator("[name=email]").fill(user.email);
  await page.locator("[name=password]").fill("example-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Live." }),
  ).toBeVisible();
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  expect(
    calls.some((c) => c.url.includes("grant_type=refresh_token")),
  ).toBeTruthy();
  expect(
    calls.find((c) => c.url.includes("/rest/v1/profiles")).headers
      .authorization,
  ).toBe("Bearer refreshed-token");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login.html/);
  expect(
    await page.evaluate(() => sessionStorage.getItem("mackie-session")),
  ).toBeNull();
});

test("configured pending member cannot enter the hub", async ({ page }) => {
  await page.route("**/js/config.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export const config={supabaseUrl:"https://mackie-test.supabase.co",supabaseAnonKey:"sb_publishable_test",timeZone:"Europe/London"};',
    }),
  );
  await page.route("https://mackie-test.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const result =
      path === "/auth/v1/token"
        ? {
            access_token: "pending-token",
            refresh_token: "refresh",
            expires_in: 3600,
            user: { id: "pending-id" },
          }
        : [
            {
              id: "pending-id",
              display_name: "Pending Member",
              role: "player",
              approved: false,
            },
          ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto(base + "login.html");
  await page.locator("[name=email]").fill("pending@example.org");
  await page.locator("[name=password]").fill("example-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/login.html\?pending=1/);
  await expect(page.locator("#auth-message")).toContainText(
    "awaiting administrator approval",
  );
});
