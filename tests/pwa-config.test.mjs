import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("يتضمن ملف PWA هوية ونطاقًا وأيقونات صالحة للتثبيت الخارجي", async () => {
  const manifest = JSON.parse(await readFile(new URL("../client/public/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.icons.length, 2);
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.ok(manifest.icons.every((icon) => icon.src.startsWith("./")));
});

test("لا يربط عامل الخدمة تخزينه الابتدائي بمسار خاص بنطاق Manus", async () => {
  const worker = await readFile(new URL("../client/public/service-worker.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../client/src/main.js", import.meta.url), "utf8");
  assert.match(worker, /hesabi-pwa-v25/);
  assert.doesNotMatch(worker, /https:\/\/hesabipwa-2r9mmdzn\.manus\.space/);
  assert.match(worker, /event\.request\.mode === "navigate"/);
  assert.match(worker, /fetch\(event\.request\)/);
  assert.match(worker, /cacheApplicationShell/);
  assert.match(worker, /referencedAssetUrls/);
  assert.match(worker, /url\\\(/);
  assert.match(worker, /\(\?:=\|:\)/);
  assert.match(worker, /pendingUrls/);
  assert.match(worker, /isTextAsset/);
  assert.match(worker, /fetch\(event\.request, \{ cache: "no-store" \}\)/);
  assert.match(worker, /\.catch\(\(\) => caches\.match\(SCOPE_PATH\)\.then\(\(cached\) => cached \|\| Response\.error\(\)\)\)/);
  assert.match(worker, /cache: "no-store"/);
  assert.match(main, /navigator\.serviceWorker\.register\("\/service-worker\.js"\)/);
});

test("يستمر التطبيق محليًا بعد أول تحميل عبر كاش الواجهة والأصول", async () => {
  const worker = await readFile(new URL("../client/public/service-worker.js", import.meta.url), "utf8");
  assert.match(worker, /const APP_SHELL = \[SCOPE_PATH, `\$\{SCOPE_PATH\}manifest\.json`, `\$\{SCOPE_PATH\}service-worker\.js`\]/);
  assert.match(worker, /pendingUrls\.push\(\.\.\.discoveredUrls/);
  assert.match(worker, /if \(event\.request\.mode === "navigate"\)/);
  assert.match(worker, /fetch\(event\.request, \{ cache: "no-store" \}\)/);
  assert.match(worker, /cached \|\| Response\.error\(\)/);
  assert.match(worker, /cache\.put\(event\.request, response\.clone\(\)\)/);
});

test("يوصّل عامل الخدمة النسخة الجديدة بدل حبس الكاش القديم، ويعطّل نفسه في وضع التطوير", async () => {
  const worker = await readFile(new URL("../client/public/service-worker.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../client/src/main.js", import.meta.url), "utf8");

  // رقم إصدار الكاش مرفوع، مع إبقاء سجل الإصدارات السابقة في التعليق
  assert.match(worker, /const CACHE_NAME = "hesabi-pwa-v(\d+)";/, "يجب تعريف إصدار كاش صريح");
  const version = Number(worker.match(/const CACHE_NAME = "hesabi-pwa-v(\d+)";/)[1]);
  assert.ok(version >= 31, `إصدار الكاش يجب أن يكون 31 أو أحدث، الحالي ${version}`);
  // السجل التاريخي يُتحقق بنيويًا بدل سلسلة حرفية، فرفع الإصدار لا يكسر الاختبار
  const history = [...worker.matchAll(/hesabi-pwa-v(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(history.length >= 2, "يجب أن يبقى سجل الإصدارات السابقة في التعليق");
  assert.ok(Math.max(...history) === version, "أحدث رقم في السجل يجب أن يكون الإصدار الفعلي الحالي");

  // استراتيجية «مخزَن ثم حدّث في الخلفية» للأصول بدل cache-first التي تحبس الكود القديم
  assert.match(worker, /const revalidate = fetch\(event\.request\)\.then/, "يجب تجديد الأصل من الشبكة في الخلفية");
  assert.match(worker, /return cached \|\| revalidate\.then\(\(response\) => response \|\| Response\.error\(\)\)/, "يُعرض المخزَّن فورًا ويُطلب الجديد عند غياب الكاش");
  assert.doesNotMatch(worker, /cached \|\| fetch\(event\.request\)\.then/, "أُزيلت استراتيجية cache-first القديمة للأصول");
  assert.match(worker, /cache\.put\(event\.request, response\.clone\(\)\)/, "يستمر حفظ الأصل الجديد في الكاش");

  // يبقى العمل دون اتصال محفوظًا: التنقل من الشبكة مع رجوع للكاش، والأصول من الكاش عند فشل الشبكة
  assert.match(worker, /if \(event\.request\.mode === "navigate"\)/);
  assert.match(worker, /\.catch\(\(\) => caches\.match\(SCOPE_PATH\)\.then\(\(cached\) => cached \|\| Response\.error\(\)\)\)/);
  assert.match(worker, /\.catch\(\(\) => null\)/, "فشل الشبكة أثناء التجديد لا يكسر العرض من الكاش");

  // وضع التطوير لا يسجّل عامل خدمة ويزيل ما سبق تسجيله حتى تظهر التعديلات فورًا
  assert.match(main, /if \(import\.meta\.env\.DEV\) \{/, "يفرق التسجيل بين التطوير والإنتاج");
  assert.match(main, /registration\.unregister\(\)/, "يزيل عامل الخدمة القديم في التطوير");
  assert.match(main, /caches\.delete\(key\)/, "يمسح كاش الواجهة في التطوير");
  assert.match(main, /navigator\.serviceWorker\.register\("\/service-worker\.js"\)/, "يبقى التسجيل للإنتاج");
});
