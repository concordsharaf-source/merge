import test from "node:test";
import assert from "node:assert/strict";
import { createDeviceIdentity, createPairingCode, diffBackupPayloads, isPairingCodeUsable, mergeRemoteChanges } from "../client/src/js/sync-domain.js";

const payload = (products = []) => ({ schema: "hesabi-backup", stores: { products, settings: [{ id: "app", updatedAt: "2026-08-28T00:00:00.000Z" }] } });

test("diffBackupPayloads returns only changed and deleted records", () => {
  const before = payload([{ id: "p1", name: "قديم", updatedAt: "2026-08-28T00:00:00.000Z" }, { id: "p2", name: "محذوف" }]);
  const after = payload([{ id: "p1", name: "جديد", updatedAt: "2026-08-28T00:01:00.000Z" }]);
  const changes = diffBackupPayloads(before, after, ["products"]);
  assert.equal(changes.filter((change) => change.type === "upsert").length, 1);
  assert.equal(changes.filter((change) => change.type === "delete").length, 1);
});

test("mergeRemoteChanges keeps newer local record and applies newer remote record", () => {
  const current = payload([{ id: "p1", name: "محلي أحدث", updatedAt: "2026-08-28T00:02:00.000Z" }]);
  const older = { store: "products", recordId: "p1", type: "upsert", record: { id: "p1", name: "قديم", updatedAt: "2026-08-28T00:01:00.000Z" } };
  const newer = { store: "products", recordId: "p1", type: "upsert", record: { id: "p1", name: "سحابي أحدث", updatedAt: "2026-08-28T00:03:00.000Z" } };
  assert.equal(mergeRemoteChanges(current, [older], ["products"]).stores.products[0].name, "محلي أحدث");
  assert.equal(mergeRemoteChanges(current, [newer], ["products"]).stores.products[0].name, "سحابي أحدث");
});

test("pairing code expires and cannot be reused", () => {
  const pairing = createPairingCode({ now: 1000, ttlMs: 100, randomBytes: () => new Uint8Array([1, 2, 3, 4, 5, 6]) });
  assert.equal(pairing.code, "123456");
  assert.equal(isPairingCodeUsable(pairing, 1099), true);
  assert.equal(isPairingCodeUsable(pairing, 1100), false);
  pairing.usedAt = 110;
  assert.equal(isPairingCodeUsable(pairing, 1050), false);
});

test("device identity is independent and preserves the assigned role", () => {
  const identity = createDeviceIdentity({ deviceId: "device-2", accountId: "account-2", accountName: "كاشير 2", role: "cashier", storeId: "store-1" });
  assert.deepEqual(identity, { deviceId: "device-2", accountId: "account-2", accountName: "كاشير 2", role: "cashier", storeId: "store-1", createdAt: identity.createdAt, revokedAt: null });
});
