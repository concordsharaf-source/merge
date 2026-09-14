import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { calculateMonthlyExpenseAllocation } from "../client/src/js/domain.js";

test("يوزع المصروف الشهري على الأيام الواقعة ضمن الفترة فقط", () => {
  assert.equal(calculateMonthlyExpenseAllocation({ amount: 280, date: "2026-02-01", from: "2026-02-10", to: "2026-02-19" }), 100);
  assert.equal(calculateMonthlyExpenseAllocation({ amount: 300, date: "2026-04-01", from: "2026-04-01", to: "2026-04-30" }), 300);
  assert.equal(calculateMonthlyExpenseAllocation({ amount: 300, date: "2026-04-01", from: "2026-05-01", to: "2026-05-10" }), 0);
});

test("تجمع التحليلات حصة المصروف الشهري والمصروف اليومي دون تكرار", async () => {
  globalThis.indexedDB = indexedDB;
  globalThis.IDBKeyRange = IDBKeyRange;
  const { db } = await import("../client/src/js/database.js");
  await db.resetAllData();
  await db.createExpense({ amount: 300, periodType: "monthly", category: "إيجار", date: "2026-04-01" });
  await db.createExpense({ amount: 25, periodType: "daily", category: "أكل وشرب", date: "2026-04-10" });
  const tenDays = await db.getAnalytics({ from: "2026-04-10", to: "2026-04-19" });
  assert.equal(tenDays.expenses.total, 125);
  assert.equal(tenDays.expenses.byCategory["إيجار"], 100);
  assert.equal(tenDays.expenses.byCategory["أكل وشرب"], 25);
  const wholeMonth = await db.getAnalytics({ from: "2026-04-01", to: "2026-04-30" });
  assert.equal(wholeMonth.expenses.total, 325);
  await db.resetAllData();
});
