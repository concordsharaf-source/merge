import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderThermalInvoiceHtml } from "../client/src/js/invoice-print.js";
import { renderCustomerAccountHtml } from "../client/src/js/customer-account-print.js";
import { randomId, shortRandomId } from "../client/src/js/ids.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);

test("ينشئ قالب الطباعة الحرارية 80 مم وفيه الفاتورة والبنود والإجمالي وطريقة السداد", () => {
  const html = renderThermalInvoiceHtml({
    storeName: "بقالة الاختبار",
    invoice: { invoiceNumber: "INV-000123", date: "2026-08-23T00:00:00.000Z", subtotal: 120, discount: 20, total: 100, paidAmount: 30, remainingAmount: 70, paymentType: "آجل", cashierName: "محمد الكاشير", customerName: "أحمد العميل", items: [{ productName: "ماء <معدني>", quantity: 2, unit: "حبة", unitPrice: 60, total: 120 }] },
    customer: { phone: "777123456", address: "صنعاء" },
    formatMoney: (value) => `${value} ر.ي`, formatAmount: (value) => String(value), formatDateTime: () => "23 أغسطس 2026", escapeHtml, paymentLabel: "دين",
  });
  assert.match(html, /@page\{size:80mm auto;margin:4mm\}/);
  assert.match(html, /INV-000123/);
  assert.match(html, /ماء &lt;معدني&gt;/);
  assert.match(html, /الإجمالي/);
  assert.match(html, /100 ر\.ي/);
  assert.match(html, /طريقة السداد/);
  assert.match(html, /دين/);
  assert.match(html, /المتبقي/);
  assert.match(html, /70 ر\.ي/);
  assert.match(html, /بيانات العميل/);
  assert.match(html, /أحمد العميل/);
  assert.match(html, /777123456/);
  assert.match(html, /صنعاء/);
  assert.match(html, /الكاشير المنفذ/);
  assert.match(html, /محمد الكاشير/);
});

