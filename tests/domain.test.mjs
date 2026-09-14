import test from "node:test";
import assert from "node:assert/strict";
import { adjustmentDelta, calculateCashBalance, calculateDiscountAmount, calculatePackagePurchase, calculateProfit, calculatePurchaseTotals, calculateSaleTotals, calculateTransferCollections, canRegisterPayment, canReturn, canSell, expiryProgress, invoiceNumber, paymentStatus, purchaseNumber, remainingAmount, stockStatus } from "../client/src/js/domain.js";
import { CURRENCIES, DEFAULT_CURRENCY_CODE } from "../client/src/js/constants.js";

test("ينشئ تسلسل أرقام فواتير ثابتًا وغير مكرر", () => {
  assert.equal(invoiceNumber(1), "INV-000001");
  assert.equal(invoiceNumber(23), "INV-000023");
});

test("يمنع البيع فوق الكمية المتاحة", () => {
  assert.equal(canSell(18, 2), true);
  assert.equal(canSell(18, 25), false);
  assert.equal(canSell(0, 1), false);
});

test("يحسب خصم المخزون في حركة التعديل", () => {
  assert.equal(adjustmentDelta(20, 18), -2);
  assert.equal(adjustmentDelta(18, 15), -3);
});

test("يحدد حالات المخزون وفق قواعد التطبيق", () => {
  assert.equal(stockStatus(0, 5), "نافد");
  assert.equal(stockStatus(5, 5), "منخفض");
  assert.equal(stockStatus(6, 5), "متوفر");
});

test("يحسب الخصم العام وخصم السطر بالمبلغ أو النسبة دون تجاوز الإجمالي", () => {
  assert.equal(calculateDiscountAmount("20%", 500), 100);
  assert.equal(calculateDiscountAmount("20٪", 500), 100);
  assert.deepEqual(calculateSaleTotals([{ unitPrice: 150, quantity: 2 }], 30), { subtotal: 300, lineDiscount: 0, generalDiscount: 30, discount: 30, total: 270, lines: [{ unitPrice: 150, quantity: 2, lineSubtotal: 300, discount: 0, total: 300 }] });
  assert.deepEqual(calculateSaleTotals([{ unitPrice: 100, quantity: 2, discount: "10%" }], "20%"), { subtotal: 200, lineDiscount: 20, generalDiscount: 36, discount: 56, total: 144, lines: [{ unitPrice: 100, quantity: 2, discount: "10%", lineSubtotal: 200, discount: 20, total: 180 }] });
  assert.deepEqual(calculateSaleTotals([{ unitPrice: 10, quantity: 1 }], 100), { subtotal: 10, lineDiscount: 0, generalDiscount: 10, discount: 10, total: 0, lines: [{ unitPrice: 10, quantity: 1, lineSubtotal: 10, discount: 0, total: 10 }] });
});

test("يضبط الريال اليمني كعملة افتراضية للمحل الجديد", () => {
  assert.equal(DEFAULT_CURRENCY_CODE, "YER");
  assert.deepEqual(CURRENCIES[0], { code: "YER", label: "ريال يمني (ر.ي)", symbol: "ر.ي" });
});

test("ينشئ أرقام فواتير شراء ثابتة وغير مكررة", () => {
  assert.equal(purchaseNumber(1), "PUR-000001");
  assert.equal(purchaseNumber(24), "PUR-000024");
});

test("يمنع كمية مرتجع تتجاوز الكمية الأصلية بعد المرتجعات السابقة", () => {
  assert.equal(canReturn(10, 3, 7), true);
  assert.equal(canReturn(10, 3, 8), false);
  assert.equal(canReturn(10, 3, 0), false);
});

test("يفصل صافي الربح عن المبيعات ويخصم تكلفة البضاعة والمصروفات", () => {
  assert.deepEqual(calculateProfit({ sales: 300, costOfGoods: 200, expenses: 40 }), { netSales: 300, netCostOfGoods: 200, grossProfit: 100, netProfit: 60 });
  assert.deepEqual(calculateProfit({ sales: 300, salesReturns: 30, costOfGoods: 200, returnCosts: 20, expenses: 10 }), { netSales: 270, netCostOfGoods: 180, grossProfit: 90, netProfit: 80 });
});

test("يحسم الرصيد وحالة الدفع للفاتورة الآجلة والدفعة الجزئية", () => {
  assert.equal(remainingAmount(100000, 0), 100000);
  assert.equal(remainingAmount(100000, 30000), 70000);
  assert.equal(paymentStatus(100000, 0), "غير مدفوعة");
  assert.equal(paymentStatus(100000, 30000), "مدفوعة جزئيًا");
  assert.equal(paymentStatus(100000, 100000), "مدفوعة");
});

test("يرفض الدفعة الصفرية أو الأعلى من رصيد العميل", () => {
  assert.equal(canRegisterPayment(40000, 30000), true);
  assert.equal(canRegisterPayment(40000, 0), false);
  assert.equal(canRegisterPayment(40000, 50000), false);
});

test("يحسب الصندوق من الحركات النقدية الفعلية دون اعتبار الديون تحصيلًا", () => {
  assert.deepEqual(calculateCashBalance({ openingBalance: 100000, cashSales: 50000, customerPayments: 40000, cashPurchases: 30000, supplierPayments: 20000, expenses: 10000 }), { inflows: 190000, outflows: 60000, closingBalance: 130000 });
});

test("يلخص التحويلات دون خلطها بالصندوق النقدي أو الفواتير الكاش", () => {
  const result = calculateTransferCollections({
    sales: [{ paymentMethod: "تحويل", initialPaidAmount: 75 }, { paymentMethod: "نقدي", initialPaidAmount: 100 }, { paymentMethod: "تحويل", paidAmount: 25 }],
    customerPayments: [{ paymentMethod: "تحويل", amount: 40 }, { paymentMethod: "نقدي", amount: 80 }],
  });
  assert.deepEqual(result, { salesAmount: 100, debtPaymentsAmount: 40, total: 140, count: 3 });
});

test("يحوّل الكرتون إلى حبات ويحسب سعر الحبة وإجمالي الشراء من سعر العبوة", () => {
  const carton = calculatePackagePurchase({ packageQuantity: 3, unitsPerPackage: 24, packageCost: 1200 });
  assert.deepEqual(carton, { packageQuantity: 3, unitsPerPackage: 24, packageCost: 1200, quantity: 72, unitCost: 50, total: 3600 });
  assert.equal(calculatePurchaseTotals([carton]), 3600);
});

test("يحسب نسبة استهلاك الصلاحية للمنتجات قصيرة الأمد", () => {
  const progress = expiryProgress({ productionDate: "2026-09-01", expiryDate: "2026-10-01", today: "2026-09-27" });
  assert.equal(progress.totalDays, 30);
  assert.equal(progress.elapsedDays, 26);
  assert.equal(progress.ratio, 26 / 30);
  assert.ok(progress.ratio >= 0.85);
});
