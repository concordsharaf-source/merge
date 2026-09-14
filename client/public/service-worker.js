const CACHE_NAME = "hesabi-pwa-v33"; // سجل الإصدارات: hesabi-pwa-v33 hesabi-pwa-v32 hesabi-pwa-v31 hesabi-pwa-v30 hesabi-pwa-v29 hesabi-pwa-v28 hesabi-pwa-v27 hesabi-pwa-v26 hesabi-pwa-v25 hesabi-pwa-v24 hesabi-pwa-v23 hesabi-pwa-v22 hesabi-pwa-v21
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const APP_SHELL = [SCOPE_PATH, `${SCOPE_PATH}manifest.json`, `${SCOPE_PATH}service-worker.js`];
const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;

const referencedAssetUrls = (content) => [...content.matchAll(/(?:src|href)\s*(?:=|:)\s*["']([^"']+)["']|url\(\s*["']?([^"')\s]+)["']?\s*\)|["'](\/(?:assets|manus-storage)\/[^"'\s)]+)["']/g)]
  .map((match) => match[1] || match[2] || match[3])
  .filter(Boolean)
  .map((value) => new URL(value, self.registration.scope))
  .filter((url) => url.origin === self.location.origin)
  .map((url) => url.href);

const isTextAsset = (response) => /(?:text|javascript|json)/i.test(response.headers.get("content-type") || "");

async function cacheApplicationShell() {
  const cache = await caches.open(CACHE_NAME);
  const pendingUrls = [...APP_SHELL];
  const cachedUrls = new Set();
  while (pendingUrls.length) {
    const url = pendingUrls.shift();
    if (!url || cachedUrls.has(url)) continue;
    cachedUrls.add(url);
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      await cache.put(url, response.clone());
      if (isTextAsset(response)) {
        const discoveredUrls = referencedAssetUrls(await response.clone().text());
        pendingUrls.push(...discoveredUrls.filter((item) => !cachedUrls.has(item)));
      }
    } catch {
      /* يحتفظ التطبيق بما اكتمل تخزينه كي يفتح بلا شبكة بعد أول تحميل ناجح. */
    }
  }
  if (!await cache.match(SCOPE_PATH)) throw new Error("تعذر تخزين واجهة التطبيق محليًا.");
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheApplicationShell().catch(() => caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!isSameOrigin(event.request)) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(SCOPE_PATH, response.clone()));
      return response;
    }).catch(() => caches.match(SCOPE_PATH).then((cached) => cached || Response.error())));
    return;
  }
  /* مخزَن ثم حدّث في الخلفية: يفتح التطبيق فورًا دون اتصال، ويضمن وصول النسخة الجديدة في التحميل التالي
     بدل بقاء كاش قديم يُخفي الإصلاحات (كان الاستراتيجية السابقة cache-first فتحبس أي ملف لا يتغير رابطه). */
  event.respondWith(caches.match(event.request).then((cached) => {
    const revalidate = fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => null);
    return cached || revalidate.then((response) => response || Response.error());
  }));
});


/* ===== الإشعارات: تعمل والتطبيق في الخلفية أو مغلق ===== */

const NOTIFY_ICON = `${SCOPE_PATH}hesabi-icon-192.png`;

