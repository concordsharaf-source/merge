/* يضمن حد قائمة المبيعات (40 صنفًا على الأقل) وتوهّج الأصناف المضافة للسلة،
   وأن الترتيب يعتمد على الأحدث بيعًا ثم الأكثر مبيعًا دون لمس منطق الحسابات. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appJs = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");
const salesMarkup = appJs.slice(appJs.indexOf("function salesMarkup() {"), appJs.indexOf("\nfunction cartLine(line) {"));

test("قائمة المبيعات محدودة بسقف ثابت وترتيبها بالأحدث ثم الأكثر مبيعًا", () => {
  // لم يبقَ السقف حارسًا للسلة — السلة الآن ورقة مثبّتة أسفل الشاشة، فالسقف للتحكّم في حجم DOM فقط
  const limit = Number(appJs.match(/const SALES_CATALOG_LIMIT = (\d+);/)?.[1]);
  assert.ok(limit >= 40, `السقف كان 40 صنفًا بعد ثبات السلة، الحالي ${limit}`);
  assert.ok(limit <= 60, `سقف ${limit} كبير على قائمة تُعرض كاملة في DOM`);
  assert.match(appJs, /\.slice\(0, SALES_CATALOG_LIMIT\)/, "يجب تطبيق الحد على نتائج المبيعات بدل رقم ثابت");
  assert.doesNotMatch(salesMarkup, /\.slice\(0, 7\)/, "عاد حد السبعة الأصناف القديم");
  assert.doesNotMatch(salesMarkup, /\.slice\(0, 10\)/, "عاد الحصر العشري اليدوي خارج الثابت");
  assert.match(appJs, /function salesRankedProducts\(\)/, "ترتيب الأصناف يجب أن يكون في دالة مستقلة");
  assert.match(appJs, /if \(a\.lastSoldAt !== b\.lastSoldAt\) return a\.lastSoldAt < b\.lastSoldAt \? 1 : -1;/, "الأحدث بيعًا أولًا");
  assert.match(appJs, /if \(a\.sold !== b\.sold\) return b\.sold - a\.sold;/, "ثم الأكثر مبيعًا بالكمية");
  // الترتيب يقرأ فقط مما هو محمّل أصلًا في state — لا عملية قاعدة بيانات جديدة
  assert.doesNotMatch(appJs.slice(appJs.indexOf("function salesRankedProducts"), appJs.indexOf("function salesMarkup")), /db\.|await /, "الدالة يجب أن تكون نقية بلا I/O");
  // عند غياب سجل المبيعات يجب أن يسقط بأمان لكل المنتجات لا لقائمة فارغة
  assert.match(appJs, /if \(!Array\.isArray\(key\) \|\| !key\.length\) return products;/, "بدون سجل مبيعات تُعرض كل المنتجات");
});

test("الصنف المضاف للسلة الحالية يظهر حوله توهج ولا يختفي من القائمة", () => {
  assert.match(salesMarkup, /const cartProductIds = new Set\(state\.cart\.map\(\(line\) => line\.productId\)\);/, "مجموعة أصناف السلة");
  assert.match(salesMarkup, /inCart \? "is-in-cart"/, "الكلاس يُربط بوجود الصنف في السلة");
  assert.match(salesMarkup, /aria-pressed="\$\{inCart\}"/, "حالة الضغط معلَمة لقارئ الشاشة");
  // لا يُدرج شي فوق الحد: الإضافة كانت تدفع السلة للأسفل مرة أخرى
  assert.doesNotMatch(salesMarkup, /matches\.unshift\(product\)/, "عادت إضافة أصناف السلة خارج الحد");
  assert.doesNotMatch(salesMarkup, /SALES_CATALOG_LIMIT \+ 4/, "عاد سقف الإضافة +4");
  assert.match(css, /\.sale-product\.is-in-cart \{[^}]*box-shadow:/, "التوهج مرسوم بـ box-shadow");
  assert.match(css, /animation:hesabiCartHalo/, "نبض التوهج بطيء وخفيف");
  assert.match(css, /@keyframes hesabiCartHalo \{[\s\S]*?from \{ box-shadow:[\s\S]*?\} to \{ box-shadow:/, "التوهج يتنفس بين حالتين");
  assert.match(css, /\[data-theme="dark"\] \.sale-product\.is-in-cart/, "الوضع الداكن مغطى");
});

test("البحث يسبق القطع، والتوهج لا يتعارض مع وميض الإضافة", () => {
  assert.match(salesMarkup, /\.filter\(\(product\) => !query \|\|/, "البحث يبقى مطبّقًا قبل القطع");
  assert.match(salesMarkup, /const matches = ranked\.slice\(0, SALES_CATALOG_LIMIT\);/, "الحد يُطبّق بعد الترتيب والبحث");
  assert.match(salesMarkup, /\$\{isFlash \? "is-flash-added" : ""\}/, "وميض الإضافة الأصلي لم يُزل");
});
