import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canAccessView,
  DEFAULT_CASHIER_ALLOWED_VIEWS,
  CASHIER_CONFIGURABLE_PERMISSIONS
} from "../client/src/js/permissions.js";

test("سجل التدقيق والأمان مقيّد بالأدمن فقط ولا يظهر للكاشير افتراضيًا", () => {
  const admin = { id: "admin-1", role: "admin", name: "المدير" };
  const cashierDefault = { id: "cashier-1", role: "cashier", name: "كاشير 1", allowedViews: DEFAULT_CASHIER_ALLOWED_VIEWS };

  assert.equal(canAccessView(admin, "activity-log"), true);
  assert.equal(canAccessView(cashierDefault, "activity-log"), false);
});

test("تتضمن قائمة الصلاحيات القابلة للتخصيص للكاشير الشاشات الأساسية والمحاسبية", () => {
  const ids = CASHIER_CONFIGURABLE_PERMISSIONS.map((p) => p.id);
  assert.ok(ids.includes("sales"));
  assert.ok(ids.includes("invoices"));
  assert.ok(ids.includes("customers"));
  assert.ok(ids.includes("products"));
  assert.ok(ids.includes("inventory"));
  assert.ok(ids.includes("cashbox"));
});

test("يحتوي ملف قاعدة البيانات على دوال تسجيل واسترجاع العمليات وسجل الأمان والمؤشرات الذكية", async () => {
  const dbSource = await readFile("client/src/js/database.js", "utf8");
  
  assert.ok(dbSource.includes("async function logActivity(") || dbSource.includes("async logActivity("), "يجب وجود دالة logActivity");
  assert.ok(dbSource.includes("async function listActivityLogs(") || dbSource.includes("async listActivityLogs("), "يجب وجود دالة listActivityLogs");
  assert.ok(dbSource.includes("topByVolume"), "يجب وجود topByVolume في المؤشرات الذكية");
  assert.ok(dbSource.includes("topByProfit"), "يجب وجود topByProfit في المؤشرات الذكية");
  assert.ok(dbSource.includes("hourlyDistribution"), "يجب وجود hourlyDistribution في المؤشرات الذكية");
  assert.ok(dbSource.includes("deadStock"), "يجب وجود deadStock في المؤشرات الذكية");
});

test("تتضمن الواجهة عناصر القفل السريع وتذكير واتساب وتاريخ الاستحقاق وسندات القبض", async () => {
  const appSource = await readFile("client/src/js/app.js", "utf8");

  assert.ok(appSource.includes("openScreenLockDialog"), "يجب توفر نافذة قفل الشاشة السريع");
  assert.ok(appSource.includes("generateDebtReminderMessage"), "يجب توفر مولد رسائل التذكير بالديون");
  assert.ok(appSource.includes("generateInvoiceWhatsAppMessage"), "يجب توفر مولد رسائل الفاتورة عبر واتساب");
  assert.ok(appSource.includes("credit-due-date-field"), "يجب توفر حقل تاريخ الاستحقاق في البيع الآجل");
  assert.ok(appSource.includes("due-preset-chips"), "يجب توفر أزرار الأجل السريع +7 +15 +30");
  assert.ok(appSource.includes("openSupplierPaymentReceipt"), "يجب توفر سند دفعة المورد مع زر واتساب");
  assert.ok(appSource.includes("openPaymentReceipt"), "يجب توفر سند قبض العميل مع زر واتساب");
  assert.ok(appSource.includes("activityLogMarkup"), "يجب توفر واجهة سجل النشاطات والأمان");
  assert.ok(appSource.includes("smartTopMoversMarkup"), "يجب توفر رسم وتصنيف الأصناف الأكثر مبيعًا");
  assert.ok(appSource.includes("smartHourlyPeakMarkup"), "يجب توفر توزيع ساعات الذروة");
  assert.ok(appSource.includes("smartDeadStockMarkup"), "يجب توفر رصد الركود ورأس المال المجمد");
});

test("تتضمن ملفات الأنماط CSS تنسيقات التحليلات وسجل العمليات وسندات الدفع والوضع الداكن", async () => {
  const cssSource = await readFile("client/src/style.css", "utf8");

  assert.ok(cssSource.includes(".smart-analytics-grid"), "تنسيق شبكة المؤشرات الذكية");
  assert.ok(cssSource.includes(".hourly-chart-container"), "تنسيق مخطط ساعات الذروة");
  assert.ok(cssSource.includes(".activity-log-table"), "تنسيق جدول سجل النشاطات");
  assert.ok(cssSource.includes(".activity-badge--sale"), "شارات أنواع العمليات");
  assert.ok(cssSource.includes(".due-preset-chips"), "تنسيق أزرار تحديد الأجل");
  assert.ok(cssSource.includes(".lock-dialog-card"), "تنسيق بطاقة قفل الشاشة");
  assert.ok(cssSource.includes(".payment-receipt__badge"), "تنسيق سندات القبض والصرف");
});