test("يخصص PDF الفاتورة لرسم عربي مباشر عالي الدقة بدل صورة نص قد تتداخل حروفها", async () => {
  const [pdfExport, app] = await Promise.all([
    readFile(new URL("../client/src/js/pdf-export.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(pdfExport, /import \{ renderThermalInvoiceHtml \} from "\.\/invoice-print\.js"/);
  assert.match(pdfExport, /renderThermalInvoiceHtml\(\{ invoice, customer, storeName, logoDataUrl/);
  assert.match(pdfExport, /return createPdfFileFromHtml\(\{ html, filename, page: "thermal" \}\)/);
  assert.match(pdfExport, /createCustomerAccountPdfFile/);
  assert.match(pdfExport, /createReportPdfFile/);
  assert.match(pdfExport, /shareOrDownloadInvoicePdf/);
  assert.match(app, /await db\.getCustomer\(invoice\.customerId\)/);
  assert.match(app, /createPdfFileFromHtml\(\{ html: reportPreviewHtml\(type\)/);
  assert.match(app, /shareOrDownloadPdf\(\{ html: reportPreviewHtml\(type\)/);
  assert.match(app, /logoDataUrl: storeLogoDataUrl\(\)/);
  assert.match(app, /cashierName: state\.currentUser\?\.name \|\| "الأدمن"/);
  assert.match(app, /invoice\.cashierName \|\| "الأدمن"/);
  assert.match(pdfExport, /invoice\.cashierName \|\| "الأدمن"/);
});

test("يحصر شعار المتجر في ملف محلي آمن ويعرضه في إعدادات الأدمن والنسخة الاحتياطية", async () => {
  const [app, database, permissions, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/permissions.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /id="store-logo-file"/);
  assert.match(app, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(app, /LOCAL_STORE_LOGO_MAX_SOURCE_BYTES/);
  assert.match(app, /prepareStoreLogoDataUrl/);
  assert.match(app, /updateStoreIcon/);
  assert.match(database, /saveStoreLogoDataUrl/);
  assert.match(database, /LOCAL_STORE_LOGO_PATTERN/);
  assert.match(database, /LOCAL_STORE_LOGO_MAX_LENGTH/);
  assert.match(permissions, /"clear-store-logo"/);
  assert.match(css, /\.store-logo-settings__body/);
  assert.match(css, /\[data-theme="dark"\] \.store-logo-preview/);
});

test("يوضح شاشة البداية ويستقبل قارئ الباركود المكتبي دون اعتراض حقول الإدخال", async () => {
  const [app, css, scannerSession] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/scanner-session.js", import.meta.url), "utf8"),
  ]);
  assert.match(app, /function installDesktopBarcodeReader\(\)/);
  assert.match(app, /function handleDesktopBarcodeRead\(code\)/);
  assert.match(app, /event\.target instanceof Element/);
  assert.match(app, /document\.querySelector\("\.dialog-backdrop, #scanner-backdrop"\)/);
  assert.match(app, /desktop-barcode-reader-note/);
  assert.match(app, /installDesktopBarcodeReader\(\);/);
  assert.match(scannerSession, /DESKTOP_BARCODE_MAX_KEY_INTERVAL_MS/);
  assert.match(scannerSession, /isDesktopBarcodeWedge/);
  assert.match(scannerSession, /shouldAcceptDesktopBarcode/);
  assert.match(css, /شاشة البداية: الدفتر مرئي فوق خلفية محايدة/);
  assert.match(css, /#fbf7ec/);
  assert.match(css, /\.setup-art \{ color:#153f34; background:repeating-linear-gradient\(0deg, transparent 0 36px, rgba\(91,111,103,\.16\)/);
  assert.doesNotMatch(css, /\.setup-art \{ color:#153f34; background:repeating-linear-gradient\(0deg, transparent 0 36px, rgba\(31,107,89,\.23\)/);
  assert.match(css, /\[data-theme="dark"\] \.setup-page/);
});

test("تنزيل PDF تلقائيًا عند غياب دعم مشاركة الملفات أو فشل طلب المشاركة", async () => {
  const pdfExport = await readFile(new URL("../client/src/js/pdf-export.js", import.meta.url), "utf8");
  assert.match(pdfExport, /function downloadPdfFile\(file\)/);
  assert.match(pdfExport, /window\.setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 60_000\)/);
  assert.match(pdfExport, /function canSharePdfFile\(file\)/);
  assert.match(pdfExport, /typeof navigator\.canShare !== "function" \|\| navigator\.canShare\(\{ files: \[file\] \}\)/);
  assert.match(pdfExport, /await navigator\.share\(\{ title, files: \[file\] \}\)/);
  assert.match(pdfExport, /if \(error\?\.name === "AbortError"\) throw error/);
  assert.match(pdfExport, /downloadPdfFile\(file\);\n  return "downloaded"/);
});

test("يوثق تسليم الصندوق عند تبديل الحساب ويعرض للأدمن ورديات الكاشير وعجزها", async () => {
  const [app, database, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(database, /const DB_VERSION = 13/);
  assert.match(database, /makeIndexedStore\(database, "cashierShifts"/);
  assert.match(database, /async startCashierShift/);
  assert.match(database, /async closeCashierShift/);
  assert.match(database, /cashierShiftId: normalize\(cashierShiftId\)/);
  assert.match(app, /function openCashierShiftStartDialog\(/);
  assert.match(app, /function openCashierHandoverDialog\(/);
  assert.match(app, /function cashierShiftSummaryMarkup\(/);
  assert.match(app, /cashierShiftId: state\.activeCashierShift\?\.id \|\| ""/);
  assert.match(app, /if \(state\.view === "cashbox" && isAdmin\(state\.currentUser\)\)/);
  assert.match(css, /\.cashier-shift-row \{ display:grid;/);
});

test("تربط واجهة الحسابات راتب الموظف بسلفة أدمن وملخص الراتب الشهري وزر التسليم", async () => {
  const [app, database, permissions, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/permissions.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /name="monthlySalary"/);
  assert.match(app, /function openCashierSalaryAdvanceDialog\(/);
  assert.match(app, /data-action="new-cashier-salary-advance"/);
  assert.match(app, /function cashierSalarySummaryMarkup\(/);
  assert.match(app, /cashierSalaryAdvance: true/);
  assert.match(database, /async listCashierSalarySummaries/);
  assert.match(app, /data-action="settle-staff-salary"/);
  assert.match(database, /const staffId = \(expense\) => expense\.staffId \|\| expense\.cashierId/);
  assert.match(database, /async settleCashierSalary/);
  assert.match(database, /السلفة تتجاوز المتبقي من راتب/);
  assert.match(permissions, /"new-cashier-salary-advance"/);
  assert.match(permissions, /"settle-staff-salary"/);
  assert.match(css, /\.cashier-salary-row \{ display:grid;/);
});

test("تفصل الخزنة عن صندوق الكاشير وتدعم ترحيل الوردية وتسوية العجز من الراتب", async () => {
  const [app, database, permissions, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/permissions.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(database, /const DB_VERSION = 13/);
  assert.match(database, /makeIndexedStore\(database, "cashierSalaryDeductions"/);
  assert.match(database, /async transferCashierShiftToVault/);
  assert.match(database, /async getVault/);
  assert.match(database, /async listCashierShiftStatistics/);
  assert.match(database, /async deductCashierShortagesFromSalary/);
  assert.match(app, /الخزنة الرئيسية/);
  assert.match(app, /رأس المال في المخزون/);
  assert.match(app, /function openCashierShiftTransferDialog/);
  assert.match(app, /function openCashierShortageDeductionDialog/);
  assert.match(app, /data-action="transfer-cashier-shift"/);
  assert.match(app, /data-action="deduct-cashier-shortages"/);
  assert.match(permissions, /"transfer-cashier-shift"/);
  assert.match(permissions, /"deduct-cashier-shortages"/);
  assert.match(css, /\.cashier-difference-row \{ display:grid;/);
});

test("تبقى الحوالات في صفحتها وتسمح بتوريد الوارد للخزنة كاملًا أو جزئيًا للأدمن فقط", async () => {
  const [app, database, permissions, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/permissions.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(database, /async depositIncomingTransferToVault/);
  assert.match(database, /async listTransferVaultDeposits/);
  assert.match(database, /TRANSFER_TO_VAULT/);
  assert.match(database, /مبلغ التوريد أكبر من المتبقي/);
  assert.match(app, /function incomingTransferEntries/);
  assert.match(app, /function openIncomingTransferDepositDialog/);
  assert.match(app, /data-action="deposit-incoming-transfer"/);
  assert.match(app, /توريد حوالة للخزنة/);
  assert.match(app, /توريد التحويل لا يكرر التحصيل/);
  assert.match(permissions, /"deposit-incoming-transfer"/);
  assert.match(css, /\.transfer-vault-note/);
});

test("يوفر الجرد الدوري لقطة محفوظة ومقارنة من غير إنشاء حركة نقدية أو مخزنية", async () => {
  const [app, database, permissions, constants, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/permissions.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/constants.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(database, /const DB_VERSION = 13/);
  assert.match(database, /makeIndexedStore\(database, "periodicInventories"/);
  assert.match(database, /async getPeriodicInventorySummary/);
  assert.match(database, /async createPeriodicInventory/);
  assert.match(database, /async listPeriodicInventories/);
  assert.match(database, /لا يوجد في التطبيق سجل مستقل للتالف/);
  assert.match(app, /function periodicInventoryMarkup\(/);
  assert.match(app, /function openPeriodicInventorySaveDialog\(/);
  assert.match(app, /function openPeriodicInventoryDialog\(/);
  assert.match(app, /data-action="save-periodic-inventory"/);
  assert.match(app, /data-action="open-periodic-inventory"/);
  assert.match(app, /"periodic-inventory": periodicInventoryMarkup/);
  assert.doesNotMatch(constants, /id: "periodic-inventory", label: "الجرد الدوري"/);
  assert.match(permissions, /"save-periodic-inventory"/);
  assert.match(permissions, /"open-periodic-inventory"/);
  assert.match(css, /\.periodic-inventory-page/);
  assert.match(css, /\.periodic-inventory-detail/);
});

test("يدعم البحث المباشر برقم الفاتورة ويعرض عددي المنتجات والفواتير بأرقام إنجليزية في الرئيسية", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /invoiceQuery: ""/);
  assert.match(app, /id="invoice-search"/);
  assert.match(app, /bindSearchInput\("#invoice-search", "invoiceQuery"\)/);
  assert.match(app, /amountLatin\(dashboard\.productCount\)/);
  assert.match(app, /amountLatin\(dashboard\.todayInvoiceCount\)/);
});

test("يعرض رأس التطبيق اسم المتجر بدل نوع النشاط", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /function storeDisplayName\(settings = state\.settings\)/);
  assert.match(app, /businessType.*storeName/);
});

test("يربط خيار البقاء وكل عناصر إغلاق النافذة بدالة الإغلاق الموحدة", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /data-dialog-close>البقاء في التطبيق/);
  assert.match(app, /querySelectorAll\("\[data-dialog-close\]"\)\.forEach\(\(button\) => button\.addEventListener\("click", closeDialog\)\)/);
});

test("يضيف رابط اتصال آمنًا لعملاء وموردين لديهم هاتف فقط", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /const phoneHref = \(phone\)/);
  assert.match(app, /tel:\$\{raw\.startsWith\("\+"\)/);
  assert.match(app, /phoneCallButton\(supplier\.phone, supplier\.name\)/);
  assert.match(app, /phoneCallButton\(customer\.phone, customer\.name\)/);
  assert.match(app, /return href \? `<a class="icon-button icon-button--call"/);
});

test("يدعم اختيار رقم من جهات الاتصال لحقلي العميل والمورد مع إبقاء الإدخال اليدوي", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /navigator\.contacts\?\.select/);
  assert.match(app, /navigator\.contacts\.select\(\["name", "tel"\], \{ multiple: false \}\)/);
  assert.match(app, /phoneFieldMarkup\("customer-phone"/);
  assert.match(app, /phoneFieldMarkup\("supplier-phone"/);
  assert.match(app, /bindContactPicker\(overlay, "customer-phone"\)/);
  assert.match(app, /bindContactPicker\(overlay, "supplier-phone"\)/);
});

test("يعرض المبالغ الصحيحة من دون أصفار عشرية زائدة ويحتفظ بالكسور الفعلية", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /minimumFractionDigits: 0, maximumFractionDigits: 2/);
  assert.match(app, /format\(roundMoney\(value\)\)/);
});

test("تتيح صفحة دفعات الموردين اختيار المورد المستحق وتسوية رصيده وطريقة الدفع", async () => {
  const [app, permissions] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/permissions.js", import.meta.url), "utf8"),
  ]);
  assert.match(app, /data-action="new-supplier-payment"/);
  assert.match(app, /function openSupplierPaymentDialog\(supplierId = ""\)/);
  assert.match(app, /id="supplier-payment-supplier" name="supplierId" required/);
  assert.match(app, /id="supplier-payment-balance"/);
  assert.match(app, /db\.registerSupplierPayment\(\{ supplierId: values\.supplierId \|\| selectedId/);
  assert.match(permissions, /"new-supplier-payment"/);
});

test("اختيار منتج في فاتورة الشراء يهيئ حقول العبوة مرة واحدة دون مراقب DOM يعيد الرسم بلا نهاية", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /new MutationObserver\(hydrateBusinessPurchaseFields\)/);
  assert.match(app, /linesHost\.innerHTML = lines\.length[\s\S]*?hydrateBusinessPurchaseFields\(\);[\s\S]*?syncPurchase\(\);/);
  assert.match(app, /const addPurchaseProduct = \(product\)[\s\S]*?renderLines\(\);/);
});

test("يعرض تنبيه المخزون المنخفض أو النافد بلون قرمزي واضح في الملخص والوسم", async () => {
  const styles = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");
  assert.match(styles, /\.status--low,\.status--empty \{ color:#fff; background:#b51f3a; border:1px solid #7d1028;/);
  assert.match(styles, /\.inventory-summary div\+div \{ color:#fff; background:linear-gradient\(145deg,#c42a47,#84132b\);/);
  assert.match(styles, /\[data-theme="dark"\] \.inventory-summary div\+div \{ background:linear-gradient\(145deg,#c42a47,#84132b\);/);
});

test("تظهر صلاحية الشراء في المخزون بتحذير برتقالي قبل ثلاثة أشهر وأحمر خلال شهر", async () => {
  const [app, database, styles, reportFile] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/report-file.js", import.meta.url), "utf8"),
  ]);
  assert.match(app, /function expiryStatus\(product, today = dateKey\(\)\)/);
  assert.match(app, /const datePartsFormatter = new Intl\.DateTimeFormat\("en-GB-u-ca-gregory-nu-latn", \{ day: "2-digit", month: "2-digit", year: "numeric" \}\)/);
  assert.match(app, /const dateOnly = \(value\) => \{/);
  assert.match(reportFile, /generatedAt = ""/);
  assert.match(reportFile, /from = "البداية"/);
  assert.match(reportFile, /to = "غير محدد"/);
  assert.match(reportFile, /تاريخ ووقت الإنشاء: \$\{generatedAt\}/);
  assert.match(app, /const dateTime = \(value\) => \{/);
  assert.match(app, /const formatDate = \(value\) => dateOnly\(value\)/);
  assert.match(app, /const reportRange = \(\) => \(\{ from: state\.reportFrom \|\| "البداية", to: state\.reportTo \|\| dateTime\(new Date\(\)\) \}\)/);
  assert.match(app, /تاريخ ووقت الإنشاء: \$\{escapeHtml\(dateTime\(new Date\(\)\)\)\}/);
  assert.match(app, /reportRange\(\)\.from/);
  assert.match(app, /reportRange\(\)\.to/);
  assert.match(app, /const rows = \[\["التقرير التشغيلي العام"\], \[`من \$\{reportRange\(\)\.from\} إلى \$\{reportRange\(\)\.to\}`/);
  assert.match(app, /generatedAt: dateTime\(new Date\(\)\)/);
  assert.match(reportFile, /تاريخ ووقت الإنشاء: \$\{generatedAt\}/);
  assert.doesNotMatch(app, /dateStyle: "medium"/);
  assert.match(app, /days <= 30 \? "danger" : "warning"/);
  assert.match(app, /تنبيه انتهاء الصلاحية/);
  assert.match(app, /data-purchase-expiry-date/);
  assert.match(database, /batches\.add\(\{ id: batchId/);
  assert.match(database, /لا يمكن حفظ منتج منتهٍ أو ينتهي اليوم/);
  assert.match(styles, /\.expiry-status--warning \{ color:#845100; background:#fff3d4; border-color:#e2a443;/);
  assert.match(styles, /\.expiry-status--danger \{ color:#8b1d31; background:#fde6e9; border-color:#cf4f63;/);
});

test("يبدأ شريط الهاتف بترتيب افتراضي قابل للتخصيص من الإعدادات ويبقي القسم النشط قابلًا للوصول", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /const DEFAULT_MOBILE_NAVIGATION_ORDER = \["dashboard", "sales", "purchases"/);
  assert.match(app, /function normalizedMobileNavigationOrder\(order = \[\]\)/);
  assert.match(app, /function mobileNavigationSettingsMarkup\(\)/);
  assert.match(app, /data-action="move-mobile-nav"/);
  assert.match(app, /data-action="reset-mobile-nav"/);
  assert.match(app, /<nav class="bottom-nav" data-bottom-nav aria-label="التنقل الرئيسي">\$\{renderItems\(bottomItems\)\}<\/nav>/);
  // الشريط السفلي فقط، وبلا مساس بالموضع الرأسي للصفحة (كان التمرير إليه يُزحزح الشاشة كلها)
  assert.match(app, /function syncMobileNavigation\(\)[\s\S]{0,700}activeItem\.scrollIntoView\(\{ block: "nearest", inline: "center", behavior: "auto" \}\)[\s\S]{0,160}window\.scrollTo\(Math\.round\(window\.scrollX \|\| 0\), keepY\);/);
  assert.match(app, /if \(action === "navigate"\)[\s\S]*?state\.view = view; render\(\);/);
  assert.match(styles, /\.bottom-nav \{[^}]*overflow-x:auto;[^}]*scroll-snap-type:x proximity;/);
  assert.match(styles, /\.bottom-nav::\-webkit-scrollbar \{ display:none; \}/);
  assert.match(styles, /\[data-theme="dark"\] \.mobile-nav-settings__item strong \{ color:#fff; \}/);
  assert.match(styles, /\[data-theme="dark"\] \.mobile-nav-settings__actions \.icon-button \{ color:#fff4f6; background:linear-gradient\(145deg,#c42a47,#84132b\);/);
  assert.match(app, /input\("nearestExpiryDate", "تاريخ الانتهاء", "date", product\?\.nearestExpiryDate \?\? "", "class=native-date-input dir=ltr"\)/);
});

test("لا يكرر تعريف حالة الواجهة مفاتيح فلترة دفعات الموردين", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  const initialState = app.match(/const state = \{[^;]+\};/)?.[0] || "";
  assert.equal((initialState.match(/supplierPaymentFrom:/g) || []).length, 1);
  assert.equal((initialState.match(/supplierPaymentTo:/g) || []).length, 1);
});

test("تستخدم المعرفات بديلًا متوافقًا بدل الاعتماد المباشر على randomUUID", async () => {
  const [app, database, firebaseBackup, ids] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/firebase-backup.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/ids.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(`${app}\n${database}\n${firebaseBackup}`, /crypto\.randomUUID/);
  assert.match(ids, /globalThis\.crypto\?\.randomUUID/);
  assert.match(database, /const secureCrypto = \(\) =>/);
  assert.match(database, /secureCrypto\(\)\.getRandomValues/);
  assert.match(database, /secureCrypto\(\)\.subtle\.digest/);
});

test("ينشئ مساعد المعرفات معرفًا كاملاً وآخر قصيرًا صالحين للاستخدام", () => {
  assert.ok(randomId().length >= 8);
  assert.match(shortRandomId(), /^[A-F0-9]{8}$/);
});

test("يحمي طلب استرداد الهاتف من تعليق الشبكة بمهلة ورسالة إعادة محاولة", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /const controller = new AbortController\(\);/);
  assert.match(app, /window\.setTimeout\(\(\) => controller\.abort\(\), 15000\)/);
  assert.match(app, /signal: controller\.signal/);
  assert.match(app, /انتهت مهلة الإرسال\. تحقق من الإنترنت ثم حاول مرة أخرى\./);
  assert.match(app, /window\.clearTimeout\(timeout\); submit\.disabled = false/);
});

test("تستخدم أزرار الوضع الداكن زمرديًا عميقًا وياقوتيًا مع نص أبيض واضح", async () => {
  const css = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");
  assert.match(css, /\[data-theme="dark"\] \.button--primary \{ color:#fff; background:linear-gradient\(145deg,#21755f,#16473b\)/);
  assert.match(css, /\[data-theme="dark"\] \.button--danger \{ color:#fff; background:linear-gradient\(145deg,#c42a47,#84132b\)/);
  assert.match(css, /\[data-theme="dark"\] \.button--secondary,\[data-theme="dark"\] \.theme-toggle \{ color:#f4fff8; background:#21463a/);
  assert.match(css, /payment-method-toggle__button\.is-cash\.is-selected.*background:#1d6a56/);
});

test("توحّد واجهة سطح المكتب حقول النماذج وتبرز القائمة الجانبية في الوضعين", async () => {
  const css = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width:960px\) \{[\s\S]*?\.form-grid>label>input,\.form-grid>label>select \{ height:46px; font-size:15px;/);
  assert.match(css, /\.sidebar \.nav-item\.is-active \{ color:#fff; background:linear-gradient\(145deg,#21755f,#16473b\);/);
  assert.match(css, /\[data-theme="dark"\] \.sidebar \.nav-item \{ color:#d8eee2; background:rgba\(255,255,255,\.025\);/);
  assert.match(css, /\[data-theme="dark"\] \.sidebar \.nav-item\.is-active \{ color:#fff; background:linear-gradient\(145deg,#238465,#14513f\);/);
});

test("ترتب بطاقة بيانات المتجر مستقلة عن بطاقة ترتيب الهاتف على سطح المكتب", async () => {
  const css = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");
  assert.match(css, /\.settings-page \.report-grid \{ align-items:start; \}/);
  assert.match(css, /\.settings-page #settings-form>\.panel__head \{ padding:19px 22px 15px; margin:0 -22px 2px; border-bottom:1px solid var\(--line\); \}/);
  assert.match(css, /\.settings-page #settings-form>label:first-of-type \{ grid-column:1 \/ -1; \}/);
  assert.match(css, /\.settings-page #settings-form>\.dialog__actions \{ margin:2px 0 0; padding-top:14px; border-top:1px solid var\(--line\); \}/);
});

test("تورث فاتورة الشراء سعر بيع الحبة للمنتج السابق وتستخدم شبكة مكتبية منظمة", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /values\.salePrice === undefined \|\| values\.salePrice === "" \? product\.salePrice \?\? product\.defaultSalePrice \?\? product\.price \?\? 0 : values\.salePrice/);
  assert.match(app, /salePrice: toNumber\(salePrice\)/);
  assert.match(css, /\.purchase-line \{ grid-template-columns:repeat\(4,minmax\(0,1fr\)\); align-items:end; gap:12px; padding:16px; \}/);
  assert.match(css, /\.purchase-line>div:first-child \{ grid-column:1 \/ -1;/);
  assert.match(css, /\.purchase-line \.purchase-line__total \{ display:grid; grid-column:span 2;/);
});

test("يعرض حقل سعر البيع المعبأ قيمته داخل الخانة قبل اللمس ويبقيها قابلة للتعديل", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /class="purchase-sale-price-control"><input data-purchase-sale-price="\$\{index\}"/);
  assert.match(app, /data-purchase-sale-price-visible="\$\{index\}" aria-live="polite">\$\{escapeHtml\(String\(line\.salePrice \?\? ""\)\)\}/);
  assert.match(app, /value="\$\{line\.salePrice \?\? ""\}"/);
  assert.match(css, /\.purchase-sale-price-field__current \{ position:absolute; inset:0 11px; z-index:1; display:flex; align-items:center; pointer-events:none;/);
  assert.match(css, /\.purchase-sale-price-control:focus-within \.purchase-sale-price-field__current \{ opacity:0; \}/);
  assert.match(css, /\[data-theme="dark"\] \.purchase-sale-price-field input \{ color:#f2faf5 !important;/);
});

test("تحتوي نوافذ سطح المكتب حقول الشراء والنماذج داخل إطار النافذة", async () => {
  const css = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");
  assert.match(css, /\.dialog \{ box-sizing:border-box; overflow-x:hidden; \}/);
  assert.match(css, /\.dialog :is\(form,section,\.form-grid,\.purchase-form,\.purchase-line,\.barcode-field__control,\.manual-barcode\) \{ min-width:0; max-width:100%; \}/);
  assert.match(css, /\.dialog \.form-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\); \}/);
  assert.match(css, /\.dialog \.purchase-line--pack \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\); max-width:100%; \}/);
  assert.match(css, /\.dialog \.purchase-line--pack>button \{ grid-column:2; justify-self:end; \}/);
});

test("تستخدم تواريخ الانتهاء اختيار تقويم أصليًا وتحافظ على الحقول الرقمية عند التركيز", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /const selectNumericFieldValue = \(event\) =>/);
  assert.match(app, /input\.type !== "number" \|\| input\.disabled \|\| input\.readOnly \|\| !input\.value/);
  assert.match(app, /document\.addEventListener\("focusin", selectNumericFieldValue, true\)/);
  assert.match(app, /document\.addEventListener\("pointerup", selectNumericFieldValue, true\)/);
  assert.match(css, /input\[type="date"\] \{ direction:ltr; text-align:left; unicode-bidi:plaintext; \}/);
  assert.match(app, /تاريخ الانتهاء<input class="native-date-input" data-purchase-expiry-date="\$\{index\}" type="date" dir="ltr"/);
  assert.match(app, /name="expiryDate" type="date" dir="ltr"/);
  assert.match(app, /input\("nearestExpiryDate", "تاريخ الانتهاء", "date"/);
});

test("تعكس أسهم ترتيب شريط الهاتف اتجاه التقديم والتأخير بصريًا دون تغيير الإجراء", async () => {
  const css = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");
  assert.match(css, /\.mobile-nav-settings__actions \[data-direction="-1"\] svg \{ transform:rotate\(180deg\); \}/);
  assert.match(css, /\.mobile-nav-settings__actions \[data-direction="1"\] svg \{ transform:none; \}/);
  assert.doesNotMatch(css, /\.mobile-nav-settings__down svg \{ transform:rotate\(180deg\); \}/);
});

test("تفصل الإعدادات إدارة البيانات في صفحة مخصصة لتصدير واستيراد النسخ", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /function dataManagementMarkup\(\)/);
  assert.match(app, /view: "data-management"/);
  assert.match(app, /function settingsHubCard\(/);
  assert.match(app, /تصدير واستيراد البيانات/);
  assert.match(app, /data-action="export-backup"/);
  assert.match(app, /for="restore-file"/);
  assert.match(app, /"data-management": dataManagementMarkup/);
  assert.match(app, /\["settings", "data-management"\]\.includes\(view\)/);
  assert.match(styles, /\.data-management-page \.button--danger \{ color:#fff; background:linear-gradient\(145deg,#c42a47,#84132b\)/);
  assert.match(styles, /\.topbar-sales-action \{ min-height:44px;/);
});

test("يعرض اختصاري حساب المورد والاتصال بجانب المنتج المرتبط به في قوائم المنتج والمخزون والبيع", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /productSuppliers: \{\}/);
  assert.match(app, /db\.listProductSupplierLinks\(\)/);
  assert.match(app, /function productSupplierActions\(product\)/);
  assert.match(app, /data-action="open-supplier-account"/);
  assert.match(app, /phoneCallButton\(supplier\.phone, supplier\.name\)/);
  assert.match(app, /sale-product-line/);
  assert.match(styles, /\.product-supplier-actions,\.product-row-actions/);
  assert.match(styles, /\.sale-product-line/);
});

test("يجمع قائمة إعادة الطلب حسب المورد ويتيح حسابه واتصاله ومشاركة الطلب", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /function openReorderDialog\(\)/);
  assert.match(app, /data-reorder-supplier/);
  assert.match(app, /data-share-reorder/);
  assert.match(app, /navigator\.share/);
  assert.match(app, /phoneCallButton\(group\.supplier\.phone, group\.supplier\.name\)/);
});

test("يخفي نموذج التسجيل حتى الضغط على تسجيل جديد", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /data-action="open-setup-form"/);
  assert.match(app, /<form id="setup-form" hidden>/);
  assert.match(app, /form\.hidden = false/);
  assert.match(app, /button\.hidden = true/);
  assert.match(styles, /\[hidden\] \{ display:none !important; \}/);
});
test("يلون خانة الرصيد المستحق بالقرمزي في حساب العميل والمورد لوضوح النص", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /<div class="account-summary__balance"><span>الرصيد المستحق<\/span>/);
  assert.match(app, /<div class="account-summary__balance"><span>المستحق للمورد<\/span>/);
  assert.match(styles, /\.account-summary__balance \{ color:#fff !important; background:linear-gradient\(145deg,#c42a47,#84132b\) !important; border-color:#f28a9c !important; \}/);
  assert.match(styles, /\.account-summary__balance span,\.account-summary__balance strong \{ color:#fff !important; \}/);
  assert.match(styles, /\[data-theme="dark"\] \.account-summary__balance \{ border-color:#ff9eb0 !important; \}/);
  assert.doesNotMatch(styles, /\.account-summary__balance \{[^}]*var\(--green\)[^}]*\}/);
});
test("يعرض الماسح أدوات مساعدة للكاميرا الضعيفة ويخفف تكرار تحليل الإطارات", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /getScannerCameraConstraints/);
  assert.match(app, /getCameraAssistOptions/);
  assert.match(app, /focusMode: "continuous"/);
  assert.match(app, /focusDistance: value/);
  assert.match(app, /data-scanner-adjustment="focus"/);
  assert.match(app, /id="scanner-adjustment" class="scanner-adjustment" hidden/);
  assert.match(app, /torch: nextState/);
  assert.match(app, /CAMERA_SCAN_INTERVAL_MS/);
  assert.match(app, /تحسين القراءة/);
  assert.match(styles, /scanner-assist/);
  assert.match(styles, /scanner-assist__quick/);
  assert.match(styles, /scanner-adjustment\[hidden\]/);
});

test("تتيح شاشة البداية استعادة ملف حسابي قبل إنشاء متجر أو حسابات جديدة", async () => {
  const app = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /for="setup-restore-file"/);
  assert.match(app, /id="setup-restore-file" type="file" accept="application\/json,\.json" hidden/);
  assert.match(app, /root\.querySelector\("#setup-restore-file"\)\?\.addEventListener\("change", restoreBackupFromFile\)/);
  assert.match(app, /ستعود بعدها إلى الدخول بحساباتك ورموزك السابقة/);
});

test("يفصل عنوان ووصف الصندوق عن أزراره على شاشات الهاتف الصغيرة", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /"topbar--cashbox"/);
  assert.match(app, /function topbarMarkup\(title, description, action = "", modifierClass = ""\)/);
  assert.match(styles, /\.workspace > \.topbar\.topbar--cashbox \{ display:flex !important; flex-direction:column !important; align-items:stretch !important; gap:12px !important; \}/);
  assert.match(styles, /\.topbar--cashbox \.topbar__description \{ max-width:100%; overflow-wrap:normal; word-break:normal; line-height:1\.7; \}/);
  assert.match(styles, /\.workspace > \.topbar\.topbar--cashbox>div:first-child \{ flex:0 0 auto !important; width:100% !important; min-width:0 !important; \}/);
});

test("يضع كشف حساب العميل بياناته في بطاقة واضحة بخط عربي مناسب للطباعة", () => {
  const html = renderCustomerAccountHtml({
    account: { customer: { name: "أحمد العميل", phone: "777123456", address: "صنعاء" }, totalSales: 80, totalPaid: 40, balance: 40, transactions: [] },
    storeName: "بقالة الاختبار", formatMoney: (value) => `${value} ر.ي`, formatDateTime: () => "23 أغسطس 2026", escapeHtml,
  });
  assert.match(html, /بيانات العميل/);
  assert.match(html, /أحمد العميل/);
  assert.match(html, /777123456/);
  assert.match(html, /صنعاء/);
  assert.match(html, /customer-card/);
  assert.match(html, /family=Cairo/);
});

test("تظهر خدمة التوصيل وخيار تحميلها على العميل أو المحل في مراجعة البيع والفاتورة", async () => {
  const [app, database, pdfExport, thermalPrint] = await Promise.all([readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"), readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"), readFile(new URL("../client/src/js/pdf-export.js", import.meta.url), "utf8"), readFile(new URL("../client/src/js/invoice-print.js", import.meta.url), "utf8")]);
  assert.match(app, /name="deliveryFee"/);
  assert.match(app, /name="deliveryChargeType"/);
  assert.match(app, /value="store"/);
  assert.match(app, /value="customer"/);
  assert.match(app, /مدفوعة بما فيها التوصيل/);
  assert.match(app, /على العميل ضمن الفاتورة/);
  assert.doesNotMatch(database, /DELIVERY_CHARGE/);
  assert.match(database, /category: "توصيل"/);
  assert.match(app, /deliveryLine/);
  assert.match(pdfExport, /invoice\.deliveryFee/);
  assert.match(thermalPrint, /invoice\.deliveryFee/);
  assert.match(app, /checkout-submit/);
  assert.match(app, /delivery-compact/);
  assert.match(app, /delivery-choice--store/);
  assert.match(app, /delivery-choice--customer/);
  assert.match(app, /checkout-launch/);
});

test("يعرض خصم السطر والخصم العام بصيغة مبلغ أو نسبة مع سقف خاص بالكاشير", async () => {
  const [app, domain, style] = await Promise.all([readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"), readFile(new URL("../client/src/js/domain.js", import.meta.url), "utf8"), readFile(new URL("../client/src/style.css", import.meta.url), "utf8")]);
  assert.match(domain, /calculateDiscountAmount/);
  assert.match(domain, /raw\.endsWith\("%"\)/);
  assert.match(domain, /normalizeCashierDiscountLimit/);
  assert.match(app, /name="discount"/);
  assert.match(app, /placeholder="0 أو 20%"/);
  assert.doesNotMatch(app, /data-cart-discount/);
  assert.match(app, /data-cart-line-discount/);
  assert.match(app, /أقصى خصم للكاشير هو 10% من قيمة السطر/);
  assert.match(app, /name="cashierDiscountLimitPercent"/);
  assert.match(app, /normalizeCashierDiscountLimit\(state\.settings\?\.cashierDiscountLimitPercent, 10\)/);
  assert.match(app, /cashierLimitPercent/);
  assert.match(app, /sellerRole: state\.currentUser\?\.role/);
  assert.doesNotMatch(app, /الإجمالي المبدئي/);
  assert.match(style, /inventory-summary div,\.account-summary>div/);
  assert.match(style, /\.delivery-compact \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\); align-items:end;/);
  assert.match(style, /\.delivery-choice \{ position:relative;[\s\S]*?align-self:end; min-height:29px; height:29px;/);
  assert.match(app, /<button class="button button--secondary" type="submit">ابحث<\/button>/);
  assert.match(style, /\.nav-item \{[^}]*color:#315a4b;/);
  assert.match(style, /\[data-theme="dark"\] \.bottom-nav \.nav-item \{ color:#d9f4e6; \}/);
  assert.match(style, /\.metric-card \{[^}]*background:#12634f;[^}]*border:2px solid #76d8b2;/);
  assert.doesNotMatch(style, /\.metric-card--sales/);
  assert.doesNotMatch(app, /metric-card--/);
  assert.match(style, /\[data-theme="dark"\] \.metric-card \{[^}]*background:#12634f;/);
  assert.match(style, /\.metric-card\.is-negative \{ background:#a73340; border-color:#ffc3ca;/);
});

test("يضغط خصم سطر البيع بجانب الكمية ويحافظ على صياغة الأرقام الإنجليزية", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /new Intl\.NumberFormat\("en-US", \{ minimumFractionDigits: 0, maximumFractionDigits: 2 \}\)/);
  assert.match(app, /new Intl\.NumberFormat\("en-US", \{ maximumFractionDigits: 2 \}\)/);
  assert.match(app, /<label class="cart-line__discount" title="خصم السطر بالمبلغ أو النسبة"><span>خصم<\/span><input data-cart-line-discount=.*maxlength="4"/);
  assert.match(app, /class="cart-line__discount-note"/);
  assert.match(css, /\.cart-line__discount \{ display:flex; align-items:center; flex:0 0 auto;/);
  assert.match(css, /\.cart-line__discount input \{ width:58px; min-width:58px;/);
  assert.match(css, /\.invoice-list \.invoice-row:nth-child\(even\)/);
});

test("يحافظ على جلسة الحساب بعد تحديث الصفحة ولا يمسحها إلا عند تسجيل الخروج", async () => {
  const [database, session, app] = await Promise.all([
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/session.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(session, /ACTIVE_SESSION_STORAGE_KEY/);
  assert.match(database, /localStorage\.setItem\(ACTIVE_SESSION_STORAGE_KEY/);
  assert.match(database, /localStorage\.getItem\(ACTIVE_SESSION_STORAGE_KEY/);
  assert.match(database, /localStorage\.removeItem\(ACTIVE_SESSION_STORAGE_KEY/);
  assert.match(app, /getPersistentSession\(\)/);
  assert.match(app, /clearPersistentSession\(\)/);
});

test("يحذف الكاشير تعطيلًا ويحافظ على السجل ويمنع تجاوز السلفة وخصم العجز المكرر", async () => {
  const [database, app, permissions] = await Promise.all([
    readFile(new URL("../client/src/js/database.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/permissions.js", import.meta.url), "utf8"),
  ]);
  assert.match(database, /async deleteCashierAccount\(accountId\)/);
  assert.match(database, /current\.role !== "cashier"/);
  assert.match(database, /isActive: false, deletedAt/);
  assert.match(database, /السلفة تتجاوز المتبقي/);
  assert.match(database, /!shift\.salaryDeductionId/);
  assert.match(database, /salaryDeductionId: deduction\.id/);
  assert.match(app, /data-action="delete-cashier-account"/);
  assert.match(app, /سيُوقف الحساب عن الدخول مع الاحتفاظ بكل الفواتير والسلف والورديات/);
  assert.match(permissions, /"delete-cashier-account"/);
});

test("لا تمسح الاستعادة السحابية جلسة حسابي وتضمن تباين خيار تفعيل الكاشير", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /const sessionBeforeRestore = state\.currentUser/);
  assert.match(app, /const restoredAccount = sessionBeforeRestore/);
  assert.doesNotMatch(app.slice(app.indexOf("async function restoreCloudBackup"), app.indexOf("async function removeCloudBackup")), /clearPersistentSession\(\)/);
  assert.match(css, /\[data-theme="dark"\] \.checkbox-field/);
  assert.match(css, /\[data-theme="dark"\] \.checkbox-field span \{ color:#f2faf5; \}/);
});

test("يعزل تهيئة Firebase عن جلسة حسابي ويعيد المحاولة بعد فشل الخدمة", async () => {
  const [firebase, app] = await Promise.all([
    readFile(new URL("../client/src/js/firebase-backup.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(firebase, /import \{ getApp, getApps, initializeApp \} from "firebase\/app"/);
  assert.match(firebase, /servicesPromise = null; throw error/);
  const restoreBlock = app.slice(app.indexOf("async function restoreCloudBackup"), app.indexOf("async function removeCloudBackup"));
  assert.doesNotMatch(restoreBlock, /clearPersistentSession\(\)/);
  assert.match(restoreBlock, /sessionBeforeRestore/);
});

test("توحد بيانات الفاتورة في التفاصيل والطباعة وPDF", async () => {
  const [app, thermal, pdf, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/invoice-print.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/pdf-export.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /invoice-customer-card/);
  assert.match(app, /invoiceCashierName\(invoice\)/);
  assert.match(app, /طريقة السداد/);
  assert.match(thermal, /الكاشير المنفذ/);
  assert.match(thermal, /حالة السداد/);
  assert.match(thermal, /بيانات العميل/);
  assert.match(pdf, /الكاشير المنفذ/);
  assert.match(pdf, /حالة السداد/);
  assert.match(pdf, /بيانات العميل/);
  assert.match(css, /\.invoice-customer-card/);
});

test("يحوّل PDF الفاتورة من قالب الطباعة الحرارية نفسه", async () => {
  const [pdfExport, app] = await Promise.all([
    readFile(new URL("../client/src/js/pdf-export.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(pdfExport, /import \{ renderThermalInvoiceHtml \} from "\.\/invoice-print\.js"/);
  assert.match(pdfExport, /renderThermalInvoiceHtml\(\{ invoice, customer, storeName, logoDataUrl/);
  assert.match(pdfExport, /return createPdfFileFromHtml\(\{ html, filename, page: "thermal" \}\)/);
  assert.match(pdfExport, /dataset\.pdfOrientation = isLandscape \? "landscape" : "portrait"/);
  assert.match(pdfExport, /width:\$\{isThermal \? "80mm" : isLandscape \? "297mm" : "210mm"\}/);
  assert.match(pdfExport, /orientation: isLandscape \? "landscape" : "portrait"/);
  assert.match(app, /font-family:\"HesabiArabicPdf\",\"Noto Naskh Arabic\",Tahoma,Arial,sans-serif/);
  assert.match(app, /grid-template-columns:minmax\(0,1fr\) 74px/);
  assert.match(app, /unicode-bidi:plaintext/);
  assert.match(app, /overflow-wrap:anywhere/);
});

test("يثبت أزرار معاينة التقرير ويجعل الجدول وحده قابلًا للتمرير", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../client/src/style.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /data-preview-share/);
  assert.match(app, /data-preview-print/);
  assert.match(app, /data-preview-download/);
  assert.match(app, /data-preview-excel/);
  assert.match(app, /downloadReportPdf\(type\)/);
  assert.match(app, /class="dialog__actions report-preview-actions"/);
  assert.match(css, /\.dialog:has\(\.report-preview\) \{ display:flex; flex-direction:column/);
  assert.match(css, /\.dialog:has\(\.report-preview\) \.report-preview \{ flex:1 1 auto; min-height:0; max-height:none; overflow:auto; \}/);
  assert.match(css, /\.report-preview-actions \{ position:sticky; bottom:0; z-index:3/);
  assert.match(css, /@media\(min-width:600px\)\{\.dialog-backdrop--report-preview/);
  assert.match(css, /width:min\(96vw,1280px\)/);
  assert.match(css, /max-height:calc\(100dvh - 40px\)/);
  assert.match(css, /\.dialog-backdrop--report-preview \.report-preview-scroll\{max-height:calc\(100dvh - 174px\)/);
});
