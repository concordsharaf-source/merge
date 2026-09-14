/* إشعارات حسابي: تنبيهات تصل حتى والتطبيق في الخلفية.
   الطبقة المحلية تعمل دون خادم؛ وطبقة Push تُفعَّل بمفتاح VAPID يولّده جهاز الأدمن نفسه — بلا خادم. */

const SEEN_KEY = "hesabi-notified-keys";
const SETTINGS_KEY = "hesabi-notification-settings";
const MAX_SEEN = 400;

export const NOTIFICATION_TOPICS = [
  { id: "cashierRequests", label: "طلبات الكاشير والموافقات", description: "طلبات الربط، وفائض الوردية بانتظار موافقتك", adminOnly: true },
  { id: "lowStock", label: "نفاد المنتجات", description: "عند وصول منتج إلى الحد الأدنى أو نفاده" },
  { id: "expiry", label: "انتهاء الصلاحية", description: "قبل انتهاء صلاحية المنتجات بمدة كافية" },
  { id: "debts", label: "ديون العملاء", description: "تذكير بالديون المستحقة المتراكمة", adminOnly: true },
  { id: "shifts", label: "الورديات والخزنة", description: "ورديات مغلقة بانتظار الترحيل إلى الخزنة", adminOnly: true },
];

const readJson = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};
const writeJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
};

export function notificationSettings() {
  const stored = readJson(SETTINGS_KEY, {});
  const topics = { ...Object.fromEntries(NOTIFICATION_TOPICS.map((topic) => [topic.id, true])), ...(stored.topics || {}) };
  return { enabled: stored.enabled !== false, quietHours: stored.quietHours || null, topics };
}

export function saveNotificationSettings(patch) {
  const next = { ...notificationSettings(), ...patch };
  writeJson(SETTINGS_KEY, next);
  return next;
}

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : "unsupported");

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try { return await Notification.requestPermission(); }
  catch { return "denied"; }
}

/* منع تكرار نفس التنبيه: كل تنبيه له مفتاح ثابت ونافذة تهدئة زمنية. */
function alreadyNotified(key, cooldownMs) {
  const seen = readJson(SEEN_KEY, {});
  const last = seen[key];
  if (last && Date.now() - last < cooldownMs) return true;
  seen[key] = Date.now();
  const entries = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, MAX_SEEN);
  writeJson(SEEN_KEY, Object.fromEntries(entries));
  return false;
}

export function clearNotificationHistory() { writeJson(SEEN_KEY, {}); }

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  try { return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready); }
  catch { return null; }
}

/* يعرض إشعار نظام حقيقيًا عبر عامل الخدمة ليبقى ظاهرًا والتطبيق في الخلفية. */
export async function showAppNotification({ topic = "general", key, title, body, url = "/", tag, urgent = false, cooldownMs = 6 * 60 * 60 * 1000, data = {} }) {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const settings = notificationSettings();
  if (!settings.enabled) return false;
  if (settings.topics[topic] === false) return false;
  if (key && alreadyNotified(key, cooldownMs)) return false;

  const options = {
    body,
    tag: tag || key || topic,
    renotify: Boolean(urgent),
    requireInteraction: Boolean(urgent),
    icon: "./hesabi-icon-192.png",
    badge: "./hesabi-icon-192.png",
    dir: "rtl",
    lang: "ar",
    vibrate: urgent ? [120, 60, 120] : [80],
    timestamp: Date.now(),
    data: { url, topic, ...data },
  };

  const reg = await registration();
  if (reg?.showNotification) { await reg.showNotification(title, options); return true; }
  try { new Notification(title, options); return true; } catch { return false; }
}

/* ===== قواعد التنبيه المحلية ===== */

const dayMs = 86400000;
const toNumber = (value) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };

