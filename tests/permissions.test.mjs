import test from "node:test";
import assert from "node:assert/strict";
import {
  CASHIER_CONFIGURABLE_PERMISSIONS,
  DEFAULT_CASHIER_ALLOWED_VIEWS,
  canAccessView,
  canUseAction,
  isAdmin,
} from "../client/src/js/permissions.js";

const admin = { role: "admin" };
const defaultCashier = { role: "cashier" };

test("يصل الأدمن إلى الشاشات الإدارية والمالية وكافة الأقسام", () => {
  assert.equal(isAdmin(admin), true);
  assert.equal(canAccessView(admin, "dashboard"), true);
  assert.equal(canAccessView(admin, "sales"), true);
  assert.equal(canAccessView(admin, "invoices"), true);
  assert.equal(canAccessView(admin, "products"), true);
  assert.equal(canAccessView(admin, "inventory"), true);
  assert.equal(canAccessView(admin, "purchases"), true);
  assert.equal(canAccessView(admin, "customers"), true);
  assert.equal(canAccessView(admin, "suppliers"), true);
  assert.equal(canAccessView(admin, "cashbox"), true);
  assert.equal(canAccessView(admin, "reports"), true);
  assert.equal(canAccessView(admin, "settings"), true);
  assert.equal(canAccessView(admin, "accounts"), true);
  assert.equal(canAccessView(admin, "periodic-inventory"), true);
});

test("يقتصر الكاشير الافتراضي على المبيعات وفواتيرها فقط (مبيعات بس)", () => {
  assert.equal(isAdmin(defaultCashier), false);
  assert.deepEqual(DEFAULT_CASHIER_ALLOWED_VIEWS, ["sales", "invoices"]);
  assert.equal(canAccessView(defaultCashier, "sales"), true);
  assert.equal(canAccessView(defaultCashier, "invoices"), true);
  assert.equal(canAccessView(defaultCashier, "products"), false);
  assert.equal(canAccessView(defaultCashier, "inventory"), false);
  assert.equal(canAccessView(defaultCashier, "purchases"), false);
  assert.equal(canAccessView(defaultCashier, "customers"), false);
  assert.equal(canAccessView(defaultCashier, "suppliers"), false);
  assert.equal(canAccessView(defaultCashier, "cashbox"), false);
  assert.equal(canAccessView(defaultCashier, "dashboard"), false);
  assert.equal(canAccessView(defaultCashier, "reports"), false);
  assert.equal(canAccessView(defaultCashier, "settings"), false);
  assert.equal(canAccessView(defaultCashier, "accounts"), false);
  assert.equal(canAccessView(defaultCashier, "periodic-inventory"), false);
  assert.equal(canAccessView(defaultCashier, "general-settings"), false);
  assert.equal(canAccessView(defaultCashier, "brand-settings"), false);
  assert.equal(canAccessView(defaultCashier, "navigation-settings"), false);
});

test("يصل الكاشير المخصص للشاشات التي حددها له الأدمن فقط", () => {
  const customCashier = {
    role: "cashier",
    allowedViews: ["sales", "invoices", "products", "inventory", "customers"],
  };
  assert.equal(canAccessView(customCashier, "sales"), true);
  assert.equal(canAccessView(customCashier, "invoices"), true);
  assert.equal(canAccessView(customCashier, "products"), true);
  assert.equal(canAccessView(customCashier, "inventory"), true);
  assert.equal(canAccessView(customCashier, "customers"), true);
  assert.equal(canAccessView(customCashier, "customer-payments"), true); // alias
  assert.equal(canAccessView(customCashier, "purchases"), false);
  assert.equal(canAccessView(customCashier, "suppliers"), false);
  assert.equal(canAccessView(customCashier, "cashbox"), false);
  assert.equal(canAccessView(customCashier, "dashboard"), false);
  assert.equal(canAccessView(customCashier, "reports"), false);
  assert.equal(canAccessView(customCashier, "settings"), false);
});

test("يتضمن سجل الصلاحيات القابلة للتخصيص للكاشير خيارات واضحة مع إعداداتها الافتراضية", () => {
  assert.ok(Array.isArray(CASHIER_CONFIGURABLE_PERMISSIONS));
  assert.ok(CASHIER_CONFIGURABLE_PERMISSIONS.length >= 8);
  const salesPerm = CASHIER_CONFIGURABLE_PERMISSIONS.find((p) => p.id === "sales");
  const invoicesPerm = CASHIER_CONFIGURABLE_PERMISSIONS.find((p) => p.id === "invoices");
  const reportsPerm = CASHIER_CONFIGURABLE_PERMISSIONS.find((p) => p.id === "reports");
  assert.equal(salesPerm?.default, true);
  assert.equal(invoicesPerm?.default, true);
  assert.equal(reportsPerm?.default, false);
});

test("يقيّد الرفع والاستعادة السحابية بالأدمن فقط", () => {
  const cloudActions = [
    "open-cloud-auth",
    "cloud-upload-backup",
    "cloud-refresh-backups",
    "cloud-restore-backup",
    "cloud-delete-backup",
    "cloud-signout",
  ];
  for (const action of cloudActions) {
    assert.equal(canUseAction(admin, action), true, `admin should use ${action}`);
    assert.equal(canUseAction(defaultCashier, action), false, `cashier should not use ${action}`);
  }
});

test("يمنع الكاشير من إنشاء المنتجات والتقارير وإدارة الحسابات مع السماح بالعمليات التشغيلية", () => {
  assert.equal(canUseAction(defaultCashier, "new-product"), false);
  assert.equal(canUseAction(defaultCashier, "new-purchase"), true);
  assert.equal(canUseAction(defaultCashier, "open-purchase"), true);
  assert.equal(canUseAction(defaultCashier, "new-customer"), true);
  assert.equal(canUseAction(defaultCashier, "open-customer"), true);
  assert.equal(canUseAction(defaultCashier, "edit-customer"), true);
  assert.equal(canUseAction(defaultCashier, "new-supplier"), true);
  assert.equal(canUseAction(defaultCashier, "open-supplier"), true);
  assert.equal(canUseAction(defaultCashier, "open-supplier-account"), true);
  assert.equal(canUseAction(defaultCashier, "export-report"), false);
  assert.equal(canUseAction(defaultCashier, "new-account"), false);
  assert.equal(canUseAction(defaultCashier, "cloud-upload-backup"), false);
  assert.equal(canUseAction(defaultCashier, "cloud-restore-backup"), false);
  assert.equal(canUseAction(defaultCashier, "open-scanner", { mode: "product" }), false);
  assert.equal(canUseAction(defaultCashier, "checkout"), true);
  assert.equal(canUseAction(defaultCashier, "open-invoice"), true);
});

test("يحصر الجرد الدوري واعتماد لقطاته في الأدمن", () => {
  assert.equal(canAccessView(admin, "periodic-inventory"), true);
  assert.equal(canAccessView(defaultCashier, "periodic-inventory"), false);
  assert.equal(canUseAction(admin, "save-periodic-inventory"), true);
  assert.equal(canUseAction(admin, "open-periodic-inventory"), true);
  assert.equal(canUseAction(defaultCashier, "save-periodic-inventory"), false);
  assert.equal(canUseAction(defaultCashier, "open-periodic-inventory"), false);
});
