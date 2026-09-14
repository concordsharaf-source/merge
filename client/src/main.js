/* اتجاه التصميم: دفتر التاجر الهادئ — تشغيل يومي عربي واضح، دافئ، وموجّه للأرقام. */
import "./style.css";
import { bootApp } from "./js/app.js";

if ("serviceWorker" in navigator) {
  if (import.meta.env.DEV) {
    /* وضع التطوير: أزل أي عامل خدمة وكاش سابق حتى لا تُعرض نسخة قديمة من الكود بدل التعديلات الجارية. */
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => (typeof caches === "undefined" ? [] : caches.keys()))
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch((error) => console.warn("تعذر تنظيف عامل الخدمة في وضع التطوير", error));
  } else {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.warn("تعذر تسجيل عامل الخدمة", error);
    });
  }
}

bootApp(document.querySelector("#app"));