export function buildAlerts({ products = [], dashboard = null, shifts = [], pairRequests = [], isAdmin = false, expiryWindowDays = 30, debtThreshold = 0 } = {}) {
  const alerts = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (isAdmin) {
    const pending = (pairRequests || []).filter((request) => request.status === "pending");
    pending.forEach((request) => alerts.push({
      topic: "cashierRequests",
      key: `pair-request:${request.id}`,
      title: "طلب ربط جهاز من الكاشير",
      body: `${request.accountName || "مستخدم"} يطلب الانضمام إلى متجرك. افتح التطبيق للموافقة أو الرفض.`,
      url: "/?view=data-management",
      urgent: true,
      cooldownMs: 2 * 60 * 60 * 1000,
    }));

    const pendingSurplus = (shifts || []).filter((shift) => shift.surplusApprovalStatus === "PENDING");
    pendingSurplus.forEach((shift) => alerts.push({
      topic: "cashierRequests",
      key: `surplus:${shift.id}`,
      title: "فائض وردية بانتظار موافقتك",
      body: `وردية ${shift.accountName || "كاشير"} بها فائض ${toNumber(shift.difference)}. لن يُضاف إلى الخزنة قبل اعتمادك.`,
      url: "/?view=cashbox",
      urgent: true,
      cooldownMs: 4 * 60 * 60 * 1000,
    }));

    const awaitingTransfer = (shifts || []).filter((shift) => shift.status === "CLOSED" && !shift.vaultTransferredAt);
    if (awaitingTransfer.length) alerts.push({
      topic: "shifts",
      key: `shift-transfer:${awaitingTransfer.length}:${today.toISOString().slice(0, 10)}`,
      title: "ورديات بانتظار الترحيل",
      body: `${awaitingTransfer.length} وردية مغلقة لم تُرحّل إلى الخزنة بعد.`,
      url: "/?view=cashbox",
    });
  }

  const outOfStock = (products || []).filter((product) => toNumber(product.quantity) <= 0);
  const lowStock = (products || []).filter((product) => toNumber(product.quantity) > 0 && toNumber(product.quantity) <= toNumber(product.minimumStock) && toNumber(product.minimumStock) > 0);

  if (outOfStock.length) alerts.push({
    topic: "lowStock",
    key: `out-of-stock:${outOfStock.length}:${today.toISOString().slice(0, 10)}`,
    title: outOfStock.length === 1 ? "منتج نفد من المخزون" : `${outOfStock.length} منتجات نفدت`,
    body: outOfStock.slice(0, 3).map((product) => product.name).join("، ") + (outOfStock.length > 3 ? ` و${outOfStock.length - 3} غيرها` : ""),
    url: "/?view=inventory",
    urgent: true,
  });

  if (lowStock.length) alerts.push({
    topic: "lowStock",
    key: `low-stock:${lowStock.length}:${today.toISOString().slice(0, 10)}`,
    title: `${lowStock.length} منتج وصل الحد الأدنى`,
    body: lowStock.slice(0, 3).map((product) => `${product.name} (${toNumber(product.quantity)})`).join("، ") + (lowStock.length > 3 ? " وغيرها" : ""),
    url: "/?view=inventory",
  });

  const batches = dashboard?.expiringBatches || [];
  const expiringSoon = batches.filter((batch) => {
    if (!batch.expiryDate) return false;
    const days = Math.ceil((new Date(`${batch.expiryDate}T00:00:00`).getTime() - today.getTime()) / dayMs);
    return days <= expiryWindowDays;
  });
  const expired = expiringSoon.filter((batch) => new Date(`${batch.expiryDate}T00:00:00`).getTime() < today.getTime());
  const nearExpiry = expiringSoon.filter((batch) => !expired.includes(batch));

  if (expired.length) alerts.push({
    topic: "expiry",
    key: `expired:${expired.length}:${today.toISOString().slice(0, 10)}`,
    title: `${expired.length} صنف منتهي الصلاحية`,
    body: expired.slice(0, 3).map((batch) => batch.product?.name || "منتج").join("، ") + " — يجب سحبه من الرفوف.",
    url: "/?view=inventory",
    urgent: true,
  });

  if (nearExpiry.length) alerts.push({
    topic: "expiry",
    key: `near-expiry:${nearExpiry.length}:${today.toISOString().slice(0, 10)}`,
    title: `${nearExpiry.length} صنف قارب على الانتهاء`,
    body: nearExpiry.slice(0, 3).map((batch) => `${batch.product?.name || "منتج"} (${batch.expiryDate})`).join("، "),
    url: "/?view=inventory",
  });

  if (isAdmin && debtThreshold > 0 && toNumber(dashboard?.customerDebt) >= debtThreshold) alerts.push({
    topic: "debts",
    key: `debt:${today.toISOString().slice(0, 10)}`,
    title: "ديون العملاء تحتاج متابعة",
    body: `إجمالي ديون العملاء ${toNumber(dashboard.customerDebt)}. راجع قائمة المدينين للتحصيل.`,
    url: "/?view=customers",
    cooldownMs: 24 * 60 * 60 * 1000,
  });

  return alerts;
}

