import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../client/src/js/database.js";

test("فائض وردية الكاشير لا يُضاف إلا بموافقة المدير", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "م", businessType: "بقالة", currency: "YER", openingCash: 0 });
  const cashier = await db.createAccount({ username: "cashier-one", name: "كاشير", role: "cashier", pin: "1111", monthlySalary: 1000 });
  const product = await db.createProduct({ name: "منتج", unit: "حبة", purchasePrice: 30, salePrice: 100, quantity: 5, minimumStock: 0 });
  const shift = await db.startCashierShift({ accountId: cashier.id, accountName: cashier.name, receivedCash: 0 });
  await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 100, paymentMethod: "نقدي", cashierShiftId: shift.id, cashierId: cashier.id, cashierName: cashier.name });
  const closed = await db.closeCashierShift({ shiftId: shift.id, countedCash: 125 });
  assert.equal(closed.difference, 25, "فائض 25");

  const t = await db.transferCashierShiftToVault({ shiftId: closed.id, transferredByAccountId: "admin" });
  assert.equal(t.surplusApprovalStatus, "PENDING");
  let moves = await db.listCashMovements();
  assert.equal(moves.filter((m) => m.sourceType === "CASHIER_SURPLUS").length, 0, "لا حركة فائض قبل الموافقة");

  let stats = (await db.listCashierShiftStatistics()).find((r) => r.accountId === cashier.id);
  assert.equal(stats.pendingSurpluses, 25);
  assert.equal(stats.netDifference, 0, "الصافي لا يشمل فائضًا غير معتمد");

  const pending = await db.listPendingCashierSurpluses();
  assert.equal(pending.length, 1);

  const approved = await db.resolveCashierSurplus({ shiftId: closed.id, decision: "APPROVED", approvedByAccountId: "admin" });
  assert.equal(approved.surplusApprovalStatus, "APPROVED");
  moves = await db.listCashMovements();
  assert.equal(moves.filter((m) => m.sourceType === "CASHIER_SURPLUS").length, 1, "حركة واحدة بعد الاعتماد");
  stats = (await db.listCashierShiftStatistics()).find((r) => r.accountId === cashier.id);
  assert.equal(stats.netDifference, 25);
  await assert.rejects(() => db.resolveCashierSurplus({ shiftId: closed.id, decision: "APPROVED" }), /بانتظار موافقة/);
  await db.resetAllData();
});

test("رفض الفائض لا يضيفه لأي حساب حتى مع وجود عجز سابق", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "م", businessType: "بقالة", currency: "YER", openingCash: 0 });
  const cashier = await db.createAccount({ username: "cashier-two", name: "كاشير2", role: "cashier", pin: "2222", monthlySalary: 1000 });
  const product = await db.createProduct({ name: "منتج2", unit: "حبة", purchasePrice: 10, salePrice: 50, quantity: 9, minimumStock: 0 });

  const s1 = await db.startCashierShift({ accountId: cashier.id, accountName: cashier.name, receivedCash: 0 });
  await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 50, paymentMethod: "نقدي", cashierShiftId: s1.id, cashierId: cashier.id, cashierName: cashier.name });
  const c1 = await db.closeCashierShift({ shiftId: s1.id, countedCash: 40 });
  assert.equal(c1.difference, -10);
  await db.transferCashierShiftToVault({ shiftId: c1.id });

  const s2 = await db.startCashierShift({ accountId: cashier.id, accountName: cashier.name, receivedCash: 0 });
  await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 50, paymentMethod: "نقدي", cashierShiftId: s2.id, cashierId: cashier.id, cashierName: cashier.name });
  const c2 = await db.closeCashierShift({ shiftId: s2.id, countedCash: 70 });
  assert.equal(c2.difference, 20, "فائض 20 مع وجود عجز سابق 10");
  await db.transferCashierShiftToVault({ shiftId: c2.id });

  let stats = (await db.listCashierShiftStatistics()).find((r) => r.accountId === cashier.id);
  assert.equal(stats.shortages, 10);
  assert.equal(stats.pendingSurpluses, 20, "الفائض معلق ولم يقاصّ العجز تلقائيًا");
  assert.equal(stats.pendingShortages, 10, "العجز ما زال قائمًا للخصم");

  await db.resolveCashierSurplus({ shiftId: c2.id, decision: "REJECTED", approvedByAccountId: "admin" });
  const moves = await db.listCashMovements();
  assert.equal(moves.filter((m) => m.sourceType === "CASHIER_SURPLUS").length, 0, "الرفض لا ينشئ أي حركة");
  stats = (await db.listCashierShiftStatistics()).find((r) => r.accountId === cashier.id);
  assert.equal(stats.rejectedSurpluses, 20);
  assert.equal(stats.pendingShortages, 10, "العجز السابق لم يتأثر");
  await db.resetAllData();
});
