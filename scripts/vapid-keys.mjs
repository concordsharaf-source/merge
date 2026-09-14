#!/usr/bin/env node
/**
 * يولّد زوج مفاتيح VAPID لحسابي (ECDSA/P‑256، بصيغة Web Push).
 *
 * لماذا قد تحتاجه؟ التطبيق يُنشئ المفاتيح بنفسه من جهاز الأدمن عند تفعيل الإشعارات،
 * فلا خادم ولا خدمة خارجية. هذا السكربت للتشغيل اليدوي: طباعة المفتاح العام لبناء
 * VITE_PUSH_VAPID_PUBLIC_KEY، أو تجهيز قيمة مستقرّة قبل أن يُفعَّل أي جهاز.
 *
 * الاستخدام:
 *   pnpm vapid:keys
 *   pnpm vapid:keys -- --export-env
 *   pnpm vapid:keys -- --out .env.push     (يكتب ملفًا، ولا يطبع السرّ على الشاشة)
 */
import { appendFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";

const relay = await import(fileURLToPath(new URL("../client/src/js/push-relay.js", import.meta.url)));

if (!globalThis.crypto?.subtle) globalThis.crypto = crypto.webcrypto;

const args = process.argv.slice(2);
const wantsEnv = args.includes("--export-env");
const outIndex = args.indexOf("--out");
const outFile = outIndex >= 0 ? args[outIndex + 1] : "";

if (!relay.curveIsSane()) {
  console.error("ثوابت منحنى P‑256 في push-relay.js محرفة — لا تُستخدم أي مفاتيح.");
  process.exit(1);
}

const { privateKey, publicKey } = await relay.generateVapidKeypair();

if (outFile) {
  const body = `VITE_PUSH_VAPID_PUBLIC_KEY=${publicKey}\nHESABI_VAPID_PRIVATE_KEY=${privateKey}\n`;
  await (args.includes("--append") ? appendFile(outFile, body) : writeFile(outFile, body, { mode: 0o600 }));
  console.log(`كُتبت المفاتيح في ${outFile} (وضع 600). لا ترفع هذا الملف إلى Git.`);
  console.log(`المفتاح العام: ${publicKey}`);
} else if (wantsEnv) {
  console.log(`VITE_PUSH_VAPID_PUBLIC_KEY=${publicKey}\nHESABI_VAPID_PRIVATE_KEY=${privateKey}`);
} else {
  console.log(JSON.stringify({ publicKey, privateKey }, null, 2));
  console.error("\nتنبيه: السرّ الخاص يُخزَّن في stores/<id>/push/config ويقرأه جهاز الأدمن فقط.");
  console.error("إن كان الغرض تشغيلًا فعليًا للمتجر، فعّل الإشعارات من التطبيق — سيولّد المفاتيح ويسجّلها بنفسه.");
}