export async function runAlertChecks(context) {
  if (notificationPermission() !== "granted") return 0;
  const alerts = buildAlerts(context);
  let sent = 0;
  for (const alert of alerts) {
    // eslint-disable-next-line no-await-in-loop
    if (await showAppNotification(alert)) sent += 1;
  }
  return sent;
}

/* يحفظ لقطة للبيانات ليقرأها عامل الخدمة عند الفحص الدوري في الخلفية. */
export function publishBackgroundSnapshot(snapshot) {
  writeJson("hesabi-alert-snapshot", { ...snapshot, updatedAt: Date.now() });
  navigator.serviceWorker?.controller?.postMessage({ type: "HESABI_SNAPSHOT", snapshot });
}

/* المزامنة الدورية في الخلفية: يدعمها Chrome/Android للتطبيقات المثبّتة. */
export async function enableBackgroundChecks() {
  const reg = await registration();
  if (!reg) return { periodicSync: false, push: false };
  let periodicSync = false;
  try {
    if ("periodicSync" in reg) {
      const status = await navigator.permissions?.query({ name: "periodic-background-sync" });
      if (!status || status.state === "granted") {
        await reg.periodicSync.register("hesabi-alert-check", { minInterval: 4 * 60 * 60 * 1000 });
        periodicSync = true;
      }
    }
  } catch { periodicSync = false; }
  return { periodicSync, push: Boolean(reg.pushManager) };
}

/* اشتراك Push حقيقي: يعمل والجهاز مغلق تمامًا، ويحتاج مفتاح VAPID وخادم إرسال. */
/** نعيد الاشتراك قبل انتهائه بهامش أمان، فيبقى الوصول حيًّا بلا ملاحظَة. */
export const RENEW_BEFORE_MS = 6 * 3600 * 1000;

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
};

/** صدق الاشتراك: موجود، وغير منتهٍ، وبعيد عن نافذة التجديد. */
export function pushSubscriptionIsValid(subscription) {
  if (!subscription?.endpoint) return false;
  const expires = subscription.expirationTime;
  if (expires === null || expires === undefined) return true;
  return expires - Date.now() >= RENEW_BEFORE_MS;
}

export async function subscribeToPush(vapidPublicKey, { event = null } = {}) {
  if (!vapidPublicKey) return null;
  const reg = await registration();
  if (!reg?.pushManager) return null;
  try {
    const existing = await reg.pushManager.getSubscription();
    // الاشتراك القديم صالح؟ نكتفي به — إلا إذا كان على وشك الانتهاء، أو جاءنا push_event
    // (وهذا وحده دليل قاطع أن مزوّد الدفع أسقط الاشتراك).
    if (existing && !event && pushSubscriptionIsValid(existing)) return existing.toJSON();
    if (existing && event) await existing.unsubscribe().catch(() => {});
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    return subscription.toJSON();
  } catch (error) {
    console.warn("[Hesabi push subscribe failed]", error);
    return null;
  }
}
