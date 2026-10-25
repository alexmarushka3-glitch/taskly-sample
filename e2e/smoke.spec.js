import { expect, test } from "@playwright/test";

test("add, complete and delete a task", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No tasks yet.")).toBeVisible();

  await page.getByLabel("New task").fill("buy milk");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("listitem")).toContainText("buy milk");

  await page.getByLabel("Done: buy milk").check();
  await expect(page.getByLabel("Done: buy milk")).toBeChecked();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No tasks yet.")).toBeVisible();
});
