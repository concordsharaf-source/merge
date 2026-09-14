import test from "node:test";
import assert from "node:assert/strict";
import { buildAlerts, NOTIFICATION_TOPICS } from "../client/src/js/notifications.js";

const today = new Date(); today.setHours(0,0,0,0);
const iso = (offsetDays) => { const d = new Date(today.getTime() + offsetDays*86400000); return d.toISOString().slice(0,10); };

test("ينبّه الأدمن لطلبات الكاشير وفائض الوردية", () => {
  const alerts = buildAlerts({
    isAdmin: true,
    pairRequests: [{ id: "r1", status: "pending", accountName: "كاشير أحمد" }, { id: "r2", status: "approved" }],
    shifts: [{ id: "s1", surplusApprovalStatus: "PENDING", difference: 25, accountName: "كاشير سالم" }],
  });
  const topics = alerts.map((a) => a.topic);
  assert.ok(topics.includes("cashierRequests"));
  assert.equal(alerts.filter((a) => a.key.startsWith("pair-request:")).length, 1, "الطلب المعتمد لا يُنبّه");
  assert.ok(alerts.some((a) => a.key === "surplus:s1" && a.urgent));
});

test("لا يُنبّه الكاشير بطلبات الإدارة", () => {
  const alerts = buildAlerts({
    isAdmin: false,
    pairRequests: [{ id: "r1", status: "pending" }],
    shifts: [{ id: "s1", surplusApprovalStatus: "PENDING", difference: 10 }],
  });
  assert.equal(alerts.filter((a) => a.topic === "cashierRequests").length, 0);
});

test("ينبّه لنفاد المنتج وانخفاضه عن الحد الأدنى", () => {
  const alerts = buildAlerts({
    products: [
      { id: "p1", name: "أرز", quantity: 0, minimumStock: 5 },
      { id: "p2", name: "سكر", quantity: 3, minimumStock: 10 },
      { id: "p3", name: "زيت", quantity: 50, minimumStock: 10 },
    ],
  });
  const out = alerts.find((a) => a.key.startsWith("out-of-stock:"));
  const low = alerts.find((a) => a.key.startsWith("low-stock:"));
  assert.ok(out && out.urgent, "النفاد عاجل");
  assert.ok(out.body.includes("أرز"));
  assert.ok(low && low.body.includes("سكر"));
  assert.ok(!JSON.stringify(alerts).includes("زيت"), "المتوفر لا يُنبّه");
});

test("ينبّه لانتهاء الصلاحية والاقتراب منها", () => {
  const alerts = buildAlerts({
    dashboard: { expiringBatches: [
      { expiryDate: iso(-2), product: { name: "لبن" } },
      { expiryDate: iso(10), product: { name: "جبن" } },
      { expiryDate: iso(200), product: { name: "معلبات" } },
    ] },
  });
  const expired = alerts.find((a) => a.key.startsWith("expired:"));
  const near = alerts.find((a) => a.key.startsWith("near-expiry:"));
  assert.ok(expired && expired.urgent && expired.body.includes("لبن"));
  assert.ok(near && near.body.includes("جبن"));
  assert.ok(!JSON.stringify(alerts).includes("معلبات"), "البعيد لا يُنبّه");
});

test("كل تنبيه له مفتاح ووجهة صالحة", () => {
  const alerts = buildAlerts({
    isAdmin: true,
    products: [{ id: "p1", name: "أرز", quantity: 0, minimumStock: 5 }],
    shifts: [{ id: "s1", status: "CLOSED", vaultTransferredAt: null }],
    dashboard: { expiringBatches: [{ expiryDate: iso(-1), product: { name: "لبن" } }], customerDebt: 5000 },
    debtThreshold: 1000,
  });
  assert.ok(alerts.length >= 4);
  for (const alert of alerts) {
    assert.ok(alert.key && alert.title && alert.body, "حقول مكتملة");
    assert.ok(alert.url.startsWith("/"), "وجهة صالحة");
    assert.ok(NOTIFICATION_TOPICS.some((t) => t.id === alert.topic), `موضوع معروف: ${alert.topic}`);
  }
});
