/**
 * تنبيهات المتجر عبر Web Push — طبقة التنسيق بين سجلّ الأجهزة (firebase-sync) ونواة
 * التشفير (push-relay). تعمل والتطبيق مغلق لأنها تصل من مزوّد دفع المتصفح لا من التطبيق.
 *
 * قرار صريح: المُرسِل هو الجهاز الذي نفّذ العملية — لا خادم عندنا في بناء PWA/APK، والجهاز
 * وحده يعلم بالعملية لحظة وقوعها. فشل الإرسال لا يعطّل شيئًا: الإشعار تكميلي.
 * ملاحظة خصوصية: السرّ الخاص لـ VAPID يُقرأ من Firestore في كل إرسال (لا خادم ليخفيه).
 */
import { getCloudDeviceIdentity, getStoreVapidKeys, listStorePushDevices, registerPushDevice, removePushDevicesByEndpoints } from "./firebase-sync.js";
import { pushSubscriptionIsValid } from "./notifications.js";
import { collapseAlerts, sendToSubscriptions } from "./push-relay.js";

const COALESCE_MS = 2500;
const CONFIG_TTL_MS = 10 * 60 * 1000;

let configCache = { storeId: "", value: null, readAt: 0 };
let queue = [];
let queueTimer = null;
let flushing = false;
let lastResult = { sent: 0, failed: 0, skipped: 0, at: 0, devices: 0 };

async function resolveVapid(storeId, { allowGenerate = true } = {}) {
  if (!storeId) return null;
  const fresh = configCache.storeId === storeId && Date.now() - configCache.readAt < CONFIG_TTL_MS;
  if (fresh && configCache.value) return configCache.value;
  try {
    const value = await getStoreVapidKeys(storeId, { force: !fresh });
    if (value?.publicKey) {
      configCache = { storeId, value, readAt: Date.now() };
      return value;
    }
  } catch (error) {
    if (!allowGenerate) throw error;
    console.warn("[Hesabi push] VAPID", error?.message || error);
  }
  configCache = { storeId, value: null, readAt: Date.now() };
  return null;
}

/**
 * يبعث دفعة تنبيهات لبقية أجهزة المتجر. يُنادى بعد التزامن في Firestore مباشرةً،
 * وبنمط fire‑and‑forget حتى لا يؤخّر واجهة البيع.
 */
export async function flushStoreAlerts(alerts, { excludeUid = "" } = {}) {
  const summary = { sent: 0, failed: 0, skipped: 0, devices: 0 };
  if (typeof globalThis.fetch !== "function") {
    return { ...summary, skipped: alerts.length, reason: "no-fetch" };
  }
  const identity = await getCloudDeviceIdentity().catch(() => null);
  const storeId = identity?.storeId;
  if (!storeId) return { ...summary, skipped: alerts.length, reason: "no-store" };
  const vapid = await resolveVapid(storeId);
  if (!vapid?.publicKey) return { ...summary, skipped: alerts.length, reason: "no-vapid" };
  const devices = await listStorePushDevices(storeId, { excludeUid: excludeUid || identity.uid || "" });
  summary.devices = devices.length;
  if (!devices.length) return { ...summary, skipped: alerts.length, reason: "no-devices" };

  const payload = collapseAlerts(alerts);
  if (!payload) return { ...summary, reason: "empty" };
  const result = await sendToSubscriptions({
    vapid: { privateKey: vapid.privateKey, publicKey: vapid.publicKey, subject: vapid.subject, ttl: 604800 },
    alerts: devices.map((device) => ({ subscription: device.subscription, payload })),
  });
  if (result.unsubscribed.length) {
    await removePushDevicesByEndpoints(storeId, result.unsubscribed).catch(() => 0);
  }
  lastResult = { ...result, devices: devices.length, at: Date.now(), storeId };
  return { ...result, devices: devices.length };
}

/** يجمع تنبيهات نفس اللحظة في إشعار واحد لكل جهاز بدل ten طلبات. */
export function notifyStorePeers(alerts) {
  const incoming = Array.isArray(alerts) ? alerts : [alerts];
  queue.push(...incoming.filter(Boolean));
  if (queue.length === 1) {
    return new Promise((resolve) => {
      queueTimer = setTimeout(() => {
        queueTimer = null;
        const batch = queue;
        queue = [];
        resolve(flushStoreAlerts(batch).catch((error) => ({ sent: 0, failed: 0, skipped: batch.length, reason: String(error?.message || error).slice(0, 120) })));
      }, COALESCE_MS);
    });
  }
  return Promise.resolve({ queued: true });
}

export function pushAlertStatus() {
  return { ...lastResult, queued: queue.length };
}

/**
 * إعادة اشتراك صامتة عند اقتراب انتهاء صلاحية الاشتراك أو فقدانه، ثم تسجيله في السجلّ.
 * تُنادى عند فتح التطبيق — تمنع موت الوصول الصامت بعد أسبوعين من دون أن يلاحظ أحد.
 */
export async function renewAndRegisterPushDevice(registration) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !navigator.pushManager?.subscribe) return { registered: false, reason: "unsupported" };
  const reg = registration || (await navigator.serviceWorker.ready.catch(() => null));
  if (!reg?.pushManager) return { registered: false, reason: "no-registration" };
  const identity = await getCloudDeviceIdentity().catch(() => null);
  const storeId = identity?.storeId;
  if (!storeId) return { registered: false, reason: "no-store" };
  let vapid = null;
  try {
    vapid = await resolveVapid(storeId, { allowGenerate: false });
  } catch {
    vapid = null;
  }
  if (!vapid?.publicKey) return { registered: false, reason: "no-vapid" };
  const existing = await reg.pushManager.getSubscription();
  const needsNew = !pushSubscriptionIsValid(existing);
  let subscription = existing;
  if (needsNew) {
    try {
      subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKeyFrom(vapid.publicKey) });
    } catch (error) {
      return { registered: false, reason: "subscribe-failed", detail: String(error?.message || error).slice(0, 160) };
    }
  }
  const json = subscription?.toJSON ? subscription.toJSON() : subscription;
  if (!json?.endpoint) return { registered: false, reason: "no-endpoint" };
  const saved = await registerPushDevice({ storeId, subscription: json }).catch(() => null);
  return { registered: Boolean(saved), renewed: Boolean(needsNew), endpointHost: safeHost(json.endpoint), uid: saved?.uid || "" };
}

/** base64url (بلا حشو) → Uint8Array، كما يتطلب applicationServerKey. */
function applicationServerKeyFrom(base64Url) {
  const normal = String(base64Url).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function safeHost(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "";
  }
}
