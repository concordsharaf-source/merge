/* يختبر مسار تعليق الفاتورة (hold invoice) الذي كان يفشل برسالة خطأ عامة بسبب دوال غير معرّفة في app.js. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateSaleTotals, nowIso } from "../client/src/js/domain.js";

const appJs = await readFile(new URL("../client/src/js/app.js", import.meta.url), "utf8");

/** رموز تظهر كأنها استدعاءات دوال داخل نصوص CSS/HTML أو اختصارات كائنات، وليست دوالًا عامة. */
const CSS_AND_METHOD_TOKENS = new Set(["child", "complete", "minmax", "not", "repeat", "rgba", "url", "update", "format"]);

const BROWSER_GLOBALS = new Set([
  "String", "Number", "Boolean", "Object", "Array", "JSON", "Math", "Date", "Promise", "Map", "Set", "WeakMap", "WeakSet",
  "Error", "TypeError", "RangeError", "Symbol", "BigInt", "RegExp", "Intl", "parseFloat", "parseInt", "isNaN", "isFinite",
  "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI", "Uint8Array", "Int8Array", "Uint8ClampedArray",
  "Float32Array", "Float64Array", "ArrayBuffer", "DataView", "TextEncoder", "TextDecoder", "URL", "URLSearchParams",
  "Blob", "File", "FileReader", "FormData", "AbortController", "AbortSignal", "console", "window", "document",
  "localStorage", "sessionStorage", "navigator", "location", "history", "fetch", "setTimeout", "clearTimeout",
  "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "crypto", "indexedDB",
  "structuredClone", "queueMicrotask", "alert", "confirm", "prompt", "print", "matchMedia", "getComputedStyle",
  "atob", "btoa", "CustomEvent", "Event", "Image", "Audio", "Worker", "BroadcastChannel", "WebSocket",
  "BarcodeDetector", "ResizeObserver", "IntersectionObserver", "MutationObserver", "globalThis", "self", "caches",
  "performance", "screen", "DOMParser", "XMLHttpRequest", "Headers", "Request", "Response", "ReadableStream",
  "CompressionStream", "DecompressionStream", "FontFace",
]);

const KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "return", "function", "typeof", "new", "await", "import", "export", "else",
  "do", "try", "delete", "void", "in", "of", "case", "instanceof", "yield", "super", "this", "class", "extends",
  "const", "let", "var", "async", "get", "set",
]);

