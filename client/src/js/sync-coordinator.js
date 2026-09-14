import { diffBackupPayloads, mergeRemoteChanges } from "./sync-domain.js";
import { getCloudDeviceIdentity, pushSyncOperation, watchSyncOperations } from "./firebase-sync.js";

const MUTATING_METHODS = new Set([
  "saveSettings", "saveStoreLogoDataUrl", "createAccount", "updateAccount", "changeAccountPin", "resetAccountPinByAdmin",
  "createProduct", "updateProduct", "softDeleteProduct", "adjustStock", "createSupplier", "updateSupplier", "softDeleteSupplier",
  "createPurchase", "createPurchaseReturn", "createSale", "createSaleReturn", "createExpense", "updateExpense", "deleteExpense",
  "createCustomer", "updateCustomer", "softDeleteCustomer", "createCustomerPayment", "createSupplierPayment", "createCashMovement",
  "startCashierShift", "closeCashierShift", "transferCashierShiftToVault", "deductCashierShortage", "savePeriodicInventory", "depositIncomingTransferToVault",
]);

let installed = false;
let unsubscribe = null;
let beforePayload = null;
let applyingRemote = false;

/* يجمع تغيّرات اللحظة في تنبيه واحد لكل جهاز. لا شيء هنا ينتظر الشبكة ولا يرفع استثناءً:
   الإشعار تكميلي، والتزامن البيانات هو الأساس وقد تمّ قبله. */
function notifyPeers(changes) {
  const list = Array.from(changes || []);
  if (!list.length) return;
  import("./push-alerts.js")
    .then(({ notifyStorePeers }) =>
      notifyStorePeers([
        {
          topic: "sync",
          key: `sync-${Date.now()}`,
          title: "تحديث في متجرك",
          body:
            list.length === 1
              ? `تم تحديث ${list[0].entity || list[0].collection || "البيانات"}`
              : `تم تحديث ${list.length} عناصر`,
          url: "/",
        },
      ]),
    )
    .catch(() => {});
}

export async function installSyncCoordinator(db, { onStatus = () => {}, onRemoteApplied = () => {} } = {}) {
  if (!installed) {
    installed = true;
    for (const method of MUTATING_METHODS) {
      if (typeof db[method] !== "function") continue;
      const original = db[method].bind(db);
      db[method] = async (...args) => {
        if (applyingRemote) return original(...args);
        const before = await db.exportBackup();
        const result = await original(...args);
        try {
          const after = await db.exportBackup();
          beforePayload = after;
          const changes = Array.from(diffBackupPayloads(before, after));
          for (const change of changes) await pushSyncOperation(change);
          notifyPeers(changes);
        } catch (error) {
          onStatus("pending");
          console.warn("[Hesabi sync queue]", error);
        }
        return result;
      };
    }
  }
  const identity = await getCloudDeviceIdentity();
  if (!identity || identity.revokedAt) { onStatus("local"); return () => {}; }
  if (unsubscribe) unsubscribe();
  beforePayload ||= await db.exportBackup();
  unsubscribe = await watchSyncOperations(async (change) => {
    if (!beforePayload) beforePayload = await db.exportBackup();
    const merged = mergeRemoteChanges(beforePayload, [change]);
    applyingRemote = true;
    try { await db.restoreBackup(merged); beforePayload = merged; onRemoteApplied(change); }
    finally { applyingRemote = false; }
  }, onStatus);
  return () => { if (unsubscribe) unsubscribe(); unsubscribe = null; };
}

export function resetSyncCoordinator() { if (unsubscribe) unsubscribe(); unsubscribe = null; beforePayload = null; installed = false; }