/* إشعار Push قادم من الخادم — يصل حتى والتطبيق مغلق تمامًا. */
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { title: "حسابي", body: event.data ? event.data.text() : "لديك تنبيه جديد." }; }

  const title = payload.title || "حسابي";
  const options = {
    body: payload.body || "لديك تنبيه جديد في متجرك.",
    icon: payload.icon || NOTIFY_ICON,
    badge: NOTIFY_ICON,
    dir: "rtl",
    lang: "ar",
    tag: payload.tag || payload.topic || "hesabi-alert",
    renotify: Boolean(payload.urgent),
    requireInteraction: Boolean(payload.urgent),
    vibrate: payload.urgent ? [120, 60, 120] : [80],
    data: { url: payload.url || SCOPE_PATH, topic: payload.topic || "general", ...(payload.data || {}) },
    actions: [{ action: "open", title: "فتح التطبيق" }, { action: "dismiss", title: "تجاهل" }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* فتح التطبيق على الشاشة المقصودة عند الضغط على الإشعار. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const target = new URL(event.notification.data?.url || SCOPE_PATH, self.location.origin).href;
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin)) {
        await client.focus();
        client.postMessage({ type: "HESABI_NOTIFICATION_CLICK", url: target, data: event.notification.data || {} });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

/* لقطة بيانات يحفظها التطبيق ليقرأها الفحص الدوري في الخلفية. */
let alertSnapshot = null;
self.addEventListener("message", (event) => {
  if (event.data?.type === "HESABI_SNAPSHOT") alertSnapshot = event.data.snapshot || null;
  if (event.data?.type === "HESABI_SKIP_WAITING") self.skipWaiting();
});

function snapshotAlerts(snapshot) {
  if (!snapshot) return [];
  const alerts = [];
  if (snapshot.pendingRequests > 0) alerts.push({ title: "طلبات بانتظار موافقتك", body: `${snapshot.pendingRequests} طلب من الكاشير بانتظار الرد.`, url: `${SCOPE_PATH}?view=data-management`, urgent: true, tag: "hesabi-requests" });
  if (snapshot.pendingSurpluses > 0) alerts.push({ title: "فائض وردية بانتظار الاعتماد", body: `${snapshot.pendingSurpluses} وردية بها فائض لم يُضف إلى الخزنة بعد.`, url: `${SCOPE_PATH}?view=cashbox`, urgent: true, tag: "hesabi-surplus" });
  if (snapshot.outOfStock > 0) alerts.push({ title: "منتجات نفدت من المخزون", body: `${snapshot.outOfStock} منتج نفد ويحتاج إعادة طلب.`, url: `${SCOPE_PATH}?view=inventory`, urgent: true, tag: "hesabi-stock" });
  else if (snapshot.lowStock > 0) alerts.push({ title: "منتجات وصلت الحد الأدنى", body: `${snapshot.lowStock} منتج يحتاج إعادة طلب قريبًا.`, url: `${SCOPE_PATH}?view=inventory`, tag: "hesabi-stock" });
  if (snapshot.expired > 0) alerts.push({ title: "أصناف منتهية الصلاحية", body: `${snapshot.expired} صنف منتهي ويجب سحبه من الرفوف.`, url: `${SCOPE_PATH}?view=inventory`, urgent: true, tag: "hesabi-expiry" });
  else if (snapshot.nearExpiry > 0) alerts.push({ title: "أصناف قاربت على الانتهاء", body: `${snapshot.nearExpiry} صنف يقترب تاريخ انتهائه.`, url: `${SCOPE_PATH}?view=inventory`, tag: "hesabi-expiry" });
  return alerts;
}

async function runBackgroundAlertCheck() {
  const alerts = snapshotAlerts(alertSnapshot);
  for (const alert of alerts.slice(0, 3)) {
    await self.registration.showNotification(alert.title, {
      body: alert.body,
      icon: NOTIFY_ICON,
      badge: NOTIFY_ICON,
      dir: "rtl",
      lang: "ar",
      tag: alert.tag,
      renotify: Boolean(alert.urgent),
      requireInteraction: Boolean(alert.urgent),
      vibrate: alert.urgent ? [120, 60, 120] : [80],
      data: { url: alert.url },
    });
  }
}

/* فحص دوري في الخلفية (Chrome/Android للتطبيقات المثبّتة). */
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "hesabi-alert-check") event.waitUntil(runBackgroundAlertCheck());
});

self.addEventListener("sync", (event) => {
  if (event.tag === "hesabi-alert-check") event.waitUntil(runBackgroundAlertCheck());
});
