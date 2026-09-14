/**
 * اختبار وصلات إشعارات Web Push. التشفير نفسه مُختبَر مقابل المعيار في
 * scripts/push-relay-reference.test.mjs (pnpm push:relay) — هذا الملف يضمن أن القطع
 * موصولة فعلًا ببعضها، وأن المنطق المحاسبي لم يُمَسّ، وأن القواعد لا تسمح بتسميم السجلّ.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const app = read("../client/src/js/app.js");
const coordinator = read("../client/src/js/sync-coordinator.js");
const notifications = read("../client/src/js/notifications.js");
const firebaseSync = read("../client/src/js/firebase-sync.js");
const relay = read("../client/src/js/push-relay.js");
const alerts = read("../client/src/js/push-alerts.js");
const serviceWorker = read("../client/public/service-worker.js");
const rules = read("../firestore.rules");
const packageJson = JSON.parse(read("../package.json"));

const slice = (source, from, to) => {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `المعرّف غير موجود: ${from}`);
  const end = source.indexOf(to, start + from.length);
  assert.notEqual(end, -1, `نهاية المقطع غير موجودة: ${to}`);
  return source.slice(start, end);
};

test("تفعيل الإشعارات يسجّل الجهاز، ولا يعود يعتمد على مفتاح البيئة", () => {
  const enable = slice(app, "async function enableNotifications() {", "function toggleNotificationTopic(");
  assert.match(enable, /await registerPushForThisDevice\(\)/, "المسار الجديد للتسجيل");
  assert.doesNotMatch(enable, /const vapidKey = import\.meta\.env/, "التسجيل لم يعد مشروطًا بمفتاح في البيئة");
  assert.match(enable, /لم يُسجَّل هذا الجهاز للإشعارات/, "الفشل يُبلَّغ للمستخدم بدل أن يُبتلع");
  const helper = slice(app, "async function registerPushForThisDevice() {", "async function enableNotifications() {");
  assert.match(helper, /await import\("\.\/push-alerts\.js"\)/, "تحميل ديناميكي: لا Firebase في المسار الحرج");
  assert.match(helper, /VITE_PUSH_VAPID_PUBLIC_KEY \|\| state\.settings\?\.pushVapidPublicKey/, "مفتاح البيئة ما زال يعمل (توافق رجعي)");
  assert.match(helper, /registerPushDevice\(\{ storeId, subscription/, "مسار مفتاح البيئة يُسجّل الجهاز في السجلّ أيضًا");
  assert.match(helper, /reason: saved \? "" : storeId \? "subscribe-failed" : "no-store"/, "سبب الفحص واضح لكل حالة");
  assert.match(helper, /console\.warn\("\[Hesabi push registration\]"/, "فشل التسجيل لا يُسقط التفعيل");
});

test("التنبيه يُبعث بعد التزامن فقط — ولا يُعاد بثّه عند الاستقبال", () => {
  assert.match(
    coordinator,
    /const changes = Array\.from\(diffBackupPayloads\(before, after\)\);\n\s*for \(const change of changes\) await pushSyncOperation\(change\);\n\s*notifyPeers\(changes\);/,
    "notifyPeers بعد الدفع إلى Firestore",
  );
  const notify = slice(coordinator, "function notifyPeers(changes) {", "export async function installSyncCoordinator(");
  assert.match(notify, /if \(!list\.length\) return;/, "بلا تغيّرات ⇒ بلا طلب");
  assert.match(notify, /import\("\.\/push-alerts\.js"\)/, "الوحدة محمّلة ديناميكيًا");
  assert.match(notify, /\.catch\(\(\) => \{\}\);/, "فشل الإرسال صامت");
  assert.doesNotMatch(notify, /await /, "لا انتظار للشبكة في مسار البيع");
  const remoteBlock = slice(coordinator, "applyingRemote = true;", "}, onStatus)");
  assert.doesNotMatch(remoteBlock, /notifyPeers/, "التغيّر القادم من جهاز آخر لا يُعاد بثّه (لا حلقة)");
  assert.match(alerts, /const COALESCE_MS = \d+;/, "دمج تنبيهات نفس اللحظة");
  assert.match(alerts, /if \(!payload\) return \{ \.\.\.summary, reason: "empty" \};/, "لا طلب بلا محتوى");
  assert.match(alerts, /reason: "no-store"/, "سبب صريح عند غياب متجر سحابي");
});

test("الاشتراك يجدّد نفسه ولا يدخل حلقة إعادة اشتراك", () => {
  assert.match(notifications, /export const RENEW_BEFORE_MS = [\d*\s]+;/, "نافذة تجديد معرّفة ومُصدَّرة");
  assert.match(notifications, /export function pushSubscriptionIsValid\(subscription\) \{[\s\S]*?if \(expires === null \|\| expires === undefined\) return true;/, "بلا انتهاء صلاحية = صالح");
  assert.match(notifications, /if \(existing && !event && pushSubscriptionIsValid\(existing\)\) return existing\.toJSON\(\);/, "الاشتراك الصالح لا يُمَسّ");
  assert.match(notifications, /if \(existing && event\) await existing\.unsubscribe\(\)\.catch\(\(\) => \{\}\);/, "push_event دليل إسقاط ⇒ unsubSCRIBE ثم اشتراك جديد");
  assert.match(slice(notifications, "export async function subscribeToPush(", "\n}\n"), /userVisibleOnly: true,\n\s*applicationServerKey: urlBase64ToUint8Array\(vapidPublicKey\)/, "اشتراك حقيقي بالمفتاح");
  assert.match(alerts, /const needsNew = !pushSubscriptionIsValid\(existing\);/, "نافذة واحدة يستعملها الجميع");
  assert.match(app, /renewAndRegisterPushDevice\(\)/, "التجديد يُنادى عند الإقلاع");
});

test("السجلّ والقيود: كل جهاز يكتب حساب هو فقط", () => {
  for (const name of ["getStoreVapidKeys", "registerPushDevice", "unregisterPushDevice", "listStorePushDevices", "removePushDevicesByEndpoints"]) {
    assert.match(firebaseSync, new RegExp(`export async function ${name}\\(`), `الدالة مفقودة: ${name}`);
  }
  assert.match(firebaseSync, /doc\(firestore, "stores", storeId, "pushDevices", uid\)/, "مسار السجلّ لكل مستخدم");
  assert.match(firebaseSync, /doc\(firestore, "stores", storeId, "push", "config"\)/, "مسار مفاتيح المتجر");
  assert.match(firebaseSync, /role !== "admin"|role === "admin"/, "الإنشاء محصور بالإدارة");
  assert.match(firebaseSync, /export async function listStorePushDevices\(storeId, \{ excludeUid = "" \} = \{\}\)/, "استثناء جهاز المُرسِل مدعوم");
  assert.match(rules, /match \/push\/config \{/, "القواعد تعرف push/config");
  assert.match(rules, /allow write: if admin\(storeId\) \|\| ownsStore\(storeId\);/, "السرّ الخاص لا يكتبه إلا الأدمن");
  const devicesBlock = slice(rules, "match /pushDevices/{uid} {", "\n    }");
  assert.match(devicesBlock, /allow read: if member\(storeId\);/, "أعضاء المتجر يقرؤون السجلّ");
  assert.match(devicesBlock, /allow create, update: if signedIn\(\) && request\.auth\.uid == uid/, "لا كتابة على حساب غيرك");
  assert.match(devicesBlock, /request\.resource\.data\.uid == uid/, "يجب أن يطابق uid داخل المستند");
  assert.match(devicesBlock, /request\.resource\.data\.storeId == storeId/, "لا تسميم متجر آخر");
  assert.doesNotMatch(devicesBlock, /allow create[^;]*if signedIn\(\);/, "لا كتابة مفتوحة");
  assert.equal(rules.match(/\{/g).length, rules.match(/\}/g).length, "أقواس القواعد متوازنة");
});

test("النواة بلا خادم وبلا اعتماديات، والمنطق المحاسبي لم يُمَسّ", () => {
  assert.match(relay, /if \(plaintext\.length > maxPlain\) throw/, "حدّ حجم السجلّ معلن");
  assert.match(relay, /"Content-Encoding": "aes128gcm"/, "ترميز المعيار الحديث");
  assert.match(relay, /Authorization: `vapid t=\$\{jwt\}, k="\$\{publicKey\}"`/, "ترويسة VAPID واحدة صحيحة");
  assert.doesNotMatch(relay, /^\s*import .* from "(?!node:)/m, "لا استيراد وحدات خارجية في النواة");
  assert.doesNotMatch(relay, /require\(/, "لا require في النواة");
  assert.match(relay, /aswePrivate/, "مسار الاختبار المرجعي موجود (مُوثَّق أنه للاختبار)");
  assert.match(relay, /if \(bytes\[0\] === 0x30 && bytes\.length > 64/, "تعرّف DER قبل افتراض الطول — وإلا صمتٌ عند 0.4% من المفاتيح");
  const database = read("../client/src/js/database.js");
  const domain = read("../client/src/js/domain.js");
  assert.match(database, /function calculateSaleTotals|calculateSaleTotals\(/, "دالة totals باقية كما هي");
  assert.equal(app.includes("function calculateSaleTotals"), database.includes("function calculateSaleTotals"), "لم تُنقل الحسابات إلى الواجهة");
  assert.match(domain, /export/, "domain.js لم يُحذف");
  assert.ok(packageJson.scripts["vapid:keys"], "أداة المفاتيح مسجّلة");
  assert.ok(packageJson.scripts["push:relay"], "الاختبار المرجعي مسجّل");
  assert.match(serviceWorker, /self\.addEventListener\("push"/, "المستقبِل موجود في عامل الخدمة");
  const cacheVersion = Number(/CACHE(?:_NAME)? = "hesabi-pwa-v(\d+)"/.exec(serviceWorker)?.[1] ?? 0);
  assert.ok(cacheVersion >= 31, `عامل الخدمة يحتاج كاشًا جديدًا عند تعديله (v${cacheVersion})`);
  assert.match(serviceWorker, /event\.data \? event\.data\.json\(\)/, "قارئ الحمولة يقبل JSON كما نرسل");
});
