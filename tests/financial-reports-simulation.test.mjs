import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { db } from "../client/src/js/database.js";

test("محاكاة مالية: التقارير تجمع البيع والشراء والمصروفات والديون وحركة الصندوق", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر المحاكاة", openingCash: 1000, businessType: "متجر عام", currency: "YER" });
  const product = await db.createProduct({ name: "منتج محاكاة", unit: "حبة", purchasePrice: 40, salePrice: 100, quantity: 20, minimumStock: 1 });
  const customer = await db.createCustomer({ name: "عميل المحاكاة", phone: "777000000" });
  const supplier = await db.createSupplier({ name: "مورد المحاكاة" });
  const cashSale = await db.completeSale({ items: [{ productId: product.id, quantity: 2 }], discount: 10, paidAmount: 190, paymentMethod: "نقدي", paymentType: "نقدي" });
  const creditSale = await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 0, paymentMethod: "نقدي", paymentType: "آجل", customerId: customer.id });
  await db.registerCustomerPayment({ customerId: customer.id, amount: 50, paymentMethod: "نقدي" });
  await db.createPurchase({ supplierId: supplier.id, items: [{ productId: product.id, quantity: 5, unitCost: 40, packageQuantity: 5, unitsPerPackage: 1, packageCost: 40, salePrice: 100 }], paymentType: "نقدي", paidAmount: 200, paymentMethod: "نقدي" });
  await db.createExpense({ amount: 30, category: "كهرباء", description: "محاكاة مصروف", date: "2026-08-23", periodType: "daily" });
  await db.createCashMovement({ type: "DEPOSIT", amount: 100, date: "2026-08-23", notes: "إيداع محاكاة" });
  await db.createCashMovement({ type: "WITHDRAWAL", amount: 20, date: "2026-08-23", notes: "سحب محاكاة" });

  const analytics = await db.getAnalytics({ from: "2026-01-01", to: "2026-12-31" });
  assert.equal(analytics.sales.invoices, 2);
  assert.equal(analytics.sales.total, cashSale.total + creditSale.total);
  assert.equal(analytics.sales.returns, 0);
  assert.equal(analytics.purchases.total, 200);
  assert.equal(analytics.expenses.total, 30);
  assert.equal(analytics.profit.netSales, analytics.sales.total);
  assert.equal(analytics.profit.netProfit, analytics.profit.grossProfit - analytics.expenses.total);
  assert.equal(analytics.expenses.byCategory.كهرباء, 30);
  const cashbox = await db.getCashbox({ from: "2026-01-01", to: "2026-12-31" });
  assert.equal(cashbox.inflows, 1340);
  assert.equal(cashbox.outflows, 250);
  assert.equal(cashbox.closingBalance, 1090);

  const [app, pdf] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/pdf-export.js", import.meta.url), "utf8"),
  ]);
  for (const label of ["تقرير تحليلي شامل لحركة الصندوق", "قائمة الدخل", "المركز المالي", "ميزان المراجعة", "إجمالي الوارد", "إجمالي الصادر", "الرصيد الختامي"]) assert.match(app, new RegExp(label));
  for (const label of ["drawReportCanvas", "drawStoreLogo", "صفحة", "HesabiArabicPdf"]) assert.match(pdf, new RegExp(label));
  await db.resetAllData();
});
