import { randomId } from "./ids.js";

export const SYNCABLE_STORES = [
  "settings", "products", "saleItems", "sales", "stockMovements", "suppliers", "purchases", "purchaseItems",
  "productBatches", "purchaseReturns", "purchaseReturnItems", "saleReturns", "saleReturnItems", "expenses",
  "customers", "customerPayments", "customerTransactions", "supplierPayments", "supplierTransactions",
  "cashMovements", "cashierShifts", "cashierSalaryDeductions", "stockCounts", "periodicInventories", "accounts",
];

const asRecords = (payload, storeName) => Array.isArray(payload?.stores?.[storeName]) ? payload.stores[storeName] : [];
const recordVersion = (record) => String(record?.updatedAt || record?.createdAt || record?.date || "");
const compareVersion = (left, right) => recordVersion(left).localeCompare(recordVersion(right));

export function diffBackupPayloads(previous, next, storeNames = SYNCABLE_STORES) {
  const changes = [];
  for (const store of storeNames) {
    const before = new Map(asRecords(previous, store).filter((item) => item?.id).map((item) => [item.id, item]));
    const after = new Map(asRecords(next, store).filter((item) => item?.id).map((item) => [item.id, item]));
    for (const [id, record] of after) {
      const previousRecord = before.get(id);
      if (!previousRecord || JSON.stringify(previousRecord) !== JSON.stringify(record)) changes.push({
        id: `${store}:${id}:${randomId()}`,
        store,
        recordId: id,
        type: "upsert",
        record,
        changedAt: recordVersion(record) || new Date().toISOString(),
      });
    }
    for (const [id, record] of before) if (!after.has(id)) changes.push({
      id: `${store}:${id}:delete:${randomId()}`,
      store,
      recordId: id,
      type: "delete",
      record: { id, deletedAt: new Date().toISOString(), isDeleted: true },
      changedAt: new Date().toISOString(),
    });
  }
  return changes;
}

export function mergeRemoteChanges(payload, changes, storeNames = SYNCABLE_STORES) {
  const next = {
    ...payload,
    stores: Object.fromEntries(Object.entries(payload?.stores || {}).map(([key, value]) => [key, Array.isArray(value) ? value.map((item) => ({ ...item })) : value])),
  };
  for (const store of storeNames) if (!Array.isArray(next.stores[store])) next.stores[store] = [];
  const grouped = new Map(storeNames.map((store) => [store, new Map(next.stores[store].filter((item) => item?.id).map((item) => [item.id, item]))]));
  for (const change of changes) {
    if (!grouped.has(change.store) || !change.recordId) continue;
    const records = grouped.get(change.store);
    const current = records.get(change.recordId);
    if (current && compareVersion(current, change.record) > 0) continue;
    if (change.type === "delete") records.delete(change.recordId);
    else records.set(change.recordId, { ...change.record });
  }
  for (const store of storeNames) next.stores[store] = [...grouped.get(store).values()];
  return next;
}

export function createPairingCode({ now = Date.now(), ttlMs = 10 * 60 * 1000, randomBytes = crypto.getRandomValues.bind(crypto) } = {}) {
  const bytes = randomBytes(new Uint8Array(6));
  const code = Array.from(bytes, (byte) => String(byte % 10)).join("");
  return { code, codeId: `pair_${randomId()}`, createdAt: now, expiresAt: now + ttlMs, usedAt: null };
}

export function isPairingCodeUsable(pairing, now = Date.now()) {
  return Boolean(pairing && !pairing.usedAt && Number(pairing.expiresAt) > now);
}

export function createDeviceIdentity({ deviceId = `device_${randomId()}`, accountId, accountName, role, storeId }) {
  if (!accountId || !storeId) throw new Error("هوية الجهاز تحتاج حساب المستخدم ومعرّف المتجر.");
  return { deviceId, accountId, accountName: String(accountName || ""), role: role === "admin" ? "admin" : "cashier", storeId, createdAt: new Date().toISOString(), revokedAt: null };
}
