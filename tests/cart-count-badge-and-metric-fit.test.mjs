/* اختباران بصريان فقط، بلا مساس بالمنطق المحاسبي:
   ١) شارة الصنف في قائمة المبيعات: + قبل الإضافة، ✓ لأول حبة، ثم العدد (2، 3، …).
   ٢) تصغير أرقام بطاقات لوحة التحكم عند كثرة منازلها، مع بقائها في سطر واحد.
   يشغّل fitMetricValues على DOM وهمي للتأكد أنه يغيّر حجم الخط وحده ولا يمسّ القيمة. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appJs = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../client/src/style.css", import.meta.url), "utf8");

const sliceFn = (name) => {
  const at = appJs.indexOf(`function ${name}(`);
  assert.ok(at > -1, `تعذّر العثور على ${name}`);
  const end = appJs.indexOf("\nfunction ", at + 10);
  return appJs.slice(at, end > -1 ? end : undefined);
};

const salesBody = sliceFn("salesMarkup");
const fitBody = sliceFn("fitMetricValues");

test("شارة الصنف: ✓ لأول حبة والعدد لكل ما فوقها", () => {
  assert.ok(salesBody.length > 400, "تعذّر استخراج salesMarkup");
  // الكمية تُقرأ من السلة فقط، مجموع سطور نفس الصنف
  assert.match(
    salesBody,
    /const cartQty = inCart \? state\.cart\.reduce\(\(sum, line\) => \(line\.productId === product\.id \? sum \+ toNumber\(line\.quantity\) : sum\), 0\) : 0;/,
    "لم يعد حساب الكمية مجموع كميات سطر الصنف نفسه",
  );
  // أول حبة = أيقونة صح، وما بعدها = رقم
  assert.match(salesBody, /cartQty > 1 \? `\$\{amount\(cartQty\)\}` : icon\("check", 18\)/, "لم تعد الشارة تعرض ✓ عند 1 والعدد عند أكثر من 1");
  // الصنف غير المضاف يبقى على علامة +
  assert.match(salesBody, /: icon\("plus", 18\)\}<\/i>/, "اختفت علامة + من الأصناف غير المضافة");
  // الرقم محاط بالعناية: اتجاه LTR، ووسم قارئ شاشة، وفئة تنسيق
  assert.match(salesBody, /dir="ltr" aria-label="\$\{amount\(cartQty\)\} في السلة"/, "فقد العدّاد وسم القراءة أو اتجاهه");
  assert.match(salesBody, /class="\$\{inCart \? "sale-product__count" : ""\}"/, "فقدت الشارة فئتها عند الإضافة");
  // وسطر الصنف لا يزال يخبر بالكمية نصًا
  assert.match(salesBody, /متاح\$\{inCart \? ` · \$\{amount\(cartQty\)\} في السلة` : ""\}/, "اختفى نص «N في السلة» من سطر الصنف");
  // لا منطق محاسبي جديد داخل طبقة العرض: لا كتابة على السلة
  assert.doesNotMatch(salesBody, /state\.cart =|state\.cart\.push|state\.cart\.splice|state\.cart\.forEach/, "تغيّر منطق السلة داخل طبقة العرض");
});

test("تنسيق العدّاد يسمح بنمو الشارة فلا يُقطع الرقم", () => {
  // يجب أن تتفوق القاعدة على .sale-product i (أسبقية 0,1,1) وإلا مُحت width منها
  const rule = css.match(/\.sale-product i\.sale-product__count\s*\{[^}]*\}/);
  assert.ok(rule, "اختفت قاعدة تنسيق العدّاد أو فقدت أسبقيتها فوق .sale-product i");
  assert.match(rule[0], /width:\s*max-content/, "عاد عرض الشارة ثابتًا فقطُقطت الأرقام الطويلة");
  assert.match(rule[0], /min-width:\s*28px/, "لم تعد الشارة تحتفظ بمربع 28px للأرقام القصيرة");
  assert.doesNotMatch(css, /\.sale-product__count\.is-tight/, "بقيت فئة is-tight بلا مُطابِق في المصدر");
});

test("fitMetricValues يقيس ويُصغّر فقط — ولا يلمس القيمة", () => {
  assert.ok(fitBody.length > 300, "تعذّر استخراج fitMetricValues");
  const writes = [...fitBody.matchAll(/\.style\.([A-Za-z-]+)\s*=/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(writes)], ["fontSize"], "لم يعد التصحيح يغيّر حجم الخط وحده");
  assert.doesNotMatch(fitBody, /textContent\s*=|innerHTML\s*=|value\s*=/, "يكتب fitMetricValues على المحتوى");
  assert.doesNotMatch(fitBody, /state\.|saveDatabase|dispatchEvent|toaster\(/, "يمسّ fitMetricValues حالة التطبيق أو الأحداث");
  assert.match(fitBody, /Math\.max\(8,/, "اختفى الحد الأدنى للتصغير (8px)");
  assert.match(fitBody, /probe\.setAttribute\(\s*"style",[\s\S]{0,240}?white-space:nowrap/, "لم تعد النسخة العائمة للقياس تمنع الالتفاف");
  // يعمل بعد كل رسم، داخل إطار رسم، ولا يُسقط الواجهة لو فشل القياس
  assert.match(appJs, /requestAnimationFrame\(\(\) => \{\s*try \{ fitMetricValues\(\); \} catch \{/, "لم يعد التصغير يعمل بعد تحديث الواجهة أو صار قادرًا على إسقاطها");
  // سطر واحد مضمون في كل المقاسات: القاعدة المضافة أخيرًا تتغلب على وسائط max-width:599px
  const appended = css.slice(css.indexOf(".metric-card strong, .daily-ribbon__value"));
  assert.ok(appended.length > 0, "اختفت قاعدة nowrap المضافة لأرقام البطاقات");
  assert.match(appended, /white-space:\s*nowrap/, "لم يعد nowrap مفروضًا على أرقام البطاقات");
  assert.doesNotMatch(appended, /white-space:\s*normal/, "أُلغيت قاعدة الالتفاف في آخر الملف");
});

test("fitMetricValues على DOM وهمي: الطويل يُصغَّر والقصير يبقى بحجمه", () => {
  // دمية بواجهة DOM بقدر ما تحتاجه الدالة فقط: قياس، بلا ترتيب حقيقي
  const makeCard = (value, boxWidth, charWidth = 7) => {
    const grid = { id: value }; // كل بطاقة في مجموعتها الخاصة، كشبكة مستقلة
    const strong = { style: {}, textContent: value, remove() {} };
    const parent = {
      clientWidth: boxWidth,
      appendChild() {},
      getBoundingClientRect: () => ({ left: 0, right: boxWidth, width: boxWidth }),
    };
    strong.parentElement = parent;
    strong.closest = (sel) => (sel === ".metric-grid" ? grid : null);
    strong.getBoundingClientRect = () => ({ left: 0, right: Math.round((value.length * charWidth * 19) / 19), width: Math.round(value.length * charWidth) });
    // النسخة العائمة تُقاس بحجم خطها فعلًا، كما في المتصفح
    strong.cloneNode = () => ({
      style: {},
      setAttribute(_key, declaration) {
        this.size = parseFloat(String(declaration).match(/font-size:([0-9.]+)px/)?.[1]) || 19;
        this.decl = String(declaration);
      },
      removeAttribute() {},
      remove() {},
      getBoundingClientRect() {
        const width = Math.round((value.length * charWidth * this.size) / 19);
        return { width, left: 0, right: width };
      },
    });
    return { strong };
  };
  const src = [
    "const scope = { querySelectorAll: (sel) => (String(sel).startsWith('.metric-card strong,') ? cards.map((c) => c.strong) : []) };",
    fitBody,
    "fitMetricValues(scope);",
    'return cards.map((c) => c.strong.style.fontSize || "auto");',
  ].join("\n");
  const runFit = new Function("getComputedStyle", "cards", src);
  const gcs = (el) => ({ fontSize: (el && el.style && el.style.fontSize) || "19px", paddingLeft: "0px", paddingRight: "0px" });

  // رقم أطول من بطاقته ⇒ يُصغَّر حتى يدخل، ولا ينزل تحت الحد
  const tight = makeCard("1,250,000,000", 60, 9); // 13 حرفًا × 9px = 117px مقابل بطاقة 60px
  const shrunk = runFit(gcs, [tight])[0];
  assert.notEqual(shrunk, "auto", "لم يُصغَّر رقم لا يدخل في بطاقته");
  const px = parseFloat(shrunk);
  assert.ok(px >= 8 && px < 19, `حجم التصغير خارج الحدود: ${shrunk}`);
  assert.ok((117 * px) / 19 <= 60, `التصغير لم يكفِ ليخرج النص من البطاقة: ${shrunk} → ${Math.round((117 * px) / 19)}px`);

  // رقم يدخل أصلًا ⇒ لا يُمسّ إطلاقًا
  const roomy = makeCard("1,250", 400);
  assert.equal(runFit(gcs, [roomy])[0], "auto", "صُغِّر رقم كان داخل بطاقته بلا حاجة");

  // القيمة نفسها لا تتغيّر أبدًا — هذا شكل لا محاسبة، ولا يُكتب على العنصر غير حجم الخط
  assert.equal(tight.strong.textContent, "1,250,000,000", "تغيّرت قيمة الرقم — وهذا منطق محاسبي لا شكل");
  assert.deepEqual(Object.keys(tight.strong.style).sort(), ["fontSize"], "كُتب على غير حجم الخط");
  assert.ok(!roomy.strong.style.fontSize, "البطاقة الواسعة صُغّرت بلا داعٍ");

  // صفحة بلا بطاقات لا تُرمي خطأ (الدالة تُستدعى بعد كل رسم)
  assert.deepEqual(runFit(gcs, []), [], "انكسرت الدالة على صفحة بلا بطاقات");
});
