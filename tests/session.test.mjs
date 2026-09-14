import test from "node:test";
import assert from "node:assert/strict";
import { ACTIVE_SESSION_META_ID, toPersistentSessionUser } from "../client/src/js/session.js";

test("تحفظ الجلسة هوية الحساب وصلاحياته دون أي بيانات لرمز الدخول", () => {
  const session = toPersistentSessionUser({ id: "account-1", username: "admin", name: "مدير المتجر", role: "admin", mustChangePin: false, isActive: true, pinHash: "secret", pinSalt: "salt" });
  assert.deepEqual(session, { id: "account-1", username: "admin", name: "مدير المتجر", role: "admin", mustChangePin: false });
  assert.equal(ACTIVE_SESSION_META_ID, "active-account-session");
});

test("تحفظ الجلسة صلاحيات الكاشير المخصصة عند توفرها", () => {
  const cashierSession = toPersistentSessionUser({
    id: "account-cashier-1",
    username: "cashier1",
    name: "كاشير الصباح",
    role: "cashier",
    mustChangePin: false,
    isActive: true,
    allowedViews: ["sales", "invoices", "products"],
    pinHash: "secret",
    pinSalt: "salt",
  });
  assert.deepEqual(cashierSession, {
    id: "account-cashier-1",
    username: "cashier1",
    name: "كاشير الصباح",
    role: "cashier",
    mustChangePin: false,
    allowedViews: ["sales", "invoices", "products"],
  });
});

test("لا تستعيد الجلسة حسابًا موقوفًا أو ناقص البيانات", () => {
  assert.equal(toPersistentSessionUser({ id: "account-2", isActive: false }), null);
  assert.equal(toPersistentSessionUser(null), null);
});
