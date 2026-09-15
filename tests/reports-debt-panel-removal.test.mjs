/* يضمن أن لوحة «تقرير ديون العملاء» لم تعد في أعلى صفحة التقارير،
   مع بقاء التقرير متاحًا من قائمة التقارير، وبقاء لوحة المتابعة في لوحة التحكم. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appJs = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
const reportsBody = appJs.slice(appJs.indexOf("function reportsMarkup() {"), appJs.indexOf("\nfunction ", appJs.indexOf("function reportsMarkup() {") + 10));
const exportDialog = appJs.slice(appJs.indexOf("function openReportExportDialog()"), appJs.indexOf("\nfunction ", appJs.indexOf("function openReportExportDialog()") + 10));

test("صفحة التقارير لم تعد تعرض لوحة ديون العملاء في أعلاها", () => {
  assert.ok(reportsBody.length > 200, "تعذّر استخراج reportsMarkup");
  assert.doesNotMatch(reportsBody, /debt-report|debtReport/, "عاد قسم ديون العملاء إلى أعلى صفحة التقارير");
  assert.doesNotMatch(reportsBody, /debt-search|debt-sort|state\.debtQuery|state\.debtSort/, "بقيت عناصر بحث/فرز الديون بلا لوحة");
  assert.doesNotMatch(appJs, /bindSearchInput\("#debt-search"/, "بقي مستمع بحث الديون دون عنصر");
  assert.doesNotMatch(appJs, /#debt-sort/, "بقي مستمع فرز الديون دون عنصر");
  // أول محتوى بعد الشريط العلوي يجب أن يكون فلتر التاريخ لا لوحة ديون
  assert.match(reportsBody, /`\)}\n\s*<section class="toolbar toolbar--filter">/, "لم تعد صفحة التقارير تبدأ بفلتر التاريخ");
});

test("تقرير ديون العملاء يبقى متاحًا من قائمة التقارير", () => {
  assert.match(exportDialog, /data-financial-report="customers">ديون العملاء</, "اختفى زر ديون العملاء من قائمة التقارير");
  assert.match(appJs, /if \(type === "customers"\) return \[\["العميل", "الهاتف", "الرصيد المستحق"\]/, "اختفى جدول ديون العملاء من مولّد التقارير");
  assert.match(appJs, /customers: "تقرير ديون العملاء"/, "اختفى عنوان تقرير العملاء");
  // ولوحة التحكم الجديدة تحتفظ بمتابعة التحصيل عبر بطاقة الديون — لم نمسها
  assert.match(appJs, /ديون العملاء بالسوق/, "بطاقة ديون العملاء اختفت من الرئيسية الجديدة");
  assert.match(appJs, /mini\("customers"/, "بطاقة الديون لم تعد تقود للعملاء");
});
