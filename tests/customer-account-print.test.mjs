import test from "node:test";
import assert from "node:assert/strict";
import { renderCustomerAccountHtml } from "../client/src/js/customer-account-print.js";

test("ينشئ كشف حساب العميل تفاصيل المديونية والعمليات في مستند قابل للطباعة", () => {
  const html = renderCustomerAccountHtml({
    account: { customer: { name: "أحمد <الاختبار>", phone: "777000000" }, totalSales: 200, totalPaid: 50, balance: 150, transactions: [{ type: "CREDIT_SALE", typeLabel: "بيع آجل", date: "2026-08-23T10:00:00.000Z", invoiceNumber: "INV-000010", amount: 200, remainingAmount: 200 }, { type: "PAYMENT", typeLabel: "دفعة عميل", date: "2026-08-23T11:00:00.000Z", invoiceNumber: "", amount: 50, remainingAmount: 150 }] },
    storeName: "حسابي",
    formatMoney: (value) => `${value} ر.ي`,
    formatDateTime: () => "23 أغسطس 2026",
    escapeHtml: (value) => String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  });
  assert.match(html, /كشف حساب مديونية عميل/);
  assert.match(html, /أحمد &lt;الاختبار&gt;/);
  assert.match(html, /INV-000010/);
  assert.match(html, /الرصيد المستحق/);
  assert.match(html, /150 ر\.ي/);
});
