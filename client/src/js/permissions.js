export const CASHIER_CONFIGURABLE_PERMISSIONS = [
  { id: "sales", label: "المبيعات والفوترة", description: "تسجيل فواتير البيع ونقطة البيع ومسح الباركود", icon: "cart", default: true },
  { id: "invoices", label: "فواتير المبيعات", description: "مراجعة وطباعة فواتير البيع ومشاركتها", icon: "receipt", default: true },
  { id: "products", label: "المنتجات والأسعار", description: "الاطلاع على قائمة المنتجات وأسعار البيع", icon: "package", default: false },
  { id: "inventory", label: "المخزون والكميات", description: "الاطلاع على كميات المخزون وتواريخ الصلاحية", icon: "layers", default: false },
  { id: "purchases", label: "المشتريات والتوريد", description: "تسجيل فواتير الشراء وتوريد البضاعة", icon: "truck", default: false },
  { id: "customers", label: "العملاء والديون", description: "الاطلاع على قائمة العملاء وحساباتهم والديون", icon: "users", default: false },
  { id: "suppliers", label: "الموردون وبياناتهم", description: "الاطلاع على بيانات الموردين والتواصل معهم", icon: "truck", default: false },
  { id: "cashbox", label: "الصندوق وحركة النقد", description: "الاطلاع على رصيد الصندوق واستلام الوردية", icon: "wallet", default: false },
  { id: "reports", label: "التقارير المالية", description: "الاطلاع على التقارير المالية والتشغيلية", icon: "chart", default: false },
];

export const DEFAULT_CASHIER_ALLOWED_VIEWS = ["sales", "invoices"];

export const ADMIN_ACTIONS = new Set([
  "new-product", "open-product", "adjust-stock", "count-stock", "delete-customer", "record-customer-payment", "delete-supplier", "new-supplier-payment", "record-supplier-payment", "purchase-return", "sale-return", "new-expense", "new-cashier-salary-advance", "edit-expense", "delete-expense", "open-stock-history", "open-reorder-list", "new-cash-deposit", "new-cash-withdrawal", "deposit-incoming-transfer", "transfer-cashier-shift", "approve-cashier-surplus", "reject-cashier-surplus", "deduct-cashier-shortages", "save-periodic-inventory", "open-periodic-inventory", "clear-store-logo", "export-backup", "open-cloud-auth", "cloud-upload-backup", "cloud-refresh-backups", "cloud-restore-backup", "cloud-delete-backup", "cloud-signout", "export-report", "reset-data", "new-account", "open-account", "reset-account-pin", "delete-cashier-account", "settle-staff-salary", "move-mobile-nav", "reset-mobile-nav", "enable-notifications", "toggle-notifications-enabled", "reset-notification-history",
]);

export const isAdmin = (user) => user?.role === "admin";

export const normalizeEffectiveView = (view) => {
  if (view === "customer-payments") return "customers";
  if (view === "supplier-payments") return "suppliers";
  if (view === "transfers") return "cashbox";
  return view;
};

export const canAccessView = (user, view) => {
  if (!user) return false;
  if (isAdmin(user)) return true;

  const effectiveView = normalizeEffectiveView(view);

  const strictlyAdminViews = new Set([
    "dashboard", "settings", "general-settings", "brand-settings",
    "navigation-settings", "data-management", "accounts", "periodic-inventory", "activity-log"
  ]);
  if (strictlyAdminViews.has(effectiveView)) return false;

  const allowedViews = Array.isArray(user.allowedViews)
    ? user.allowedViews
    : DEFAULT_CASHIER_ALLOWED_VIEWS;

  return allowedViews.includes(effectiveView);
};

export const canUseAction = (user, action, { mode = "" } = {}) =>
  Boolean(user) && (isAdmin(user) || (!ADMIN_ACTIONS.has(action) && !(action === "open-scanner" && mode === "product")));
