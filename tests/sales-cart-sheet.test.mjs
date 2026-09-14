/**
 * اختبار ورقة سلة البيع في صفحة المبيعات (الهاتف): السلة مثبّتة في الأسفل وتُرفع بكامل الشاشة.
 * كل Assertions على المصدر: القياس المرئي الحقيقي (أين يقف زر الدفع، وهل الرفع يعمل بالإصبع)
 * يُختبَر في متصفح Chromium — سكربت التحقق مذكور في ملخص الجولة.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appJs = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");
const sheet = appJs.slice(appJs.indexOf("/* ===== سلة البيع كورقة سفلية"), appJs.indexOf("const SALES_CATALOG_LIMIT"));
const salesMarkup = appJs.slice(appJs.indexOf("function salesMarkup() {"), appJs.indexOf("\nfunction cartLine(line) {"));

assert.ok(sheet.length > 900, "تعذّر استخراج طبقة الورقة من app.js");

test("الورقة شكل خالص: لا تكتب على السلة ولا تلمس الحسابات ولا تنتظر شيئًا", () => {
  assert.doesNotMatch(sheet, /state\.cart\s*=[^=]/, "طبقة الورقة تكتب على السلة");
  assert.doesNotMatch(sheet, /\bdb\.(save|create|update|delete|adjust)/, "طبقة الورقة تكتب في القاعدة");
  assert.doesNotMatch(sheet, /await |\.then\(/, "طبقة الورقة أصبحت غير متزامنة — يجب أن تبقى قياسًا فوريًا");
  assert.doesNotMatch(sheet, /dispatchEvent|showToast\(|calculateSaleTotals/, "طبقة الورقة تُطلق أحداثًا أو تعيد حساب الإجماليات");
  assert.match(sheet, /panel\.style\.setProperty\("--sales-sheet-h"/, "لم تعد الورقة تضبط ارتفاعها بخاصية CSS");
});

test("الحجم محسوب من شريط التنقّل الحقيقي لا من رقم ثابت، مع حالة فارغة أصغر", () => {
  assert.match(sheet, /querySelector\("\.bottom-nav"\)\?\.getBoundingClientRect\(\)\.height/, "ارتفاع الشريط السفلي مقروء من DOM");
  assert.match(sheet, /SALES_SHEET_PEEK_RATIO = 0\.46/, "النصف السفلي محجوز للسلة");
  assert.match(sheet, /SALES_SHEET_EMPTY_PEEK = \d+/, "السلة الفارغة تنكمّش لشريط");
  assert.match(sheet, /state\.cart\.length \? viewport \* SALES_SHEET_PEEK_RATIO : SALES_SHEET_EMPTY_PEEK/, "الاختيار بين الحجمين حسب السلة");
  assert.match(sheet, /Math\.min\(full, peek\)/, "peek لا يتجاوز ارتفاع الشاشة أبدًا");
  assert.match(sheet, /visualViewport\?\.height \|\| window\.innerHeight/, "قياس Viewport يعتمد dvh الفعلي (شريط كروم متغيّر)");
  // النقطتان الوحيدتان: التصاق بلا حالة وسطى، وحدّ أدنى يمنع اختفاء الزر
  assert.match(sheet, /const SALES_SHEET_SNAP = ([0-9.]+);/, "عتبة الالتصاق مفقودة");
  assert.ok(Number(/const SALES_SHEET_SNAP = ([0-9.]+);/.exec(sheet)[1]) > 0.2, "العتبة منخفضة جدًا فتُفتح السلة بلا قصد");
  assert.match(sheet, /const SALES_SHEET_FLICK = ([0-9.]+);/, "كشف الدفعة السريعة مفقود");
  assert.match(sheet, /Math\.max\(260, viewport - nav - SALES_SHEET_EDGE \* 2\)/, "الارتفاع الكامل لا يزاحم شريط التنقّل");
  assert.match(sheet, /Math\.max\(120,\s*bar,\s*Math\.round\(/, "الارتفاع المصغّر له حدّ أدنى مقيس فلا يختفي زر الدفع");
});

test("السحب من المقبض وحده — والنقرة تبقى تعمل", () => {
  assert.match(sheet, /closest\?\.\("\.cart-sheet__handle"\)/, "البداية ليست من المقبض فقط");
  assert.match(sheet, /event\.pointerType === "mouse"/, "السحب بالماوس معطّل (النقرة تتكفّل)");
  assert.match(sheet, /if \(drag\.moved < 8\) \{[\s\S]{0,120}applySalesSheetGeometry\(\);/, "النقرة تُفسَّر سحبًا — كان يجب تمريرها للزر");
  assert.match(sheet, /commitSalesSheet\(wantsFull \? "full" : "peek"\)/, "لا قرار التصاق عند التحرير");
  assert.match(sheet, /classList\.add\("is-dragging"\)/, "لا إلغاء للانتقال أثناء السحب");
  assert.match(sheet, /key === "Escape" && state\.salesSheet === "full"/, "Escape لا يُغلق الورقة");
  assert.match(sheet, /window\.addEventListener\("resize", onResize\)/, "لا إعادة قياس عند تغيّر الحجم");
  assert.match(sheet, /salesSheetGesturesInstalled/, "لا حماية من تكرار ربط المستمعات مع كل رسم");
});

test("لا إعادة رسم عند التبديل: الحالة تُطبَّق مباشرة وتبقى قائمة التمرير محفوظة", () => {
  const commit = sheet.slice(sheet.indexOf("function commitSalesSheet(mode) {"));
  const commitBody = commit.slice(0, commit.indexOf("\n}\n") + 3);
  assert.ok(commitBody.length > 300, "تعذّر استخراج جسم commitSalesSheet");
  assert.match(commitBody, /applySalesSheetGeometry\(\)/, "التبديل لا يطبّق الهندسة");
  assert.doesNotMatch(commitBody, /\brender\(\)/, "التبديل يعيد رسم الصفحة كله — يفقد موضع التمرير ويكسر الحركة");
  assert.doesNotMatch(commitBody, /await |\bPromise\b|\.then\(/, "التبديل صار غير متزامن");
  assert.match(commitBody, /setTimeout\([\s\S]{0,90}classList\.remove\("is-sheet-animating"\)/, "طبقة الحركة لا تُرفع بعد انتهاء الانتقال — ستُمنع حركة التبديل التالي");
  assert.match(commitBody, /classList\.add\("is-sheet-animating"\)[\s\S]{0,160}offsetHeight[\s\S]{0,240}applySalesSheetGeometry\(\)/, "الحركة لا تبدأ: يجب إضافة الطبقة، ثم تثبيت النمط، ثم تغيير الارتفاع");
  assert.match(sheet, /handle\.setAttribute\("aria-expanded"/, "حالة التوسّع لا تُبلّغ قارئ الشاشة");
  assert.match(appJs, /if \(action === "toggle-sales-sheet"\) \{ commitSalesSheet\(state\.salesSheet === "full" \? "peek" : "full"\); return; \}/, "زر المقبض غير موصول بالإجراء");
});

test("الوسوم: مقبض داخل اللوحة، ومُختبئ على الشاشات الأكبر", () => {
  assert.match(salesMarkup, /class="cart-panel cart-sheet\$\{salesSheetPaint\.mobile \? " is-sheet-mobile" : ""\}"\$\{salesSheetPaintStyle\("panel"\)\}/, "اللوحة لم تعد تحمل هوية الورقة وتلميح هندستها من أول إطار");
  assert.match(salesMarkup, /<section class="sales-layout"\$\{salesSheetPaintStyle\("layout"\)\}>/, "مساحة السلة المحجوزة لا تُكتب مع القالب ⇒ قفزة في تخطيط القائمة");
  assert.match(salesMarkup, /data-sheet="\$\{state\.salesSheet === "full" \? "full" : "peek"\}"/, "سمة الحالة مفقودة");
  assert.match(salesMarkup, /data-cart-empty="\$\{state\.cart\.length \? "0" : "1"\}"/, "سمة السلة الفارغة مفقودة");
  assert.match(salesMarkup, /class="cart-sheet__handle" type="button" data-action="toggle-sales-sheet"/, "المقبض ليس زرًا حقيقيًا");
  assert.match(salesMarkup, /aria-label="\$\{state\.salesSheet === "full" \? "تصغير سلة البيع"/, "المقبض بلا وسم مقروء");
  assert.match(salesMarkup, /<span class="cart-sheet__grip" aria-hidden="true">/, "المقبض البصري يزدحم على قارئ الشاشة");
});

test("CSS: الطبقة fixة فوق شريط التنقّل، وحصرها في الكلاس لا في الوسائط", () => {
  assert.match(css, /\.cart-sheet__handle \{\n\s*display: none;/, "المقبض ظاهر على سطح المكتب");
  const panel = /\/\* ===== سلة البيع كورقة سفلية[\s\S]*$/.exec(css)?.[0] || "";
  assert.ok(panel.length > 900, "لم يُعثر على كتلة CSS الخاصة بالورقة");
  assert.match(panel, /\.cart-sheet\.is-sheet-mobile \{\n\s*position: fixed;/, "الورقة ليست مثبتة");
  assert.match(panel, /bottom: calc\(var\(--sales-sheet-nav, 0px\) \+ 8px \+ env\(safe-area-inset-bottom\)\);/, "الورقة تزاحم شريط التنقّل أو الأمان السفلي");
  assert.match(panel, /height: var\(--sales-sheet-h, 46vh\);\n\s*height: var\(--sales-sheet-h, 46svh\);/, "لا تسلسل احتياطي لـ svh (webview قديم)");
  assert.match(panel, /min-height: 0;/, "min-height:380px القديم يمنع انكماش السلة الفارغة");
  assert.match(panel, /\.cart-sheet\.is-sheet-mobile\.is-dragging \{ transition: none; \}/, "لا تعطيل للانتقال أثناء السحب ⇒ حركة متقطّعة");
  assert.match(panel, /overscroll-behavior: contain;/, "تمرير قائمة السلة سيمرّر الصفحة خلفها");
  assert.match(panel, /\[data-cart-empty="1"\]\[data-sheet="peek"\] \.cart-lines \{ display: none; \}/, "السلة الفارغة لا تنكمش فعلًا");
  assert.match(panel, /html\.is-sales-sheet-open body \{ overflow: hidden; \}/, "الصفحة تتمرّر خلف الورقة المفتوحة");
  assert.match(panel, /html\.is-sales-sheet-mobile \.sales-layout \{ padding-bottom: var\(--sales-sheet-reserve, 0px\); \}/, "لا حجز لمساحة السلة أسفل القائمة");
  assert.match(panel, /font-size: 10px;\n\s*font-weight: 800;/, "تسميات المقبض ليست بخط الواجهة نفسه");
});

test("أرضية peek مقيسة من DOM: الإجمالي وزر الدفع لا يُقصّان أبدًا", () => {
  const bar = sheet.slice(sheet.indexOf("function salesSheetBarHeight"));
  const barBody = bar.slice(0, bar.indexOf("\n}\n") + 3);
  assert.match(barBody, /\.cart-sheet__handle[\s\S]*\.cart-panel__head[\s\S]*\.cart-total/, "أرضية الارتفاع يجب أن تجمع المقبض والرأس والإجمالي");
  assert.match(barBody, /offsetHeight/, "الأرضية لا تُقاس من DOM");
  assert.match(barBody, /pad \+ shown\.reduce\(\(sum, height\) => sum \+ height, 0\)/, "الأرضية لا تجمع ارتفاعات الأجزاء المقاسة");
  const geo = sheet.slice(sheet.indexOf("function salesSheetGeometry"), sheet.indexOf("function applySalesSheetGeometry"));
  assert.match(geo, /Math\.max\(120,\s*bar/, "peek لا يحترم الأرضية المقيسة");
  assert.match(geo, /salesSheetBarHeight\(/, "الهندسة لا تسأل عن الأرضية");
  // أثناء السحب لا يجوز أن ينزل الحد عن الأرضية، وإلا قُصّ الإجمالي في منتصف الحركة
  const gestures = sheet.slice(sheet.indexOf("function installSalesSheetGestures"));
  assert.match(gestures, /salesSheetGeometry\(panel\)/, "حدود السحب تُحسب بلا اللوحة نفسها");
});

test("دورة حياة الطبقات: مغادرة صفحة المبيعات تُحرّر قفل التمرير وتُعيد الزر العائم", () => {
  const apply = sheet.slice(sheet.indexOf("function applySalesSheetGeometry() {"));
  const applyBody = apply.slice(0, apply.indexOf("\n}\n") + 3);
  const guard = applyBody.indexOf("if (!panel || !layout) return false;");
  assert.ok(guard > 0, "حد اللوحة غير موجود");
  const toggleMobile = applyBody.indexOf('classList.toggle("is-sales-sheet-mobile", mobile)');
  const toggleOpen = applyBody.indexOf('classList.toggle("is-sales-sheet-open"');
  assert.ok(toggleMobile > 0 && toggleMobile < guard, "طبقة <html> تُدار بعد الخروج المبكر — فتبقى عالقة على بقية الصفحات");
  assert.ok(toggleOpen > 0 && toggleOpen < guard, "قفل التمرير يُدار بعد الخروج المبكر — تتجمد الصفحات الأخرى");
  assert.match(applyBody, /is-sales-sheet-open",\s*mobile && state\.salesSheet === "full"/, "قفل التمرير لا يشترط أن تكون الورقة قائمة");
  assert.doesNotMatch(sheet, /classList\.toggle\("is-sales-sheet-open", next === "full"\)/, "التبديل يعيد إدارة الطبقة خارج الهندسة فينقطع التزامن");
});

test("الزر العائم لا يغطي زر الدفع: z:31 فوق الورقة، فيُخفى ما دامت قائمة", () => {
  assert.match(css, /\.sales-scanner-fab \{[^}]*z-index:\s*31/, "تغيّر ترتيب الزر العائم — راجع قاعدة الإخفاء");
  const sheetZ = Number(/\.cart-sheet\.is-sheet-mobile \{[^}]*z-index:\s*(\d+)/.exec(css)[1]);
  assert.ok(sheetZ < 31, `الورقة (${sheetZ}) صارت فوق الزر العائم — يمكن إلغاء الإخفاء`);
  assert.match(css, /html\.is-sales-sheet-mobile \.sales-scanner-fab \{ display: none; \}/, "الزر العائم لم يُخفَ أثناء الورقة فيهبط على زر الدفع");
  // مدخل الماسح في شريط بحث المبيعات يبقى (الإخفاء يخصّ الزر العائم وحده)
  assert.match(salesMarkup, /data-action="open-scanner" data-mode="sale"/, "لا مدخل مسح في صفحة المبيعات بعد إخفاء الزر العائم");
});

test("لا انزلاق في التخطيط الأكبر: لا قاعدة وسائط تُفعّل الورقة على الحاسوب", () => {
  // نطاق الورقة فقط: من عنوان بلوكها إلى أول عنوان بلوك يليه (كان يمتد لنهاية الملف
  // فيبتلع أي قسم CSS يُضاف بعده، كبلوك بطاقات الرئيسية).
  const block = /\/\* ===== سلة البيع كورقة سفلية[\s\S]*?(?=\n\/\* =====|$)/.exec(css)[0];
  assert.doesNotMatch(block, /@media \((?:max|min)-width/, "ورقة الهاتف مفُعّلة بوسائط عرض — تتعارض مع عمود السلة الجانبي من 600px");
  assert.match(appJs, /window\.matchMedia\?\.\("\(max-width: 599px\)"\)\.matches/, "البوابة الوحيدة ليست مطابقة عرض الهاتف");
});

test("لا وميض حجم ولا تحديد نص: الورقة تُرسم بطبقتها وارتفاعها، والحركة عند الطلب", () => {
  const hint = appJs.slice(appJs.indexOf("const salesSheetPaint = {"), appJs.indexOf("function salesSheetPaintStyle"));
  assert.ok(hint.length > 80 && hint.length < 900, "تعذّر استخراج تلميح الرسم");
  assert.match(appJs, /function salesSheetPaintStyle\(kind\) \{[\s\S]{0,320}if \(!salesSheetPaint\.mobile \|\| salesSheetPaint\.height <= 0\) return "";/, "التلميح يُولّد سمة فارغة قبل أول قياس — يعود الوميض");
  assert.match(appJs, /--sales-sheet-h:\$\{salesSheetPaint\.height\}px;--sales-sheet-nav:\$\{salesSheetPaint\.nav\}px/, "الارتفاع المقيس لا يُكتب في القالب");
  const block = /\/\* ===== سلة البيع كورقة سفلية[\s\S]*?(?=\n\/\* =====|$)/.exec(css)[0];
  assert.match(block, /\.cart-sheet\.is-sheet-mobile \{[\s\S]*?transition: none;/, "الانتقال على الحالة الدائمة: كل إعادة تصيير ستُنشئ حركة لا يطلبها المستخدم");
  assert.match(block, /\.cart-sheet\.is-sheet-mobile\.is-sheet-animating \{ transition: height \.22s var\(--ease-out\); \}/, "لا حركة عند التبديل الفعلي");
  assert.match(block, /:where\(\.cart-sheet__handle,[^)]*\) \{ -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; \}/, "أزرار الورقة تقبل تحديد النص ⇒ منبّه نسخ/لصق/تحديد مع الضغط المتكرر");
  assert.match(block, /\.cart-sheet\.is-sheet-mobile input, \.cart-sheet\.is-sheet-mobile select, \.cart-sheet\.is-sheet-mobile textarea \{ -webkit-user-select: text; user-select: text; \}/, "حقول الكمية والسعر والخصم صارت غير قابلة للتحرير/التحديد");
  assert.match(block, /\.cart-sheet\.is-sheet-mobile \{ -webkit-tap-highlight-color: transparent; \}/, "مربع اللمس الرمادي يبقى على الأزرار");
});

test("لا قفزة إلى أعلى الصفحة: تصيير يحفظ الموضع للسلة وخانات الطي", () => {
  const helper = appJs.slice(appJs.indexOf("function renderKeepingScroll() {"), appJs.indexOf("function render() {"));
  assert.ok(helper.length > 250 && helper.length < 1400, "تعذّر استخراج renderKeepingScroll");
  assert.match(helper, /const y = Math\.round\(window\.scrollY \|\| document\.documentElement\.scrollTop \|\| 0\);/, "موضع النافذة لا يُؤخذ قبل التصيير");
  assert.match(helper, /window\.scrollTo\(x, y\)/, "موضع النافذة لا يُعاد");
  assert.match(helper, /querySelector\("\.cart-lines"\)\?\.scrollTop \|\| 0/, "تمرير قائمة الأسطر داخل الورقة لا يُحفظ");
  assert.match(helper, /list\.scrollTop = innerTop/, "قائمة الأسطر تعود لأعلى القائمة مع كل ضغطة");
  assert.match(helper, /html\.style\.overflowAnchor = "none";[\s\S]{0,200}const restore = \(\)/, "مرساة التمرير في المتصفح تُزحزح الصفحة أثناء إعادة التصيير");
  assert.match(helper, /render\(\);\n  restore\(\);[\s\S]{0,140}let frames = 0;\n  const tail = \(\) => \{\n    restore\(\);/, "الاسترجاء لا يعمل بعد التصيير مباشرة")
  assert.match(helper, /const tail = \(\) => \{\n    restore\(\);\n    frames \+= 1;\n    if \(frames < 4\) requestAnimationFrame\(tail\);\n    else html\.style\.overflowAnchor = anchorWas;/, "الاسترجاء لا يُعيد الضبط بعد إطار التسوية (مرساة التمرير)");
  const cartStart = appJs.indexOf("function changeCart(productId, delta) {");
  const cart = appJs.slice(cartStart, appJs.indexOf("\n}\n", cartStart) + 3);
  assert.match(cart, /renderKeepingScroll\(\)/, "الضغط على + أو − يعيد التصيير الكامل ويهدر موضع المستخدم");
  assert.doesNotMatch(cart, /[^a-zA-Z]render\(\)/, "changeCart ما زال يستدعي render مباشرة");
  assert.match(appJs, /if \(action === "cart-remove"\)[\s\S]{0,200}renderKeepingScroll\(\)/, "حذف سطر يعيد التصيير بقفزة للأعلى");
  assert.match(appJs, /if \(action === "add-cart"\) \{ addToCart\(id\); return; \}/, "الإجراء نفسه تغيّر — راجع اختبار الإضافة");
  const add = appJs.slice(appJs.indexOf("function addToCart("), appJs.indexOf("function addToCart(") + 1600);
  assert.match(add, /renderKeepingScroll\(\)/, "إضافة منتج من منتصف القائمة تُرجع المستخدم إلى أعلاها");
  assert.match(appJs, /if \(action === "toggle-report-panel"\)[\s\S]{0,240}renderKeepingScroll\(\)/, "خانة الطي في الصندوق/التقارير تقفز بالصفحة إلى الأعلى");
  assert.match(appJs, /#cash-filter[\s\S]{0,260}await refresh\(\); renderKeepingScroll\(\)/, "فلترة الفترة في الصندوق تعيد التصيير بقفزة إلى الأعلى");
  const sync = appJs.slice(appJs.indexOf("function syncMobileNavigation() {"), appJs.indexOf("async function handleSetup(event) {"));
  assert.match(sync, /if \(!bottomNav \|\| !bottomNav\.offsetWidth \|\| bottomNav\.scrollWidth <= bottomNav\.clientWidth \+ 1\) return;/, "توسيط عنصر التنقّل يعمل على الحاسوب حيث الشريط مخفيّ — فيزيح الصفحة كلها");
  assert.match(sync, /const keepY = Math\.round\(window\.scrollY \|\| 0\);[\s\S]{0,220}window\.scrollTo\(Math\.round\(window\.scrollX \|\| 0\), keepY\);/, "توسيط الشريط السفلي لا يعيد الموضع الرأسي للصفحة");
});

test("زر إغلاق السلة يلغي البيع ويبرز أرقام الأسعار والإجمالي", () => {
  assert.match(appJs, /if \(action === "close-sales-sheet"\) \{ state\.cart = \[\]; state\.cartDiscount = ""; state\.salesSheet = "peek"; renderKeepingScroll\(\); return; \}/);
  assert.match(salesMarkup, /class="cart-sheet-close" type="button" data-action="close-sales-sheet"/);
  assert.match(css, /@font-face[\s\S]{0,180}font-family: "DS-Digital"[\s\S]{0,180}ds-digital\.woff/);
  assert.match(css, /\[data-cart-subtotal\][\s\S]{0,240}font-size: clamp\(26px, 4vw, 38px\)[\s\S]{0,160}font-family: "DS-Digital"/);
  assert.match(css, /\.checkout-launch[\s\S]{0,260}font-family: "DS-Digital"/);
});
