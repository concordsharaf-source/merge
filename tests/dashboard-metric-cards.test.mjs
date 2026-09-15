/**
 * بطاقات لوحة التحكم: مستطيلة، متناوبة الغمقة، أيقونة كبيرة، ورقم في سطر واحد لا يُبتر.
 * كل الفحوص على المصدر — الألوان والقياس يُختبَران في Chromium (hesabi-verify/dash-measure.mjs).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appJs = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");

const card = appJs.slice(appJs.indexOf("function metricCard("), appJs.indexOf("\nfunction packageFieldLabels"));
const dash = appJs.slice(appJs.indexOf("function dashboardMarkup() {"), appJs.indexOf("function metricCard("));
const block = css.slice(css.indexOf(".metric-grid { gap: 12px;"));
assert.ok(card.length > 500 && card.length < 4000, "تعذّر استخراج metricCard");
assert.ok(dash.length > 800, "تعذّر استخراج dashboardMarkup");
assert.ok(block.length > 400, "تعذّر استخراج بلوك البطاقات من style.css");

test("البطاقة عرض فقط: لا تكتب حالة ولا قاعدة ولا تحسب رقمًا", () => {
  assert.doesNotMatch(card, /state\.[a-zA-Z]+\s*=[^=]/, "metricCard تكتب على الحالة");
  assert.doesNotMatch(card, /\bdb\.(save|create|update|delete|adjust|put)/, "metricCard تكتب في القاعدة");
  assert.doesNotMatch(card, /await |\.then\(|dispatchEvent|showToast\(/, "metricCard صارت غير متزامنة أو تُطلق أحداثًا");
  assert.doesNotMatch(card, /money\(|roundMoney|calculateSaleTotals/, "metricCard تعيد حساب شيء — الرقم يُمرَّر كما هو");
  assert.match(card, /<strong>\$\{value\}<\/strong>/, "الرقم لم يعد يُعرض كما وصل");
  assert.match(card, /toNumber\(rawValue\) < 0 \? "is-negative"/, "دلالة الرقم السالب فُقدت");
});

test("البنية: أيقونة كبيرة، سطر عنوان، ورقم مستقل السطر", () => {
  assert.match(card, /class="metric-card__icon"[\s\S]{0,40}icon\(iconName, 26\)/, "الأيقونة لم تعد كبيرة (26)");
  assert.match(card, /metric-card__body"><span class="metric-card__head"><small>/, "سطر العنوان تغيّر — لن يأخذ الرقم العرض كاملًا");
  assert.match(card, /<\/span><strong>/, "لم يعد الرقم في سطر مستقل داخل الجسم");
  assert.match(card, /metric-card__hint/, "الدلالة الصغيرة فُقدت");
  assert.match(css, /\.metric-card__icon \{ flex: 0 0 46px; width: 46px; height: 46px/, "بلاطة الأيقونة لم تعد 46px");
  assert.match(css, /\.metric-card \.metric-card__body, \.metric-card \.metric-card__head, \.metric-card \.metric-card__go \{ color: inherit; \}/, "وراثة اللون مفقودة: قاعدة .metric-card span القديمة تصبغ النص بلون فاتح فلا يُقرأ على البطاقة الفاتحة");
  assert.match(css, /\.metric-card \.metric-card__head small \{ color: inherit; flex: 0 0 auto;/, "العنوان صار قابلًا للبتر");
  const strongRule = /\.metric-card__body > strong \{[^}]*\}/.exec(css)?.[0] || "";
  assert.match(strongRule, /white-space: nowrap;/, "الرقم قد ينزل سطرًا ثانيًا");
  assert.match(strongRule, /font-variant-numeric: tabular-nums;/, "الأرقام بلا أرقام جدولية");
  assert.match(strongRule, /font-size: clamp\(19px/, "حجم الرقم لا يبدأ من 19px");
  assert.match(block, /\.metric-card \{\n  display: flex;\n  min-width: 0;/, "البطاقة بلا min-width:0 تتمدد مع الرقم وتكسر الشبكة");
  assert.match(appJs, /querySelectorAll\("\.metric-card strong/, "شبكة fitMetricValues لم تعد ترى أرقام البطاقات (الضمان الأخير ضد التكدّس)");
});

test("مستطيلة عبر المقاسات، وشبكة لا تنزلق", () => {
  assert.match(block, /\.metric-grid \{ gap: 12px; grid-template-columns: minmax\(0, 1fr\); \}/, "العمود الواحد يجب أن يكون minmax(0,1fr)");
  assert.doesNotMatch(block, /repeat\(\d+, 1fr\)/, "عمود 1fr بلا سقف يعود يتمدد مع الرقم الطويل");
  const cols = [...block.matchAll(/repeat\((\d+), minmax\(0, 1fr\)\)/g)].map((m) => Number(m[1]));
  assert.deepEqual(cols, [2, 3, 4], `تدرّج الأعمدة تغيّر: ${cols}`);
  assert.match(block, /min-height: 84px;[\s\S]{0,120}border-radius: 16px/, "البطاقة لم تعد مستطيلة القياس");
  assert.match(block, /@media \(min-width: 1120px\) \{ \.metric-grid \{ grid-template-columns: repeat\(3/, "العمود الثلاثي يبدأ قبل أن يسعه الرقم — عصرٌ معروف عند 960");
});

test("تناوب غامق/فاتح، والسالب يبقى أحمر مرئيًا في الحالتين", () => {
  assert.match(css, /\.metric-grid > \.metric-card:where\(:nth-child\(odd\)\) \{ color: #f4fbf7; background: #12634f/, "الفردة الغامقة لم تعد غامقة");
  assert.match(css, /\.metric-grid > \.metric-card:where\(:nth-child\(even\)\) \{ color: #13342a; background: #fffdf7/, "الفردة الفاتحة لم تعد فاتحة");
  assert.match(css, /\.metric-grid > \.metric-card:where\(:nth-child\(odd\)\) \.metric-card__icon \{ color: #13342a; background: #f3cf70/, "بلاطة الأيقونة على الغامقة يجب أن تكون ذهبية");
  assert.match(css, /\.metric-grid > \.metric-card:where\(:nth-child\(even\)\) \.metric-card__icon \{ color: #fffdf7; background: #12634f/, "بلاطة الأيقونة على الفاتحة يجب أن تكون خضراء");
  assert.match(css, /\.metric-grid > \.metric-card\.is-negative \{ color: #fff; background: #a73340/, "البطاقة السالبة لم تعد حمراء");
  assert.match(css, /\.metric-grid > \.metric-card\.is-negative \.metric-card__hint,\n\.metric-grid > \.metric-card\.is-negative \.metric-card__go \{ color: #ffe7ea !important; \}/, "قاعدة .is-negative القديمة تصبغ النص بلون الخلفية فيختفي على البطاقة الحمراء");
  assert.match(css, /\[data-theme="dark"\] \.metric-grid > \.metric-card:where\(:nth-child\(even\)\)/, "التناوب في الوضع الليلي فُقد");
  const oddLine = css.split("\n").find((line) => line.includes(':nth-child(odd)) { color: #f4fbf7'));
  assert.ok(oddLine && !oddLine.includes("@media"), "التناوب محبوس داخل قاعدة وسائط");
});

test("البطاقة تقود إلى صفحتها عبر مُوجّه التطبيق، ولا تُولّد مسارًا محظورًا", () => {
  assert.match(card, /if \(view && canAccessView\(state\.currentUser, view\)\)/, "القيادة بلا فحص صلاحية");
  assert.match(card, /data-action="navigate" data-view="\$\{view\}"/, "البطاقة لا تستخدم موجّه التطبيق المعتمد");
  assert.match(card, /<button type="button" class="\$\{classes\} is-openable"/, "الوجهة لم تُصير البطاقة زرًا");
  assert.match(card, /return `<article class="\$\{classes\}">/, "البطاقة بلا وجهة يجب أن تبقى نصًا خاملًا لا زرًا ميتًا");
  assert.match(card, /metric-card__go/, "لا سهم يدلّ على أنها تقود لمكان");
  assert.match(card, /aria-label=/, "الزر بلا وصف ناطق يسمّي وجهته");
});

test("الرئيسية الجديدة (Stitch): بطاقة الإجمالي والمؤشرات مربوطة بوجهاتها", () => {
  assert.match(dash, /إجمالي مبيعات اليوم/, "اختفى عنوان بطاقة الإجمالي");
  assert.match(dash, /navCard\("invoices"/, "بطاقة المبيعات لا تقود للفواتير");
  assert.match(dash, /mini\("cashbox"/, "بطاقة الصندوق لا تقود للصندوق");
  assert.match(dash, /mini\("transfers"/, "بطاقة التحويلات لا تقود للتحويلات");
  assert.match(dash, /mini\("reports"/, "بطاقة الأرباح لا تقود للتقارير");
  assert.match(dash, /mini\("customers"/, "بطاقة الديون لا تقود للعملاء");
  assert.match(dash, /canAccessView\(state\.currentUser, view\)/, "بطاقات الرئيسية بلا فحص صلاحية");
  assert.match(dash, /data-action="navigate" data-view="\$\{view\}"/, "البطاقات لا تستخدم موجّه التطبيق");
  assert.match(dash, /:\s*`<article/, "البطاقة بلا وجهة مسموحة يجب أن تبقى نصًا خاملًا");
  assert.match(dash, /tabular-nums/, "أرقام الرئيسية بلا أرقام جدولية");
  assert.match(dash, /whitespace-nowrap/, "أرقام الرئيسية قد تلتف على سطرين");
  assert.match(dash, /<h1 class="sr-only">نظرة على يومك<\/h1>/, "الرئيسية بلا عنوان لقارئ الشاشة واختبار التنقل");
  assert.match(dash, /text-error/, "الرقم السالب فقد دلالته الحمراء");
  assert.doesNotMatch(dash, /metricCard\(/, "الرئيسية الجديدة يجب ألا تستخدم بطاقات metricCard القديمة");
});

test("الرئيسية الجديدة (Stitch): إجراءات سريعة ونواقص ونشاط مربوطة بأفعالها", () => {
  assert.match(dash, /فاتورة بيع جديدة/, "اختفى زر فاتورة البيع");
  assert.match(dash, /data-view="sales"/, "زر البيع لا يقود لنقطة البيع");
  assert.match(dash, /quickBtn\("new-purchase"/, "زر الشراء فقد فعله");
  assert.match(dash, /quickBtn\("navigate", "customer-payments"/, "سند القبض لا يقود للدفعات");
  assert.match(dash, /quickBtn\("navigate", "expenses"/, "زر المصروف لا يقود للمصروفات");
  assert.match(dash, /quickBtn\("navigate", "periodic-inventory"/, "زر الجرد لا يقود للجرد الدوري");
  assert.match(dash, /أصناف تحت حد الطلب/, "اختفى قسم النواقص");
  assert.match(dash, /data-action="open-product"/, "النواقص لا تفتح الصنف");
  assert.match(dash, /آخر فواتير ومعاملات اليوم/, "اختفى سجل النشاط");
  assert.match(dash, /data-action="open-invoice"/, "النشاط لا يفتح الفاتورة");
  assert.match(dash, /data-action="open-customer"/, "التحصيل لا يفتح حساب العميل");
  assert.match(dash, /timeAgo\(/, "النشاط بلا زمن نسبي");
  assert.match(dash, /data-action="open-reorder-list"/, "جرس التنبيهات فقد فعله");
  assert.match(dash, /data-action="quick-lock"/, "زر القفل السريع مفقود من الرئيسية");
});
