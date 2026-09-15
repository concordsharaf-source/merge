/* اتجاه التصميم: دفتر التاجر الهادئ — واجهة تشغيل يومية RTL تجعل الإجراء والمعلومة محور كل شاشة. */
/* اتجاه التصميم: دفتر التاجر الهادئ — تفاعلات سريعة، RTL واضح، وماسح منتج لا يقطع سياق النموذج. */
import { ACCOUNT_ROLES, BUSINESS_PROFILES, BUSINESS_TYPES, CURRENCIES, DAILY_EXPENSE_CATEGORIES, DEFAULT_CURRENCY_CODE, EXPENSE_CATEGORIES, MONTHLY_EXPENSE_CATEGORIES, NAV_ITEMS, PACKAGE_UNITS, PAYMENT_METHODS, UNITS } from "./constants.js";
import { db } from "./database.js";
import { calculateDiscountAmount, calculatePackagePurchase, calculateSaleTotals, calculateTransferCollections, dateKey, expiryProgress, normalizeCashierDiscountLimit, nowIso, roundMoney, stockStatus, toNumber } from "./domain.js";
import { deleteCloudBackup, getCloudBackupUser, listCloudBackups, readCloudBackup, registerCloudBackupUser, resetCloudBackupPassword, signInCloudBackupUser, signOutCloudBackupUser, uploadCloudBackup } from "./firebase-backup.js";
import { approveAssistantRequest, createPairingInvite, createStoreWorkspace, getCloudDeviceIdentity, redeemPairingInvite, requestAssistantDevice, revokeCloudDevice, seedWorkspaceBackup, watchAssistantRequests } from "./firebase-sync.js";
import { installSyncCoordinator } from "./sync-coordinator.js";
import { renderThermalInvoiceHtml } from "./invoice-print.js";
import { renderCustomerAccountHtml } from "./customer-account-print.js";
import { renderPurchaseInvoiceHtml } from "./purchase-invoice-print.js";
import { getExitGuardAction, leaveAfterExitConfirmation, primeExitGuardHistory } from "./navigation-guard.js";
import { randomId } from "./ids.js";
import { createPdfFileFromHtml, printHtmlDocument, shareOrDownloadCustomerAccountPdf, shareOrDownloadInvoicePdf, shareOrDownloadPdf, shareOrDownloadPurchaseInvoicePdf } from "./pdf-export.js";
import { CASHIER_CONFIGURABLE_PERMISSIONS, DEFAULT_CASHIER_ALLOWED_VIEWS, canAccessView, canUseAction, isAdmin } from "./permissions.js";
import { shortRandomId } from "./ids.js";
import { createBarcodeWorkbook, createPurchaseWorkbook, parseBarcodeFile } from "./barcode-file.js";
import { createReportWorkbook, reportWorkbookMimeType } from "./report-file.js";
import { APK_REPORT_TYPES, getApkReportRows } from "./apk-report-catalog.js";
import { renderOfficialReportHtml } from "./report-template.js";
import { CAMERA_SCAN_INTERVAL_MS, getCameraAssistOptions, getScannerCameraConstraints, isDesktopBarcodeWedge, isNewContinuousBarcode, shouldAcceptDesktopBarcode, shouldReleaseContinuousBarcode } from "./scanner-session.js";
import { installDesktopIntegration } from "./desktop.js";
import { NOTIFICATION_TOPICS, clearNotificationHistory, enableBackgroundChecks, notificationPermission, notificationSettings, notificationsSupported, publishBackgroundSnapshot, requestNotificationPermission, runAlertChecks, saveNotificationSettings, showAppNotification, subscribeToPush } from "./notifications.js";

const icon = (name, size = 20) => {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    package: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    cart: '<path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 8H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    receipt: '<path d="M5 3h14v18l-2-1.5L15 21l-3-1.5L9 21l-2-1.5L5 21V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>',
    scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8 9v6M11 9v6M14 9v6M17 9v6"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    arrow: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    alert: '<path d="M10.3 3.7 2.5 17.1A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.9L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    trend: '<path d="M3 17 9 11l4 4 8-9"/><path d="M15 6h6v6"/>',
    box: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    truck: '<path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-3M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"/>',
    wallet: '<path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7"/><path d="M16 14h2"/>',
    transfer: '<path d="M4 7h13"/><path d="m13 3 4 4-4 4"/><path d="M20 17H7"/><path d="m11 13-4 4 4 4"/>',
    chart: '<path d="M4 19V5M4 19h16M8 16v-5M12 16V7M16 16v-8"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/><path d="M12 7v5l3 2"/>',
    rotate: '<path d="M21 12a9 9 0 0 0-15.5-6.2L3 8M3 3v5h5M3 12a9 9 0 0 0 15.5 6.2L21 16m0 5v-5h-5"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/><path d="M12 8v4l3 2"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    key: '<circle cx="7.5" cy="15.5" r="3.5"/><path d="m10.3 12.7 8.2-8.2 2.2 2.2-1.7 1.7 1.6 1.6-2 2-1.6-1.6-3.9 3.9"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.11 9.89a16 16 0 0 0 6 6l1.26-1.26a2 2 0 0 1 2.11-.45c.9.35 1.84.59 2.8.72A2 2 0 0 1 22 16.9Z"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
};

const HELD_INVOICES_STORAGE_KEY = "hesabi-held-invoices";
function loadHeldInvoicesFromStorage() {
  try {
    const raw = localStorage.getItem(HELD_INVOICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((held) => held && typeof held === "object") : [];
  } catch {
    return [];
  }
}
function saveHeldInvoicesToStorage(list) {
  try {
    localStorage.setItem(HELD_INVOICES_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (error) {
    console.warn("[Hesabi held invoices storage warning]", error);
    return false;
  }
}
function formatTimeAgo(isoDate) {
  if (!isoDate) return "";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `منذ ${diffMins} د`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `منذ ${diffHours} س`;
  return formatDate(isoDate);
}
function generateQuickCashOptions(total) {
  const rounded = roundMoney(total);
  const list = [rounded];
  if (rounded <= 0) return list;
  const step = rounded < 1000 ? 100 : rounded < 5000 ? 500 : 1000;
  const nextStep = Math.ceil(rounded / step) * step;
  if (nextStep > rounded) list.push(nextStep);
  const standardNotes = [500, 1000, 2000, 5000, 10000, 20000, 50000];
  standardNotes.filter((n) => n > rounded && !list.includes(n)).slice(0, 4).forEach((n) => list.push(n));
  return list.slice(0, 6);
}

const state = { view: "dashboard", lastStableView: "dashboard", viewHistory: [], isNavigatingBack: false, showSetupHome: false, settings: null, accounts: [], currentUser: null, activeCashierShift: null, cashierShifts: [], cashierSalarySummaries: [], cashierMonthlySalaryExpenses: [], cashierShiftStatistics: [], vault: null, products: [], productSuppliers: {}, sales: [], saleItems: [], suppliers: [], supplierPayments: [], customers: [], customerPayments: [], purchases: [], purchaseItems: [], expenses: [], stockMovements: [], cashMovements: [], transferVaultDeposits: [], cashbox: null, dashboard: null, analytics: null, periodicInventories: [], periodicInventorySummary: null, auditCycle: "monthly", auditFrom: "", auditTo: "", cart: [], heldInvoices: loadHeldInvoicesFromStorage(), lastAddedProductId: null, salesSheet: "peek", productQuery: "", productCategory: "الكل", productStockFilter: "all", inventoryCategory: "الكل", inventoryQuery: "", saleQuery: "", saleCategory: "الكل", invoiceQuery: "", invoicePeriod: "all", invoiceStatus: "all", invoiceFrom: "", invoiceTo: "", supplierQuery: "", supplierDebtFilter: "all", customerQuery: "", customerDebtFilter: "all", paymentQuery: "", paymentFrom: "", paymentTo: "", supplierPaymentQuery: "", supplierPaymentFrom: "", supplierPaymentTo: "", cashFrom: "", cashTo: "", debtQuery: "", debtSort: "highest", expenseQuery: "", expenseFrom: "", expenseTo: "", reportFrom: "", reportTo: "", reportPanels: { topVolume: false, topProfit: false, hourly: false, deadStock: false, cashIn: false, cashOut: false, cashMoves: false, transfers: false, cashExpenses: false, shifts: false, shiftStats: false, salaries: false, notifications: false, setGeneral: false, setBrand: false, setAccounts: false, setActivity: false, setNav: false, setData: false }, scanner: null, cartDiscount: "", cloud: { user: null, backups: [], loading: false, busy: "", error: "", identity: null, pairing: null, pairRequests: [], syncStatus: "local" } };
const DEFAULT_MOBILE_NAVIGATION_ORDER = ["dashboard", "sales", "purchases", ...NAV_ITEMS.map((item) => item.id).filter((id) => !["dashboard", "sales", "purchases"].includes(id))];
const RECOVERY_REQUEST_ENDPOINT = "https://formsubmit.co/ajax/fc46f51ed31eb26af7d65edd8a313358";
const businessProfile = () => BUSINESS_PROFILES[state.settings?.businessType] || BUSINESS_PROFILES["متجر عام"];
const isPharmacy = () => state.settings?.businessType === "صيدلية";
const profileOptions = (kind, current = "") => [...new Set([...(businessProfile()[kind] || []), current].filter(Boolean))];
const categoryOptions = (current = "") => [...new Set([...(businessProfile().categories || []), ...state.products.map((product) => product.category), current].filter(Boolean))];
const categoryButtons = (selected, action) => [`الكل`, ...categoryOptions()].map((category) => `<button type="button" class="category-chip ${selected === category ? "is-active" : ""}" data-category-action="${action}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
const categorySelectMarkup = (value = "") => { const known = [...new Set([...(businessProfile().categories || []), ...state.products.map((product) => product.category)].filter(Boolean))]; const custom = Boolean(value && !known.includes(value)); const options = [...new Set([...known, ...(custom ? [] : [value])])].filter(Boolean); return `<label>الصنف<select name="category" data-category-select>${options.map((category) => `<option value="${escapeHtml(category)}" ${category === value ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}<option value="__custom__" ${custom ? "selected" : ""}>أخرى</option></select><input name="customCategory" data-custom-category dir="rtl" value="${custom ? escapeHtml(value) : ""}" placeholder="اكتب الفئة الجديدة" ${custom ? "" : "hidden"} /></label>`; };
const bindCategoryField = (container) => { const select = container.querySelector("[data-category-select]"); const custom = container.querySelector("[data-custom-category]"); if (!select || !custom) return; const sync = () => { custom.hidden = select.value !== "__custom__"; if (select.value !== "__custom__") custom.value = ""; }; select.addEventListener("change", sync); sync(); };
let root;
let exitGuardInstalled = false;
let exitAllowed = false;
let exitGuardEntries = 1;
let runtimeGuardsInstalled = false;
let desktopBarcodeReaderInstalled = false;
let automaticBackupTimer = null;
let automaticBackupBusy = false;
let localBackupDirectoryHandle = null;
const AUTOMATIC_BACKUP_CHECK_MS = 5 * 60 * 1000;
const AUTOMATIC_CLOUD_BACKUP_INTERVAL_MS = 60 * 60 * 1000;
const AUTOMATIC_LOCAL_BACKUP_MARKER = "hesabi-last-local-daily-backup";
const AUTOMATIC_CLOUD_BACKUP_MARKER = "hesabi-last-cloud-hourly-backup";
const desktopBarcodeReader = { code: "", startedAt: 0, lastKeyAt: 0, resetTimer: null, lastCode: "", lastAcceptedAt: 0 };
const roleLabel = (role) => ACCOUNT_ROLES.find((item) => item.id === role)?.label || "كاشير";
const adminOnlyMessage = () => showToast("هذه العملية متاحة لحساب الأدمن فقط.", "error");

const money = (value) => {
  const currency = CURRENCIES.find((item) => item.code === (state.settings?.currency || DEFAULT_CURRENCY_CODE)) || CURRENCIES[0];
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(roundMoney(value));
  return `${formatted} ${currency.symbol}`;
};
const signedMoney = (value) => `<strong class="${toNumber(value) < 0 ? "is-negative" : ""}">${money(value)}</strong>`;
const amount = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(toNumber(value));
const amountLatin = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, useGrouping: false }).format(toNumber(value));
const datePartsFormatter = new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", { day: "2-digit", month: "2-digit", year: "numeric" });
const timePartsFormatter = new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: false });
const dateOnly = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(`${String(value || "")}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value || "") : datePartsFormatter.format(date);
};
const dateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "") : `${datePartsFormatter.format(date)} ${timePartsFormatter.format(date)}`;
};
const formatDate = (value) => dateOnly(value);
const reportRange = () => ({ from: state.reportFrom || "البداية", to: state.reportTo || dateTime(new Date()) });
const selectNumericFieldValue = (event) => {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  if (!input || input.type !== "number" || input.disabled || input.readOnly || !input.value) return;
  requestAnimationFrame(() => {
    if (document.activeElement !== input) return;
    try { input.select(); } catch { /* بعض متصفحات الهاتف تقيد تحديد مدخل الرقم الأصلي. */ }
  });
};
document.addEventListener("focusin", selectNumericFieldValue, true);
document.addEventListener("pointerup", selectNumericFieldValue, true);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
const phoneHref = (phone) => {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  return digits ? `tel:${raw.startsWith("+") ? "+" : ""}${digits}` : "";
};
const whatsAppHref = (phone, text = "") => {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/[^0-9+]/g, "");
  if (!digits) return "";
  const normalized = digits.replace(/^00/, "+");
  return `https://wa.me/${encodeURIComponent(normalized)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};
const phoneCallButton = (phone, name) => {
  const href = phoneHref(phone);
  return href ? `<a class="icon-button icon-button--call" href="${href}" aria-label="اتصال بـ ${escapeHtml(name)}" title="اتصال">${msymbol("call", "text-[19px]")}</a>` : "";
};
const whatsAppButton = (phone, name, text = "") => {
  const href = whatsAppHref(phone, text);
  return href ? `<a class="icon-button icon-button--whatsapp" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="مراسلة ${escapeHtml(name)} عبر واتساب" title="واتساب">${icon("whatsapp", 18)}</a>` : "";
};
function sendWhatsAppMessage(phone, text) {
  if (!phone) {
    showToast("لا يوجد رقم هاتف مسجل لهذا الحساب.", "error");
    return;
  }
  const href = whatsAppHref(phone, text);
  if (href) window.open(href, "_blank", "noopener,noreferrer");
  else showToast("رقم الهاتف غير صالح للمراسلة عبر واتساب.", "error");
}
function generateDebtReminderMessage(customer, storeName = "") {
  const store = storeName || state.settings?.storeName || "متجرنا";
  const storePhone = state.settings?.storePhone ? `\nللتواصل والاستفسار: ${state.settings.storePhone}` : "";
  return `السلام عليكم ورحمة الله وبركاته،\nالأخ/الأخت: ${customer.name}\n\nنود تذكيركم بأن الرصيد المستحق في حسابكم لدى ${store} هو: ${money(customer.balance)}.\n\nشاكرين ومقدرين حسن تعاملكم وتعاونكم الدائم.${storePhone}`;
}
function generateInvoiceWhatsAppMessage(invoice) {
  return invoiceShareText(invoice);
}
const canPickContacts = () => typeof navigator !== "undefined" && typeof navigator.contacts?.select === "function";
const phoneFieldMarkup = (inputId, value = "") => `<label>رقم الهاتف<div class="phone-field__control"><input id="${inputId}" name="phone" type="tel" inputmode="tel" dir="ltr" value="${escapeHtml(value)}" />${canPickContacts() ? `<button id="${inputId}-contact-picker" class="button button--secondary phone-field__picker" type="button">${msymbol("contacts", "text-[18px]")}<span>جهات الاتصال</span></button>` : ""}</div><small class="phone-field__hint">${canPickContacts() ? "اختر رقمًا من جهات اتصال الجهاز أو أدخله يدويًا." : "أدخل الرقم يدويًا؛ اختيار جهات الاتصال غير مدعوم في هذا الجهاز."}</small></label>`;
async function pickContactPhone(phoneInput, nameInput) {
  if (!canPickContacts()) { showToast("اختيار جهات الاتصال غير مدعوم في هذا الجهاز. أدخل الرقم يدويًا.", "error"); phoneInput.focus(); return; }
  try {
    const [contact] = await navigator.contacts.select(["name", "tel"], { multiple: false });
    const phone = contact?.tel?.find(Boolean);
    if (!phone) { showToast("جهة الاتصال المختارة لا تحتوي على رقم هاتف.", "error"); return; }
    phoneInput.value = phone;
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
    if (!nameInput.value.trim() && contact?.name?.[0]) nameInput.value = contact.name[0];
    showToast("تم إدخال رقم جهة الاتصال.");
  } catch (error) {
    if (error?.name !== "AbortError") showToast("تعذر فتح جهات الاتصال. يمكنك إدخال الرقم يدويًا.", "error");
  }
}
function bindContactPicker(overlay, phoneInputId, nameInputName = "name") {
  const picker = overlay.querySelector(`#${phoneInputId}-contact-picker`);
  if (!picker) return;
  const phoneInput = overlay.querySelector(`#${phoneInputId}`);
  const nameInput = overlay.querySelector(`[name=${nameInputName}]`);
  picker.addEventListener("click", () => void pickContactPhone(phoneInput, nameInput));
}
const paymentChannelLabel = (invoice) => invoice?.paymentType === "آجل" ? "دين" : invoice?.paymentMethod === "تحويل" ? "تحويل" : "كاش";
const assetBaseUrl = "https://hesabipwa-2r9mmdzn.manus.space/manus-storage";
const emptyImage = `${assetBaseUrl}/hesabi-empty-inventory_96623fe2.png`;
const markImage = "/hesabi-logo.png";
const LOCAL_STORE_LOGO_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i;
const LOCAL_STORE_LOGO_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const LOCAL_STORE_LOGO_MAX_STORED_BYTES = 440 * 1024;
function storeLogoDataUrl() { const value = String(state.settings?.storeLogoDataUrl || ""); return LOCAL_STORE_LOGO_PATTERN.test(value) ? value : ""; }
function storeLogoUrl() { return storeLogoDataUrl() || markImage; }
function updateStoreIcon() { const logo = storeLogoDataUrl(); if (!logo) return; document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach((link) => { link.href = logo; }); }
function dataUrlBytes(dataUrl) { const payload = String(dataUrl || "").split(",")[1] || ""; return Math.floor(payload.length * 3 / 4); }
function readLocalImageFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("تعذر قراءة ملف الشعار.")); reader.onload = () => resolve(String(reader.result || "")); reader.readAsDataURL(file); }); }
function decodeLocalLogo(dataUrl) { return new Promise((resolve, reject) => { const image = new Image(); image.onerror = () => reject(new Error("تعذر فتح صورة الشعار.")); image.onload = () => resolve(image); image.src = dataUrl; }); }
async function prepareStoreLogoDataUrl(file) {
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("اختر شعارًا بصيغة PNG أو JPG أو WebP.");
  if (file.size > LOCAL_STORE_LOGO_MAX_SOURCE_BYTES) throw new Error("حجم صورة الشعار كبير جدًا. اختر ملفًا أصغر من 5 ميغابايت.");
  const image = await decodeLocalLogo(await readLocalImageFile(file));
  for (const edge of [512, 420, 360, 300, 240]) {
    const scale = Math.min(1, edge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale)); const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("لا يدعم هذا المتصفح تجهيز صورة الشعار.");
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/webp", 0.84);
    if (LOCAL_STORE_LOGO_PATTERN.test(dataUrl) && dataUrlBytes(dataUrl) <= LOCAL_STORE_LOGO_MAX_STORED_BYTES) return dataUrl;
  }
  throw new Error("تعذر ضغط الشعار إلى حجم محلي مناسب. اختر صورة أصغر أو أبسط.");
}

function showToast(message, type = "success") {
  const host = document.querySelector("#toast-host") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "toast-host", className: "toast-host" }));
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast__icon">${icon(type === "success" ? "check" : "alert", 18)}</span><span>${escapeHtml(message)}</span>`;
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));
  window.setTimeout(() => { toast.classList.remove("toast--visible"); window.setTimeout(() => toast.remove(), 200); }, 3300);
}

function installRuntimeGuards() {
  if (runtimeGuardsInstalled) return;
  runtimeGuardsInstalled = true;
  const notify = (error) => {
    console.error("[Hesabi runtime error]", error);
    showToast("حدث خلل غير متوقع، لكن بياناتك المحلية محفوظة. يمكنك متابعة العمل أو إعادة المحاولة.", "error");
  };
  window.addEventListener("error", (event) => notify(event.error || event.message));
  window.addEventListener("unhandledrejection", (event) => notify(event.reason));
}

function installExitGuard() {
  if (exitGuardInstalled) return;
  exitGuardInstalled = true;
  const guardState = () => ({ ...(history.state || {}), hesabiExitGuard: true });
  const armExitGuard = () => {
    if (exitAllowed || history.state?.hesabiExitGuard) return;
    primeExitGuardHistory(history, window.location.href);
    exitGuardEntries = 1;
  };
  armExitGuard();
  window.addEventListener("pageshow", armExitGuard, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") armExitGuard(); }, { passive: true });
  window.addEventListener("popstate", () => {
    const action = getExitGuardAction({ exitAllowed, hasOpenOverlay: Boolean(document.querySelector("#scanner-backdrop") || document.querySelector("#dialog-backdrop")) });
    if (action === "allow-exit") return;
    if (action === "close-overlay") {
      closeDialog();
      history.pushState(guardState(), "", window.location.href);
      exitGuardEntries += 1;
      showToast("أُغلقت النافذة. اضغط رجوع مرة أخرى لعرض تأكيد الخروج.", "error");
      return;
    }
    history.pushState(guardState(), "", window.location.href);
    exitGuardEntries += 1;
    openExitConfirmDialog();
  });
}

function openExitConfirmDialog() {
  if (document.querySelector("#exit-confirm-dialog")) return;
  const overlay = openDialog(`<div class="stitch-dialog"><div id="exit-confirm-dialog" class="confirm-dialog"><div class="dialog__head"><div><span class="eyebrow">تأكيد الخروج</span><h2>هل تريد الخروج من حسابي؟</h2><p class="dialog__subtext">ستبقى بيانات المتجر محفوظة على هذا الجهاز.</p></div><button class="icon-button" data-dialog-close aria-label="إلغاء">${msymbol("close", "text-[20px]")}</button></div><div class="dialog__actions"><button class="button button--secondary" type="button" data-dialog-close>البقاء في التطبيق</button><button id="confirm-app-exit" class="button button--danger" type="button">نعم، خروج</button></div></div></div>`);
  overlay.querySelector("#confirm-app-exit").addEventListener("click", () => {
    exitAllowed = true;
    closeDialog();
    leaveAfterExitConfirmation(
      (steps) => history.go(steps),
      -exitGuardEntries,
    );
  });
}

async function completeLocalLogout() {
  if (state.activeCashierShift) { openCashierHandoverDialog({ logout: true }); return; }
  await db.clearPersistentSession();
  state.currentUser = null;
  state.activeCashierShift = null;
  state.cart = [];
  state.view = "sales";
  closeDialog();
  render();
  showToast("تم تسجيل الخروج.");
}

async function switchLocalUser() {
  if (state.activeCashierShift) { openCashierHandoverDialog({ logout: false }); return; }
  await db.clearPersistentSession();
  state.currentUser = null;
  state.activeCashierShift = null;
  state.cart = [];
  state.view = "sales";
  closeDialog();
  render();
  showToast("اختر المستخدم التالي لتسجيل الدخول.");
}

async function leaveAfterCashierShift({ logout }) {
  await db.clearPersistentSession();
  state.currentUser = null;
  state.activeCashierShift = null;
  state.cart = [];
  state.view = "sales";
  closeDialog();
  render();
  showToast(logout ? "تم إغلاق الوردية وتسجيل الخروج." : "تم إغلاق الوردية. اختر المستخدم التالي لتسجيل الدخول.");
}

function openCashierShiftStartDialog() {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">استلام الصندوق</span><h2>بدء وردية ${escapeHtml(state.currentUser?.name || "الكاشير")}</h2><p class="dialog__subtext">اكتب المبلغ النقدي الذي استلمته من الصندوق قبل بدء المبيعات. يحسب التطبيق مبيعات ورديتك ويقارنه بجرد الإغلاق للأدمن.</p></div><button class="icon-button" data-dialog-close aria-label="إلغاء">${msymbol("close", "text-[20px]")}</button></div><form id="cashier-shift-start-form" class="form-grid"><label>المبلغ المستلم من الصندوق<input name="receivedCash" type="number" inputmode="decimal" min="0" step="0.01" value="0" required autofocus /></label><div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">بدء الوردية ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelector("#cashier-shift-start-form").addEventListener("submit", async (event) => { event.preventDefault(); try { state.activeCashierShift = await db.startCashierShift({ accountId: state.currentUser.id, accountName: state.currentUser.name, receivedCash: new FormData(event.currentTarget).get("receivedCash") }); await refresh(); closeDialog(); render(); showToast("تم تسجيل استلام الصندوق وبدء ورديتك."); } catch (error) { showToast(error.message || "تعذر بدء وردية الصندوق.", "error"); } });
}

function openCashierHandoverDialog({ logout }) {
  const shift = state.activeCashierShift;
  if (!shift) return logout ? completeLocalLogout() : switchLocalUser();
  closeDialog();
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">جرد وتسليم الصندوق</span><h2>إغلاق وردية ${escapeHtml(state.currentUser?.name || "الكاشير")}</h2><p class="dialog__subtext">اكتب المبلغ النقدي الموجود فعليًا في الصندوق الآن. سيقارن المدير لاحقًا بينه وبين المبلغ المستلم ومبيعاتك النقدية.</p></div><button class="icon-button" data-dialog-close aria-label="إلغاء">${msymbol("close", "text-[20px]")}</button></div><div class="cashier-shift-handover__received"><span>المبلغ المستلم أول الوردية</span><strong>${money(shift.receivedCash)}</strong></div><form id="cashier-shift-close-form" class="form-grid"><label>الجرد النقدي الفعلي<input name="countedCash" type="number" inputmode="decimal" min="0" step="0.01" required autofocus /></label><div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">تأكيد الجرد والتسليم ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelector("#cashier-shift-close-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const closed = await db.closeCashierShift({ shiftId: shift.id, countedCash: new FormData(event.currentTarget).get("countedCash") }); await refresh(); await leaveAfterCashierShift({ logout }); const difference = toNumber(closed.difference); showToast(difference === 0 ? "تم إغلاق الوردية دون فرق في الصندوق." : difference < 0 ? `تم تسجيل عجز ${money(Math.abs(difference))}.` : `تم تسجيل زيادة ${money(difference)}.`); } catch (error) { showToast(error.message || "تعذر حفظ جرد الوردية.", "error"); } });
}

function openLogoutConfirmDialog() {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="confirm-dialog"><div class="dialog__head"><div><span class="eyebrow">تأكيد تسجيل الخروج</span><h2>هل تريد تسجيل الخروج؟</h2><p class="dialog__subtext">لن تُحذف البيانات. ستحتاج فقط إلى إدخال رمز الدخول للمتابعة.</p></div><button class="icon-button" data-dialog-close aria-label="إلغاء">${msymbol("close", "text-[20px]")}</button></div><div class="dialog__actions"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button id="confirm-local-logout" class="button button--danger" type="button">نعم، تسجيل الخروج</button></div></div></div>`);
  overlay.querySelector("#confirm-local-logout").addEventListener("click", () => void completeLocalLogout());
}

function openAccountSessionDialog() {
  const cashierShiftNote = state.activeCashierShift ? `<p class="dialog__subtext cashier-shift-note">لديك وردية صندوق مفتوحة. سيطلب منك جرد المبلغ قبل تبديل المستخدم أو تسجيل الخروج.</p>` : "";
  const selfEditAction = state.currentUser?.role === "admin" ? `<button id="edit-local-account" class="button button--secondary" type="button">تعديل بياناتي</button>` : "";
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">الحساب الحالي</span><h2>${escapeHtml(state.currentUser?.name || "حسابي")}</h2><p class="dialog__subtext">يمكنك تعديل بيانات الأدمن أو الانتقال إلى مستخدم آخر أو تسجيل الخروج من هذا الجهاز. تبقى بيانات المتجر محفوظة محليًا.</p>${cashierShiftNote}</div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="dialog__actions">${selfEditAction}<button id="switch-local-user" class="button button--secondary" type="button">${msymbol("group", "text-[18px]")} تبديل المستخدم</button><button id="open-local-logout-confirm" class="button button--danger" type="button">تسجيل الخروج</button></div></div>`);
  overlay.querySelector("#edit-local-account")?.addEventListener("click", () => { closeDialog(); openAccountDialog(state.accounts.find((account) => account.id === state.currentUser?.id)); });
  overlay.querySelector("#switch-local-user").addEventListener("click", () => void switchLocalUser());
  overlay.querySelector("#open-local-logout-confirm").addEventListener("click", openLogoutConfirmDialog);
}

function openScreenLockDialog() {
  state.isScreenLocked = true;
  const overlay = openDialog(`
    <div class="dialog__head screen-lock-head">
      <div class="screen-lock-user-info">
        <div class="screen-lock-icon">${msymbol("lock", "text-[26px]")}</div>
        <div>
          <span class="eyebrow">قفل الشاشة السريع</span>
          <h2>${escapeHtml(state.currentUser?.name || "المستخدم")}</h2>
          <small>${roleLabel(state.currentUser?.role)} · ${escapeHtml(storeDisplayName())}</small>
        </div>
      </div>
    </div>
    <form id="screen-lock-form" class="form-grid">
      <label class="form-full">
        رمز الدخول لفتح الشاشة
        <input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" placeholder="••••" required autofocus maxlength="12" />
      </label>
      <div class="dialog__actions form-full">
        <button type="button" class="button button--secondary" id="switch-account-from-lock">تبديل الحساب</button>
        <button type="submit" class="button button--primary">${msymbol("check", "text-[18px]")} فتح الشاشة</button>
      </div>
    </form>
  `);
  const form = overlay.querySelector("#screen-lock-form");
  overlay.querySelector("#switch-account-from-lock")?.addEventListener("click", () => {
    state.isScreenLocked = false;
    closeDialog();
    openAccountSessionDialog();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pin = new FormData(event.currentTarget).get("pin");
    try {
      await db.verifyAccountPin(state.currentUser.id, pin);
      state.isScreenLocked = false;
      closeDialog();
      showToast("تم فتح الشاشة بنجاح.");
    } catch {
      showToast("رمز الدخول غير صحيح. أعد المحاولة.", "error");
      form.pin.value = "";
      form.pin.focus();
    }
  });
}

function formatStatus(product) {
  const status = stockStatus(product.quantity, product.minimumStock);
  return `<span class="status status--${status === "متوفر" ? "available" : status === "منخفض" ? "low" : "empty"}">${status}</span>`;
}

function storeDisplayName(settings = state.settings) {
  const businessType = String(settings?.businessType || "").trim();
  const storeName = String(settings?.storeName || "حسابي").trim();
  return [businessType, storeName].filter(Boolean).join(" ");
}

function expiryStatus(product, today = dateKey()) {
  const expiryDate = String(product?.nearestExpiryDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) return null;
  const progress = expiryProgress({ productionDate: product?.nearestProductionDate, expiryDate, today });
  const days = progress ? progress.remainingDays : Math.ceil((new Date(`${expiryDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  if (progress ? progress.ratio < 0.85 : days > 90) return null;
  return { expiryDate, days, ratio: progress?.ratio ?? null, tone: days <= 30 ? "danger" : "warning", label: days < 0 ? "منتهي" : progress ? `استهلك ${Math.min(100, Math.round(progress.ratio * 100))}% من الصلاحية` : days <= 30 ? "ينتهي خلال شهر" : "ينتهي خلال 3 أشهر" };
}

function expiryStatusMarkup(product) {
  const status = expiryStatus(product);
  return status ? `<span class="expiry-status expiry-status--${status.tone}">${status.label} · ${formatDate(status.expiryDate)}</span>` : "";
}
function expiryMeterMarkup(product) { const progress = expiryProgress({ productionDate: product?.nearestProductionDate, expiryDate: product?.nearestExpiryDate }); if (!progress) return `<div class="expiry-meter expiry-meter--empty" title="لا توجد تواريخ إنتاج وانتهاء مكتملة"><span></span></div>`; const consumed = Math.max(0, Math.min(1, progress.ratio)); const remaining = 1 - consumed; const tone = consumed >= 1 ? "danger" : consumed >= 0.85 ? "warning" : "safe"; return `<div class="expiry-meter expiry-meter--${tone}" title="المتبقي ${Math.round(remaining * 100)}% من مدة الصلاحية"><span style="width:${Math.round(remaining * 100)}%"></span></div>`; }

async function refresh() {
  [state.products, state.productSuppliers, state.sales, state.saleItems, state.suppliers, state.supplierPayments, state.customers, state.customerPayments, state.purchases, state.purchaseItems, state.expenses, state.stockMovements, state.cashMovements, state.transferVaultDeposits, state.cashbox, state.dashboard, state.cashierShifts, state.cashierSalarySummaries, state.cashierMonthlySalaryExpenses, state.cashierShiftStatistics, state.vault, state.periodicInventories] = await Promise.all([db.listProducts(), db.listProductSupplierLinks(), db.listSales(), db.listSaleItems(), db.listSuppliers(), db.listSupplierPayments(), db.listCustomers(), db.listCustomerPayments(), db.listPurchases(), db.listPurchaseItems(), db.listExpenses(), db.listStockMovements(), db.listCashMovements({ from: state.cashFrom, to: state.cashTo }), db.listTransferVaultDeposits(), db.getCashbox({ from: state.cashFrom, to: state.cashTo }), db.getDashboard(), db.listCashierShifts({ date: "" }), db.listCashierSalarySummaries(), db.listCashierMonthlySalaryExpenses({ from: state.expenseFrom, to: state.expenseTo }), db.listCashierShiftStatistics({ from: state.cashFrom, to: state.cashTo }), db.getVault({ from: state.cashFrom, to: state.cashTo }), db.listPeriodicInventories()]);
  state.activeCashierShift = state.currentUser?.role === "cashier" ? await db.getActiveCashierShift(state.currentUser.id) : null;
  void syncNotificationAlerts();
  const auditRange = currentPeriodicInventoryRange();
  [state.analytics, state.periodicInventorySummary] = await Promise.all([db.getAnalytics({ from: state.reportFrom, to: state.reportTo }), db.getPeriodicInventorySummary(auditRange)]);
  state.todayTransfers = calculateTransferCollections({ sales: state.sales.filter((sale) => dateKey(sale.date) === dateKey()), customerPayments: state.customerPayments.filter((payment) => dateKey(payment.date) === dateKey()) });
}

/* Stitch: أيقونات Material Symbols وعناوين العروض للشاشات المحوّلة (icon() تبقى للقديمة). */
const msymbol = (name, cls = "text-[22px]") => `<span class="material-symbols-outlined ${cls}" aria-hidden="true">${name}</span>`;
const NAV_MSYMBOL = { dashboard: "dashboard", products: "inventory_2", sales: "point_of_sale", customers: "group", suppliers: "local_shipping", purchases: "shopping_cart", cashbox: "account_balance_wallet", reports: "query_stats", settings: "tune" };
const brandLogoUrl = () => storeLogoDataUrl() || "/hesabi-logo.png";
const currentCurrency = () => CURRENCIES.find((item) => item.code === (state.settings?.currency || DEFAULT_CURRENCY_CODE)) || CURRENCIES[0];
const currencySymbol = () => currentCurrency().symbol;
function viewLabel(view) {
  const known = { dashboard: "الرئيسية", products: "المنتجات", inventory: "المخزون", sales: "نقطة البيع", invoices: "الفواتير", customers: "العملاء", "customer-payments": "دفعات العملاء", suppliers: "الموردون", "supplier-payments": "دفعات الموردين", purchases: "المشتريات", expenses: "المصروفات", cashbox: "الصندوق", transfers: "التحويلات", reports: "التقارير", "periodic-inventory": "الجرد الدوري", accounts: "الحسابات", "activity-log": "سجل النشاط", settings: "الإعدادات", "general-settings": "الإعدادات العامة", "brand-settings": "شعار المتجر", "navigation-settings": "ترتيب الهاتف", "data-management": "إدارة البيانات" };
  return known[view] || NAV_ITEMS.find((item) => item.id === view)?.label || "حسابي";
}
/* «منذ 5 دقائق» — عرض فقط لسجل النشاط. */
function timeAgo(value) {
  const then = new Date(value).getTime();
  if (!then || Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${amount(mins)} ${mins === 1 ? "دقيقة" : mins === 2 ? "دقيقتين" : "دقائق"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${amount(hours)} ${hours === 1 ? "ساعة" : hours === 2 ? "ساعتين" : "ساعات"}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "أمس";
  if (days === 2) return "قبل يومين";
  if (days <= 10) return `قبل ${amount(days)} أيام`;
  return formatDate(value);
}

function navMarkup() {
  const accessibleItems = NAV_ITEMS.filter((item) => canAccessView(state.currentUser, item.id));
  const renderItems = (items) => items.map((item) => `<button class="nav-item ${state.view === item.id ? "is-active" : ""}" data-action="navigate" data-view="${item.id}" ${state.view === item.id ? 'aria-current="page"' : ""} title="${item.label}">${msymbol(NAV_MSYMBOL[item.id] || "dashboard")}<span>${item.label}</span></button>`).join("");
  const configuredOrder = normalizedMobileNavigationOrder(state.settings?.mobileNavigationOrder);
  const bottomItems = configuredOrder.map((id) => accessibleItems.find((item) => item.id === id)).filter(Boolean);
  const items = renderItems(accessibleItems);
  return `<aside class="sidebar">
    <div class="flex items-center gap-3 px-2 pt-1 pb-7"><img src="${brandLogoUrl()}" alt="شعار ${escapeHtml(state.settings?.storeName || "المتجر")}" class="w-10 h-10 object-contain shrink-0" /><div class="min-w-0"><strong class="font-headline-sm text-headline-sm text-on-surface block leading-tight">حسابي</strong><small class="font-label-sm text-label-sm text-on-surface-variant block truncate">${escapeHtml(state.settings?.storeName || "متجرك")}</small></div></div>
    <div class="font-label-sm text-label-sm font-bold text-on-surface-variant px-3 pb-2">تشغيل المتجر</div><nav class="grid gap-1.5" aria-label="التنقل الرئيسي">${items}</nav>
    <div class="mt-4 p-3 rounded-xl bg-surface-container-low border border-outline-variant grid gap-1.5"><span class="account-badge account-badge--${state.currentUser?.role || "cashier"}">${roleLabel(state.currentUser?.role)}</span><strong class="font-label-lg text-label-lg text-on-surface truncate">${escapeHtml(state.currentUser?.name || "")}</strong><button class="text-button" data-action="account-session">تبديل المستخدمين</button></div>
    <div class="mt-auto pt-4 flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant px-2"><span class="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"></span><span>البيانات محفوظة محليًا</span></div>
  </aside>
  <nav class="bottom-nav" data-bottom-nav aria-label="التنقل الرئيسي">${renderItems(bottomItems)}</nav>`;
}

/* الرأس العام اللاصق (Stitch): شعار المتجر + الحالة + البحث + المظهر + الماسح + الحساب. */
function appHeaderMarkup() {
  const themeGlyph = resolvedTheme() === "dark" ? "light_mode" : "dark_mode";
  const themeLabel = themePreference() === "system" ? `يتبع ضبط الجهاز (${systemPrefersDark() ? "داكن" : "فاتح"}) — اضغط للوضع الفاتح` : themePreference() === "light" ? "الوضع الفاتح — اضغط للوضع الداكن" : "الوضع الداكن — اضغط لاتباع ضبط الجهاز";
  return `<header class="app-header bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe"><div class="h-16 px-margin flex items-center justify-between gap-space-sm"><div class="flex items-center gap-space-sm min-w-0 flex-1"><img src="${brandLogoUrl()}" alt="حسابي" class="h-8 w-auto object-contain shrink-0" /><div class="flex flex-col min-w-0"><div class="flex items-center gap-space-xs"><span class="font-headline-sm text-headline-sm text-on-surface font-bold truncate leading-none">${escapeHtml(storeDisplayName())}</span><span class="px-space-xs py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm inline-flex items-center gap-1 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>متصل محلياً</span></div><span class="font-label-sm text-label-sm text-on-surface-variant truncate">حسابي • ${escapeHtml(viewLabel(state.view))}</span></div></div><div class="flex items-center gap-1 shrink-0"><button aria-label="ابحث في التطبيق" title="ابحث في التطبيق" class="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface active:bg-surface-container transition-colors" data-action="open-app-search" type="button">${msymbol("search", "text-[20px]")}</button><button aria-label="${themeLabel}" title="${themeLabel}" class="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface active:bg-surface-container transition-colors" data-action="toggle-theme" type="button">${msymbol(themeGlyph, "text-[20px]")}</button><button aria-label="مسح باركود السلعة" title="مسح باركود السلعة" class="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary active:bg-surface-container transition-colors" data-action="open-sales-scanner" data-mode="sale" type="button">${msymbol("barcode_scanner", "text-[22px]")}</button><button aria-label="تبديل المستخدمين أو تسجيل الخروج" title="تبديل المستخدمين أو تسجيل الخروج" class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 active:scale-95 transition-transform" data-action="account-session" type="button">${msymbol("person", "text-[18px]")}</button></div></div></header>`;
}
function normalizedMobileNavigationOrder(order = []) {
  const knownIds = new Set(NAV_ITEMS.map((item) => item.id));
  const configured = Array.isArray(order) ? order.filter((id, index) => knownIds.has(id) && order.indexOf(id) === index) : [];
  return [...configured, ...DEFAULT_MOBILE_NAVIGATION_ORDER.filter((id) => !configured.includes(id))];
}

async function updateMobileNavigationOrder(id, direction = 0) {
  const order = normalizedMobileNavigationOrder(state.settings?.mobileNavigationOrder);
  const currentIndex = order.indexOf(id);
  const destinationIndex = currentIndex + Number(direction);
  if (currentIndex < 0 || destinationIndex < 0 || destinationIndex >= order.length) return;
  [order[currentIndex], order[destinationIndex]] = [order[destinationIndex], order[currentIndex]];
  await db.saveSettings({ mobileNavigationOrder: order });
  state.settings = await db.getSettings();
  render();
  showToast("تم حفظ ترتيب شريط الهاتف.");
}

async function resetMobileNavigationOrder() {
  await db.saveSettings({ mobileNavigationOrder: DEFAULT_MOBILE_NAVIGATION_ORDER });
  state.settings = await db.getSettings();
  render();
  showToast("تمت استعادة ترتيب شريط الهاتف الافتراضي.");
}

function applyDeepLinkView() {
  try {
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested && canAccessView(state.currentUser, requested)) state.view = requested;
    if (requested) window.history.replaceState({}, "", window.location.pathname);
  } catch { /* تجاهل */ }
}

let notificationBridgeBound = false;
function installNotificationBridge() {
  if (notificationBridgeBound || !("serviceWorker" in navigator)) return;
  notificationBridgeBound = true;
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "HESABI_NOTIFICATION_CLICK") return;
    try {
      const view = new URL(event.data.url, window.location.origin).searchParams.get("view");
      if (view && canAccessView(state.currentUser, view)) { state.view = view; render(); }
    } catch { /* تجاهل */ }
  });
}

function alertContext() {
  const products = state.products || [];
  return {
    products,
    dashboard: state.dashboard,
    shifts: state.cashierShifts || [],
    pairRequests: state.cloud?.pairRequests || [],
    isAdmin: isAdmin(state.currentUser),
    debtThreshold: toNumber(state.settings?.debtAlertThreshold) || 0,
  };
}

function alertSnapshotCounts() {
  const context = alertContext();
  const products = context.products;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const batches = state.dashboard?.expiringBatches || [];
  const dayMs = 86400000;
  const expired = batches.filter((batch) => batch.expiryDate && new Date(`${batch.expiryDate}T00:00:00`).getTime() < today.getTime()).length;
  const nearExpiry = batches.filter((batch) => {
    if (!batch.expiryDate) return false;
    const days = Math.ceil((new Date(`${batch.expiryDate}T00:00:00`).getTime() - today.getTime()) / dayMs);
    return days >= 0 && days <= 30;
  }).length;
  return {
    outOfStock: products.filter((product) => toNumber(product.quantity) <= 0).length,
    lowStock: products.filter((product) => toNumber(product.quantity) > 0 && toNumber(product.minimumStock) > 0 && toNumber(product.quantity) <= toNumber(product.minimumStock)).length,
    expired,
    nearExpiry,
    pendingRequests: context.isAdmin ? (state.cloud?.pairRequests || []).filter((request) => request.status === "pending").length : 0,
    pendingSurpluses: context.isAdmin ? (state.cashierShifts || []).filter((shift) => shift.surplusApprovalStatus === "PENDING").length : 0,
  };
}

async function syncNotificationAlerts() {
  try {
    publishBackgroundSnapshot(alertSnapshotCounts());
    if (notificationPermission() !== "granted") return;
    await runAlertChecks(alertContext());
  } catch (error) {
    console.warn("[Hesabi notifications]", error);
  }
}

/* إشعارات Web Push: مفتاح VAPID للمتجر + سجلّ أجهزة المتجر. تُحمَّل الوحدات ديناميكيًا
   حتى لا تُلمس Firebase في مسارات الاختبار ولا عند تعطّل الشبكة. */
async function registerPushForThisDevice() {
  try {
    const override = import.meta.env?.VITE_PUSH_VAPID_PUBLIC_KEY || state.settings?.pushVapidPublicKey || "";
    if (override) {
      const subscription = await subscribeToPush(override);
      if (subscription) {
        try {
          await db.saveSettings({ ...state.settings, pushSubscription: subscription });
          state.settings = await db.getSettings();
        } catch { /* تجاهل */ }
      }
      const storeId = (state.settings?.cloudStoreId || state.cloud?.identity?.storeId || "").trim();
      const { registerPushDevice } = await import("./firebase-sync.js");
      const saved = storeId && subscription ? await registerPushDevice({ storeId, subscription, meta: { platform: "pwa" } }) : null;
      return { registered: Boolean(saved), renewed: false, reason: saved ? "" : storeId ? "subscribe-failed" : "no-store" };
    }
    const { renewAndRegisterPushDevice } = await import("./push-alerts.js");
    return await renewAndRegisterPushDevice();
  } catch (error) {
    console.warn("[Hesabi push registration]", error?.message || error);
    return { registered: false, reason: "failed" };
  }
}

async function enableNotifications() {
  if (!notificationsSupported()) { showToast("متصفحك لا يدعم إشعارات النظام.", "error"); return; }
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    showToast(permission === "denied" ? "الإشعارات محظورة. فعّلها من إعدادات المتصفح للموقع." : "لم تُمنح صلاحية الإشعارات.", "error");
    render();
    return;
  }
  saveNotificationSettings({ enabled: true });
  const capability = await enableBackgroundChecks();
  const pushRegistration = await registerPushForThisDevice();
  const capabilityNote = capability.periodicSync
    ? "ستصلك التنبيهات حتى والتطبيق في الخلفية."
    : "ستصلك التنبيهات عند فتح التطبيق أو تحديثه.";
  const pushNote = pushRegistration?.registered
    ? "وتصل بقية أجهزة نفس المتجر حتى وهي مغلقة."
    : pushRegistration?.reason && !["no-store", "unsupported"].includes(pushRegistration.reason)
      ? `لم يُسجَّل هذا الجهاز للإشعارات عن بعد (${pushRegistration.reason}).`
      : "";
  await showAppNotification({
    topic: "general",
    key: `welcome:${Date.now()}`,
    title: "تم تفعيل إشعارات حسابي",
    body: `${capabilityNote}${pushNote ? ` ${pushNote}` : ""}`,
    cooldownMs: 0,
  });
  await showAppNotification({ topic: "general", key: `welcome:${Date.now()}`, title: "تم تفعيل إشعارات حسابي", body: capability.periodicSync ? "ستصلك التنبيهات حتى والتطبيق في الخلفية." : "ستصلك التنبيهات عند فتح التطبيق أو تحديثه.", cooldownMs: 0 });
  await syncNotificationAlerts();
  render();
}

function toggleNotificationTopic(topicId) {
  const settings = notificationSettings();
  saveNotificationSettings({ topics: { ...settings.topics, [topicId]: settings.topics[topicId] === false } });
  render();
}

function notificationsStatus() {
  const supported = notificationsSupported();
  const permission = notificationPermission();
  const settings = notificationSettings();
  if (!supported) return { label: "غير مدعوم", tone: "status--pending" };
  if (permission === "granted") return settings.enabled ? { label: "مفعّلة", tone: "status--available" } : { label: "موقوفة مؤقتًا", tone: "status--pending" };
  if (permission === "denied") return { label: "محظورة", tone: "status--danger" };
  return { label: "غير مفعّلة", tone: "status--pending" };
}

function notificationsBodyMarkup() {
  const supported = notificationsSupported();
  const permission = notificationPermission();
  const settings = notificationSettings();
  const topics = NOTIFICATION_TOPICS.filter((topic) => !topic.adminOnly || isAdmin(state.currentUser));

  return `<section class="panel notifications-panel">
    <p class="panel__subtext">تصلك التنبيهات المهمة حتى والتطبيق في الخلفية: طلبات الكاشير، نفاد المنتجات، انتهاء الصلاحية، وفائض الورديات.</p>
    ${!supported ? `<div class="inline-empty">افتح التطبيق من متصفح حديث أو ثبّته على الشاشة الرئيسية لتفعيل الإشعارات.</div>` : ""}
    ${supported && permission !== "granted" ? `<button class="button button--primary" data-action="enable-notifications">${msymbol("notifications", "text-[18px]")}<span>تفعيل الإشعارات</span></button>` : ""}
    ${supported && permission === "granted" ? `<div class="notification-topics">${topics.map((topic) => `
      <label class="checkbox-field notification-topic">
        <input type="checkbox" data-notification-topic="${topic.id}" ${settings.topics[topic.id] === false ? "" : "checked"} />
        <span><strong>${topic.label}</strong><small>${topic.description}</small></span>
      </label>`).join("")}</div>
      <div class="notification-actions">
        <button class="button button--secondary button--compact" data-action="toggle-notifications-enabled">${settings.enabled ? "إيقاف مؤقت" : "استئناف"}</button>
        <button class="button button--secondary button--compact" data-action="test-notification">إشعار تجريبي</button>
        <button class="button button--secondary button--compact" data-action="reset-notification-history">إعادة ضبط التكرار</button>
      </div>` : ""}
  </section>`;
}

function notificationsPanelMarkup() {
  const status = notificationsStatus();
  return collapsiblePanel("notifications", {
    eyebrow: "التنبيهات",
    title: "إشعارات المتجر",
    subtitle: "طلبات الكاشير، نفاد المنتجات، انتهاء الصلاحية، وفائض الورديات",
    badge: status.label,
    glyph: "alert",
  }, notificationsBodyMarkup());
}

const THEME_MODES = ["system", "light", "dark"];
const systemPrefersDark = () => typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)").matches
  : false;

// "system" هو الافتراضي: يتبع ضبط الجهاز حتى يختار المستخدم وضعًا صريحًا.
function themePreference() {
  const stored = state.settings?.theme;
  return THEME_MODES.includes(stored) ? stored : "system";
}
function resolvedTheme() {
  const preference = themePreference();
  return preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;
}

function applyTheme() {
  const preference = themePreference();
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  // نحفظ التفضيل ليطبّقه سكربت الرأس قبل أول رسم عند تحديث الصفحة.
  try { localStorage.setItem("hesabi-theme", preference); } catch { /* التخزين المحلي غير متاح */ }
  document.documentElement.style.background = theme === "dark" ? "#101d18" : "";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#101d18" : "#1F6B59");
}

// عند اتباع ضبط الجهاز، نتفاعل فورًا مع تغيّره دون الحاجة لتحديث الصفحة.
let systemThemeWatcherBound = false;
function watchSystemTheme() {
  if (systemThemeWatcherBound || typeof window === "undefined" || !window.matchMedia) return;
  systemThemeWatcherBound = true;
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => { if (themePreference() === "system") { applyTheme(); render(); } };
  if (query.addEventListener) query.addEventListener("change", onChange);
  else if (query.addListener) query.addListener(onChange);
}

function themeToggleMarkup() {
  const preference = themePreference();
  const label = preference === "system"
    ? `يتبع ضبط الجهاز (${systemPrefersDark() ? "داكن" : "فاتح"}) — اضغط للوضع الفاتح`
    : preference === "light" ? "الوضع الفاتح — اضغط للوضع الداكن" : "الوضع الداكن — اضغط لاتباع ضبط الجهاز";
  const glyph = preference === "system" ? "monitor" : preference === "light" ? "sun" : "moon";
  return `<button class="icon-button theme-toggle ${preference === "system" ? "theme-toggle--system" : ""}" data-action="toggle-theme" aria-label="${label}" title="${label}">${icon(glyph, 19)}</button>`;
}
function salesScannerFabMarkup() { return `<button class="sales-scanner-fab" data-action="open-sales-scanner" data-mode="sale" aria-label="مسح بيع فوري" title="بيع ومسح باركود">${msymbol("qr_code_scanner", "")}<span>مسح بيع فوري</span></button>`; }

function topbarMarkup(title, description, action = "", modifierClass = "") {
  return `<header class="topbar${modifierClass ? ` ${modifierClass}` : ""}"><div><p class="eyebrow topbar__store"><img src="${storeLogoUrl()}" alt="" />${escapeHtml(storeDisplayName())}</p><h1>${title}</h1>${description ? `<p class="topbar__description">${description}</p>` : ""}</div><div class="topbar__actions"><span class="account-badge account-badge--${state.currentUser?.role || "cashier"}">${roleLabel(state.currentUser?.role)}</span>${action}${themeToggleMarkup()}<button class="icon-button lock-screen-btn" data-action="quick-lock" aria-label="قفل الشاشة السريع" title="قفل الشاشة السريع">${msymbol("lock", "text-[19px]")}</button><button class="icon-button" data-action="account-session" aria-label="تبديل المستخدمين أو تسجيل الخروج" title="تبديل المستخدمين أو تسجيل الخروج">${msymbol("group", "text-[19px]")}</button></div></header>`;
}


// ===== البحث الشامل: الوصول إلى أي صفحة أو خانة أو إجراء =====
const APP_SEARCH_ENTRIES = [
  { id: "dashboard", label: "الرئيسية", group: "الصفحات", glyph: "grid", view: "dashboard", keywords: "لوحة نظرة يومك رئيسية home dashboard" },
  { id: "products", label: "المنتجات", group: "الصفحات", glyph: "package", view: "products", keywords: "اصناف سلع باركود اسعار products" },
  { id: "inventory", label: "المخزون", group: "الصفحات", glyph: "layers", view: "inventory", keywords: "كميات جرد رصيد مستودع stock inventory" },
  { id: "sales", label: "المبيعات ونقطة البيع", group: "الصفحات", glyph: "cart", view: "sales", keywords: "بيع كاشير فاتورة pos sales سلة" },
  { id: "invoices", label: "فواتير المبيعات", group: "الصفحات", glyph: "receipt", view: "invoices", keywords: "فواتير طباعة مرتجع invoices" },
  { id: "customers", label: "العملاء والديون", group: "الصفحات", glyph: "users", view: "customers", keywords: "زبائن ديون اجل ارصدة customers" },
  { id: "customer-payments", label: "دفعات العملاء", group: "الصفحات", glyph: "wallet", view: "customer-payments", keywords: "تسديد سداد دفعة عميل" },
  { id: "suppliers", label: "الموردون", group: "الصفحات", glyph: "truck", view: "suppliers", keywords: "موردين مستحقات توريد suppliers" },
  { id: "supplier-payments", label: "دفعات الموردين", group: "الصفحات", glyph: "wallet", view: "supplier-payments", keywords: "سداد مورد دفعة" },
  { id: "purchases", label: "المشتريات", group: "الصفحات", glyph: "truck", view: "purchases", keywords: "شراء فاتورة شراء توريد purchases" },
  { id: "expenses", label: "المصروفات", group: "الصفحات", glyph: "wallet", view: "expenses", keywords: "مصاريف رواتب سلف ايجار expenses" },
  { id: "cashbox", label: "الخزنة والصناديق", group: "الصفحات", glyph: "wallet", view: "cashbox", keywords: "صندوق خزنة نقد كاش cashbox vault" },
  { id: "transfers", label: "الحوالات والتحويلات", group: "الصفحات", glyph: "truck", view: "transfers", keywords: "حوالة تحويل وارد صادر transfers" },
  { id: "reports", label: "التقارير", group: "الصفحات", glyph: "chart", view: "reports", keywords: "تقرير ارباح تحليل reports" },
  { id: "periodic-inventory", label: "الجرد المحاسبي الدوري", group: "الصفحات", glyph: "layers", view: "periodic-inventory", keywords: "جرد دوري شهري سنوي لقطة" },
  { id: "accounts", label: "الحسابات والمستخدمون", group: "الصفحات", glyph: "users", view: "accounts", keywords: "مستخدمين كاشير صلاحيات accounts" },
  { id: "activity-log", label: "سجل العمليات", group: "الصفحات", glyph: "history", view: "activity-log", keywords: "سجل نشاط تدقيق log" },
  { id: "settings", label: "الإعدادات", group: "الصفحات", glyph: "box", view: "settings", keywords: "اعدادات ضبط settings" },
  { id: "general-settings", label: "الإعدادات العامة", group: "الصفحات", glyph: "box", view: "general-settings", keywords: "عملة نشاط اسم المتجر" },
  { id: "brand-settings", label: "الهوية والشعار", group: "الصفحات", glyph: "box", view: "brand-settings", keywords: "شعار لوجو هوية علامة" },
  { id: "navigation-settings", label: "ترتيب شريط التنقل", group: "الصفحات", glyph: "grid", view: "navigation-settings", keywords: "ترتيب قائمة تنقل" },
  { id: "data-management", label: "النسخ الاحتياطي والبيانات", group: "الصفحات", glyph: "box", view: "data-management", keywords: "نسخة احتياطية استعادة سحابة backup" },

  { id: "p-reports-topVolume", label: "الأكثر طلباً", group: "خانات التقارير", glyph: "chart", view: "reports", panel: "topVolume", keywords: "الاعلى مبيعا كمية" },
  { id: "p-reports-topProfit", label: "أبطال الربحية", group: "خانات التقارير", glyph: "chart", view: "reports", panel: "topProfit", keywords: "ارباح ربحية الاعلى" },
  { id: "p-reports-hourly", label: "تحليل ساعات الذروة", group: "خانات التقارير", glyph: "chart", view: "reports", panel: "hourly", keywords: "ذروة ساعات توزيع" },
  { id: "p-reports-deadStock", label: "البضاعة الراكدة", group: "خانات التقارير", glyph: "package", view: "reports", panel: "deadStock", keywords: "راكد بدون حركة" },

  { id: "p-cash-in", label: "مصادر الداخل للصندوق", group: "خانات الخزنة", glyph: "wallet", view: "cashbox", panel: "cashIn", keywords: "وارد داخل ايداع" },
  { id: "p-cash-out", label: "مصادر الخارج من الصندوق", group: "خانات الخزنة", glyph: "wallet", view: "cashbox", panel: "cashOut", keywords: "صادر خارج سحب" },
  { id: "p-cash-moves", label: "حركات الخزنة والتسويات", group: "خانات الخزنة", glyph: "history", view: "cashbox", panel: "cashMoves", keywords: "حركة ايداع سحب تسوية" },
  { id: "p-cash-transfers", label: "التحويلات داخل الخزنة", group: "خانات الخزنة", glyph: "truck", view: "cashbox", panel: "transfers", keywords: "حوالات تحويل" },
  { id: "p-cash-expenses", label: "المصروفات داخل الخزنة", group: "خانات الخزنة", glyph: "wallet", view: "cashbox", panel: "cashExpenses", keywords: "مصاريف" },
  { id: "p-cash-shifts", label: "ورديات الكاشير", group: "خانات الخزنة", glyph: "users", view: "cashbox", panel: "shifts", keywords: "وردية شفت ترحيل" },
  { id: "p-cash-stats", label: "إحصاءات عجز وفائض الكاشير", group: "خانات الخزنة", glyph: "chart", view: "cashbox", panel: "shiftStats", keywords: "عجز فائض فروقات" },
  { id: "p-cash-salaries", label: "رواتب الفريق", group: "خانات الخزنة", glyph: "wallet", view: "cashbox", panel: "salaries", keywords: "راتب رواتب سلف تسليم" },

  { id: "a-new-sale", label: "فتح شاشة بيع جديد", group: "إجراءات سريعة", glyph: "cart", view: "sales", keywords: "بيع جديد فاتورة كاشير" },
  { id: "a-new-product", label: "إضافة منتج جديد", group: "إجراءات سريعة", glyph: "plus", action: "new-product", keywords: "منتج جديد اضافة صنف" },
  { id: "a-new-customer", label: "إضافة عميل جديد", group: "إجراءات سريعة", glyph: "users", action: "new-customer", keywords: "عميل جديد زبون" },
  { id: "a-new-supplier", label: "إضافة مورد جديد", group: "إجراءات سريعة", glyph: "truck", action: "new-supplier", keywords: "مورد جديد" },
  { id: "a-new-purchase", label: "فاتورة شراء جديدة", group: "إجراءات سريعة", glyph: "truck", action: "new-purchase", keywords: "شراء فاتورة توريد" },
  { id: "a-new-expense", label: "تسجيل مصروف", group: "إجراءات سريعة", glyph: "wallet", action: "new-expense", keywords: "مصروف صرف" },
  { id: "a-salary-advance", label: "تسجيل سلفة موظف", group: "إجراءات سريعة", glyph: "wallet", action: "new-cashier-salary-advance", keywords: "سلفة راتب موظف" },
  { id: "a-deposit", label: "إيداع في الخزنة", group: "إجراءات سريعة", glyph: "plus", action: "new-cash-deposit", keywords: "ايداع نقد خزنة" },
  { id: "a-withdraw", label: "سحب من الخزنة", group: "إجراءات سريعة", glyph: "wallet", action: "new-cash-withdrawal", keywords: "سحب نقد خزنة" },
  { id: "a-reorder", label: "قائمة إعادة الطلب", group: "إجراءات سريعة", glyph: "truck", action: "open-reorder-list", keywords: "اعادة طلب نواقص" },
  { id: "a-stock-history", label: "سجل حركة المخزون", group: "إجراءات سريعة", glyph: "history", action: "open-stock-history", keywords: "سجل حركة مخزون" },
  { id: "a-scan", label: "مسح باركود", group: "إجراءات سريعة", glyph: "scan", action: "open-sales-scanner", keywords: "باركود سكانر مسح كاميرا" },
  { id: "a-export-report", label: "تصدير التقارير PDF", group: "إجراءات سريعة", glyph: "receipt", action: "export-report", keywords: "تصدير pdf طباعة تقرير" },
  { id: "a-theme", label: "تبديل الوضع الليلي/النهاري", group: "إجراءات سريعة", glyph: "box", action: "toggle-theme", keywords: "ثيم داكن ليلي نهاري" },
  { id: "a-lock", label: "قفل الشاشة", group: "إجراءات سريعة", glyph: "lock", action: "quick-lock", keywords: "قفل حماية" },
];

const normalizeSearchText = (value) => String(value || "")
  .toLocaleLowerCase("ar")
  .replace(/[\u064B-\u0652\u0640]/g, "")
  .replace(/[أإآ]/g, "ا").replace(/[ىي]/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
  .replace(/\s+/g, " ").trim();

function availableSearchEntries() {
  return APP_SEARCH_ENTRIES.filter((entry) => {
    if (entry.view && !canAccessView(state.currentUser, entry.view)) return false;
    if (entry.action && !canUseAction(state.currentUser, entry.action)) return false;
    return true;
  });
}

function searchAppEntries(query) {
  const q = normalizeSearchText(query);
  const entries = availableSearchEntries();
  if (!q) return entries.slice(0, 12);
  const terms = q.split(" ").filter(Boolean);
  return entries
    .map((entry) => {
      const hay = normalizeSearchText(`${entry.label} ${entry.group} ${entry.keywords || ""}`);
      const label = normalizeSearchText(entry.label);
      if (!terms.every((term) => hay.includes(term))) return null;
      let score = 0;
      if (label === q) score += 100;
      else if (label.startsWith(q)) score += 60;
      else if (label.includes(q)) score += 35;
      if (entry.group === "الصفحات") score += 8;
      return { entry, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24)
    .map((item) => item.entry);
}

function appSearchResultsMarkup(query) {
  const results = searchAppEntries(query);
  if (!results.length) return `<div class="app-search__empty">لا توجد نتائج مطابقة لـ "${escapeHtml(query)}". جرّب كلمة أخرى مثل: مخزون، ديون، حوالة، راتب.</div>`;
  const groups = new Map();
  results.forEach((entry) => { if (!groups.has(entry.group)) groups.set(entry.group, []); groups.get(entry.group).push(entry); });
  return [...groups.entries()].map(([group, items]) => `<div class="app-search__group"><span class="app-search__group-title">${group}</span>${items.map((entry) => `
    <button type="button" class="app-search__item" data-search-goto="${entry.id}">
      <span class="app-search__icon">${icon(entry.glyph || "grid", 18)}</span>
      <span class="app-search__label"><strong>${escapeHtml(entry.label)}</strong>${entry.panel ? `<small>خانة داخل ${escapeHtml(APP_SEARCH_ENTRIES.find((e) => e.id === entry.view)?.label || entry.view)}</small>` : ""}</span>
      <span class="app-search__go">${icon("arrow", 16)}</span>
    </button>`).join("")}</div>`).join("");
}

function openAppSearchDialog() {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head app-search__head">
      <div><span class="eyebrow">بحث شامل</span><h2>ابحث عن أي صفحة أو خانة</h2></div>
      <button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button>
    </div>
    <label class="search-field app-search__field">${msymbol("search", "text-[19px]")}<input id="app-search-input" type="search" dir="rtl" lang="ar" autocomplete="off" placeholder="اكتب: مخزون، تقارير، ديون، حوالة، راتب..." /></label>
    <div id="app-search-results" class="app-search__results">${appSearchResultsMarkup("")}</div></div>`);

  const input = overlay.querySelector("#app-search-input");
  const list = overlay.querySelector("#app-search-results");

  const bindItems = () => list.querySelectorAll("[data-search-goto]").forEach((button) => {
    button.addEventListener("click", () => runAppSearchEntry(button.dataset.searchGoto));
  });
  const update = () => { list.innerHTML = appSearchResultsMarkup(input.value); bindItems(); };

  bindItems();
  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); list.querySelector("[data-search-goto]")?.click(); }
  });
  requestAnimationFrame(() => input.focus());
}

function runAppSearchEntry(entryId) {
  const entry = APP_SEARCH_ENTRIES.find((item) => item.id === entryId);
  if (!entry) return;
  closeDialog();
  if (entry.panel) {
    if (!canAccessView(state.currentUser, entry.view)) { adminOnlyMessage(); return; }
    if (!state.reportPanels) state.reportPanels = {};
    state.reportPanels[entry.panel] = true;
    state.view = entry.view;
    render();
    requestAnimationFrame(() => {
      const target = root.querySelector(`[data-panel="${entry.panel}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.classList.add("is-search-highlight");
      setTimeout(() => target?.classList.remove("is-search-highlight"), 1800);
    });
    return;
  }
  if (entry.action) {
    const synthetic = { currentTarget: { dataset: { action: entry.action } } };
    void handleAction(synthetic);
    return;
  }
  if (entry.view) {
    if (!canAccessView(state.currentUser, entry.view)) { adminOnlyMessage(); return; }
    state.view = entry.view;
    render();
  }
}

function dashboardMarkup() {
  const dashboard = state.dashboard || {};
  const transfers = state.todayTransfers || { total: 0, count: 0 };
  const low = (dashboard.lowStock || []).slice(0, 5);
  const symbol = currencySymbol();
  const currencyName = currentCurrency().label;
  const todaySales = toNumber(dashboard.todaySales);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySales = (state.sales || []).filter((sale) => dateKey(sale.date) === dateKey(yesterday)).reduce((sum, sale) => sum + toNumber(sale.total), 0);
  const salesDelta = yesterdaySales > 0 ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100) : null;
  const alertCount = low.length + (state.products || []).filter((product) => toNumber(product.quantity) <= 0).length;
  const userRole = state.currentUser?.role || "cashier";
  const recentSales = [...(state.sales || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  const recentPayments = [...(state.customerPayments || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 2);
  const activity = [...recentSales.map((sale) => ({ kind: "sale", date: sale.date, sale })), ...recentPayments.map((payment) => ({ kind: "payment", date: payment.date, payment }))].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  /* زر يقود لوجهته إن كانت مسموحة، وإلا نص خامل — نفس عهد metricCard. */
  const navCard = (view, cls, inner) => canAccessView(state.currentUser, view)
    ? `<button type="button" class="${cls}" data-action="navigate" data-view="${view}">${inner}</button>`
    : `<article class="${cls}">${inner}</article>`;
  const hero = navCard("invoices", "block w-full text-right bg-primary text-on-primary p-space-md rounded-xl shadow-sm mb-space-sm relative overflow-hidden active:scale-[0.99] transition-transform", `
    <span class="relative z-10 flex flex-col gap-1">
      <span class="flex items-center justify-between gap-2">
        <span class="font-label-md text-label-md text-on-primary-container">إجمالي مبيعات اليوم (الكل)</span>
        ${salesDelta === null ? "" : `<span class="inline-flex items-center gap-1 bg-surface-container-lowest/15 px-2 py-0.5 rounded-full font-label-sm text-label-sm text-on-primary whitespace-nowrap">${msymbol("trending_up", "text-[14px]")}${salesDelta >= 0 ? "+" : ""}${amountLatin(salesDelta)}% عن أمس</span>`}
      </span>
      <span class="flex items-baseline justify-between gap-2 mt-1">
        <span class="flex items-baseline gap-1 min-w-0">
          <span class="font-currency-display text-[clamp(22px,7.5vw,32px)] leading-[1.25] font-extrabold tabular-nums whitespace-nowrap" dir="ltr">${amount(todaySales)}</span>
          <span class="font-label-md text-label-md text-on-primary-container shrink-0">${symbol}</span>
        </span>
        <span class="flex items-center gap-1 bg-surface-container-lowest/20 px-2.5 py-1 rounded-lg shrink-0">${msymbol("receipt_long", "text-[16px]")}<span class="font-label-md text-label-md whitespace-nowrap">${amountLatin(dashboard.todayInvoiceCount)} فاتورة</span></span>
      </span>
    </span>
    <span class="absolute -left-6 -bottom-6 w-36 h-36 opacity-10 pointer-events-none text-on-primary" aria-hidden="true"><svg class="w-full h-full" fill="currentColor" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45"></circle></svg></span>`);
  const mini = (view, label, value, tone, mark, foot) => navCard(view, "bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between text-right active:scale-[0.98] transition-transform min-w-0", `
      <span>
        <span class="flex items-center justify-between gap-1 mb-0.5">
          <span class="font-label-sm text-label-sm text-on-surface-variant truncate">${label}</span>
          ${mark}
        </span>
        <span class="flex items-baseline gap-1">
          <span class="font-headline-lg text-[clamp(17px,5.5vw,24px)] leading-[1.35] font-bold tabular-nums whitespace-nowrap ${toNumber(value) < 0 ? "text-error" : tone}" dir="ltr">${amount(value)}</span>
          <span class="font-body-sm text-body-sm text-on-surface-variant shrink-0">${symbol}</span>
        </span>
      </span>
      ${foot}`);
  const kpiRow1 = `<div class="grid grid-cols-2 gap-space-sm mb-space-sm">
      ${mini("cashbox", "الداخل للصندوق", dashboard.todayCashIn, "text-primary", `<span class="w-2 h-2 rounded-full bg-primary shrink-0"></span>`, `<span class="mt-2 bg-surface-container-low px-1.5 py-1 rounded text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1">${msymbol("payments", "text-[13px] text-primary")}<span class="truncate">نقد فعلي فقط بالدرج</span></span>`)}
      ${mini("transfers", "تحويلات ومحافظ", transfers.total, "text-secondary", `<span class="w-2 h-2 rounded-full bg-secondary shrink-0"></span>`, `<span class="mt-2 bg-secondary-container px-1.5 py-1 rounded text-on-secondary-container font-label-sm text-label-sm flex items-center gap-1">${msymbol("phone_iphone", "text-[13px]")}<span class="truncate">كريمي / ون كاش</span></span>`)}
    </div>`;
  const kpiRow2 = `<div class="grid grid-cols-2 gap-space-sm">
      ${mini("reports", "أرباح اليوم التقديرية", dashboard.todayProfit, "text-on-surface", msymbol("monitoring", "text-[15px] text-primary"), `<span class="font-label-sm text-label-sm text-primary mt-1 block">صافي بعد خصم التكاليف</span>`)}
      ${mini("customers", "ديون العملاء بالسوق", dashboard.customerDebt, "text-tertiary", msymbol("assignment_late", "text-[15px] text-tertiary"), `<span class="font-label-sm text-label-sm text-tertiary-container mt-1 block">مستحقات آجلة للتحصيل</span>`)}
    </div>`;
  const quickBtn = (action, view, glyph, tile, title, sub) => `<button class="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm text-right flex items-center gap-space-sm active:scale-95 transition-transform min-w-0" type="button" data-action="${action}"${view ? ` data-view="${view}"` : ""}>
      <span class="w-10 h-10 rounded-lg ${tile} flex items-center justify-center shrink-0">${msymbol(glyph, "text-[20px]")}</span>
      <span class="flex flex-col min-w-0"><span class="font-label-lg text-label-lg text-on-surface truncate">${title}</span><span class="font-label-sm text-label-sm text-on-surface-variant truncate">${sub}</span></span>
    </button>`;
  const quickActions = `
  <section class="py-space-xs">
    <div class="flex items-center justify-between mb-space-xs">
      <h2 class="font-headline-sm text-headline-sm text-on-surface">إجراءات تشغيلية سريعة</h2>
      <span class="font-label-sm text-label-sm text-on-surface-variant">اختصارات فورية</span>
    </div>
    <button class="w-full bg-primary text-on-primary rounded-xl px-space-md py-3 flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform mb-space-sm" type="button" data-action="navigate" data-view="sales">
      <span class="flex items-center gap-space-sm">
        <span class="w-9 h-9 rounded-lg bg-surface-container-lowest/20 flex items-center justify-center text-on-primary">${msymbol("add_shopping_cart", "text-[24px]")}</span>
        <span class="flex flex-col text-right">
          <span class="font-headline-sm text-headline-sm leading-none font-bold">فاتورة بيع جديدة (POS)</span>
          <span class="font-label-sm text-label-sm text-on-primary-container mt-1">كاشير متواصل مع ماسح الباركود</span>
        </span>
      </span>
      ${msymbol("chevron_left", "text-[24px]")}
    </button>
    <div class="grid grid-cols-2 gap-space-sm">
      ${quickBtn("new-purchase", "", "inventory_2", "bg-secondary-container text-on-secondary-container", "فاتورة شراء", "توريد كراتين وعبوات")}
      ${quickBtn("navigate", "customer-payments", "price_check", "bg-primary-fixed text-on-primary-fixed", "سند قبض دين", "تحصيل حساب عميل")}
      ${quickBtn("navigate", "expenses", "receipt", "bg-error-container text-on-error-container", "تسجيل مصروف", "كهرباء ونثريات يومية")}
      ${quickBtn("navigate", "periodic-inventory", "fact_check", "bg-surface-container-high text-on-surface", "جرد المخزون", "مطابقة الكميات والرف")}
    </div>
  </section>`;
  const lowCountLabel = low.length === 1 ? "صنف واحد أوشك" : low.length === 2 ? "صنفان أوشكا" : `${amountLatin(low.length)} أصناف أوشكت`;
  const lowStock = low.length ? `
  <section class="pt-space-md pb-space-xs">
    <div class="bg-tertiary-fixed text-on-tertiary-fixed p-space-md rounded-xl shadow-sm">
      <div class="flex items-center justify-between gap-2 mb-space-xs">
        <div class="flex items-center gap-1.5 min-w-0">
          ${msymbol("warning", "text-tertiary text-[20px]")}
          <h3 class="font-headline-sm text-headline-sm text-on-tertiary-fixed truncate">أصناف تحت حد الطلب (نواقص)</h3>
        </div>
        <span class="px-2 py-0.5 rounded-full bg-tertiary-fixed-dim text-on-tertiary-fixed font-label-sm text-label-sm whitespace-nowrap shrink-0">${lowCountLabel}</span>
      </div>
      <div class="flex flex-col gap-space-xs">
        ${low.map((product) => `
        <div class="bg-surface-container-lowest p-space-sm rounded-lg flex items-center justify-between gap-2 text-on-surface">
          <button class="flex flex-col min-w-0 text-right" data-action="open-product" data-id="${product.id}" type="button">
            <span class="font-label-lg text-label-lg truncate w-full">${escapeHtml(product.name)}</span>
            <span class="flex items-center gap-space-sm mt-0.5">
              <span class="font-body-sm text-body-sm text-error font-semibold whitespace-nowrap">متبقي: ${amount(product.quantity)} ${escapeHtml(product.unit)}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">الحد الأدنى: ${amount(product.minimumStock)}</span>
            </span>
          </button>
          <button class="h-8 px-2.5 bg-primary text-on-primary rounded-md font-label-sm text-label-sm shrink-0 flex items-center gap-1 active:scale-95 transition-transform" type="button" data-action="new-purchase">${msymbol("add", "text-[16px]")}أمر شراء</button>
        </div>`).join("")}
      </div>
    </div>
  </section>` : "";
  const saleTone = (sale) => sale.paymentType === "آجل"
    ? { tile: "bg-tertiary-fixed text-on-tertiary-fixed", glyph: "menu_book", badge: "bg-tertiary-fixed-dim text-on-tertiary-fixed", badgeText: "دين آجل", amountCls: "text-tertiary", status: "سجل في الحساب", sub: `العميل: ${escapeHtml(sale.customerName || "")}` }
    : sale.paymentMethod === "تحويل"
      ? { tile: "bg-secondary-container text-on-secondary-container", glyph: "account_balance_wallet", badge: "bg-secondary-container text-on-secondary-container", badgeText: "تحويل", amountCls: "text-secondary", status: "حوالة مؤكدة", sub: sale.customerName ? escapeHtml(sale.customerName) : "تحويل بنكي / محفظة" }
      : { tile: "bg-primary/10 text-primary", glyph: "payments", badge: "bg-primary-fixed text-on-primary-fixed", badgeText: "كاش نقدي", amountCls: "text-primary", status: "مدفوع كامل", sub: sale.customerName ? `العميل: ${escapeHtml(sale.customerName)}` : "عميل نقدي" };
  const activityRows = activity.map((entry) => {
    if (entry.kind === "payment") {
      const payment = entry.payment;
      const viaTransfer = payment.paymentMethod === "تحويل";
      const open = payment.customerId ? `data-action="open-customer" data-id="${payment.customerId}"` : `data-action="navigate" data-view="customer-payments"`;
      return `<button class="w-full bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex items-center justify-between gap-2 text-right" type="button" ${open}>
        <span class="flex items-center gap-space-sm min-w-0">
          <span class="w-10 h-10 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">${msymbol("check_circle", "text-[20px]")}</span>
          <span class="flex flex-col min-w-0">
            <span class="flex items-center gap-space-xs">
              <span class="font-label-lg text-label-lg text-on-surface font-bold truncate">#${escapeHtml(payment.invoiceNumber || "سند قبض")}</span>
              <span class="px-2 py-px rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm whitespace-nowrap">سند قبض</span>
            </span>
            <span class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 truncate">سداد من: ${escapeHtml(payment.customerName || "")} • ${timeAgo(payment.date)}</span>
          </span>
        </span>
        <span class="flex flex-col items-end shrink-0">
          <span class="flex items-baseline gap-1 text-primary">
            <span class="font-headline-sm text-headline-sm font-bold tabular-nums whitespace-nowrap" dir="ltr">+${amount(payment.amount)}</span>
            <span class="font-label-sm text-label-sm">${symbol}</span>
          </span>
          <span class="font-label-sm text-label-sm text-primary whitespace-nowrap">${viaTransfer ? "تحويل مؤكد" : "نقد في الصندوق"}</span>
        </span>
      </button>`;
    }
    const sale = entry.sale;
    const tone = saleTone(sale);
    return `<button class="w-full bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex items-center justify-between gap-2 text-right" type="button" data-action="open-invoice" data-id="${sale.id}">
      <span class="flex items-center gap-space-sm min-w-0">
        <span class="w-10 h-10 rounded-xl ${tone.tile} flex items-center justify-center shrink-0">${msymbol(tone.glyph, "text-[20px]")}</span>
        <span class="flex flex-col min-w-0">
          <span class="flex items-center gap-space-xs">
            <span class="font-label-lg text-label-lg text-on-surface font-bold truncate">#${escapeHtml(sale.invoiceNumber)}</span>
            <span class="px-2 py-px rounded ${tone.badge} font-label-sm text-label-sm whitespace-nowrap">${tone.badgeText}</span>
          </span>
          <span class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 truncate">${tone.sub} • ${timeAgo(sale.date)}</span>
        </span>
      </span>
      <span class="flex flex-col items-end shrink-0">
        <span class="flex items-baseline gap-1 ${tone.amountCls}">
          <span class="font-headline-sm text-headline-sm font-bold tabular-nums whitespace-nowrap" dir="ltr">${amount(sale.total)}</span>
          <span class="font-label-sm text-label-sm">${symbol}</span>
        </span>
        <span class="font-label-sm text-label-sm ${tone.amountCls} whitespace-nowrap">${tone.status}</span>
      </span>
    </button>`;
  }).join("");
  const activitySection = `
  <section class="pt-space-md">
    <div class="flex items-center justify-between gap-2 mb-space-xs">
      <div class="flex items-center gap-1.5 min-w-0">
        ${msymbol("history", "text-primary text-[18px]")}
        <h2 class="font-headline-sm text-headline-sm text-on-surface truncate">آخر فواتير ومعاملات اليوم</h2>
      </div>
      <span class="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap shrink-0">${dateTime(new Date())}</span>
    </div>
    ${activity.length ? `<div class="flex flex-col gap-space-xs">${activityRows}</div>` : `<div class="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm font-body-sm text-body-sm text-on-surface-variant">لا توجد معاملات بعد — أتم أول عملية بيع لتظهر هنا.</div>`}
    <button class="mt-space-sm w-full py-space-sm bg-surface-container text-on-surface rounded-xl flex items-center justify-center gap-1.5 font-label-lg text-label-lg active:scale-[0.98] transition-transform" type="button" data-action="navigate" data-view="invoices">
      <span>عرض كافة سجل الفواتير والمعاملات</span>
      ${msymbol("arrow_back", "text-[18px]")}
    </button>
  </section>`;
  return `<h1 class="sr-only">نظرة على يومك</h1>
  <section class="pt-space-sm pb-space-xs flex flex-col gap-space-xs">
    <div class="flex items-center justify-between gap-2 bg-surface-container-low p-space-sm rounded-xl">
      <div class="flex items-center gap-space-sm min-w-0">
        <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">${msymbol("storefront", "text-[24px]")}</div>
        <div class="flex flex-col min-w-0">
          <span class="font-headline-sm text-headline-sm text-on-surface truncate">${escapeHtml(storeDisplayName())}</span>
          <span class="flex items-center gap-space-xs mt-0.5">
            <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 min-w-0">${msymbol("shield_person", "text-[14px]")}<span class="truncate">${escapeHtml(state.currentUser?.name || "")} (${roleLabel(userRole)})</span></span>
            <span class="inline-flex items-center px-1.5 py-px rounded bg-primary text-on-primary font-label-sm text-label-sm whitespace-nowrap shrink-0">${userRole === "admin" ? "أدمن كامل الصلاحيات" : roleLabel(userRole)}</span>
          </span>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button aria-label="تنبيهات المخزون" title="تنبيهات المخزون" class="relative w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container text-on-surface-variant active:scale-95 transition-transform" type="button" data-action="open-reorder-list">${msymbol("notifications", "text-[20px]")}${alertCount ? `<span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error"></span>` : ""}</button>
        <button aria-label="قفل الشاشة السريع" title="قفل الشاشة السريع" class="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container text-on-surface-variant active:scale-95 transition-transform" type="button" data-action="quick-lock">${msymbol("lock", "text-[20px]")}</button>
      </div>
    </div>
    <div class="flex items-center justify-between gap-2 px-space-sm py-1 bg-surface-container rounded-lg font-label-sm text-label-sm text-on-surface-variant">
      <span class="flex items-center gap-1.5 min-w-0">
        <span class="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0"></span>
        <span class="font-label-sm text-label-sm text-on-surface truncate">متصل محلياً • تخزين آمن على الجهاز</span>
      </span>
      <span class="text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap shrink-0">مزامنة تلقائية نشطة</span>
    </div>
  </section>
  <section class="pt-space-xs pb-space-sm">
    <div class="flex items-center justify-between gap-2 mb-space-xs">
      <div class="flex items-center gap-1.5 min-w-0">
        ${msymbol("account_balance", "text-primary text-[18px]")}
        <h2 class="font-headline-sm text-headline-sm text-on-surface truncate">مؤشرات اليوم المالية</h2>
      </div>
      <span class="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap shrink-0">${escapeHtml(currencyName)}</span>
    </div>
    ${hero}
    ${kpiRow1}
    ${kpiRow2}
  </section>${quickActions}${lowStock}${activitySection}`;
}
/**
 * بطاقة الرقم في لوحة التحكم: مستطيلة، أيقونة كبيرة تدلّ على وظيفتها، ورقمها في سطر واحد.
 * navigateTo اختياري: إن كانت الوجهة معروفة ومسموحة للمستخدم صارت البطاقة زرًا يقود إليها،
 * وإلا تبقى نصًا خاملًا — لا نولّد مسارًا لا يستطيع المستخدم سلوكه.
 */
function metricCard(label, value, iconName, helper, rawValue = 0, navigateTo = "") {
  const classes = ["metric-card", toNumber(rawValue) < 0 ? "is-negative" : ""].filter(Boolean).join(" ");
  const mark = `<span class="metric-card__icon" aria-hidden="true">${icon(iconName, 26)}</span>`;
  const hint = helper ? `<em class="metric-card__hint">${helper}</em>` : "";
  const body = `<span class="metric-card__body"><span class="metric-card__head"><small>${label}</small>${hint}</span><strong>${value}</strong></span>`;
  const view = String(navigateTo || "").trim();
  if (view && canAccessView(state.currentUser, view)) {
    const target = NAV_ITEMS.find((item) => item.id === view)?.label || "الصفحة المرتبطة";
    return `<button type="button" class="${classes} is-openable" data-action="navigate" data-view="${view}" title="يُفتح ${target}" aria-label="${label}: افتح ${target}">${mark}${body}<span class="metric-card__go" aria-hidden="true">${icon("arrow", 18)}</span></button>`;
  }
  return `<article class="${classes}">${mark}${body}</article>`;
}
function packageFieldLabels(packageUnit, stockUnit = "حبة") { const forms = { "حبة": ["حبة", "الحبات"], "علبة": ["علبة", "العلب"], "كرتون": ["كرتون", "الكراتين"], "كيس": ["كيس", "الأكياس"], "حزمة": ["حزمة", "الحزم"], "ربطة": ["ربطة", "الربطات"], "صندوق": ["صندوق", "الصناديق"], "كيلو": ["كيلو", "الكيلوات"], "جرام": ["جرام", "الجرامات"], "لتر": ["لتر", "اللترات"], "متر": ["متر", "الأمتار"], "شريط": ["شريط", "الأشرطة"], "عبوة": ["عبوة", "العبوات"], "دزينة": ["دزينة", "الدزائن"], "قطعة": ["قطعة", "القطع"], "طقم": ["طقم", "الأطقم"], "جهاز": ["جهاز", "الأجهزة"] }; const get = (unit) => forms[unit] || [unit || "وحدة", `ال${unit || "وحدات"}`]; const [packageSingular, packagePlural] = get(packageUnit); const [saleSingular] = get(stockUnit); return { quantity: `عدد ${packagePlural.replace(/^ال/, "")}`, units: `${saleSingular}/${packageSingular}`, cost: `سعر ${packageSingular}`, salePrice: `سعر البيع لل${saleSingular}`, minimumStock: `الحد الأدنى بال${saleSingular}`, summary: `سعر ${saleSingular}` }; }

function quantityControlMarkup({ value = 1, min = 1, max = "", step = "1", inputAttrs = "" } = {}) {
  return `<div class="quantity-control"><button type="button" class="quantity-control__button" data-quantity-step="-1" aria-label="إنقاص الكمية">${msymbol("remove", "text-[17px]")}</button><input type="number" inputmode="decimal" min="${min}" ${max !== "" ? `max="${max}"` : ""} step="${step}" value="${value}" ${inputAttrs} /><button type="button" class="quantity-control__button" data-quantity-step="1" aria-label="زيادة الكمية">${msymbol("add", "text-[17px]")}</button></div>`;
}

function bindQuantityControl(host, { min = 1, max = Infinity, step = 1, onChange } = {}) {
  const input = host.querySelector("input[type=number]");
  const commit = (next) => {
    const bounded = Math.min(max, Math.max(min, toNumber(next)));
    input.value = bounded;
    onChange(bounded);
  };
  host.querySelectorAll("[data-quantity-step]").forEach((button) => button.addEventListener("click", () => commit(toNumber(input.value) + toNumber(button.dataset.quantityStep) * step)));
  input.addEventListener("change", () => commit(input.value));
  input.addEventListener("blur", () => commit(input.value));
}

function emptyState(title, text, destination = "new-product") {
  const action = destination === "new-product" ? `data-action="new-product"` : `data-action="navigate" data-view="${destination}"`;
  const label = destination === "new-product" ? "إضافة منتج" : "ابدأ الآن";
  return `<div class="empty-state"><img src="${emptyImage}" alt="" /><div><h3>${title}</h3><p>${text}</p><button class="button button--secondary" ${action}>${msymbol("add", "text-[17px]")} ${label}</button></div></div>`;
}

// ===== زر الرجوع: يعيدك إلى الصفحة التي جئت منها =====
const VIEW_BACK_LABELS = { dashboard: "الرئيسية", products: "المنتجات", inventory: "المخزون", sales: "المبيعات", invoices: "الفواتير", customers: "العملاء", "customer-payments": "دفعات العملاء", suppliers: "الموردين", "supplier-payments": "دفعات الموردين", purchases: "المشتريات", cashbox: "الصندوق", vault: "الخزنة", expenses: "المصروفات", reports: "التقارير", settings: "الإعدادات", "data-management": "إدارة البيانات", "periodic-inventory": "الجرد المحاسبي" };

function backTargetView(currentView, fallback = "") {
  for (let index = state.viewHistory.length - 1; index >= 0; index -= 1) {
    const candidate = state.viewHistory[index];
    if (candidate && candidate !== currentView && canAccessView(state.currentUser, candidate)) return candidate;
  }
  return fallback && canAccessView(state.currentUser, fallback) ? fallback : "";
}

function backButtonMarkup(currentView, fallback = "") {
  const target = backTargetView(currentView, fallback);
  if (!target) return "";
  const label = VIEW_BACK_LABELS[target] || "السابق";
  return `<button class="button button--secondary button--compact topbar-back-btn" data-action="go-back" data-view="${target}" title="رجوع إلى ${label}" aria-label="رجوع إلى ${label}">${icon("arrow", 16)}<span>رجوع إلى ${label}</span></button>`;
}

function crossLinkMarkup(view, { eyebrow, title, subtitle, label, glyph }) {
  return `<section class="cross-link-bar"><button type="button" class="cross-link-bar__button" data-action="navigate" data-view="${view}">
    <span class="cross-link-bar__icon">${icon(glyph, 20)}</span>
    <span class="cross-link-bar__text"><span class="eyebrow">${eyebrow}</span><strong>${title}</strong><small>${subtitle}</small></span>
    <span class="cross-link-bar__cta">${label}${icon("arrow", 17)}</span>
  </button></section>`;
}

/* ===== Stitch products: مساعدات المنتجات والمخزون (عرض فقط) ===== */
function productStockPills() {
  const selected = state.productStockFilter || "all";
  const pills = [["all", "الكل"], ["low", "منخفض"], ["out", "نافذ"]];
  return pills.map(([value, label]) => `<button type="button" class="stock-pill stock-pill--${value} ${selected === value ? "is-active" : ""}" data-category-action="product-stock" data-category="${value}">${label}</button>`).join("");
}
function productProfitInfo(product) {
  const purchase = toNumber(product.purchasePrice);
  const sale = toNumber(product.salePrice);
  const profit = sale - purchase;
  return { profit, margin: purchase > 0 ? Math.round((profit / purchase) * 100) : 0 };
}
function productsHeroMarkup() {
  const value = state.dashboard?.inventoryValue ?? 0;
  const lowCount = (state.dashboard?.lowStock || []).length;
  const outCount = state.products.filter((product) => toNumber(product.quantity) <= 0).length;
  return `<section class="pd-hero"><div class="pd-hero__value"><span>قيمة المخزون الإجمالية</span><strong>${money(value)}</strong></div><div class="pd-hero__minis"><div class="pd-mini"><span>إجمالي الأصناف</span><strong>${amount(state.products.length)} صنف</strong></div><button type="button" class="pd-mini pd-mini--alert" data-action="open-reorder-list"><span>تنبيهات المخزون</span><strong>${amount(lowCount + outCount)}</strong></button></div></section>`;
}
async function softDeleteProductById(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return false;
  if (!window.confirm(`هل تريد إخفاء «${product.name}» من القوائم؟ لا يمكن التراجع عن ذلك من الواجهة.`)) return false;
  try {
    const result = await db.softDeleteProduct(id);
    await refresh();
    render();
    showToast(result.linkedSales ? "أُخفي المنتج مع الحفاظ على الفواتير المرتبطة." : "أُخفي المنتج من القائمة.");
    return true;
  } catch (error) { showToast(error.message, "error"); return false; }
}
function recentMovementsMarkup() {
  const products = new Map(state.products.map((product) => [product.id, product]));
  const recent = state.stockMovements.slice(0, 4);
  if (!recent.length) return "";
  return `<section class="panel recent-movements"><div class="panel__head"><div><span class="eyebrow">سجل التدقيق</span><h2>أحدث حركات المخزون</h2></div></div><div class="movement-list">${recent.map((movement) => `<article><div><strong>${escapeHtml(products.get(movement.productId)?.name || "منتج محذوف")}</strong><small>${dateTime(movement.date)} · ${escapeHtml(movement.type)}</small></div><div><strong class="movement-amount ${toNumber(movement.quantity) >= 0 ? "is-positive" : "is-negative"}">${toNumber(movement.quantity) >= 0 ? "+" : ""}${amount(movement.quantity)}</strong><small>${amount(movement.previousQuantity)} ← ${amount(movement.newQuantity)}</small></div></article>`).join("")}</div></section>`;
}

function productsMarkup() {
  const query = state.productQuery.trim().toLocaleLowerCase("ar");
  const stockF = state.productStockFilter || "all";
  const products = state.products.filter((product) => (state.productCategory === "الكل" || (product.category || "أخرى") === state.productCategory) && (stockF === "all" || stockStatus(product.quantity, product.minimumStock) === (stockF === "low" ? "منخفض" : "نافد")) && (!query || [product.name, product.barcode, product.internalCode].some((value) => value?.toLocaleLowerCase("ar").includes(query))));
  return `${topbarMarkup("المنتجات", "ابحث بالاسم أو الباركود أو الكود الداخلي.", `<div class="topbar__actions"><button class="button button--secondary" data-action="navigate" data-view="inventory">${msymbol("layers", "text-[18px]")}<span>المخزون</span></button></div>`)}
  ${saleSyncStrip()}
  ${productsHeroMarkup()}
  <div class="pd-cta"><button class="button button--primary pd-add" data-action="new-product">${msymbol("add", "text-[20px]")}<span>إضافة منتج جديد</span></button><button class="button button--secondary pd-reorder" data-action="open-reorder-list">${msymbol("local_shipping", "text-[20px]")}<span>إعادة الطلب</span></button></div>
  <section class="toolbar"><label class="search-field">${msymbol("search", "text-[20px]")}<input id="product-search" dir="rtl" lang="ar" autocomplete="off" placeholder="ابحث باسم السلعة أو امسح الباركود..." value="${escapeHtml(state.productQuery)}" /></label><button class="button button--secondary button--icon-text" data-action="open-scanner" data-mode="product">${msymbol("qr_code_scanner", "text-[20px]")}<span>مسح باركود</span></button></section>
  <div class="stock-pills" role="group" aria-label="تصفية حسب حالة المخزون">${productStockPills()}</div>
  <div class="category-toolbar"><strong>الأصناف (${amount(state.products.length)})</strong><div class="category-chips">${categoryButtons(state.productCategory, "product-category")}</div></div>
  <section class="panel product-table-panel">${products.length ? `<div class="table-wrap"><table><thead><tr><th>المنتج</th><th>سعر البيع</th><th>الربح</th><th>المخزون</th><th>الحالة</th><th><span class="sr-only">إجراءات</span></th></tr></thead><tbody>${products.map(productRow).join("")}</tbody></table></div><div class="mobile-product-list">${products.map(productCard).join("")}</div>` : emptyState(query || stockF !== "all" ? "لا توجد نتائج مطابقة" : "لم تضف منتجات بعد", query || stockF !== "all" ? "جرّب اسمًا أو رمزًا آخر أو غيّر التصفية." : "أضف أول منتج ليظهر في قائمة التشغيل.")}</section>
  ${crossLinkMarkup("inventory", { eyebrow: "تنقّل سريع", title: "المخزون والكميات", subtitle: "الكميات، الجرد، تعديل الرصيد، وسجل الحركة", label: "فتح المخزون", glyph: "layers" })}`;
}

function productRow(product) {
  const info = productProfitInfo(product);
  return `<tr><td><button class="product-name" data-action="open-product" data-id="${product.id}"><strong dir="rtl">${escapeHtml(product.name)}</strong><small dir="auto">${product.barcode ? `باركود: ${escapeHtml(product.barcode)}` : product.internalCode ? `كود: ${escapeHtml(product.internalCode)}` : "دون رمز"}</small>${expiryMeterMarkup(product)}</button></td><td>${money(product.salePrice)}</td><td class="pro-profit ${info.profit < 0 ? "is-loss" : ""}">${info.profit >= 0 ? "+" : ""}${money(info.profit)}<small>${info.margin >= 0 ? "+" : ""}${amount(info.margin)}%</small></td><td>${amount(product.quantity)} ${escapeHtml(product.unit)}</td><td>${formatStatus(product)}</td><td><div class="product-row-actions">${productSupplierActions(product)}<button class="icon-button" aria-label="جرد ${escapeHtml(product.name)}" title="جرد" data-action="count-stock" data-id="${product.id}">${msymbol("tune", "text-[20px]")}</button><button class="icon-button icon-button--danger" aria-label="حذف ${escapeHtml(product.name)}" title="حذف" data-action="delete-product-direct" data-id="${product.id}">${msymbol("delete", "text-[20px]")}</button><button class="icon-button" aria-label="خيارات ${escapeHtml(product.name)}" data-action="open-product" data-id="${product.id}">${msymbol("edit", "text-[20px]")}</button></div></td></tr>`;
}

function productCard(product) {
  const info = productProfitInfo(product);
  const supplier = state.productSuppliers?.[product.id];
  const code = product.barcode || product.internalCode || "";
  return `<article class="product-card pd-card"><div class="pd-card__top"><div class="pd-tile">${msymbol(saleCategoryIcon(product.category), "pd-tile__icon")}</div><div class="pd-card__head"><div class="pd-card__title"><button class="product-card__main" data-action="open-product" data-id="${product.id}"><strong dir="rtl">${escapeHtml(product.name)}</strong></button>${saleStockBadge(product)}</div>${code ? `<small class="pd-code" dir="ltr">${escapeHtml(code)}</small>` : ""}${expiryMeterMarkup(product)}${expiryStatusMarkup(product)}</div></div><div class="pd-prices"><div><span>سعر البيع</span><strong>${money(product.salePrice)}</strong></div><div><span>التكلفة</span><strong>${money(product.purchasePrice)}</strong></div><div><span>الربح المتوقع</span><strong class="${info.profit < 0 ? "is-loss" : "is-profit"}">${info.profit >= 0 ? "+" : ""}${money(info.profit)}<small>${info.margin >= 0 ? "+" : ""}${amount(info.margin)}%</small></strong></div></div><div class="pd-supplier"><span>المورد: ${supplier ? escapeHtml(supplier.name) : "—"}</span>${productSupplierActions(product)}</div><div class="pd-card__actions"><button class="button button--secondary pd-count" data-action="count-stock" data-id="${product.id}">${msymbol("tune", "text-[19px]")}<span>تعديل الكمية (جرد)</span></button><button class="icon-button pd-edit" aria-label="تعديل ${escapeHtml(product.name)}" title="تعديل" data-action="open-product" data-id="${product.id}">${msymbol("edit", "text-[20px]")}</button><button class="icon-button icon-button--danger pd-delete" aria-label="حذف ${escapeHtml(product.name)}" title="حذف" data-action="delete-product-direct" data-id="${product.id}">${msymbol("delete", "text-[20px]")}</button></div></article>`;
}

function productSupplierActions(product) {
  const supplier = state.productSuppliers?.[product.id];
  if (!supplier) return "";
  return `<div class="product-supplier-actions"><button class="icon-button icon-button--supplier" data-action="open-supplier-account" data-id="${supplier.id}" aria-label="حساب المورد ${escapeHtml(supplier.name)}" title="حساب المورد: ${escapeHtml(supplier.name)}">${msymbol("local_shipping", "text-[19px]")}</button>${phoneCallButton(supplier.phone, supplier.name)}</div>`;
}

function openReorderDialog() {
  const lowProducts = state.products.filter((product) => toNumber(product.quantity) <= toNumber(product.minimumStock));
  const groups = lowProducts.reduce((map, product) => {
    const supplier = state.productSuppliers?.[product.id] || null;
    const key = supplier?.id || "unassigned";
    const group = map.get(key) || { supplier, products: [] };
    group.products.push(product); map.set(key, group); return map;
  }, new Map());
  const groupText = (group) => [`قائمة إعادة طلب من ${group.supplier?.name || "مورد غير محدد"}`, ...group.products.map((product) => `- ${product.name}: المتاح ${amount(product.quantity)} ${product.unit}، الحد الأدنى ${amount(product.minimumStock)} ${product.unit}`)].join("\n");
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">تنبيه إعادة الطلب</span><h2>المنتجات المنخفضة أو النافدة</h2><p class="dialog__subtext">تُجمع النواقص بحسب آخر مورد ورد المنتج، لتتمكن من المراجعة والاتصال أو المشاركة سريعًا.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div>${groups.size ? `<section class="account-transactions">${[...groups.entries()].map(([key, group]) => `<article class="reorder-group"><div class="reorder-group__head"><div><strong>${escapeHtml(group.supplier?.name || "منتجات بلا مورد مرتبط")}</strong><small>${group.products.length} أصناف تحتاج إعادة طلب</small></div><div class="product-supplier-actions">${group.supplier ? `<button class="icon-button icon-button--supplier" data-reorder-supplier="${group.supplier.id}" aria-label="حساب المورد">${msymbol("local_shipping", "text-[18px]")}</button>${phoneCallButton(group.supplier.phone, group.supplier.name)}` : ""}<button class="button button--secondary" data-share-reorder="${key}">مشاركة القائمة</button></div></div><div class="warning-list">${group.products.map((product) => `<button class="warning-row" data-reorder-product="${product.id}"><div class="warning-row__icon">${msymbol("inventory_2", "text-[18px]")}</div><div><strong>${escapeHtml(product.name)}</strong><small>المتاح ${amount(product.quantity)} ${escapeHtml(product.unit)} · الحد ${amount(product.minimumStock)} ${escapeHtml(product.unit)}</small></div>${formatStatus(product)}</button>`).join("")}</div></article>`).join("")}</section>` : `<div class="inline-empty">لا توجد منتجات منخفضة أو نافدة حاليًا.</div>`}<div class="dialog__actions"><button class="button button--primary" data-dialog-close>إغلاق</button></div></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelectorAll("[data-reorder-supplier]").forEach((button) => button.addEventListener("click", () => { closeDialog(); openSupplierAccountDialog(button.dataset.reorderSupplier); }));
  overlay.querySelectorAll("[data-reorder-product]").forEach((button) => button.addEventListener("click", () => { closeDialog(); openProductDialog(state.products.find((product) => product.id === button.dataset.reorderProduct)); }));
  overlay.querySelectorAll("[data-share-reorder]").forEach((button) => button.addEventListener("click", async () => { const group = groups.get(button.dataset.shareReorder); const text = groupText(group); try { if (navigator.share) await navigator.share({ title: "قائمة إعادة طلب — حسابي", text }); else { await navigator.clipboard.writeText(text); showToast("تم نسخ قائمة إعادة الطلب للمشاركة"); } } catch (error) { if (error?.name !== "AbortError") showToast("تعذرت مشاركة قائمة إعادة الطلب.", "error"); } }));
}

function inventoryMarkup() {
  const query = state.inventoryQuery.trim().toLocaleLowerCase("ar");
  const priority = (product) => { const expiry = expiryStatus(product); if (expiry?.tone === "danger") return 0; if (expiry?.tone === "warning") return 1; return { "نافد": 2, "منخفض": 3, "متوفر": 4 }[stockStatus(product.quantity, product.minimumStock)]; };
  const products = [...state.products].filter((product) => (state.inventoryCategory === "الكل" || (product.category || "أخرى") === state.inventoryCategory) && (!query || [product.name, product.barcode, product.internalCode].some((value) => value?.toLocaleLowerCase("ar").includes(query)))).sort((a, b) => priority(a) - priority(b) || a.name.localeCompare(b.name, "ar"));
  const expiringProducts = products.map((product) => ({ product, expiry: expiryStatus(product) })).filter(({ expiry }) => expiry);
  const urgentExpiryCount = expiringProducts.filter(({ expiry }) => expiry.tone === "danger").length;
  const warningExpiryCount = expiringProducts.length - urgentExpiryCount;
  return `${topbarMarkup("المخزون", "عدّل الكميات من حركة موثقة، وليس من بطاقة المنتج.")}
  ${saleSyncStrip()}
  <section class="inventory-summary"><div><span>إجمالي قيمة المخزون</span><strong>${money(state.dashboard.inventoryValue)}</strong></div><div><span>عدد المنتجات</span><strong>${amount(state.products.length)} منتج</strong></div><div><span>منخفض أو نافد</span><strong>${amount(state.dashboard.lowStock.length)} منتج</strong></div></section>
  <section class="toolbar"><label class="search-field">${msymbol("search", "text-[20px]")}<input id="inventory-search" dir="rtl" lang="ar" autocomplete="off" placeholder="ابحث باسم الصنف أو الباركود..." value="${escapeHtml(state.inventoryQuery)}" /></label></section>
  <div class="category-toolbar"><strong>أصناف المخزون (${amount(products.length)})</strong><div class="category-chips">${categoryButtons(state.inventoryCategory, "inventory-category")}</div></div>
  ${expiringProducts.length ? `<section class="expiry-inventory-alert ${urgentExpiryCount ? "expiry-inventory-alert--danger" : "expiry-inventory-alert--warning"}"><div><strong>تنبيه انتهاء الصلاحية</strong><span>${amount(expiringProducts.length)} منتج وصل إلى 85% من مدة صلاحيته أو اقترب انتهاؤه</span></div><small>${urgentExpiryCount ? `${amount(urgentExpiryCount)} منتج ينتهي خلال شهر أو أقل.` : "افتح المنتجات المعلَّمة لمراجعة التاريخ والكمية."}</small></section>` : ""}
  <section class="panel inventory-list">${products.length ? products.map((product) => `<article class="inventory-row inv-card"><div class="inventory-row__main"><div class="inventory-icon">${msymbol(saleCategoryIcon(product.category), "text-[24px]")}</div><div><strong dir="rtl">${escapeHtml(product.name)}</strong><small dir="auto">${escapeHtml(product.barcode || "دون باركود")} · ${escapeHtml(product.category || product.unit)} · شراء: ${money(product.purchasePrice)} · بيع: ${money(product.salePrice)}</small><small>قيمة المخزون: ${money(product.purchasePrice * product.quantity)}</small>${expiryMeterMarkup(product)}${expiryStatusMarkup(product)}</div></div><div class="inventory-row__stock"><div>${formatStatus(product)}<strong>${amount(product.quantity)} <small>${escapeHtml(product.unit)}</small></strong></div>${productSupplierActions(product)}<button class="button button--secondary" data-action="count-stock" data-id="${product.id}">${msymbol("tune", "text-[18px]")}<span>جرد</span></button><button class="button button--secondary" data-action="adjust-stock" data-id="${product.id}">${msymbol("edit", "text-[18px]")}<span>تعديل</span></button><button class="icon-button" data-action="open-stock-history" data-id="${product.id}" aria-label="سجل الحركة" title="سجل الحركة">${msymbol("history", "text-[20px]")}</button></div></article>`).join("") : emptyState("المخزون بانتظار أول منتج", "أضف منتجًا مع كمية افتتاحية ليظهر هنا.")}</section>
  ${recentMovementsMarkup()}
  <div class="dialog__actions"><button class="button button--secondary button--wide" data-action="open-stock-history">${msymbol("history", "text-[19px]")} سجل حركة المخزون</button></div>
  ${crossLinkMarkup("products", { eyebrow: "تنقّل سريع", title: "المنتجات والأسعار", subtitle: "إضافة منتج، تعديل الأسعار، والباركود", label: "فتح المنتجات", glyph: "package" })}
  <section class="reports-bottom-action inventory-audit-entry"><div><span class="eyebrow">الجرد والمراجعة</span><strong>الجرد المحاسبي الدوري</strong><small>راجع قيمة المخزون والأرصدة واعتمد لقطة شهرية أو سنوية للمقارنة.</small></div><button class="button button--primary" data-action="navigate" data-view="periodic-inventory">فتح الجرد المحاسبي ${msymbol("layers", "text-[19px]")}</button></section>`;
}

/* ===== سلة البيع كورقة سفلية في الهاتف (شكل فقط) =====
   لا قراءة من القاعدة ولا كتابة فيها: كل ما تفعله هذه الدوال هو ضبط ارتفاع وقوائم أصناف
   على عنصرين موجودين. المنطق المحاسبي ومسار البيع يمرّان كما كانا تمامًا. */
const SALES_SHEET_PEEK_RATIO = 0.46; // النصف السفلي تقريبًا للسلة كما طلب البائع
const SALES_SHEET_EMPTY_PEEK = 146; // سلة فارغة ⇒ شريط صغير لا نصف شاشة ميتة
const SALES_SHEET_EDGE = 8;
const SALES_SHEET_SNAP = 0.3; // نسبة السحب اللازمة للتحوّل إلى ملء الشاشة
const SALES_SHEET_FLICK = 0.5; // أو دفعة سريعة بالبكسل/المللي ثانية

const salesSheetIsMobile = () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 599px)").matches;

/** أدنى ارتفاع للورقة: ما يظهر المقبض والرأس والإجمالي بلا قصّ (الأسطر وحدها تُقصّ وتتمرّر). */
function salesSheetBarHeight(panel) {
  const parts = [".cart-sheet__handle", ".cart-panel__head", ".cart-total"].map((selector) => panel?.querySelector(selector)?.offsetHeight || 0);
  const shown = parts.filter((height) => height > 0);
  if (!shown.length) return 0;
  const styles = panel ? getComputedStyle(panel) : null;
  const pad = styles ? (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0) : 0;
  const gap = styles ? parseFloat(styles.rowGap) || 0 : 0;
  return Math.ceil(pad + shown.reduce((sum, height) => sum + height, 0) + gap * (shown.length - 1));
}

function salesSheetGeometry(panel) {
  const viewport = Math.round(window.visualViewport?.height || window.innerHeight || 640);
  const nav = Math.round(document.querySelector(".bottom-nav")?.getBoundingClientRect().height || 0);
  const full = Math.max(260, viewport - nav - SALES_SHEET_EDGE * 2);
  const bar = salesSheetBarHeight(panel || document.querySelector(".cart-panel.cart-sheet"));
  const wanted = state.cart.length ? viewport * SALES_SHEET_PEEK_RATIO : SALES_SHEET_EMPTY_PEEK;
  const peek = Math.max(120, bar, Math.round(wanted));
  return { full, peek: Math.min(full, peek), nav, bar };
}

/** آخر هندسة مقيسة تُكتب في القالب نفسه: بلا هذا التلميح تُرسم الورقة إطارًا بلا طبقتها
    وبلا ارتفاعها (افتراضي CSS ثم قفزة إلى المقيس) — وهو ما كان يظهر انكماشًا وتمدّدًا مع كل ضغطة. */
const salesSheetPaint = { mobile: false, height: 0, nav: 0, reserve: 0 };
let salesSheetAnimTimer = 0;

function salesSheetPaintStyle(kind) {
  if (!salesSheetPaint.mobile || salesSheetPaint.height <= 0) return "";
  return kind === "layout"
    ? ` style="--sales-sheet-reserve:${salesSheetPaint.reserve}px"`
    : ` style="--sales-sheet-h:${salesSheetPaint.height}px;--sales-sheet-nav:${salesSheetPaint.nav}px"`;
}

/** يضبط الارتفاعات بخصائص CSS، فتبقى القواعد في style.css والقياس هنا فقط. */
function applySalesSheetGeometry() {
  const panel = root.querySelector(".cart-panel.cart-sheet");
  const layout = root.querySelector(".sales-layout");
  const mobile = Boolean(panel && layout) && salesSheetIsMobile();
  // طبقتا <html> تصحبان الورقة دائمًا: مغادرة صفحة المبيعات تُحرّر قفل التمرير وتُظهر زر الماسح
  document.documentElement.classList.toggle("is-sales-sheet-mobile", mobile);
  document.documentElement.classList.toggle("is-sales-sheet-open", mobile && state.salesSheet === "full");
  if (!panel || !layout) return false;
  panel.classList.toggle("is-sheet-mobile", mobile);
  if (!mobile) {
    panel.style.removeProperty("--sales-sheet-h");
    panel.style.removeProperty("--sales-sheet-nav");
    layout.style.removeProperty("--sales-sheet-reserve");
    delete panel.dataset.sheet;
    salesSheetPaint.mobile = false;
    salesSheetPaint.height = 0;
    salesSheetPaint.reserve = 0;
    panel.classList.remove("is-sheet-animating");
    return true;
  }
  const { full, peek, nav } = salesSheetGeometry(panel);
  const height = state.salesSheet === "full" ? full : peek;
  panel.dataset.sheet = state.salesSheet === "full" ? "full" : "peek";
  panel.dataset.cartEmpty = state.cart.length ? "0" : "1";
  panel.style.setProperty("--sales-sheet-h", `${height}px`);
  panel.style.setProperty("--sales-sheet-nav", `${nav}px`);
  layout.style.setProperty("--sales-sheet-reserve", `${peek + SALES_SHEET_EDGE * 2 + 14}px`);
  salesSheetPaint.mobile = true;
  salesSheetPaint.height = height;
  salesSheetPaint.nav = nav;
  salesSheetPaint.reserve = peek + SALES_SHEET_EDGE * 2 + 14;
  return true;
}

/** يبدّل الحالة بلا إعادة رسم: يحفظ موضع التمرير ويجعل الحركة انتقالية لا قفزة. */
function commitSalesSheet(mode) {
  const next = mode === "full" ? "full" : "peek";
  const changed = state.salesSheet !== next;
  state.salesSheet = next;
  // الانتقالي يعمل فقط حين يقرّر المستخدم التبديل أو يُفلت السحب — لا عند إعادة التصيير.
  const animated = root.querySelector(".cart-panel.cart-sheet");
  if (changed && animated?.classList.contains("is-sheet-mobile")) {
    animated.classList.add("is-sheet-animating");
    // المتصفح لا يشغّل انتقالًا أُضيف في نفس تحديث النمط: نُثبّت النمط أولًا ثم نُغيّر الارتفاع.
    void animated.offsetHeight;
    window.clearTimeout(salesSheetAnimTimer);
    salesSheetAnimTimer = window.setTimeout(() => animated.classList.remove("is-sheet-animating"), 280);
  }
  if (!applySalesSheetGeometry()) return state.salesSheet;
  const panel = root.querySelector(".cart-panel.cart-sheet");
  const handle = panel?.querySelector(".cart-sheet__handle");
  if (handle) {
    handle.setAttribute("aria-expanded", next === "full" ? "true" : "false");
    handle.setAttribute("aria-label", next === "full" ? "تصغير سلة البيع" : "توسيع سلة البيع إلى كامل الشاشة");
    const label = handle.querySelector(".cart-sheet__label");
    if (label) label.textContent = next === "full" ? "تصغير السلة" : "توسيع السلة";
  }
  return next;
}

let salesSheetGesturesInstalled = false;
/** السحب بالإصبع من المقبض فقط — جسم السلة يبقى للتمرير العادي، فلا تعارض لمسات. */
function installSalesSheetGestures() {
  if (salesSheetGesturesInstalled) return;
  salesSheetGesturesInstalled = true;
  let drag = null;
  const onDown = (event) => {
    const handle = event.target.closest?.(".cart-sheet__handle");
    const panel = handle?.closest(".cart-panel.cart-sheet");
    if (!panel || !salesSheetIsMobile() || event.pointerType === "mouse") return;
    const { full, peek } = salesSheetGeometry(panel);
    drag = {
      handle,
      panel,
      startY: event.clientY,
      startHeight: Math.round(panel.getBoundingClientRect().height) || (state.salesSheet === "full" ? full : peek),
      from: state.salesSheet === "full" ? full : peek,
      full,
      peek,
      lastY: event.clientY,
      lastT: event.timeStamp || Date.now(),
      velocity: 0,
      moved: 0,
    };
    panel.classList.add("is-dragging");
    handle.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event) => {
    if (!drag) return;
    const dy = event.clientY - drag.startY;
    drag.moved = Math.max(drag.moved, Math.abs(dy));
    const now = event.timeStamp || Date.now();
    const dt = Math.max(1, now - drag.lastT);
    drag.velocity = (drag.lastY - event.clientY) / dt; // موجب = للأعلى
    drag.lastY = event.clientY;
    drag.lastT = now;
    // من peek: نتحرك للأعلى فقط (سالب dy)، ومن full: للأسفل فقط — بلا مطاط زائد
    const target = drag.from - dy;
    const clamped = Math.round(Math.min(drag.full, Math.max(drag.peek, target)));
    drag.current = clamped;
    drag.panel.style.setProperty("--sales-sheet-h", `${clamped}px`);
    if (Math.abs(dy) > 4) event.preventDefault();
  };
  const onUp = () => {
    if (!drag) return;
    const { panel, full, peek, velocity } = drag;
    panel.classList.remove("is-dragging");
    // نقرة بلا حركة: لا قرار هنا — زر المقبض (data-action) يتكفّل بالتبديل
    if (drag.moved < 8) {
      drag = null;
      applySalesSheetGeometry();
      return;
    }
    const height = drag.current ?? drag.from;
    const progress = full > peek ? (height - peek) / (full - peek) : 0;
    const flickUp = velocity > SALES_SHEET_FLICK;
    const flickDown = velocity < -SALES_SHEET_FLICK;
    const wantsFull = drag.from === peek ? progress > SALES_SHEET_SNAP || flickUp : !(progress < 1 - SALES_SHEET_SNAP || flickDown);
    drag = null;
    commitSalesSheet(wantsFull ? "full" : "peek");
  };
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  // Escape يُغلق الورقة المفتوحة كما يُغلق أي طبقة علوية
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.salesSheet === "full") {
      event.preventDefault();
      commitSalesSheet("peek");
    }
  });
  const onResize = () => {
    if (state.view === "sales") applySalesSheetGeometry();
  };
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
}

const SALES_CATALOG_LIMIT = 40;

/* ترتيب الأصناف المعروضة في صفحة المبيعات: الأحدث بيعًا ثم الأكثر مبيعًا، ثم باقي المتوفر.
   يعتمد على state.saleItems و state.sales المحمّلين أصلًا — لا قراءة جديدة ولا كتابة على القاعدة. */
const salesRankCache = new WeakMap();
function salesRankedProducts() {
  const key = state.saleItems;
  const products = state.products;
  if (!Array.isArray(key) || !key.length) return products;
  const cached = salesRankCache.get(key);
  if (cached && cached.products === products) return cached.ranked;
  const lastSoldAt = new Map();
  const soldQuantity = new Map();
  const saleDateById = new Map(state.sales.map((sale) => [sale.id, String(sale.date || "")]));
  for (const item of key) {
    const id = item.productId;
    if (!id) continue;
    soldQuantity.set(id, (soldQuantity.get(id) || 0) + toNumber(item.quantity));
    const at = saleDateById.get(item.saleId) || "";
    if (at && (!lastSoldAt.has(id) || at > lastSoldAt.get(id))) lastSoldAt.set(id, at);
  }
  const ranked = products
    .map((product) => ({ product, sold: soldQuantity.get(product.id) || 0, lastSoldAt: lastSoldAt.get(product.id) || "" }))
    .sort((a, b) => {
      if (a.lastSoldAt !== b.lastSoldAt) return a.lastSoldAt < b.lastSoldAt ? 1 : -1;
      if (a.sold !== b.sold) return b.sold - a.sold;
      return String(a.product.name || "").localeCompare(String(b.product.name || ""), "ar");
    })
    .map((entry) => entry.product);
  salesRankCache.set(key, { products, ranked });
  return ranked;
}

/* ===== Stitch POS: مساعدات شاشة البيع (عرض فقط، لا تمس الحسابات) ===== */
const SALE_CATEGORY_ICONS = [
  [["مشروبات", "مياه", "عصير", "شاي", "قهوة"], "local_drink"],
  [["حلويات", "بسكويت", "شوكولاتة", "كيك"], "cookie"],
  [["منظفات", "صابون", "غسيل"], "cleaning_services"],
  [["زيوت", "سمن", "زبدة"], "oil_barrel"],
  [["خضار", "فواكه", "تفاح"], "apple"],
  [["لحوم", "دواجن", "أسماك", "دجاج"], "set_meal"],
  [["مخبوزات", "خبز", "فطائر"], "bakery_dining"],
  [["ألبان", "أجبان", "حليب", "بيض"], "egg"],
  [["معلبات", "بقوليات", "حبوب", "أرز", "سكر", "دقيق"], "shopping_basket"],
];
function saleCategoryIcon(category) {
  const name = String(category || "");
  const hit = SALE_CATEGORY_ICONS.find(([words]) => words.some((word) => name.includes(word)));
  return hit ? hit[1] : "inventory_2";
}
function saleStockBadge(product) {
  const status = stockStatus(toNumber(product.quantity), toNumber(product.minimumStock));
  const tone = status === "نافد" ? "out" : status === "منخفض" ? "low" : "ok";
  return `<span class="sp-badge sp-badge--${tone}">${status} (${amount(product.quantity)})</span>`;
}
function saleCategoryChips() {
  const selected = state.saleCategory || "الكل";
  return ["الكل", ...categoryOptions()].map((category) => `<button type="button" class="sale-chip ${selected === category ? "is-active" : ""}" data-category-action="sale-category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
}
function saleSyncStrip() {
  return `<div class="sale-sync-strip">${msymbol("cloud_done", "text-[18px]")}<span>البيانات سريعة ومحفوظة محلياً (IndexedDB)</span><span class="sale-sync-strip__live"><span class="sale-sync-dot"></span>مزامنة فورية</span></div>`;
}

function salesMarkup() {
  const query = state.saleQuery.trim().toLocaleLowerCase("ar");
  const saleCat = state.saleCategory || "الكل";
  const cartProductIds = new Set(state.cart.map((line) => line.productId));
  const ranked = salesRankedProducts().filter((product) => !query || [product.name, product.barcode, product.internalCode].some((value) => value?.toLocaleLowerCase("ar").includes(query))).filter((product) => saleCat === "الكل" || (product.category || "أخرى") === saleCat);
  const matches = ranked.slice(0, SALES_CATALOG_LIMIT);
  const totals = calculateSaleTotals(state.cart);
  const heldCount = state.heldInvoices?.length || 0;
  const cartCount = state.cart.reduce((sum, line) => sum + toNumber(line.quantity), 0);
  const topbarActions = `<div class="sales-topbar-actions"><button class="button button--secondary" data-action="navigate" data-view="invoices">${msymbol("receipt_long", "text-[18px]")}<span>الفواتير</span></button>${heldCount ? `<button class="button button--secondary button--compact held-topbar-btn" data-action="open-held-invoices" title="الفواتير المعلقة">${msymbol("schedule", "text-[17px]")}<span>معلقة (${heldCount})</span></button>` : ""}</div>`;
  return `<h1 class="sr-only">بيع جديد</h1>${saleSyncStrip()}
  ${topbarActions}
  <section class="sales-layout"${salesSheetPaintStyle("layout")}><div class="sales-catalog"><div class="toolbar toolbar--sales"><label class="search-field">${msymbol("search", "text-[20px]")}<input id="sale-search" dir="rtl" lang="ar" autocomplete="off" placeholder="ابحث باسم المنتج أو الباركود..." value="${escapeHtml(state.saleQuery)}" /></label><button class="button button--secondary button--scan" data-action="open-scanner" data-mode="sale" aria-label="مسح الباركود" title="مسح باركود">${msymbol("qr_code_scanner", "text-[22px]")}</button></div><p class="desktop-barcode-reader-note">${msymbol("qr_code_scanner", "text-[16px]")} قارئ الباركود المتصل بالكمبيوتر يعمل مباشرةً في صفحة المبيعات؛ امسح الرمز ثم Enter أو Tab.</p>
  <div class="sale-chips" role="group" aria-label="تصفية حسب الصنف">${saleCategoryChips()}</div>
  <div class="sale-section-head"><div><strong>المنتجات السريعة</strong><span class="sale-section-count">${ranked.length === 1 ? "صنف واحد" : ranked.length === 2 ? "صنفان" : `${amount(ranked.length)} أصناف`}</span></div><small>انقر للإضافة الفورية للسلة</small></div>
  <div class="sale-matches">${state.products.length === 0 ? emptyState("أضف منتجاتك أولًا", "تحتاج المبيعات إلى منتجات محفوظة في المخزون.") : matches.length ? matches.map((product) => {
    const isFlash = state.lastAddedProductId === product.id;
    const inCart = cartProductIds.has(product.id);
    const cartQty = inCart ? state.cart.reduce((sum, line) => (line.productId === product.id ? sum + toNumber(line.quantity) : sum), 0) : 0;
    const soldOut = product.quantity <= 0 && !state.settings?.allowNegativeSales;
    const code = product.barcode || product.internalCode || "";
    return `<div class="sale-product-line"><button class="sale-product ${soldOut ? "is-disabled" : ""} ${inCart ? "is-in-cart" : ""} ${isFlash ? "is-flash-added" : ""}" data-action="add-cart" data-id="${product.id}" ${soldOut ? "disabled" : ""} aria-pressed="${inCart}"${inCart ? ` title="${escapeHtml(product.name)}: ${amount(cartQty)} ${escapeHtml(product.unit)} في السلة الحالية"` : ""}><div class="sp-media">${msymbol(saleCategoryIcon(product.category), "sp-media__icon")}${saleStockBadge(product)}${soldOut ? `<span class="sp-soldout">${msymbol("lock", "text-[16px]")}<span>منع البيع - مخزون نافذ</span></span>` : ""}</div>${code ? `<div class="sp-code" dir="ltr">${escapeHtml(code)}</div>` : ""}<strong class="arabic-product-name" dir="rtl" lang="ar">${escapeHtml(product.name)}</strong><small>${amount(product.quantity)} ${escapeHtml(product.unit)} متاح${inCart ? ` · ${amount(cartQty)} في السلة` : ""}</small><div class="sp-foot"><span class="sp-price">${money(product.salePrice)}</span><i class="${inCart ? "sale-product__count" : ""}"${inCart ? ` dir="ltr" aria-label="${amount(cartQty)} في السلة"` : ""}>${inCart ? (cartQty > 1 ? `${amount(cartQty)}` : icon("check", 18)) : icon("plus", 18)}</i></div></button>${productSupplierActions(product)}</div>`;
  }).join("") : `<div class="no-match"><strong>لا توجد نتيجة</strong><span>تحقق من الاسم أو الباركود أو أضف منتجًا جديدًا.</span><button class="text-button" data-action="new-product">إنشاء منتج</button></div>`}</div></div>
  <aside class="cart-panel cart-sheet${salesSheetPaint.mobile ? " is-sheet-mobile" : ""}"${salesSheetPaintStyle("panel")} data-sheet="${state.salesSheet === "full" ? "full" : "peek"}" data-cart-empty="${state.cart.length ? "0" : "1"}"><button class="cart-sheet__handle" type="button" data-action="toggle-sales-sheet" aria-expanded="${state.salesSheet === "full" ? "true" : "false"}" aria-label="${state.salesSheet === "full" ? "تصغير سلة البيع" : "توسيع السلة إلى كامل الشاشة"}"><span class="cart-sheet__grip" aria-hidden="true"></span><span class="cart-sheet__label">${state.salesSheet === "full" ? "تصغير السلة" : "توسيع السلة"}</span></button><div class="cart-panel__head"><div><span class="eyebrow">سلة البيع</span><h2>${state.cart.length ? `${amount(state.cart.length)} أصناف · ${amount(cartCount)} قطع` : "فارغة الآن"}</h2></div><div class="cart-head-actions"><button class="cart-sheet-close" type="button" data-action="close-sales-sheet" aria-label="إغلاق نافذة السلة" title="إغلاق نافذة السلة">${msymbol("close", "text-[18px]")}</button>${heldCount ? `<button class="button button--secondary button--compact held-badge-btn" data-action="open-held-invoices" title="عرض الفواتير المعلقة">${msymbol("schedule", "text-[16px]")}<span>معلقة (${heldCount})</span></button>` : ""}${state.cart.length ? `<button class="button button--secondary button--compact" data-action="hold-cart" title="تعليق الفاتورة الحالية">${msymbol("pause", "text-[16px]")}<span>تعليق</span></button><button class="text-button text-button--danger" data-action="clear-cart">إفراغ</button>` : ""}</div></div>
  <div class="cart-lines">${state.cart.length ? state.cart.map(cartLine).join("") : `<div class="cart-empty">${msymbol("shopping_cart", "text-[30px]")}<p>اختر منتجًا من القائمة لتبدأ البيع.</p></div>`}</div>
  <div class="cart-total"><div class="cart-total__summary"><div><span>إجمالي السلة${state.cart.length ? ` · ${amount(state.cart.length)} أصناف` : ""}</span><strong data-cart-subtotal>${money(totals.subtotal)}</strong></div></div><div class="cart-actions-grid">${state.cart.length ? `<button class="button button--secondary button--hold" data-action="hold-cart" title="تعليق الفاتورة مؤقتًا">${msymbol("pause", "text-[18px]")}<span>تعليق</span></button><button class="button tender-btn" data-action="checkout" data-checkout-method="نقدي" title="إتمام البيع نقدًا">${msymbol("payments", "text-[19px]")}<span>نقدي (كاش)</span></button><button class="button tender-btn" data-action="checkout" data-checkout-method="تحويل" title="إتمام البيع بتحويل">${msymbol("account_balance", "text-[19px]")}<span>تحويل</span></button>` : ""}<button class="button button--primary ${state.cart.length ? "checkout-launch" : "button--wide"}" data-action="checkout" ${state.cart.length ? "" : "disabled"}>${state.cart.length ? `تأكيد وإصدار الفاتورة · ${money(totals.total)}` : "إتمام البيع"} ${msymbol("receipt_long", "text-[20px]")}</button></div></div></aside></section><section class="sales-bottom-action"><div><span class="eyebrow">سجل المبيعات</span><strong>فواتير المبيعات</strong><small>اعرض الفواتير المحفوظة وابحث عنها وراجع تفاصيل كل فاتورة.</small></div><button class="button button--primary" data-action="navigate" data-view="invoices">${msymbol("receipt_long", "text-[22px]")}<span>الانتقال إلى فواتير المبيعات</span></button></section>`;
}

function cartLine(line) {
  const product = state.products.find((item) => item.id === line.productId);
  const unitsPerPackage = Math.max(1, Math.floor(toNumber(line.unitsPerPackage ?? product?.unitsPerPackage) || 1)); const packageUnit = line.packageUnit || product?.purchasePackageUnit || "كرتون"; const soldAsPackage = Boolean(line.soldAsPackage && unitsPerPackage > 1); const cartonCount = Math.max(1, Math.round(toNumber(line.quantity) / unitsPerPackage)); const totals = calculateSaleTotals([line]); const canSellCarton = unitsPerPackage > 1 && (state.settings?.allowNegativeSales || toNumber(product?.quantity) >= unitsPerPackage);
  const quantityInput = soldAsPackage ? `<input data-cart-carton-count="${line.productId}" type="number" inputmode="numeric" min="1" ${state.settings?.allowNegativeSales ? "" : `max="${Math.floor(toNumber(product?.quantity) / unitsPerPackage)}"`} step="1" value="${cartonCount}" aria-label="عدد الكراتين" />` : `<input data-cart-quantity="${line.productId}" type="number" inputmode="decimal" min="1" ${state.settings?.allowNegativeSales ? "" : `max="${toNumber(product?.quantity)}"`} step="1" value="${line.quantity}" aria-label="عدد الحبات" />`;
  const cashierHint = state.currentUser?.role === "cashier" ? "حد الكاشير: 10% من قيمة السطر." : "مثال: 100 أو 10%";
  const isFlash = state.lastAddedProductId === line.productId;
  return `<article class="cart-line ${soldAsPackage ? "cart-line--package" : ""} ${isFlash ? "is-flash-added" : ""}"><div class="cart-line__detail"><strong class="arabic-product-name" dir="rtl" lang="ar">${escapeHtml(line.name)}</strong><small>${money(line.unitPrice)} × ${amount(line.quantity)} ${escapeHtml(product?.unit || "حبة")}${soldAsPackage ? ` · ${amount(cartonCount)} ${escapeHtml(packageUnit)}` : ""}</small></div><strong data-cart-line-total="${line.productId}">${money(totals.total)}</strong><label class="cart-line__price ${state.settings?.allowSalePriceEdit ? "" : "cart-line__price--locked"}" title="${state.settings?.allowSalePriceEdit ? "يمكن تعديل السعر قبل إتمام البيع" : "تعديل السعر معطل من الإعدادات"}"><span>سعر البيع</span><input data-cart-line-price="${line.productId}" type="number" inputmode="decimal" min="0" step="0.01" value="${escapeHtml(line.unitPrice)}" aria-label="سعر بيع ${escapeHtml(line.name)}" ${state.settings?.allowSalePriceEdit ? "" : "disabled"} /></label><div class="cart-line__controls"><div class="quantity-control quantity-control--dark"><button aria-label="إنقاص ${soldAsPackage ? "كرتون" : "حبة"}" data-action="cart-decrement" data-id="${line.productId}">${msymbol("remove", "text-[16px]")}</button>${quantityInput}<button aria-label="زيادة ${soldAsPackage ? "كرتون" : "حبة"}" data-action="cart-increment" data-id="${line.productId}">${msymbol("add", "text-[16px]")}</button></div>${unitsPerPackage > 1 ? `<button class="carton-toggle ${soldAsPackage ? "is-active" : ""}" data-action="toggle-carton-sale" data-id="${line.productId}" ${canSellCarton ? "" : "disabled"} aria-pressed="${soldAsPackage}" aria-label="${soldAsPackage ? "العودة للبيع بالحبات" : `بيع ${packageUnit}`}" title="${soldAsPackage ? "العودة للبيع بالحبات" : `بيع ${packageUnit}: ${unitsPerPackage} حبة`}">${msymbol("inventory_2", "text-[18px]")}</button>` : ""}<label class="cart-line__discount" title="خصم السطر بالمبلغ أو النسبة"><span>خصم</span><input data-cart-line-discount="${line.productId}" type="text" inputmode="decimal" maxlength="4" value="${escapeHtml(line.discount || "")}" placeholder="خصم" autocomplete="off" aria-label="خصم السطر" /></label></div>${soldAsPackage ? `<div class="cart-line__package"><span>${escapeHtml(packageUnit)} =</span><label><input data-cart-carton-size="${line.productId}" type="number" inputmode="numeric" min="1" ${state.settings?.allowNegativeSales ? "" : `max="${toNumber(product?.quantity)}"`} step="1" value="${unitsPerPackage}" /> حبة</label><small>يمكن تعديل عدد الحبات في هذا البيع فقط.</small></div>` : ""}<div class="cart-line__discount-wrap"><small class="cart-line__discount-note">${cashierHint}${toNumber(totals.discount) ? ` · الخصم الحالي ${money(totals.discount)}` : ""}</small></div><button class="remove-line" aria-label="حذف من السلة" data-action="cart-remove" data-id="${line.productId}">${msymbol("close", "text-[17px]")}</button></article>`;
}

function invoiceCashierName(invoice) { return invoice?.cashierName || state.accounts.find((account) => account.id === invoice?.cashierId)?.name || "الأدمن"; }
function invoiceWithCashier(invoice) { return invoice ? { ...invoice, cashierName: invoiceCashierName(invoice) } : invoice; }

/* ===== Stitch invoices: مساعدات الفواتير (عرض وترشيح فقط) ===== */
function invoicePeriodMatch(sale) {
  const period = state.invoicePeriod || "all";
  if (period === "all") return true;
  const key = dateKey(sale.date);
  if (period === "today") return key === dateKey();
  if (period === "week") { const edge = new Date(); edge.setDate(edge.getDate() - 6); return key >= dateKey(edge); }
  if (period === "month") return key.slice(0, 7) === dateKey().slice(0, 7);
  if (period === "custom") return (!state.invoiceFrom || key >= state.invoiceFrom) && (!state.invoiceTo || key <= state.invoiceTo);
  return true;
}
function invoiceStatusKey(sale) {
  const channel = paymentChannelLabel(sale);
  return channel === "دين" ? "credit" : channel === "تحويل" ? "transfer" : "cash";
}
function invoicePeriodChips() {
  const selected = state.invoicePeriod || "all";
  const chips = [["all", "الكل"], ["today", "اليوم"], ["week", "آخر 7 أيام"], ["month", "هذا الشهر"], ["custom", "مخصص"]];
  return chips.map(([value, label]) => `<button type="button" class="inv-chip ${selected === value ? "is-active" : ""}" data-category-action="invoice-period" data-category="${value}">${label}</button>`).join("");
}
function invoiceStatusPills(invoices) {
  const selected = state.invoiceStatus || "all";
  const sums = { all: 0, cash: 0, transfer: 0, credit: 0 };
  invoices.forEach((sale) => { const total = toNumber(sale.total); sums.all += total; sums[invoiceStatusKey(sale)] += total; });
  const pills = [["all", "الكل"], ["cash", "نقدي كاش"], ["transfer", "تحويل"], ["credit", "دين آجل"]];
  return pills.map(([value, label]) => `<button type="button" class="inv-pill inv-pill--${value} ${selected === value ? "is-active" : ""}" data-category-action="invoice-status" data-category="${value}"><span>${label}</span><strong>${value === "all" ? `${amount(invoices.length)} فاتورة` : money(sums[value])}</strong></button>`).join("");
}
function invoicesHeroMarkup(invoices) {
  const sums = { cash: 0, transfer: 0, credit: 0 };
  invoices.forEach((sale) => { sums[invoiceStatusKey(sale)] += toNumber(sale.total); });
  return `<section class="inv-hero"><div class="inv-hero__value"><span>صافي المبيعات المقبوضة والآجلة</span><strong>${money(sums.cash + sums.transfer + sums.credit)}</strong><small>${amount(invoices.length)} فاتورة</small></div><div class="inv-hero__minis"><div class="inv-mini"><span>كاش بالدرج</span><strong>${money(sums.cash)}</strong></div><div class="inv-mini"><span>تحويل بنكي</span><strong>${money(sums.transfer)}</strong></div><div class="inv-mini"><span>ذمم آجلة</span><strong>${money(sums.credit)}</strong></div></div></section>`;
}
function invoiceCard(sale) {
  const displaySale = invoiceWithCashier(sale);
  const status = invoiceStatusKey(sale);
  const statusLabel = status === "credit" ? "دين آجل" : status === "transfer" ? "تحويل" : "كاش";
  const customer = sale.customerId ? state.customers.find((entry) => entry.id === sale.customerId) : null;
  const canReturn = canUseAction(state.currentUser, "sale-return");
  const canCollect = sale.customerId && canUseAction(state.currentUser, "record-customer-payment");
  const detailsButton = `<button class="button button--secondary" data-action="open-invoice" data-id="${sale.id}">${msymbol("visibility", "text-[18px]")}<span>التفاصيل</span></button>`;
  const returnButton = canReturn ? `<button class="button button--secondary" data-action="sale-return" data-id="${sale.id}">${msymbol("assignment_return", "text-[18px]")}<span>مرتجع</span></button>` : "";
  const actions = status === "credit"
    ? `${detailsButton}${canCollect ? `<button class="button button--primary" data-action="record-customer-payment" data-id="${sale.customerId}">${msymbol("payments", "text-[18px]")}<span>سند قبض</span></button>` : ""}${returnButton}`
    : `${detailsButton}<button class="button button--secondary" data-action="print-invoice-direct" data-id="${sale.id}">${msymbol("print", "text-[18px]")}<span>طباعة</span></button><button class="button button--secondary" data-action="share-invoice-direct" data-id="${sale.id}">${msymbol("share", "text-[18px]")}<span>مشاركة</span></button>${returnButton}`;
  return `<article class="invoice-row inv-card inv-card--${status}"><div class="inv-card__head"><strong dir="ltr">${sale.invoiceNumber}</strong><span class="inv-status inv-status--${status}">${statusLabel}</span></div><small class="inv-card__meta">${dateTime(sale.date)} · الكاشير: ${escapeHtml(displaySale.cashierName)}${sale.customerName ? ` · العميل: ${escapeHtml(sale.customerName)}` : ""}${customer?.phone ? ` · <span dir="ltr">${escapeHtml(customer.phone)}</span>` : ""}</small>${status === "credit" ? `<small class="inv-card__note">${msymbol("info", "text-[16px]")}<span>رُحّل المبلغ إلى ذمة العميل تلقائيًا دون إدخال نقد في الصندوق.</span></small>` : ""}<div class="inv-card__foot"><strong class="inv-card__total">${money(sale.total)}</strong><div class="inv-card__actions">${actions}</div></div></article>`;
}

function invoicesMarkup() {
  const query = state.invoiceQuery.trim().toLocaleUpperCase("en");
  const periodInvoices = state.sales.filter((sale) => invoicePeriodMatch(sale) && (!query || String(sale.invoiceNumber || "").toLocaleUpperCase("en").includes(query)));
  const statusF = state.invoiceStatus || "all";
  const invoices = periodInvoices.filter((sale) => statusF === "all" || invoiceStatusKey(sale) === statusF);
  return `${topbarMarkup("الفواتير", "كل فاتورة محفوظة مع منتجاتها وحركات خصم المخزون.", backButtonMarkup("invoices", "sales"), "topbar--with-back")}
  ${saleSyncStrip()}
  ${invoicesHeroMarkup(periodInvoices)}
  <div class="inv-chips" role="group" aria-label="تصفية حسب الفترة">${invoicePeriodChips()}</div>
  ${(state.invoicePeriod || "all") === "custom" ? `<form id="invoice-filter" class="date-filter inv-custom-range"><input name="from" type="date" value="${state.invoiceFrom}" aria-label="من تاريخ" /><input name="to" type="date" value="${state.invoiceTo}" aria-label="إلى تاريخ" /></form>` : ""}
  <div class="inv-pills" role="group" aria-label="تصفية حسب حالة السداد">${invoiceStatusPills(periodInvoices)}</div>
  <section class="toolbar invoice-search-toolbar"><label class="search-field">${msymbol("search", "text-[20px]")}<input id="invoice-search" dir="ltr" inputmode="search" autocomplete="off" placeholder="ابحث برقم الفاتورة مثل INV-000005" value="${escapeHtml(state.invoiceQuery)}" /></label></section>
  <section class="panel invoice-list">${state.sales.length ? invoices.length ? invoices.map(invoiceCard).join("") : `<div class="inline-empty">لا توجد فاتورة مطابقة للبحث أو التصفية الحالية.</div>` : emptyState("لا توجد فواتير حتى الآن", "أتم أول عملية بيع لتظهر تفاصيلها هنا.", "sales")}</section>`;
}

/* ===== Stitch customers/suppliers: مساعدات العملاء والموردين (عرض وترشيح فقط) ===== */
function customerEffectiveLimit(customer) {
  if (toNumber(customer.creditLimit) > 0) return toNumber(customer.creditLimit);
  if (toNumber(state.settings?.customerCreditLimit) > 0) return toNumber(state.settings.customerCreditLimit);
  return 0;
}
function customerDebtKey(customer) {
  const balance = toNumber(customer.balance);
  if (balance <= 0) return "settled";
  const limit = customerEffectiveLimit(customer);
  return limit > 0 && balance > limit ? "over" : "debtor";
}
function customerLastMove(customerId) {
  let best = null;
  state.sales.forEach((sale) => { if (sale.customerId === customerId && (!best || sale.date > best.date)) best = { date: sale.date, label: `فاتورة ${sale.invoiceNumber}` }; });
  state.customerPayments.forEach((payment) => { if (payment.customerId === customerId && (!best || payment.date > best.date)) best = { date: payment.date, label: `سند قبض ${money(payment.amount)}` }; });
  return best;
}
function supplierLastMove(supplier) {
  let best = null;
  state.purchases.forEach((purchase) => { if ((purchase.supplierId && purchase.supplierId === supplier.id) || (!purchase.supplierId && purchase.supplierName === supplier.name)) { if (!best || purchase.date > best.date) best = { date: purchase.date, label: `توريد ${purchase.invoiceNumber}` }; } });
  state.supplierPayments.forEach((payment) => { if (payment.supplierId === supplier.id && (!best || payment.date > best.date)) best = { date: payment.date, label: `دفعة ${money(payment.amount)}` }; });
  return best;
}
function remindCustomerWhatsApp(id) {
  const customer = state.customers.find((entry) => entry.id === id);
  if (!customer) return;
  const balance = toNumber(customer.balance);
  sendWhatsAppMessage(customer.phone || "", `تذكير من ${storeDisplayName()}: الرصيد المستحق على حسابكم ${money(balance)}.${balance > 0 ? " نرجو السداد في أقرب وقت، وشكرًا لتعاملكم." : " حسابكم مسدد بالكامل، شكرًا لكم."}`);
}
function remindSupplierWhatsApp(id) {
  const supplier = state.suppliers.find((entry) => entry.id === id);
  if (!supplier) return;
  sendWhatsAppMessage(supplier.phone || "", `مطابقة كشف حساب من ${storeDisplayName()}: المستحق الحالي لكم ${money(supplier.balance)}. نرجو تأكيد الرصيد، وشكرًا لتعاونكم.`);
}
function debtChips(counts, labels, actionName, selected) {
  return labels.map(([value, label]) => `<button type="button" class="cs-chip cs-chip--${value} ${selected === value ? "is-active" : ""}" data-category-action="${actionName}" data-category="${value}">${label} (${amount(counts[value])})</button>`).join("");
}
function customerDebtChips(customers) {
  const counts = { all: customers.length, debtor: 0, settled: 0, over: 0 };
  customers.forEach((customer) => { counts[customerDebtKey(customer)] += 1; });
  return debtChips(counts, [["all", "الكل"], ["debtor", "عليهم ديون"], ["settled", "مسددون"], ["over", "تجاوزوا السقف"]], "customer-debt", state.customerDebtFilter || "all");
}
function supplierDebtChips(suppliers) {
  const counts = { all: suppliers.length, due: 0, settled: 0 };
  suppliers.forEach((supplier) => { counts[toNumber(supplier.balance) > 0 ? "due" : "settled"] += 1; });
  return debtChips(counts, [["all", "الكل"], ["due", "مستحقون"], ["settled", "مسددون"]], "supplier-debt", state.supplierDebtFilter || "all");
}
function customersHeroMarkup(customers) {
  const total = customers.reduce((sum, customer) => sum + toNumber(customer.balance), 0);
  const debtors = customers.filter((customer) => toNumber(customer.balance) > 0).length;
  const today = dateKey();
  const collected = state.customerPayments.filter((payment) => dateKey(payment.date) === today).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  return `<section class="cs-hero"><div class="cs-hero__value"><span>إجمالي ديون العملاء المستحقة</span><strong>${money(total)}</strong></div><div class="cs-hero__minis"><div class="cs-mini"><span>عملاء مدينون</span><strong>${amount(debtors)} عميل</strong></div><div class="cs-mini"><span>تحصيل اليوم</span><strong>${money(collected)}</strong></div></div></section>`;
}
function suppliersHeroMarkup(suppliers) {
  const total = suppliers.reduce((sum, supplier) => sum + toNumber(supplier.balance), 0);
  const due = suppliers.filter((supplier) => toNumber(supplier.balance) > 0).length;
  const today = dateKey();
  const paid = state.supplierPayments.filter((payment) => dateKey(payment.date) === today).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  return `<section class="cs-hero"><div class="cs-hero__value"><span>إجمالي مستحقات الموردين</span><strong>${money(total)}</strong></div><div class="cs-hero__minis"><div class="cs-mini"><span>موردون مستحقون</span><strong>${amount(due)} مورد</strong></div><div class="cs-mini"><span>مدفوعات اليوم</span><strong>${money(paid)}</strong></div></div></section>`;
}
function customerCard(customer) {
  const balance = toNumber(customer.balance);
  const key = customerDebtKey(customer);
  const limit = customerEffectiveLimit(customer);
  const last = customerLastMove(customer.id);
  const canCollect = balance > 0 && canUseAction(state.currentUser, "record-customer-payment");
  const canDelete = canUseAction(state.currentUser, "delete-customer");
  const initial = (customer.name || "؟").trim().charAt(0) || "؟";
  const statusLabel = key === "settled" ? "مسدد" : key === "over" ? "تجاوز السقف" : "مدين";
  return `<article class="entity-row cs-card cs-card--${key}"><div class="cs-card__top"><div class="cs-avatar">${escapeHtml(initial)}</div><div class="cs-card__head"><div class="cs-card__title"><strong dir="rtl">${escapeHtml(customer.name)}</strong><span class="cs-status cs-status--${key}">${statusLabel}</span></div><small class="cs-card__meta" dir="auto">${escapeHtml(customer.phone || customer.address || "لا توجد بيانات اتصال")}</small><small class="cs-card__meta">الحد: ${limit > 0 ? money(limit) : "بلا سقف"}</small></div><div class="cs-balance"><span>المبلغ المتبقي</span><strong>${money(balance)}</strong></div></div>${last ? `<small class="cs-last">آخر حركة: ${escapeHtml(last.label)} · ${escapeHtml(String(last.date).slice(0, 10))}</small>` : ""}<div class="cs-card__actions">${canCollect ? `<button class="button button--primary" data-action="record-customer-payment" data-id="${customer.id}">${msymbol("payments", "text-[18px]")}<span>سند قبض</span></button>` : ""}<button class="button button--secondary" data-action="open-customer" data-id="${customer.id}">${msymbol("menu_book", "text-[18px]")}<span>كشف الحساب</span></button><div class="cs-icons">${phoneCallButton(customer.phone, customer.name)}<button class="icon-button" data-action="remind-customer-whatsapp" data-id="${customer.id}" aria-label="تذكير واتساب" title="تذكير واتساب">${msymbol("chat", "text-[20px]")}</button><button class="icon-button" aria-label="تعديل ${escapeHtml(customer.name)}" title="تعديل" data-action="edit-customer" data-id="${customer.id}">${msymbol("edit", "text-[20px]")}</button>${canDelete ? `<button class="icon-button icon-button--danger" aria-label="حذف ${escapeHtml(customer.name)}" title="حذف" data-action="delete-customer" data-id="${customer.id}">${msymbol("delete", "text-[20px]")}</button>` : ""}</div></div></article>`;
}
function supplierCard(supplier) {
  const balance = toNumber(supplier.balance);
  const settled = balance <= 0;
  const last = supplierLastMove(supplier);
  const canPay = balance > 0 && canUseAction(state.currentUser, "record-supplier-payment");
  const canDelete = canUseAction(state.currentUser, "delete-supplier");
  const initial = (supplier.name || "؟").trim().charAt(0) || "؟";
  return `<article class="entity-row cs-card cs-card--${settled ? "settled" : "due"}"><div class="cs-card__top"><div class="cs-avatar cs-avatar--supplier">${escapeHtml(initial)}</div><div class="cs-card__head"><div class="cs-card__title"><strong dir="rtl">${escapeHtml(supplier.name)}</strong><span class="cs-status cs-status--${settled ? "settled" : "due"}">${settled ? "مسدد" : "مستحق"}</span></div><small class="cs-card__meta" dir="auto">${escapeHtml(supplier.phone || supplier.address || "لا توجد بيانات اتصال")}</small></div><div class="cs-balance"><span>المستحق الحالي</span><strong>${money(balance)}</strong></div></div>${last ? `<small class="cs-last">آخر حركة: ${escapeHtml(last.label)} · ${escapeHtml(String(last.date).slice(0, 10))}</small>` : ""}<div class="cs-card__actions">${canPay ? `<button class="button button--primary" data-action="record-supplier-payment" data-id="${supplier.id}">${msymbol("payments", "text-[18px]")}<span>تسديد</span></button>` : ""}<button class="button button--secondary" data-action="open-supplier-account" data-id="${supplier.id}">${msymbol("menu_book", "text-[18px]")}<span>كشف الحساب</span></button><div class="cs-icons">${phoneCallButton(supplier.phone, supplier.name)}<button class="icon-button" data-action="remind-supplier-whatsapp" data-id="${supplier.id}" aria-label="مراسلة واتساب" title="مراسلة واتساب">${msymbol("chat", "text-[20px]")}</button><button class="icon-button" aria-label="تعديل ${escapeHtml(supplier.name)}" title="تعديل" data-action="open-supplier" data-id="${supplier.id}">${msymbol("edit", "text-[20px]")}</button>${canDelete ? `<button class="icon-button icon-button--danger" aria-label="حذف ${escapeHtml(supplier.name)}" title="حذف" data-action="delete-supplier" data-id="${supplier.id}">${msymbol("delete", "text-[20px]")}</button>` : ""}</div></div></article>`;
}

function suppliersMarkup() {
  const query = state.supplierQuery.trim().toLocaleLowerCase("ar");
  const suppliers = state.suppliers.filter((supplier) => !query || [supplier.name, supplier.phone, supplier.address].some((value) => value?.toLocaleLowerCase("ar").includes(query)));
  const debtF = state.supplierDebtFilter || "all";
  const visible = suppliers.filter((supplier) => debtF === "all" || (toNumber(supplier.balance) > 0 ? "due" : "settled") === debtF);
  return `${topbarMarkup("الموردون", "تابع الأرصدة والشراء الآجل ودفعات الموردين في حساب واحد.")}
  ${saleSyncStrip()}
  ${suppliersHeroMarkup(suppliers)}
  <div class="cs-cta"><button class="button button--primary" data-action="new-supplier">${msymbol("person_add", "text-[20px]")}<span>إضافة مورد جديد</span></button></div>
  <div class="cs-chips" role="group" aria-label="تصفية حسب حالة المستحق">${supplierDebtChips(suppliers)}</div>
  <section class="toolbar"><label class="search-field">${msymbol("search", "text-[20px]")}<input id="supplier-search" dir="rtl" lang="ar" autocomplete="off" placeholder="ابحث باسم المورد أو رقم الهاتف..." value="${escapeHtml(state.supplierQuery)}" /></label></section>
  <section class="panel entity-list">${visible.length ? visible.map(supplierCard).join("") : state.suppliers.length ? `<div class="inline-empty">لا توجد نتائج مطابقة للبحث أو التصفية الحالية.</div>` : emptyState("لم تضف موردين بعد", "أضف أول مورد لتبدأ تسجيل فواتير الشراء.", "new-supplier")}</section>${supplierPaymentsMarkup({ embedded: true })}`;
}

function supplierPaymentsMarkup({ embedded = false } = {}) {
  const query = state.supplierPaymentQuery.trim().toLocaleLowerCase("ar");
  const payments = state.supplierPayments.filter((payment) => (!query || [payment.supplierName, payment.notes].some((value) => value?.toLocaleLowerCase("ar").includes(query))) && (!state.supplierPaymentFrom || dateKey(payment.date) >= state.supplierPaymentFrom) && (!state.supplierPaymentTo || dateKey(payment.date) <= state.supplierPaymentTo));
  const total = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const payableSuppliers = state.suppliers.filter((supplier) => toNumber(supplier.balance) > 0);
  const outstandingTotal = payableSuppliers.reduce((sum, supplier) => sum + toNumber(supplier.balance), 0);
  const paymentAction = `<button class="button button--primary" data-action="new-supplier-payment" ${payableSuppliers.length ? "" : "disabled"}>${msymbol("wallet", "text-[18px]")}<span>تسجيل دفعة</span></button>`;
  const emptyAction = payableSuppliers.length ? "new-supplier-payment" : "suppliers";
  const emptyMessage = payableSuppliers.length ? "اختر المورد ثم سجّل الدفعة، وستُسوّى فواتيره الآجلة ويُحدّث الصندوق أو التحويل تلقائيًا." : "لا يوجد مورد لديه مستحق مفتوح حاليًا.";
  return `${embedded ? `<div class="merged-section-head"><span class="eyebrow">حركة الحسابات</span><h2>دفعات الموردين</h2><small>تسديد مستحقات الموردين دون إنشاء شراء جديد.</small></div>` : topbarMarkup("دفعات الموردين", "اختر المورد وسجّل تسديد مستحقاته؛ الدفعة لا تُعد شراءً جديدًا.", paymentAction)}
  <div class="merged-section-actions">${embedded ? paymentAction : ""}</div><section class="toolbar toolbar--filter"><label class="search-field">${msymbol("search", "text-[19px]")}<input id="supplier-payment-search" autocomplete="off" placeholder="ابحث عن مورد أو ملاحظة..." value="${escapeHtml(state.supplierPaymentQuery)}" /></label><form id="supplier-payment-filter" class="date-filter"><input name="from" type="date" value="${state.supplierPaymentFrom}" /><input name="to" type="date" value="${state.supplierPaymentTo}" /></form></section>
  <section class="inventory-summary"><div><span>إجمالي الدفعات</span><strong>${money(total)}</strong></div><div><span>مستحقات مفتوحة</span><strong>${money(outstandingTotal)}</strong></div><div><span>الموردون المستحقون</span><strong>${amount(payableSuppliers.length)} مورد</strong></div></section>
  <section class="panel entity-list">${payments.length ? payments.map((payment) => `<article class="entity-row"><div class="entity-row__icon entity-row__icon--expense">${msymbol("wallet", "text-[20px]")}</div><button class="entity-row__main entity-row__main--button" data-action="open-supplier-account" data-id="${payment.supplierId}"><strong>${escapeHtml(payment.supplierName)}</strong><small>${payment.date} · ${escapeHtml(payment.notes || "تسديد مستحق")}</small></button><strong class="entity-row__amount">${money(payment.amount)}</strong></article>`).join("") : emptyState("لا توجد دفعات ضمن الفترة", emptyMessage, emptyAction)}</section>`;
}

function customersMarkup() {
  const query = state.customerQuery.trim().toLocaleLowerCase("ar");
  const customers = state.customers.filter((customer) => !query || [customer.name, customer.phone, customer.address].some((value) => value?.toLocaleLowerCase("ar").includes(query)));
  const debtF = state.customerDebtFilter || "all";
  const visible = customers.filter((customer) => debtF === "all" || customerDebtKey(customer) === debtF);
  return `${topbarMarkup("العملاء", "تابع الأرصدة والبيع الآجل والدفعات في حساب واحد.")}
  ${saleSyncStrip()}
  ${customersHeroMarkup(customers)}
  <div class="cs-cta"><button class="button button--primary" data-action="new-customer">${msymbol("person_add", "text-[20px]")}<span>إضافة عميل جديد</span></button></div>
  <div class="cs-chips" role="group" aria-label="تصفية حسب حالة الدين">${customerDebtChips(customers)}</div>
  <section class="toolbar"><label class="search-field">${msymbol("search", "text-[20px]")}<input id="customer-search" dir="rtl" lang="ar" autocomplete="off" placeholder="ابحث باسم العميل أو رقم الهاتف..." value="${escapeHtml(state.customerQuery)}" /></label></section>
  <section class="panel entity-list">${visible.length ? visible.map(customerCard).join("") : state.customers.length ? `<div class="inline-empty">لا توجد نتائج مطابقة للبحث أو التصفية الحالية.</div>` : emptyState("لم تضف عملاء بعد", "أضف أول عميل لتبدأ البيع الآجل وتسجيل الدفعات.", "new-customer")}</section>${customerPaymentsMarkup({ embedded: true })}`;
}

function customerPaymentsMarkup({ embedded = false } = {}) {
  const query = state.paymentQuery.trim().toLocaleLowerCase("ar");
  const payments = state.customerPayments.filter((payment) => (!query || [payment.customerName, payment.notes].some((value) => value?.toLocaleLowerCase("ar").includes(query))) && (!state.paymentFrom || dateKey(payment.date) >= state.paymentFrom) && (!state.paymentTo || dateKey(payment.date) <= state.paymentTo));
  const total = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  return `${embedded ? `<div class="merged-section-head"><span class="eyebrow">حركة الحسابات</span><h2>دفعات العملاء</h2><small>دفعات تسدد دينًا سابقًا ولا تُعد مبيعات جديدة.</small></div>` : topbarMarkup("دفعات العملاء", "دفعات تسدد دينًا سابقًا ولا تُعد مبيعات جديدة.")}
  <section class="toolbar toolbar--filter"><label class="search-field">${msymbol("search", "text-[19px]")}<input id="payment-search" dir="rtl" lang="ar" autocomplete="off" placeholder="ابحث عن عميل أو ملاحظة..." value="${escapeHtml(state.paymentQuery)}" /></label><form id="payment-filter" class="date-filter"><input name="from" type="date" value="${state.paymentFrom}" /><input name="to" type="date" value="${state.paymentTo}" /></form></section>
  <section class="inventory-summary"><div><span>إجمالي الدفعات</span><strong>${money(total)}</strong></div><div><span>العمليات</span><strong>${amount(payments.length)} دفعة</strong></div></section>
  <section class="panel entity-list">${payments.length ? payments.map((payment) => `<article class="entity-row"><div class="entity-row__icon entity-row__icon--expense">${msymbol("wallet", "text-[20px]")}</div><button class="entity-row__main entity-row__main--button" data-action="open-customer" data-id="${payment.customerId}"><strong>${escapeHtml(payment.customerName)}</strong><small>${payment.date} · ${escapeHtml(payment.notes || "تسديد رصيد")}</small></button><strong class="entity-row__amount">${money(payment.amount)}</strong></article>`).join("") : emptyState("لا توجد دفعات ضمن الفترة", "تسجل الدفعات من صفحة حساب العميل.", "customers")}</section>`;
}

function purchasesMarkup() {
  return `${topbarMarkup("المشتريات", "أنشئ فاتورة شراء لزيادة المخزون وتثبيت تكلفة المنتجات، مع إمكانية ربط المورد عند توفره.", `<button class="button button--primary" data-action="new-purchase">${msymbol("add", "text-[20px]")}<span>فاتورة شراء</span></button>`)}
  <section class="inventory-summary"><div><span>إجمالي المشتريات</span><strong>${money(state.analytics?.purchases.total || 0)}</strong></div><div><span>فواتير الشراء</span><strong>${amount(state.purchases.length)} فاتورة</strong></div></section>
  <div class="pc-cta"><button class="button button--primary" data-action="new-purchase">${msymbol("add", "text-[20px]")}<span>فاتورة شراء جديدة</span></button></div>
  <section class="panel invoice-list">${state.purchases.length ? state.purchases.map((purchase) => `<button class="invoice-row" data-action="open-purchase" data-id="${purchase.id}"><div class="invoice-row__mark invoice-row__mark--purchase">${msymbol("local_shipping", "text-[20px]")}</div><div class="invoice-row__main"><strong>${purchase.invoiceNumber}</strong><small>${escapeHtml(purchase.supplierName)} · ${dateTime(purchase.date)}</small></div><strong>${money(purchase.total)}</strong>${icon("arrow", 18)}</button>`).join("") : emptyState("لا توجد فواتير شراء", "سجّل أول فاتورة شراء لزيادة المخزون، مع المورد أو بدونه.", "new-purchase")}</section>`;
}

function currentMonthDateRange() { const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const pad = (value) => String(value).padStart(2, "0"); return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(new Date(year, month + 1, 0).getDate())}` }; }

const PERIODIC_INVENTORY_CYCLES = [{ id: "monthly", label: "شهري" }, { id: "semiannual", label: "نصف سنوي" }, { id: "annual", label: "سنوي" }];
const periodicInventoryCycleLabel = (cycle) => PERIODIC_INVENTORY_CYCLES.find((item) => item.id === cycle)?.label || "جرد دوري";
function periodicInventoryDefaultRange(cycle = "monthly") {
  const today = dateKey(); const [year, month] = today.split("-").map(Number); const pad = (value) => String(value).padStart(2, "0");
  if (cycle === "annual") return { from: `${year}-01-01`, to: today };
  if (cycle === "semiannual") return { from: `${year}-${pad(month <= 6 ? 1 : 7)}-01`, to: today };
  return { from: `${year}-${pad(month)}-01`, to: today };
}
function currentPeriodicInventoryRange() { const defaults = periodicInventoryDefaultRange(state.auditCycle); return { from: state.auditFrom || defaults.from, to: state.auditTo || defaults.to }; }

function periodicInventoryMarkup() {
  const range = currentPeriodicInventoryRange(); const data = state.periodicInventorySummary || { inventory: {}, cash: {}, receivables: {}, payables: {}, transfers: {}, performance: {}, damage: {}, netPosition: 0 };
  const history = state.periodicInventories || []; const prior = history.find((item) => item.cycle === state.auditCycle);
  const change = (value) => `${toNumber(value) > 0 ? "+" : ""}${money(value)}`;
  const comparison = (audit) => audit?.comparison ? `<small class="periodic-inventory__comparison">مقارنة بالجرد السابق: صافي المركز <strong class="${toNumber(audit.comparison.netPositionDelta) < 0 ? "is-negative" : ""}">${change(audit.comparison.netPositionDelta)}</strong> · صافي الربح <strong class="${toNumber(audit.comparison.netProfitDelta) < 0 ? "is-negative" : ""}">${change(audit.comparison.netProfitDelta)}</strong></small>` : `<small class="periodic-inventory__comparison">أول لقطة محفوظة لهذه الدورة.</small>`;
  const historyMarkup = history.length ? history.map((audit) => `<article class="periodic-inventory-row"><button class="periodic-inventory-row__main" data-action="open-periodic-inventory" data-id="${audit.id}"><span class="periodic-inventory-row__icon">${msymbol("history", "text-[19px]")}</span><span><strong>جرد ${periodicInventoryCycleLabel(audit.cycle)}</strong><small>${formatDate(audit.periodFrom)} — ${formatDate(audit.periodTo)} · اعتمد ${escapeHtml(audit.approvedByName || "الأدمن")}</small>${comparison(audit)}</span></button><strong class="periodic-inventory-row__amount ${toNumber(audit.metrics?.netPosition) < 0 ? "is-negative" : ""}">${money(audit.metrics?.netPosition)}</strong></article>`).join("") : `<div class="inline-empty">لم تحفظ أي لقطة جرد بعد. راجع الملخص الحالي ثم اعتمده لحفظه للمقارنة.</div>`;
  return `${topbarMarkup("الجرد المحاسبي الدوري", "لقطة محاسبية للفترة المختارة؛ الاعتماد لا يغيّر كميات المنتجات أو الصندوق أو الخزنة.", `<button class="button button--primary periodic-inventory-top-action" data-action="save-periodic-inventory">${msymbol("check", "text-[18px]")}<span>اعتماد الجرد</span></button>`)}
  <div class="periodic-inventory-page"><section class="panel periodic-inventory-filter"><div class="panel__head"><div><span class="eyebrow">اختيار الفترة</span><h2>نطاق الجرد</h2></div><small>حتى ${formatDate(range.to)}</small></div><form id="periodic-inventory-filter" class="periodic-inventory-filter__form"><label>دورة الجرد<select name="cycle">${PERIODIC_INVENTORY_CYCLES.map((item) => `<option value="${item.id}" ${state.auditCycle === item.id ? "selected" : ""}>${item.label}</option>`).join("")}</select></label><label>من<input name="from" type="date" value="${range.from}" required /></label><label>إلى<input name="to" type="date" value="${range.to}" required /></label></form><p class="periodic-inventory-filter__note">تحدد الدورة نطاقًا مقترحًا فقط. يمكنك تعديل التاريخين يدويًا قبل اعتماد اللقطة.</p></section>
  <section class="periodic-inventory-notice"><div>${msymbol("info", "text-[20px]")}</div><div><strong>اللقطة لا تنشئ حركة جديدة</strong><span>تُقرأ الأرصدة الحالية للخزنة والديون والمخزون، وتُحسب نتائج الفترة من الفواتير والمصروفات المسجلة فقط.</span></div></section>
  <section class="metric-grid metric-grid--reports">${metricCard("المخزون بالتكلفة", money(data.inventory.cost), "package", `${amount(data.inventory.productCount)} منتج · ${amount(data.inventory.units)} وحدة`, data.inventory.cost)}${metricCard("الخزنة الرئيسية", money(data.cash.vaultBalance), "wallet", data.cash.untransferredShiftCount ? `بانتظار ${amount(data.cash.untransferredShiftCount)} وردية` : "بعد فصل صناديق الكاشير", data.cash.vaultBalance)}${metricCard("ديون العملاء", money(data.receivables.customerDebt), "users", "رصيد مستحق قائم الآن", data.receivables.customerDebt)}${metricCard("صافي ربح الفترة", money(data.performance.netProfit), "chart", "بعد تكلفة البضاعة والمصروفات", data.performance.netProfit)}</section>
  <section class="report-grid"><article class="panel report-card"><span class="eyebrow">الأصول والأرصدة</span><div><span>المخزون بالتكلفة</span>${signedMoney(data.inventory.cost)}</div><div><span>الخزنة الرئيسية</span>${signedMoney(data.cash.vaultBalance)}</div><div><span>نقد لدى الكاشيرات</span>${signedMoney(data.cash.cashierCashHeld)}</div><div><span>ديون العملاء</span>${signedMoney(data.receivables.customerDebt)}</div><div><span>تحويلات واردة غير موردة</span>${signedMoney(data.transfers.incomingNotDeposited)}</div><div class="report-card__final"><span>صافي المركز التقريبي</span>${signedMoney(data.netPosition)}</div></article><article class="panel report-card"><span class="eyebrow">أداء الفترة</span><div><span>إجمالي المبيعات</span>${signedMoney(data.performance.sales)}</div><div><span>صافي المبيعات</span>${signedMoney(data.performance.netSales)}</div><div><span>تكلفة البضاعة المباعة</span>${signedMoney(data.performance.costOfGoods)}</div><div><span>الربح الإجمالي</span>${signedMoney(data.performance.grossProfit)}</div><div><span>المصروفات المعترف بها</span>${signedMoney(data.performance.expenses)}</div><div class="report-card__final"><span>صافي الربح</span>${signedMoney(data.performance.netProfit)}</div></article><article class="panel report-card"><span class="eyebrow">التزامات وتصحيحات</span><div><span>مستحقات الموردين</span><strong class="is-negative">−${money(data.payables.supplierPayables)}</strong></div><div><span>مرتجع البيع</span><strong class="is-negative">−${money(data.performance.salesReturns)}</strong></div><div><span>مرتجع الشراء</span><strong>${money(data.performance.purchaseReturns)}</strong></div><div><span>التالف</span><strong>${money(data.damage.amount)}</strong></div><p class="periodic-inventory__damage-note">${escapeHtml(data.damage.source || "التالف غير مسجل في سجل مستقل.")}</p></article></section>
  <section class="periodic-inventory-bottom-action"><div><span class="eyebrow">الجرد المحاسبي</span><strong>اعتماد لقطة الجرد الحالية</strong><small>راجع الأرصدة ثم احفظها للمقارنة مع الجرد القادم.</small></div><button class="button button--primary" data-action="save-periodic-inventory">${msymbol("check", "text-[20px]")}<span>اعتماد الجرد</span></button></section><section class="panel periodic-inventory-history"><div class="panel__head"><div><span class="eyebrow">سجل غير قابل للتعديل</span><h2>لقطات الجرد المحفوظة</h2></div><small>${amount(history.length)} لقطة</small></div>${prior ? `<p class="periodic-inventory-history__note">سيُحفظ الاعتماد الجديد مع مقارنة بآخر جرد ${periodicInventoryCycleLabel(state.auditCycle)}.</p>` : ""}<div class="periodic-inventory-history__list">${historyMarkup}</div></section></div>`;
}

function expensesMarkup({ embedded = false } = {}) {
  const defaultRange = currentMonthDateRange(); const expenseFrom = state.expenseFrom || defaultRange.from; const expenseTo = state.expenseTo || defaultRange.to; const query = state.expenseQuery.toLocaleLowerCase("ar");
  const searchable = (expense) => !query || [expense.category, expense.description, expense.notes, expense.cashierName, expense.staffName].some((value) => String(value || "").toLocaleLowerCase("ar").includes(query));
  const salaryEntry = (expense) => expense.cashierSalaryAdvance === true || expense.salaryAdvance === true || expense.salaryPayment === true || expense.cashierMonthlySalary === true;
  const matches = state.expenses.filter((expense) => !salaryEntry(expense) && searchable(expense) && expense.date >= expenseFrom && expense.date <= expenseTo);
  const dailyExpenses = matches.filter((expense) => expense.periodType !== "monthly");
  const monthlySalaryExpenses = (state.cashierMonthlySalaryExpenses || []).filter((expense) => searchable(expense) && (!expenseFrom || expense.month >= expenseFrom.slice(0, 7)) && (!expenseTo || expense.month <= expenseTo.slice(0, 7)));
  const salaryAdvances = state.expenses.filter((expense) => (expense.cashierSalaryAdvance === true || expense.salaryAdvance === true) && searchable(expense) && expense.date >= expenseFrom && expense.date <= expenseTo);
  const monthlyExpenses = matches.filter((expense) => expense.periodType === "monthly").sort((a, b) => new Date(b.date) - new Date(a.date));
  const salaryEntries = [...salaryAdvances, ...monthlySalaryExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = [...matches, ...monthlySalaryExpenses].reduce((sum, expense) => sum + toNumber(expense.amount), 0); const salaryTotal = monthlySalaryExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  const expenseRows = (items, periodType) => items.length ? items.map((expense) => { const isSalary = expense.cashierMonthlySalary === true || expense.salaryPayment === true; const isAdvance = expense.cashierSalaryAdvance === true || expense.salaryAdvance === true; const staffName = expense.staffName || expense.cashierName || "موظف"; const details = isSalary ? `راتب ${escapeHtml(staffName)} · ${expense.month} · السلف ${money(expense.advances)} · خصم العجز ${money(expense.shortageDeductions)}` : isAdvance ? `${escapeHtml(expense.description || "سلفة موظف")} · ${expense.date} · ${escapeHtml(staffName)}` : `${escapeHtml(expense.description || "بلا وصف")} · ${expense.date}${periodType === "monthly" ? " · يوزع على أيام الشهر" : ""}`; return `<article class="entity-row"><div class="entity-row__icon entity-row__icon--expense">${msymbol(periodType === "monthly" ? "calendar_month" : "wallet", "text-[20px]")}</div><div class="entity-row__main"><strong>${isAdvance ? "سلفة موظف" : escapeHtml(expense.category)}</strong><small>${details}</small></div><strong class="entity-row__amount">${money(expense.amount)}</strong><div class="entity-row__actions">${isSalary ? `<small class="status status--available">تم تسليم الراتب</small>` : isAdvance ? `<button class="icon-button" aria-label="حذف سلفة الموظف" data-action="delete-expense" data-id="${expense.id}">${msymbol("delete", "text-[19px]")}</button>` : `<button class="icon-button" aria-label="تعديل المصروف" data-action="edit-expense" data-id="${expense.id}">${msymbol("edit", "text-[19px]")}</button><button class="icon-button icon-button--danger" aria-label="حذف المصروف" data-action="delete-expense" data-id="${expense.id}">${msymbol("delete", "text-[19px]")}</button>`}</div></article>`; }).join("") : `<div class="inline-empty">لا توجد ${periodType === "monthly" ? "مصروفات شهرية" : periodType === "salary" ? "سلف أو رواتب مسلمة" : "مصروفات يومية"} ضمن الفترة.</div>`;
  return `${embedded ? `<div class="merged-section-head"><span class="eyebrow">المصروفات والحركات</span><h2>المصروفات اليومية والشهرية</h2><small>المصروفات التشغيلية والرواتب والسلف في قسم الصندوق.</small></div><div class="merged-section-actions"><button class="button button--secondary" data-action="new-cashier-salary-advance">${msymbol("wallet", "text-[18px]")}<span>سلفة موظف</span></button><button class="button button--primary" data-action="new-expense">${msymbol("add", "text-[20px]")}<span>إضافة مصروف</span></button></div>` : topbarMarkup("المصروفات", "سجّل المصروفات التشغيلية؛ وتُعرض الرواتب والسلف في قسم مستقل.", `<div class="topbar__actions"><button class="button button--secondary" data-action="new-cashier-salary-advance">${msymbol("wallet", "text-[18px]")}<span>سلفة موظف</span></button><button class="button button--primary" data-action="new-expense">${msymbol("add", "text-[20px]")}<span>إضافة مصروف</span></button></div>`)}
  <section class="toolbar toolbar--filter"><label class="search-field">${msymbol("search", "text-[19px]")}<input id="expense-search" autocomplete="off" placeholder="ابحث في المصروفات..." value="${escapeHtml(state.expenseQuery)}" /></label><form id="expense-filter" class="date-filter"><input name="from" type="date" value="${expenseFrom}" /><input name="to" type="date" value="${expenseTo}" /></form><small class="filter-note">النطاق الافتراضي: الشهر الحالي. يمكنك تحديد أي يوم أو فترة يدويًا.</small></section>
  ${embedded ? "" : `<div class="ex-cta"><button class="button button--primary" data-action="new-expense">${msymbol("add", "text-[20px]")}<span>إضافة مصروف</span></button><button class="button button--secondary" data-action="new-cashier-salary-advance">${msymbol("wallet", "text-[19px]")}<span>سلفة موظف</span></button></div>`}
  <section class="inventory-summary"><div><span>قيمة المصروفات المعترف بها ضمن الفترة</span><strong>${money(total)}</strong></div><div><span>مصروفات يومية</span><strong>${amount(dailyExpenses.length)} عملية</strong></div><div><span>مصروفات شهرية</span><strong>${amount(monthlyExpenses.length)} عملية</strong></div><div><span>رواتب مسلمة</span><strong>${money(salaryTotal)}</strong></div></section>
  <section class="expense-period-grid"><section class="panel entity-list"><div class="panel__head"><div><span class="eyebrow">تشغيل يومي</span><h2>مصروفات يومية</h2></div><small>المصروفات التشغيلية اليومية فقط</small></div>${expenseRows(dailyExpenses, "daily")}</section><section class="panel entity-list"><div class="panel__head"><div><span class="eyebrow">التزام شهري</span><h2>مصروفات شهرية</h2></div><small>الإيجار والكهرباء والماء والالتزامات التشغيلية</small></div>${expenseRows(monthlyExpenses, "monthly")}</section></section><section class="panel entity-list salary-expense-section"><div class="panel__head"><div><span class="eyebrow">رواتب الموظفين</span><h2>السلف والرواتب المسلمة</h2></div><small>لا يدخل الراتب كاملًا في المصروفات إلا بعد تسليمه</small></div>${expenseRows(salaryEntries, "salary")}</section><section class="panel expense-page__bottom-action"><div><span class="eyebrow">سلفة موظف</span><strong>تسجيل سلفة جديدة</strong><small>تخرج نقدًا وتخصم من الراتب المتبقي دون احتساب الراتب كاملًا</small></div><button class="button button--secondary" data-action="new-cashier-salary-advance">${msymbol("wallet", "text-[18px]")}<span>سلفة موظف</span></button></section>`;
}

function collapsiblePanel(key, head, bodyHtml) {
  const open = Boolean(state.reportPanels?.[key]);
  return `<section class="collapsible-reports">${reportPanelToggle(key, head)}${open ? `<div class="report-panel-body">${bodyHtml}</div>` : ""}</section>`;
}

function reportPanelToggle(key, { eyebrow, title, subtitle = "", badge = "", glyph = "chart" }) {
  const open = Boolean(state.reportPanels?.[key]);
  return `<button type="button" class="report-toggle ${open ? "is-open" : ""}" data-action="toggle-report-panel" data-panel="${key}" aria-expanded="${open}">
    <span class="report-toggle__icon">${icon(glyph, 18)}</span>
    <span class="report-toggle__text"><span class="eyebrow">${eyebrow}</span><strong>${title}</strong>${subtitle ? `<small>${subtitle}</small>` : ""}</span>
    ${badge ? `<span class="report-toggle__badge">${badge}</span>` : ""}
    <span class="report-toggle__chevron">${icon("arrow", 18)}</span>
  </button>`;
}

function smartTopMoversMarkup(topByVolume = [], topByProfit = []) {
  const volumeOpen = Boolean(state.reportPanels?.topVolume);
  const profitOpen = Boolean(state.reportPanels?.topProfit);
  return `
    <section class="smart-analytics-section collapsible-reports">
      ${reportPanelToggle("topVolume", { eyebrow: "الأكثر طلباً", title: "الأعلى مبيعاً بالكمية", subtitle: "الترتيب بحسب الكمية المباعة ضمن الفترة", badge: topByVolume.length ? `${amount(topByVolume.length)} صنف` : "" })}
      ${volumeOpen ? `<article class="panel smart-card report-panel-body">
        <div class="smart-card__list">
          ${topByVolume.length ? topByVolume.map((item, idx) => `
            <div class="smart-rank-row">
              <span class="rank-badge">#${idx + 1}</span>
              <div class="rank-info">
                <strong>${escapeHtml(item.name)}</strong>
                <small>إجمالي المبيعات: ${money(item.revenue)}</small>
              </div>
              <strong class="rank-value">${amount(item.quantity)} قطعة</strong>
            </div>
          `).join("") : `<p class="panel__empty">لا توجد مبيعات منتجات ضمن الفترة.</p>`}
        </div>
      </article>` : ""}

      ${reportPanelToggle("topProfit", { eyebrow: "أبطال الربحية", title: "الأعلى مساهمة في الأرباح", subtitle: "الترتيب بحسب الربح المحقق ضمن الفترة", badge: topByProfit.length ? `${amount(topByProfit.length)} صنف` : "" })}
      ${profitOpen ? `<article class="panel smart-card report-panel-body">
        <div class="smart-card__list">
          ${topByProfit.length ? topByProfit.map((item, idx) => `
            <div class="smart-rank-row">
              <span class="rank-badge rank-badge--profit">#${idx + 1}</span>
              <div class="rank-info">
                <strong>${escapeHtml(item.name)}</strong>
                <small>الكمية: ${amount(item.quantity)}</small>
              </div>
              <strong class="rank-value text-success">${money(item.profit)}</strong>
            </div>
          `).join("") : `<p class="panel__empty">لا توجد أرباح محسوبة ضمن الفترة.</p>`}
        </div>
      </article>` : ""}
    </section>
  `;
}

function smartHourlyPeakMarkup(hourlyDistribution = []) {
  const maxTotal = Math.max(1, ...hourlyDistribution.map((h) => h.total));
  const peakHour = hourlyDistribution.reduce((max, h) => h.total > max.total ? h : max, { hour: 0, count: 0, total: 0 });
  const formatHour = (h) => {
    const period = h >= 12 ? "م" : "ص";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr} ${period}`;
  };
  const open = Boolean(state.reportPanels?.hourly);

  return `
    <section class="collapsible-reports">
      ${reportPanelToggle("hourly", { eyebrow: "تحليل ساعات الذروة", title: "توزيع المبيعات على ساعات اليوم", subtitle: "اضغط لعرض المخطط الساعي", badge: peakHour.total > 0 ? `ذروة: ${formatHour(peakHour.hour)}` : "" })}
      ${open ? `<article class="panel peak-hours-card report-panel-body">
        ${peakHour.total > 0 ? `<div class="panel__head"><div><span class="eyebrow">أعلى ساعة</span></div><span class="peak-hour-badge">ذروة المبيعات: ${formatHour(peakHour.hour)} (${money(peakHour.total)})</span></div>` : ""}
        <div class="hourly-bars-chart">
          ${hourlyDistribution.map((h) => {
            const heightPct = Math.max(6, Math.round((h.total / maxTotal) * 100));
            const isPeak = peakHour.total > 0 && h.hour === peakHour.hour;
            return `
              <div class="hourly-bar-col ${isPeak ? "is-peak" : ""}" title="الساعة ${formatHour(h.hour)}: ${amount(h.count)} فاتورة · ${money(h.total)}">
                <div class="hourly-bar-fill" style="height: ${heightPct}%"></div>
                <span class="hourly-bar-label">${h.hour % 4 === 0 ? formatHour(h.hour) : "·"}</span>
              </div>
            `;
          }).join("")}
        </div>
      </article>` : ""}
    </section>
  `;
}

function smartDeadStockMarkup(deadStock) {
  if (!deadStock || !deadStock.count) return "";
  const open = Boolean(state.reportPanels?.deadStock);
  return `
    <section class="collapsible-reports">
      ${reportPanelToggle("deadStock", { eyebrow: "البضاعة الراكدة", title: `بضائع بدون حركة بيع (${amount(deadStock.count)} صنف)`, subtitle: `رأس المال في المخزون الراكد: ${money(deadStock.value)}`, badge: `${amount(deadStock.count)} صنف` })}
      ${open ? `<article class="panel dead-stock-card report-panel-body">
        <div class="dead-stock-items-chips">
          ${(deadStock.products || []).map((p) => `<button type="button" class="dead-stock-chip" data-action="open-product" data-id="${p.id}">${escapeHtml(p.name)} (${amount(p.quantity)} ${escapeHtml(p.unit)})</button>`).join("")}
        </div>
      </article>` : ""}
    </section>
  `;
}

function reportsMarkup() {
  const data = state.analytics || { sales: {}, purchases: {}, expenses: {}, profit: {}, topByVolume: [], topByProfit: [], hourlyDistribution: [], deadStock: null };
  const categories = Object.entries(data.expenses.byCategory || {});
  return `${topbarMarkup("التقارير", "ملخص تشغيلي للمبيعات والمشتريات والمصروفات والأرباح.", `<div class="topbar__actions"><button class="button button--secondary" data-action="navigate" data-view="periodic-inventory">${msymbol("layers", "text-[18px]")}<span>الجرد</span></button><button class="button button--secondary" data-action="export-report">${msymbol("receipt_long", "text-[18px]")}<span>تصدير التقرير</span></button></div>`)}
  <section class="toolbar toolbar--filter"><form id="report-filter" class="date-filter"><label>من<input name="from" type="date" value="${state.reportFrom}" /></label><label>إلى<input name="to" type="date" value="${state.reportTo}" /></label></form></section>
  <section class="metric-grid metric-grid--reports">${metricCard("صافي المبيعات", money(data.profit.netSales || 0), "trend", "بعد مرتجعات البيع", data.profit.netSales)}${metricCard("تكلفة البضاعة", money(data.profit.netCostOfGoods || 0), "package", "تكلفة وقت البيع", data.profit.netCostOfGoods)}${metricCard("إجمالي المصروفات", money(data.expenses.total || 0), "wallet", "ضمن الفترة", data.expenses.total)}${metricCard("صافي الربح", money(data.profit.netProfit || 0), "chart", "ليس المبيعات", data.profit.netProfit)}</section>
  <section class="report-grid"><article class="panel report-card"><span class="eyebrow">تقرير المبيعات</span><h2 class="${toNumber(data.sales.total) < 0 ? "is-negative" : ""}">${money(data.sales.total || 0)}</h2><div><span>الفواتير</span><strong>${amount(data.sales.invoices || 0)}</strong></div><div><span>الخصومات</span>${signedMoney(data.sales.discounts || 0)}</div><div><span>مرتجع البيع</span>${signedMoney(data.sales.returns || 0)}</div></article><article class="panel report-card"><span class="eyebrow">تقرير المشتريات</span><h2 class="${toNumber(data.purchases.net) < 0 ? "is-negative" : ""}">${money(data.purchases.net || 0)}</h2><div><span>الفواتير</span><strong>${amount(data.purchases.invoices || 0)}</strong></div><div><span>المنتجات المشتراة</span><strong>${amount(data.purchases.products || 0)}</strong></div><div><span>مرتجع الشراء</span>${signedMoney(data.purchases.returns || 0)}</div></article><article class="panel report-card"><span class="eyebrow">المصروفات حسب النوع</span>${categories.length ? categories.map(([category, total]) => `<div><span>${escapeHtml(category)}</span>${signedMoney(total)}</div>`).join("") : `<p>لا توجد مصروفات ضمن الفترة.</p>`}</article><article class="panel report-card report-card--profit"><span class="eyebrow">معادلة الربح</span><div><span>المبيعات</span>${signedMoney(data.profit.netSales || 0)}</div><div><span>− تكلفة البضاعة</span>${signedMoney(data.profit.netCostOfGoods || 0)}</div><div><span>= الربح الإجمالي</span>${signedMoney(data.profit.grossProfit || 0)}</div><div><span>− المصروفات</span>${signedMoney(data.expenses.total || 0)}</div><div class="report-card__final"><span>= صافي الربح</span>${signedMoney(data.profit.netProfit || 0)}</div></article></section>
  ${smartTopMoversMarkup(data.topByVolume, data.topByProfit)}
  ${smartHourlyPeakMarkup(data.hourlyDistribution)}
  ${smartDeadStockMarkup(data.deadStock)}
  <section class="reports-bottom-action"><div><span class="eyebrow">التقارير المالية</span><strong>قائمة التقارير والتصدير PDF</strong><small>حركة الصندوق، قائمة الدخل، المركز المالي، وميزان المراجعة.</small></div><button class="button button--primary" data-action="export-report">${msymbol("receipt_long", "text-[20px]")}<span>فتح قائمة التقارير</span></button></section><section class="sales-bottom-action reports-inventory-action"><div><span class="eyebrow">إدارة المخزون</span><strong>الجرد الدوري</strong><small>راجع الكميات الفعلية وقارنها بالأرصدة المسجلة واحفظ نتيجة الجرد.</small></div><button class="button button--primary" data-action="navigate" data-view="periodic-inventory">${msymbol("layers", "text-[22px]")}<span>الانتقال إلى الجرد</span></button></section>`;
}

/* ===== Stitch cashbox: بطل الخزنة (عرض فقط) ===== */
function cashboxHeroMarkup(vault, cash) {
  const pending = toNumber(vault.untransferredShiftCount);
  return `<section class="cb-hero"><div class="cb-hero__value"><span>الخزنة الرئيسية</span><strong>${money(vault.vaultBalance)}</strong><small>${pending ? `بانتظار ترحيل ${amount(pending)} وردية` : "لا توجد ورديات بانتظار الترحيل"}</small></div><div class="cb-hero__minis"><div class="cb-mini"><span>نقد لدى الكاشيرات</span><strong>${money(vault.cashierCashHeld)}</strong></div><div class="cb-mini"><span>إجمالي النقد المسجل</span><strong>${money(cash.closingBalance)}</strong></div><div class="cb-mini"><span>رأس المال بالمخزون</span><strong>${money(state.dashboard?.inventoryValue || 0)}</strong></div></div></section>`;
}

function cashboxMarkup() {
  const cash = state.cashbox || { openingBalance: 0, inflows: 0, outflows: 0, closingBalance: 0 };
  const vault = state.vault || { vaultBalance: cash.closingBalance, cashierCashHeld: 0, untransferredShiftCount: 0 };
  const movementLabel = (movement) => movement.sourceType === "CASHIER_SURPLUS" ? "فائض كاشير رُحّل للخزنة" : movement.sourceType === "CASHIER_SHORTAGE" ? "عجز كاشير سُوّي في الخزنة" : movement.sourceType === "TRANSFER_TO_VAULT" ? "توريد من حوالة واردة" : movement.type === "DEPOSIT" ? "إيداع في الخزنة" : "سحب من الخزنة";
  const inflowTotal = toNumber(cash.cashSales) + toNumber(cash.customerPayments) + toNumber(cash.deposits) + toNumber(cash.purchaseReturns);
  const outflowTotal = toNumber(cash.cashPurchases) + toNumber(cash.supplierPayments) + toNumber(cash.expenses) + toNumber(cash.withdrawals);
  const transfersCount = (state.transferVaultDeposits || []).length;
  const expensesCount = (state.expenses || []).length;

  const inflowBody = `<article class="panel report-card"><div><span>مبيعات نقدية</span><strong>${money(cash.cashSales)}</strong></div><div><span>دفعات العملاء</span><strong>${money(cash.customerPayments)}</strong></div><div><span>إيداعات يدوية</span><strong>${money(cash.deposits)}</strong></div><div><span>مرتجعات شراء</span><strong>${money(cash.purchaseReturns)}</strong></div></article>`;
  const outflowBody = `<article class="panel report-card"><div><span>مشتريات نقدية</span><strong>${money(cash.cashPurchases)}</strong></div><div><span>دفعات الموردين</span><strong>${money(cash.supplierPayments)}</strong></div><div><span>مصروفات</span><strong>${money(cash.expenses)}</strong></div><div><span>سحوبات يدوية</span><strong>${money(cash.withdrawals)}</strong></div></article>`;
  const movementsBody = `<article class="panel report-card">${state.cashMovements.length ? state.cashMovements.map((movement) => `<div><span>${movementLabel(movement)}<small>${movement.date}${movement.notes ? ` · ${escapeHtml(movement.notes)}` : ""}</small></span><strong class="${movement.type === "WITHDRAWAL" ? "is-negative" : ""}">${movement.type === "WITHDRAWAL" ? "−" : "+"}${money(movement.amount)}</strong></div>`).join("") : `<p>لا توجد إيداعات أو سحوبات أو تسويات ضمن الفترة.</p>`}</article>`;

  return `${topbarMarkup("الخزنة والصناديق", "الخزنة تجمع التحويلات والمصروفات وحركات النقد في مكان واحد، مع فصل ما يوجد فعليًا لدى الكاشيرات.", `<div class="topbar__actions"><button class="button button--secondary" data-action="new-cash-withdrawal">سحب</button><button class="button button--primary" data-action="new-cash-deposit">${msymbol("add", "text-[20px]")}<span>إيداع</span></button></div>`, "topbar--cashbox")}
  ${saleSyncStrip()}
  ${cashboxHeroMarkup(vault, cash)}
  <div class="cb-cta"><button class="button button--primary" data-action="new-cash-deposit">${msymbol("add", "text-[20px]")}<span>إيداع</span></button><button class="button button--secondary" data-action="new-cash-withdrawal">${msymbol("remove", "text-[20px]")}<span>سحب</span></button></div>
  <section class="toolbar toolbar--filter"><form id="cash-filter" class="date-filter"><label>من<input name="from" type="date" value="${state.cashFrom}" /></label><label>إلى<input name="to" type="date" value="${state.cashTo}" /></label></form></section>
  <div class="cashbox-panels">
  ${collapsiblePanel("cashIn", { eyebrow: "مصادر الداخل", title: "الوارد إلى الصندوق", subtitle: "المبيعات النقدية ودفعات العملاء والإيداعات", badge: money(inflowTotal), glyph: "wallet" }, inflowBody)}
  ${collapsiblePanel("cashOut", { eyebrow: "مصادر الخارج", title: "الصادر من الصندوق", subtitle: "المشتريات ودفعات الموردين والمصروفات والسحوبات", badge: money(outflowTotal), glyph: "wallet" }, outflowBody)}
  ${collapsiblePanel("cashMoves", { eyebrow: "حركات الخزنة والتسويات", title: "الإيداعات والسحوبات والتسويات", subtitle: "حركات الخزنة اليدوية وتسويات الكاشير", badge: `${amount(state.cashMovements.length)} حركة`, glyph: "history" }, movementsBody)}
  ${collapsiblePanel("transfers", { eyebrow: "الحوالات", title: "التحويلات الواردة والصادرة", subtitle: "متابعة الحوالات وتوريدها إلى الخزنة", badge: `${amount(transfersCount)} حوالة`, glyph: "truck" }, transfersMarkup({ embedded: true }))}
  ${collapsiblePanel("cashExpenses", { eyebrow: "المصروفات", title: "المصروفات اليومية والشهرية", subtitle: "المصروفات التشغيلية والرواتب والسلف", badge: money(cash.expenses), glyph: "wallet" }, expensesMarkup({ embedded: true }))}
  </div>`;
}

function cashierShiftSummaryMarkup() {
  const shifts = state.cashierShifts || [];
  const tone = (difference) => toNumber(difference) < 0 ? "is-negative" : toNumber(difference) > 0 ? "is-positive" : "";
  return `<section class="panel cashier-shift-summary"><div class="panel__head"><div><span class="eyebrow">صناديق الكاشير</span><h2>ورديات الكاشير وترحيل الخزنة</h2></div><small>${amount(shifts.length)} وردية</small></div><p class="panel__subtext">بعد الجرد يغلق الصندوق الفرعي. يرحّل الأدمن الوردية إلى الخزنة مرة واحدة فقط. العجز يُسوّى في الخزنة مباشرة، أما <strong>الفائض فلا يُضاف إلى حساب الكاشير ولا إلى الخزنة إلا بموافقة المدير</strong> سواء كان عليه عجز سابق أم لا.</p>${shifts.length ? `<div class="cashier-shift-list">${shifts.map((shift) => `<article class="cashier-shift-row"><div><strong>${escapeHtml(shift.accountName || "كاشير")}</strong><small>دخول: ${dateTime(shift.startedAt)}${shift.closedAt ? ` · خروج: ${dateTime(shift.closedAt)}` : " · وردية مفتوحة"}</small></div><div><small>استلم</small><strong>${money(shift.receivedCash)}</strong></div><div><small>دخل نقدي</small><strong>${money(shift.cashSales)}</strong></div><div><small>المتوقع</small><strong>${money(shift.expectedCash)}</strong></div><div><small>الجرد الفعلي</small><strong>${shift.countedCash === null || shift.countedCash === undefined ? "—" : money(shift.countedCash)}</strong></div><div><small>العجز / الزيادة</small><strong class="${tone(shift.difference)}">${shift.difference === null || shift.difference === undefined ? "—" : `${toNumber(shift.difference) > 0 ? "+" : ""}${money(shift.difference)}`}</strong></div><div class="cashier-shift-row__action">${shift.surplusApprovalStatus === "PENDING" ? `<div class="surplus-approval"><small class="status status--pending">فائض ${money(shift.difference)} بانتظار موافقة المدير</small><div class="surplus-approval__buttons"><button class="button button--primary button--compact" data-action="approve-cashier-surplus" data-id="${shift.id}">اعتماد</button><button class="button button--secondary button--compact" data-action="reject-cashier-surplus" data-id="${shift.id}">رفض</button></div></div>` : shift.surplusApprovalStatus === "APPROVED" ? `<small class="status status--available">فائض معتمد وأُضيف للخزنة</small>` : shift.surplusApprovalStatus === "REJECTED" ? `<small class="status status--danger">فائض مرفوض ولم يُضف</small>` : shift.vaultTransferredAt ? `<small class="status status--available">رُحّلت للخزنة</small>` : shift.status === "CLOSED" ? `<button class="button button--primary" data-action="transfer-cashier-shift" data-id="${shift.id}">ترحيل للخزنة</button>` : `<small>بانتظار إغلاق الوردية</small>`}</div></article>`).join("")}</div>` : `<div class="inline-empty">لا توجد ورديات كاشير مسجلة ضمن الفترة.</div>`}</section>`;
}

function cashierDifferenceStatisticsMarkup() {
  const rows = state.cashierShiftStatistics || [];
  return `<section class="panel cashier-difference-summary"><div class="panel__head"><div><span class="eyebrow">المساءلة المالية</span><h2>إحصاءات عجز وفائض الكاشير</h2></div><small>${amount(rows.length)} كاشير</small></div><p class="panel__subtext">الفائض لا يدخل الخزنة ولا يُحتسب للكاشير إلا بعد موافقة المدير صراحةً. العجز لا يُخصم تلقائيًا؛ يراجعه الأدمن ثم يختار الوردية المؤهلة لخصمها من الراتب مرة واحدة.</p>${rows.length ? `<div class="cashier-difference-list">${rows.map((row) => `<article class="cashier-difference-row"><div><strong>${escapeHtml(row.accountName)}</strong><small>${amount(row.shifts)} وردية · ${row.untransferred ? `${amount(row.untransferred)} بانتظار الترحيل` : "كل الورديات المرحلة"}</small></div><div><small>العجز</small><strong class="${row.shortages ? "is-negative" : ""}">${money(row.shortages)}</strong></div><div><small>الفائض</small><strong class="${row.surpluses ? "is-positive" : ""}">${money(row.surpluses)}</strong>${toNumber(row.pendingSurpluses) ? `<small class="is-pending">منه ${money(row.pendingSurpluses)} بانتظار الموافقة</small>` : ""}</div><div><small>الصافي</small><strong class="${toNumber(row.netDifference) < 0 ? "is-negative" : toNumber(row.netDifference) > 0 ? "is-positive" : ""}">${toNumber(row.netDifference) > 0 ? "+" : ""}${money(row.netDifference)}</strong></div><div class="cashier-difference-row__action">${row.pendingShortages ? `<button class="button button--secondary" data-action="deduct-cashier-shortages" data-id="${row.accountId}">خصم عجز ${money(row.pendingShortages)}</button>` : `<small>لا يوجد عجز مرحّل بانتظار التسوية</small>`}</div></article>`).join("")}</div>` : `<div class="inline-empty">لا توجد فروقات ورديات ضمن الفترة.</div>`}</section>`;
}

function cashierSalarySummaryMarkup() {
  const summaries = state.cashierSalarySummaries || [];
  return `<section class="panel cashier-salary-summary"><div class="panel__head"><div><span class="eyebrow">رواتب الشهر الحالي</span><h2>رواتب الفريق وتسليم المستحقات</h2></div><small>${amount(summaries.length)} حسابًا</small></div><p class="panel__subtext">هذا القسم مستقل عن المصروفات اليومية والشهرية. تُخصم السلفة وخصومات العجز من الراتب، ولا يظهر الراتب كمصروف إلا بعد الضغط على «تسليم الراتب».</p>${summaries.length ? `<div class="cashier-salary-list">${summaries.map((summary) => `<article class="cashier-salary-row"><div><strong>${escapeHtml(summary.accountName)}</strong><small>${escapeHtml(summary.jobTitle || (summary.role === "admin" ? "أدمن" : summary.role === "employee" ? "موظف" : "كاشير"))} · شهر ${escapeHtml(summary.month)}</small></div><div><small>الراتب</small><strong>${money(summary.monthlySalary)}</strong></div><div><small>السلف</small><strong class="${toNumber(summary.advances) ? "is-negative" : ""}">${money(summary.advances)}</strong></div><div><small>خصم العجز</small><strong class="${toNumber(summary.shortageDeductions) ? "is-negative" : ""}">${money(summary.shortageDeductions)}</strong></div><div><small>الباقي من الراتب</small><strong class="${toNumber(summary.remainingSalary) < 0 ? "is-negative" : ""}">${money(summary.remainingSalary)}</strong></div><div class="cashier-salary-row__action">${summary.salaryDelivered ? `<small class="status status--available">تم التسليم</small>` : `<button class="button button--secondary button--compact" data-action="settle-staff-salary" data-id="${summary.accountId}">تسليم الراتب</button>`}</div></article>`).join("")}</div>` : `<div class="inline-empty">لا توجد حسابات لها راتب شهري.</div>`}</section>`;
}

function incomingTransferEntries(inRange = () => true) {
  const depositedBySource = new Map();
  (state.transferVaultDeposits || []).forEach((movement) => { const key = `${movement.transferSourceType}:${movement.transferSourceId}`; depositedBySource.set(key, roundMoney((depositedBySource.get(key) || 0) + toNumber(movement.amount))); });
  const withDepositStatus = (item) => { const key = `${item.sourceType}:${item.sourceId}`; const deposited = roundMoney(depositedBySource.get(key) || 0); return { ...item, key, deposited, availableForVault: roundMoney(Math.max(0, item.amount - deposited)) }; };
  return [...state.sales.filter((sale) => inRange(sale.date) && sale.paymentMethod === "تحويل" && toNumber(sale.initialPaidAmount ?? sale.paidAmount) > 0).map((sale) => withDepositStatus({ sourceType: "SALE_TRANSFER", sourceId: sale.id, date: sale.date, label: `فاتورة بيع ${sale.invoiceNumber}`, detail: sale.customerName || "تحصيل بيع", amount: toNumber(sale.initialPaidAmount ?? sale.paidAmount) })), ...state.customerPayments.filter((payment) => inRange(payment.date) && payment.paymentMethod === "تحويل").map((payment) => withDepositStatus({ sourceType: "CUSTOMER_PAYMENT_TRANSFER", sourceId: payment.id, date: payment.date, label: `دفعة عميل ${payment.customerName}`, detail: payment.invoiceNumber || payment.notes || "تحصيل دين", amount: toNumber(payment.amount) }))].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function transfersMarkup({ embedded = false } = {}) {
  const inRange = (date) => (!state.cashFrom || dateKey(date) >= state.cashFrom) && (!state.cashTo || dateKey(date) <= state.cashTo);
  const incoming = incomingTransferEntries(inRange);
  const outgoing = [...state.purchases.filter((purchase) => inRange(purchase.date) && purchase.paymentMethod === "تحويل" && toNumber(purchase.initialPaidAmount ?? purchase.paidAmount) > 0).map((purchase) => ({ date: purchase.date, label: `فاتورة شراء ${purchase.invoiceNumber}`, detail: purchase.supplierName || "توريد", amount: toNumber(purchase.initialPaidAmount ?? purchase.paidAmount) })), ...state.supplierPayments.filter((payment) => inRange(payment.date) && payment.paymentMethod === "تحويل").map((payment) => ({ date: payment.date, label: `دفعة مورد ${payment.supplierName}`, detail: payment.invoiceNumber || payment.notes || "سداد مستحق", amount: toNumber(payment.amount) }))].sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalIncoming = roundMoney(incoming.reduce((sum, item) => sum + item.amount, 0)); const totalOutgoing = roundMoney(outgoing.reduce((sum, item) => sum + item.amount, 0)); const totalDeposited = roundMoney(incoming.reduce((sum, item) => sum + item.deposited, 0)); const availableForVault = roundMoney(incoming.reduce((sum, item) => sum + item.availableForVault, 0)); const net = roundMoney(totalIncoming - totalOutgoing);
  const transferList = (items, direction) => items.length ? items.map((item) => `<article class="entity-row transfer-row"><div class="entity-row__icon ${direction === "out" ? "entity-row__icon--expense" : ""}">${msymbol("swap_horiz", "text-[20px]")}</div><div class="entity-row__main"><strong>${escapeHtml(item.label)}</strong><small>${dateTime(item.date)} · ${escapeHtml(item.detail)}</small>${direction === "in" ? `<small class="transfer-row__vault-state">مُورّد للخزنة: ${money(item.deposited)} · المتبقي: ${money(item.availableForVault)}</small>` : ""}</div><strong class="entity-row__amount ${direction === "out" ? "is-negative" : ""}">${direction === "out" ? "−" : "+"}${money(item.amount)}</strong>${direction === "in" ? `<div class="transfer-row__action">${item.availableForVault > 0 ? `<button class="button button--primary" data-action="deposit-incoming-transfer" data-transfer-key="${escapeHtml(item.key)}">توريد للخزنة</button>` : `<small class="status status--available">وُرّد كاملًا</small>`}</div>` : ""}</article>`).join("") : `<div class="inline-empty">لا توجد تحويلات ${direction === "out" ? "صادرة" : "واردة"} ضمن الفترة.</div>`;
  return `${embedded ? `<div class="merged-section-head"><span class="eyebrow">حركة التحويلات</span><h2>التحويلات الواردة والصادرة</h2><small>راجع الحوالات وما تم توريده إلى الخزنة.</small></div>` : topbarMarkup("التحويلات", "راجع الحوالات الواردة والصادرة هنا. عندما تسحب حوالة واردة نقدًا، ورّد كاملها أو جزءًا منها إلى الخزنة.", `<button class="button button--secondary" data-action="navigate" data-view="cashbox">${msymbol("wallet", "text-[18px]")}<span>الخزنة</span></button>`)}${embedded ? "" : `<section class="toolbar toolbar--filter"><form id="cash-filter" class="date-filter"><label>من<input name="from" type="date" value="${state.cashFrom}" /></label><label>إلى<input name="to" type="date" value="${state.cashTo}" /></label></form></section>`}<section class="metric-grid metric-grid--reports">${metricCard("وارد التحويلات", money(totalIncoming), "transfer", "بيع ودفعات عملاء", totalIncoming)}${metricCard("رُوّد للخزنة", money(totalDeposited), "wallet", "نقد مسحوب من الحوالات", totalDeposited)}${metricCard("متاح للتوريد", money(availableForVault), "plus", "من الحوالات الواردة", availableForVault)}${metricCard("صافي التحويلات", money(net), "chart", "قبل توريد النقد للخزنة", net)}</section><section class="transfer-vault-note"><div>${msymbol("account_balance_wallet", "text-[20px]")}</div><div><strong>توريد التحويل لا يكرر التحصيل</strong><span>تُسجّل الحوالة أولًا كتحويل فقط، ثم يزداد النقد في الخزنة عند توريد الجزء الذي صار معك نقدًا.</span></div></section><section class="report-grid"><article class="panel entity-list"><div class="panel__head"><div><span class="eyebrow">وارد</span><h2>تحويلات واردة</h2></div><small>${amount(incoming.length)} حركة</small></div>${transferList(incoming, "in")}</article><article class="panel entity-list"><div class="panel__head"><div><span class="eyebrow">صادر</span><h2>تحويلات صادرة</h2></div><small>${amount(outgoing.length)} حركة</small></div>${transferList(outgoing, "out")}</article></section>`;
}

function cloudBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function cloudBackupMarkup() {
  const cloud = state.cloud;
  const busy = Boolean(cloud.busy);
  if (!cloud.user) {
    return `<section class="panel report-card cloud-backup-card"><span class="eyebrow">نسخ سحابي مجاني</span><h2>نسخة آمنة بين الأجهزة</h2><p>اربط حساب النسخ أولًا، ثم أنشئ رمز اقتران لمرة واحدة لكل مستخدم. تبقى العمليات محلية حتى اكتمال طبقة المزامنة.</p><div class="cloud-backup-card__note"><strong>ما الذي يبقى محليًا؟</strong><span>تستمر المبيعات والعمل دون اتصال على IndexedDB؛ الرفع والاستعادة عمليتان يدويتان.</span></div><div class="dialog__actions"><button class="button button--primary" data-action="open-cloud-auth">ربط النسخ السحابية</button><button class="button button--secondary" data-action="pairing-redeem">ربط هذا الجهاز</button></div></section>`;
  }
  const rows = cloud.backups.map((backup) => `<article class="cloud-backup-row"><div><strong>${escapeHtml(backup.storeName || "حسابي")}</strong><small>${dateTime(backup.createdAtClient)} · ${cloudBytes(backup.encodedBytes)} · ${amount(backup.chunkCount)} جزء</small></div><div class="cloud-backup-row__actions"><button class="button button--secondary" data-action="cloud-restore-backup" data-id="${escapeHtml(backup.id)}" ${busy ? "disabled" : ""}>استعادة</button><button class="icon-button icon-button--danger" data-action="cloud-delete-backup" data-id="${escapeHtml(backup.id)}" aria-label="حذف النسخة" ${busy ? "disabled" : ""}>${msymbol("delete", "text-[19px]")}</button></div></article>`).join("");
  return `<section class="panel report-card cloud-backup-card"><div class="panel__head"><div><span class="eyebrow">نسخ سحابي مجاني</span><h2>نسخ ${escapeHtml(cloud.user.email || "السحابية")}</h2></div><button class="text-button" data-action="cloud-signout" ${busy ? "disabled" : ""}>فصل الحساب</button></div><p>تُحفظ النسخ الاحتياطية كما هي، ويمكن للأدمن اعتماد طلبات الأجهزة وإصدار رمز لمرة واحدة. المزامنة التشغيلية ستسجل كل عملية باسم الحساب والجهاز.</p>${isAdmin(state.currentUser) ? `<div class="cloud-backup-card__note"><strong>هل لا يجد الجهاز المساعد المتجر؟</strong><span>أعد إنشاء ربط المتجر بالبريد الحالي دون حذف النسخ الاحتياطية.</span><button class="button button--secondary" data-action="repair-cloud-workspace" ${busy ? "disabled" : ""}>إصلاح ربط المتجر</button></div>` : ""}${cloud.pairRequests?.filter((request) => request.status === "pending").map((request) => `<div class="cloud-backup-card__note"><strong>طلب جهاز مساعد: ${escapeHtml(request.accountName || "مستخدم جديد")}</strong><span>الدور المطلوب: ${request.role === "admin" ? "أدمن مساعد" : "كاشير"}</span><button class="button button--primary" data-action="approve-pairing-request" data-id="${escapeHtml(request.id)}">موافقة وإصدار الرمز</button></div>`).join("") || ""}<div class="dialog__actions"><button class="button button--primary" data-action="cloud-upload-backup" ${busy ? "disabled" : ""}>${busy === "upload" ? "جارٍ رفع النسخة…" : "إنشاء نسخة سحابية الآن"}</button><button class="button button--secondary" data-action="pairing-invite" ${busy ? "disabled" : ""}>إنشاء رمز اقتران</button><button class="button button--secondary" data-action="cloud-refresh-backups" ${busy ? "disabled" : ""}>تحديث القائمة</button></div>${cloud.error ? `<p class="cloud-backup-error">${escapeHtml(cloud.error)}</p>` : ""}<div class="cloud-backup-list">${cloud.loading ? `<div class="inline-empty">جارٍ تحميل النسخ السحابية…</div>` : rows || `<div class="inline-empty">لا توجد نسخة سحابية بعد. أنشئ أول نسخة بعد مراجعة بيانات جهازك.</div>`}</div></section>`;
}

function mobileNavigationSettingsMarkup() {
  const order = normalizedMobileNavigationOrder(state.settings?.mobileNavigationOrder);
  const byId = new Map(NAV_ITEMS.map((item) => [item.id, item]));
  return `<section class="panel mobile-nav-settings"><div class="panel__head"><div><span class="eyebrow">شريط الهاتف</span><h2>ترتيب الأيقونات</h2></div></div><p>غيّر الأولوية لكل محل من هنا. الترتيب يحفظ على هذا الجهاز، ويظهر للكاشير بالأقسام المسموح له بها فقط.</p><div class="mobile-nav-settings__list">${order.map((id, index) => { const item = byId.get(id); return `<article class="mobile-nav-settings__item"><span class="mobile-nav-settings__icon">${icon(item.icon, 18)}</span><strong>${escapeHtml(item.label)}</strong><div class="mobile-nav-settings__actions"><button class="icon-button" type="button" data-action="move-mobile-nav" data-id="${id}" data-direction="-1" aria-label="تقديم ${escapeHtml(item.label)}" title="تقديم" ${index === 0 ? "disabled" : ""}>${msymbol("arrow_upward", "text-[18px]")}</button><button class="icon-button mobile-nav-settings__down" type="button" data-action="move-mobile-nav" data-id="${id}" data-direction="1" aria-label="تأخير ${escapeHtml(item.label)}" title="تأخير" ${index === order.length - 1 ? "disabled" : ""}>${msymbol("arrow_downward", "text-[18px]")}</button></div></article>`; }).join("")}</div><div class="dialog__actions"><button class="button button--secondary" type="button" data-action="reset-mobile-nav">استعادة الترتيب الافتراضي</button></div></section>`;
}

function dataManagementMarkup() {
  return `${topbarMarkup("إدارة البيانات", "احفظ نسخة محلية أو سحابية واستعدها عند الحاجة، دون مزامنة تلقائية بين الأجهزة.", `<button class="button button--secondary" data-action="navigate" data-view="settings">${icon("arrow", 17)}<span>الإعدادات</span></button>`)}
  <div class="data-management-page"><section class="panel barcode-tools"><div class="panel__head"><div><span class="eyebrow">كتالوج الباركود</span><h2>استيراد أو تصدير الباركودات</h2></div></div><p>صدّر منتجاتك إلى Excel، أو استورد ملف Excel/CSV/TSV. تُطابق الأعمدة العربية أو الإنجليزية تلقائيًا وتظهر المنتجات والباركودات فورًا في القوائم.</p><div class="dialog__actions"><button class="button button--secondary" type="button" data-action="export-barcodes">تصدير Excel</button><label class="button button--primary" for="barcode-import-file">استيراد ملف الباركود<input id="barcode-import-file" type="file" accept=".xlsx,.xls,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden /></label></div><small class="field-hint">يفضل أن يحتوي الملف على عمود «الباركود» و«اسم المنتج». إذا كان المنتج موجودًا سيتم تحديث باركوده، وإذا لم يكن موجودًا سيُضاف إلى المنتجات.</small></section><section class="report-grid"><section class="panel report-card data-management-card"><span class="eyebrow">نسخة محلية</span><h2>تصدير واستيراد البيانات</h2><p>صدّر ملف JSON يحتفظ بكل بيانات هذا الجهاز، واستعده فقط من ملف حسابي موثوق.</p>${state.settings?.localBackupDirectoryName ? `<small class="field-hint">الحفظ التلقائي في: ${escapeHtml(state.settings.localBackupDirectoryName)}</small>` : `<small class="field-hint">اختر مجلدًا ليُحفظ فيه النسخ اليومية تلقائيًا على سطح المكتب.</small>`}<div class="dialog__actions"><button class="button button--primary" data-action="export-backup">${msymbol("download", "text-[18px]")} تصدير نسخة</button><button class="button button--secondary" data-action="choose-backup-directory">${msymbol("folder_open", "text-[18px]")} اختيار مجلد الحفظ</button><label class="button button--primary" for="restore-file">${msymbol("upload", "text-[18px]")} استيراد واستعادة</label><input id="restore-file" type="file" accept="application/json,.json" hidden /></div></section>${cloudBackupMarkup()}<section class="panel report-card data-management-card data-management-card--danger"><span class="eyebrow">منطقة حساسة</span><h2>مسح البيانات</h2><p>يمسح كل بيانات هذا الجهاز ويعيد التطبيق إلى شاشة الإعداد. صدّر نسخة احتياطية أولًا.</p><button class="button button--danger" data-action="reset-data">مسح جميع البيانات</button></section></section></div>`;
}

function storeLogoSettingsMarkup() {
  const hasCustomLogo = Boolean(storeLogoDataUrl());
  return `<section class="panel store-logo-settings"><div class="panel__head"><div><span class="eyebrow">هوية المتجر</span><h2>شعار المتجر</h2></div><small>محفوظ على هذا الجهاز</small></div><div class="store-logo-settings__body"><div class="store-logo-preview"><img src="${storeLogoUrl()}" alt="معاينة شعار المتجر" /><div><strong>${hasCustomLogo ? "شعار مخصص" : "شعار حسابي الافتراضي"}</strong><small>PNG أو JPG أو WebP · يُصغّر تلقائيًا ليبقى ضمن النسخة الاحتياطية.</small></div></div><label class="button button--primary store-logo-upload" for="store-logo-file">${msymbol("upload", "text-[19px]")} اختيار شعار</label><input id="store-logo-file" type="file" accept="image/png,image/jpeg,image/webp" hidden />${hasCustomLogo ? `<button class="button button--secondary" data-action="clear-store-logo">${msymbol("delete", "text-[18px]")} استعادة الشعار الافتراضي</button>` : ""}</div></section>`;
}

function settingsBackAction() { return `<button class="button button--secondary" data-action="navigate" data-view="settings">${icon("arrow", 17)}<span>مركز الإعدادات</span></button>`; }
function settingsHubCard({ view, iconName, eyebrow, title, description }) { return `<button class="settings-hub__card" data-action="navigate" data-view="${view}"><span class="settings-hub__icon">${icon(iconName, 22)}</span><span><small>${escapeHtml(eyebrow)}</small><strong>${escapeHtml(title)}</strong><em>${escapeHtml(description)}</em></span>${icon("arrow", 18)}</button>`; }
function settingsContactMarkup() {
  return `<section class="panel settings-contact-card"><span class="eyebrow">تواصل مع المصمم</span><h2>نسعد باستقبال ملاحظاتكم واقتراحاتكم</h2><p>لتحسين تجربة استخدام حسابي وتطويرها باستمرار.</p><a class="settings-contact-card__phone" href="https://wa.me/967770388100" target="_blank" rel="noopener noreferrer">واتساب: +967770388100</a><a class="settings-contact-card__email" href="mailto:concordsharaf@gmail.com">concordsharaf@gmail.com</a><small>تصميم شرف غالب قحطان · الجمهورية اليمنية</small></section>`;
}
/* يزيل شريط العنوان من صفحة فرعية لعرض محتواها داخل زر قابل للطي في مركز الإعدادات. */
function stripTopbar(markup) {
  return String(markup).replace(/<header class="topbar[\s\S]*?<\/header>/, "");
}

function settingsMarkup() {
  const sections = [
    { key: "setGeneral", glyph: "box", eyebrow: "المتجر", title: "إعدادات عامة", subtitle: "الاسم والنشاط والعملة ورصيد البداية", body: () => stripTopbar(generalSettingsMarkup()) },
    { key: "setBrand", glyph: "layers", eyebrow: "الهوية", title: "شعار المتجر", subtitle: "اختر شعارًا محفوظًا محليًا وضمن PDF", body: () => stripTopbar(brandSettingsMarkup()) },
    { key: "setAccounts", glyph: "users", eyebrow: "الفريق", title: "إدارة الحسابات", subtitle: "أضف الحسابات وحدد الأدوار والرواتب", body: () => stripTopbar(accountsMarkup()) },
    { key: "setActivity", glyph: "shield", eyebrow: "الأمان والرقابة", title: "سجل العمليات والتدقيق", subtitle: "مراقبة حركات الدخول والمبيعات والمخزون", body: () => stripTopbar(activityLogMarkup()) },
    { key: "setNav", glyph: "grid", eyebrow: "الهاتف", title: "ترتيب الأيقونات", subtitle: "غيّر أولوية شريط التنقل حسب متجرِك", body: () => stripTopbar(navigationSettingsMarkup()) },
    { key: "setData", glyph: "restore", eyebrow: "الحفظ", title: "إدارة البيانات", subtitle: "نسخ محلية وسحابية واستعادة آمنة", body: () => stripTopbar(dataManagementMarkup()) },
  ];
  const panels = sections.map((section) => collapsiblePanel(section.key, { eyebrow: section.eyebrow, title: section.title, subtitle: section.subtitle, glyph: section.glyph }, state.reportPanels?.[section.key] ? section.body() : "")).join("");
  return `${topbarMarkup("مركز الإعدادات", "اضغط على أي قسم لفتحه، واضغط مرة أخرى لطيه. تبقى بيانات متجرك محلية، ولا تظهر هذه الأدوات للكاشير.")}
  <div class="settings-page settings-hub"><section class="settings-hub__intro panel"><span class="eyebrow">لوحة إدارة</span><h2>ضبط المتجر من مكان واحد</h2><p>كل الأقسام مطوية افتراضيًا لتبقى الشاشة مرتبة على الهاتف وسطح المكتب.</p></section>${panels}${notificationsPanelMarkup()}${settingsContactMarkup()}</div>`;
}

function generalSettingsMarkup() {
  return `${topbarMarkup("إعدادات عامة", "حدّث بيانات المتجر التي تظهر في رأس التطبيق والفواتير، ثم احفظ التغيير.", settingsBackAction())}
  <div class="settings-page settings-subpage"><form id="settings-form" class="panel form-grid"><div class="panel__head form-full"><div><span class="eyebrow">بيانات المتجر</span><h2>الإعدادات الأساسية</h2></div></div><label class="form-full">اسم المتجر<input name="storeName" required maxlength="60" dir="rtl" value="${escapeHtml(state.settings?.storeName || "")}" /></label><label>رقم الهاتف<input name="storePhone" type="tel" inputmode="tel" dir="ltr" maxlength="30" value="${escapeHtml(state.settings?.storePhone || "")}" placeholder="+967…" /></label><label>البريد الإلكتروني<input name="storeEmail" type="email" dir="ltr" maxlength="120" value="${escapeHtml(state.settings?.storeEmail || "")}" placeholder="example@domain.com" /></label><label class="form-full">العنوان<input name="storeAddress" dir="rtl" maxlength="160" value="${escapeHtml(state.settings?.storeAddress || "")}" placeholder="المدينة · الحي · الشارع" /></label><label class="form-full">الرقم الضريبي أو السجل التجاري <span class="field-optional">(اختياري)</span><input name="taxNumber" dir="ltr" maxlength="60" value="${escapeHtml(state.settings?.taxNumber || "")}" placeholder="اختياري" /></label><label>نوع النشاط<select name="businessType">${BUSINESS_TYPES.map((type) => `<option value="${type}" ${state.settings?.businessType === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label>العملة<select name="currency">${CURRENCIES.map((currency) => `<option value="${currency.code}" ${state.settings?.currency === currency.code ? "selected" : ""}>${currency.label}</option>`).join("")}</select></label><label class="form-full">رصيد افتتاحي للصندوق<input name="openingCash" type="number" min="0" step="0.01" value="${escapeHtml(state.settings?.openingCash ?? "")}" /></label><label class="form-full settings-discount-limit-field">الحد الأقصى لخصم الكاشير (%)<input name="cashierDiscountLimitPercent" type="number" min="0" max="100" step="0.01" value="${escapeHtml(state.settings?.cashierDiscountLimitPercent ?? 10)}" /><small class="field-hint">الافتراضي 10%. يطبّق على مجموع خصم السطور والخصم العام، ولا يستطيع الكاشير تجاوزه. يمكن للأدمن رفعه حتى 100% عند الحاجة.</small></label><div class="settings-inline-checks form-full" role="group" aria-label="خيارات البيع"><label class="settings-inline-check settings-switch"><input name="allowNegativeSales" type="checkbox" ${state.settings?.allowNegativeSales ? "checked" : ""} /><span class="switchcompat" aria-hidden="true"><span class="switchcompat__thumb"></span></span><span><strong>السماح بالبيع بالسالب</strong><small>تُخصم لاحقًا من فاتورة شراء.</small></span></label><label class="settings-inline-check settings-switch"><input name="allowSalePriceEdit" type="checkbox" ${state.settings?.allowSalePriceEdit ? "checked" : ""} /><span class="switchcompat" aria-hidden="true"><span class="switchcompat__thumb"></span></span><span><strong>السماح بتعديل السعر قبل البيع</strong><small>يتيح تغيير السعر داخل سلة البيع.</small></span></label></div><label class="form-full">السقف العام لمديونية العملاء<input name="customerCreditLimit" type="number" min="0" step="0.01" value="${escapeHtml(state.settings?.customerCreditLimit ?? "")}" /><small class="field-hint">اتركه فارغًا أو ضع 0 للسماح دون سقف عام. يمكن تحديد سقف مختلف لكل عميل من خيارات العملاء.</small></label><div class="dialog__actions form-full"><button class="button button--primary" type="submit">حفظ الإعدادات ${msymbol("check", "text-[19px]")}</button></div></form><section class="panel data-management-card data-management-card--danger product-delete-settings"><span class="eyebrow">منطقة اختبار المنتجات</span><h2>حذف جميع المنتجات</h2><p>يحذف المنتجات من قوائم المنتجات والمخزون فقط، مع إبقاء الفواتير والسجلات المالية محفوظة. استخدمه قبل استيراد قائمة تجريبية جديدة.</p><button class="button button--danger" data-action="delete-all-products">حذف جميع المنتجات</button></section></div>`;
}
function brandSettingsMarkup() { return `${topbarMarkup("شعار المتجر", "اختر شعارًا محليًا يظهر في التطبيق وملفات PDF ويدخل في النسخة الاحتياطية.", settingsBackAction())}<div class="settings-page settings-subpage">${storeLogoSettingsMarkup()}</div>`; }
function navigationSettingsMarkup() { return `${topbarMarkup("ترتيب أيقونات الهاتف", "قدّم أو أخّر الأقسام حسب أولويات متجرك. يبقى ترتيب الكاشير مقتصرًا على الأقسام المسموح بها.", settingsBackAction())}<div class="settings-page settings-subpage">${mobileNavigationSettingsMarkup()}</div>`; }

function loginMarkup() {
  const users = state.accounts.filter((account) => account.isActive);
  return `<main class="setup-page login-page"><section class="setup-art"><div class="setup-art__brand"><img src="${storeLogoUrl()}" alt="شعار ${escapeHtml(state.settings?.storeName || "المتجر")}" /><span class="brand-wordmark">حسابي</span><small>سجلّ المتجر اليومي</small></div><div class="setup-art__status"><span class="presence-dot"></span><span>بيانات المتجر تبقى على هذا الجهاز</span></div><div class="setup-art__copy"><p class="eyebrow">دخول آمن</p><h1>اختر حسابك<br />وابدأ وردية العمل.</h1><p>حساب الأدمن يدير الإدخال والأرباح والإحصائيات، وحساب الكاشير مخصص للمبيعات والفواتير.</p><div class="setup-art__stamps"><span>أدمن</span><span>كاشير</span><span>مبيعات</span></div></div></section><section class="setup-form-wrap"><div class="setup-sheet"><div class="setup-sheet__brand"><img src="${storeLogoUrl()}" alt="شعار ${escapeHtml(state.settings?.storeName || "المتجر")}" /><div><strong>تسجيل الدخول</strong><span>${escapeHtml(storeDisplayName())}</span></div></div><div class="setup-form"><span class="eyebrow">مرحبًا بعودتك</span><h2>الدخول إلى الحساب</h2><p>أدخل اسم المستخدم وكلمة المرور التي اخترتها.</p><form id="login-form"><label>اسم المستخدم<input name="username" autocomplete="username" required minlength="3" maxlength="30" autofocus placeholder="مثال: admin" /></label><label>كلمة المرور<input name="pin" type="password" autocomplete="current-password" required minlength="4" maxlength="64" placeholder="••••" /></label><button class="button button--primary button--wide" type="submit">دخول إلى حسابي ${icon("arrow", 18)}</button></form><button type="button" class="login-recovery-link" data-action="open-phone-recovery">نسيت كلمة المرور المحلية؟ اطلب استردادًا برقم الجوال</button><button type="button" class="login-recovery-link" data-action="cloud-password-reset">استعادة كلمة مرور النسخ عبر البريد الإلكتروني</button><button type="button" class="button button--secondary button--wide login-home-button" data-action="setup-home">الرئيسية · اختيار نوع المتجر والبدء من جديد ${icon("arrow", 18)}</button><div class="account-hints"><strong>الحسابات المتاحة</strong>${users.map((account) => `<button type="button" class="account-hint" data-action="fill-login" data-username="${escapeHtml(account.username)}"><span>${escapeHtml(account.name)}</span><small>${escapeHtml(account.username)} · ${roleLabel(account.role)}</small></button>`).join("")}</div><small class="offline-note"><span class="presence-dot"></span>يسجل الدخول محليًا ولا يحتاج اتصالًا بالإنترنت</small></div></div></section></main>`;
}

function requiredPinMarkup() {
  return `<main class="setup-page login-page"><section class="setup-art"><div class="setup-art__brand"><img src="${storeLogoUrl()}" alt="شعار ${escapeHtml(state.settings?.storeName || "المتجر")}" /><span class="brand-wordmark">حسابي</span><small>حماية الحساب</small></div><div class="setup-art__copy"><p class="eyebrow">خطوة أمنية</p><h1>غيّر رمز الدخول<br />قبل متابعة العمل.</h1><p>تم إنشاء الحساب برمز مؤقت. اختر رمزًا خاصًا من 4 إلى 12 رقمًا.</p></div></section><section class="setup-form-wrap"><div class="setup-sheet"><div class="setup-form"><span class="eyebrow">مرحبًا ${escapeHtml(state.currentUser?.name || "")}</span><h2>تعيين رمز دخول جديد</h2><form id="required-pin-form"><label>رمز الدخول الجديد<input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" required minlength="4" maxlength="12" autofocus /></label><label>تأكيد الرمز<input name="pinConfirm" type="password" inputmode="numeric" pattern="[0-9]*" required minlength="4" maxlength="12" /></label><button class="button button--primary button--wide" type="submit">حفظ ومتابعة ${msymbol("check", "text-[19px]")}</button></form></div></div></section></main>`;
}

function cashierPermissionsSummaryMarkup(account) {
  if (account.role !== "cashier") return "";
  const allowed = Array.isArray(account.allowedViews) && account.allowedViews.length
    ? account.allowedViews
    : DEFAULT_CASHIER_ALLOWED_VIEWS;
  const isDefaultOnly = allowed.length === 2 && allowed.includes("sales") && allowed.includes("invoices");
  const badges = CASHIER_CONFIGURABLE_PERMISSIONS
    .filter((perm) => allowed.includes(perm.id))
    .map((perm) => `<span class="perm-pill">${escapeHtml(perm.label.split(" ")[0])}</span>`)
    .join("");

  return `<div class="account-row__permissions"><small class="account-permissions-title">الشاشات المتاحة:</small><div class="perm-pills-list">${badges}</div>${isDefaultOnly ? `<span class="perm-badge-default">مبيعات وفواتير فقط (افتراضي)</span>` : ""}</div>`;
}

function accountsMarkup() {
  const accounts = state.accounts;
  const salaryByStaff = new Map((state.cashierSalarySummaries || []).map((summary) => [summary.accountId, summary]));
  return `${topbarMarkup("الحسابات والصلاحيات", "أدر حسابات فريقك وحدد من يرى البيانات المالية ومن يقتصر على البيع.", `<button class="button button--primary" data-action="new-account">${msymbol("add", "text-[20px]")}<span>إضافة حساب</span></button>`)}
  <section class="panel account-list"><div class="panel__head"><div><span class="eyebrow">فريق المتجر</span><h2>الحسابات المحلية</h2></div><small>الأدمن: كامل الصلاحيات · الكاشير: صلاحيات مخصصة (الافتراضي مبيعات وفواتيرها فقط) · لكل حساب راتب شهري اختياري</small></div>${accounts.map((account) => { const salary = salaryByStaff.get(account.id); const isPayrollAccount = ["admin", "cashier", "employee"].includes(account.role); const salaryAction = isPayrollAccount && account.isActive && toNumber(salary?.monthlySalary) > 0 ? (salary?.salaryDelivered ? `<small class="status status--available">تم تسليم الراتب</small>` : `<button class="button button--secondary button--compact" data-action="settle-staff-salary" data-id="${account.id}">تسليم الراتب</button>`) : ""; return `<article class="account-row"><div class="account-row__icon">${msymbol("group", "text-[20px]")}</div><div class="account-row__main"><strong>${escapeHtml(account.name)}</strong><small dir="ltr">${escapeHtml(account.username)}</small>${account.jobTitle ? `<small class="account-job-title">${escapeHtml(account.jobTitle)}</small>` : ""}${isPayrollAccount ? `<small class="account-salary-note">راتب الشهر ${money(salary?.monthlySalary ?? account.monthlySalary ?? 0)} · السلف ${money(salary?.advances || 0)} · خصم العجز ${money(salary?.shortageDeductions || 0)} · المتبقي ${money(salary?.remainingSalary || 0)}</small>` : ""}${cashierPermissionsSummaryMarkup(account)}</div><span class="account-badge account-badge--${account.role}">${roleLabel(account.role)}</span><span class="status status--${account.isActive ? "available" : "empty"}">${account.isActive ? "نشط" : "موقوف"}</span><div class="entity-row__actions">${salaryAction}<button class="icon-button" data-action="reset-account-pin" data-id="${account.id}" aria-label="إعادة تعيين رمز دخول ${escapeHtml(account.name)}">${msymbol("key", "text-[19px]")}</button><button class="icon-button" data-action="open-account" data-id="${account.id}" aria-label="تعديل ${escapeHtml(account.name)}">${msymbol("edit", "text-[19px]")}</button>${account.role === "cashier" && account.isActive ? `<button class="icon-button icon-button--danger" data-action="delete-cashier-account" data-id="${account.id}" aria-label="حذف الكاشير ${escapeHtml(account.name)}">${msymbol("delete", "text-[19px]")}</button>` : ""}</div></article>`; }).join("")}</section>`;
}

function activityLogMarkup() {
  const query = (state.activityQuery || "").trim().toLocaleLowerCase("ar");
  const typeFilter = state.activityType || "الكل";
  const types = ["الكل", "مبيعات", "مرتجع", "منتجات", "تعديل مخزون", "سند قبض", "سند صرف", "ورديات"];
  const list = (state.activityLogs || []).filter((log) => {
    if (typeFilter !== "الكل" && log.type !== typeFilter) return false;
    if (query && !`${log.details} ${log.accountName} ${log.type}`.toLocaleLowerCase("ar").includes(query)) return false;
    return true;
  });

  return `${topbarMarkup("سجل العمليات والتدقيق", "متابعة وتدقيق كافة الحركات التشغيلية والأمنية في النظام.", settingsBackAction())}
  <div class="settings-page settings-subpage">
    <section class="inventory-summary">
      <div><span>إجمالي الحركات</span><strong>${amount(state.activityLogs?.length || 0)} عملية</strong></div>
      <div><span>حركات اليوم</span><strong>${amount((state.activityLogs || []).filter((l) => dateKey(l.date) === dateKey()).length)} عملية</strong></div>
      <div><span>النوع المحدد</span><strong>${escapeHtml(typeFilter)}</strong></div>
    </section>
    <section class="toolbar toolbar--filter">
      <label class="search-field">${msymbol("search", "text-[19px]")}<input id="activity-search" dir="rtl" autocomplete="off" placeholder="ابحث في سجل التدقيق..." value="${escapeHtml(state.activityQuery || "")}" /></label>
      <div class="category-chips">
        ${types.map((t) => `<button type="button" class="category-chip ${typeFilter === t ? "is-active" : ""}" data-action="filter-activity-type" data-type="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("")}
      </div>
    </section>
    <section class="panel entity-list activity-log-list">
      ${list.length ? list.map((log) => {
        const typeIcon = log.type === "مبيعات" ? "cart" : log.type === "منتجات" ? "package" : log.type.includes("مخزون") ? "layers" : log.type.includes("قبض") || log.type.includes("صرف") ? "wallet" : log.type.includes("ورديات") ? "clock" : "shield";
        return `
          <article class="entity-row activity-row">
            <div class="entity-row__icon">${msymbol({ cart: "shopping_cart", package: "inventory_2", layers: "layers", wallet: "wallet", clock: "schedule", shield: "shield" }[typeIcon] || "shield", "text-[20px]")}</div>
            <div class="entity-row__main">
              <strong>${escapeHtml(log.details || "عملية")}</strong>
              <small>${dateTime(log.date)} · المنفذ: <span class="activity-user-badge">${escapeHtml(log.accountName || "النظام")}</span></small>
            </div>
            <span class="activity-type-tag activity-type-tag--${escapeHtml(log.type)}">${escapeHtml(log.type)}</span>
          </article>
        `;
      }).join("") : `<div class="inline-empty">لا توجد حركات مسجلة تطابق البحث الحالي.</div>`}
    </section>
  </div>`;
}

function recoveryNoticeMarkup(failedView) {
  const label = NAV_ITEMS.find((item) => item.id === failedView)?.label || "القسم";
  return `<section class="runtime-recovery" role="alert"><div>${msymbol("warning", "text-[19px]")}<div><strong>تعذر فتح ${escapeHtml(label)} مؤقتًا</strong><small>تم إبقاؤك في قسم يعمل وبياناتك المحلية لم تتغير.</small></div></div><button class="button button--secondary" type="button" data-runtime-retry="${escapeHtml(failedView)}">إعادة المحاولة</button></section>`;
}

function bindRecoveryControls(scope = root) {
  scope.querySelector("[data-runtime-retry]")?.addEventListener("click", (event) => { state.view = event.currentTarget.dataset.runtimeRetry || state.lastStableView; render(); });
  scope.querySelector("[data-runtime-safe-view]")?.addEventListener("click", () => { state.view = isAdmin(state.currentUser) ? "dashboard" : "sales"; render(); });
}

function renderRecovery(error) {
  const failedView = state.view;
  const safeView = isAdmin(state.currentUser) ? "dashboard" : "sales";
  console.error("[Hesabi render recovery]", { failedView, error });
  if (state.currentUser && failedView !== safeView) {
    state.view = safeView;
    try {
      renderApplication();
      root.querySelector(".workspace")?.insertAdjacentHTML("afterbegin", recoveryNoticeMarkup(failedView));
      bindRecoveryControls();
      return;
    } catch (fallbackError) { console.error("[Hesabi recovery fallback error]", fallbackError); }
  }
  const label = NAV_ITEMS.find((item) => item.id === failedView)?.label || "القسم";
  root.innerHTML = `<main class="fatal-state runtime-fatal"><div class="runtime-fatal__icon">${msymbol("warning", "text-[28px]")}</div><h1>تعذر فتح ${escapeHtml(label)} مؤقتًا</h1><p>لم نحذف أي بيانات محلية. يمكنك إعادة المحاولة أو العودة إلى قسم آمن.</p><div class="dialog__actions"><button id="runtime-retry" class="button button--primary" type="button">إعادة المحاولة</button><button id="runtime-safe-view" class="button button--secondary" type="button">العودة إلى قسم آمن</button></div></main>`;
  root.querySelector("#runtime-retry")?.addEventListener("click", () => { state.view = failedView; render(); });
  bindRecoveryControls();
}

function renderApplication() {
  updateStoreIcon();
  if (!state.settings?.setupCompleted || state.showSetupHome) { root.innerHTML = setupMarkup(); injectSetupRestoreControl(); bindEvents(); return; }
  if (!state.currentUser) { root.innerHTML = loginMarkup(); bindEvents(); return; }
  if (state.currentUser.mustChangePin) { root.innerHTML = requiredPinMarkup(); bindEvents(); return; }
  if (!canAccessView(state.currentUser, state.view)) state.view = isAdmin(state.currentUser) ? "dashboard" : "sales";
  if (state.isNavigatingBack) { state.isNavigatingBack = false; }
  else if (state.view !== state.lastStableView && canAccessView(state.currentUser, state.lastStableView)) {
    if (state.viewHistory[state.viewHistory.length - 1] !== state.lastStableView) state.viewHistory.push(state.lastStableView);
    if (state.viewHistory.length > 20) state.viewHistory.shift();
  }
  const body = { dashboard: dashboardMarkup, products: productsMarkup, inventory: inventoryMarkup, sales: salesMarkup, invoices: invoicesMarkup, customers: customersMarkup, "customer-payments": customerPaymentsMarkup, suppliers: suppliersMarkup, "supplier-payments": supplierPaymentsMarkup, purchases: purchasesMarkup, expenses: expensesMarkup, cashbox: cashboxMarkup, transfers: transfersMarkup, reports: reportsMarkup, "periodic-inventory": periodicInventoryMarkup, accounts: accountsMarkup, "activity-log": activityLogMarkup, settings: settingsMarkup, "general-settings": generalSettingsMarkup, "brand-settings": brandSettingsMarkup, "navigation-settings": navigationSettingsMarkup, "data-management": dataManagementMarkup }[state.view]?.() || dashboardMarkup();
  root.innerHTML = `<div class="app-shell">${navMarkup()}<main class="workspace">${appHeaderMarkup()}${body}</main>${salesScannerFabMarkup()}</div>`;
  if (state.view === "cashbox" && isAdmin(state.currentUser)) root.querySelector(".cashbox-panels")?.insertAdjacentHTML("beforeend", `${collapsiblePanel("shifts", { eyebrow: "صناديق الكاشير", title: "ورديات الكاشير وترحيل الخزنة", subtitle: "مراجعة الورديات وترحيلها إلى الخزنة", badge: `${amount((state.cashierShifts || []).length)} وردية`, glyph: "users" }, cashierShiftSummaryMarkup())}${collapsiblePanel("shiftStats", { eyebrow: "المساءلة المالية", title: "إحصاءات عجز وفائض الكاشير", subtitle: "متابعة الفروقات وتسويتها من الراتب", badge: `${amount((state.cashierShiftStatistics || []).length)} كاشير`, glyph: "chart" }, cashierDifferenceStatisticsMarkup())}${collapsiblePanel("salaries", { eyebrow: "رواتب الشهر الحالي", title: "رواتب الفريق وتسليم المستحقات", subtitle: "الرواتب والسلف وخصومات العجز", badge: `${amount((state.cashierSalarySummaries || []).length)} حساب`, glyph: "wallet" }, cashierSalarySummaryMarkup())}`);
  bindEvents();
  state.lastStableView = state.view;
}


/* بطاقات الرئيسية: الرقم يجب أن يبقى في سطر واحد؛ إذا زاد عرضه عن المتاح يُصغَّر
   حجم خطه تدريجيًا حتى 10px. قياس بعد التصيير فقط — لا يغيّر أي قيمة أو حساب. */
function fitMetricValues(scope) {
  // المهمة: أرقام بطاقات لوحة التحكم كثيرة المنازل تُصغَّر، ولا تنزل لسطر ثانٍ.
  // لا تلمس القيمة ولا أي منطق محاسبي — الكتابة الوحيدة هي style.fontSize.
  // المعيار هو التجاوز الفعلي المرئي: أقصى النص مقابل حدّ الحاوية الداخلي.
  // لا نشتق من عروض الصناديق، فهي تتمدد مع الشبكة مع كل تغيير وحده غير مستقر.
  const list = [...(scope || root).querySelectorAll(".metric-card strong, .metric-card > div:last-child strong, .daily-ribbon__value")];
  if (!list.length) return;
  const innerRight = (el) => {
    const box = el.parentElement;
    if (!box) return 0;
    return box.getBoundingClientRect().right - (parseFloat(getComputedStyle(box).paddingRight) || 0);
  };
  const floatText = (el, size) => {
    const probe = el.cloneNode(true);
    probe.removeAttribute("class");
    probe.setAttribute(
      "style",
      `position:absolute;left:-9999px;top:0;visibility:hidden;display:inline-block;width:auto;white-space:nowrap;font-size:${size}px`,
    );
    el.parentElement.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    probe.remove();
    return { width: Math.ceil(rect.width), right: rect.right, left: rect.left };
  };
  // النص يبدأ من موضع العنصر (أو من حدّ الحاوية لو كان العنصر أعرض منها)
  const textLeft = (el) => Math.max(el.getBoundingClientRect().left, (el.parentElement?.getBoundingClientRect().left || 0) + (parseFloat(getComputedStyle(el.parentElement || el).paddingLeft) || 0));
  for (const el of list) {
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize) || 19;
    const base = size;
    const start = textLeft(el);
    const limit = innerRight(el);
    if (!(limit > start)) continue;
    for (let step = 0; step < 5; step += 1) {
      const probe = floatText(el, size);
      const bleed = Math.ceil(probe.width - (limit - start));
      if (bleed <= 0) break;
      const next = Math.max(8, Math.floor(((size * (limit - start - 1)) / Math.max(1, probe.width)) * 10) / 10);
      if (next >= size) {
        if (step === 0) el.style.fontSize = ""; // لا سبيل إلى التصغير أكثر — نترك الحجم كما هو
        break;
      }
      size = next;
      el.style.fontSize = `${size}px`;
    }
    void base;
  }
}

/** يعيد التصيير ثم يُرجع موضع الصفحة: استبدال جذر العرض في Chromium يُسقط scrollY إلى صفر،
    فتبدو نقرة «عرض محتويات خانة» كأنها قفزة إلى أعلى الصفحة. قياسٌ وعرضٌ فقط — لا يمس الحساب. */
function renderKeepingScroll() {
  const y = Math.round(window.scrollY || document.documentElement.scrollTop || 0);
  const x = Math.round(window.scrollX || document.documentElement.scrollLeft || 0);
  const innerTop = root.querySelector(".cart-lines")?.scrollTop || 0;
  // «مرساة التمرير» في المتصفح تُزيح الصفحة بضع بيكسلات حين يتغيّر المحتوى؛ ونحن نُعيد الموضع
  // بأنفسنا، فتُعطَّل أثناء هذا التصيير فقط ثم تُعاد كما كانت.
  const html = document.documentElement;
  const anchorWas = html.style.overflowAnchor;
  html.style.overflowAnchor = "none";
  const restore = () => {
    if (Math.abs(Math.round(window.scrollY || 0) - y) > 1 || Math.abs(Math.round(window.scrollX || 0) - x) > 1) window.scrollTo(x, y);
    const list = root.querySelector(".cart-lines");
    if (list && innerTop && list.scrollTop !== innerTop) list.scrollTop = innerTop;
  };
  render();
  restore();
  // المتصفح يعيد «ترسيخ» الموضع بعد إطار أو اثنين من التصيير؛ نتابعه بأربع فرص ثم نتركه.
  let frames = 0;
  const tail = () => {
    restore();
    frames += 1;
    if (frames < 4) requestAnimationFrame(tail);
    else html.style.overflowAnchor = anchorWas;
  };
  requestAnimationFrame(tail);
}

function render() {
  try { renderApplication(); }
  catch (error) { renderRecovery(error); }
  requestAnimationFrame(() => {
    try { fitMetricValues(); } catch { /* القياس تجميلي */ }
    try { installSalesSheetGestures(); applySalesSheetGeometry(); } catch { /* الورقة تجميلية */ }
  });
}

function injectSetupRestoreControl() {
  const setupEyebrow = root.querySelector(".setup-art__copy .eyebrow");
  const setupStamp = root.querySelector(".setup-stamp");
  if (setupEyebrow) setupEyebrow.textContent = "سجل حسابي";
  if (setupStamp) setupStamp.textContent = "حسابي";
  const setupForm = root.querySelector("#setup-form");
  if (!setupForm || root.querySelector("#setup-restore-file")) return;
  const control = document.createElement("div");
  control.className = "setup-restore";
  control.innerHTML = `<span>لديك متجر محفوظ سابقًا؟</span><label class="button button--secondary button--wide" for="setup-restore-file">${msymbol("upload", "text-[19px]")} استعادة بيانات سابقة</label><input id="setup-restore-file" type="file" accept="application/json,.json" hidden /><small>اختر ملف نسخة «حسابي» الاحتياطية؛ ستعود بعدها إلى الدخول بحساباتك ورموزك السابقة.</small>`;
  setupForm.insertAdjacentElement("afterend", control);
}

function openCloudRestoreOnSetupDialog() {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">استعادة من نسخة سحابية</span><h2>افتح متجرك من السحابة</h2><p class="dialog__subtext">أدخل بريد وكلمة مرور النسخ السحابية أولًا. بعدها سيُطلب منك اسم مستخدم الأدمن ورمز دخوله الموجودان داخل النسخة.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="setup-cloud-auth-form" class="form-grid"><label class="form-full">بريد النسخ السحابية<input name="email" type="email" dir="ltr" autocomplete="email" required autofocus /></label><label class="form-full">كلمة مرور النسخ السحابية<input name="password" type="password" dir="ltr" autocomplete="current-password" minlength="6" required /></label><small class="offline-note form-full">هذا الحساب مخصص للوصول إلى النسخ فقط، ولا يغيّر حساب الأدمن المحلي.</small><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">متابعة إلى النسخة</button></div></form></div>`);
  const form = overlay.querySelector("#setup-cloud-auth-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      state.cloud.user = await signInCloudBackupUser(new FormData(form).get("email"), new FormData(form).get("password"));
      const backups = await listCloudBackups();
      const latest = backups[0];
      if (!latest) throw new Error("لا توجد نسخة سحابية مكتملة لهذا البريد.");
      const createdAt = latest.createdAtClient ? dateTime(latest.createdAtClient) : "غير معروف";
      form.outerHTML = `<form id="setup-cloud-admin-form" class="form-grid"><div class="cloud-backup-card__note form-full"><strong>تم العثور على أحدث نسخة</strong><span>${escapeHtml(latest.storeName || "حسابي")} · ${escapeHtml(createdAt)} · ${amount(latest.chunkCount || 0)} جزء</span></div><label class="form-full">اسم مستخدم الأدمن داخل النسخة<input name="username" dir="ltr" autocomplete="username" required minlength="3" maxlength="30" autofocus placeholder="مثال: admin" /></label><label class="form-full">رمز دخول الأدمن<input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" required minlength="4" maxlength="12" placeholder="••••" /></label><small class="offline-note form-full">سيتم التحقق من الحساب قبل استبدال أي بيانات على هذا الجهاز.</small><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">استعادة وفتح التطبيق ${msymbol("cloud_download", "text-[19px]")}</button></div></form>`;
      const adminForm = overlay.querySelector("#setup-cloud-admin-form");
      adminForm.addEventListener("submit", async (adminEvent) => {
        adminEvent.preventDefault();
        const restoreButton = adminForm.querySelector("button[type=submit]");
        restoreButton.disabled = true;
        try {
          const values = Object.fromEntries(new FormData(adminForm));
          const { payload } = await readCloudBackup(latest.id);
          db.validateBackup(payload);
          const restoredUser = await db.authenticateBackupAccount(payload, values);
          await db.restoreBackup(payload);
          state.settings = await db.getSettings();
          state.accounts = await db.listAccounts();
          state.currentUser = await db.authenticateAccount(values);
          await db.savePersistentSession(state.currentUser.id);
          installAutomaticBackups();
          state.cart = [];
          state.showSetupHome = false;
          state.view = "dashboard";
          await refresh();
          closeDialog();
          render();
          showToast(`تمت استعادة متجر ${storeDisplayName()} وفتح حساب ${restoredUser.name}.`);
        } catch (error) {
          restoreButton.disabled = false;
          showToast(error.message || "تعذرت استعادة النسخة السحابية.", "error");
        }
      });
      overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
    } catch (error) {
      submit.disabled = false;
      showToast(error.message || "تعذر الوصول إلى النسخة السحابية.", "error");
    }
  });
}

async function repairCloudWorkspace() {
  if (!isAdmin(state.currentUser) || !state.cloud.user) { showToast("اربط حساب النسخ السحابية للأدمن أولًا.", "error"); return; }
  try { state.cloud.busy = "repair"; render(); await ensureAdminCloudWorkspace(); await seedWorkspaceBackup(await db.exportBackup()); state.cloud.error = ""; showToast("تم إصلاح ربط المتجر بالبريد السحابي. جرّب إنشاء رمز الاقتران الآن."); } catch (error) { state.cloud.error = error.message || "تعذر إصلاح ربط المتجر."; showToast(state.cloud.error, "error"); } finally { state.cloud.busy = false; render(); }
}

async function ensureAdminCloudWorkspace() {
  if (!isAdmin(state.currentUser) || !state.cloud.user) return;
  const storeId = state.settings?.cloudStoreId || `store_${randomId()}`;
  if (!state.settings?.cloudStoreId) { await db.saveSettings({ cloudStoreId: storeId }); state.settings = await db.getSettings(); }
  state.cloud.identity = await createStoreWorkspace({ storeId, storeName: storeDisplayName(), ownerAccount: state.currentUser });
  try { await watchAssistantRequests(storeId, (requests) => { state.cloud.pairRequests = requests; if (state.view === "data-management") render(); }); } catch (error) { console.warn("[Hesabi pairing requests unavailable]", error); }
}

function openAssistantWaitingDialog(request) {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">طلب الجهاز المساعد</span><h2>بانتظار موافقة الأدمن</h2><p class="dialog__subtext">أرسلنا الطلب. بعد موافقة الأدمن سيعطيك رمزًا مؤقتًا؛ أدخله هنا لإكمال الدخول وتحميل بيانات المتجر.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="assistant-code-form" class="form-grid"><label class="form-full">رمز الدخول المؤقت<input name="token" dir="ltr" inputmode="text" autocomplete="one-time-code" placeholder="معرّف المتجر:123456" required autofocus /></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>لاحقًا</button><button class="button button--primary" type="submit">إكمال الدخول</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#assistant-code-form")?.addEventListener("submit", async (event) => { event.preventDefault(); try { state.cloud.identity = await redeemPairingInvite(new FormData(event.currentTarget).get("token")); if (state.cloud.identity.bootstrapChanges?.length) { await db.applySyncChanges(state.cloud.identity.bootstrapChanges); state.settings = await db.getSettings(); state.accounts = await db.listAccounts(); await refresh(); } closeDialog(); showToast(`تم ربط الجهاز بحساب ${state.cloud.identity.accountName}.`); render(); } catch (error) { showToast(error.message || "الرمز غير صحيح أو منتهي.", "error"); } });
}

function openAssistantEntryDialog() {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">دخول جهاز مساعد</span><h2>اطلب ربط هذا الجهاز</h2><p class="dialog__subtext">لا تحتاج إلى اختيار النشاط أو العملة أو كلمة مرور الأدمن. سيرسل حسابي الطلب للأدمن للموافقة.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="assistant-entry-form" class="form-grid"><label class="form-full">بريد المتجر الرئيسي<input name="ownerEmail" type="email" dir="ltr" autocomplete="email" required placeholder="البريد الذي يستخدمه الأدمن للنسخ السحابي" /></label><label class="form-full">اسم المستخدم في هذا الجهاز<input name="accountName" required maxlength="60" placeholder="مثال: أحمد" /></label><label class="form-full">نوع الحساب<select name="role"><option value="cashier">كاشير</option><option value="admin">أدمن مساعد</option></select></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">إرسال طلب للأدمن</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#assistant-entry-form")?.addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { const request = await requestAssistantDevice(values); closeDialog(); openAssistantWaitingDialog(request); } catch (error) { showToast(error.message || "تعذر إرسال طلب الربط.", "error"); } });
}

function setupMarkup() {
  return `<main class="setup-page"><section class="setup-art"><div class="setup-art__brand"><img src="${storeLogoUrl()}" alt="شعار المتجر" /><span class="brand-wordmark">حسابي</span><small>سجلّ المتجر اليومي</small></div><div class="setup-art__status"><span class="presence-dot"></span><span>نظامك المحلي جاهز للعمل دون اتصال</span></div><div class="setup-art__copy"><p class="eyebrow">سجل تشغيلي · المرحلة الأولى</p><h1>بيانات واضحة<br />لبداية يوم بيع منظّم.</h1><p>ستسجل هنا البيانات التي تظهر على الفواتير وتضبط عرض المخزون والمبيعات اليومية.</p><div class="setup-art__stamps"><span>المنتجات</span><span>المخزون</span><span>الفواتير</span></div></div><div class="setup-art__ledger-card"><span>خط سير اليوم</span><strong>منتج ← مخزون ← فاتورة</strong><i></i><i></i><i></i></div><img class="setup-art__image" src="${assetBaseUrl}/hesabi-setup-ledger_a7b0fae4.png" alt="رسم تعبيري لأدوات تنظيم المتجر" /></section><section class="setup-form-wrap"><div class="setup-sheet"><div class="setup-sheet__brand"><img src="${storeLogoUrl()}" alt="شعار المتجر" /><div><strong>حسابي</strong><span>دفتر التاجر الهادئ</span></div><span class="setup-stamp">خطوة 1 من 1</span></div><div class="setup-form"><section class="setup-welcome" aria-labelledby="setup-welcome-title"><span class="eyebrow">مرحبًا بك في حسابي</span><h2 id="setup-welcome-title">لنبدأ بخطوات بسيطة</h2><p>أنشئ حسابك الأول، أضف بيانات متجرك، ثم ابدأ تسجيل المنتجات والمبيعات بسهولة.</p><div class="setup-welcome__steps"><article><strong>1</strong><div><b>أنشئ حسابك</b><small>اختر اسم المستخدم وكلمة المرور الخاصة بك.</small></div></article><article><strong>2</strong><div><b>أكمل بيانات المتجر</b><small>حدد الاسم والنشاط والعملة التي تظهر في الفواتير.</small></div></article><article><strong>3</strong><div><b>ابدأ العمل</b><small>أضف المنتجات ثم سجّل أول عملية بيع.</small></div></article></div></section><span class="eyebrow">إعداد المتجر</span><h2>بيانات تُستخدم كل يوم</h2><p>أدخل معلومات البداية. يمكنك تعديلها لاحقًا من الإعدادات.</p><button class="button button--primary button--wide setup-register-button" type="button" data-action="open-setup-form">تسجيل جديد ${icon("arrow", 18)}</button><form id="setup-form" hidden><label>اسم المتجر<input name="storeName" dir="rtl" required maxlength="60" placeholder="مثال: بقالة الواحة" autofocus /></label><label>اسم المستخدم<input name="username" dir="ltr" required minlength="3" maxlength="30" autocomplete="username" placeholder="مثال: ahmed" /></label><label>اسم صاحب الحساب<input name="accountName" dir="rtl" required maxlength="60" autocomplete="name" placeholder="مثال: أحمد محمد" /></label><label>كلمة المرور<input name="pin" type="password" dir="ltr" required minlength="4" maxlength="64" autocomplete="new-password" placeholder="4 أحرف أو أرقام على الأقل" /></label><label>تأكيد كلمة المرور<input name="pinConfirm" type="password" dir="ltr" required minlength="4" maxlength="64" autocomplete="new-password" placeholder="أعد كتابة كلمة المرور" /></label><label>نوع النشاط<select name="businessType" required>${BUSINESS_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("")}</select></label><label>العملة<select name="currency" required>${CURRENCIES.map((currency) => `<option value="${currency.code}" ${currency.code === DEFAULT_CURRENCY_CODE ? "selected" : ""}>${currency.label}</option>`).join("")}</select></label><button class="button button--primary button--wide" type="submit">إنشاء الحساب وفتح المتجر ${icon("arrow", 18)}</button></form><a class="button button--secondary button--wide" href="./user-guide.html" target="_blank" rel="noopener">دليل الاستخدام ${icon("arrow", 18)}</a><button class="button button--secondary button--wide" type="button" data-action="cloud-restore-start">استعادة من نسخة سحابية ${msymbol("cloud_download", "text-[19px]")}</button><small class="offline-note"><span class="presence-dot"></span>يحفظ محليًا ويظل متاحًا بعد أول تحميل</small></div></div></section></main>`;
}

function bindSearchInput(selector, stateKey) {
  root.querySelector(selector)?.addEventListener("input", (event) => {
    const value = event.target.value;
    state[stateKey] = value;
    render();
    const restored = root.querySelector(selector);
    restored?.focus();
    restored?.setSelectionRange(value.length, value.length);
  });
}

function resetDesktopBarcodeReader() {
  window.clearTimeout(desktopBarcodeReader.resetTimer);
  desktopBarcodeReader.code = "";
  desktopBarcodeReader.startedAt = 0;
  desktopBarcodeReader.lastKeyAt = 0;
  desktopBarcodeReader.resetTimer = null;
}

async function handleDesktopBarcodeRead(code) {
  if (!state.currentUser || !canAccessView(state.currentUser, "sales") || state.scanner) return;
  const normalized = String(code || "").trim();
  const product = state.products.find((item) => [item.barcode, item.internalCode].some((value) => String(value || "").trim() === normalized));
  state.view = "sales";
  if (!product) {
    state.saleQuery = normalized;
    render();
    showToast("لم نجد هذا الباركود. راجع الرمز أو أضف المنتج أولًا.", "error");
    return;
  }
  const added = addToCart(product.id);
  if (!added) return;
  playScannerSuccessSound();
  notifyBarcodeRead();
  showToast(`أُضيف ${product.name} إلى السلة`);
}

function installDesktopBarcodeReader() {
  if (desktopBarcodeReaderInstalled) return;
  desktopBarcodeReaderInstalled = true;
  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || state.scanner) return;
    if (document.querySelector(".dialog-backdrop, #scanner-backdrop")) { resetDesktopBarcodeReader(); return; }
    const target = event.target instanceof Element ? event.target.closest("input, textarea, select, [contenteditable=true]") : null;
    if (target) return;
    const now = Date.now();
    if (event.key === "Enter" || event.key === "Tab") {
      const code = desktopBarcodeReader.code;
      const startedAt = desktopBarcodeReader.startedAt;
      resetDesktopBarcodeReader();
      if (!isDesktopBarcodeWedge({ code, startedAt, completedAt: now })) return;
      event.preventDefault();
      if (!shouldAcceptDesktopBarcode({ code, lastCode: desktopBarcodeReader.lastCode, lastAcceptedAt: desktopBarcodeReader.lastAcceptedAt, now })) return;
      desktopBarcodeReader.lastCode = String(code).trim();
      desktopBarcodeReader.lastAcceptedAt = now;
      void handleDesktopBarcodeRead(code);
      return;
    }
    if (!/^[0-9A-Za-z._-]$/.test(event.key)) { resetDesktopBarcodeReader(); return; }
    if (desktopBarcodeReader.lastKeyAt && now - desktopBarcodeReader.lastKeyAt > 180) resetDesktopBarcodeReader();
    if (!desktopBarcodeReader.code) desktopBarcodeReader.startedAt = now;
    desktopBarcodeReader.code += event.key;
    desktopBarcodeReader.lastKeyAt = now;
    window.clearTimeout(desktopBarcodeReader.resetTimer);
    desktopBarcodeReader.resetTimer = window.setTimeout(resetDesktopBarcodeReader, 320);
  }, true);
}


// ===== عرض حقول التاريخ بصيغة يوم/شهر/سنة بدل صيغة المتصفح (شهر/يوم/سنة) =====
function formatDateInputDisplay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function decorateDateInput(input) {
  const wrap = input.closest(".date-field-wrap");
  if (!wrap) return;
  const display = formatDateInputDisplay(input.value);
  let node = wrap.querySelector(".date-field-display");
  if (!display) {
    wrap.classList.remove("is-overlaid");
    node?.remove();
    return;
  }
  if (!node) {
    node = document.createElement("span");
    node.className = "date-field-display";
    input.insertAdjacentElement("afterend", node);
  }
  node.textContent = display;
  wrap.classList.add("is-overlaid");
}

function bindDateInputDisplays() {
  root.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.closest(".date-field-wrap")) {
      const wrap = document.createElement("span");
      wrap.className = "date-field-wrap";
      input.replaceWith(wrap);
      wrap.appendChild(input);
    }
    if (!input.title) input.title = "الصيغة: يوم/شهر/سنة";
    decorateDateInput(input);
    if (input.dataset.displayBound) return;
    input.dataset.displayBound = "1";
    input.addEventListener("input", () => decorateDateInput(input));
    input.addEventListener("change", () => decorateDateInput(input));
    input.addEventListener("blur", () => decorateDateInput(input));
  });
}

function bindEvents() {
  root.querySelectorAll("[data-action]").forEach((element) => element.addEventListener("click", handleAction));
  bindDateInputDisplays();
  root.querySelectorAll("[data-notification-topic]").forEach((input) => input.addEventListener("change", () => toggleNotificationTopic(input.dataset.notificationTopic)));
  root.querySelector("#setup-form")?.addEventListener("submit", handleSetup);
  root.querySelector("#login-form")?.addEventListener("submit", handleLogin);
  root.querySelector("#required-pin-form")?.addEventListener("submit", changeRequiredPin);
  bindSearchInput("#product-search", "productQuery");
  bindSearchInput("#inventory-search", "inventoryQuery");
  bindSearchInput("#sale-search", "saleQuery");
  root.querySelector("#sale-search")?.addEventListener("keydown", async (event) => { if (event.key === "Enter" && event.target.value.trim()) await findBarcode(event.target.value.trim(), "sale"); });
  bindSearchInput("#invoice-search", "invoiceQuery");
  bindSearchInput("#supplier-search", "supplierQuery");
  bindSearchInput("#customer-search", "customerQuery");
  bindSearchInput("#payment-search", "paymentQuery");
  root.querySelector("#payment-filter")?.addEventListener("change", (event) => { state.paymentFrom = event.currentTarget.querySelector("[name=from]").value; state.paymentTo = event.currentTarget.querySelector("[name=to]").value; render(); });
  bindSearchInput("#supplier-payment-search", "supplierPaymentQuery");
  root.querySelector("#supplier-payment-filter")?.addEventListener("change", (event) => { state.supplierPaymentFrom = event.currentTarget.querySelector("[name=from]").value; state.supplierPaymentTo = event.currentTarget.querySelector("[name=to]").value; render(); });
  root.querySelector("#invoice-filter")?.addEventListener("change", (event) => { state.invoiceFrom = event.currentTarget.querySelector("[name=from]").value; state.invoiceTo = event.currentTarget.querySelector("[name=to]").value; render(); });
  bindSearchInput("#activity-search", "activityQuery");
  bindSearchInput("#expense-search", "expenseQuery");
  root.querySelector("#expense-filter")?.addEventListener("change", async (event) => { state.expenseFrom = event.currentTarget.querySelector("[name=from]").value; state.expenseTo = event.currentTarget.querySelector("[name=to]").value; try { await refresh(); render(); } catch (error) { showToast(error.message || "تعذر تحديث المصروفات.", "error"); } });
  root.querySelector("#report-filter")?.addEventListener("change", async (event) => { state.reportFrom = event.currentTarget.querySelector("[name=from]").value; state.reportTo = event.currentTarget.querySelector("[name=to]").value; state.analytics = await db.getAnalytics({ from: state.reportFrom, to: state.reportTo }); render(); });
  root.querySelector("#periodic-inventory-filter")?.addEventListener("change", async (event) => { const form = event.currentTarget; const selectedCycle = form.querySelector("[name=cycle]").value; const cycleChanged = selectedCycle !== state.auditCycle; state.auditCycle = selectedCycle; const defaults = periodicInventoryDefaultRange(selectedCycle); state.auditFrom = cycleChanged ? defaults.from : form.querySelector("[name=from]").value; state.auditTo = cycleChanged ? defaults.to : form.querySelector("[name=to]").value; await refresh(); render(); });
  root.querySelector("#cash-filter")?.addEventListener("change", async (event) => { state.cashFrom = event.currentTarget.querySelector("[name=from]").value; state.cashTo = event.currentTarget.querySelector("[name=to]").value; await refresh(); renderKeepingScroll(); /* تغيير الفترة لا يستحق قفزة إلى أعلى الصفحة */ });
  root.querySelector("#settings-form")?.addEventListener("submit", saveSettings);
  root.querySelector("#store-logo-file")?.addEventListener("change", handleStoreLogoFile);
  root.querySelector("#restore-file")?.addEventListener("change", restoreBackupFromFile);
  root.querySelector("#barcode-import-file")?.addEventListener("change", importBarcodeFile);
  root.querySelector("#setup-restore-file")?.addEventListener("change", restoreBackupFromFile);
  root.querySelector("#home-restore-file")?.addEventListener("change", restoreBackupFromFile);
  root.querySelectorAll("[data-category-action]").forEach((button) => button.addEventListener("click", () => { const category = button.dataset.category || "الكل"; if (button.dataset.categoryAction === "product-category") state.productCategory = category; else if (button.dataset.categoryAction === "sale-category") state.saleCategory = category; else if (button.dataset.categoryAction === "product-stock") state.productStockFilter = category; else if (button.dataset.categoryAction === "invoice-period") state.invoicePeriod = category; else if (button.dataset.categoryAction === "invoice-status") state.invoiceStatus = category; else if (button.dataset.categoryAction === "customer-debt") state.customerDebtFilter = category; else if (button.dataset.categoryAction === "supplier-debt") state.supplierDebtFilter = category; else state.inventoryCategory = category; render(); }));
  root.querySelectorAll("[data-cart-quantity]").forEach((input) => input.addEventListener("change", (event) => {
    setCartQuantity(event.currentTarget.dataset.cartQuantity, event.currentTarget.value, { renderNow: false });
    window.setTimeout(render, 0);
  }));
  root.querySelectorAll("[data-cart-carton-count]").forEach((input) => input.addEventListener("change", (event) => { setCartonCount(event.currentTarget.dataset.cartCartonCount, event.currentTarget.value); }));
  root.querySelectorAll("[data-cart-carton-size]").forEach((input) => input.addEventListener("change", (event) => { setCartonSize(event.currentTarget.dataset.cartCartonSize, event.currentTarget.value); }));
  root.querySelectorAll("[data-cart-line-discount]").forEach((input) => input.addEventListener("change", (event) => { setCartLineDiscount(event.currentTarget.dataset.cartLineDiscount, event.currentTarget.value); }));
  root.querySelectorAll("[data-cart-line-price]").forEach((input) => input.addEventListener("change", (event) => { setCartLinePrice(event.currentTarget.dataset.cartLinePrice, event.currentTarget.value); }));
  syncMobileNavigation();
}

function syncMobileNavigation() {
  const bottomNav = root.querySelector("[data-bottom-nav]");
  // الشريط السفلي مخفيّ على الحاسوب: عنصر بلا تخطيط يُجيب مستطيلًا صفريًا، وتمريره نحو
  // «الأنسب» يزيح الصفحة كلها. كما لا شيء يجب توسيطه حين يتّسع الشريط لكل عناصره.
  if (!bottomNav || !bottomNav.offsetWidth || bottomNav.scrollWidth <= bottomNav.clientWidth + 1) return;
  const activeItem = bottomNav.querySelector(`[data-view="${state.view}"]`);
  if (!activeItem) return;
  const keepY = Math.round(window.scrollY || 0);
  activeItem.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
  // توسيط أفقي فقط — لا نتركه يلمس الموضع الرأسي للصفحة.
  if (Math.abs(Math.round(window.scrollY || 0) - keepY) > 1) window.scrollTo(Math.round(window.scrollX || 0), keepY);
}

async function handleSetup(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  if (!values.storeName.trim()) { showToast("أدخل اسم المتجر أولًا.", "error"); return; }
  if (values.pin !== values.pinConfirm) { showToast("كلمتا المرور غير متطابقتين.", "error"); return; }
  try {
    await db.configureInitialAdmin({ username: values.username, pin: values.pin, name: values.accountName });
    const { username, pin, pinConfirm, accountName, ...settings } = values;
    await db.saveSettings(settings);
    state.accounts = await db.listAccounts();
  } catch (error) { showToast(error.message || "تعذر إنشاء الحساب الأول.", "error"); return; }
  state.showSetupHome = false;
  state.settings = await db.getSettings();
  await refresh();
  render();
  showToast(`أهلًا بك في ${state.settings.storeName}`);
}

async function handleLogin(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    state.currentUser = await db.authenticateAccount(values);
    await db.savePersistentSession(state.currentUser.id);
    installAutomaticBackups();
    await refresh();
    state.view = state.currentUser.role === "admin" ? "dashboard" : "sales";
    render();
    if (state.currentUser.role === "cashier" && !state.activeCashierShift) requestAnimationFrame(openCashierShiftStartDialog);
    showToast(`مرحبًا ${state.currentUser.name}`);
  } catch (error) { showToast(error.message || "تعذر تسجيل الدخول.", "error"); }
}

async function changeRequiredPin(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  if (values.pin !== values.pinConfirm) { showToast("رمزا الدخول غير متطابقين.", "error"); return; }
  try {
    await db.changeAccountPin(state.currentUser.id, values.pin);
    state.currentUser = { ...state.currentUser, mustChangePin: false };
    state.accounts = await db.listAccounts();
    render();
    showToast("تم تعيين رمز دخول جديد.");
  } catch (error) { showToast(error.message || "تعذر حفظ رمز الدخول.", "error"); }
}

async function handleAction(event) {
  try { await handleActionUnsafe(event); }
  catch (error) { console.error("[Hesabi action error]", error); showToast("تعذرت العملية دون تعديل بياناتك. أعد المحاولة.", "error"); }
}

async function handleActionUnsafe(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;
  if (action === "fill-login") { const input = root.querySelector("#login-form [name=username]"); if (input) { input.value = event.currentTarget.dataset.username; root.querySelector("#login-form [name=pin]")?.focus(); } return; }
  if (action === "toggle-sales-sheet") { commitSalesSheet(state.salesSheet === "full" ? "peek" : "full"); return; }
  if (action === "close-sales-sheet") { state.cart = []; state.cartDiscount = ""; state.salesSheet = "peek"; renderKeepingScroll(); return; }
  if (action === "open-phone-recovery") { openPhoneRecoveryDialog(); return; }
  if (action === "cloud-password-reset") { openCloudAuthDialog(); return; }
  if (action === "cloud-restore-start") { openCloudRestoreOnSetupDialog(); return; }
  if (action === "open-setup-form") { const form = root.querySelector("#setup-form"); const button = root.querySelector("[data-action=open-setup-form]"); if (form && button) { form.hidden = false; button.hidden = true; form.querySelector("[name=storeName]")?.focus(); } return; }
  if (action === "setup-home") { try { await signOutCloudBackupUser(); } catch { /* لا توجد جلسة سحابية أو تعذر فصلها. */ } state.cloud.user = null; state.cloud.identity = null; state.showSetupHome = true; render(); return; }
  if (action === "logout") { openLogoutConfirmDialog(); return; }
  if (action === "account-session") { openAccountSessionDialog(); return; }
  if (action === "go-back") {
    const target = event.currentTarget.dataset.view;
    if (!target || !canAccessView(state.currentUser, target)) { state.view = isAdmin(state.currentUser) ? "dashboard" : "sales"; render(); return; }
    while (state.viewHistory.length && state.viewHistory[state.viewHistory.length - 1] !== target) state.viewHistory.pop();
    state.viewHistory.pop();
    state.isNavigatingBack = true;
    state.view = target;
    render();
    return;
  }
  if (action === "navigate") { const view = event.currentTarget.dataset.view; if (!canAccessView(state.currentUser, view)) { adminOnlyMessage(); return; } state.view = view; render(); if (["settings", "data-management"].includes(view) && isAdmin(state.currentUser)) void refreshCloudBackups({ quiet: true }); return; }
  if (!state.currentUser) { render(); return; }
  if (action === "open-app-search") { openAppSearchDialog(); return; }
  if (action === "open-sales-scanner") { if (!canAccessView(state.currentUser, "sales")) { adminOnlyMessage(); return; } state.view = "sales"; render(); requestAnimationFrame(() => openScanner("sale")); return; }
  if (!canUseAction(state.currentUser, action, { mode: event.currentTarget.dataset.mode })) { adminOnlyMessage(); return; }
  if (action === "move-mobile-nav") { await updateMobileNavigationOrder(id, event.currentTarget.dataset.direction); return; }
  if (action === "reset-mobile-nav") { await resetMobileNavigationOrder(); return; }
  if (action === "enable-notifications") { await enableNotifications(); return; }
  if (action === "toggle-notifications-enabled") { const current = notificationSettings(); saveNotificationSettings({ enabled: !current.enabled }); showToast(current.enabled ? "أُوقفت الإشعارات مؤقتًا." : "استُؤنفت الإشعارات."); render(); return; }
  if (action === "test-notification") { const ok = await showAppNotification({ topic: "general", key: `test:${Date.now()}`, title: "إشعار تجريبي من حسابي", body: "إذا وصلك هذا الإشعار فالتنبيهات تعمل بشكل صحيح.", cooldownMs: 0 }); showToast(ok ? "أُرسل الإشعار التجريبي." : "تعذر الإرسال. تأكد من تفعيل الإشعارات.", ok ? "success" : "error"); return; }
  if (action === "reset-notification-history") { clearNotificationHistory(); showToast("أُعيد ضبط سجل التكرار. ستصلك التنبيهات من جديد."); void syncNotificationAlerts(); return; }
  if (action === "toggle-theme") { toggleTheme(); return; }
  if (action === "quick-lock") { openScreenLockDialog(); return; }
  if (action === "toggle-report-panel") { const key = event.currentTarget.dataset.panel; if (!state.reportPanels) state.reportPanels = {}; state.reportPanels[key] = !state.reportPanels[key]; renderKeepingScroll(); return; }
  if (action === "filter-activity-type") { state.activityType = event.currentTarget.dataset.type; render(); return; }
  if (action === "open-reorder-list") { openReorderDialog(); return; }
  if (action === "new-product") { openProductDialog(); return; }
  if (action === "open-product") { openProductDialog(await db.getProduct(id)); return; }
  if (action === "delete-product-direct") { softDeleteProductById(id); return; }
  if (action === "adjust-stock") { openAdjustmentDialog(await db.getProduct(id)); return; }
  if (action === "count-stock") { openStockCountDialog(await db.getProduct(id)); return; }
  if (action === "open-scanner") { openScanner(event.currentTarget.dataset.mode); return; }
  if (action === "add-cart") { addToCart(id); return; }
  if (action === "toggle-carton-sale") { toggleCartonSale(id); return; }
  if (action === "cart-increment") { changeCart(id, 1); return; }
  if (action === "cart-decrement") { changeCart(id, -1); return; }
  if (action === "cart-remove") { state.cart = state.cart.filter((line) => line.productId !== id); if (!state.cart.length) state.cartDiscount = ""; renderKeepingScroll(); return; }
  if (action === "clear-cart") { state.cart = []; state.cartDiscount = ""; render(); return; }
  if (action === "hold-cart") { openHoldInvoiceDialog(); return; }
  if (action === "open-held-invoices") { openHeldInvoicesDialog(); return; }
  if (action === "checkout") { openCheckoutDialog(event.currentTarget?.dataset.checkoutMethod || ""); return; }
  if (action === "open-invoice") { openInvoiceDialog(id); return; }
  if (action === "print-invoice-direct") { const invoice = await db.getInvoice(id); if (invoice) printInvoiceThermal(invoice); return; }
  if (action === "share-invoice-direct") { const invoice = await db.getInvoice(id); if (invoice) shareInvoice(invoice); return; }
  if (action === "new-customer") { openCustomerDialog(); return; }
  if (action === "open-customer") { openCustomerAccountDialog(id); return; }
  if (action === "edit-customer") { openCustomerDialog(state.customers.find((customer) => customer.id === id)); return; }
  if (action === "delete-customer") { deleteCustomer(id); return; }
  if (action === "record-customer-payment") { openCustomerPaymentDialog(id); return; }
  if (action === "remind-customer-whatsapp") { remindCustomerWhatsApp(id); return; }
  if (action === "remind-supplier-whatsapp") { remindSupplierWhatsApp(id); return; }
  if (action === "new-supplier") { openSupplierDialog(); return; }
  if (action === "open-supplier") { openSupplierDialog(state.suppliers.find((supplier) => supplier.id === id)); return; }
  if (action === "open-supplier-account") { openSupplierAccountDialog(id); return; }
  if (action === "delete-supplier") { deleteSupplier(id); return; }
  if (action === "new-supplier-payment") { openSupplierPaymentDialog(); return; }
  if (action === "record-supplier-payment") { openSupplierPaymentDialog(id); return; }
  if (action === "new-purchase") { openPurchaseEntryDialog(); return; }
  if (action === "open-purchase") { openPurchaseDialog(id); return; }
  if (action === "purchase-return") { openPurchaseReturnDialog(id); return; }
  if (action === "sale-return") { openSaleReturnDialog(id); return; }
  if (action === "new-expense") { openExpenseDialog(); return; }
  if (action === "new-cashier-salary-advance") { openCashierSalaryAdvanceDialog(); return; }
  if (action === "settle-staff-salary") { await settleStaffSalary(id); return; }
  if (action === "edit-expense") { openExpenseDialog(state.expenses.find((expense) => expense.id === id)); return; }
  if (action === "delete-expense") { deleteExpense(id); return; }
  if (action === "open-stock-history") { openStockHistoryDialog(id); return; }
  if (action === "new-cash-deposit") { openCashMovementDialog("DEPOSIT"); return; }
  if (action === "new-cash-withdrawal") { openCashMovementDialog("WITHDRAWAL"); return; }
  if (action === "deposit-incoming-transfer") { openIncomingTransferDepositDialog(event.currentTarget.dataset.transferKey); return; }
  if (action === "approve-cashier-surplus" || action === "reject-cashier-surplus") { await resolveCashierSurplus(id, action === "approve-cashier-surplus" ? "APPROVED" : "REJECTED"); return; }
  if (action === "transfer-cashier-shift") { openCashierShiftTransferDialog(id); return; }
  if (action === "deduct-cashier-shortages") { await openCashierShortageDeductionDialog(id); return; }
  if (action === "save-periodic-inventory") { openPeriodicInventorySaveDialog(); return; }
  if (action === "open-periodic-inventory") { openPeriodicInventoryDialog(id); return; }
  if (action === "clear-store-logo") { await clearStoreLogo(); return; }
  if (action === "export-backup") { downloadBackup(); return; }
  if (action === "choose-backup-directory") { chooseBackupDirectory(); return; }
  if (action === "export-barcodes") { exportBarcodesFile(); return; }
  if (action === "open-cloud-auth") { openCloudAuthDialog(); return; }
  if (action === "pairing-invite") { openPairingInviteDialog(); return; }
  if (action === "pairing-redeem") { openPairingRedeemDialog(); return; }
  if (action === "approve-pairing-request") { approvePairingRequestFromUi(id); return; }
  if (action === "cloud-upload-backup") { uploadCurrentCloudBackup(); return; }
  if (action === "cloud-refresh-backups") { refreshCloudBackups(); return; }
  if (action === "repair-cloud-workspace") { repairCloudWorkspace(); return; }
  if (action === "cloud-restore-backup") { restoreCloudBackup(id); return; }
  if (action === "cloud-delete-backup") { removeCloudBackup(id); return; }
  if (action === "cloud-signout") { disconnectCloudBackup(); return; }
  if (action === "export-report") { openReportExportDialog(); return; }
  if (action === "reset-data") { resetAllData(); return; }
  if (action === "delete-all-products") { deleteAllProducts(); return; }
  if (action === "new-account") { openAccountDialog(); return; }
  if (action === "open-account") { openAccountDialog(state.accounts.find((account) => account.id === id)); return; }
  if (action === "reset-account-pin") { openAccountPinDialog(state.accounts.find((account) => account.id === id)); return; }
  if (action === "delete-cashier-account") { await deleteCashierAccount(id); return; }
}

async function resolveCashierSurplus(shiftId, decision) {
  if (!isAdmin(state.currentUser)) { adminOnlyMessage(); return; }
  const shift = (state.cashierShifts || []).find((item) => item.id === shiftId);
  const surplus = money(toNumber(shift?.difference));
  const name = shift?.accountName || "الكاشير";
  const question = decision === "APPROVED"
    ? `اعتماد فائض ${surplus} لوردية ${name}؟ سيُضاف الفائض إلى الخزنة ويُحتسب في حساب الكاشير.`
    : `رفض فائض ${surplus} لوردية ${name}؟ لن يُضاف إلى الخزنة ولا إلى حساب الكاشير.`;
  if (!window.confirm(question)) return;
  try {
    await db.resolveCashierSurplus({ shiftId, decision, approvedByAccountId: state.currentUser?.id || "" });
    await refresh();
    render();
    showToast(decision === "APPROVED" ? `اعتُمد فائض ${surplus} وأُضيف إلى الخزنة.` : `رُفض فائض ${surplus} ولم يُضف إلى أي حساب.`, decision === "APPROVED" ? "success" : "info");
  } catch (error) {
    showToast(error?.message || "تعذر تنفيذ قرار الفائض.", "error");
  }
}

let lastAddedFlashTimeoutId = null;
function flashProductRow(productId) {
  state.lastAddedProductId = productId;
  window.clearTimeout(lastAddedFlashTimeoutId);
  lastAddedFlashTimeoutId = window.setTimeout(() => {
    state.lastAddedProductId = null;
    document.querySelectorAll(".is-flash-added").forEach((el) => el.classList.remove("is-flash-added"));
  }, 165);
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return false;
  const existing = state.cart.find((item) => item.productId === productId);
  if (!state.settings?.allowNegativeSales && existing && existing.quantity >= product.quantity) { showToast("الكمية المتوفرة غير كافية", "error"); return false; }
  if (existing) existing.quantity += 1;
  else state.cart.push({ productId: product.id, name: product.name, unitPrice: product.salePrice, quantity: 1, discount: "", packageUnit: product.purchasePackageUnit || "كرتون", unitsPerPackage: Math.max(1, toNumber(product.unitsPerPackage) || 1), soldAsPackage: false });
  state.saleQuery = "";
  flashProductRow(productId);
  if (navigator.vibrate) {
    try { navigator.vibrate(25); } catch {}
  }
  renderKeepingScroll(); // القائمة تبقى حيث هي: الإضافة إلى السلة ليست سببًا للعودة إلى أعلاها
  return true;
}

function changeCart(productId, delta) {
  const product = state.products.find((item) => item.id === productId);
  const line = state.cart.find((item) => item.productId === productId);
  if (!product || !line) return;
  const step = line.soldAsPackage ? Math.max(1, toNumber(line.unitsPerPackage)) : 1;
  if (!state.settings?.allowNegativeSales && delta > 0 && toNumber(line.quantity) + step > product.quantity) { showToast("الكمية المتوفرة غير كافية", "error"); return; }
  line.quantity += delta * step;
  if (line.quantity <= 0) state.cart = state.cart.filter((item) => item.productId !== productId);
  renderKeepingScroll(); // الضغطة على + أو − لا تستحق أن يقفز المستخدم إلى أعلى القائمة
}

function setCartQuantity(productId, quantity, { renderNow = true } = {}) {
  const product = state.products.find((item) => item.id === productId);
  const line = state.cart.find((item) => item.productId === productId);
  if (!product || !line) return;
  const next = toNumber(quantity);
  if (next <= 0) { state.cart = state.cart.filter((item) => item.productId !== productId); if (renderNow) render(); return; }
  if (!state.settings?.allowNegativeSales && next > toNumber(product.quantity)) { showToast("الكمية المتوفرة غير كافية", "error"); if (renderNow) render(); return; }
  line.quantity = next;
  if (renderNow) render();
}

function toggleCartonSale(productId) {
  const product = state.products.find((item) => item.id === productId); const line = state.cart.find((item) => item.productId === productId); if (!product || !line) return;
  const unitsPerPackage = Math.max(1, Math.floor(toNumber(line.unitsPerPackage ?? product.unitsPerPackage) || 1));
  if (unitsPerPackage <= 1) { showToast("لم تُسجل للمُنتج حبات داخل الكرتون في المشتريات بعد.", "error"); return; }
  if (line.soldAsPackage) { line.soldAsPackage = false; render(); return; }
  if (!state.settings?.allowNegativeSales && toNumber(product.quantity) < unitsPerPackage) { showToast(`لا توجد كمية كافية لبيع ${line.packageUnit || "كرتون"} كامل.`, "error"); return; }
  const cartonCount = Math.max(1, Math.ceil(toNumber(line.quantity) / unitsPerPackage)); const quantity = cartonCount * unitsPerPackage;
  if (!state.settings?.allowNegativeSales && quantity > toNumber(product.quantity)) { showToast("الكمية المتوفرة لا تكفي لعدد الكراتين المطلوب.", "error"); return; }
  line.soldAsPackage = true; line.unitsPerPackage = unitsPerPackage; line.packageUnit = line.packageUnit || product.purchasePackageUnit || "كرتون"; line.quantity = quantity; render();
}

function setCartonCount(productId, cartonCount) {
  const product = state.products.find((item) => item.id === productId); const line = state.cart.find((item) => item.productId === productId); if (!product || !line) return;
  const count = Math.max(1, Math.floor(toNumber(cartonCount))); const unitsPerPackage = Math.max(1, Math.floor(toNumber(line.unitsPerPackage) || 1)); const quantity = count * unitsPerPackage;
  if (!state.settings?.allowNegativeSales && quantity > toNumber(product.quantity)) { showToast("الكمية المتوفرة لا تكفي لعدد الكراتين.", "error"); render(); return; }
  line.quantity = quantity; line.soldAsPackage = true; render();
}

function setCartonSize(productId, units) {
  const product = state.products.find((item) => item.id === productId); const line = state.cart.find((item) => item.productId === productId); if (!product || !line) return;
  const nextUnits = Math.max(1, Math.floor(toNumber(units))); const cartonCount = Math.max(1, Math.round(toNumber(line.quantity) / Math.max(1, toNumber(line.unitsPerPackage)))); const quantity = cartonCount * nextUnits;
  if (!state.settings?.allowNegativeSales && quantity > toNumber(product.quantity)) { showToast("عدد الحبات المعدل يتجاوز المخزون المتاح.", "error"); render(); return; }
  line.unitsPerPackage = nextUnits; line.quantity = quantity; line.soldAsPackage = true; render();
}

function setCartLineDiscount(productId, value) {
  const line = state.cart.find((item) => item.productId === productId); if (!line) return;
  const raw = String(value || "").trim(); const lineSubtotal = roundMoney(toNumber(line.unitPrice) * toNumber(line.quantity)); const requested = calculateDiscountAmount(raw, lineSubtotal); const cashierLimit = roundMoney(lineSubtotal * 0.1);
  if (state.currentUser?.role === "cashier" && requested > cashierLimit) { const isPercentage = /[%٪]\s*$/.test(raw); line.discount = isPercentage ? "10%" : String(cashierLimit); showToast("أقصى خصم للكاشير هو 10% من قيمة السطر.", "error"); render(); return; }
  line.discount = raw; render();
}
function setCartLinePrice(productId, value) {
  const line = state.cart.find((item) => item.productId === productId); if (!line) return;
  if (!state.settings?.allowSalePriceEdit) { showToast("تعديل سعر البيع غير مسموح من الإعدادات.", "error"); render(); return; }
  const nextPrice = toNumber(value);
  if (nextPrice < 0) { showToast("سعر البيع لا يمكن أن يكون سالبًا.", "error"); render(); return; }
  line.unitPrice = nextPrice; render();
}

function openDialog(content) {
  closeDialog();
  const overlay = document.createElement("div");
  overlay.className = "dialog-backdrop";
  overlay.id = "dialog-backdrop";
  overlay.innerHTML = `<section class="dialog" role="dialog" aria-modal="true">${content}</section>`;
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeDialog(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-open"));
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  return overlay;
}

function closeDialog() { closeScannerDialog(); document.querySelector("#dialog-backdrop")?.remove(); }

function cashierPermissionsFieldsMarkup(account = null) {
  const currentAllowed = Array.isArray(account?.allowedViews)
    ? account.allowedViews
    : DEFAULT_CASHIER_ALLOWED_VIEWS;

  return `<div id="cashier-permissions-section" class="form-full cashier-permissions-section"><div class="cashier-permissions-header"><div><span class="eyebrow">صلاحيات الوصول</span><strong class="cashier-permissions-title">الشاشات والصفحات المسموحة للكاشير</strong><small class="field-hint">تحكم في الشاشات والصفحات المسموح لهذا الكاشير بفتحها (الافتراضي مبيعات وفواتيرها فقط).</small></div><div class="cashier-permissions-presets"><button type="button" class="button button--secondary button--compact" data-permissions-preset="sales-only">مبيعات وفواتير فقط</button><button type="button" class="button button--secondary button--compact" data-permissions-preset="all">تحديد الكل</button><button type="button" class="button button--secondary button--compact" data-permissions-preset="clear">إلغاء الكل</button></div></div><div class="cashier-permissions-grid">${CASHIER_CONFIGURABLE_PERMISSIONS.map((perm) => {
    const isChecked = currentAllowed.includes(perm.id);
    return `<label class="permission-toggle-card ${isChecked ? "is-active" : ""}"><div class="permission-toggle-info"><div class="permission-toggle-icon">${icon(perm.icon, 18)}</div><div class="permission-toggle-text"><strong class="permission-toggle-label">${escapeHtml(perm.label)}</strong><span class="permission-toggle-desc">${escapeHtml(perm.description)}</span></div></div><div class="switch-control"><input type="checkbox" name="allowedViews" value="${perm.id}" class="switch-input" ${isChecked ? "checked" : ""} /><span class="switch-slider" aria-hidden="true"></span></div></label>`;
  }).join("")}</div></div>`;
}

function accountFormMarkup(account = null) {
  const isEdit = Boolean(account);
  const isCurrentAdmin = isEdit && account?.id === state.currentUser?.id && account?.role === "admin";
  return `<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">${isEdit ? "تعديل الحساب" : "حساب جديد"}</span><h2>${isEdit ? `بيانات ${escapeHtml(account.name)}` : "إضافة حساب"}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="account-form" class="form-grid"><label>الاسم الظاهر<input name="name" dir="rtl" required maxlength="60" value="${escapeHtml(account?.name || "")}" autofocus /></label><label>اسم المستخدم<input name="username" dir="ltr" autocomplete="username" required minlength="3" maxlength="30" value="${escapeHtml(account?.username || "")}" /></label>${isEdit ? "" : `<label>كلمة المرور<input name="pin" type="password" autocomplete="new-password" required minlength="4" maxlength="64" /></label>`}${isCurrentAdmin ? `<label>رمز دخول جديد <small>(اختياري)</small><input name="newPin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="12" placeholder="اتركه فارغًا إذا لا تريد تغييره" /></label><label>تأكيد رمز الدخول الجديد<input name="newPinConfirm" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="12" /></label>` : ""}<label>الدور<select name="role">${ACCOUNT_ROLES.map((role) => `<option value="${role.id}" ${account?.role === role.id || (!account && role.id === "cashier") ? "selected" : ""}>${role.label}</option>`).join("")}</select></label><label>اللقب الوظيفي<input name="jobTitle" dir="rtl" maxlength="60" value="${escapeHtml(account?.jobTitle || "")}" placeholder="مثال: موظف نظافة، حسابات، توصيل" /><small class="field-hint">اختياري ويمكن إضافته أو تعديله لاحقًا.</small></label><label class="checkbox-field"><input name="isActive" type="checkbox" ${account?.isActive !== false ? "checked" : ""} /><span>الحساب نشط ويمكنه الدخول</span></label>${cashierPermissionsFieldsMarkup(account)}<div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">${isEdit ? "حفظ التعديلات" : "إنشاء الحساب"} ${msymbol("check", "text-[19px]")}</button></div></form></div>`;
}

function openAccountDialog(account = null) {
  const overlay = openDialog(accountFormMarkup(account));
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  const accountForm = overlay.querySelector("#account-form");
  const roleSelect = accountForm.elements.role;
  roleSelect.closest("label").insertAdjacentHTML("afterend", `<label id="account-salary-field">الراتب الشهري<input name="monthlySalary" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(account?.monthlySalary ?? "")}" placeholder="0" /><small class="field-hint">يستخدم لحساب السلف والراتب المتبقي للموظف.</small></label>`);
  const salaryField = accountForm.querySelector("#account-salary-field");
  const permissionsSection = accountForm.querySelector("#cashier-permissions-section");

  const syncRoleFields = () => {
    const role = roleSelect.value;
    const staff = role === "admin" || role === "cashier" || role === "employee";
    salaryField.hidden = !staff;
    salaryField.querySelector("input").disabled = !staff;
    if (permissionsSection) {
      const isCashierRole = role === "cashier";
      permissionsSection.hidden = !isCashierRole;
      permissionsSection.querySelectorAll("input[type=checkbox]").forEach((cb) => {
        cb.disabled = !isCashierRole;
      });
    }
  };
  roleSelect.addEventListener("change", syncRoleFields);
  syncRoleFields();

  overlay.querySelectorAll("[data-permissions-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.permissionsPreset;
      const checkboxes = permissionsSection.querySelectorAll("input[name=allowedViews]");
      checkboxes.forEach((cb) => {
        if (preset === "sales-only") {
          cb.checked = DEFAULT_CASHIER_ALLOWED_VIEWS.includes(cb.value);
        } else if (preset === "all") {
          cb.checked = true;
        } else if (preset === "clear") {
          cb.checked = false;
        }
        cb.closest(".permission-toggle-card")?.classList.toggle("is-active", cb.checked);
      });
    });
  });

  permissionsSection?.querySelectorAll("input[name=allowedViews]").forEach((cb) => {
    cb.addEventListener("change", () => {
      cb.closest(".permission-toggle-card")?.classList.toggle("is-active", cb.checked);
    });
  });

  accountForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    values.isActive = form.querySelector("[name=isActive]").checked;
    const newPin = String(values.newPin || "").trim();
    const newPinConfirm = String(values.newPinConfirm || "").trim();
    delete values.newPin;
    delete values.newPinConfirm;
    if (newPin || newPinConfirm) {
      if (newPin !== newPinConfirm) {
        showToast("رمزا الدخول الجديدان غير متطابقين.", "error");
        return;
      }
      values.pin = newPin;
    }

    if (values.role === "cashier") {
      const checkedBoxes = Array.from(form.querySelectorAll("input[name=allowedViews]:checked"));
      values.allowedViews = checkedBoxes.map((cb) => cb.value);
      if (!values.allowedViews.length) {
        values.allowedViews = [...DEFAULT_CASHIER_ALLOWED_VIEWS];
      }
    } else {
      delete values.allowedViews;
    }

    try {
      const updated = account ? await db.updateAccount(account.id, values) : await db.createAccount(values);
      if (account && newPin) await db.changeAccountPin(account.id, newPin);
      state.accounts = await db.listAccounts();
      if (account?.id === state.currentUser?.id) {
        state.currentUser = updated.isActive ? {
          ...state.currentUser,
          name: updated.name,
          role: updated.role,
          jobTitle: updated.jobTitle,
          monthlySalary: updated.monthlySalary,
          allowedViews: updated.allowedViews,
          mustChangePin: false,
        } : null;
        if (!state.currentUser) {
          await db.clearPersistentSession();
          state.cart = [];
        } else if (!canAccessView(state.currentUser, state.view)) {
          state.view = state.currentUser.allowedViews?.[0] || "sales";
        }
      }
      await refresh();
      closeDialog();
      render();
      showToast(account ? "تم حفظ بيانات الحساب والصلاحيات." : "تم إنشاء الحساب بنجاح.");
    } catch (error) {
      showToast(error.message || "تعذر حفظ الحساب.", "error");
    }
  });
}

function openPhoneRecoveryDialog() {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">استرداد بمراجعة المالك</span><h2>طلب استرداد رمز الدخول</h2><p class="dialog__subtext">أدخل رقم جوالك فقط. يصل الطلب إلى مالك المتجر، ثم يتواصل معك للتحقق قبل أن يمنحك رمزًا مؤقتًا. لا يُعاد تعيين أي رمز تلقائيًا.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="phone-recovery-form" class="form-grid"><label>رقم الجوال<input name="phone" type="tel" dir="ltr" inputmode="tel" autocomplete="tel" required minlength="7" maxlength="20" placeholder="777123456" autofocus /></label><small class="recovery-phone-note">لا تحتاج إلى بريد إلكتروني أو مفتاح طوارئ.</small><div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">إرسال الطلب ${msymbol("call", "text-[18px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#phone-recovery-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const rawPhone = String(new FormData(form).get("phone") || "").trim(); const phone = rawPhone.replace(/[^0-9+]/g, "");
    if (phone.replace(/\D/g, "").length < 7) { showToast("أدخل رقم جوال صحيحًا.", "error"); return; }
    const submit = form.querySelector("button[type=submit]"); submit.disabled = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const requestId = shortRandomId(); const payload = new FormData();
      payload.append("رقم_الطلب", requestId); payload.append("اسم_المتجر", storeDisplayName()); payload.append("رقم_الجوال", phone); payload.append("وقت_الطلب", new Date().toLocaleString("ar-EG")); payload.append("التعليمات", "اتصل بصاحب الرقم للتحقق، ثم أعد تعيين رمز مؤقت من صفحة الحسابات والصلاحيات. لا ترسل الرمز عبر البريد."); payload.append("_subject", `طلب استرداد حسابي #${requestId}`); payload.append("_template", "table");
      const response = await fetch(RECOVERY_REQUEST_ENDPOINT, { method: "POST", headers: { Accept: "application/json" }, body: payload, signal: controller.signal });
      if (!response.ok) throw new Error("تعذر إرسال الطلب الآن. حاول لاحقًا.");
      closeDialog(); showToast(`تم إرسال طلبك برقم ${requestId}. سيتواصل معك مالك المتجر للتحقق.`);
    } catch (error) { showToast(error?.name === "AbortError" ? "انتهت مهلة الإرسال. تحقق من الإنترنت ثم حاول مرة أخرى." : (error?.message || "تعذر إرسال طلب الاسترداد."), "error"); }
    finally { window.clearTimeout(timeout); submit.disabled = false; }
  });
}

function openAccountPinDialog(account) {
  if (!account) return;
  const cashier = account.role === "cashier";
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">إعادة تعيين آمنة</span><h2>إعادة تعيين رمز ${escapeHtml(account.name)}</h2><p class="dialog__subtext">سلّم الرمز المؤقت لصاحب الحساب فقط.${cashier ? " سيُطلب منه اختيار رمز جديد عند دخوله." : ""}</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="account-pin-form" class="form-grid"><label>الرمز المؤقت الجديد<input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" required minlength="4" maxlength="12" autofocus /></label><label>تأكيد الرمز المؤقت<input name="pinConfirm" type="password" inputmode="numeric" pattern="[0-9]*" required minlength="4" maxlength="12" /></label><div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">حفظ الرمز المؤقت ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#account-pin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.pin !== values.pinConfirm) { showToast("رمزا الدخول غير متطابقين.", "error"); return; }
    try {
      await db.resetAccountPinByAdmin(account.id, values.pin);
      state.accounts = await db.listAccounts();
      if (account.id === state.currentUser?.id) state.currentUser = { ...state.currentUser, mustChangePin: cashier };
      closeDialog(); render(); showToast(cashier ? "تم حفظ رمز مؤقت؛ سيختار الكاشير رمزًا جديدًا عند دخوله." : "تمت إعادة تعيين رمز الأدمن.");
    } catch (error) { showToast(error.message || "تعذر إعادة تعيين رمز الدخول.", "error"); }
  });
}

function productFormMarkup(product = null, presetBarcode = "") {
  const isEdit = Boolean(product);
  const profile = businessProfile();
  const unit = product?.unit || profile.defaultUnit;
  const packageUnit = product?.purchasePackageUnit || profile.defaultPackageUnit;
  const unitsPerPackage = Math.max(1, toNumber(product?.unitsPerPackage) || 1);
  const packageCost = toNumber(product?.lastPackageCost) || roundMoney(toNumber(product?.purchasePrice) * unitsPerPackage);
  const labels = packageFieldLabels(packageUnit, unit);
  const input = (name, label, type = "text", value = "", attrs = "") => `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${attrs} /></label>`;
  const barcodeField = `<label class="barcode-field">الباركود<div class="barcode-field__control"><input id="product-barcode" name="barcode" type="text" dir="ltr" inputmode="numeric" autocomplete="off" value="${escapeHtml(product?.barcode || presetBarcode)}" /><button id="scan-product-barcode" class="button button--secondary barcode-field__scan" type="button">${msymbol("qr_code_scanner", "text-[19px]")}<span>مسح</span></button></div><small id="barcode-feedback" class="barcode-feedback" aria-live="polite">اكتب الباركود أو امسحه بالكاميرا.</small></label>`;

  /* قسم العبوات: نفس منطق فاتورة الشراء — نوع العبوة، عدد الحبات فيها، وسعرها. */
  const packageSection = `
    <fieldset class="form-full product-package-fieldset">
      <legend><span class="eyebrow">التعبئة والتسعير</span></legend>
      <label class="checkbox-field product-package-toggle"><input type="checkbox" id="product-package-mode" ${unitsPerPackage > 1 ? "checked" : ""} /><span><strong>الإدخال بالعبوات (كراتين)</strong><small>احسب سعر ${escapeHtml(unit)} تلقائيًا من سعر العبوة</small></span></label>
      <div class="product-package-grid" id="product-package-grid" ${unitsPerPackage > 1 ? "" : "hidden"}>
        <label>نوع العبوة<select name="packageUnit">${profileOptions("packageUnits", packageUnit).map((item) => `<option value="${item}" ${item === packageUnit ? "selected" : ""}>${item}</option>`).join("")}</select></label>
        <label><span data-package-label="units">${labels.units}</span><input name="unitsPerPackage" type="number" min="1" step="1" value="${unitsPerPackage}" /></label>
        <label><span data-package-label="cost">${labels.cost}</span><input name="packageCost" type="number" min="0" step="0.01" value="${packageCost || ""}" /></label>
        ${!isEdit ? `<label><span data-package-label="quantity">${labels.quantity}</span><input name="packageQuantity" type="number" min="0" step="1" value="" placeholder="0" /></label>` : ""}
      </div>
      <p class="scanner-session-note" id="product-package-summary" ${unitsPerPackage > 1 ? "" : "hidden"}></p>
    </fieldset>`;

  return `<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">${isEdit ? "تحديث الكتالوج" : "منتج جديد"}</span><h2>${isEdit ? `تعديل ${escapeHtml(product.name)}` : "إضافة منتج"}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="product-form" class="form-grid" data-id="${product?.id || ""}">${input("name", "اسم المنتج", "text", product?.name, "required maxlength=100 autofocus dir=rtl")}${barcodeField}${input("internalCode", "الكود الداخلي", "text", product?.internalCode, "dir=ltr autocomplete=off")}${categorySelectMarkup(product?.category || "")}<label>وحدة المخزون والبيع<select name="unit">${profileOptions("units", unit).map((item) => `<option value="${item}" ${item === unit ? "selected" : ""}>${item}</option>`).join("")}</select></label>${packageSection}${input("purchasePrice", `<span data-package-label="purchase">سعر شراء ${escapeHtml(unit)}</span>`, "number", product?.purchasePrice ?? "", "min=0 step=0.01 required")}${input("salePrice", `<span data-package-label="sale">سعر بيع ${escapeHtml(unit)}</span>`, "number", product?.salePrice ?? "", "min=0 step=0.01 required")}${!isEdit ? input("quantity", `<span data-package-label="qty">الكمية الافتتاحية</span>`, "number", "", "min=0 step=0.001") : `<div class="locked-field"><span>الكمية الحالية</span><strong>${amount(product.quantity)} ${escapeHtml(product.unit)}</strong><small>تُعدّل من شاشة المخزون فقط.</small></div>`}${input("minimumStock", `<span data-package-label="min">الحد الأدنى للمخزون</span>`, "number", product?.minimumStock ?? "", "min=0 step=0.001")}${input("nearestProductionDate", "تاريخ الإنتاج", "date", product?.nearestProductionDate ?? "", "class=native-date-input dir=ltr")}${input("nearestExpiryDate", "تاريخ الانتهاء", "date", product?.nearestExpiryDate ?? "", "class=native-date-input dir=ltr")}<div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">${isEdit ? "حفظ التعديلات" : "حفظ المنتج"} ${msymbol("check", "text-[19px]")}</button></div></form>${isEdit ? `<div class="dialog__danger"><span>لا يُحذف المنتج نهائيًا؛ يحتفظ التطبيق بسجله إذا ارتبط بفواتير.</span><button class="text-button text-button--danger" id="delete-product">${msymbol("delete", "text-[18px]")} حذف من القائمة</button></div>` : ""}</div>`;
}

/* يربط حقول العبوة في نموذج المنتج: يحدّث المسميات ويحسب سعر الوحدة والكمية تلقائيًا. */
function bindProductPackageFields(overlay, form, { isEdit = false } = {}) {
  const toggle = overlay.querySelector("#product-package-mode");
  const grid = overlay.querySelector("#product-package-grid");
  const summary = overlay.querySelector("#product-package-summary");
  if (!toggle || !grid || !summary) return;

  const el = (name) => form.elements[name];
  const setLabel = (key, text) => overlay.querySelectorAll(`[data-package-label="${key}"]`).forEach((node) => { node.textContent = text; });

  const syncLabels = () => {
    const unit = el("unit")?.value || "حبة";
    const packageUnit = el("packageUnit")?.value || "كرتون";
    const labels = packageFieldLabels(packageUnit, unit);
    setLabel("units", labels.units);
    setLabel("cost", labels.cost);
    setLabel("quantity", labels.quantity);
    setLabel("purchase", `سعر شراء ${unit}`);
    setLabel("sale", `سعر بيع ${unit}`);
    setLabel("min", `الحد الأدنى بال${unit}`);
    setLabel("qty", `الكمية الافتتاحية بال${unit}`);
  };

  const recalc = () => {
    if (!toggle.checked) { summary.hidden = true; return; }
    const unit = el("unit")?.value || "حبة";
    const units = Math.max(1, Math.floor(toNumber(el("unitsPerPackage")?.value) || 1));
    const cost = Math.max(0, toNumber(el("packageCost")?.value));
    const packages = Math.max(0, toNumber(el("packageQuantity")?.value));
    const math = calculatePackagePurchase({ packageQuantity: packages || 0, unitsPerPackage: units, packageCost: cost });

    // سعر شراء الوحدة يُشتق من سعر العبوة، والكمية تُشتق من عدد العبوات.
    if (cost > 0 && units > 0) el("purchasePrice").value = roundMoney(math.unitCost);
    if (!isEdit && packages > 0) el("quantity").value = math.quantity;

    const parts = [`سعر ${unit}: ${money(math.unitCost)}`];
    if (!isEdit && packages > 0) parts.push(`سيدخل المخزون ${amount(math.quantity)} ${unit}`);
    if (packages > 0 && cost > 0) parts.push(`إجمالي التكلفة ${money(math.total)}`);
    summary.textContent = parts.join(" · ");
    summary.hidden = false;
  };

  toggle.addEventListener("change", () => {
    grid.hidden = !toggle.checked;
    summary.hidden = !toggle.checked;
    if (!toggle.checked) { if (el("unitsPerPackage")) el("unitsPerPackage").value = 1; }
    else recalc();
  });

  el("unit")?.addEventListener("change", () => { syncLabels(); recalc(); });
  el("packageUnit")?.addEventListener("change", () => { syncLabels(); recalc(); });
  ["unitsPerPackage", "packageCost", "packageQuantity"].forEach((name) => el(name)?.addEventListener("input", recalc));

  syncLabels();
  recalc();
}

function openProductDialog(product = null, presetBarcode = "") {
  const overlay = openDialog(productFormMarkup(product, presetBarcode));
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  const form = overlay.querySelector("#product-form");
  bindCategoryField(form);
  const unitSelect = form.elements.unit;
  const selectedUnit = product?.unit || businessProfile().defaultUnit;
  unitSelect.innerHTML = profileOptions("units", selectedUnit).map((unit) => `<option value="${unit}" ${unit === selectedUnit ? "selected" : ""}>${unit}</option>`).join("");
  bindProductPackageFields(overlay, form, { isEdit: Boolean(product) });
  const barcodeInput = overlay.querySelector("#product-barcode");
  const barcodeFeedback = overlay.querySelector("#barcode-feedback");
  if (product && isPharmacy()) {
    db.listProductBatches(product.id).then((batches) => {
      const rows = batches.length ? batches.map((batch) => `<div class="warning-row"><div class="warning-row__icon">${msymbol("inventory_2", "text-[19px]")}</div><div><strong>تشغيلة ${escapeHtml(batch.batchNumber || "غير مرقمة")}</strong><small>ينتهي في ${formatDate(batch.expiryDate)} · المتبقي ${amount(batch.remainingQuantity)} ${escapeHtml(product.unit)}</small></div></div>`).join("") : `<div class="inline-empty">لا توجد تشغيلات مسجلة لهذا المنتج بعد.</div>`;
      form.insertAdjacentHTML("afterend", `<section class="account-transactions"><div class="section-heading"><div><span class="eyebrow">سجل الصيدلية</span><h3>كميات التشغيلات</h3></div></div><div class="warning-list">${rows}</div></section>`);
    }).catch(() => {});
  }
  const checkProductBarcode = async () => {
    const duplicate = await db.findProductByBarcode(barcodeInput.value, product?.id);
    if (duplicate) {
      setBarcodeFeedback(barcodeFeedback, `هذا الباركود مستخدم بالفعل للمنتج: ${duplicate.name}`, "error");
      return duplicate;
    }
    setBarcodeFeedback(barcodeFeedback, barcodeInput.value.trim() ? "الباركود متاح للحفظ." : "اكتب الباركود أو امسحه بالكاميرا.", barcodeInput.value.trim() ? "success" : "neutral");
    return null;
  };
  barcodeInput.addEventListener("blur", () => { checkProductBarcode().catch((error) => showToast(error.message, "error")); });
  overlay.querySelector("#scan-product-barcode").addEventListener("click", () => openProductBarcodeScanner({ barcodeInput, barcodeFeedback, product, checkProductBarcode }));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    const values = Object.fromEntries(new FormData(submittedForm));
    if (values.category === "__custom__") values.category = String(values.customCategory || "").trim() || "أخرى";
    try {
      if (await checkProductBarcode()) return;
      if (product) await db.updateProduct(product.id, values); else await db.createProduct(values);
      await refresh(); closeDialog(); render(); showToast(product ? "تم حفظ تعديلات المنتج" : "تم حفظ المنتج وحركته الافتتاحية");
    } catch (error) { showToast(error.message, "error"); }
  });
  overlay.querySelector("#delete-product")?.addEventListener("click", async () => {
    if (!window.confirm("هل تريد إخفاء هذا المنتج من القوائم؟ لا يمكن التراجع عن ذلك من الواجهة.")) return;
    try { const result = await db.softDeleteProduct(product.id); await refresh(); closeDialog(); render(); showToast(result.linkedSales ? "أُخفي المنتج مع الحفاظ على الفواتير المرتبطة." : "أُخفي المنتج من القائمة."); } catch (error) { showToast(error.message, "error"); }
  });
}

function openAdjustmentDialog(product) {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">حركة مخزون</span><h2>تعديل مخزون ${escapeHtml(product.name)}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="stock-before"><span>الكمية الحالية</span><strong>${amount(product.quantity)} ${escapeHtml(product.unit)}</strong></div><form id="adjustment-form" class="form-grid"><label>الكمية الجديدة${quantityControlMarkup({ value: product.quantity, min: 0, step: "0.001", inputAttrs: "name=\"newQuantity\" autofocus" })}</label><label>سبب التعديل<textarea name="note" required maxlength="180" placeholder="مثال: جرد آخر اليوم"></textarea></label><div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button type="submit" class="button button--primary">تسجيل الحركة ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  bindQuantityControl(overlay.querySelector(".quantity-control"), { min: 0, step: 0.001, onChange: () => {} });
  overlay.querySelector("#adjustment-form").addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await db.adjustStock(product.id, values.newQuantity, values.note); await refresh(); closeDialog(); render(); showToast("تم تسجيل حركة تعديل المخزون"); } catch (error) { showToast(error.message, "error"); } });
}

function openStockCountDialog(product) {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">جرد المخزون</span><h2>جرد ${escapeHtml(product.name)}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="stock-before"><span>الكمية المسجلة</span><strong>${amount(product.quantity)} ${escapeHtml(product.unit)}</strong></div><form id="stock-count-form" class="form-grid"><label>الكمية الفعلية${quantityControlMarkup({ value: product.quantity, min: 0, step: "0.001", inputAttrs: "name=\"actualQuantity\" autofocus" })}</label><label>ملاحظة الجرد<textarea name="notes" required maxlength="180" placeholder="مثال: جرد نهاية اليوم"></textarea></label><div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button type="submit" class="button button--primary">تسجيل الجرد ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog)); bindQuantityControl(overlay.querySelector(".quantity-control"), { min: 0, step: 0.001, onChange: () => {} }); overlay.querySelector("#stock-count-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); const count = await db.recordStockCount({ productId: product.id, ...values }); await refresh(); closeDialog(); render(); showToast(`تم تسجيل الجرد بفارق ${amount(count.difference)} ${product.unit}`); } catch (error) { showToast(error.message, "error"); } });
}

function openCashierShiftTransferDialog(shiftId) {
  const shift = state.cashierShifts.find((item) => item.id === shiftId);
  if (!shift || shift.status !== "CLOSED" || shift.vaultTransferredAt) { showToast("هذه الوردية غير متاحة للترحيل.", "error"); return; }
  const difference = toNumber(shift.difference);
  const differenceNote = difference === 0 ? "لا يوجد عجز أو فائض؛ سيُعتمد مبلغ الجرد ضمن الخزنة." : difference < 0 ? `سيُسجل العجز ${money(Math.abs(difference))} كتسوية نقدية، ويمكن خصمه من الراتب لاحقًا بعد مراجعة الأدمن.` : `سيُسجل الفائض ${money(difference)} ضمن الخزنة فورًا.`;
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">ترحيل صندوق فرعي</span><h2>ترحيل وردية ${escapeHtml(shift.accountName || "الكاشير")}</h2><p class="dialog__subtext">اعتمد استلام مبلغ الجرد من صندوق الكاشير إلى الخزنة الرئيسية. لا يمكن تكرار هذا الترحيل.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="cashier-shift-handover__received"><span>مبلغ الجرد المستلم للخزنة</span><strong>${money(shift.countedCash)}</strong></div><p class="scanner-session-note">${differenceNote}</p><div class="dialog__actions"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button id="confirm-cashier-shift-transfer" class="button button--primary" type="button">اعتماد الترحيل ${msymbol("check", "text-[19px]")}</button></div></div>`);
  overlay.querySelector("#confirm-cashier-shift-transfer").addEventListener("click", async () => { try { await db.transferCashierShiftToVault({ shiftId: shift.id, transferredByAccountId: state.currentUser?.id || "" }); await refresh(); closeDialog(); render(); showToast("تم ترحيل صندوق الوردية إلى الخزنة."); } catch (error) { showToast(error.message || "تعذر ترحيل الوردية.", "error"); } });
}

async function openCashierShortageDeductionDialog(accountId) {
  const cashier = state.accounts.find((account) => account.id === accountId && account.role === "cashier");
  if (!cashier) { showToast("تعذر العثور على حساب الكاشير.", "error"); return; }
  const candidates = await db.listCashierShortageCandidates({ accountId });
  if (!candidates.length) { showToast("لا توجد ورديات عجز مرحّلة بانتظار التسوية لهذا الشهر.", "error"); return; }
  const summary = (state.cashierSalarySummaries || []).find((item) => item.accountId === accountId); const remainingSalary = toNumber(summary?.remainingSalary);
  const rows = candidates.map((shift) => `<label class="cashier-shortage-choice"><input type="checkbox" name="shiftIds" value="${shift.id}" data-amount="${Math.abs(toNumber(shift.difference))}" checked /><span><strong>${formatDate(shift.date)}</strong><small>عجز وردية: ${money(Math.abs(toNumber(shift.difference)))}</small></span></label>`).join("");
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">تسوية عجز الراتب</span><h2>خصم عجز ${escapeHtml(cashier.name)}</h2><p class="dialog__subtext">اختر ورديات العجز المرحّلة فقط. يُحفظ الخصم كسجل راتب مستقل ولا ينشئ مصروفًا أو حركة خزنة جديدة.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="cashier-shortage-deduction-form" class="form-grid"><p class="form-full scanner-session-note">الراتب المتبقي بعد السلف والتسويات السابقة: <strong>${money(remainingSalary)}</strong></p><div class="form-full cashier-shortage-choices">${rows}</div><p id="cashier-shortage-deduction-preview" class="form-full field-hint"></p><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">اعتماد خصم العجز ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  const form = overlay.querySelector("#cashier-shortage-deduction-form"); const preview = overlay.querySelector("#cashier-shortage-deduction-preview"); const sync = () => { const selected = [...form.querySelectorAll("[name=shiftIds]:checked")]; const total = roundMoney(selected.reduce((sum, input) => sum + toNumber(input.dataset.amount), 0)); preview.textContent = total > remainingSalary ? `المحدد ${money(total)} أكبر من الراتب المتبقي؛ قلل الوردية المختارة أو سوِّ الفرق خارج الراتب.` : `إجمالي الخصم المحدد: ${money(total)} · سيبقى بعده: ${money(roundMoney(remainingSalary - total))}`; preview.classList.toggle("is-negative", total > remainingSalary); }; form.querySelectorAll("[name=shiftIds]").forEach((input) => input.addEventListener("change", sync)); sync();
  form.addEventListener("submit", async (event) => { event.preventDefault(); try { const shiftIds = new FormData(form).getAll("shiftIds"); const result = await db.deductCashierShortagesFromSalary({ accountId, shiftIds }); await refresh(); closeDialog(); render(); showToast(`تم خصم عجز ${money(result.amount)} من راتب ${cashier.name}.`); } catch (error) { showToast(error.message || "تعذر خصم العجز من الراتب.", "error"); } });
}

function openCashMovementDialog(type) {
  const label = type === "DEPOSIT" ? "إيداع في الصندوق" : "سحب من الصندوق";
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">حركة صندوق</span><h2>${label}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="cash-movement-form" class="form-grid"><label>المبلغ${quantityControlMarkup({ value: "", min: 0.01, step: "0.01", inputAttrs: "name=\"amount\" required autofocus" })}</label><label>التاريخ<input name="date" required type="date" value="${dateKey()}" /></label><label class="form-full">السبب أو الملاحظة<textarea name="notes" required maxlength="180" placeholder="مثال: إيداع بداية اليوم"></textarea></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">حفظ الحركة ${msymbol("check", "text-[19px]")}</button></div></form></div>`); overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog)); bindQuantityControl(overlay.querySelector(".quantity-control"), { min: 0.01, step: 0.01, onChange: () => {} }); overlay.querySelector("#cash-movement-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); await db.createCashMovement({ type, ...values }); await refresh(); closeDialog(); render(); showToast(`تم حفظ ${label}`); } catch (error) { showToast(error.message, "error"); } });
}

function periodicInventoryDetailsMarkup(audit) {
  const data = audit?.metrics || { inventory: {}, cash: {}, receivables: {}, payables: {}, transfers: {}, performance: {}, damage: {}, netPosition: 0 };
  const comparison = audit?.comparison ? `<section class="periodic-inventory-detail__comparison"><span>التغير عن الجرد السابق من الدورة نفسها</span><div><span>المخزون</span><strong class="${toNumber(audit.comparison.inventoryCostDelta) < 0 ? "is-negative" : ""}">${toNumber(audit.comparison.inventoryCostDelta) > 0 ? "+" : ""}${money(audit.comparison.inventoryCostDelta)}</strong></div><div><span>الخزنة</span><strong class="${toNumber(audit.comparison.vaultBalanceDelta) < 0 ? "is-negative" : ""}">${toNumber(audit.comparison.vaultBalanceDelta) > 0 ? "+" : ""}${money(audit.comparison.vaultBalanceDelta)}</strong></div><div><span>ديون العملاء</span><strong class="${toNumber(audit.comparison.customerDebtDelta) < 0 ? "is-negative" : ""}">${toNumber(audit.comparison.customerDebtDelta) > 0 ? "+" : ""}${money(audit.comparison.customerDebtDelta)}</strong></div><div><span>صافي الربح</span><strong class="${toNumber(audit.comparison.netProfitDelta) < 0 ? "is-negative" : ""}">${toNumber(audit.comparison.netProfitDelta) > 0 ? "+" : ""}${money(audit.comparison.netProfitDelta)}</strong></div></section>` : `<p class="periodic-inventory-detail__first">هذه أول لقطة محفوظة لهذه الدورة؛ ستظهر المقارنة عند اعتماد الجرد التالي.</p>`;
  return `<section class="periodic-inventory-detail"><div><span>المخزون بالتكلفة</span><strong>${money(data.inventory.cost)}</strong></div><div><span>الخزنة الرئيسية</span><strong>${money(data.cash.vaultBalance)}</strong></div><div><span>نقد لدى الكاشيرات</span><strong>${money(data.cash.cashierCashHeld)}</strong></div><div><span>ديون العملاء</span><strong>${money(data.receivables.customerDebt)}</strong></div><div><span>مستحقات الموردين</span><strong class="is-negative">−${money(data.payables.supplierPayables)}</strong></div><div><span>تحويلات غير موردة</span><strong>${money(data.transfers.incomingNotDeposited)}</strong></div><div><span>إجمالي المبيعات</span><strong>${money(data.performance.sales)}</strong></div><div><span>تكلفة البضاعة المباعة</span><strong>${money(data.performance.costOfGoods)}</strong></div><div><span>الربح الإجمالي</span><strong>${money(data.performance.grossProfit)}</strong></div><div><span>المصروفات</span><strong>${money(data.performance.expenses)}</strong></div><div><span>صافي الربح</span><strong class="${toNumber(data.performance.netProfit) < 0 ? "is-negative" : ""}">${money(data.performance.netProfit)}</strong></div><div class="periodic-inventory-detail__final"><span>صافي المركز التقريبي</span><strong class="${toNumber(data.netPosition) < 0 ? "is-negative" : ""}">${money(data.netPosition)}</strong></div>${comparison}<p class="periodic-inventory__damage-note">التالف: ${escapeHtml(data.damage.source || "غير مسجل في سجل مستقل.")}</p></section>`;
}

function openPeriodicInventorySaveDialog() {
  const range = currentPeriodicInventoryRange(); const data = state.periodicInventorySummary;
  if (!data) { showToast("جارٍ تجهيز ملخص الجرد. أعد المحاولة بعد لحظة.", "error"); return; }
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">اعتماد لقطة محاسبية</span><h2>جرد ${periodicInventoryCycleLabel(state.auditCycle)}</h2><p class="dialog__subtext">سيُحفظ الملخص للفترة ${formatDate(range.from)} إلى ${formatDate(range.to)} للمقارنة لاحقًا. لن يغيّر الحفظ أي كمية أو رصيد.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><section class="periodic-inventory-save-summary"><div><span>الخزنة</span><strong>${money(data.cash.vaultBalance)}</strong></div><div><span>المخزون</span><strong>${money(data.inventory.cost)}</strong></div><div><span>الديون</span><strong>${money(data.receivables.customerDebt)}</strong></div><div><span>صافي الربح</span><strong class="${toNumber(data.performance.netProfit) < 0 ? "is-negative" : ""}">${money(data.performance.netProfit)}</strong></div></section><form id="periodic-inventory-save-form" class="form-grid"><label class="form-full">ملاحظة الجرد (اختيارية)<textarea name="notes" maxlength="240" placeholder="مثال: مراجعة نهاية الشهر"></textarea></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">اعتماد وحفظ الجرد ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#periodic-inventory-save-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await db.createPeriodicInventory({ cycle: state.auditCycle, from: range.from, to: range.to, notes: values.notes, approvedByAccountId: state.currentUser?.id || "", approvedByName: state.currentUser?.name || "الأدمن" });
      await refresh(); closeDialog(); render(); showToast("تم اعتماد وحفظ لقطة الجرد للمقارنة.");
    } catch (error) { showToast(error.message || "تعذر حفظ الجرد.", "error"); }
  });
}

function periodicInventoryReportHtml(audit) {
  const data = audit?.metrics || { inventory: {}, cash: {}, receivables: {}, payables: {}, transfers: {}, performance: {}, damage: {}, netPosition: 0 };
  const cycle = periodicInventoryCycleLabel(audit.cycle);
  const rows = [
    ["البيان المحاسبي", "القيمة"],
    ["المخزون بالتكلفة", money(data.inventory.cost || 0)],
    ["الخزنة الرئيسية", money(data.cash.vaultBalance || 0)],
    ["نقد لدى الكاشيرات", money(data.cash.cashierCashHeld || 0)],
    ["ديون العملاء", money(data.receivables.customerDebt || 0)],
    ["تحويلات غير موردة", money(data.transfers.incomingNotDeposited || 0)],
    ["مستحقات الموردين", `−${money(data.payables.supplierPayables || 0)}`],
    ["صافي المركز التقريبي", money(data.netPosition || 0)],
    ["إجمالي المبيعات", money(data.performance.sales || 0)],
    ["صافي المبيعات", money(data.performance.netSales || 0)],
    ["تكلفة البضاعة المباعة", money(data.performance.costOfGoods || 0)],
    ["الربح الإجمالي", money(data.performance.grossProfit || 0)],
    ["المصروفات المعترف بها", money(data.performance.expenses || 0)],
    ["صافي الربح", money(data.performance.netProfit || 0)],
    ["مرتجع البيع", `−${money(data.performance.salesReturns || 0)}`],
    ["مرتجع الشراء", money(data.performance.purchaseReturns || 0)],
    ["التالف", money(data.damage.amount || 0)],
  ];
  return renderOfficialReportHtml({
    title: `تقرير الجرد المحاسبي الدوري (${cycle})`,
    rows,
    storeName: storeDisplayName(),
    storeInfo: state.settings,
    logoDataUrl: storeLogoDataUrl() || storeLogoUrl(),
    from: formatDate(audit.periodFrom),
    to: formatDate(audit.periodTo),
    generatedAt: dateTime(audit.createdAt || new Date()),
    cashierName: audit.approvedByName || state.currentUser?.name || "الأدمن",
    summaryCards: [
      { label: "المخزون بالتكلفة", value: money(data.inventory.cost || 0) },
      { label: "الخزنة والسيولة", value: money(data.cash.vaultBalance || 0) },
      { label: "ديون العملاء", value: money(data.receivables.customerDebt || 0) },
      { label: "صافي المركز", value: money(data.netPosition || 0), isHighlight: true, isNegative: toNumber(data.netPosition) < 0 },
    ],
    footerNote: `اعتمد بواسطة: ${audit.approvedByName || "الأدمن"} · نظام حسابي لإدارة الأنشطة التجارية والمخزون.`,
    includeSignatures: true,
  });
}

function openPeriodicInventoryDialog(auditId) {
  const audit = state.periodicInventories.find((item) => item.id === auditId);
  if (!audit) { showToast("لقطة الجرد غير متاحة الآن.", "error"); return; }
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">لقطة جرد محفوظة</span><h2>جرد ${periodicInventoryCycleLabel(audit.cycle)}</h2><p class="dialog__subtext">${formatDate(audit.periodFrom)} إلى ${formatDate(audit.periodTo)} · اعتمد في ${dateTime(audit.createdAt)} بواسطة ${escapeHtml(audit.approvedByName || "الأدمن")}</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div>${periodicInventoryDetailsMarkup(audit)}${audit.notes ? `<p class="periodic-inventory-detail__notes"><strong>ملاحظة:</strong> ${escapeHtml(audit.notes)}</p>` : ""}<div class="dialog__actions"><button id="share-periodic-inventory" class="button button--secondary" type="button">مشاركة PDF</button><button id="print-periodic-inventory" class="button button--secondary" type="button">طباعة الجرد</button><button class="button button--primary" type="button" data-dialog-close>إغلاق</button></div></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#share-periodic-inventory")?.addEventListener("click", async () => {
    try {
      const html = periodicInventoryReportHtml(audit);
      const result = await shareOrDownloadPdf({ html, filename: `جرد-${audit.cycle}-${audit.periodTo}.pdf`, title: `جرد ${periodicInventoryCycleLabel(audit.cycle)}` });
      showToast(result === "shared" ? "تمت مشاركة تقرير الجرد PDF" : "تم تنزيل تقرير الجرد PDF");
    } catch (error) {
      if (error?.name !== "AbortError") showToast(error.message || "تعذر إنشاء PDF للجرد.", "error");
    }
  });
  overlay.querySelector("#print-periodic-inventory")?.addEventListener("click", () => {
    printHtmlDocument({ html: periodicInventoryReportHtml(audit), target: "hesabi-periodic-inventory" });
    showToast("تم إرسال تقرير الجرد للطباعة");
  });
}

function openIncomingTransferDepositDialog(transferKey) {
  const transfer = incomingTransferEntries().find((item) => item.key === transferKey);
  if (!transfer || toNumber(transfer.availableForVault) <= 0) { showToast("لا يوجد مبلغ متبقٍ من هذه الحوالة لتوريده.", "error"); return; }
  const available = roundMoney(transfer.availableForVault);
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">توريد حوالة للخزنة</span><h2>${escapeHtml(transfer.label)}</h2><p class="dialog__subtext">إجمالي الحوالة ${money(transfer.amount)} · سبق توريد ${money(transfer.deposited)} · المتاح الآن ${money(available)}.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="incoming-transfer-deposit-form" class="form-grid"><label>المبلغ المراد توريده${quantityControlMarkup({ value: available, min: 0.01, max: available, step: "0.01", inputAttrs: "name=\"amount\" required autofocus" })}<small class="field-hint">يمكنك توريد كامل المتبقي أو جزء منه فقط.</small></label><label>تاريخ التوريد<input name="date" required type="date" value="${dateKey()}" /></label><label class="form-full">ملاحظة (اختياري)<textarea name="notes" maxlength="180" placeholder="مثال: سحب نقدي من الحساب البنكي"></textarea></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">توريد للخزنة ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog)); bindQuantityControl(overlay.querySelector(".quantity-control"), { min: 0.01, max: available, step: 0.01, onChange: () => {} });
  overlay.querySelector("#incoming-transfer-deposit-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); const result = await db.depositIncomingTransferToVault({ sourceType: transfer.sourceType, sourceId: transfer.sourceId, ...values }); await refresh(); closeDialog(); render(); showToast(`تم توريد ${money(result.amount)} للخزنة. المتبقي من الحوالة ${money(result.remainingAfter)}.`); } catch (error) { showToast(error.message || "تعذر توريد الحوالة إلى الخزنة.", "error"); } });
}

async function saveSettings(event) { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); values.allowNegativeSales = Boolean(event.currentTarget.querySelector("[name=allowNegativeSales]")?.checked); values.allowSalePriceEdit = Boolean(event.currentTarget.querySelector("[name=allowSalePriceEdit]")?.checked); await db.saveSettings(values); state.settings = await db.getSettings(); await refresh(); render(); showToast("تم حفظ إعدادات المتجر"); } catch (error) { showToast(error.message, "error"); } }

async function handleStoreLogoFile(event) { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return; try { const dataUrl = await prepareStoreLogoDataUrl(file); await db.saveStoreLogoDataUrl(dataUrl); state.settings = await db.getSettings(); await refresh(); render(); showToast("تم حفظ شعار المتجر محليًا ويظهر في النسخة الاحتياطية وPDF."); } catch (error) { showToast(error.message || "تعذر حفظ شعار المتجر.", "error"); } }
async function clearStoreLogo() { try { await db.saveStoreLogoDataUrl(""); state.settings = await db.getSettings(); await refresh(); render(); showToast("تمت استعادة شعار حسابي الافتراضي."); } catch (error) { showToast(error.message || "تعذر استعادة الشعار الافتراضي.", "error"); } }

function downloadBackupPayload(backup, suffix = dateKey()) { const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `hesabi-backup-${suffix}.json`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); }

function downloadBinaryFile(content, filename, type = "application/octet-stream") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
function taskProgressMarkup(title) { const node = document.createElement("div"); node.className = "task-progress"; node.dataset.layer = "import-progress"; node.setAttribute("role", "status"); node.innerHTML = `<div class="task-progress__card"><div class="task-progress__head"><strong>${escapeHtml(title)}</strong><span data-task-percent>0%</span></div><div class="task-progress__track"><span data-task-bar></span></div><p data-task-message>جاري تجهيز المهمة...</p></div>`; document.body.appendChild(node); return { update(percent, message) { const value = Math.max(0, Math.min(100, Math.round(percent))); node.querySelector("[data-task-percent]").textContent = `${value}%`; node.querySelector("[data-task-bar]").style.width = `${value}%`; if (message) node.querySelector("[data-task-message]").textContent = message; }, complete(message) { this.update(100, message); node.classList.add("is-complete"); window.setTimeout(() => node.remove(), 1800); } }; }
function confirmImportReplacement(product, index, total) { return new Promise((resolve) => { const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">تأكيد الاستيراد · ${index} من ${total}</span><h2>المنتج موجود مسبقًا</h2><p class="dialog__subtext"><strong>${escapeHtml(product.name)}</strong><br />توجد بيانات مختلفة في الملف. اختر الإجراء المناسب.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="import-confirm-choice"><button type="button" class="import-choice-button" data-import-replace-one><strong>استبدال الحالي</strong><span>استبدال هذا المنتج فقط.</span></button><button type="button" class="import-choice-button" data-import-replace-all><strong>استبدال الكل</strong><span>استبدال هذا وكل المنتجات المتعارضة التالية.</span></button><button type="button" class="import-choice-button" data-import-skip-one><strong>تخطي الحالي</strong><span>الحفاظ على هذا المنتج والانتقال للذي بعده.</span></button><button type="button" class="import-choice-button" data-import-skip-all><strong>تخطي الكل</strong><span>الحفاظ على كل المنتجات الموجودة.</span></button></div></div>`); overlay.classList.add("dialog-backdrop--priority"); overlay.dataset.layer = "import-confirmation"; overlay.style.zIndex = "2000"; const finish = (value) => { closeDialog(); resolve(value); }; overlay.querySelector("[data-import-replace-one]").addEventListener("click", () => finish("replace-one")); overlay.querySelector("[data-import-replace-all]").addEventListener("click", () => finish("replace-all")); overlay.querySelector("[data-import-skip-one]").addEventListener("click", () => finish("skip-one")); overlay.querySelector("[data-import-skip-all]").addEventListener("click", () => finish("skip-all")); overlay.addEventListener("click", (event) => { if (event.target === overlay) finish("skip-all"); }); }); }
async function exportBarcodesFile() { const progress = taskProgressMarkup("تصدير ملف الباركودات"); try { progress.update(35, "جاري تجهيز بيانات المنتجات..."); await new Promise((resolve) => requestAnimationFrame(resolve)); const content = createBarcodeWorkbook(state.products); progress.update(75, "جاري إنشاء ملف Excel..."); await new Promise((resolve) => requestAnimationFrame(resolve)); downloadBinaryFile(content, `hesabi-barcodes-${dateKey()}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); progress.complete(`اكتمل التصدير: ${state.products.length} منتج.`); showToast("اكتمل تصدير ملف الباركودات."); } catch (error) { progress.complete("تعذر إكمال التصدير."); showToast(error.message || "تعذر تصدير ملف الباركودات.", "error"); } }
async function importBarcodeFile(event) {
  const input = event.currentTarget; const file = input.files?.[0]; if (!file) return;
  try {
    const { records } = await parseBarcodeFile(file); const products = await db.listProducts(); const seenBarcodes = new Set(); let updated = 0; let created = 0; let skipped = 0; let unchanged = 0; const progress = taskProgressMarkup("استيراد ملف الباركودات");
    const normalizedExistingBarcode = (value) => String(value || "").trim().replace(/\.0+$/, "");
    const matches = records.map((record) => { const normalizedName = record.name.trim().toLocaleLowerCase("ar"); const existing = products.find((product) => normalizedExistingBarcode(product.barcode) === record.barcode || (normalizedName && product.name.toLocaleLowerCase("ar") === normalizedName)); const changed = existing && ((record.providedFields.includes("name") && record.name && record.name !== existing.name) || normalizedExistingBarcode(existing.barcode) !== record.barcode || (record.providedFields.includes("internalCode") && record.internalCode && record.internalCode !== existing.internalCode) || (record.providedFields.includes("purchasePrice") && Number(record.purchasePrice) !== Number(existing.purchasePrice)) || (record.providedFields.includes("salePrice") && Number(record.salePrice) !== Number(existing.salePrice)) || (record.providedFields.includes("unit") && record.unit && record.unit !== existing.unit) || (record.providedFields.includes("category") && record.category && record.category !== existing.category)); return { record, existing, changed }; });
    const changedMatches = matches.filter((match) => match.changed);
    let importMode = "ask";
    const failedRows = []; const operations = [];
    for (const [index, { record, existing, changed }] of matches.entries()) {
      progress.update((index / records.length) * 65, `جاري تجهيز المنتج ${index + 1} من ${records.length}...`);
      if (seenBarcodes.has(record.barcode)) { skipped += 1; continue; }
      seenBarcodes.add(record.barcode);
      if (existing && changed && importMode === "ask") { const choice = await confirmImportReplacement(existing, changedMatches.findIndex((match) => match.record.rowNumber === record.rowNumber) + 1, changedMatches.length); if (choice === "replace-all") importMode = "replace"; else if (choice === "skip-all") importMode = "skip"; else if (choice === "skip-one") { skipped += 1; continue; } }
      if (existing && changed && importMode === "skip") { skipped += 1; continue; }
      if (existing) { operations.push({ type: "update", current: existing, values: { name: record.name || existing.name, barcode: record.barcode, internalCode: record.internalCode || existing.internalCode, purchasePrice: record.providedFields.includes("purchasePrice") ? record.purchasePrice : existing.purchasePrice, salePrice: record.providedFields.includes("salePrice") ? record.salePrice : existing.salePrice, unit: record.providedFields.includes("unit") ? record.unit : existing.unit, category: record.providedFields.includes("category") && record.category ? record.category : existing.category } }); changed ? updated += 1 : unchanged += 1; }
      else { operations.push({ type: "create", values: { name: record.name || `صنف ${record.barcode}`, barcode: record.barcode, internalCode: record.internalCode, purchasePrice: record.purchasePrice, salePrice: record.salePrice, quantity: record.quantity, unit: record.unit, category: record.category || "أخرى" } }); created += 1; }
    }
    for (let offset = 0; offset < operations.length; offset += 50) { const batch = operations.slice(offset, offset + 50); await db.bulkUpsertProducts(batch); progress.update(65 + ((offset + batch.length) / Math.max(1, operations.length)) * 35, `جاري حفظ الدفعة ${Math.ceil((offset + batch.length) / 50)}...`); }
    await refresh(); render(); progress.complete(`اكتمل الاستيراد: ${created} جديدة و${updated} مستبدلة.`); showToast(`تم الاستيراد: ${created} جديدة و${updated} مستبدلة${unchanged ? ` و${unchanged} بدون تغيير` : ""}${skipped ? `، تم تخطي ${skipped}` : ""}${failedRows.length ? `، تعذر ${failedRows.length} صف` : ""}.`, failedRows.length ? "error" : "success");
  } catch (error) { showToast(error.message || "تعذر استيراد ملف الباركودات.", "error"); }
  finally { input.value = ""; }
}

function supportsLocalBackupDirectory() { return typeof window.showDirectoryPicker === "function"; }
function openBackupHandleDb() { return new Promise((resolve, reject) => { const request = indexedDB.open("hesabi-backup-handles", 1); request.onupgradeneeded = () => request.result.createObjectStore("handles"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function storeBackupDirectoryHandle(handle) { const database = await openBackupHandleDb(); await new Promise((resolve, reject) => { const tx = database.transaction("handles", "readwrite"); tx.objectStore("handles").put(handle, "local"); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); database.close(); }
async function readBackupDirectoryHandle() { if (localBackupDirectoryHandle) return localBackupDirectoryHandle; try { const database = await openBackupHandleDb(); localBackupDirectoryHandle = await new Promise((resolve, reject) => { const tx = database.transaction("handles", "readonly"); const request = tx.objectStore("handles").get("local"); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); database.close(); return localBackupDirectoryHandle; } catch { return null; } }
async function chooseBackupDirectory() { if (!supportsLocalBackupDirectory()) { showToast("اختيار مجلد النسخ غير مدعوم في هذا الجهاز. استخدم نسخة سطح المكتب الحديثة أو التصدير اليدوي.", "error"); return; } try { const handle = await window.showDirectoryPicker({ mode: "readwrite" }); localBackupDirectoryHandle = handle; await storeBackupDirectoryHandle(handle); await db.saveSettings({ localBackupDirectoryName: handle.name }); state.settings = await db.getSettings(); render(); showToast(`تم اختيار مجلد النسخ: ${handle.name}`); } catch (error) { if (error?.name !== "AbortError") showToast("تعذر اختيار مجلد النسخ.", "error"); } }
async function saveBackupToLocalDirectory(backup) { const handle = await readBackupDirectoryHandle(); if (!handle) return false; try { if (handle.queryPermission && await handle.queryPermission({ mode: "readwrite" }) !== "granted") return false; const fileHandle = await handle.getFileHandle(`hesabi-backup-${dateKey()}.json`, { create: true }); const writable = await fileHandle.createWritable(); await writable.write(JSON.stringify(backup, null, 2)); await writable.close(); return true; } catch (error) { console.warn("[Hesabi local backup directory unavailable]", error); return false; } }

async function runAutomaticBackups({ force = false } = {}) {
  if (automaticBackupBusy || !state.settings?.setupCompleted || !state.currentUser) return;
  automaticBackupBusy = true;
  try {
    const now = Date.now();
    const localMarker = localStorage.getItem(AUTOMATIC_LOCAL_BACKUP_MARKER) || "";
    if (force || localMarker !== dateKey()) {
      const savedToDirectory = await saveBackupToLocalDirectory(await db.exportBackup());
      if (!savedToDirectory) await db.createLocalBackup();
      localStorage.setItem(AUTOMATIC_LOCAL_BACKUP_MARKER, dateKey());
    }
    const cloudMarker = Number(localStorage.getItem(AUTOMATIC_CLOUD_BACKUP_MARKER) || 0);
    if (state.cloud.user && state.cloud.identity?.isOwnerDevice !== false && navigator.onLine !== false && (force || !cloudMarker || now - cloudMarker >= AUTOMATIC_CLOUD_BACKUP_INTERVAL_MS)) {
      await uploadCloudBackup(await db.exportBackup(), { storeName: storeDisplayName() });
      localStorage.setItem(AUTOMATIC_CLOUD_BACKUP_MARKER, String(now));
      if (state.view === "settings") await refreshCloudBackups({ quiet: true });
    }
  } catch (error) {
    console.warn("[Hesabi automatic backup unavailable]", error);
  } finally { automaticBackupBusy = false; }
}

function installAutomaticBackups() {
  if (automaticBackupTimer) return;
  window.setTimeout(() => { void runAutomaticBackups(); }, 5000);
  automaticBackupTimer = window.setInterval(() => { void runAutomaticBackups(); }, AUTOMATIC_BACKUP_CHECK_MS);
  window.addEventListener("online", () => { void runAutomaticBackups(); }, { passive: true });
}

async function downloadBackup() { try { downloadBackupPayload(await db.exportBackup()); showToast("تم تصدير النسخة الاحتياطية"); } catch (error) { showToast(error.message || "تعذر تصدير النسخة الاحتياطية.", "error"); } }

async function refreshCloudBackups({ quiet = false } = {}) {
  if (!isAdmin(state.currentUser) || !state.cloud.user) return;
  state.cloud.loading = true; state.cloud.error = ""; if (state.view === "settings") render();
  try { state.cloud.backups = await listCloudBackups(); }
  catch (error) { state.cloud.error = error.message || "تعذر تحميل النسخ السحابية."; if (!quiet) showToast(state.cloud.error, "error"); }
  finally { state.cloud.loading = false; if (state.view === "settings") render(); }
}

function openCloudAuthDialog() {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">استعادة عبر البريد الإلكتروني</span><h2>حساب النسخ السحابية</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><p class="dialog__subtext">أدخل بريد حساب النسخ السحابية لإرسال رابط استعادة كلمة المرور. هذه الاستعادة تخص النسخ السحابية فقط ولا تغيّر كلمة مرور الدخول المحلية. إذا نسيت كلمة المرور المحلية فاستخدم استرداد رقم الجوال أو اطلب مساعدة الأدمن.</p><form id="cloud-auth-form" class="form-grid"><label class="form-full">البريد الإلكتروني<input name="email" type="email" dir="ltr" autocomplete="email" required autofocus /></label><label class="form-full">كلمة مرور النسخ السحابية<input name="password" type="password" dir="ltr" autocomplete="current-password" minlength="6" required /></label><div class="cloud-backup-card__note form-full"><strong>تنبيه</strong><span>لا تحفظ كلمة المرور في حسابي. يحتفظ بها Firebase Authentication وفقًا لجلسة المتصفح فقط.</span></div><div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button type="button" class="text-button" data-action="cloud-reset-password">نسيت كلمة المرور؟</button><button class="button button--secondary" type="submit" data-cloud-auth-mode="signin">دخول</button><button class="button button--primary" type="submit" data-cloud-auth-mode="register">إنشاء وربط</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("[data-action=cloud-reset-password]")?.addEventListener("click", async () => { const email = overlay.querySelector("input[name=email]")?.value?.trim(); if (!email) { showToast("أدخل البريد أولًا ثم اضغط استعادة كلمة المرور.", "error"); return; } try { await resetCloudBackupPassword(email); showToast("أرسل Firebase رابط استعادة كلمة المرور إلى البريد."); } catch (error) { showToast(error.message || "تعذر إرسال رابط الاستعادة.", "error"); } });
  overlay.querySelector("#cloud-auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const submitter = event.submitter;
    const controls = [...event.currentTarget.querySelectorAll("button")]; controls.forEach((button) => { button.disabled = true; });
    try {
      state.cloud.user = submitter?.dataset.cloudAuthMode === "register" ? await registerCloudBackupUser(values.email, values.password) : await signInCloudBackupUser(values.email, values.password);
      if (isAdmin(state.currentUser)) { const storeId = state.settings?.cloudStoreId || `store_${randomId()}`; if (!state.settings?.cloudStoreId) { await db.saveSettings({ cloudStoreId: storeId }); state.settings = await db.getSettings(); } state.cloud.identity = await createStoreWorkspace({ storeId, storeName: storeDisplayName(), ownerAccount: state.currentUser }); try { await watchAssistantRequests(storeId, (requests) => { state.cloud.pairRequests = requests; if (state.view === "data-management") render(); }); } catch (error) { console.warn("[Hesabi pairing requests unavailable]", error); } }
      state.cloud.backups = []; state.cloud.error = ""; closeDialog(); render(); await refreshCloudBackups({ quiet: true }); showToast("تم ربط حساب النسخ السحابية.");
    } catch (error) { controls.forEach((button) => { button.disabled = false; }); showToast(error.message || "تعذر ربط حساب النسخ السحابية.", "error"); }
  });
}

async function uploadCurrentCloudBackup() {
  if (!window.confirm("سيُرفع وضع بيانات هذا الجهاز الحالي فقط إلى السحابة. لا توجد مزامنة لحظية. هل تريد إنشاء النسخة؟")) return;
  state.cloud.busy = "upload"; state.cloud.error = ""; render();
  try { const backup = await db.exportBackup(); await uploadCloudBackup(backup, { storeName: storeDisplayName() }); await refreshCloudBackups({ quiet: true }); showToast("اكتمل رفع النسخة السحابية بنجاح."); }
  catch (error) { state.cloud.error = error.message || "تعذر رفع النسخة السحابية."; showToast(state.cloud.error, "error"); }
  finally { state.cloud.busy = ""; if (state.view === "settings") render(); }
}

async function restoreCloudBackup(backupId) {
  if (!window.confirm("ستتحقق حسابي من النسخة ثم تستبدل بيانات هذا الجهاز. سيُنزل أولًا ملف JSON وقائيًا محليًا، وستعود إلى شاشة الدخول. هل تريد المتابعة؟")) return;
  state.cloud.busy = "restore"; state.cloud.error = ""; render();
  try {
    const safetyBackup = await db.exportBackup();
    downloadBackupPayload(safetyBackup, `before-cloud-restore-${dateKey()}`);
    const { payload } = await readCloudBackup(backupId);
    db.validateBackup(payload);
    const sessionBeforeRestore = state.currentUser;
    await db.restoreBackup(payload);
    state.settings = await db.getSettings(); state.accounts = await db.listAccounts();
    const restoredAccount = sessionBeforeRestore ? state.accounts.find((account) => account.id === sessionBeforeRestore.id && account.isActive !== false) : null;
    state.currentUser = restoredAccount ? await db.getPersistentSession() : null;
    if (restoredAccount && !state.currentUser) { await db.savePersistentSession(restoredAccount.id); state.currentUser = await db.getPersistentSession(); }
    state.cart = []; state.view = "sales"; await refresh(); render();
    showToast("اكتملت الاستعادة بعد تنزيل نسخة وقائية محلية.");
  } catch (error) { state.cloud.error = error.message || "تعذرت استعادة النسخة السحابية."; if (state.view === "settings") render(); showToast(state.cloud.error, "error"); }
  finally { state.cloud.busy = ""; }
}

async function removeCloudBackup(backupId) {
  if (!window.confirm("هل تريد حذف هذه النسخة السحابية نهائيًا؟ لن تتأثر بيانات هذا الجهاز.")) return;
  state.cloud.busy = "delete"; render();
  try { await deleteCloudBackup(backupId); await refreshCloudBackups({ quiet: true }); showToast("تم حذف النسخة السحابية."); }
  catch (error) { state.cloud.error = error.message || "تعذر حذف النسخة السحابية."; showToast(state.cloud.error, "error"); }
  finally { state.cloud.busy = ""; if (state.view === "settings") render(); }
}

async function disconnectCloudBackup() {
  if (!window.confirm("سيُفصل حساب النسخ من هذا الجهاز فقط، ولن تُحذف النسخ السحابية. هل تريد المتابعة؟")) return;
  try { await signOutCloudBackupUser(); state.cloud = { user: null, backups: [], loading: false, busy: "", error: "" }; render(); showToast("تم فصل حساب النسخ السحابية من هذا الجهاز."); }
  catch (error) { showToast(error.message || "تعذر فصل الحساب السحابي.", "error"); }
}

async function approvePairingRequestFromUi(requestId) {
  const request = state.cloud.pairRequests?.find((item) => item.id === requestId); if (!request || !state.settings?.cloudStoreId) return;
  const normalizeAccountName = (value) => String(value || "").normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ar");
  try {
    const requestedName = normalizeAccountName(request.accountName);
    const matches = state.accounts.filter((item) => item.isActive && item.id !== state.currentUser.id && normalizeAccountName(item.name) === requestedName);
    if (matches.length > 1) { showToast("يوجد أكثر من حساب بهذا الاسم؛ غيّر اسم الحسابات ثم أعد الطلب.", "error"); return; }
    const account = matches[0];
    if (!account) { showToast(`لم نجد حسابًا نشطًا باسم «${request.accountName || "غير محدد"}». اكتب اسم الكاشير كما يظهر في إدارة المستخدمين.`, "error"); return; }
    const pairing = await approveAssistantRequest({ storeId: state.settings.cloudStoreId, requestId, accountId: account.id, accountName: account.name, role: account.role });
    window.prompt("أرسل رمز الدخول هذا للمستخدم مرة واحدة فقط:", pairing.token); showToast("تم اعتماد الطلب وإنشاء رمز الدخول.");
  } catch (error) { showToast(error.message || "تعذر اعتماد طلب الجهاز.", "error"); }
}

function openPairingInviteDialog() {
  if (!isAdmin(state.currentUser)) return;
  const accounts = state.accounts.filter((account) => account.isActive && account.id !== state.currentUser.id);
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">ربط جهاز جديد</span><h2>إنشاء رمز اقتران لمرة واحدة</h2><p class="dialog__subtext">الرمز صالح لعشر دقائق ويُستخدم مرة واحدة فقط.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="pairing-invite-form" class="form-grid"><label class="form-full">حساب المستخدم<select name="accountId" required>${accounts.length ? accounts.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)} · ${roleLabel(account.role)}</option>`).join("") : `<option value="" disabled>أضف حسابًا من إدارة المستخدمين أولًا</option>`}</select></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit" ${accounts.length ? "" : "disabled"}>إنشاء الرمز</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#pairing-invite-form")?.addEventListener("submit", async (event) => { event.preventDefault(); const account = state.accounts.find((item) => item.id === new FormData(event.currentTarget).get("accountId")); if (!account) return; try { const storeId = state.settings?.cloudStoreId || `store_${randomId()}`; if (!state.settings?.cloudStoreId) { await db.saveSettings({ cloudStoreId: storeId }); state.settings = await db.getSettings(); } const identity = await createStoreWorkspace({ storeId, storeName: storeDisplayName(), ownerAccount: state.currentUser }); state.cloud.identity = identity; await seedWorkspaceBackup(await db.exportBackup()); const pairing = await createPairingInvite({ storeId, accountId: account.id, accountName: account.name, role: account.role }); state.cloud.pairing = pairing; closeDialog(); render(); window.prompt("أرسل هذا الرمز للمستخدم مرة واحدة فقط:", pairing.token); } catch (error) { showToast(error.message || "تعذر إنشاء رمز الاقتران.", "error"); } });
}

function openPairingRedeemDialog() {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">ربط هذا الجهاز</span><h2>إدخال رمز الاقتران</h2><p class="dialog__subtext">أدخل الرمز الذي أنشأه الأدمن. بعد نجاح الربط يبقى هذا الجهاز مرتبطًا بحسابك فقط.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="pairing-redeem-form" class="form-grid"><label class="form-full">رمز الاقتران<input name="token" dir="ltr" inputmode="text" autocomplete="one-time-code" placeholder="معرّف المتجر:123456" required autofocus /></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">ربط الجهاز</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#pairing-redeem-form")?.addEventListener("submit", async (event) => { event.preventDefault(); try { state.cloud.identity = await redeemPairingInvite(new FormData(event.currentTarget).get("token")); if (state.cloud.identity.bootstrapChanges?.length) { await db.applySyncChanges(state.cloud.identity.bootstrapChanges); state.settings = await db.getSettings(); state.accounts = await db.listAccounts(); await refresh(); } closeDialog(); showToast(`تم ربط الجهاز بحساب ${state.cloud.identity.accountName}.`); render(); } catch (error) { showToast(error.message || "تعذر ربط الجهاز.", "error"); } });
}

function reportDateInRange(value, from = "", to = "") { const key = dateKey(value); return (!from || key >= from) && (!to || key <= to); }
function reportCellNumber(value) {
  const text = String(value ?? "").trim();
  if (!text || /[/:]/.test(text)) return null;
  const normalized = text.replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
function isMoneyReportHeader(header) {
  return /مبلغ|القيمة|المبلغ|الرصيد|المستحق|التكلفة|المبيعات|المشتريات|المصروف|الربح|الإيراد|الأصول|الخصوم|الالتزامات|النقد|الصندوق|مدين|دائن|قيمة|إجمالي|صافي|سعر|تكلفة|دخل|دفع|تحصيل/.test(String(header || ""));
}
function isNonSummableReportHeader(header) {
  const text = String(header || "").trim();
  return /باركود|تاريخ|وقت|الهاتف|جوال|رقم\s*(?:الفاتورة|المستند|المرجع|الحساب|العميل|المورد)|الفاتورة\s*رقم|المعرف|معرف|كود|رمز|تسلسل|سيريال|سنة|شهر|نسبة|الكمية\s*المباعة|عدد\s*الفواتير/.test(text);
}
function reportTotalValue(header, value) {
  if (isNonSummableReportHeader(header)) return null;
  return reportCellNumber(value);
}
function ensureReportTotal(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  const last = rows[rows.length - 1] || [];
  if (String(last[0] ?? "").trim() === "الإجمالي") return rows;
  const headers = rows[0] || [];
  const totals = Array(Math.max(0, headers.length - 1)).fill(0);
  const found = Array(totals.length).fill(false);
  rows.slice(1).forEach((row) => {
    const label = row.map((value) => String(value ?? "")).join(" ");
    if (/^\s*الإجمالي\s*$|المجموع|الرصيد الختامي|حقوق الملكية/.test(label)) return;
    row.slice(1).forEach((value, index) => {
      const header = headers[index + 1];
      const number = reportTotalValue(header, value);
      if (number !== null) { totals[index] += number; found[index] = true; }
    });
  });
  return [...rows, ["الإجمالي", ...totals.map((value, index) => found[index] ? (isMoneyReportHeader(headers[index + 1]) ? money(value) : amount(value)) : "")]];
}
function financialReportRows(type = "summary") { return ensureReportTotal(financialReportRowsRaw(type)); }
function financialReportRowsRaw(type = "summary") {
  const apkRows = getApkReportRows(type, state, { amount, money, dateTime, stockStatus });
  if (apkRows) return apkRows;
  const data = state.analytics || { sales: {}, purchases: {}, expenses: {}, profit: {} };
  const cash = state.cashbox || {};
  const receivables = state.customers.reduce((sum, item) => sum + toNumber(item.balance), 0);
  const payables = state.suppliers.reduce((sum, item) => sum + toNumber(item.balance), 0);
  const inventory = toNumber(state.dashboard?.inventoryValue);
  const cashBalance = toNumber(cash.closingBalance);
  const assets = cashBalance + receivables + inventory;
  const equity = assets - payables;
  const header = [["البند", "القيمة"], ["من", reportRange().from], ["إلى", reportRange().to]];
  if (type === "cash") {
    const movements = (state.cashMovements || []).filter((item) => reportDateInRange(item.date, state.reportFrom || "", state.reportTo || ""));
    const rows = movements.map((item) => [dateTime(item.date), `${item.type === "inflow" ? "وارد" : "صادر"} · ${item.notes || "حركة صندوق"}`, money(item.amount)]);
    const totals = movements.reduce((out, item) => { out[item.type === "inflow" ? 0 : 1] += toNumber(item.amount); return out; }, [0, 0]);
    return [["التاريخ", "البيان", "المبلغ"], ...rows, ["", "إجمالي الوارد", money(totals[0])], ["", "إجمالي الصادر", money(totals[1])], ["", "الرصيد الختامي", money(cashBalance)]];
  }
  if (type === "income") return [...header, ["صافي المبيعات", money(data.profit.netSales)], ["تكلفة البضاعة المباعة", money(data.profit.netCostOfGoods)], ["مجمل الربح", money(data.profit.grossProfit)], ["المصروفات التشغيلية", money(data.expenses.total)], ["صافي الربح", money(data.profit.netProfit)]];
  if (type === "balance") return [...header, ["النقد والصندوق", money(cashBalance)], ["الذمم المدينة", money(receivables)], ["المخزون بالتكلفة", money(inventory)], ["إجمالي الأصول", money(assets)], ["الذمم الدائنة", money(payables)], ["حقوق الملكية / صافي المركز", money(equity)]];
  if (type === "trial") return [["الحساب", "مدين", "دائن"], ["الصندوق والنقدية", money(cashBalance), ""], ["الذمم المدينة", money(receivables), ""], ["المخزون", money(inventory), ""], ["المصروفات", money(data.expenses.total), ""], ["الذمم الدائنة", "", money(payables)], ["المبيعات وصافي الإيرادات", "", money(data.profit.netSales)], ["حقوق الملكية / رصيد الموازنة", "", money(cashBalance + receivables + inventory + data.expenses.total - payables - data.profit.netSales)], ["الإجمالي", money(cashBalance + receivables + inventory + data.expenses.total), money(cashBalance + receivables + inventory + data.expenses.total)]];
  if (type === "customers") return [["العميل", "الهاتف", "الرصيد المستحق"], ...state.customers.filter((item) => toNumber(item.balance) !== 0).map((item) => [item.name, item.phone || "—", money(item.balance)]), ["الإجمالي", "", money(receivables)]];
  if (type === "suppliers") return [["المورد", "الهاتف", "المستحق"], ...state.suppliers.filter((item) => toNumber(item.balance) !== 0).map((item) => [item.name, item.phone || "—", money(item.balance)]), ["الإجمالي", "", money(payables)]];
  if (type === "expenses") return [["نوع المصروف", "عدد العمليات", "الإجمالي"], ...Object.entries(data.expenses.byCategory || {}).map(([category, total]) => [category, amount(data.expenses.items?.filter((item) => item.category === category).length || 0), money(total)]), ["الإجمالي", amount(data.expenses.items?.length || 0), money(data.expenses.total || 0)]];
  if (type === "inventory") return [["المنتج", "الكمية", "قيمة التكلفة"], ...state.products.filter((item) => !item.isDeleted).map((item) => [item.name, `${amount(item.quantity)} ${item.unit || ""}`.trim(), money(toNumber(item.quantity) * toNumber(item.purchasePrice))]), ["الإجمالي", `${amount(state.products.reduce((sum, item) => sum + toNumber(item.quantity), 0))} وحدة`, money(inventory)]];
  return reportExportRows();
}
function reportExportRows() { const data = state.analytics || { sales: {}, purchases: {}, expenses: {}, profit: {} }; return [["البند", "القيمة"], ["من", reportRange().from], ["إلى", reportRange().to], ["إجمالي المبيعات", money(data.sales.total || 0)], ["مرتجع البيع", money(data.sales.returns || 0)], ["صافي المبيعات", money(data.profit.netSales || 0)], ["تكلفة البضاعة", money(data.profit.netCostOfGoods || 0)], ["إجمالي المشتريات", money(data.purchases.total || 0)], ["مرتجع الشراء", money(data.purchases.returns || 0)], ["إجمالي المصروفات", money(data.expenses.total || 0)], ["صافي الربح", money(data.profit.netProfit || 0)], ["ديون العملاء الحالية", money(state.customers.reduce((sum, customer) => sum + toNumber(customer.balance), 0))], ["مستحقات الموردين الحالية", money(state.suppliers.reduce((sum, supplier) => sum + toNumber(supplier.balance), 0))]]; }
function reportExportHtml() { const rows = reportExportRows(); const headers = rows[0] || []; const cell = (value, header = false) => `<${header ? "th" : "td"}>${escapeHtml(value ?? "")}</${header ? "th" : "td"}>`; return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#172e27;background:#fff;direction:rtl;margin:0;font-size:18px}header{border:2px solid #172e27;padding:20px 24px;margin-bottom:22px;text-align:center}h1{margin:0 0 10px;font-size:30px;color:#174c3f}p{margin:0;color:#52645b;font-size:18px}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:18px;direction:rtl}th,td{padding:12px 10px;border:1.5px solid #26332e;text-align:center;vertical-align:middle;overflow-wrap:anywhere;word-break:normal;line-height:1.45}th{background:#dfe4e1;color:#172e27;font-size:19px;font-weight:800}td:first-child,th:first-child{text-align:right;width:42%}td:not(:first-child),th:not(:first-child){width:29%}tr:nth-child(even){background:#f7f8f7}.negative{color:#a74340;font-weight:800}.total td{font-weight:800;background:#e7f1eb;border-top:2px solid #174c3f}</style></head><body><header><h1>${escapeHtml(storeDisplayName())}</h1><p>التقرير التشغيلي العام — من ${escapeHtml(reportRange().from)} إلى ${escapeHtml(reportRange().to)}</p><p>تاريخ ووقت الإنشاء: ${escapeHtml(dateTime(new Date()))}</p></header><table><thead><tr>${headers.map((value) => cell(value, true)).join("")}</tr></thead><tbody>${rows.slice(1).map((row) => `<tr class="${row.some((value) => String(value).startsWith("-") || String(value).startsWith("−")) ? "negative" : ""}">${row.map((value) => cell(value)).join("")}</tr>`).join("")}</tbody></table></body></html>`; }
function downloadGeneratedFile(file) { const url = URL.createObjectURL(file); const anchor = Object.assign(document.createElement("a"), { href: url, download: file.name }); document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }
function downloadReportCsv() { try { const rows = [["التقرير التشغيلي العام"], [`من ${reportRange().from} إلى ${reportRange().to}`], [`تاريخ ووقت الإنشاء: ${dateTime(new Date())}`], ...reportExportRows()]; const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`; downloadGeneratedFile(new File([`\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`], `hesabi-report-${dateKey()}.csv`, { type: "text/csv;charset=utf-8" })); showToast("تم تصدير تقرير CSV"); } catch (error) { showToast(error.message || "تعذر تصدير التقرير.", "error"); } }
function downloadReportXlsx(type = "summary") { try { const content = createReportWorkbook(financialReportRows(type), { storeName: storeDisplayName(), reportTitle: reportTitle(type), from: reportRange().from, to: reportRange().to, generatedAt: dateTime(new Date()) }); downloadGeneratedFile(new File([content], `hesabi-${type}-report-${dateKey()}.xlsx`, { type: reportWorkbookMimeType() })); showToast("تم تصدير تقرير Excel"); } catch (error) { showToast(error.message || "تعذر إنشاء تقرير Excel.", "error"); } }
const reportTitle = (type = "summary") => ({ cash: "تقرير تحليلي شامل لحركة الصندوق", income: "قائمة الدخل", balance: "المركز المالي", trial: "ميزان المراجعة", customers: "تقرير ديون العملاء", suppliers: "تقرير مستحقات الموردين", expenses: "تقرير المصروفات حسب النوع", inventory: "تقرير المخزون والتكلفة", itemBalance: "أرصدة المخزون", itemMovement: "حركة الأصناف", revenueItem: "المبيعات حسب الصنف", revenueCustomer: "المبيعات حسب العميل", dailyDocuments: "الوثائق اليومية", dailyTransactions: "العمليات اليومية", moneyBalance: "حركة الصندوق", accountsTotal: "إجمالي الحسابات", accountBalance: "أرصدة الحسابات", currency: "حركة العملات والتحويلات", summary: "التقرير التشغيلي العام" }[type] || "التقرير المالي");
function reportPreviewHtml(type = "summary") {
  const rows = financialReportRows(type);
  const title = reportTitle(type);
  const range = reportRange();
  // font-family:"HesabiArabicPdf","Noto Naskh Arabic",Tahoma,Arial,sans-serif
  // grid-template-columns:minmax(0,1fr) 74px; unicode-bidi:plaintext; overflow-wrap:anywhere;
  return renderOfficialReportHtml({
    title,
    rows,
    storeName: storeDisplayName(),
    storeInfo: state.settings,
    logoDataUrl: storeLogoDataUrl(),
    from: range.from,
    to: range.to,
    generatedAt: dateTime(new Date()),
    cashierName: state.currentUser?.name || "الأدمن",
  });
}
async function downloadReportPdf(type = "summary") { try { const file = await createPdfFileFromHtml({ html: reportPreviewHtml(type), filename: `hesabi-${type}-report-${dateKey()}.pdf`, page: "a4" }); downloadGeneratedFile(file); showToast("تم تصدير التقرير PDF"); } catch (error) { showToast(error.message || "تعذر إنشاء تقرير PDF.", "error"); } }
async function shareReportPdf(type = "summary") { return shareOrDownloadPdf({ html: reportPreviewHtml(type), filename: `hesabi-${type}-report-${dateKey()}.pdf`, title: reportTitle(type), page: "a4" }); }
function openReportPreview(type = "summary") {
  const html = reportPreviewHtml(type);
  const sourceDocument = new DOMParser().parseFromString(html, "text/html");
  const rows = financialReportRows(type);
  const previewWide = (rows[0] || []).length > 6;
  const previewWideClass = previewWide ? " report-preview--wide" : "";
  const previewHint = previewWide ? '<p class="report-preview__hint">اسحب أفقيًا لعرض جميع الأعمدة.</p>' : "";
  const previewStyles = [...(sourceDocument.head?.querySelectorAll("style") || [])].map((style) => style.outerHTML).join("");
  const previewContent = sourceDocument.body?.innerHTML || "";
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">معاينة التقرير</span><h2>${escapeHtml(reportTitle(type))}</h2><p class="dialog__subtext">راجع البيانات قبل المشاركة أو الطباعة.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="report-preview-scroll"><label class="report-wrap-toggle"><input type="checkbox" data-preview-wrap><span>التفاف النص داخل الخانات</span></label><section class="report-preview report-preview--no-wrap${previewWideClass}" aria-label="معاينة التقرير">${previewStyles}${previewHint}${previewContent}</section><div class="dialog__actions report-preview-actions"><button class="button button--primary" data-preview-share>مشاركة PDF</button><button class="button button--secondary" data-preview-print>طباعة</button><button class="button button--secondary" data-preview-download>تنزيل PDF</button><button class="button button--secondary" data-preview-excel>تنزيل Excel</button><button class="button button--secondary" data-dialog-close>إغلاق</button></div></div></div>`);
  overlay.classList.add("dialog-backdrop--report-preview");
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("[data-preview-wrap]")?.addEventListener("change", (event) => { overlay.querySelector(".report-preview")?.classList.toggle("report-preview--no-wrap", !event.currentTarget.checked); });
  overlay.querySelector("[data-preview-share]").addEventListener("click", async () => { try { const result = await shareReportPdf(type); showToast(result === "shared" ? "تمت مشاركة التقرير PDF" : "تم تنزيل التقرير PDF"); } catch (error) { if (error?.name !== "AbortError") showToast(error.message || "تعذر مشاركة التقرير.", "error"); } });
  overlay.querySelector("[data-preview-download]").addEventListener("click", () => void downloadReportPdf(type));
  overlay.querySelector("[data-preview-excel]").addEventListener("click", () => downloadReportXlsx(type));
  overlay.querySelector("[data-preview-print]").addEventListener("click", () => { printHtmlDocument({ html, target: `hesabi-${type}-report` }); showToast("تم إرسال التقرير للطباعة"); });
}

function downloadReportDoc() { try { downloadGeneratedFile(new File([`\uFEFF${reportExportHtml()}`], `hesabi-report-${dateKey()}.doc`, { type: "application/msword" })); showToast("تم تصدير تقرير DOC"); } catch (error) { showToast(error.message || "تعذر إنشاء تقرير DOC.", "error"); } }
function openReportExportDialog() { const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">التقارير المالية</span><h2>اختر التقرير المطلوب</h2><p class="dialog__subtext">تُنشأ التقارير من بيانات المتجر ونطاق التاريخ الحالي.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="report-export-options"><button class="button button--primary" data-financial-report="cash">تقرير تحليلي شامل لحركة الصندوق</button><button class="button button--secondary" data-financial-report="income">قائمة الدخل</button><button class="button button--secondary" data-financial-report="balance">المركز المالي</button><button class="button button--secondary" data-financial-report="trial">ميزان المراجعة</button><button class="button button--secondary" data-financial-report="customers">ديون العملاء</button><button class="button button--secondary" data-financial-report="suppliers">تقرير الموردين</button><button class="button button--secondary" data-financial-report="expenses">تقرير المصروفات</button><button class="button button--secondary" data-financial-report="inventory">تقرير المخزون</button>${APK_REPORT_TYPES.map(([type, label]) => `<button class="button button--secondary" data-financial-report="${type}">${label}</button>`).join("")}<button class="button button--secondary" data-report-export="pdf">التقرير التشغيلي العام PDF</button><button class="button button--secondary" data-report-export="xlsx">Excel منظم للجداول</button><button class="button button--secondary" data-report-export="csv">CSV للجداول</button></div></div>`); overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog)); overlay.querySelectorAll("[data-financial-report]").forEach((button) => button.addEventListener("click", async () => { openReportPreview(button.dataset.financialReport); })); overlay.querySelectorAll("[data-report-export]").forEach((button) => button.addEventListener("click", async () => { if (button.dataset.reportExport === "csv") { downloadReportCsv(); closeDialog(); } else if (button.dataset.reportExport === "xlsx") { downloadReportXlsx(); closeDialog(); } else openReportPreview(); })); }

async function restoreBackupFromFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    let parsed;
    try { parsed = JSON.parse(await file.text()); }
    catch { throw new Error("ملف النسخة ليس ملف JSON صالحًا. اختر نسخة حسابي بصيغة JSON."); }
    db.validateBackup(parsed);
    if (!window.confirm("ستستبدل الاستعادة كل بيانات هذا الجهاز بالنسخة المختارة، ثم تفتح صفحة تسجيل الدخول. هل تريد المتابعة؟")) return;
    const safetyBackup = await db.exportBackup();
    downloadBackupPayload(safetyBackup, `before-local-restore-${dateKey()}`);
    await db.restoreBackup(parsed);
    try { await db.clearPersistentSession(); } catch (error) { console.warn("[Hesabi restore session cleanup]", error); }
    state.settings = await db.getSettings();
    state.accounts = await db.listAccounts();
    state.currentUser = null;
    state.activeCashierShift = null;
    state.cart = [];
    state.cartDiscount = "";
    state.showSetupHome = false;
    state.view = "sales";
    render();
    showToast("تمت استعادة البيانات. أدخل اسم المستخدم ورمز الدخول للمتجر.");
  } catch (error) {
    console.error("[Hesabi local restore error]", error);
    showToast(error.message || "تعذرت استعادة ملف النسخة الاحتياطية.", "error");
  } finally { input.value = ""; }
}
async function resetAllData() { if (!window.confirm("سيُمسح كل السجل المحلي على هذا الجهاز. صدّر نسخة احتياطية أولًا. هل تريد المتابعة؟")) return; if (!window.confirm("تأكيد نهائي: لا يمكن التراجع من داخل التطبيق. هل تمضي في المسح؟")) return; try { await db.resetAllData(); state.settings = null; state.cart = []; state.cartDiscount = ""; state.heldInvoices = []; saveHeldInvoicesToStorage(state.heldInvoices); state.view = "dashboard"; await refresh(); render(); showToast("مُسحت البيانات المحلية. يمكنك بدء سجل متجر جديد."); } catch (error) { showToast(error.message, "error"); } }

async function toggleTheme() {
  try {
    const order = ["system", "light", "dark"];
    const theme = order[(order.indexOf(themePreference()) + 1) % order.length];
    await db.saveSettings({ ...state.settings, theme });
    state.settings = await db.getSettings();
    applyTheme();
    render();
    showToast(theme === "system"
      ? `يتبع ضبط الجهاز الآن (${systemPrefersDark() ? "داكن" : "فاتح"})`
      : theme === "dark" ? "تم تفعيل الوضع الداكن" : "تم تفعيل الوضع الفاتح");
  } catch (error) { showToast(error.message, "error"); }
}

async function deleteAllProducts() { const count = state.products.length; if (!count) { showToast("لا توجد منتجات لحذفها."); return; } if (!window.confirm(`تنبيه: سيتم حذف ${count} منتجًا من قوائم المنتجات والمخزون. ستبقى الفواتير والسجلات المالية محفوظة. هل تريد المتابعة؟`)) return; if (!window.confirm("تأكيد نهائي: سيتم إخفاء جميع المنتجات الحالية من القوائم لتتمكن من استيراد قائمة جديدة. هل تؤكد الحذف؟")) return; try { const deleted = await db.softDeleteAllProducts(); state.cart = []; await refresh(); render(); showToast(`تم حذف ${deleted} منتجًا من القوائم مع الحفاظ على السجلات.`); } catch (error) { showToast(error.message || "تعذر حذف المنتجات.", "error"); } }

function openHoldInvoiceDialog() {
  if (!state.cart.length) {
    showToast("السلة فارغة حاليًا.", "error");
    return;
  }
  const totals = calculateSaleTotals(state.cart, state.cartDiscount);
  const defaultName = `زبون #${(state.heldInvoices?.length || 0) + 1}`;
  const overlay = openDialog(`
    <div class="stitch-dialog"><div class="dialog__head">
      <div>
        <span class="eyebrow">تعليق الفاتورة</span>
        <h2>تعليق سلة البيع الحالية</h2>
        <p class="dialog__subtext">سيتم حفظ أصناف السلة (${state.cart.length} أصناف · ${money(totals.total)}) مؤقتًا لخدمة الزبون التالي.</p>
      </div>
      <button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button>
    </div>
    <form id="hold-invoice-form" class="form-grid">
      <label class="form-full">
        اسم الزبون أو علامة تمييز (اختياري)
        <input name="note" dir="rtl" maxlength="50" placeholder="مثال: زبون القميص الأزرق / طاولة 3" value="${defaultName}" autofocus />
      </label>
      <div class="dialog__actions form-full">
        <button type="button" class="button button--secondary" data-dialog-close>إلغاء</button>
        <button type="submit" class="button button--primary">${msymbol("pause", "text-[19px]")} تأكيد التعليق</button>
      </div>
    </form>
    </div>
  `);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#hold-invoice-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") || "").trim() || defaultName;
    try {
      const held = {
        id: `held-${randomId()}`,
        note,
        cart: JSON.parse(JSON.stringify(state.cart)),
        cartDiscount: state.cartDiscount || "",
        total: totals.total,
        itemsCount: state.cart.length,
        heldAt: nowIso(),
        heldByName: state.currentUser?.name || "الكاشير",
      };
      state.heldInvoices = [held, ...(Array.isArray(state.heldInvoices) ? state.heldInvoices : [])];
      const persisted = saveHeldInvoicesToStorage(state.heldInvoices);
      state.cart = [];
      state.cartDiscount = "";
      closeDialog();
      render();
      showToast(persisted
        ? `تم تعليق فاتورة «${note}». يمكنك خدمة الزبون التالي.`
        : `تم تعليق فاتورة «${note}» في هذه الجلسة فقط؛ تعذر حفظها في تخزين الجهاز.`, persisted ? "success" : "error");
    } catch (error) {
      console.error("[Hesabi hold invoice error]", error);
      showToast(error?.message || "تعذر تعليق الفاتورة. لم تتغير السلة، حاول مرة أخرى.", "error");
    }
  });
}

function heldInvoicesList() {
  const list = Array.isArray(state.heldInvoices) ? state.heldInvoices : [];
  state.heldInvoices = list;
  return list;
}

function openHeldInvoicesDialog() {
  const list = heldInvoicesList();
  const overlay = openDialog(`
    <div class="stitch-dialog"><div class="dialog__head">
      <div>
        <span class="eyebrow">الفواتير المعلقة</span>
        <h2>قائمة الفواتير المعلقة (${list.length})</h2>
        <p class="dialog__subtext">اختر الفاتورة المراد استئنافها في السلة وإتمام البيع.</p>
      </div>
      <button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button>
    </div>
    <section class="held-invoices-list">
      ${list.length ? list.map((held) => {
        const itemsSummary = (held.cart || []).map((item) => `${escapeHtml(item.name)} × ${amount(item.quantity)}`).join("، ");
        return `
          <article class="held-invoice-card">
            <div class="held-invoice-card__head">
              <div class="held-invoice-card__title">
                <div class="held-icon">${msymbol("schedule", "text-[19px]")}</div>
                <div>
                  <strong>${escapeHtml(held.note || "فاتورة معلقة")}</strong>
                  <small>${formatTimeAgo(held.heldAt)} · ${dateTime(held.heldAt)} · ${escapeHtml(held.heldByName || "")}</small>
                </div>
              </div>
              <strong class="held-invoice-card__total">${money(held.total)}</strong>
            </div>
            <p class="held-invoice-card__summary">${itemsSummary}</p>
            <div class="held-invoice-card__actions">
              <button class="button button--secondary button--compact text-danger" data-delete-held="${held.id}">
                ${msymbol("delete", "text-[17px]")} حذف
              </button>
              <button class="button button--primary button--compact" data-resume-held="${held.id}">
                ${msymbol("shopping_cart", "text-[17px]")} استعادة إلى السلة
              </button>
            </div>
          </article>
        `;
      }).join("") : `<div class="inline-empty">لا توجد فواتير معلقة حالياً.</div>`}
    </section>
    <div class="dialog__actions">
      <button type="button" class="button button--secondary" data-dialog-close>إغلاق</button>
    </div>
    </div>
  `);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));

  overlay.querySelectorAll("[data-resume-held]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const heldId = btn.dataset.resumeHeld;
      const held = heldInvoicesList().find((h) => h.id === heldId);
      if (!held) return;
      if (state.cart.length > 0) {
        if (!window.confirm("توجد أصناف حالية في السلة. هل تريد استبدالها بالفاتورة المعلقة؟ (يمكنك تعليق السلة الحالية أولاً)")) {
          return;
        }
      }
      try {
        state.cart = JSON.parse(JSON.stringify(Array.isArray(held.cart) ? held.cart : []));
        state.cartDiscount = held.cartDiscount || "";
        state.heldInvoices = heldInvoicesList().filter((h) => h.id !== heldId);
        saveHeldInvoicesToStorage(state.heldInvoices);
        closeDialog();
        render();
        showToast(`تمت استعادة فاتورة «${held.note || "معلقة"}» إلى السلة.`);
      } catch (error) {
        console.error("[Hesabi resume held invoice error]", error);
        showToast(error?.message || "تعذرت استعادة الفاتورة المعلقة إلى السلة.", "error");
      }
    });
  });

  overlay.querySelectorAll("[data-delete-held]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const heldId = btn.dataset.deleteHeld;
      const held = heldInvoicesList().find((h) => h.id === heldId);
      if (!held) return;
      if (!window.confirm(`هل أنت متأكد من حذف الفاتورة المعلقة «${held.note}»؟`)) return;
      try {
        state.heldInvoices = heldInvoicesList().filter((h) => h.id !== heldId);
        saveHeldInvoicesToStorage(state.heldInvoices);
        closeDialog();
        openHeldInvoicesDialog();
        showToast("تم حذف الفاتورة المعلقة.");
      } catch (error) {
        console.error("[Hesabi delete held invoice error]", error);
        showToast(error?.message || "تعذر حذف الفاتورة المعلقة.", "error");
      }
    });
  });
}

function openCheckoutDialog(presetMethod = "") {
  if (state.currentUser?.role === "cashier" && !state.activeCashierShift) { showToast("سجل المبلغ المستلم من الصندوق قبل إتمام أول عملية بيع.", "error"); openCashierShiftStartDialog(); return; }
  const initial = calculateSaleTotals(state.cart); const isCashierSale = state.currentUser?.role === "cashier";
  const paymentMethodToggle = `<fieldset class="payment-method-toggle form-full"><legend>طريقة التحصيل</legend><input type="hidden" name="paymentMethod" value="نقدي" /><button class="payment-method-toggle__button is-selected is-cash" type="button" data-sale-payment-method="نقدي">${msymbol("payments", "text-[19px]")}<span>كاش</span></button><button class="payment-method-toggle__button is-transfer" type="button" data-sale-payment-method="تحويل">${msymbol("account_balance", "text-[19px]")}<span>تحويل</span></button></fieldset>`;
  const cashCalcMarkup = `
    <div class="cash-calculator-section form-full" id="cash-calculator-section">
      <div class="cash-calc-head">
        <span>${msymbol("calculate", "text-[18px]")} حاسبة النقدية السريعة</span>
        <small>أدخل الواصل لحساب الصرف/الفكة بدقة</small>
      </div>
      <div class="cash-calc-body">
        <div class="cash-calc-inputs">
          <label class="cash-tendered-label">
            <span>المبلغ المستلم من الزبون (الواصل)</span>
            <input id="cash-tendered" type="number" inputmode="decimal" min="0" step="0.01" value="${initial.total}" placeholder="أدخل الواصل" />
          </label>
        </div>
        <div class="quick-cash-buttons" id="quick-cash-buttons"></div>
        <div class="cash-change-result" id="cash-change-result">
          <div class="cash-change-card cash-change-card--exact">
            <span>المتبقي للزبون (الفكة):</span>
            <strong id="cash-change-text">${money(0)} (بالضبط)</strong>
          </div>
        </div>
      </div>
    </div>
  `;
  const overlay = openDialog(`<div class="stitch-checkout"><div class="dialog__head"><div><span class="eyebrow">تثبيت الفاتورة</span><h2>مراجعة البيع</h2><p class="dialog__subtext">${initial.lines.length} أصناف · ${amount(initial.lines.reduce((sum, line) => sum + toNumber(line.quantity), 0))} قطعة</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="co-hero"><span>الإجمالي النهائي للتحصيل</span><strong id="checkout-total">${money(initial.total)}</strong></div><div class="checkout-lines stitch-lines">${initial.lines.map((line) => `<div><span>${escapeHtml(line.name)} × ${amount(line.quantity)}</span><strong>${money(line.total)}</strong></div>`).join("")}</div><form id="checkout-form" class="form-grid stitch-form"><label class="stitch-field">الخصم العام<input name="discount" type="text" inputmode="decimal" placeholder="0 أو 20%" value="" autocomplete="off" /><small class="field-hint">أدخل مبلغًا مثل 100 أو نسبة مثل 20%</small></label><div class="delivery-charge-type delivery-compact form-full stitch-delivery"><label class="delivery-compact__amount">خدمة التوصيل<input name="deliveryFee" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" /></label><div class="delivery-compact__choices" role="radiogroup" aria-label="خدمة التوصيل على"><label class="delivery-choice delivery-choice--store"><input name="deliveryChargeType" type="radio" value="store" checked /> <span>على المحل</span></label><label class="delivery-choice delivery-choice--customer"><input name="deliveryChargeType" type="radio" value="customer" /> <span>على العميل</span></label></div></div>${paymentMethodToggle}<fieldset class="payment-type form-full stitch-paytype"><legend>نوع الدفع</legend><label><input name="paymentType" type="radio" value="نقدي" checked />${msymbol("payments", "text-[18px]")}<span>نقدي</span></label><label><input name="paymentType" type="radio" value="آجل" />${msymbol("schedule", "text-[18px]")}<span>آجل</span></label></fieldset><label id="credit-customer-field" class="form-full stitch-field" hidden>العميل<select name="customerId"><option value="">اختر العميل</option>${state.customers.map((customer) => `<option value="${customer.id}">${escapeHtml(customer.name)}${toNumber(customer.balance) ? ` — رصيد ${money(customer.balance)}` : ""}</option>`).join("")}</select></label><div id="credit-due-date-field" class="form-full stitch-field" hidden><label>تاريخ استحقاق السداد (أجل اختياري)<input id="credit-due-date-input" name="dueDate" type="date" min="${dateKey()}" value="" /><small class="field-hint">حدد أجل السداد لتتبع الديون المتأخرة وإرسال التذكيرات.</small></label><div class="due-preset-chips"><button type="button" class="due-chip" data-due-days="7">+ 7 أيام</button><button type="button" class="due-chip" data-due-days="15">+ 15 يومًا</button><button type="button" class="due-chip" data-due-days="30">+ 30 يومًا</button></div></div>${cashCalcMarkup}<label class="form-full stitch-field">المبلغ المدفوع<input id="paid-amount" name="paidAmount" type="number" inputmode="decimal" min="0" max="${initial.total}" step="0.01" value="${initial.total}" required /></label><div class="credit-summary form-full stitch-credit" id="credit-summary" hidden><span>المبلغ المتبقي</span><strong id="remaining-amount">${money(0)}</strong><small id="payment-status">مدفوعة</small></div><div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>رجوع</button><button type="submit" class="button button--primary checkout-submit">تأكيد البيع ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  const form = overlay.querySelector("#checkout-form");
  const paidInput = overlay.querySelector("#paid-amount");
  const creditField = overlay.querySelector("#credit-customer-field");
  const dueDateField = overlay.querySelector("#credit-due-date-field");
  const creditSummary = overlay.querySelector("#credit-summary");
  const submitButton = form.querySelector(".checkout-submit");
  const cashCalcSection = overlay.querySelector("#cash-calculator-section");
  const cashTenderedInput = overlay.querySelector("#cash-tendered");
  const quickCashButtonsContainer = overlay.querySelector("#quick-cash-buttons");
  const cashChangeCard = overlay.querySelector(".cash-change-card");

  let lastKnownTotal = initial.total;

  overlay.querySelectorAll("[data-due-days]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const days = parseInt(btn.dataset.dueDays, 10);
      const targetDate = new Date(Date.now() + days * 86400000);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
      const dd = String(targetDate.getDate()).padStart(2, "0");
      const dueInput = overlay.querySelector("#credit-due-date-input");
      if (dueInput) dueInput.value = `${yyyy}-${mm}-${dd}`;
    });
  });

  const cashierLimitNote = document.createElement("p");
  cashierLimitNote.id = "cashier-discount-limit";
  cashierLimitNote.className = "scanner-session-note form-full";
  cashierLimitNote.hidden = !isCashierSale;
  form.discount.closest("label").insertAdjacentElement("afterend", cashierLimitNote);

  const setPaymentMethod = (method) => {
    form.paymentMethod.value = method;
    overlay.querySelectorAll("[data-sale-payment-method]").forEach((button) => button.classList.toggle("is-selected", button.dataset.salePaymentMethod === method));
  };
  overlay.querySelectorAll("[data-sale-payment-method]").forEach((button) => button.addEventListener("click", () => setPaymentMethod(button.dataset.salePaymentMethod)));
  if (presetMethod === "نقدي" || presetMethod === "تحويل") setPaymentMethod(presetMethod);

  const totalsForForm = () => {
    const totals = calculateSaleTotals(state.cart, form.discount.value);
    const delivery = form.deliveryChargeType.value === "customer" ? Math.max(0, toNumber(form.deliveryFee.value)) : 0;
    return { ...totals, total: roundMoney(totals.total + delivery) };
  };

  const renderQuickCashButtons = (total) => {
    if (!quickCashButtonsContainer) return;
    const options = generateQuickCashOptions(total);
    quickCashButtonsContainer.innerHTML = options.map((opt) => {
      const isExact = opt === total;
      return `<button type="button" class="quick-cash-btn ${isExact ? "is-exact" : ""}" data-quick-cash="${opt}">${isExact ? "بالضبط" : money(opt)}</button>`;
    }).join("");
    quickCashButtonsContainer.querySelectorAll("[data-quick-cash]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = toNumber(btn.dataset.quickCash);
        cashTenderedInput.value = val;
        syncChange();
      });
    });
  };

  const syncChange = () => {
    const totals = totalsForForm();
    const isCredit = form.paymentType.value === "آجل";
    if (cashCalcSection) {
      cashCalcSection.hidden = isCredit;
    }
    if (isCredit) return;
    const tendered = toNumber(cashTenderedInput.value);
    const diff = roundMoney(tendered - totals.total);
    if (diff === 0) {
      cashChangeCard.className = "cash-change-card cash-change-card--exact";
      cashChangeCard.innerHTML = `<span>المتبقي للزبون (الفكة):</span><strong>${money(0)} (بالضبط)</strong>`;
    } else if (diff > 0) {
      cashChangeCard.className = "cash-change-card cash-change-card--change";
      cashChangeCard.innerHTML = `<span>المتبقي للزبون (الفكة):</span><strong>${money(diff)}</strong>`;
    } else {
      cashChangeCard.className = "cash-change-card cash-change-card--short";
      cashChangeCard.innerHTML = `<span>${icon("alert", 15)} المتبقي على الزبون (ناقص):</span><strong>${money(Math.abs(diff))}</strong>`;
    }
  };

  cashTenderedInput?.addEventListener("input", syncChange);

  const syncCheckout = () => {
    state.cartDiscount = form.discount.value;
    const totals = totalsForForm();
    const isCredit = form.paymentType.value === "آجل";
    const deliveryForCustomer = form.deliveryChargeType.value === "customer" && Math.max(0, toNumber(form.deliveryFee.value)) > 0;
    const cashierLimitPercent = normalizeCashierDiscountLimit(state.settings?.cashierDiscountLimitPercent, 10);
    const cashierLimit = roundMoney(totals.subtotal * cashierLimitPercent / 100);
    const exceedsCashierLimit = isCashierSale && totals.discount > cashierLimit;
    paidInput.max = totals.total;
    paidInput.disabled = isCredit;
    paidInput.value = isCredit ? 0 : totals.total;
    const remaining = Math.max(0, totals.total - toNumber(paidInput.value));
    overlay.querySelector("#checkout-total").textContent = money(totals.total);
    overlay.querySelector("#remaining-amount").textContent = money(remaining);
    overlay.querySelector("#payment-status").textContent = isCredit ? "غير مدفوعة — يُسجل التحصيل لاحقًا من حساب العميل" : deliveryForCustomer ? "مدفوعة بما فيها التوصيل" : "مدفوعة";
    if (isCashierSale) {
      cashierLimitNote.textContent = exceedsCashierLimit ? `الخصم الحالي ${money(totals.discount)} يتجاوز سقف الكاشير ${cashierLimitPercent}% (${money(cashierLimit)}).` : `خصم السطور والخصم العام: ${money(totals.discount)} من سقف الكاشير ${cashierLimitPercent}% (${money(cashierLimit)}).`;
      cashierLimitNote.classList.toggle("is-negative", exceedsCashierLimit);
    }
    submitButton.disabled = exceedsCashierLimit;
    creditField.hidden = !isCredit;
    if (dueDateField) dueDateField.hidden = !isCredit;
    creditSummary.hidden = !isCredit;

    if (cashTenderedInput && (toNumber(cashTenderedInput.value) === lastKnownTotal || toNumber(cashTenderedInput.value) <= 0)) {
      cashTenderedInput.value = totals.total;
    }
    lastKnownTotal = totals.total;
    renderQuickCashButtons(totals.total);
    syncChange();
  };

  form.querySelectorAll("[name=paymentType]").forEach((input) => input.addEventListener("change", syncCheckout));
  form.querySelectorAll("[name=deliveryChargeType]").forEach((input) => input.addEventListener("change", syncCheckout));
  form.discount.addEventListener("input", syncCheckout);
  form.deliveryFee.addEventListener("input", syncCheckout);
  syncCheckout();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const sale = await db.completeSale({
        items: state.cart,
        ...values,
        sellerRole: state.currentUser?.role || "",
        cashierShiftId: state.activeCashierShift?.id || "",
        cashierId: state.currentUser?.role === "cashier" ? state.currentUser.id : "",
        cashierName: state.currentUser?.name || "الأدمن",
      });
      state.cart = [];
      state.cartDiscount = "";
      await refresh();
      closeDialog();
      state.view = "invoices";
      render();
      showToast(sale.paymentType === "آجل" ? `حُفظت الفاتورة ${sale.invoiceNumber} وربطت بحساب العميل` : `تم حفظ الفاتورة ${sale.invoiceNumber} وخصم المخزون`);
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

async function openInvoiceDialog(saleId) {
  const rawInvoice = await db.getInvoice(saleId);
  if (!rawInvoice) return;
  const invoiceBase = invoiceWithCashier(rawInvoice);
  const customer = invoiceBase.customerId ? state.customers.find((entry) => entry.id === invoiceBase.customerId) || await db.getCustomer(invoiceBase.customerId) : null;
  const invoice = customer && !invoiceBase.customerName ? { ...invoiceBase, customerName: customer.name } : invoiceBase;
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">فاتورة محفوظة</span><h2>${invoice.invoiceNumber}</h2><p class="dialog__subtext">${dateTime(invoice.date)} · ${escapeHtml(invoice.paymentType || "نقدي")} · ${escapeHtml(invoice.paymentStatus || "مدفوعة")}</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="invoice-cashier-card"><span>الكاشير الذي نفّذ البيع</span><strong>${escapeHtml(invoiceCashierName(invoice))}</strong></div>${invoice.customerName ? `<div class="invoice-customer-card"><span>بيانات العميل</span><strong>${escapeHtml(invoice.customerName)}</strong>${customer?.phone ? `<small dir="ltr">${escapeHtml(customer.phone)}</small>` : ""}${customer?.address ? `<small>${escapeHtml(customer.address)}</small>` : ""}</div>` : ""}<div class="invoice-detail">${invoice.items.map((item) => `<div><span><strong>${escapeHtml(item.productName)}</strong><small>${amount(item.quantity)} ${escapeHtml(item.unit)} × ${money(item.unitPrice)}${toNumber(item.returnedQuantity) ? ` · مرتجع ${amount(item.returnedQuantity)}` : ""}</small></span><strong>${money(item.total)}</strong></div>`).join("")}<div class="invoice-detail__total"><span>الإجمالي قبل الخصم</span><strong>${money(invoice.subtotal)}</strong></div><div><span>الخصم</span><strong>${money(invoice.discount)}</strong></div>${toNumber(invoice.deliveryFee) > 0 ? `<div><span>التوصيل · ${invoice.deliveryChargeType === "customer" ? "على العميل ضمن الفاتورة" : "على حساب المحل"}</span><strong>${money(invoice.deliveryFee)}</strong></div>` : ""}<div class="invoice-detail__final"><span>الإجمالي النهائي</span><strong>${money(invoice.total)}</strong></div>${invoice.customerName ? `<div><span>العميل</span><strong>${escapeHtml(invoice.customerName)}</strong></div>` : ""}<div><span>المبلغ المدفوع</span><strong>${money(invoice.paidAmount)}</strong></div><div><span>الكاشير المنفذ</span><strong>${escapeHtml(invoice.cashierName || "الأدمن")}</strong></div>${invoice.paymentType === "آجل" ? `<div><span>المبلغ المتبقي</span><strong>${money(invoice.remainingAmount)}</strong></div>` : ""}</div><div class="dialog__actions"><button id="sale-return" class="button button--secondary" type="button">مرتجع بيع ${msymbol("assignment_return", "text-[18px]")}</button>${invoice.customerId ? `<button id="open-invoice-customer" class="button button--secondary" type="button">حساب العميل</button>` : ""}<button class="button button--primary" data-dialog-close>إغلاق الفاتورة</button></div></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#sale-return").addEventListener("click", () => { closeDialog(); openSaleReturnDialog(saleId); });
  overlay.querySelector("#open-invoice-customer")?.addEventListener("click", () => { closeDialog(); openCustomerAccountDialog(invoice.customerId); });
  const channel = paymentChannelLabel(invoice);
  overlay.querySelector(".dialog__subtext").textContent = `${dateTime(invoice.date)} · ${channel} · ${invoice.paymentStatus || "مدفوعة"}`;
  overlay.querySelector(".invoice-detail").insertAdjacentHTML("beforeend", `<div><span>طريقة السداد</span><strong>${channel}</strong></div>${invoice.paymentType === "آجل" && toNumber(invoice.paidAmount) > 0 ? `<div><span>وسيلة الدفعة الأولى</span><strong>${invoice.paymentMethod === "تحويل" ? "تحويل" : "كاش"}</strong></div>` : ""}`);
  overlay.querySelector(".dialog__actions").insertAdjacentHTML("afterbegin", `<button id="share-invoice" class="button button--secondary" type="button">${msymbol("ios_share", "text-[18px]")} مشاركة PDF</button><button id="whatsapp-invoice" class="button button--secondary" type="button">${icon("whatsapp", 17)} واتساب</button><button id="thermal-print-invoice" class="button button--secondary" type="button">${msymbol("print", "text-[18px]")} طباعة حرارية</button>`);
  overlay.querySelector("#share-invoice").addEventListener("click", () => shareInvoice(invoice));
  overlay.querySelector("#thermal-print-invoice").addEventListener("click", () => printInvoiceThermal(invoice));
  overlay.querySelector("#whatsapp-invoice")?.addEventListener("click", () => {
    const text = generateInvoiceWhatsAppMessage(invoice);
    const phone = customer?.phone || "";
    if (phone) {
      sendWhatsAppMessage(phone, text);
    } else {
      const manualPhone = window.prompt("أدخل رقم هاتف العميل للمراسلة عبر واتساب:");
      if (manualPhone) sendWhatsAppMessage(manualPhone, text);
    }
  });
}

function invoiceShareText(invoice) {
  const lines = invoice.items.map((item) => `- ${item.productName}: ${amount(item.quantity)} ${item.unit} × ${money(item.unitPrice)} = ${money(item.total)}`).join("\n");
  const deliveryLine = toNumber(invoice.deliveryFee) > 0 ? `\nالتوصيل (${invoice.deliveryChargeType === "customer" ? "على العميل ضمن الفاتورة" : "على حساب المحل"}): ${money(invoice.deliveryFee)}` : "";
  return `${storeDisplayName()}\nفاتورة ${invoice.invoiceNumber}\n${dateTime(invoice.date)}\nالكاشير: ${invoice.cashierName || "الأدمن"}\nطريقة السداد: ${paymentChannelLabel(invoice)}\n${lines}${deliveryLine}\nالإجمالي: ${money(invoice.total)}\nالمدفوع: ${money(invoice.paidAmount)}${invoice.paymentType === "آجل" ? `\nالمتبقي: ${money(invoice.remainingAmount)}` : ""}`;
}

async function copyTextForSharing(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = Object.assign(document.createElement("textarea"), { value: text }); area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
}

async function shareInvoice(invoice) {
  try {
    const customer = invoice.customerId ? state.customers.find((entry) => entry.id === invoice.customerId) || await db.getCustomer(invoice.customerId) : null;
    const invoiceWithCustomer = customer && !invoice.customerName ? { ...invoice, customerName: customer.name } : invoice;
    const result = await shareOrDownloadInvoicePdf({ invoice: invoiceWithCustomer, customer, html: await thermalInvoiceHtml(invoiceWithCustomer), storeName: storeDisplayName(), storeInfo: state.settings, logoDataUrl: storeLogoDataUrl() || storeLogoUrl(), formatMoney: money, formatAmount: amount, formatDateTime: dateTime, paymentLabel: paymentChannelLabel(invoiceWithCustomer), filename: `${invoice.invoiceNumber}.pdf`, title: `فاتورة ${invoice.invoiceNumber}` });
    showToast(result === "shared" ? "تمت مشاركة ملف الفاتورة PDF" : "تم تنزيل ملف الفاتورة PDF للمشاركة");
  } catch (error) { if (error?.name !== "AbortError") showToast("تعذر إنشاء ملف PDF للفواتير الآن.", "error"); }
}

async function thermalInvoiceHtml(invoice) {
  const customer = invoice.customerId ? state.customers.find((item) => item.id === invoice.customerId) || await db.getCustomer(invoice.customerId) : null;
  const invoiceWithCustomer = customer && !invoice.customerName ? { ...invoice, customerName: customer.name } : invoice;
  return renderThermalInvoiceHtml({ invoice: invoiceWithCustomer, customer, storeName: storeDisplayName(), storeInfo: state.settings, logoDataUrl: storeLogoDataUrl() || storeLogoUrl(), formatMoney: money, formatAmount: amount, formatDateTime: dateTime, escapeHtml, paymentLabel: paymentChannelLabel(invoice) });
}

async function printInvoiceThermal(invoice) {
  if (!printHtmlDocument({ html: await thermalInvoiceHtml(invoice), target: "hesabi-thermal-invoice", features: "width=420,height=720" })) showToast("السماح بالنوافذ المنبثقة مطلوب للطباعة الحرارية.", "error");
}

function openSupplierDialog(supplier = null) {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">${supplier ? "تحديث مورد" : "مورد جديد"}</span><h2>${supplier ? `تعديل ${escapeHtml(supplier.name)}` : "إضافة مورد"}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="supplier-form" class="form-grid"><label>اسم المورد<input name="name" required maxlength="100" dir="rtl" value="${escapeHtml(supplier?.name || "")}" autofocus /></label>${phoneFieldMarkup("supplier-phone", supplier?.phone || "")}<label class="form-full">العنوان<input name="address" dir="rtl" value="${escapeHtml(supplier?.address || "")}" /></label><label class="form-full">ملاحظات<textarea name="notes" dir="rtl">${escapeHtml(supplier?.notes || "")}</textarea></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">حفظ ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  bindContactPicker(overlay, "supplier-phone");
  overlay.querySelector("#supplier-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); if (supplier) await db.updateSupplier(supplier.id, values); else await db.createSupplier(values); await refresh(); closeDialog(); render(); showToast(supplier ? "تم تعديل المورد" : "تم حفظ المورد"); } catch (error) { showToast(error.message, "error"); } });
}

async function deleteSupplier(supplierId) { if (!window.confirm("هل تريد حذف المورد من القائمة؟")) return; try { await db.softDeleteSupplier(supplierId); await refresh(); render(); showToast("تم حذف المورد من القائمة"); } catch (error) { showToast(error.message, "error"); } }

async function openSupplierTransaction(transaction) {
  if (!transaction) return;
  let purchase = transaction.type === "PURCHASE" ? await db.getPurchase(transaction.referenceId) : null;
  if (!purchase && transaction.invoiceNumber) { const summary = state.purchases.find((item) => item.invoiceNumber === transaction.invoiceNumber); purchase = summary ? await db.getPurchase(summary.id) : null; }
  if (purchase) { closeDialog(); openPurchaseDetail(purchase); return; }
  if (transaction.type === "PAYMENT") {
    const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">إيصال دفعة مورد</span><h2>${escapeHtml(transaction.invoiceNumber || "دفعة مورد")}</h2><p class="dialog__subtext">${dateTime(transaction.date)}</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="invoice-detail"><div><span><strong>المبلغ المدفوع</strong><small>${escapeHtml(transaction.note || "تسديد مستحق للمورد")}</small></span><strong>${money(Math.abs(toNumber(transaction.amount)))}</strong></div><div class="invoice-detail__final"><span>الرصيد بعد الدفعة</span><strong>${money(transaction.remainingAmount)}</strong></div></div><div class="dialog__actions"><button class="button button--primary" data-dialog-close>إغلاق</button></div></div>`);
    overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
    return;
  }
  showToast("تعذر العثور على المستند المرتبط بهذه العملية.", "error");
}
async function openSupplierAccountDialog(supplierId) {
  const account = await db.getSupplierAccount(supplierId); if (!account) return; const typeLabel = { PURCHASE: "شراء", PAYMENT: "دفعة للمورد", PURCHASE_RETURN: "مرتجع شراء" };
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">حساب المورد</span><h2>${escapeHtml(account.supplier.name)}</h2><p class="dialog__subtext">${escapeHtml(account.supplier.phone || account.supplier.address || "لا توجد بيانات اتصال")}</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><section class="account-summary"><div><span>إجمالي المشتريات</span><strong>${money(account.totalPurchases)}</strong></div><div><span>إجمالي المسدد</span><strong>${money(account.totalPaid)}</strong></div><div class="account-summary__balance"><span>المستحق للمورد</span><strong>${money(account.balance)}</strong></div></section><div class="dialog__actions"><button id="record-supplier-payment" class="button button--primary" data-action="record-supplier-payment" data-id="${account.supplier.id}" ${toNumber(account.balance) <= 0 ? "disabled" : ""}>تسجيل دفعة ${msymbol("payments", "text-[18px]")}</button><button class="button button--secondary" data-dialog-close>إغلاق</button></div><section class="account-transactions"><div class="section-caption"><span class="eyebrow">سجل الحساب</span><strong>العمليات المرتبطة</strong></div>${account.transactions.length ? account.transactions.map((transaction) => `<button class="account-transaction" type="button" data-supplier-transaction="${escapeHtml(transaction.id)}"><div><strong>${typeLabel[transaction.type] || transaction.type}</strong><small>${dateTime(transaction.date)}${transaction.invoiceNumber ? ` · ${escapeHtml(transaction.invoiceNumber)}` : ""}</small></div><div><strong class="${toNumber(transaction.amount) < 0 ? "is-negative" : ""}">${money(transaction.amount)}</strong><small>الرصيد: ${money(transaction.remainingAmount)}</small></div></button>`).join("") : `<div class="inline-empty">لا توجد عمليات على حساب هذا المورد.</div>`}</section></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog)); overlay.querySelectorAll("[data-supplier-transaction]").forEach((button) => button.addEventListener("click", () => { const transaction = account.transactions.find((item) => item.id === button.dataset.supplierTransaction); if (transaction) void openSupplierTransaction(transaction); else showToast("تعذر العثور على العملية المرتبطة.", "error"); })); overlay.querySelector("#record-supplier-payment")?.addEventListener("click", () => { closeDialog(); openSupplierPaymentDialog(account.supplier.id); });
}

async function openSupplierPaymentDialog(supplierId = "") {
  const payableSuppliers = state.suppliers.filter((supplier) => toNumber(supplier.balance) > 0);
  if (!payableSuppliers.length) { showToast("لا يوجد مورد لديه مبلغ مستحق لتسجيل دفعة.", "error"); return; }
  const selectedId = payableSuppliers.some((supplier) => supplier.id === supplierId) ? supplierId : payableSuppliers[0].id;
  const supplierOptions = payableSuppliers.map((supplier) => `<option value="${supplier.id}" ${supplier.id === selectedId ? "selected" : ""}>${escapeHtml(supplier.name)} — مستحق ${money(supplier.balance)}</option>`).join("");
  const supplierSelect = supplierId ? `<input name="supplierId" type="hidden" value="${selectedId}" />` : `<label class="form-full">المورد<select id="supplier-payment-supplier" name="supplierId" required>${supplierOptions}</select></label>`;
  const selectedSupplier = payableSuppliers.find((supplier) => supplier.id === selectedId);
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">تسديد مورد</span><h2>${supplierId ? `دفعة إلى ${escapeHtml(selectedSupplier.name)}` : "تسجيل دفعة مورد"}</h2><p class="dialog__subtext">تسوّي الدفعة فواتير الشراء الآجلة للمورد، وتدخل في الصندوق عند الدفع النقدي أو التحويلات عند الاختيار.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div id="supplier-payment-balance" class="stock-before"><span>المستحق الحالي</span><strong>${money(selectedSupplier.balance)}</strong></div><form id="supplier-payment-form" class="form-grid">${supplierSelect}<label>المبلغ${quantityControlMarkup({ value: "", min: 0.01, step: "0.01", inputAttrs: `name="amount" required autofocus max="${toNumber(selectedSupplier.balance)}"` })}</label><label>طريقة الدفع<select name="paymentMethod">${PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join("")}</select></label><label>التاريخ<input name="date" required type="date" value="${dateKey()}" /></label><label class="form-full">ملاحظات<textarea name="notes" dir="rtl" placeholder="اختياري"></textarea></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">حفظ الدفعة ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  const paymentForm = overlay.querySelector("#supplier-payment-form"); const amountInput = paymentForm.querySelector("[name=amount]"); const balanceBox = overlay.querySelector("#supplier-payment-balance");
  const syncSupplierContext = () => { const currentId = paymentForm.elements.supplierId?.value || selectedId; const supplier = payableSuppliers.find((item) => item.id === currentId); if (!supplier) return; balanceBox.querySelector("strong").textContent = money(supplier.balance); amountInput.max = String(toNumber(supplier.balance)); if (toNumber(amountInput.value) > toNumber(supplier.balance)) amountInput.value = ""; };
  paymentForm.querySelector("#supplier-payment-supplier")?.addEventListener("change", syncSupplierContext);
  bindQuantityControl(overlay.querySelector(".quantity-control"), { min: 0.01, step: 0.01, onChange: () => {} });
  paymentForm.addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); const payment = await db.registerSupplierPayment({ supplierId: values.supplierId || selectedId, ...values }); await refresh(); closeDialog(); openSupplierPaymentReceipt(payment); } catch (error) { showToast(error.message, "error"); } });
}

function openSupplierPaymentReceipt(payment) {
  const supplier = state.suppliers.find((item) => item.id === payment.supplierId);
  const phone = supplier?.phone || "";
  const voucherText = `🧾 سند صرف دفعة مورد من ${storeDisplayName()}\n🏢 المورد: ${payment.supplierName}\n💰 المبلغ المدفوع: ${money(payment.amount)}\n💳 طريقة الدفع: ${payment.paymentMethod}\n📊 الرصيد السابق: ${money(payment.balanceBefore)}\n✅ المستحق المتبقي: ${money(payment.balanceAfter)}\n📅 التاريخ: ${payment.date}`;

  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head receipt-head"><div><span class="eyebrow">سند صرف / دفعة مورد</span><h2>${escapeHtml(storeDisplayName())}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><section id="supplier-payment-receipt" class="payment-receipt"><div class="payment-receipt__badge">سند صرف للمورد: ${escapeHtml(payment.id || "PAY-" + Date.now().toString().slice(-6))}</div><div><span>المورد</span><strong>${escapeHtml(payment.supplierName)}</strong></div><div><span>التاريخ</span><strong>${payment.date}</strong></div><div class="payment-receipt__highlight"><span>المبلغ المدفوع</span><strong>${money(payment.amount)}</strong></div><div><span>الرصيد قبل الدفع</span><strong>${money(payment.balanceBefore)}</strong></div><div><span>الرصيد بعد الدفع</span><strong>${money(payment.balanceAfter)}</strong></div><div><span>طريقة الدفع</span><strong>${escapeHtml(payment.paymentMethod)}</strong></div>${payment.notes ? `<div><span>ملاحظات</span><strong>${escapeHtml(payment.notes)}</strong></div>` : ""}</section><div class="dialog__actions"><button id="whatsapp-supplier-receipt" class="button button--secondary" type="button">${icon("whatsapp", 17)} واتساب</button><button id="share-supplier-receipt" class="button button--secondary" type="button">${msymbol("ios_share", "text-[18px]")} مشاركة نصية</button><button id="print-supplier-receipt" class="button button--primary" type="button">طباعة الإيصال ${msymbol("print", "text-[18px]")}</button></div></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#print-supplier-receipt").addEventListener("click", () => window.print());
  overlay.querySelector("#share-supplier-receipt")?.addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ title: `سند صرف - ${payment.supplierName}`, text: voucherText });
      else {
        await copyTextForSharing(voucherText);
        showToast("تم نسخ السند للحافظة");
      }
    } catch {
      showToast("تعذرت مشاركة السند الآن.", "error");
    }
  });
  overlay.querySelector("#whatsapp-supplier-receipt")?.addEventListener("click", () => {
    if (phone) {
      sendWhatsAppMessage(phone, voucherText);
    } else {
      const manualPhone = window.prompt("أدخل رقم هاتف المورد للمراسلة عبر واتساب:");
      if (manualPhone) sendWhatsAppMessage(manualPhone, voucherText);
    }
  });
}

function openCustomerDialog(customer = null) {
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">${customer ? "تحديث عميل" : "عميل جديد"}</span><h2>${customer ? `تعديل ${escapeHtml(customer.name)}` : "إضافة عميل"}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="customer-form" class="form-grid"><label>اسم العميل<input name="name" required maxlength="100" dir="rtl" value="${escapeHtml(customer?.name || "")}" autofocus /></label>${phoneFieldMarkup("customer-phone", customer?.phone || "")}<label class="form-full">العنوان<input name="address" dir="rtl" value="${escapeHtml(customer?.address || "")}" /></label><label class="form-full">ملاحظات<textarea name="notes" dir="rtl">${escapeHtml(customer?.notes || "")}</textarea></label><label>سقف مديونية العميل<input name="creditLimit" type="number" min="0" step="0.01" value="${escapeHtml(customer?.creditLimit ?? "")}" /><small class="field-hint">اتركه فارغًا لاستخدام السقف العام. ضع 0 للسماح دون سقف لهذا العميل.</small></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">حفظ العميل ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  bindContactPicker(overlay, "customer-phone");
  overlay.querySelector("#customer-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); if (customer) await db.updateCustomer(customer.id, values); else await db.createCustomer(values); await refresh(); closeDialog(); state.view = "customers"; render(); showToast(customer ? "تم تعديل العميل" : "تم حفظ العميل"); } catch (error) { showToast(error.message, "error"); } });
}

async function deleteCustomer(customerId) { if (!window.confirm("هل تريد إخفاء العميل من القائمة؟ سيبقى تاريخه وفواتيره محفوظين.")) return; try { await db.softDeleteCustomer(customerId); await refresh(); render(); showToast("أُخفي العميل مع الحفاظ على سجله التاريخي."); } catch (error) { showToast(error.message, "error"); } }

async function openCustomerTransaction(transaction) {
  if (!transaction) return;
  const sale = transaction.type === "CREDIT_SALE" ? (state.sales.find((item) => item.id === transaction.referenceId) || await db.getInvoice(transaction.referenceId)) : (state.sales.find((item) => item.invoiceNumber === transaction.invoiceNumber) || null);
  if (sale) { closeDialog(); openInvoiceDialog(sale.id); return; }
  if (transaction.type === "PAYMENT") {
    const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">إيصال دفعة عميل</span><h2>${escapeHtml(transaction.invoiceNumber || "دفعة عميل")}</h2><p class="dialog__subtext">${dateTime(transaction.date)}</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="invoice-detail"><div><span><strong>المبلغ المدفوع</strong><small>${escapeHtml(transaction.note || "تحصيل من العميل")}</small></span><strong>${money(Math.abs(toNumber(transaction.amount)))}</strong></div><div class="invoice-detail__final"><span>الرصيد بعد الدفعة</span><strong>${money(transaction.remainingAmount)}</strong></div></div><div class="dialog__actions"><button class="button button--primary" data-dialog-close>إغلاق</button></div></div>`);
    overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
    return;
  }
  showToast("تعذر العثور على المستند المرتبط.", "error");
}
async function openCustomerAccountDialog(customerId) {
  const account = await db.getCustomerAccount(customerId); if (!account) return; const typeLabel = { CREDIT_SALE: "بيع آجل", PAYMENT: "دفعة عميل", SALE_RETURN: "مرتجع بيع" };
  const printAccount = { ...account, transactions: account.transactions.map((transaction) => ({ ...transaction, typeLabel: typeLabel[transaction.type] || transaction.type })) };
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">حساب العميل</span><h2>${escapeHtml(account.customer.name)}</h2><p class="dialog__subtext">${escapeHtml(account.customer.phone || account.customer.address || "لا توجد بيانات اتصال")}</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><section class="account-summary"><div><span>سقف المديونية</span><strong>${toNumber(account.customer.creditLimit) > 0 ? money(account.customer.creditLimit) : toNumber(state.settings?.customerCreditLimit) > 0 ? `${money(state.settings.customerCreditLimit)} (عام)` : "بلا سقف"}</strong></div><div><span>إجمالي المبيعات</span><strong>${money(account.totalSales)}</strong></div><div><span>إجمالي المدفوع</span><strong>${money(account.totalPaid)}</strong></div><div class="account-summary__balance"><span>الرصيد المستحق</span><strong>${money(account.balance)}</strong></div></section><div class="dialog__actions"><button id="share-customer-account" class="button button--secondary" type="button">${msymbol("ios_share", "text-[18px]")} مشاركة PDF</button><button id="print-customer-account" class="button button--secondary" type="button">${msymbol("print", "text-[18px]")} طباعة الحساب</button><button id="record-customer-payment" class="button button--primary" data-action="record-customer-payment" data-id="${account.customer.id}" ${toNumber(account.balance) <= 0 ? "disabled" : ""}>تسجيل دفعة ${msymbol("payments", "text-[18px]")}</button><button class="button button--secondary" data-dialog-close>إغلاق</button></div><section class="account-transactions"><div class="section-caption"><span class="eyebrow">سجل الحساب</span><strong>العمليات المرتبطة</strong></div>${account.transactions.length ? account.transactions.map((transaction) => `<button class="account-transaction" type="button" data-customer-transaction="${escapeHtml(transaction.id)}"><div><strong>${typeLabel[transaction.type] || transaction.type}</strong><small>${dateTime(transaction.date)}${transaction.invoiceNumber ? ` · ${escapeHtml(transaction.invoiceNumber)}` : ""}</small></div><div><strong class="${toNumber(transaction.amount) < 0 ? "is-negative" : ""}">${money(transaction.amount)}</strong><small>الرصيد: ${money(transaction.remainingAmount)}</small></div></button>`).join("") : `<div class="inline-empty">لا توجد عمليات على حساب هذا العميل.</div>`}</section></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelectorAll("[data-customer-transaction]").forEach((button) => button.addEventListener("click", () => { const transaction = account.transactions.find((item) => item.id === button.dataset.customerTransaction); if (transaction) void openCustomerTransaction(transaction); else showToast("تعذر العثور على العملية المرتبطة.", "error"); }));
  overlay.querySelector("#record-customer-payment")?.addEventListener("click", () => { closeDialog(); openCustomerPaymentDialog(account.customer.id); });
  const accountHtml = () => renderCustomerAccountHtml({ account: printAccount, storeName: storeDisplayName(), storeInfo: state.settings, logoDataUrl: storeLogoDataUrl() || storeLogoUrl(), formatMoney: money, formatDateTime: dateTime, escapeHtml });
  overlay.querySelector("#print-customer-account").addEventListener("click", () => { if (!printHtmlDocument({ html: accountHtml(), target: "hesabi-customer-account", features: "width=900,height=760" })) showToast("السماح بالنوافذ المنبثقة مطلوب للطباعة.", "error"); });
  overlay.querySelector("#share-customer-account").addEventListener("click", async () => { try { const result = await shareOrDownloadCustomerAccountPdf({ account: printAccount, html: accountHtml(), storeName: storeDisplayName(), storeInfo: state.settings, logoDataUrl: storeLogoDataUrl() || storeLogoUrl(), formatMoney: money, formatDateTime: dateTime, filename: `كشف-حساب-${account.customer.name}.pdf`, title: `كشف حساب ${account.customer.name}` }); showToast(result === "shared" ? "تمت مشاركة كشف الحساب PDF" : "تم تنزيل كشف الحساب PDF للمشاركة"); } catch (error) { if (error?.name !== "AbortError") showToast("تعذر إنشاء PDF لكشف الحساب.", "error"); } });
}

async function openCustomerPaymentDialog(customerId) {
  const account = await db.getCustomerAccount(customerId); if (!account) return; const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">تسديد رصيد</span><h2>دفعة من ${escapeHtml(account.customer.name)}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="stock-before"><span>الرصيد الحالي</span><strong>${money(account.balance)}</strong></div><form id="customer-payment-form" class="form-grid"><label>المبلغ${quantityControlMarkup({ value: "", min: 0.01, step: "0.01", inputAttrs: "name=\"amount\" required autofocus" })}</label><label>طريقة التحصيل<select name="paymentMethod">${PAYMENT_METHODS.map((method) => `<option value="${method}">${method === "تحويل" ? "تحويل" : "كاش"}</option>`).join("")}</select></label><label>التاريخ<input name="date" required type="date" value="${dateKey()}" /></label><label class="form-full">ملاحظات<textarea name="notes" dir="rtl" placeholder="اختياري"></textarea></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">حفظ الدفعة ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog)); bindQuantityControl(overlay.querySelector(".quantity-control"), { min: 0.01, step: 0.01, onChange: () => {} });
  overlay.querySelector("#customer-payment-form").addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); const payment = await db.registerCustomerPayment({ customerId, ...values }); await refresh(); closeDialog(); openPaymentReceipt(payment); } catch (error) { showToast(error.message, "error"); } });
}

function openPaymentReceipt(payment) {
  const customer = state.customers.find((item) => item.id === payment.customerId);
  const phone = customer?.phone || payment.customerPhone || "";
  const voucherText = `🧾 سند قبض من ${storeDisplayName()}\n👤 العميل: ${payment.customerName}\n💰 المبلغ المستلم: ${money(payment.amount)}\n💳 طريقة التحصيل: ${payment.paymentMethod === "تحويل" ? "تحويل" : "كاش"}\n📊 الرصيد السابق: ${money(payment.balanceBefore)}\n✅ الرصيد المتبقي بعد الدفعة: ${money(payment.balanceAfter)}\n📅 التاريخ: ${dateTime(payment.date || payment.createdAt || nowIso())}\nشكراً لتعاملكم معنا!`;

  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head receipt-head"><div><span class="eyebrow">سند قبض / إيصال دفعة</span><h2>${escapeHtml(storeDisplayName())}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><section id="payment-receipt" class="payment-receipt"><div class="payment-receipt__badge">سند تحصيل رقم: ${escapeHtml(payment.id || "REC-" + Date.now().toString().slice(-6))}</div><div><span>العميل</span><strong>${escapeHtml(payment.customerName)}</strong></div><div><span>التاريخ</span><strong>${payment.date}</strong></div><div class="payment-receipt__highlight"><span>المبلغ المدفوع</span><strong>${money(payment.amount)}</strong></div><div><span>طريقة التحصيل</span><strong>${payment.paymentMethod === "تحويل" ? "تحويل" : "كاش"}</strong></div><div><span>الرصيد قبل الدفع</span><strong>${money(payment.balanceBefore)}</strong></div><div><span>الرصيد بعد الدفع</span><strong>${money(payment.balanceAfter)}</strong></div><div><span>العملة</span><strong>${escapeHtml(state.settings?.currency || "YER")}</strong></div>${payment.notes ? `<div><span>ملاحظات</span><strong>${escapeHtml(payment.notes)}</strong></div>` : ""}</section><div class="dialog__actions"><button id="whatsapp-receipt" class="button button--secondary" type="button">${icon("whatsapp", 17)} واتساب</button><button id="share-receipt" class="button button--secondary">${msymbol("ios_share", "text-[18px]")} مشاركة نصية</button><button id="print-receipt" class="button button--primary">طباعة إيصال ${msymbol("print", "text-[18px]")}</button></div></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#print-receipt").addEventListener("click", () => window.print());
  overlay.querySelector("#share-receipt").addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ title: "إيصال دفعة", text: voucherText });
      else {
        await copyTextForSharing(voucherText);
        showToast("تم نسخ الإيصال للمشاركة");
      }
    } catch {
      showToast("تعذرت مشاركة الإيصال الآن.", "error");
    }
  });
  overlay.querySelector("#whatsapp-receipt")?.addEventListener("click", () => {
    if (phone) {
      sendWhatsAppMessage(phone, voucherText);
    } else {
      const manualPhone = window.prompt("أدخل رقم هاتف العميل للمراسلة عبر واتساب:");
      if (manualPhone) sendWhatsAppMessage(manualPhone, voucherText);
    }
  });
}

async function settleStaffSalary(accountId) {
  const account = state.accounts.find((item) => item.id === accountId); const summary = (state.cashierSalarySummaries || []).find((item) => item.accountId === accountId && item.month === dateKey().slice(0, 7));
  if (!account || !["admin", "cashier", "employee"].includes(account.role) || !summary) { showToast("لا توجد بيانات راتب لهذا الحساب في الشهر الحالي.", "error"); return; }
  if (summary.salaryDelivered) { showToast("تم تسليم راتب هذا الحساب لهذا الشهر مسبقًا.", "error"); return; }
  const message = `سيتم تسليم ${money(summary.remainingSalary)} للحساب ${account.name} عن شهر ${summary.month} بعد خصم السلف وخصومات العجز، وسيُحتسب الراتب الكامل ${money(summary.monthlySalary)} ضمن رواتب المصروفات. هل تريد المتابعة؟`;
  if (!window.confirm(message)) return;
  try { const result = await db.settleCashierSalary({ accountId, month: summary.month, date: dateKey(), notes: "تم التسليم من زر تسليم الراتب" }); await refresh(); render(); showToast(`تم تسليم راتب ${account.name} بمبلغ ${money(result.amount)} وترحيله كسجل راتب مسلم.`); }
  catch (error) { showToast(error.message || "تعذر تسليم راتب الموظف.", "error"); }
}

function openCashierSalaryAdvanceDialog() {
  const staff = state.accounts.filter((account) => ["admin", "cashier", "employee"].includes(account.role) && account.isActive);
  if (!staff.length) { showToast("أضف حسابًا نشطًا قبل تسجيل السلفة.", "error"); return; }
  const options = staff.map((account) => `<option value="${account.id}">${escapeHtml(account.name)} · ${roleLabel(account.role)}${account.jobTitle ? ` · ${escapeHtml(account.jobTitle)}` : ""}</option>`).join("");
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">خصم من الراتب</span><h2>سلفة من الراتب</h2><p class="dialog__subtext">تسجل كحركة نقدية مستقلة، وتخصم من الراتب المتبقي للموظف في شهر التاريخ المحدد.</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="cashier-salary-advance-form" class="form-grid"><label>الموظف<select name="staffId">${options}</select></label><label>المبلغ<input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required autofocus /></label><label>تاريخ السلفة<input name="date" type="date" value="${dateKey()}" required /></label><label class="form-full">الوصف<input name="description" dir="rtl" placeholder="مثال: سلفة من راتب الشهر" /></label><p id="cashier-salary-advance-note" class="form-full scanner-session-note"></p><label class="form-full">ملاحظات<textarea name="notes" dir="rtl"></textarea></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">تسجيل السلفة ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  const form = overlay.querySelector("#cashier-salary-advance-form"); const note = overlay.querySelector("#cashier-salary-advance-note");
  const syncAdvanceNote = () => { const month = String(form.date.value || dateKey()).slice(0, 7); const summary = (state.cashierSalarySummaries || []).find((item) => item.accountId === form.staffId.value && item.month === month); const account = staff.find((item) => item.id === form.staffId.value); const salary = toNumber(summary?.monthlySalary ?? account?.monthlySalary); const advances = toNumber(summary?.advances); const shortageDeductions = toNumber(summary?.shortageDeductions); const salaryPaid = toNumber(summary?.salaryPaid); const remaining = summary ? toNumber(summary.remainingSalary) : roundMoney(salary - advances - shortageDeductions - salaryPaid); note.textContent = salary > 0 ? `راتب ${account?.name || "الموظف"}: ${money(salary)} · السلف: ${money(advances)} · خصم العجز: ${money(shortageDeductions)} · المسلم: ${money(salaryPaid)} · المتبقي: ${money(remaining)}` : "لم يُسجل راتب شهري لهذا الموظف؛ عدّل بيانات حسابه أولًا."; };
  form.staffId.addEventListener("change", syncAdvanceNote); form.date.addEventListener("change", syncAdvanceNote); syncAdvanceNote();
  form.addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(form)); await db.createExpense({ ...values, salaryAdvance: true, cashierSalaryAdvance: true, periodType: "daily" }); await refresh(); closeDialog(); render(); showToast("تم تسجيل سلفة الموظف وخصمها من راتبه."); } catch (error) { showToast(error.message || "تعذر تسجيل سلفة الموظف.", "error"); } });
}

function openExpenseDialog(expense = null) {
  const initialPeriod = expense?.periodType === "monthly" ? "monthly" : "daily";
  const initialCategories = initialPeriod === "monthly" ? MONTHLY_EXPENSE_CATEGORIES : DAILY_EXPENSE_CATEGORIES;
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">${expense ? "تعديل المصروف" : "مصروف جديد"}</span><h2>${expense ? "تحديث بيانات المصروف" : "إضافة مصروف"}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="expense-form" class="form-grid"><fieldset class="payment-type form-full"><legend>دورية المصروف</legend><label><input name="periodType" type="radio" value="daily" ${initialPeriod === "daily" ? "checked" : ""} /> يومي — مثل الأكل والشرب والمواصلات</label><label><input name="periodType" type="radio" value="monthly" ${initialPeriod === "monthly" ? "checked" : ""} /> شهري — مثل الإيجار والكهرباء والماء</label></fieldset><label>المبلغ<input name="amount" required type="number" min="0.01" step="0.01" value="${expense?.amount || ""}" autofocus /></label><label>فئة المصروف<select name="category">${initialCategories.map((category) => `<option value="${category}" ${expense?.category === category ? "selected" : ""}>${category}</option>`).join("")}</select></label><label><span id="expense-date-label">${initialPeriod === "monthly" ? "شهر الاستحقاق" : "تاريخ المصروف"}</span><input name="date" required type="date" value="${expense?.date || dateKey()}" /></label><label>الوصف<input name="description" dir="rtl" value="${escapeHtml(expense?.description || "")}" /></label><p id="expense-allocation-note" class="form-full scanner-session-note">${initialPeriod === "monthly" ? "سيُوزع هذا المبلغ تلقائيًا على أيام الشهر ويدخل في الأرباح والتقارير بالحصة اليومية فقط." : "يسجل هذا المبلغ مباشرة ضمن مصروفات اليوم."}</p><label class="form-full">ملاحظات<textarea name="notes" dir="rtl">${escapeHtml(expense?.notes || "")}</textarea></label><div class="dialog__actions form-full"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">حفظ المصروف ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  const form = overlay.querySelector("#expense-form"); const categorySelect = form.category; const dateLabel = overlay.querySelector("#expense-date-label"); const allocationNote = overlay.querySelector("#expense-allocation-note");
  const syncExpensePeriod = () => { const isMonthly = form.periodType.value === "monthly"; const categories = isMonthly ? MONTHLY_EXPENSE_CATEGORIES : DAILY_EXPENSE_CATEGORIES; const current = categorySelect.value; categorySelect.innerHTML = categories.map((category) => `<option value="${category}" ${category === current ? "selected" : ""}>${category}</option>`).join(""); dateLabel.textContent = isMonthly ? "شهر الاستحقاق" : "تاريخ المصروف"; allocationNote.textContent = isMonthly ? "سيُوزع هذا المبلغ تلقائيًا على أيام الشهر ويدخل في الأرباح والتقارير بالحصة اليومية فقط." : "يسجل هذا المبلغ مباشرة ضمن مصروفات اليوم."; };
  form.querySelectorAll("[name=periodType]").forEach((input) => input.addEventListener("change", syncExpensePeriod));
  form.addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); if (expense) await db.updateExpense(expense.id, values); else await db.createExpense(values); await refresh(); closeDialog(); render(); showToast(expense ? "تم تعديل المصروف" : "تم حفظ المصروف"); } catch (error) { showToast(error.message, "error"); } });
}

async function deleteCashierAccount(accountId) { const account = state.accounts.find((item) => item.id === accountId); if (!account || account.role !== "cashier") return; if (!window.confirm(`حذف حساب ${account.name}؟ سيُوقف الحساب عن الدخول مع الاحتفاظ بكل الفواتير والسلف والورديات.`)) return; try { await db.deleteCashierAccount(accountId); state.accounts = await db.listAccounts(); await refresh(); render(); showToast(`تم حذف حساب الكاشير ${account.name} مع الاحتفاظ بسجله.`); } catch (error) { showToast(error.message || "تعذر حذف حساب الكاشير.", "error"); } }
async function deleteExpense(expenseId) { if (!window.confirm("هل تريد حذف المصروف؟")) return; try { await db.deleteExpense(expenseId); await refresh(); render(); showToast("تم حذف المصروف"); } catch (error) { showToast(error.message, "error"); } }

function openPurchaseEntryDialog() {
  openPurchaseDialog({ supplierId: "", notes: "", lines: [], paymentType: "نقدي", paidAmount: "", paymentMethod: "نقدي" });
}

async function openPurchaseDialog(purchaseIdOrDraft = null) {
  if (typeof purchaseIdOrDraft === "string") { openPurchaseDetail(await db.getPurchase(purchaseIdOrDraft)); return; }
  const draft = purchaseIdOrDraft || { supplierId: "", notes: "", lines: [], paymentType: "نقدي", paidAmount: "", paymentMethod: "نقدي" };
  const makePurchaseLine = (product, values = {}) => {
    const packageUnit = values.packageUnit || product.purchasePackageUnit || businessProfile().defaultPackageUnit;
    const packageQuantity = values.packageQuantity ?? values.quantity ?? 1;
    const unitsPerPackage = values.unitsPerPackage ?? product.unitsPerPackage ?? 1;
    const packageCost = values.packageCost ?? (values.unitCost === undefined ? (product.lastPackageCost || toNumber(product.purchasePrice) * toNumber(unitsPerPackage)) : toNumber(values.unitCost) * toNumber(unitsPerPackage));
    const salePrice = values.salePrice === undefined || values.salePrice === "" ? product.salePrice ?? product.defaultSalePrice ?? product.price ?? 0 : values.salePrice;
    return { ...values, productId: product.id, productName: product.name, unit: product.unit || businessProfile().defaultUnit, packageUnit, salePrice: toNumber(salePrice), batchNumber: values.batchNumber || "", productionDate: values.productionDate || "", expiryDate: values.expiryDate || "", ...calculatePackagePurchase({ packageQuantity, unitsPerPackage, packageCost }) };
  };
  const lines = (draft.lines || []).map((line) => makePurchaseLine(state.products.find((product) => product.id === line.productId) || line, line)); const isDraftCredit = draft.paymentType === "آجل";
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">إدخال شراء</span><h2>فاتورة شراء جديدة</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="purchase-form" class="purchase-form"><div class="purchase-picker"><label>إضافة منتج إلى الفاتورة<div class="purchase-search-control"><input id="purchase-product-search" dir="rtl" autocomplete="off" placeholder="ابحث بالاسم أو الباركود..." /><button id="purchase-scan-product" class="icon-button" type="button" title="مسح باركود للشراء" aria-label="مسح باركود للشراء">${msymbol("qr_code_scanner", "text-[19px]")}</button></div></label><div id="purchase-product-results" class="purchase-product-results"></div></div><button id="purchase-new-product" class="button button--secondary purchase-new-product" type="button">إضافة منتج جديد ${msymbol("add", "text-[18px]")}</button><label id="purchase-supplier-field">المورد <small id="purchase-supplier-note">اختياري للنقدي</small><select name="supplierId"><option value="">بدون مورد</option>${state.suppliers.map((supplier) => `<option value="${supplier.id}" ${draft.supplierId === supplier.id ? "selected" : ""}>${escapeHtml(supplier.name)}</option>`).join("")}</select></label><fieldset class="payment-type"><legend>نوع الدفع</legend><label><input name="paymentType" type="radio" value="نقدي" ${isDraftCredit ? "" : "checked"} /> نقدي</label><label><input name="paymentType" type="radio" value="آجل" ${isDraftCredit ? "checked" : ""} /> آجل</label></fieldset><label>طريقة الدفع<select name="paymentMethod">${PAYMENT_METHODS.map((method) => `<option value="${method}" ${draft.paymentMethod === method ? "selected" : ""}>${method}</option>`).join("")}</select></label><label>المبلغ المدفوع<input name="paidAmount" type="number" inputmode="decimal" min="0" step="0.01" value="${escapeHtml(draft.paidAmount ?? "")}" /></label><div class="credit-summary" id="purchase-credit-summary" hidden><span>المبلغ المتبقي للمورد</span><strong id="purchase-remaining-amount">${money(0)}</strong><small id="purchase-payment-status">مدفوعة</small></div><div id="purchase-lines" class="purchase-lines"></div><label>ملاحظات<textarea name="notes" dir="rtl">${escapeHtml(draft.notes || "")}</textarea></label><div class="checkout-total"><span>إجمالي فاتورة الشراء</span><strong id="purchase-total">${money(0)}</strong></div><div class="dialog__actions"><button class="button button--secondary" type="button" data-dialog-close>إلغاء</button><button class="button button--primary" type="submit">حفظ فاتورة الشراء ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  const form = overlay.querySelector("#purchase-form"); const search = overlay.querySelector("#purchase-product-search"); const results = overlay.querySelector("#purchase-product-results"); const linesHost = overlay.querySelector("#purchase-lines"); const paidInput = form.paidAmount; const supplierField = overlay.querySelector("#purchase-supplier-field"); const supplierNote = overlay.querySelector("#purchase-supplier-note"); const creditSummary = overlay.querySelector("#purchase-credit-summary");
  const hydrateBusinessPurchaseFields = () => {
    linesHost.querySelectorAll("[data-purchase-package-unit]").forEach((select) => { const index = Number(select.dataset.purchasePackageUnit); const line = lines[index]; if (!line) return; select.innerHTML = profileOptions("packageUnits", line.packageUnit).map((unit) => `<option value="${unit}" ${unit === line.packageUnit ? "selected" : ""}>${unit}</option>`).join(""); const labels = packageFieldLabels(line.packageUnit, line.unit); const quantityInput = linesHost.querySelector(`[data-purchase-package-quantity="${index}"]`); const unitsInput = linesHost.querySelector(`[data-purchase-units-per-package="${index}"]`); const costInput = linesHost.querySelector(`[data-purchase-package-cost="${index}"]`); if (quantityInput?.parentElement?.firstChild) quantityInput.parentElement.firstChild.textContent = labels.quantity; if (unitsInput?.parentElement?.firstChild) unitsInput.parentElement.firstChild.textContent = labels.units; if (costInput?.parentElement?.firstChild) costInput.parentElement.firstChild.textContent = labels.cost; });
    linesHost.querySelectorAll(".purchase-line").forEach((row, index) => { if (row.querySelector("[data-purchase-expiry-date]")) return; const line = lines[index]; const batchField = isPharmacy() ? `<label>رقم التشغيلة (اختياري)<input data-purchase-batch-number="${index}" dir="ltr" value="${escapeHtml(line.batchNumber || "")}" /></label>` : ""; row.querySelector(".purchase-line__total")?.insertAdjacentHTML("beforebegin", `${batchField}<label>تاريخ الإنتاج<input class="native-date-input" data-purchase-production-date="${index}" type="date" dir="ltr" value="${escapeHtml(line.productionDate || "")}" /></label><label>تاريخ الانتهاء<input class="native-date-input" data-purchase-expiry-date="${index}" type="date" dir="ltr" ${isPharmacy() ? "required" : ""} value="${escapeHtml(line.expiryDate || "")}" /></label>`); });
  };
  linesHost.addEventListener("input", (event) => { const index = Number(event.target.dataset.purchaseBatchNumber ?? event.target.dataset.purchaseProductionDate ?? event.target.dataset.purchaseExpiryDate); if (!Number.isFinite(index)) return; if (event.target.dataset.purchaseBatchNumber !== undefined) lines[index].batchNumber = event.target.value.trim(); if (event.target.dataset.purchaseProductionDate !== undefined) lines[index].productionDate = event.target.value; if (event.target.dataset.purchaseExpiryDate !== undefined) lines[index].expiryDate = event.target.value; });
  const getDraft = () => ({ supplierId: form.supplierId.value, notes: form.notes.value, paymentType: form.paymentType.value, paidAmount: paidInput.value, paymentMethod: form.paymentMethod.value, lines: lines.map((line) => ({ ...line })) });
  const refreshPackMath = (line) => Object.assign(line, calculatePackagePurchase({ packageQuantity: line.packageQuantity, unitsPerPackage: line.unitsPerPackage, packageCost: line.packageCost }));
  const syncPurchase = ({ resetPaid = false } = {}) => { const total = roundMoney(lines.reduce((sum, line) => sum + toNumber(line.total), 0)); const requestedCredit = form.paymentType.value === "آجل"; if (resetPaid) { paidInput.value = ""; paidInput.dataset.userEdited = "false"; } else if (!requestedCredit && paidInput.dataset.userEdited !== "true") { paidInput.value = total || ""; paidInput.dataset.userEdited = "false"; } if (toNumber(paidInput.value) > total) paidInput.value = total; const paid = roundMoney(toNumber(paidInput.value)); const remaining = Math.max(0, roundMoney(total - paid)); const requiresSupplier = requestedCredit || remaining > 0; creditSummary.hidden = !(requestedCredit || remaining > 0); supplierField.classList.toggle("is-required", requiresSupplier); supplierNote.textContent = requiresSupplier ? "مطلوب عند وجود مبلغ متبقي" : "اختياري عند السداد الكامل"; overlay.querySelector("#purchase-total").textContent = money(total); overlay.querySelector("#purchase-remaining-amount").textContent = money(remaining); overlay.querySelector("#purchase-payment-status").textContent = remaining === 0 ? "مدفوعة بالكامل" : paid > 0 ? "مدفوعة جزئيًا — يُضاف الباقي إلى رصيد المورد" : "غير مدفوعة — يُضاف كامل المبلغ إلى رصيد المورد"; };
  const packageLabels = (packageUnit) => ({ "حبة": { quantity: "عدد الحبات", units: "حبة/حبة", cost: "سعر الحبة" }, "علبة": { quantity: "عدد العلب", units: "حبة/علبة", cost: "سعر العلبة" }, "كرتون": { quantity: "عدد الكراتين", units: "حبة/كرتون", cost: "سعر الكرتون" }, "كيس": { quantity: "عدد الأكياس", units: "حبة/كيس", cost: "سعر الكيس" }, "حزمة": { quantity: "عدد الحزم", units: "حبة/حزمة", cost: "سعر الحزمة" }, "ربطة": { quantity: "عدد الربطات", units: "حبة/ربطة", cost: "سعر الربطة" }, "صندوق": { quantity: "عدد الصناديق", units: "حبة/صندوق", cost: "سعر الصندوق" } }[packageUnit] || { quantity: "عدد العبوات", units: "حبات/عبوة", cost: "سعر العبوة" });
  const renderLines = () => {
    linesHost.innerHTML = lines.length ? lines.map((line, index) => { const labels = packageFieldLabels(line.packageUnit, line.unit); return `<article class="purchase-line purchase-line--pack"><div><strong>${escapeHtml(line.productName)}</strong><small>سيضاف ${amount(line.quantity)} ${escapeHtml(line.unit)} إلى المخزون</small></div><label>نوع العبوة<select data-purchase-package-unit="${index}">${PACKAGE_UNITS.map((unit) => `<option value="${unit}" ${line.packageUnit === unit ? "selected" : ""}>${unit}</option>`).join("")}</select></label><label>${labels.quantity}<input data-purchase-package-quantity="${index}" type="number" inputmode="decimal" min="0.001" step="0.001" value="${line.packageQuantity || ""}" /></label><label>${labels.units}<input data-purchase-units-per-package="${index}" type="number" inputmode="numeric" min="1" step="1" value="${line.unitsPerPackage || ""}" /></label><label>${labels.cost}<input data-purchase-package-cost="${index}" type="number" inputmode="decimal" min="0" step="0.01" value="${line.packageCost || ""}" /></label><label>${labels.summary}<output>${money(line.unitCost)}</output></label><label class="purchase-sale-price-field">${labels.salePrice}<span class="purchase-sale-price-control"><input data-purchase-sale-price="${index}" type="number" inputmode="decimal" min="0" step="0.01" value="${line.salePrice ?? ""}" /><b class="purchase-sale-price-field__current" data-purchase-sale-price-visible="${index}" aria-live="polite">${escapeHtml(String(line.salePrice ?? ""))}</b></span></label><strong class="purchase-line__total">${money(line.total)}</strong><button data-remove-purchase-line="${index}" class="icon-button icon-button--danger" type="button" aria-label="حذف">${msymbol("close", "text-[18px]")}</button></article>`; }).join("") : `<div class="inline-empty">أضف منتجًا واحدًا على الأقل.</div>`;
    hydrateBusinessPurchaseFields();
    syncPurchase();
    linesHost.querySelectorAll("[data-purchase-package-unit]").forEach((input) => input.addEventListener("change", (event) => { lines[Number(event.currentTarget.dataset.purchasePackageUnit)].packageUnit = event.currentTarget.value; renderLines(); }));
    [["[data-purchase-package-quantity]", "purchasePackageQuantity", "packageQuantity"], ["[data-purchase-units-per-package]", "purchaseUnitsPerPackage", "unitsPerPackage"], ["[data-purchase-package-cost]", "purchasePackageCost", "packageCost"]].forEach(([selector, datasetKey, key]) => linesHost.querySelectorAll(selector).forEach((input) => input.addEventListener("change", (event) => { const index = Number(event.currentTarget.dataset[datasetKey]); lines[index][key] = Math.max(0, toNumber(event.currentTarget.value)); refreshPackMath(lines[index]); renderLines(); })));
    linesHost.querySelectorAll("[data-purchase-sale-price]").forEach((input) => { const syncSalePrice = (event) => { const index = Number(event.currentTarget.dataset.purchaseSalePrice); lines[index].salePrice = Math.max(0, toNumber(event.currentTarget.value)); const current = linesHost.querySelector(`[data-purchase-sale-price-visible="${index}"]`); if (current) current.textContent = event.currentTarget.value; }; input.addEventListener("input", syncSalePrice); input.addEventListener("change", syncSalePrice); });
    linesHost.querySelectorAll("[data-remove-purchase-line]").forEach((button) => button.addEventListener("click", () => { lines.splice(Number(button.dataset.removePurchaseLine), 1); renderLines(); }));
  };
  const addPurchaseProduct = (product) => { if (!product || lines.some((line) => line.productId === product.id)) { showToast("المنتج موجود بالفعل في فاتورة الشراء.", "error"); return false; } lines.push(makePurchaseLine(product)); search.value = ""; renderResults(); renderLines(); return true; };
  const renderResults = (query = "") => { const normalized = query.trim().toLocaleLowerCase("ar"); const matches = state.products.filter((product) => !normalized || [product.name, product.barcode, product.internalCode].some((value) => value?.toLocaleLowerCase("ar").includes(normalized))).slice(0, 6); results.innerHTML = normalized ? (matches.length ? matches.map((product) => `<button type="button" data-add-purchase-product="${product.id}"><span><strong>${escapeHtml(product.name)}</strong><small dir="auto">${escapeHtml(product.barcode || product.internalCode || "دون رمز")}</small></span><span>${money(product.purchasePrice)} للحبة</span>${msymbol("add", "text-[18px]")}</button>`).join("") : `<p>لا يوجد منتج مطابق.</p>`) : ""; results.querySelectorAll("[data-add-purchase-product]").forEach((button) => button.addEventListener("click", () => addPurchaseProduct(state.products.find((item) => item.id === button.dataset.addPurchaseProduct)))); };
  const openPurchaseScanner = () => openScannerOverlay({ title: "مسح باركود للشراء", description: "ضع الباركود داخل الإطار لإضافة المنتج إلى فاتورة الشراء. يمكنك دائمًا البحث بالاسم أو الكود الداخلي.", unsupportedMessage: "استخدم خانة البحث أعلى الفاتورة للبحث بالاسم أو الكود الداخلي، أو أعد المحاولة بعد منح إذن الكاميرا.", manualMode: null, onManualEntry: () => { closeScannerDialog(); search.focus(); }, onDetected: async (code) => { const product = await db.findProductByBarcode(code); if (!product) { closeScannerDialog(); search.value = code; renderResults(code); showToast("لم نجد هذا الباركود. ابحث بالكود الداخلي أو أضف منتجًا جديدًا.", "error"); return true; } const added = addPurchaseProduct(product); if (added) showToast(`أُضيف ${product.name} إلى فاتورة الشراء`); return true; } });
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog)); search.addEventListener("input", (event) => renderResults(event.target.value)); overlay.querySelector("#purchase-scan-product").addEventListener("click", openPurchaseScanner); overlay.querySelector("#purchase-new-product").addEventListener("click", () => { const nextDraft = getDraft(); closeDialog(); openPurchaseProductDialog(nextDraft); }); form.querySelectorAll("[name=paymentType]").forEach((input) => input.addEventListener("change", () => syncPurchase({ resetPaid: form.paymentType.value === "آجل" }))); paidInput.addEventListener("input", () => { paidInput.dataset.userEdited = "true"; syncPurchase(); }); renderLines();
  form.addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(form)); await db.createPurchase({ ...values, items: lines }); await refresh(); closeDialog(); state.view = "purchases"; render(); showToast("تم حفظ فاتورة الشراء وزيادة المخزون"); } catch (error) { showToast(error.message, "error"); } });
}

function openPurchaseProductDialog(draft) {
  const initialLabels = packageFieldLabels("كرتون"); const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">ضمن فاتورة شراء</span><h2>إضافة منتج جديد</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="purchase-product-form" class="form-grid"><label>اسم المنتج<input name="name" required dir="rtl" autofocus /></label><label class="barcode-field">الباركود<div class="barcode-field__control"><input id="purchase-product-barcode" name="barcode" dir="ltr" inputmode="numeric" autocomplete="off" /><button id="scan-purchase-product-barcode" class="button button--secondary barcode-field__scan" type="button" aria-label="مسح باركود المنتج">${msymbol("qr_code_scanner", "text-[19px]")}<span>مسح</span></button></div><small id="purchase-product-barcode-feedback" class="barcode-feedback" aria-live="polite">اكتب الباركود أو امسحه بالكاميرا.</small></label><label>الباركود الداخلي<input name="internalCode" dir="ltr" autocomplete="off" placeholder="رمز داخلي اختياري" /></label>${categorySelectMarkup()}<label>وحدة المخزون والبيع<select name="unit">${UNITS.map((unit) => `<option value="${unit}" ${unit === "حبة" ? "selected" : ""}>${unit}</option>`).join("")}</select></label><label>نوع العبوة<select name="packageUnit">${PACKAGE_UNITS.map((unit) => `<option value="${unit}" ${unit === "كرتون" ? "selected" : ""}>${unit}</option>`).join("")}</select></label><label><span id="quick-package-quantity-label">${initialLabels.quantity}</span><input name="packageQuantity" type="number" min="0.001" step="0.001" value="1" required /></label><label><span id="quick-units-per-package-label">${initialLabels.units}</span><input name="unitsPerPackage" type="number" min="1" step="1" value="1" required /></label><label><span id="quick-package-cost-label">${initialLabels.cost}</span><input name="packageCost" type="number" min="0" step="0.01" required /></label><label><span id="quick-sale-price-label">سعر البيع للحبة</span><input name="salePrice" type="number" min="0" step="0.01" required /></label><label><span id="quick-minimum-stock-label">الحد الأدنى بالحبة</span><input name="minimumStock" type="number" min="0" step="0.001" /></label><p class="form-full scanner-session-note" id="quick-product-piece-price">سعر الحبة سيُحسب من سعر العبوة وعدد الحبات.</p><div class="dialog__actions form-full"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button type="submit" class="button button--primary">إضافة للفاتورة ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  const quickForm = overlay.querySelector("#purchase-product-form"); bindCategoryField(quickForm); const barcodeInput = overlay.querySelector("#purchase-product-barcode"); const barcodeFeedback = overlay.querySelector("#purchase-product-barcode-feedback"); const profile = businessProfile(); quickForm.unit.innerHTML = profileOptions("units", profile.defaultUnit).map((unit) => `<option value="${unit}" ${unit === profile.defaultUnit ? "selected" : ""}>${unit}</option>`).join(""); quickForm.packageUnit.innerHTML = profileOptions("packageUnits", profile.defaultPackageUnit).map((unit) => `<option value="${unit}" ${unit === profile.defaultPackageUnit ? "selected" : ""}>${unit}</option>`).join(""); quickForm.querySelector("#quick-product-piece-price").insertAdjacentHTML("beforebegin", `${isPharmacy() ? `<label>رقم التشغيلة (اختياري)<input name="batchNumber" dir="ltr" autocomplete="off" /></label>` : ""}<label>تاريخ الإنتاج<input class="native-date-input" name="productionDate" type="date" dir="ltr" /></label><label>تاريخ الانتهاء<input class="native-date-input" name="expiryDate" type="date" dir="ltr" ${isPharmacy() ? "required" : ""} /></label>`); const checkBarcode = async () => { const duplicate = await db.findProductByBarcode(barcodeInput.value); if (duplicate) { setBarcodeFeedback(barcodeFeedback, `هذا الباركود مستخدم بالفعل للمنتج: ${duplicate.name}`, "error"); return duplicate; } setBarcodeFeedback(barcodeFeedback, barcodeInput.value.trim() ? "الباركود متاح للحفظ." : "اكتب الباركود أو امسحه بالكاميرا.", barcodeInput.value.trim() ? "success" : "neutral"); return null; }; const refreshQuickPrice = () => { const math = calculatePackagePurchase(Object.fromEntries(new FormData(quickForm))); const labels = packageFieldLabels(quickForm.packageUnit.value, quickForm.unit.value); overlay.querySelector("#quick-product-piece-price").textContent = `${labels.summary}: ${money(math.unitCost)} · الكمية التي ستدخل المخزون: ${amount(math.quantity)} ${quickForm.unit.value}`; }; const syncQuickPackageLabels = () => { const labels = packageFieldLabels(quickForm.packageUnit.value, quickForm.unit.value); overlay.querySelector("#quick-package-quantity-label").textContent = labels.quantity; overlay.querySelector("#quick-units-per-package-label").textContent = labels.units; overlay.querySelector("#quick-package-cost-label").textContent = labels.cost; overlay.querySelector("#quick-sale-price-label").textContent = labels.salePrice; overlay.querySelector("#quick-minimum-stock-label").textContent = labels.minimumStock; overlay.querySelector("#quick-product-piece-price").textContent = `${labels.summary} سيُحسب من ${labels.cost} وعدد ${packageFieldLabels(quickForm.packageUnit.value, quickForm.unit.value).quantity.replace(/^عدد /, "")}.`; }; quickForm.packageUnit.addEventListener("change", syncQuickPackageLabels); quickForm.unit.addEventListener("change", () => { syncQuickPackageLabels(); refreshQuickPrice(); }); quickForm.querySelectorAll("[name=packageQuantity],[name=unitsPerPackage],[name=packageCost]").forEach((input) => input.addEventListener("input", refreshQuickPrice)); syncQuickPackageLabels(); refreshQuickPrice();
  barcodeInput.addEventListener("blur", () => { checkBarcode().catch((error) => showToast(error.message, "error")); }); overlay.querySelector("#scan-purchase-product-barcode").addEventListener("click", () => openScannerOverlay({ title: "مسح باركود المنتج", description: "ضع الباركود داخل الإطار ليُضاف إلى المنتج الجديد في فاتورة الشراء.", unsupportedMessage: "أدخل الباركود يدويًا ثم تابع إضافة المنتج.", manualMode: null, onManualEntry: () => { closeScannerDialog(); barcodeInput.focus(); }, onDetected: async (code) => { barcodeInput.value = code; await checkBarcode(); return true; } }));
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog)); quickForm.addEventListener("submit", async (event) => { event.preventDefault(); try { const values = Object.fromEntries(new FormData(event.currentTarget)); if (values.category === "__custom__") values.category = String(values.customCategory || "").trim() || "أخرى"; if (await checkBarcode()) return; const math = calculatePackagePurchase(values); if (math.packageQuantity <= 0 || math.unitsPerPackage <= 0) throw new Error("أدخل عدد العبوات ووحدات المخزون بصورة صحيحة."); const product = await db.createProduct({ ...values, quantity: 0, purchasePrice: math.unitCost, purchasePackageUnit: values.packageUnit, lastPackageCost: math.packageCost }); await refresh(); closeDialog(); draft.lines.push({ productId: product.id, productName: product.name, unit: product.unit, packageUnit: values.packageUnit, salePrice: values.salePrice, batchNumber: values.batchNumber || "", productionDate: values.productionDate || "", expiryDate: values.expiryDate || "", ...math }); openPurchaseDialog(draft); } catch (error) { showToast(error.message, "error"); } });
}

async function shareOrDownloadFile(file, title) {
  if (typeof navigator.share === "function") {
    try {
      if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] })) { await navigator.share({ title, files: [file] }); return "shared"; }
    } catch (error) { if (error?.name === "AbortError") throw error; }
  }
  downloadBinaryFile(file, file.name, file.type);
  return "downloaded";
}

function normalizePurchaseSalePrices(purchase) {
  return { ...purchase, items: (purchase.items || []).map((item) => { const product = state.products.find((candidate) => candidate.id === item.productId); const salePrice = item.salePrice === undefined || item.salePrice === "" ? (product?.salePrice ?? 0) : item.salePrice; return { ...item, salePrice: Math.max(0, toNumber(salePrice)) }; }) };
}

async function sharePurchasePdf(purchase) {
  showToast("جاري تجهيز فاتورة الشراء PDF...");
  const supplier = state.suppliers.find((item) => item.id === purchase.supplierId) || null;
  const normalizedPurchase = normalizePurchaseSalePrices(purchase);
  const purchaseForPdf = { ...normalizedPurchase, supplierPhone: supplier?.phone || "", supplierAddress: supplier?.address || "" };
  const html = renderPurchaseInvoiceHtml({ purchase: purchaseForPdf, supplier, storeName: storeDisplayName(), storeInfo: state.settings, logoDataUrl: storeLogoDataUrl() || storeLogoUrl(), formatMoney: money, formatAmount: amount, formatDateTime: dateTime, escapeHtml });
  const result = await shareOrDownloadPurchaseInvoicePdf({ purchase: purchaseForPdf, supplier, html, storeName: storeDisplayName(), storeInfo: state.settings, logoDataUrl: storeLogoDataUrl() || storeLogoUrl(), formatMoney: money, formatAmount: amount, formatDateTime: dateTime, filename: `${purchase.invoiceNumber}.pdf`, title: `فاتورة شراء ${purchase.invoiceNumber}` });
  showToast(result === "shared" ? "تمت مشاركة فاتورة الشراء PDF." : "تم تنزيل فاتورة الشراء PDF.");
}

function printPurchaseInvoice(purchase) {
  const supplier = state.suppliers.find((item) => item.id === purchase.supplierId) || null;
  const normalizedPurchase = normalizePurchaseSalePrices(purchase);
  const purchaseForPrint = { ...normalizedPurchase, supplierPhone: supplier?.phone || "", supplierAddress: supplier?.address || "" };
  const html = renderPurchaseInvoiceHtml({ purchase: purchaseForPrint, supplier, storeName: storeDisplayName(), storeInfo: state.settings, logoDataUrl: storeLogoDataUrl() || storeLogoUrl(), formatMoney: money, formatAmount: amount, formatDateTime: dateTime, escapeHtml });
  if (!printHtmlDocument({ html, target: "hesabi-purchase-invoice", features: "width=900,height=760" })) showToast("السماح بالنوافذ المنبثقة مطلوب للطباعة.", "error");
  else showToast("تم إرسال فاتورة الشراء للطباعة.");
}

async function exportPurchaseExcel(purchase) {
  showToast("جاري تجهيز فاتورة الشراء Excel...");
  const supplier = state.suppliers.find((item) => item.id === purchase.supplierId) || null;
  const normalizedPurchase = normalizePurchaseSalePrices(purchase);
  const purchaseForExport = { ...normalizedPurchase, supplierPhone: supplier?.phone || "", supplierAddress: supplier?.address || "" };
  const file = new File([createPurchaseWorkbook(purchaseForExport)], `${purchase.invoiceNumber}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const result = await shareOrDownloadFile(file, `فاتورة شراء ${purchase.invoiceNumber}`);
  showToast(result === "shared" ? "تمت مشاركة فاتورة الشراء Excel." : "تم تنزيل فاتورة الشراء Excel.");
}

function openPurchaseDetail(purchase) {
  if (!purchase) return;
  const displayPurchase = normalizePurchaseSalePrices(purchase);
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">فاتورة شراء محفوظة</span><h2>${displayPurchase.invoiceNumber}</h2><p class="dialog__subtext">${escapeHtml(displayPurchase.supplierName)} · ${dateTime(displayPurchase.date)}</p></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="invoice-detail">${displayPurchase.items.map((item) => `<div><span><strong>${escapeHtml(item.productName)}</strong><small>${item.packageQuantity ? `${amount(item.packageQuantity)} ${escapeHtml(item.packageUnit || "عبوة")} × ${money(item.packageCost)} · ` : ""}${amount(item.quantity)} ${escapeHtml(item.unit)} · سعر الحبة ${money(item.unitCost)} · سعر البيع ${money(item.salePrice)}${item.batchNumber ? ` · التشغيلة ${escapeHtml(item.batchNumber)}` : ""}${toNumber(item.returnedQuantity) ? ` · مرتجع ${amount(item.returnedQuantity)}` : ""}</small></span><strong>${money(item.total)}</strong></div>`).join("")}<div class="invoice-detail__final"><span>الإجمالي</span><strong>${money(displayPurchase.total)}</strong></div><div class="invoice-detail__final"><span>المبلغ المدفوع</span><strong>${money(displayPurchase.paidAmount)}</strong></div><div class="invoice-detail__final"><span>المتبقي للمورد</span><strong>${money(displayPurchase.remainingAmount)}</strong></div></div><div class="dialog__actions"><button id="print-purchase-invoice" class="button button--secondary" type="button">طباعة</button><button id="share-purchase-pdf" class="button button--secondary" type="button">مشاركة PDF</button><button id="export-purchase-excel" class="button button--secondary" type="button">مشاركة Excel</button><button id="purchase-return" class="button button--secondary" type="button">مرتجع شراء ${msymbol("assignment_return", "text-[19px]")}</button><button class="button button--primary" data-dialog-close>إغلاق</button></div></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#print-purchase-invoice").addEventListener("click", () => { try { printPurchaseInvoice(purchase); } catch (error) { showToast(error.message || "تعذر تجهيز الطباعة.", "error"); } });
  overlay.querySelector("#share-purchase-pdf").addEventListener("click", () => sharePurchasePdf(purchase).catch((error) => showToast(error.message || "تعذر تجهيز PDF.", "error")));
  overlay.querySelector("#export-purchase-excel").addEventListener("click", () => exportPurchaseExcel(purchase).catch((error) => showToast(error.message || "تعذر تجهيز ملف Excel.", "error")));
  overlay.querySelector("#purchase-return").addEventListener("click", () => { closeDialog(); openPurchaseReturnDialog(purchase.id); });
}

async function openPurchaseReturnDialog(purchaseId) {
  const purchase = await db.getPurchase(purchaseId); if (!purchase) return;
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">مرتجع شراء</span><h2>${purchase.invoiceNumber}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="purchase-return-form" class="return-form">${purchase.items.map((item) => { const max = Math.max(0, toNumber(item.quantity) - toNumber(item.returnedQuantity)); return `<div class="return-line"><span><strong>${escapeHtml(item.productName)}</strong><small>المتاح للإرجاع: ${amount(max)}</small></span>${quantityControlMarkup({ value: "", min: 0, max, step: "0.001", inputAttrs: `name=\"${item.id}\"` })}</div>`; }).join("")}<label>ملاحظات<textarea name="notes" dir="rtl"></textarea></label><div class="dialog__actions"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button type="submit" class="button button--primary">تسجيل المرتجع ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelectorAll(".quantity-control").forEach((control) => bindQuantityControl(control, { min: 0, max: toNumber(control.querySelector("input").max), step: 0.001, onChange: () => {} }));
  overlay.querySelector("#purchase-return-form").addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await db.createPurchaseReturn({ purchaseId, notes: data.get("notes"), items: purchase.items.map((item) => ({ purchaseItemId: item.id, quantity: data.get(item.id) })) }); await refresh(); closeDialog(); render(); showToast("تم حفظ مرتجع الشراء وتحديث المخزون"); } catch (error) { showToast(error.message, "error"); } });
}

async function openSaleReturnDialog(saleId) {
  const invoice = await db.getInvoice(saleId); if (!invoice) return;
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">مرتجع بيع</span><h2>${invoice.invoiceNumber}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><form id="sale-return-form" class="return-form">${invoice.items.map((item) => { const max = Math.max(0, toNumber(item.quantity) - toNumber(item.returnedQuantity)); return `<div class="return-line"><span><strong>${escapeHtml(item.productName)}</strong><small>المتاح للإرجاع: ${amount(max)}</small></span>${quantityControlMarkup({ value: "", min: 0, max, step: "0.001", inputAttrs: `name=\"${item.id}\"` })}</div>`; }).join("")}<label>ملاحظات<textarea name="notes" dir="rtl"></textarea></label><div class="dialog__actions"><button type="button" class="button button--secondary" data-dialog-close>إلغاء</button><button type="submit" class="button button--primary">تسجيل المرتجع ${msymbol("check", "text-[19px]")}</button></div></form></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelectorAll(".quantity-control").forEach((control) => bindQuantityControl(control, { min: 0, max: toNumber(control.querySelector("input").max), step: 0.001, onChange: () => {} }));
  overlay.querySelector("#sale-return-form").addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await db.createSaleReturn({ saleId, notes: data.get("notes"), items: invoice.items.map((item) => ({ saleItemId: item.id, quantity: data.get(item.id) })) }); await refresh(); closeDialog(); render(); showToast("تم حفظ مرتجع البيع وزيادة المخزون"); } catch (error) { showToast(error.message, "error"); } });
}

function openStockHistoryDialog(productId = "") {
  const products = new Map(state.products.map((product) => [product.id, product])); const movements = state.stockMovements.filter((movement) => !productId || movement.productId === productId);
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">سجل حركة المخزون</span><h2>${productId ? escapeHtml(products.get(productId)?.name || "المنتج") : "كل الحركات"}</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><div class="movement-list">${movements.length ? movements.map((movement) => `<article><div><strong>${escapeHtml(products.get(movement.productId)?.name || "منتج محذوف")}</strong><small>${dateTime(movement.date)} · ${escapeHtml(movement.type)}</small></div><div><strong class="movement-amount ${toNumber(movement.quantity) >= 0 ? "is-positive" : "is-negative"}">${toNumber(movement.quantity) >= 0 ? "+" : ""}${amount(movement.quantity)}</strong><small>${amount(movement.previousQuantity)} ← ${amount(movement.newQuantity)}</small></div></article>`).join("") : `<div class="inline-empty">لا توجد حركات مسجلة.</div>`}</div><div class="dialog__actions"><button class="button button--primary button--wide" data-dialog-close>إغلاق</button></div></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
}

async function openScannedProduct(product, mode) {
  closeScannerDialog(); closeDialog();
  if (mode === "sale") { addToCart(product.id); showToast(`أُضيف ${product.name} إلى السلة`); } else openProductDialog(product);
  return true;
}

async function findInternalCode(code, mode, { keepScannerOpen = false } = {}) {
  const product = await db.findProductByInternalCode(code);
  if (product) return openScannedProduct(product, mode);
  if (!keepScannerOpen) showToast("لم نجد هذا الكود الداخلي. تحقق منه أو أعد المسح.", "error");
  return false;
}

async function findBarcode(code, mode) {
  const product = await db.findProductByBarcode(code);
  if (product) return openScannedProduct(product, mode);
  closeScannerDialog();
  closeDialog();
  const overlay = openDialog(`<div class="stitch-dialog"><div class="dialog__head"><div><span class="eyebrow">نتيجة المسح</span><h2>الباركود غير مسجل</h2></div><button class="icon-button" data-dialog-close aria-label="إغلاق">${msymbol("close", "text-[20px]")}</button></div><p class="dialog__subtext">لم نجد الباركود <strong>${escapeHtml(code)}</strong>. ابحث بالكود الداخلي للمنتج أو أعد المسح.</p><form id="unknown-barcode-form" class="manual-barcode"><input name="internalCode" required dir="ltr" autocomplete="off" placeholder="أدخل الكود الداخلي" aria-label="البحث بالكود الداخلي" /><button class="button button--secondary" type="submit">ابحث</button></form><div class="dialog__actions"><button class="button button--secondary" id="retry-unknown-barcode" type="button">${msymbol("qr_code_scanner", "text-[18px]")} إعادة المسح</button><button class="button button--secondary" data-dialog-close>إلغاء</button><button class="button button--primary" id="create-from-barcode">إنشاء منتج ${msymbol("add", "text-[18px]")}</button></div></div>`);
  overlay.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", closeDialog));
  overlay.querySelector("#unknown-barcode-form").addEventListener("submit", (event) => { event.preventDefault(); findInternalCode(new FormData(event.currentTarget).get("internalCode"), mode); });
  overlay.querySelector("#retry-unknown-barcode").addEventListener("click", () => { closeDialog(); openScanner(mode); });
  overlay.querySelector("#create-from-barcode").addEventListener("click", () => openProductDialog(null, code));
  return false;
}

function setBarcodeFeedback(element, message, tone = "neutral") {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
}

function notifyBarcodeRead() {
  if (navigator.vibrate) navigator.vibrate(45);
}

function hasBarcodeScannerSupport() {
  return "BarcodeDetector" in window && typeof window.BarcodeDetector === "function" && Boolean(navigator.mediaDevices?.getUserMedia);
}

async function getBarcodeFormats() {
  const requested = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];
  if (typeof window.BarcodeDetector?.getSupportedFormats !== "function") return requested;
  const supported = await window.BarcodeDetector.getSupportedFormats();
  const formats = requested.filter((format) => supported.includes(format));
  return formats.length ? formats : requested;
}

function scannerDialogMarkup(title, description, continuous = false) {
  return `<section class="scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="scanner-title"><div class="dialog__head"><div><span class="eyebrow">ماسح الباركود</span><h2 id="scanner-title">${title}</h2></div><button class="icon-button" id="scanner-close" aria-label="${continuous ? "إنهاء المسح" : "إغلاق"}">${msymbol("close", "text-[20px]")}</button></div><p class="dialog__subtext">${description}</p>${continuous ? `<p class="scanner-session-note">المسح المتواصل مفعّل: أبعد الرمز عن الإطار بعد إضافته ثم امسح المنتج التالي.</p>` : ""}<div id="scanner-content"></div><div class="scanner-dialog__actions"><button id="scanner-retry" class="button button--secondary" type="button">${msymbol("qr_code_scanner", "text-[17px]")} إعادة المحاولة</button><button id="scanner-close-bottom" class="button button--primary" type="button">${continuous ? "إنهاء المسح" : "إغلاق"}</button></div></section>`;
}

function closeScannerDialog() {
  stopScanner();
  document.querySelector("#scanner-backdrop")?.remove();
}

let scannerSuccessAudioContext;
function getScannerSuccessAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  return scannerSuccessAudioContext ||= new AudioContextConstructor();
}
function primeScannerSuccessSound() {
  try {
    const context = getScannerSuccessAudioContext();
    if (context && context.state === "suspended") {
      context.resume().catch(() => {});
    }
  } catch { /* لا تمنع قيود الصوت بدء الماسح. */ }
}
function playScannerSuccessSound() {
  try {
    const context = getScannerSuccessAudioContext();
    if (context) {
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }
      const startAt = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      // صافرة ماسح الباركود الحقيقي للكاشير (تردد 2650 هرتز - صوت أجهزة Zebra و Honeywell الدقيقة)
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(2650, startAt);

      // منحنى صوتي فوري وحاد يحاكي صوت الباركود في آلات الكاشير الحقيقية بدقة
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(0.35, startAt + 0.002);
      gain.gain.setValueAtTime(0.35, startAt + 0.055);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.075);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.08);
    }
  } catch { /* لا يؤثر غياب الصوت في مسار المسح أو الإدخال اليدوي. */ }
  try {
    if (navigator.vibrate) navigator.vibrate(45);
  } catch {}
}

function installAudioUnlockListener() {
  const unlock = () => {
    primeScannerSuccessSound();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("click", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true, once: true });
  window.addEventListener("touchstart", unlock, { passive: true, once: true });
  window.addEventListener("click", unlock, { passive: true, once: true });
}

function openScannerOverlay({ title, description, onDetected, unsupportedMessage, manualMode, onManualEntry = null, continuous = false }) {
  closeScannerDialog();
  primeScannerSuccessSound();
  const overlay = document.createElement("div");
  overlay.id = "scanner-backdrop";
  overlay.className = "scanner-backdrop";
  overlay.innerHTML = scannerDialogMarkup(title, description, continuous);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeScannerDialog(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-open"));
  overlay.querySelector("#scanner-close").addEventListener("click", closeScannerDialog);
  overlay.querySelector("#scanner-close-bottom").addEventListener("click", closeScannerDialog);
  overlay.querySelector("#scanner-retry").addEventListener("click", () => startCameraScanner(overlay, onDetected, unsupportedMessage, manualMode, onManualEntry, continuous));
  startCameraScanner(overlay, onDetected, unsupportedMessage, manualMode, onManualEntry, continuous);
}

function renderUnsupportedScanner(overlay, message, manualMode, onManualEntry) {
  stopScanner();
  const content = overlay.querySelector("#scanner-content");
  overlay.querySelector("#scanner-retry").hidden = false;
  content.innerHTML = `<div class="scanner-notice scanner-notice--neutral">${msymbol("warning", "text-[20px]")}<div><strong>ماسح الباركود غير مدعوم على هذا المتصفح</strong><span>${message}</span></div></div>${manualMode ? `<form id="manual-barcode-form" class="manual-barcode"><input name="internalCode" required dir="ltr" autocomplete="off" placeholder="أدخل الكود الداخلي" autofocus /><button class="button button--primary" type="submit">ابحث</button></form>` : onManualEntry ? `<button id="scanner-manual-entry" class="button button--primary button--wide" type="button">البحث بالكود الداخلي</button>` : ""}`;
  content.querySelector("#manual-barcode-form")?.addEventListener("submit", (event) => { event.preventDefault(); findInternalCode(new FormData(event.currentTarget).get("internalCode"), manualMode, { keepScannerOpen: true }); });
  content.querySelector("#scanner-manual-entry")?.addEventListener("click", onManualEntry);
}

async function applyScannerTrackConstraint(session, advanced) {
  if (!session?.track?.applyConstraints || state.scanner !== session) return false;
  try { await session.track.applyConstraints({ advanced: [advanced] }); return true; }
  catch { return false; }
}

function addScannerCameraAssist(content, session, video) {
  const track = session.stream?.getVideoTracks?.()[0];
  if (!track) return;
  const capabilities = typeof track.getCapabilities === "function" ? track.getCapabilities() || {} : {};
  const settings = typeof track.getSettings === "function" ? track.getSettings() || {} : {};
  const assist = getCameraAssistOptions(capabilities, settings);
  session.track = track;
  if (assist.canUseContinuousFocus) applyScannerTrackConstraint(session, { focusMode: "continuous" });
  const quickActions = [];
  if (assist.canZoom) quickActions.push(`<button class="scanner-assist__action" data-scanner-adjustment="zoom" type="button">تكبير</button>`);
  if (assist.canUseManualFocus) quickActions.push(`<button class="scanner-assist__action" data-scanner-adjustment="focus" type="button">فوكِس</button>`);
  if (assist.canUseTorch) quickActions.push(`<button id="scanner-torch" class="scanner-assist__action" type="button">إضاءة</button>`);
  const assistSlot = content.querySelector("#scanner-assist-slot");
  if (!quickActions.length || !assistSlot) return;
  assistSlot.innerHTML = `<div class="scanner-assist"><div class="scanner-assist__quick"><span>${msymbol("qr_code_scanner", "text-[16px]")} تحسين القراءة</span><div>${quickActions.join("")}</div></div><div id="scanner-adjustment" class="scanner-adjustment" hidden></div></div>`;
  const adjustment = assistSlot.querySelector("#scanner-adjustment");
  const renderAdjustment = (kind) => {
    const shouldClose = adjustment.dataset.kind === kind && !adjustment.hidden;
    adjustment.hidden = shouldClose;
    assistSlot.querySelectorAll("[data-scanner-adjustment]").forEach((button) => button.classList.toggle("is-active", !shouldClose && button.dataset.scannerAdjustment === kind));
    if (shouldClose) return;
    adjustment.dataset.kind = kind;
    if (kind === "zoom") {
      adjustment.innerHTML = `<label>تكبير القراءة <input id="scanner-zoom" type="range" min="${assist.zoomMin}" max="${assist.zoomMax}" step="${assist.zoomStep}" value="${assist.zoomValue}" aria-label="تكبير الكاميرا" /><output id="scanner-zoom-value">${assist.zoomValue}×</output></label>`;
      adjustment.querySelector("#scanner-zoom").addEventListener("input", async (event) => {
        const value = Number(event.currentTarget.value);
        if (await applyScannerTrackConstraint(session, { zoom: value })) adjustment.querySelector("#scanner-zoom-value").value = `${value}×`;
      });
      return;
    }
    adjustment.innerHTML = `<label>فوكِس يدوي <input id="scanner-focus" type="range" min="${assist.focusMin}" max="${assist.focusMax}" step="${assist.focusStep}" value="${assist.focusValue}" aria-label="ضبط فوكس الكاميرا" /><output id="scanner-focus-value">تلقائي</output></label>${assist.canUseContinuousFocus ? `<button id="scanner-focus-auto" class="scanner-adjustment__auto" type="button">فوكِس تلقائي</button>` : ""}`;
    adjustment.querySelector("#scanner-focus").addEventListener("input", async (event) => {
      const value = Number(event.currentTarget.value);
      if (!await applyScannerTrackConstraint(session, { focusMode: "manual", focusDistance: value })) return;
      session.manualFocus = true;
      adjustment.querySelector("#scanner-focus-value").value = "يدوي";
    });
    adjustment.querySelector("#scanner-focus-auto")?.addEventListener("click", async () => {
      if (!await applyScannerTrackConstraint(session, { focusMode: "continuous" })) return;
      session.manualFocus = false;
      adjustment.querySelector("#scanner-focus-value").value = "تلقائي";
    });
  };
  assistSlot.querySelectorAll("[data-scanner-adjustment]").forEach((button) => button.addEventListener("click", () => renderAdjustment(button.dataset.scannerAdjustment)));
  content.querySelector("#scanner-torch")?.addEventListener("click", async (event) => {
    const nextState = !session.torchOn;
    if (!await applyScannerTrackConstraint(session, { torch: nextState })) return;
    session.torchOn = nextState;
    event.currentTarget.classList.toggle("is-active", nextState);
    event.currentTarget.textContent = nextState ? "إضاءة مفعّلة" : "إضاءة";
  });
  video.addEventListener("click", () => { if (assist.canUseContinuousFocus && !session.manualFocus) applyScannerTrackConstraint(session, { focusMode: "continuous" }); });
}

async function startCameraScanner(overlay, onDetected, unsupportedMessage, manualMode, onManualEntry = null, continuous = false) {
  if (!hasBarcodeScannerSupport()) { renderUnsupportedScanner(overlay, unsupportedMessage, manualMode, onManualEntry); return; }
  stopScanner();
  const content = overlay.querySelector("#scanner-content");
  const retry = overlay.querySelector("#scanner-retry");
  retry.hidden = false;
  content.innerHTML = `<div class="scanner-box"><video id="scanner-video" autoplay muted playsinline></video><div class="scanner-box__guide"><span>ضع الباركود داخل الإطار وثبّت الجوال</span></div></div><div id="scanner-status" class="scanner-status">${msymbol("qr_code_scanner", "text-[17px]")}<span>وجّه الكاميرا نحو الباركود</span></div><div id="scanner-assist-slot"></div>${manualMode ? `<form id="manual-barcode-form" class="manual-barcode"><input name="internalCode" required dir="ltr" autocomplete="off" placeholder="أدخل الكود الداخلي" /><button class="button button--secondary" type="submit">ابحث</button></form>` : ""}`;
  content.querySelector("#manual-barcode-form")?.addEventListener("submit", (event) => { event.preventDefault(); findInternalCode(new FormData(event.currentTarget).get("internalCode"), manualMode, { keepScannerOpen: true }); });
  try {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia(getScannerCameraConstraints()); }
    catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
    const video = content.querySelector("#scanner-video");
    video.srcObject = stream;
    await video.play();
    const detector = new window.BarcodeDetector({ formats: await getBarcodeFormats() });
    const session = { stream, frame: null, reading: false, overlay, continuous, lastCode: "", absentSince: 0, lastScanAt: 0, track: null, torchOn: false, manualFocus: false };
    state.scanner = session;
    addScannerCameraAssist(content, session, video);
    const scanFrame = async () => {
      if (state.scanner !== session || !overlay.isConnected) return;
      const now = Date.now();
      if (!session.reading && now - session.lastScanAt >= CAMERA_SCAN_INTERVAL_MS && video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        session.lastScanAt = now;
        try {
          const codes = await detector.detect(video);
          const code = codes[0]?.rawValue?.trim();
          if (code) {
            session.absentSince = 0;
            if (continuous && !isNewContinuousBarcode(session.lastCode, code)) { session.frame = requestAnimationFrame(scanFrame); return; }
            session.reading = true;
            playScannerSuccessSound();
            if (!continuous) stopScanner();
            const closeAfterRead = await onDetected(code, overlay, { continuous });
            if (continuous && closeAfterRead === false && state.scanner === session && overlay.isConnected) {
              session.lastCode = code;
              session.reading = false;
              session.frame = requestAnimationFrame(scanFrame);
              return;
            }
            if (closeAfterRead !== false) closeScannerDialog();
            return;
          } else if (continuous && session.lastCode) {
            session.absentSince ||= Date.now();
            if (shouldReleaseContinuousBarcode(session.lastCode, session.absentSince)) {
              session.lastCode = "";
              session.absentSince = 0;
            }
          }
        } catch (error) { console.warn("تعذر تحليل الباركود", error); }
      }
      if (state.scanner === session) session.frame = requestAnimationFrame(scanFrame);
    };
    session.frame = requestAnimationFrame(scanFrame);
  } catch (error) {
    content.innerHTML = `<div class="scanner-notice scanner-notice--error">${msymbol("warning", "text-[20px]")}<div><strong>تعذر فتح الكاميرا</strong><span>تحقق من الإذن، ثم أعد المحاولة، أو ابحث بالكود الداخلي.</span></div></div>${manualMode ? `<form id="manual-barcode-form" class="manual-barcode"><input name="internalCode" required dir="ltr" autocomplete="off" placeholder="أدخل الكود الداخلي" autofocus /><button class="button button--primary" type="submit">ابحث</button></form>` : onManualEntry ? `<button id="scanner-manual-entry" class="button button--primary button--wide" type="button">البحث بالكود الداخلي</button>` : ""}`;
    content.querySelector("#manual-barcode-form")?.addEventListener("submit", (event) => { event.preventDefault(); findInternalCode(new FormData(event.currentTarget).get("internalCode"), manualMode, { keepScannerOpen: true }); });
    content.querySelector("#scanner-manual-entry")?.addEventListener("click", onManualEntry);
  }
}

function openProductBarcodeScanner({ barcodeInput, barcodeFeedback, product }) {
  openScannerOverlay({
    title: "مسح باركود المنتج",
    description: "ضع الباركود داخل الإطار. لن تفقد أي بيانات أدخلتها في نموذج المنتج.",
    unsupportedMessage: "يبقى حقل الباركود في نموذج المنتج متاحًا للإدخال اليدوي.",
    manualMode: null,
    onManualEntry: () => { closeScannerDialog(); barcodeInput.focus(); },
    onDetected: async (code, overlay) => {
      const duplicate = await db.findProductByBarcode(code, product?.id);
      if (duplicate) {
        setBarcodeFeedback(barcodeFeedback, `هذا الباركود مستخدم بالفعل للمنتج: ${duplicate.name}`, "error");
        overlay.querySelector("#scanner-status").innerHTML = `${msymbol("warning", "text-[17px]")}<span>هذا الباركود مستخدم بالفعل. اختر إعادة المحاولة.</span>`;
        overlay.querySelector("#scanner-status").dataset.tone = "error";
        return false;
      }
      barcodeInput.value = code;
      setBarcodeFeedback(barcodeFeedback, "تم قراءة الباركود وهو متاح للحفظ.", "success");
      notifyBarcodeRead();
      showToast("تم قراءة الباركود");
      return true;
    },
  });
}

function openScanner(mode) {
  const continuous = mode === "sale";
  openScannerOverlay({
    title: continuous ? "مسح منتجات متواصل" : "وجّه الكاميرا نحو الباركود",
    description: continuous ? "أضف عدة منتجات إلى السلة في جلسة واحدة، ثم اختر «إنهاء المسح» عند الانتهاء." : "سنفتح المنتج المسجل مباشرة أو نقترح إنشاء منتج جديد عند عدم العثور عليه.",
    unsupportedMessage: "يمكنك البحث بالكود الداخلي أو الضغط على إعادة المحاولة بعد منح إذن الكاميرا.",
    manualMode: mode,
    onManualEntry: () => {
      const manualForm = document.querySelector("#scanner-backdrop #manual-barcode-form");
      manualForm?.querySelector("input")?.focus();
    },
    continuous,
    onDetected: async (code, overlay, options) => {
      if (!options.continuous) { await findBarcode(code, mode); return true; }
      const product = await db.findProductByBarcode(code);
      if (!product) { await findBarcode(code, mode); return true; }
      const added = addToCart(product.id);
      const status = overlay.querySelector("#scanner-status");
      status.innerHTML = `${icon(added ? "check" : "alert", 16)}<span>${added ? `أُضيف ${escapeHtml(product.name)}. امسح المنتج التالي.` : `تعذر إضافة ${escapeHtml(product.name)} بسبب حد المخزون.`}</span>`;
      status.dataset.tone = added ? "success" : "error";
      if (added) { notifyBarcodeRead(); showToast(`أُضيف ${product.name} إلى السلة`); }
      return false;
    },
  });
}

function stopScanner() {
  if (!state.scanner) return;
  if (state.scanner.frame) cancelAnimationFrame(state.scanner.frame);
  state.scanner.stream?.getTracks().forEach((track) => track.stop());
  state.scanner = null;
}

export async function bootApp(target) {
  root = target;
  installDesktopIntegration();
  installRuntimeGuards();
  installDesktopBarcodeReader();
  installAudioUnlockListener();
  try { await db.open(); state.settings = await db.getSettings(); state.accounts = await db.listAccounts(); state.currentUser = state.settings?.setupCompleted ? await db.getPersistentSession() : null; try { state.cloud.user = await getCloudBackupUser(); } catch { state.cloud.user = null; } try { state.cloud.identity = await getCloudDeviceIdentity(); } catch { state.cloud.identity = null; } if (!state.cloud.identity && state.cloud.user && isAdmin(state.currentUser)) { try { await ensureAdminCloudWorkspace(); } catch (error) { console.warn("[Hesabi cloud workspace unavailable]", error); } } if (state.cloud.identity?.role === "admin" && state.settings?.cloudStoreId) { try { await watchAssistantRequests(state.settings.cloudStoreId, (requests) => { state.cloud.pairRequests = requests; if (state.view === "data-management") render(); }); } catch (error) { console.warn("[Hesabi pairing requests unavailable]", error); } } try { await installSyncCoordinator(db, { onStatus: (status) => { state.cloud.syncStatus = status; }, onRemoteApplied: () => { void refresh().then(render); } }); } catch (error) { state.cloud.syncStatus = "offline"; console.warn("[Hesabi sync unavailable]", error); } if (state.cloud.identity && state.settings?.cloudStoreId) { try { const { renewAndRegisterPushDevice } = await import("./push-alerts.js"); state.cloud.push = await renewAndRegisterPushDevice(); } catch (error) { console.warn("[Hesabi push renew]", error?.message || error); } } applyTheme(); watchSystemTheme(); installNotificationBridge(); applyDeepLinkView(); if (state.settings?.setupCompleted) await refresh(); render(); if (state.currentUser) installAutomaticBackups(); if (state.currentUser?.role === "cashier" && !state.activeCashierShift) requestAnimationFrame(openCashierShiftStartDialog); installExitGuard(); } catch (error) { console.error("[Hesabi boot error]", error); root.innerHTML = `<main class="fatal-state"><img src="${markImage}" alt=""/><h1>تعذر فتح التخزين المحلي</h1><p>لم تُحذف بياناتك المحلية. أعد المحاولة أولًا، واستعد النسخة الاحتياطية فقط عند الحاجة.</p><button class="button button--primary" onclick="location.reload()">إعادة المحاولة</button></main>`; }
}