function declaredNames(source) {
  const declared = new Set();
  for (const match of source.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) declared.add(match[1]);
  for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(match[1]);
  for (const match of source.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    match[1].split(",").forEach((part) => { const name = part.split(":").pop().trim(); if (name) declared.add(name); });
  }
  for (const match of source.matchAll(/^import\s+([\s\S]*?)\s+from\s+["']/gm)) {
    const clause = match[1];
    for (const block of clause.matchAll(/\{([^}]*)\}/g)) {
      block[1].split(",").forEach((part) => { const name = part.split(/\s+as\s+/).pop().trim(); if (name) declared.add(name); });
    }
    for (const star of clause.matchAll(/\*\s+as\s+([\w$]+)/g)) declared.add(star[1]);
    const fallback = clause.replace(/\{[^}]*\}/g, "").replace(/,/g, "").trim();
    if (fallback && !fallback.startsWith("*")) declared.add(fallback);
  }
  for (const match of source.matchAll(/\(([^\()]*)\)\s*(?:=>|\{)/g)) {
    match[1].split(",").forEach((part) => {
      const name = part.replace(/[=\{\}\[\].]/g, " ").trim().split(/\s+/)[0];
      if (name && /^[\w$]+$/.test(name)) declared.add(name);
    });
  }
  for (const match of source.matchAll(/\bcatch\s*\(\s*([\w$]*)/g)) declared.add(match[1]);
  for (const match of source.matchAll(/\b([\w$]+)\s*=>/g)) declared.add(match[1]);
  for (const match of source.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([\w$]+)/g)) declared.add(match[1]);
  // اختصارات الكائنات مثل { update(percent) {}, complete(message) {} }
  for (const match of source.matchAll(/[{,]\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g)) declared.add(match[1]);
  return declared;
}

function unresolvedCalls(source) {
  const declared = declaredNames(source);
  const unresolved = new Set();
  for (const match of source.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = match[1];
    if (declared.has(name) || BROWSER_GLOBALS.has(name) || KEYWORDS.has(name) || CSS_AND_METHOD_TOKENS.has(name)) continue;
    unresolved.add(name);
  }
  return [...unresolved].sort();
}

test("يستورد app.js الدالة nowIso المستخدمة في تعليق الفاتورة وسند القبض", () => {
  const importLine = appJs.split("\n").find((line) => line.includes("from \"./domain.js\""));
  assert.ok(importLine, "يجب وجود سطر استيراد من domain.js");
  assert.match(importLine, /\bnowIso\b/, "يجب استيراد nowIso من domain.js في app.js");
  assert.equal(typeof nowIso, "function", "domain.js يصدّر nowIso");
  assert.ok(!Number.isNaN(Date.parse(nowIso())), "nowIso يعيد تاريخًا صالحًا");
});

test("لا يستدعي app.js دوالًا غير معرّفة تكسر تعليق الفاتورة وعرض المعلقة", () => {
  assert.doesNotMatch(appJs, /(?<![.\w$])formatDateTime\s*\(/, "formatDateTime غير معرّفة في app.js؛ استخدم dateTime");
  const unresolved = unresolvedCalls(appJs);
  assert.deepEqual(unresolved, [], `دوال مستدعاة في app.js بلا تعريف أو استيراد: ${unresolved.join("، ")}`);
});

test("يبني سجل الفاتورة المعلقة بوقت معلّق صالح وإجمالي مطابق للسلة", () => {
  const cart = [
    { productId: "p1", name: "أرز بسمتي", quantity: 2, unitPrice: 1500 },
    { productId: "p2", name: "زيت 1 لتر", quantity: 1, unitPrice: 900 },
  ];
  const totals = calculateSaleTotals(cart, "400");
  const held = {
    id: "held-1",
    note: "زبون #1",
    cart: JSON.parse(JSON.stringify(cart)),
    cartDiscount: "400",
    total: totals.total,
    itemsCount: cart.length,
    heldAt: nowIso(),
    heldByName: "الكاشير",
  };

  assert.equal(held.total, 3500, "الإجمالي بعد الخصم 3500");
  assert.equal(held.itemsCount, 2);
  assert.deepEqual(held.cart, cart, "نسخة السلة محفوظة كما هي");
  assert.ok(!Number.isNaN(Date.parse(held.heldAt)), "heldAt تاريخ ISO صالح للعرض والترتيب");
});

test("يتجاهل تحميل الفواتير المعلقة أي محتوى تالف في localStorage", () => {
  const loader = appJs.slice(
    appJs.indexOf("function loadHeldInvoicesFromStorage()"),
    appJs.indexOf("function saveHeldInvoicesToStorage(list)"),
  );
  assert.match(loader, /Array\.isArray\(parsed\)/, "يجب التحقق أن المحتوى المخزن مصفوفة قبل اعتماده");

  const load = new Function(
    "localStorage",
    `const HELD_INVOICES_STORAGE_KEY = "hesabi-held-invoices";\n${loader}\nreturn loadHeldInvoicesFromStorage();`,
  );
  const cases = [
    { value: null, expected: [] },
    { value: "{\"oops\":true}", expected: [] },
    { value: "not-json", expected: [] },
    { value: "[{\"id\":\"held-1\"},null]", expected: [{ id: "held-1" }] },
  ];
  for (const testCase of cases) {
    const store = { getItem: () => testCase.value };
    assert.deepEqual(load(store), testCase.expected, `الحالة: ${testCase.value}`);
  }
});

test("يبلّغ حفظ الفواتير المعلقة عن فشل التخزين بدل تجاهله بصمت", () => {
  const saver = appJs.slice(
    appJs.indexOf("function saveHeldInvoicesToStorage(list)"),
    appJs.indexOf("function formatTimeAgo(isoDate)"),
  );
  const save = new Function(
    "localStorage",
    `const HELD_INVOICES_STORAGE_KEY = "hesabi-held-invoices";\n${saver}\nreturn saveHeldInvoicesToStorage([{ id: "held-1" }]);`,
  );

  const working = { setItem: () => {} };
  assert.equal(save(working), true, "يعيد true عند نجاح الحفظ");

  const full = { setItem: () => { throw new Error("QuotaExceededError"); } };
  assert.equal(save(full), false, "يعيد false عند امتلاء تخزين الجهاز");

  assert.match(appJs, /const persisted = saveHeldInvoicesToStorage\(state\.heldInvoices\);/, "يستخدم مسار التعليق نتيجة الحفظ");
  assert.match(appJs, /في هذه الجلسة فقط؛ تعذر حفظها في تخزين الجهاز/, "رسالة تنبيه عند فشل حفظ الفاتورة المعلقة");
});

test("يمسح إعادة ضبط البيانات الفواتير المعلقة مع بقية السجل المحلي", () => {
  const resetLine = appJs.split("\n").find((line) => line.includes("async function resetAllData()"));
  assert.ok(resetLine, "يجب وجود دالة resetAllData");
  assert.match(resetLine, /state\.heldInvoices = \[\]; saveHeldInvoicesToStorage\(state\.heldInvoices\);/, "يجب تفريغ الفواتير المعلقة مع بقية السجل");
});

test("يحتوي مسار التعليق والاستعادة والحذف معالجة أخطاء برسالة عربية واضحة", () => {
  assert.match(appJs, /\[Hesabi hold invoice error\]/, "تسجيل خطأ تعليق الفاتورة في الطرفية");
  assert.match(appJs, /تعذر تعليق الفاتورة/, "رسالة خطأ واضحة عند فشل التعليق");
  assert.match(appJs, /\[Hesabi resume held invoice error\]/, "تسجيل خطأ استعادة الفاتورة المعلقة");
  assert.match(appJs, /\[Hesabi delete held invoice error\]/, "تسجيل خطأ حذف الفاتورة المعلقة");
  assert.match(appJs, /function heldInvoicesList\(\)/, "دالة موحّدة لإرجاع قائمة الفواتير المعلقة كمصفوفة");
  assert.match(appJs, /dateTime\(held\.heldAt\)/, "عرض وقت التعليق باستخدام dateTime المعرّفة في app.js");
});
