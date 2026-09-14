import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("يحافظ غلاف Android على هوية حسابي وأصول الويب المحلية", async () => {
  const config = await read("capacitor.config.ts");
  const manifest = await read("android/app/src/main/AndroidManifest.xml");
  const activity = await read("android/app/src/main/java/com/hesabi/app/MainActivity.java");
  const nativeConfig = await read("android/app/src/main/assets/capacitor.config.json");
  assert.match(config, /appId:\s*["']com\.hesabi\.app["']/);
  assert.match(nativeConfig, /"appId"\s*:\s*"com\.hesabi\.app"/);
  assert.match(config, /appName:\s*["']حسابي["']/);
  assert.match(config, /webDir:\s*["']dist\/public["']/);
  assert.match(manifest, /android:name="\.MainActivity"/);
  assert.match(activity, /package com\.hesabi\.app/);
});

test("يضم غلاف Android نسخة الويب المبنية مع عامل الخدمة", async () => {
  const shell = await read("android/app/src/main/assets/public/index.html");
  const worker = await read("android/app/src/main/assets/public/service-worker.js");
  const source = await read("client/public/service-worker.js");
  assert.match(shell, /<script[^>]+src=/);
  assert.match(shell, /\/assets\/[^"']+\.js/);
  // إصدار الكاش يُشتق من المصدر بدل تثبيت رقم حرفي، فلا ينكسر عند كل رفع إصدار
  assert.match(worker, /const CACHE_NAME = "hesabi-pwa-v\d+";/, "يجب أن يضم الغلاف تعريف إصدار كاش صريحًا");
  assert.equal(worker, source, "عامل الخدمة في غلاف Android يجب أن يبقى مطابقًا لمصدر client/public بدل نسخة مجمّدة");
});
