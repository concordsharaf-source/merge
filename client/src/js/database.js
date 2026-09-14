/* اتجاه التصميم: دفتر التاجر الهادئ — كل تغيير مالي أو مخزني يُحفظ محليًا ضمن معاملة واضحة. */
import {
  adjustmentDelta,
  canRegisterPayment,
  calculateProfit,
  calculateCashBalance,
  calculateMonthlyExpenseAllocation,
  calculatePackagePurchase,
  calculateDiscountAmount,
  calculatePurchaseTotals,
  expiryProgress,
  calculateSaleTotals,
  normalizeCashierDiscountLimit,
  canReturn,
  canSell,
  dateKey,
  invoiceNumber,
  isWithinDateRange,
  nowIso,
  paymentStatus,
  purchaseNumber,
  purchaseReturnNumber,
  roundMoney,
  remainingAmount,
  saleReturnNumber,
  toNumber,
  normalizeCreditLimit,
} from "./domain.js";
import { ACTIVE_SESSION_META_ID, ACTIVE_SESSION_STORAGE_KEY, toPersistentSessionUser } from "./session.js";
import { DEFAULT_CASHIER_ALLOWED_VIEWS } from "./permissions.js";
import { randomId } from "./ids.js";

const DB_NAME = "hesabi-pwa";
const DB_VERSION = 13;
export const LOCAL_BACKUP_RETENTION_LIMIT = 3;
let databasePromise;

const uid = (prefix) => `${prefix}-${randomId()}`;
const calculateInventoryCost = (products, batches) => {
  const batchTotals = new Map();
  batches.forEach((batch) => { const quantity = Math.max(0, toNumber(batch.remainingQuantity)); batchTotals.set(batch.productId, roundMoney((batchTotals.get(batch.productId) || 0) + quantity * toNumber(batch.unitCost))); });
  return roundMoney(products.reduce((sum, product) => {
    const batchQuantity = batches.filter((batch) => batch.productId === product.id).reduce((total, batch) => total + Math.max(0, toNumber(batch.remainingQuantity)), 0);
    const legacyQuantity = Math.max(0, toNumber(product.quantity) - batchQuantity);
    return sum + toNumber(batchTotals.get(product.id)) + legacyQuantity * toNumber(product.purchasePrice);
  }, 0));
};
const requestAsPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error("تعذر تنفيذ العملية المحلية."));
});
const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error("تعذر حفظ التغييرات المحلية."));
  transaction.onabort = () => reject(transaction.error || new Error("تم إلغاء العملية المحلية: تعارض أو بيانات غير صالحة."));
});
const normalize = (value) => String(value || "").trim();
const PRODUCT_UNITS = new Set(["حبة", "علبة", "كرتون", "كيس", "حزمة", "كيلو", "جرام", "لتر", "قطعة", "جهاز", "شريط", "عبوة", "طقم", "دزينة", "صندوق"]);
const normalizeProductCategory = (value, unit = "") => { const category = normalize(value); return !category || category === normalize(unit) || PRODUCT_UNITS.has(category) ? "أخرى" : category; };
const LOCAL_STORE_LOGO_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i;
const LOCAL_STORE_LOGO_MAX_LENGTH = 620_000;
const normalizeStoreLogoDataUrl = (value) => {
  const dataUrl = normalize(value);
  if (!dataUrl) return "";
  if (!LOCAL_STORE_LOGO_PATTERN.test(dataUrl) || dataUrl.length > LOCAL_STORE_LOGO_MAX_LENGTH) throw new Error("ملف الشعار غير صالح أو أكبر من الحد المحلي الآمن.");
  return dataUrl;
};
const normalizeUsername = (value) => normalize(value).toLocaleLowerCase("ar");
const validatePin = (value) => /^[^\s]{4,64}$/.test(String(value || ""));
const secureCrypto = () => {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle?.digest) throw new Error("هذا الجهاز لا يدعم الحماية المطلوبة لرمز الدخول. افتح حسابي من متصفح حديث أو حدّث التطبيق.");
  return globalThis.crypto;
};
const makeSalt = () => Array.from(secureCrypto().getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
const hashPin = async (pin, salt) => {
  const bytes = new TextEncoder().encode(`${salt}:${String(pin)}`);
  const digest = await secureCrypto().subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const accountRole = (role) => role === "admin" ? "admin" : role === "employee" ? "employee" : "cashier";
const makeIndexedStore = (database, name, indexes = []) => {
  if (database.objectStoreNames.contains(name)) return database.transaction?.objectStore?.(name);
  const store = database.createObjectStore(name, { keyPath: "id" });
  indexes.forEach(([index, keyPath, options]) => store.createIndex(index, keyPath, options));
  return store;
};
const createStockMovement = (store, values) => store.add({ id: uid("movement"), ...values });
const itemReturnTotal = (item, quantity) => roundMoney(toNumber(item.unitPrice ?? item.unitCost) * toNumber(quantity));
const dateOrder = (item) => String(item.date || item.createdAt || "");

async function createAccountRecord(values) {
  const username = normalizeUsername(values.username);
  const name = normalize(values.name);
  if (!username || username.length < 3 || username.length > 30) throw new Error("اسم المستخدم يجب أن يتكون من 3 إلى 30 حرفًا أو رقمًا.");
  if (!name) throw new Error("اسم الحساب مطلوب.");
  if (!validatePin(values.pin)) throw new Error("رمز الدخول يجب أن يتكون من 4 إلى 12 رقمًا.");
  const role = accountRole(values.role);
  const pinSalt = makeSalt();
  let allowedViews = undefined;
  if (role === "cashier") {
    if (Array.isArray(values.allowedViews)) {
      allowedViews = values.allowedViews.filter((v) => typeof v === "string" && v);
    } else {
      allowedViews = [...DEFAULT_CASHIER_ALLOWED_VIEWS];
    }
  }
  return {
    id: uid("account"),
    username,
    name,
    role,
    pinSalt,
    pinHash: await hashPin(values.pin, pinSalt),
    mustChangePin: Boolean(values.mustChangePin),
    isActive: values.isActive !== false,
    jobTitle: normalize(values.jobTitle),
    monthlySalary: Math.max(0, toNumber(values.monthlySalary)),
    allowedViews,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

async function ensureInitialAdmin(database) {
  const initialAdmin = await createAccountRecord({ username: "admin", name: "مدير المتجر", role: "admin", pin: "1234", mustChangePin: true });
  const transaction = database.transaction("accounts", "readwrite");
  const accounts = transaction.objectStore("accounts");
  const existing = await requestAsPromise(accounts.count());
  if (!existing) accounts.add(initialAdmin);
  await transactionDone(transaction);
}

async function reconcileCreditInvoices(database) {
  const names = ["meta", "sales", "purchases", "saleReturns", "purchaseReturns", "customerPayments", "supplierPayments", "customers", "suppliers"];
  const transaction = database.transaction(names, "readwrite");
  const meta = transaction.objectStore("meta");
  const marker = await requestAsPromise(meta.get("credit-reconciliation-v6"));
  if (marker?.value) { await transactionDone(transaction); return; }
  const [sales, purchases, saleReturns, purchaseReturns, customerPayments, supplierPayments, customers, suppliers] = await Promise.all(names.slice(1).map((name) => requestAsPromise(transaction.objectStore(name).getAll())));
  const saleReturnsByInvoice = saleReturns.reduce((map, item) => map.set(item.saleId, roundMoney((map.get(item.saleId) || 0) + toNumber(item.total))), new Map());
  const purchaseReturnsByInvoice = purchaseReturns.reduce((map, item) => map.set(item.purchaseId, roundMoney((map.get(item.purchaseId) || 0) + toNumber(item.total))), new Map());
  const salesStore = transaction.objectStore("sales"); const purchasesStore = transaction.objectStore("purchases");
  const customersStore = transaction.objectStore("customers"); const suppliersStore = transaction.objectStore("suppliers");
  const reconcileOwnerInvoices = (invoices, payments, returnsByInvoice, ownerId, ownerStore, invoiceStore) => {
    const byOwner = new Map();
    invoices.filter((invoice) => invoice.paymentType === "آجل" && invoice[ownerId]).forEach((invoice) => {
      const returned = Math.max(toNumber(invoice.returnedTotal), toNumber(returnsByInvoice.get(invoice.id)));
      const effectiveTotal = roundMoney(Math.max(0, toNumber(invoice.total) - returned));
      const initiallyPaid = roundMoney(Math.min(effectiveTotal, toNumber(invoice.initialPaidAmount ?? invoice.paidAmount)));
      const entry = { invoice, effectiveTotal, paid: initiallyPaid, remaining: roundMoney(effectiveTotal - initiallyPaid) };
      const entries = byOwner.get(invoice[ownerId]) || []; entries.push(entry); byOwner.set(invoice[ownerId], entries);
    });
    byOwner.forEach((entries, id) => {
      entries.sort((a, b) => dateOrder(a.invoice).localeCompare(dateOrder(b.invoice)));
      payments.filter((payment) => payment[ownerId] === id).sort((a, b) => dateOrder(a).localeCompare(dateOrder(b))).forEach((payment) => {
        let available = toNumber(payment.amount);
        entries.forEach((entry) => { const applied = Math.min(available, entry.remaining); entry.paid = roundMoney(entry.paid + applied); entry.remaining = roundMoney(entry.remaining - applied); available = roundMoney(available - applied); });
      });
      entries.forEach((entry) => invoiceStore.put({ ...entry.invoice, remainingAmount: entry.remaining, paymentStatus: paymentStatus(entry.effectiveTotal, entry.paid) }));
      const owner = ownerStore.get(id); owner.onsuccess = () => { if (owner.result) ownerStore.put({ ...owner.result, balance: roundMoney(entries.reduce((sum, entry) => sum + entry.remaining, 0)), updatedAt: nowIso() }); };
    });
  };
  reconcileOwnerInvoices(sales, customerPayments, saleReturnsByInvoice, "customerId", customersStore, salesStore);
  reconcileOwnerInvoices(purchases, supplierPayments, purchaseReturnsByInvoice, "supplierId", suppliersStore, purchasesStore);
  meta.put({ id: "credit-reconciliation-v6", value: true, updatedAt: nowIso() });
  await transactionDone(transaction);
}

async function reconcileLegacyProductCosts(database) {
  const transaction = database.transaction(["products", "productBatches"], "readwrite");
  const productsStore = transaction.objectStore("products");
  const [products, batches] = await Promise.all([requestAsPromise(productsStore.getAll()), requestAsPromise(transaction.objectStore("productBatches").getAll())]);
  products.filter((product) => product.legacyQuantity === undefined).forEach((product) => {
    const trackedQuantity = batches.filter((batch) => batch.productId === product.id).reduce((sum, batch) => sum + Math.max(0, toNumber(batch.remainingQuantity)), 0);
    productsStore.put({ ...product, legacyQuantity: Math.max(0, toNumber(product.quantity) - trackedQuantity), legacyUnitCost: toNumber(product.purchasePrice), updatedAt: product.updatedAt || nowIso() });
  });
  await transactionDone(transaction);
}

export const db = {
  async open() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => { databasePromise = null; reject(request.error || new Error("تعذر فتح قاعدة البيانات المحلية.")); };
      request.onupgradeneeded = () => {
        const database = request.result;
        makeIndexedStore(database, "settings");
        makeIndexedStore(database, "products", [["name", "nameLower"], ["barcode", "barcode"], ["internalCode", "internalCode"], ["active", "isDeleted"]]);
        makeIndexedStore(database, "sales", [["date", "date"], ["invoiceNumber", "invoiceNumber", { unique: true }]]);
        makeIndexedStore(database, "saleItems", [["saleId", "saleId"], ["productId", "productId"]]);
        makeIndexedStore(database, "stockMovements", [["productId", "productId"], ["date", "date"], ["type", "type"]]);
        makeIndexedStore(database, "meta");
        makeIndexedStore(database, "suppliers", [["name", "nameLower"], ["active", "isDeleted"]]);
        makeIndexedStore(database, "purchases", [["date", "date"], ["invoiceNumber", "invoiceNumber", { unique: true }], ["supplierId", "supplierId"]]);
        makeIndexedStore(database, "purchaseItems", [["purchaseId", "purchaseId"], ["productId", "productId"]]);
        makeIndexedStore(database, "productBatches", [["productId", "productId"], ["expiryDate", "expiryDate"], ["productExpiry", ["productId", "expiryDate"]]]);
        makeIndexedStore(database, "purchaseReturns", [["purchaseId", "purchaseId"], ["date", "date"]]);
        makeIndexedStore(database, "purchaseReturnItems", [["purchaseReturnId", "purchaseReturnId"], ["purchaseItemId", "purchaseItemId"]]);
        makeIndexedStore(database, "saleReturns", [["saleId", "saleId"], ["date", "date"]]);
        makeIndexedStore(database, "saleReturnItems", [["saleReturnId", "saleReturnId"], ["saleItemId", "saleItemId"]]);
        makeIndexedStore(database, "expenses", [["date", "date"], ["category", "category"]]);
        makeIndexedStore(database, "customers", [["name", "nameLower"], ["active", "isDeleted"], ["balance", "balance"]]);
        makeIndexedStore(database, "customerPayments", [["customerId", "customerId"], ["date", "date"]]);
        makeIndexedStore(database, "customerTransactions", [["customerId", "customerId"], ["date", "date"], ["type", "type"]]);
        makeIndexedStore(database, "supplierPayments", [["supplierId", "supplierId"], ["date", "date"]]);
        makeIndexedStore(database, "supplierTransactions", [["supplierId", "supplierId"], ["date", "date"], ["type", "type"]]);
        makeIndexedStore(database, "cashMovements", [["date", "date"], ["type", "type"]]);
        makeIndexedStore(database, "cashierShifts", [["accountId", "accountId"], ["date", "date"], ["status", "status"]]);
        makeIndexedStore(database, "cashierSalaryDeductions", [["accountId", "accountId"], ["shiftId", "shiftId", { unique: true }], ["month", "month"]]);
        makeIndexedStore(database, "localBackups", [["createdAt", "createdAt"]]);
        makeIndexedStore(database, "stockCounts", [["productId", "productId"], ["date", "date"]]);
        makeIndexedStore(database, "periodicInventories", [["cycle", "cycle"], ["periodFrom", "periodFrom"], ["periodTo", "periodTo"], ["createdAt", "createdAt"]]);
        makeIndexedStore(database, "accounts", [["username", "username", { unique: true }], ["role", "role"], ["active", "isActive"]]);
        const salesStore = request.transaction.objectStore("sales");
        if (!salesStore.indexNames.contains("customerId")) salesStore.createIndex("customerId", "customerId");
        const suppliersStore = request.transaction.objectStore("suppliers");
        suppliersStore.getAll().onsuccess = (event) => event.target.result.forEach((supplier) => {
          if (typeof supplier.balance !== "number") suppliersStore.put({ ...supplier, balance: 0, updatedAt: supplier.updatedAt || nowIso() });
        });
        const purchasesStore = request.transaction.objectStore("purchases");
        purchasesStore.getAll().onsuccess = (event) => event.target.result.forEach((purchase) => {
          if (!purchase.paymentType) purchasesStore.put({ ...purchase, paymentType: "نقدي", paymentMethod: "نقدي", paidAmount: toNumber(purchase.total), initialPaidAmount: toNumber(purchase.total), remainingAmount: 0, paymentStatus: "مدفوعة" });
        });
      };
      request.onsuccess = async () => { try { await ensureInitialAdmin(request.result); await reconcileCreditInvoices(request.result); await reconcileLegacyProductCosts(request.result); resolve(request.result); } catch (error) { reject(error); } };
    });
    return databasePromise;
  },

  async getSettings() { const database = await this.open(); return requestAsPromise(database.transaction("settings", "readonly").objectStore("settings").get("app")); },
  async configureInitialAdmin({ username, pin, name }) {
    const normalized = normalizeUsername(username);
    const accountName = normalize(name);
    if (!normalized || normalized.length < 3 || normalized.length > 30) throw new Error("اسم المستخدم يجب أن يتكون من 3 إلى 30 حرفًا أو رقمًا.");
    if (!accountName) throw new Error("اسم صاحب الحساب مطلوب.");
    if (!validatePin(pin)) throw new Error("كلمة المرور يجب أن تتكون من 4 إلى 64 حرفًا أو رقمًا دون مسافات.");
    const database = await this.open();
    const transaction = database.transaction("accounts", "readwrite");
    const accounts = transaction.objectStore("accounts");
    const admins = (await requestAsPromise(accounts.getAll())).filter((account) => account.role === "admin");
    const current = admins[0];
    if (!current) throw new Error("تعذر العثور على حساب المدير الأول.");
    const duplicate = await requestAsPromise(accounts.index("username").get(normalized));
    if (duplicate && duplicate.id !== current.id) throw new Error("اسم المستخدم مستخدم بالفعل.");
    const pinSalt = makeSalt();
    const pinHash = await hashPin(pin, pinSalt);
    accounts.put({ ...current, username: normalized, name: accountName, pinSalt, pinHash, mustChangePin: false, isActive: true, updatedAt: nowIso() });
    await transactionDone(transaction);
  },
  async saveSettings(values) { const database = await this.open(); const transaction = database.transaction("settings", "readwrite"); const store = transaction.objectStore("settings"); const current = await requestAsPromise(store.get("app")); const nextValues = { ...values }; if (Object.prototype.hasOwnProperty.call(nextValues, "cashierDiscountLimitPercent")) nextValues.cashierDiscountLimitPercent = normalizeCashierDiscountLimit(nextValues.cashierDiscountLimitPercent); store.put({ ...current, id: "app", ...nextValues, cashierDiscountLimitPercent: normalizeCashierDiscountLimit(nextValues.cashierDiscountLimitPercent ?? current?.cashierDiscountLimitPercent, 10), setupCompleted: true, updatedAt: nowIso() }); await transactionDone(transaction); },
  async saveStoreLogoDataUrl(dataUrl) { await this.saveSettings({ storeLogoDataUrl: normalizeStoreLogoDataUrl(dataUrl) }); },

  async listAccounts() { const database = await this.open(); const accounts = await requestAsPromise(database.transaction("accounts", "readonly").objectStore("accounts").getAll()); return accounts.sort((a, b) => a.role === b.role ? a.name.localeCompare(b.name, "ar") : a.role === "admin" ? -1 : 1); },
  async getPersistentSession() {
    const database = await this.open();
    const marker = await requestAsPromise(database.transaction("meta", "readonly").objectStore("meta").get(ACTIVE_SESSION_META_ID));
    let accountId = marker?.accountId || "";
    if (!accountId) { try { accountId = JSON.parse(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) || "{}").accountId || ""; } catch { accountId = ""; } }
    if (!accountId) return null;
    const account = await requestAsPromise(database.transaction("accounts", "readonly").objectStore("accounts").get(accountId));
    const user = toPersistentSessionUser(account);
    if (!user) { await this.clearPersistentSession(); return null; }
    try { localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify({ accountId: user.id, updatedAt: nowIso() })); } catch { /* localStorage may be unavailable in private mode */ }
    return user;
  },
  async savePersistentSession(accountId) {
    const database = await this.open(); const transaction = database.transaction(["accounts", "meta"], "readwrite");
    const account = await requestAsPromise(transaction.objectStore("accounts").get(accountId));
    if (!toPersistentSessionUser(account)) throw new Error("الحساب غير متاح لحفظ الجلسة.");
    transaction.objectStore("meta").put({ id: ACTIVE_SESSION_META_ID, accountId, updatedAt: nowIso() }); await transactionDone(transaction);
    try { localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify({ accountId, updatedAt: nowIso() })); } catch { /* localStorage may be unavailable in private mode */ }
  },
  async clearPersistentSession() { const database = await this.open(); const transaction = database.transaction("meta", "readwrite"); transaction.objectStore("meta").delete(ACTIVE_SESSION_META_ID); await transactionDone(transaction); try { localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY); } catch { /* localStorage may be unavailable in private mode */ } },
  async authenticateAccount({ username, pin }) {
    const normalized = normalizeUsername(username); const database = await this.open(); const account = await requestAsPromise(database.transaction("accounts", "readonly").objectStore("accounts").index("username").get(normalized));
    if (!account || !account.isActive || !validatePin(pin) || await hashPin(pin, account.pinSalt) !== account.pinHash) throw new Error("بيانات الدخول غير صحيحة.");
    return toPersistentSessionUser(account);
  },
  async authenticateBackupAccount(payload, { username, pin }) {
    const normalized = normalizeUsername(username);
    const account = (payload?.stores?.accounts || []).find((item) => item.username === normalized);
    if (!account || account.role !== "admin" || !account.isActive || !validatePin(pin) || await hashPin(pin, account.pinSalt) !== account.pinHash) throw new Error("بيانات الأدمن في النسخة السحابية غير صحيحة.");
    return toPersistentSessionUser(account);
  },
  async createAccount(values) {
    const account = await createAccountRecord({ ...values, role: values.role || "cashier" }); const database = await this.open(); const transaction = database.transaction("accounts", "readwrite"); const accounts = transaction.objectStore("accounts");
    if (await requestAsPromise(accounts.index("username").get(account.username))) throw new Error("اسم المستخدم مستخدم بالفعل.");
    accounts.add(account); await transactionDone(transaction); return account;
  },
  async updateAccount(accountId, values) {
    const database = await this.open(); const transaction = database.transaction("accounts", "readwrite"); const accounts = transaction.objectStore("accounts"); const current = await requestAsPromise(accounts.get(accountId));
    if (!current) throw new Error("الحساب غير موجود.");
    const nextUsername = normalizeUsername(values.username ?? current.username);
    if (!nextUsername || nextUsername.length < 3 || nextUsername.length > 30) throw new Error("اسم المستخدم يجب أن يتكون من 3 إلى 30 حرفًا أو رقمًا.");
    const duplicate = await requestAsPromise(accounts.index("username").get(nextUsername));
    if (duplicate && duplicate.id !== accountId) throw new Error("اسم المستخدم مستخدم بالفعل.");
    const nextRole = accountRole(values.role ?? current.role); const nextActive = values.isActive ?? current.isActive;
    if (current.role === "admin" && current.isActive && (nextRole !== "admin" || !nextActive)) {
      const all = await requestAsPromise(accounts.getAll());
      if (all.filter((account) => account.role === "admin" && account.isActive).length <= 1) throw new Error("يجب الإبقاء على حساب أدمن نشط واحد على الأقل.");
    }
    const name = normalize(values.name ?? current.name); if (!name) throw new Error("اسم الحساب مطلوب.");
    const jobTitle = normalize(values.jobTitle ?? current.jobTitle);
    const monthlySalary = Math.max(0, toNumber(values.monthlySalary ?? current.monthlySalary));
    let allowedViews = current.allowedViews;
    if (nextRole === "cashier") {
      if (Array.isArray(values.allowedViews)) {
        allowedViews = values.allowedViews.filter((v) => typeof v === "string" && v);
      } else if (!allowedViews) {
        allowedViews = [...DEFAULT_CASHIER_ALLOWED_VIEWS];
      }
    } else if (nextRole === "admin") {
      allowedViews = undefined;
    }
    const updated = { ...current, username: nextUsername, name, role: nextRole, jobTitle, monthlySalary, allowedViews, isActive: nextActive, updatedAt: nowIso() }; accounts.put(updated); await transactionDone(transaction); return updated;
  },
  async deleteCashierAccount(accountId) {
    const database = await this.open(); const transaction = database.transaction("accounts", "readwrite"); const accounts = transaction.objectStore("accounts"); const current = await requestAsPromise(accounts.get(accountId));
    if (!current) throw new Error("الحساب غير موجود.");
    if (current.role !== "cashier") throw new Error("لا يمكن حذف حساب الأدمن من هنا.");
    accounts.put({ ...current, isActive: false, deletedAt: nowIso(), updatedAt: nowIso() });
    await transactionDone(transaction); return { ...current, isActive: false };
  },
  async changeAccountPin(accountId, pin) {
    if (!validatePin(pin)) throw new Error("رمز الدخول يجب أن يتكون من 4 إلى 12 رقمًا.");
    const database = await this.open(); const current = await requestAsPromise(database.transaction("accounts", "readonly").objectStore("accounts").get(accountId)); if (!current) throw new Error("الحساب غير موجود.");
    const pinSalt = makeSalt(); const pinHash = await hashPin(pin, pinSalt); const transaction = database.transaction("accounts", "readwrite"); transaction.objectStore("accounts").put({ ...current, pinSalt, pinHash, mustChangePin: false, updatedAt: nowIso() }); await transactionDone(transaction);
  },
  async resetAccountPinByAdmin(accountId, pin) {
    if (!validatePin(pin)) throw new Error("رمز الدخول يجب أن يتكون من 4 إلى 12 رقمًا.");
    const database = await this.open(); const current = await requestAsPromise(database.transaction("accounts", "readonly").objectStore("accounts").get(accountId)); if (!current || !current.isActive) throw new Error("الحساب غير متاح لإعادة التعيين.");
    const pinSalt = makeSalt(); const pinHash = await hashPin(pin, pinSalt); const transaction = database.transaction("accounts", "readwrite"); transaction.objectStore("accounts").put({ ...current, pinSalt, pinHash, mustChangePin: current.role === "cashier", updatedAt: nowIso() }); await transactionDone(transaction);
  },
  async listProducts({ includeDeleted = false } = {}) {
    const database = await this.open();
    const products = await requestAsPromise(database.transaction("products", "readonly").objectStore("products").getAll());
    return products.filter((product) => includeDeleted || !product.isDeleted).map((product) => ({ ...product, category: normalizeProductCategory(product.category, product.unit) })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  },
  async listProductSupplierLinks() {
    const database = await this.open(); const transaction = database.transaction(["products", "purchases", "purchaseItems", "suppliers"], "readonly");
    const [products, purchases, items, suppliers] = await Promise.all([requestAsPromise(transaction.objectStore("products").getAll()), requestAsPromise(transaction.objectStore("purchases").getAll()), requestAsPromise(transaction.objectStore("purchaseItems").getAll()), requestAsPromise(transaction.objectStore("suppliers").getAll())]);
    const purchasesById = new Map(purchases.map((purchase) => [purchase.id, purchase])); const suppliersById = new Map(suppliers.filter((supplier) => !supplier.isDeleted).map((supplier) => [supplier.id, supplier])); const links = {};
    products.forEach((product) => { const supplier = product.lastSupplierId ? suppliersById.get(product.lastSupplierId) : null; if (supplier) links[product.id] = { id: supplier.id, name: supplier.name, phone: supplier.phone, purchase: { id: product.lastSupplierPurchaseId || "", date: product.lastSupplierAt || "" } }; });
    items.forEach((item) => { const purchase = purchasesById.get(item.purchaseId); const supplier = purchase?.supplierId ? suppliersById.get(purchase.supplierId) : null; if (!purchase || !supplier) return; const previous = links[item.productId]; if (!previous || dateOrder(purchase) > dateOrder(previous.purchase)) links[item.productId] = { id: supplier.id, name: supplier.name, phone: supplier.phone, purchase: { id: purchase.id, date: purchase.date } }; });
    return links;
  },
  async listProductBatches(productId = "") { const database = await this.open(); const items = await requestAsPromise(database.transaction("productBatches", "readonly").objectStore("productBatches").getAll()); return items.filter((item) => !productId || item.productId === productId).sort((a, b) => String(a.expiryDate || "9999-12-31").localeCompare(String(b.expiryDate || "9999-12-31"))); },
  async getProduct(productId) { const database = await this.open(); return requestAsPromise(database.transaction("products", "readonly").objectStore("products").get(productId)); },
  async findProductByBarcode(barcode, excludeProductId = null) {
    const normalized = normalize(barcode); if (!normalized) return null;
    const database = await this.open();
    const matches = await requestAsPromise(database.transaction("products", "readonly").objectStore("products").index("barcode").getAll(normalized));
    return matches.find((item) => !item.isDeleted && item.id !== excludeProductId) || null;
  },
  async findProductByInternalCode(internalCode) {
    const normalized = normalize(internalCode); if (!normalized) return null;
    const database = await this.open();
    const products = await requestAsPromise(database.transaction("products", "readonly").objectStore("products").getAll());
    return products.find((item) => !item.isDeleted && normalize(item.internalCode) === normalized) || null;
  },
  async createProduct(values) {
    const database = await this.open(); const transaction = database.transaction(["products", "stockMovements"], "readwrite");
    const products = transaction.objectStore("products"); const createdAt = nowIso(); const quantity = Math.max(0, toNumber(values.quantity)); const barcode = normalize(values.barcode);
    const duplicate = barcode ? (await requestAsPromise(products.index("barcode").getAll(barcode))).find((item) => !item.isDeleted) : null;
    if (duplicate) throw new Error(`هذا الباركود مستخدم بالفعل للمنتج: ${duplicate.name}`);
    const unitsPerPackage = Math.max(1, toNumber(values.unitsPerPackage) || 1); const nearestProductionDate = normalize(values.nearestProductionDate); const nearestExpiryDate = normalize(values.nearestExpiryDate);
    if (nearestProductionDate && !/^\d{4}-\d{2}-\d{2}$/.test(nearestProductionDate)) throw new Error("أدخل تاريخ إنتاج صالحًا أو اترك الحقل فارغًا.");
    if (nearestExpiryDate && (!/^\d{4}-\d{2}-\d{2}$/.test(nearestExpiryDate) || nearestExpiryDate <= dateKey())) throw new Error("أدخل تاريخ انتهاء مستقبليًا صالحًا أو اترك الحقل فارغًا.");
    if (nearestProductionDate && nearestExpiryDate && nearestProductionDate > nearestExpiryDate) throw new Error("تاريخ الإنتاج يجب أن يسبق تاريخ الانتهاء.");
    const purchasePackageUnit = normalize(values.purchasePackageUnit || values.packageUnit || "حبة") || "حبة";
    const product = { id: uid("product"), name: normalize(values.name), nameLower: normalize(values.name).toLocaleLowerCase("ar"), barcode, internalCode: normalize(values.internalCode), category: normalizeProductCategory(values.category, values.unit), purchasePrice: Math.max(0, toNumber(values.purchasePrice)), salePrice: Math.max(0, toNumber(values.salePrice)), quantity, minimumStock: Math.max(0, toNumber(values.minimumStock)), legacyQuantity: quantity, legacyUnitCost: Math.max(0, toNumber(values.purchasePrice)), nearestProductionDate, unit: values.unit || "حبة", purchasePackageUnit, unitsPerPackage, lastPackageCost: Math.max(0, toNumber(values.lastPackageCost ?? values.packageCost)), nearestExpiryDate, createdAt, updatedAt: createdAt, isDeleted: false };
    if (!product.name) throw new Error("اسم المنتج مطلوب.");
    products.add(product);
    if (quantity > 0) createStockMovement(transaction.objectStore("stockMovements"), { productId: product.id, type: "INITIAL", quantity, previousQuantity: 0, newQuantity: quantity, date: createdAt, note: "كمية افتتاحية", referenceType: "PRODUCT", referenceId: product.id });
    await transactionDone(transaction); return product;
  },
  async updateProduct(productId, values) {
    const database = await this.open(); const transaction = database.transaction("products", "readwrite"); const store = transaction.objectStore("products"); const current = await requestAsPromise(store.get(productId));
    if (!current || current.isDeleted) throw new Error("المنتج غير متاح للتعديل.");
    const barcode = normalize(values.barcode); const duplicate = barcode ? (await requestAsPromise(store.index("barcode").getAll(barcode))).find((item) => !item.isDeleted && item.id !== productId) : null;
    if (duplicate) throw new Error(`هذا الباركود مستخدم بالفعل للمنتج: ${duplicate.name}`);
    const nearestProductionDate = normalize(values.nearestProductionDate ?? current.nearestProductionDate); const nearestExpiryDate = normalize(values.nearestExpiryDate ?? current.nearestExpiryDate);
    if (nearestProductionDate && !/^\d{4}-\d{2}-\d{2}$/.test(nearestProductionDate)) throw new Error("أدخل تاريخ إنتاج صالحًا أو اترك الحقل فارغًا.");
    if (nearestExpiryDate && (!/^\d{4}-\d{2}-\d{2}$/.test(nearestExpiryDate) || nearestExpiryDate <= dateKey())) throw new Error("أدخل تاريخ انتهاء مستقبليًا صالحًا أو اترك الحقل فارغًا.");
    if (nearestProductionDate && nearestExpiryDate && nearestProductionDate > nearestExpiryDate) throw new Error("تاريخ الإنتاج يجب أن يسبق تاريخ الانتهاء.");
    const updated = { ...current, name: normalize(values.name), nameLower: normalize(values.name).toLocaleLowerCase("ar"), barcode, internalCode: normalize(values.internalCode), category: normalizeProductCategory(values.category || current.category, values.unit || current.unit), purchasePrice: Math.max(0, toNumber(values.purchasePrice)), salePrice: Math.max(0, toNumber(values.salePrice)), minimumStock: Math.max(0, toNumber(values.minimumStock)), nearestProductionDate, unit: values.unit, purchasePackageUnit: normalize(values.purchasePackageUnit || values.packageUnit || current.purchasePackageUnit || "حبة") || "حبة", unitsPerPackage: Math.max(1, toNumber(values.unitsPerPackage ?? current.unitsPerPackage) || 1), lastPackageCost: Math.max(0, toNumber(values.lastPackageCost ?? values.packageCost ?? current.lastPackageCost)), nearestExpiryDate, updatedAt: nowIso() };
    if (!updated.name) throw new Error("اسم المنتج مطلوب."); store.put(updated); await transactionDone(transaction); return updated;
  },
  async softDeleteProduct(productId) {
    const database = await this.open(); const transaction = database.transaction(["products", "saleItems"], "readwrite"); const productStore = transaction.objectStore("products"); const product = await requestAsPromise(productStore.get(productId));
    if (!product) throw new Error("المنتج غير موجود."); const linkedSales = await requestAsPromise(transaction.objectStore("saleItems").index("productId").count(productId)); productStore.put({ ...product, isDeleted: true, deletedAt: nowIso(), deletionReason: linkedSales > 0 ? "مرتبط بفواتير" : "حذف من الكتالوج" }); await transactionDone(transaction); return { linkedSales };
  },
  async softDeleteAllProducts() {
    const database = await this.open(); const transaction = database.transaction("products", "readwrite"); const store = transaction.objectStore("products"); const products = await requestAsPromise(store.getAll()); const deletedAt = nowIso(); products.filter((product) => !product.isDeleted).forEach((product) => store.put({ ...product, isDeleted: true, deletedAt, deletionReason: "حذف جميع المنتجات من الإعدادات" })); await transactionDone(transaction); return products.filter((product) => !product.isDeleted).length;
  },
  async bulkUpsertProducts(operations) {
    const database = await this.open(); const transaction = database.transaction(["products", "stockMovements"], "readwrite"); const products = transaction.objectStore("products"); const movements = transaction.objectStore("stockMovements"); const date = nowIso();
    operations.forEach((operation) => { if (operation.type === "update") { const current = operation.current; products.put({ ...current, ...operation.values, updatedAt: date }); return; } const values = operation.values; const quantity = Math.max(0, toNumber(values.quantity)); const product = { id: uid("product"), name: normalize(values.name), nameLower: normalize(values.name).toLocaleLowerCase("ar"), barcode: normalize(values.barcode), internalCode: normalize(values.internalCode), category: normalizeProductCategory(values.category, values.unit), purchasePrice: Math.max(0, toNumber(values.purchasePrice)), salePrice: Math.max(0, toNumber(values.salePrice)), quantity, minimumStock: 0, legacyQuantity: quantity, legacyUnitCost: Math.max(0, toNumber(values.purchasePrice)), nearestProductionDate: "", nearestExpiryDate: "", unit: values.unit || "حبة", purchasePackageUnit: "حبة", unitsPerPackage: 1, lastPackageCost: 0, createdAt: date, updatedAt: date, isDeleted: false }; products.add(product); if (quantity > 0) createStockMovement(movements, { productId: product.id, type: "INITIAL", quantity, previousQuantity: 0, newQuantity: quantity, date, note: "كمية مستوردة", referenceType: "PRODUCT", referenceId: product.id }); }); await transactionDone(transaction); return operations.length;
  },
  async logActivity({ type, details, accountId = "", accountName = "", entityId = "" }) {
    const log = {
      id: uid("act"),
      date: nowIso(),
      type: normalize(type),
      details: normalize(details),
      accountId: normalize(accountId),
      accountName: normalize(accountName) || "النظام",
      entityId: normalize(entityId),
    };
    try {
      const database = await this.open();
      const tx = database.transaction("meta", "readwrite");
      const meta = tx.objectStore("meta");
      const existing = (await requestAsPromise(meta.get("hesabi_activity_logs")))?.value || [];
      existing.unshift(log);
      if (existing.length > 500) existing.length = 500;
      meta.put({ id: "hesabi_activity_logs", value: existing, updatedAt: nowIso() });
      await transactionDone(tx);
    } catch (err) {
      console.warn("[Hesabi logActivity error]", err);
    }
    return log;
  },

  async listActivityLogs({ type = "", query = "", from = "", to = "" } = {}) {
    try {
      const database = await this.open();
      const tx = database.transaction("meta", "readonly");
      const logs = (await requestAsPromise(tx.objectStore("meta").get("hesabi_activity_logs")))?.value || [];
      await transactionDone(tx);
      const q = query.trim().toLocaleLowerCase("ar");
      return logs.filter((log) => {
        if (type && type !== "الكل" && log.type !== type) return false;
        if (from && dateKey(log.date) < from) return false;
        if (to && dateKey(log.date) > to) return false;
        if (q && !`${log.details} ${log.accountName} ${log.type}`.toLocaleLowerCase("ar").includes(q)) return false;
        return true;
      });
    } catch {
      return [];
    }
  },

  async adjustStock(productId, newQuantity, note) {
    const database = await this.open(); const transaction = database.transaction(["products", "stockMovements"], "readwrite"); const products = transaction.objectStore("products"); const product = await requestAsPromise(products.get(productId));
    if (!product || product.isDeleted) throw new Error("المنتج غير متاح."); const previousQuantity = toNumber(product.quantity); const nextQuantity = Math.max(0, toNumber(newQuantity)); const date = nowIso(); products.put({ ...product, quantity: nextQuantity, updatedAt: date }); createStockMovement(transaction.objectStore("stockMovements"), { productId, type: "ADJUSTMENT", quantity: adjustmentDelta(previousQuantity, nextQuantity), previousQuantity, newQuantity: nextQuantity, date, note: normalize(note), referenceType: "ADJUSTMENT", referenceId: productId }); await transactionDone(transaction); return { ...product, quantity: nextQuantity };
  },

  async listSuppliers({ includeDeleted = false } = {}) { const database = await this.open(); const items = await requestAsPromise(database.transaction("suppliers", "readonly").objectStore("suppliers").getAll()); return items.filter((item) => includeDeleted || !item.isDeleted).sort((a, b) => a.name.localeCompare(b.name, "ar")); },
  async createSupplier(values) { const name = normalize(values.name); if (!name) throw new Error("اسم المورد مطلوب."); const database = await this.open(); const transaction = database.transaction("suppliers", "readwrite"); const date = nowIso(); const supplier = { id: uid("supplier"), name, nameLower: name.toLocaleLowerCase("ar"), phone: normalize(values.phone), address: normalize(values.address), notes: normalize(values.notes), balance: 0, createdAt: date, updatedAt: date, isDeleted: false }; transaction.objectStore("suppliers").add(supplier); await transactionDone(transaction); return supplier; },
  async getSupplierAccount(supplierId) { const database = await this.open(); const transaction = database.transaction(["suppliers", "purchases", "supplierPayments", "supplierTransactions"], "readonly"); const supplier = await requestAsPromise(transaction.objectStore("suppliers").get(supplierId)); if (!supplier) return null; const [purchases, payments, transactions] = await Promise.all([requestAsPromise(transaction.objectStore("purchases").index("supplierId").getAll(supplierId)), requestAsPromise(transaction.objectStore("supplierPayments").index("supplierId").getAll(supplierId)), requestAsPromise(transaction.objectStore("supplierTransactions").index("supplierId").getAll(supplierId))]); const totalPurchases = roundMoney(purchases.reduce((sum, purchase) => sum + toNumber(purchase.total), 0)); const totalPaid = roundMoney(purchases.reduce((sum, purchase) => sum + toNumber(purchase.initialPaidAmount ?? purchase.paidAmount), 0) + payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0)); return { supplier, purchases, payments, transactions: transactions.sort((a, b) => new Date(b.date) - new Date(a.date)), totalPurchases, totalPaid, balance: roundMoney(toNumber(supplier.balance)) }; },
  async listSupplierPayments({ from = "", to = "" } = {}) { const database = await this.open(); const items = await requestAsPromise(database.transaction("supplierPayments", "readonly").objectStore("supplierPayments").getAll()); return items.filter((item) => isWithinDateRange(item.date, from, to)).sort((a, b) => new Date(b.date) - new Date(a.date)); },
  async registerSupplierPayment({ supplierId, amount, date = dateKey(), notes = "", paymentMethod = "نقدي" }) { const paid = roundMoney(toNumber(amount)); const resolvedPaymentMethod = paymentMethod === "تحويل" ? "تحويل" : "نقدي"; const database = await this.open(); const transaction = database.transaction(["suppliers", "supplierPayments", "supplierTransactions", "purchases"], "readwrite"); const suppliers = transaction.objectStore("suppliers"); const supplier = await requestAsPromise(suppliers.get(supplierId)); if (!supplier || supplier.isDeleted) throw new Error("المورد غير متاح."); const beforeBalance = roundMoney(toNumber(supplier.balance)); if (!canRegisterPayment(beforeBalance, paid)) throw new Error("المبلغ المدفوع أكبر من المستحق للمورد."); const afterBalance = roundMoney(beforeBalance - paid); const purchasesStore = transaction.objectStore("purchases"); const unpaid = (await requestAsPromise(purchasesStore.index("supplierId").getAll(supplierId))).filter((purchase) => purchase.paymentType === "آجل" && toNumber(purchase.remainingAmount) > 0).sort((a, b) => dateOrder(a).localeCompare(dateOrder(b))); let available = paid; const allocations = []; unpaid.forEach((purchase) => { const applied = roundMoney(Math.min(available, toNumber(purchase.remainingAmount))); if (applied <= 0) return; const remainingAmount = roundMoney(toNumber(purchase.remainingAmount) - applied); const paidAmount = roundMoney(toNumber(purchase.total) - remainingAmount); purchasesStore.put({ ...purchase, paidAmount, remainingAmount, paymentStatus: remainingAmount === 0 ? "مدفوعة" : "مدفوعة جزئيًا" }); allocations.push({ purchaseId: purchase.id, invoiceNumber: purchase.invoiceNumber, amount: applied }); available = roundMoney(available - applied); }); const createdAt = nowIso(); const payment = { id: uid("supplier-payment"), supplierId, supplierName: supplier.name, amount: paid, date, notes: normalize(notes), paymentMethod: resolvedPaymentMethod, balanceBefore: beforeBalance, balanceAfter: afterBalance, allocations, createdAt }; transaction.objectStore("supplierPayments").add(payment); suppliers.put({ ...supplier, balance: afterBalance, updatedAt: createdAt }); transaction.objectStore("supplierTransactions").add({ id: uid("supplier-transaction"), supplierId, type: "PAYMENT", date, amount: paid, paidAmount: paid, remainingAmount: afterBalance, referenceType: "PAYMENT", referenceId: payment.id, note: normalize(notes), createdAt }); await transactionDone(transaction); return payment; },
  async updateSupplier(supplierId, values) { const database = await this.open(); const transaction = database.transaction("suppliers", "readwrite"); const store = transaction.objectStore("suppliers"); const current = await requestAsPromise(store.get(supplierId)); const name = normalize(values.name); if (!current || current.isDeleted) throw new Error("المورد غير متاح."); if (!name) throw new Error("اسم المورد مطلوب."); const updated = { ...current, name, nameLower: name.toLocaleLowerCase("ar"), phone: normalize(values.phone), address: normalize(values.address), notes: normalize(values.notes), updatedAt: nowIso() }; store.put(updated); await transactionDone(transaction); return updated; },
  async softDeleteSupplier(supplierId) { const database = await this.open(); const transaction = database.transaction("suppliers", "readwrite"); const store = transaction.objectStore("suppliers"); const supplier = await requestAsPromise(store.get(supplierId)); if (!supplier) throw new Error("المورد غير موجود."); store.put({ ...supplier, isDeleted: true, deletedAt: nowIso() }); await transactionDone(transaction); },

  async listCustomers({ includeDeleted = false } = {}) { const database = await this.open(); const items = await requestAsPromise(database.transaction("customers", "readonly").objectStore("customers").getAll()); return items.filter((item) => includeDeleted || !item.isDeleted).sort((a, b) => a.name.localeCompare(b.name, "ar")); },
  async getCustomer(customerId) { const database = await this.open(); return requestAsPromise(database.transaction("customers", "readonly").objectStore("customers").get(customerId)); },
  async createCustomer(values) { const name = normalize(values.name); if (!name) throw new Error("اسم العميل مطلوب."); const database = await this.open(); const transaction = database.transaction("customers", "readwrite"); const date = nowIso(); const creditLimit = values.creditLimit === "" || values.creditLimit === undefined ? null : normalizeCreditLimit(values.creditLimit); const customer = { id: uid("customer"), name, nameLower: name.toLocaleLowerCase("ar"), phone: normalize(values.phone), address: normalize(values.address), notes: normalize(values.notes), creditLimit, balance: 0, createdAt: date, updatedAt: date, isDeleted: false }; transaction.objectStore("customers").add(customer); await transactionDone(transaction); return customer; },
  async updateCustomer(customerId, values) { const database = await this.open(); const transaction = database.transaction("customers", "readwrite"); const store = transaction.objectStore("customers"); const current = await requestAsPromise(store.get(customerId)); const name = normalize(values.name); if (!current || current.isDeleted) throw new Error("العميل غير متاح."); if (!name) throw new Error("اسم العميل مطلوب."); const creditLimit = values.creditLimit === "" || values.creditLimit === undefined ? current.creditLimit ?? null : normalizeCreditLimit(values.creditLimit); const updated = { ...current, name, nameLower: name.toLocaleLowerCase("ar"), phone: normalize(values.phone), address: normalize(values.address), notes: normalize(values.notes), creditLimit, updatedAt: nowIso() }; store.put(updated); await transactionDone(transaction); return updated; },
  async softDeleteCustomer(customerId) { const database = await this.open(); const transaction = database.transaction("customers", "readwrite"); const store = transaction.objectStore("customers"); const customer = await requestAsPromise(store.get(customerId)); if (!customer) throw new Error("العميل غير موجود."); store.put({ ...customer, isDeleted: true, deletedAt: nowIso(), updatedAt: nowIso() }); await transactionDone(transaction); },
  async getCustomerAccount(customerId) { const database = await this.open(); const transaction = database.transaction(["customers", "sales", "customerPayments", "customerTransactions"], "readonly"); const customer = await requestAsPromise(transaction.objectStore("customers").get(customerId)); if (!customer) return null; const [sales, payments, transactions] = await Promise.all([requestAsPromise(transaction.objectStore("sales").index("customerId").getAll(customerId)), requestAsPromise(transaction.objectStore("customerPayments").index("customerId").getAll(customerId)), requestAsPromise(transaction.objectStore("customerTransactions").index("customerId").getAll(customerId))]); const creditSales = roundMoney(sales.reduce((sum, sale) => sum + toNumber(sale.total), 0)); const paid = roundMoney(sales.reduce((sum, sale) => sum + toNumber(sale.initialPaidAmount ?? sale.paidAmount), 0) + payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0)); return { customer, sales, payments, transactions: transactions.sort((a, b) => new Date(b.date) - new Date(a.date)), totalSales: creditSales, totalPaid: paid, balance: roundMoney(toNumber(customer.balance)) }; },
  async listCustomerPayments({ from = "", to = "" } = {}) { const database = await this.open(); const items = await requestAsPromise(database.transaction("customerPayments", "readonly").objectStore("customerPayments").getAll()); return items.filter((item) => isWithinDateRange(item.date, from, to)).sort((a, b) => new Date(b.date) - new Date(a.date)); },
  async registerCustomerPayment({ customerId, amount, date = dateKey(), notes = "", paymentMethod = "نقدي" }) { const paid = roundMoney(toNumber(amount)); const database = await this.open(); const transaction = database.transaction(["customers", "customerPayments", "customerTransactions", "sales"], "readwrite"); const customers = transaction.objectStore("customers"); const customer = await requestAsPromise(customers.get(customerId)); if (!customer || customer.isDeleted) throw new Error("العميل غير متاح."); const beforeBalance = roundMoney(toNumber(customer.balance)); if (!canRegisterPayment(beforeBalance, paid)) throw new Error("المبلغ المدفوع أكبر من الرصيد المستحق."); const afterBalance = roundMoney(beforeBalance - paid); const salesStore = transaction.objectStore("sales"); const unpaid = (await requestAsPromise(salesStore.index("customerId").getAll(customerId))).filter((sale) => sale.paymentType === "آجل" && toNumber(sale.remainingAmount) > 0).sort((a, b) => dateOrder(a).localeCompare(dateOrder(b))); let available = paid; const allocations = []; unpaid.forEach((sale) => { const applied = roundMoney(Math.min(available, toNumber(sale.remainingAmount))); if (applied <= 0) return; const remainingAmount = roundMoney(toNumber(sale.remainingAmount) - applied); const paidAmount = roundMoney(toNumber(sale.total) - remainingAmount); salesStore.put({ ...sale, paidAmount, remainingAmount, paymentStatus: remainingAmount === 0 ? "مدفوعة" : "مدفوعة جزئيًا" }); allocations.push({ saleId: sale.id, invoiceNumber: sale.invoiceNumber, amount: applied }); available = roundMoney(available - applied); }); const createdAt = nowIso(); const payment = { id: uid("customer-payment"), customerId, customerName: customer.name, amount: paid, date, notes: normalize(notes), paymentMethod: paymentMethod === "تحويل" ? "تحويل" : "نقدي", balanceBefore: beforeBalance, balanceAfter: afterBalance, allocations, createdAt }; transaction.objectStore("customerPayments").add(payment); customers.put({ ...customer, balance: afterBalance, updatedAt: createdAt }); transaction.objectStore("customerTransactions").add({ id: uid("customer-transaction"), customerId, type: "PAYMENT", date, amount: paid, paidAmount: paid, remainingAmount: afterBalance, referenceType: "PAYMENT", referenceId: payment.id, note: normalize(notes), createdAt }); await transactionDone(transaction); return payment; },

  async completeSale({ items, discount, paidAmount, paymentMethod, paymentType = "نقدي", customerId = "", dueDate = "", deliveryFee = 0, deliveryChargeType = "store", cashierShiftId = "", cashierId = "", cashierName = "", sellerRole = "" }) {
    if (!items.length) throw new Error("أضف منتجًا واحدًا على الأقل إلى السلة.");
    const database = await this.open(); const delivery = roundMoney(Math.max(0, toNumber(deliveryFee))); const deliveryType = deliveryChargeType === "customer" ? "customer" : "store"; const needsCustomer = paymentType === "آجل"; const transaction = database.transaction(["settings", "products", "productBatches", "sales", "saleItems", "stockMovements", "meta", "customers", "customerTransactions", "expenses"], "readwrite"); const settings = await requestAsPromise(transaction.objectStore("settings").get("app")); const pharmacyMode = settings?.businessType === "صيدلية"; const products = transaction.objectStore("products"); const batches = transaction.objectStore("productBatches"); const resolved = []; const today = dateKey(); const allowNegativeSales = Boolean(settings?.allowNegativeSales);
    for (const line of items) { const product = await requestAsPromise(products.get(line.productId)); if (!product || product.isDeleted) throw new Error("أحد منتجات السلة لم يعد متاحًا."); if (!allowNegativeSales && !canSell(product.quantity, line.quantity)) throw new Error(`الكمية المتوفرة غير كافية للمنتج: ${product.name}`); const trackedBatches = (await requestAsPromise(batches.index("productId").getAll(product.id))).filter((batch) => toNumber(batch.remainingQuantity) > 0).sort((a, b) => pharmacyMode ? String(a.expiryDate || "9999-12-31").localeCompare(String(b.expiryDate || "9999-12-31")) : String(a.createdAt || "").localeCompare(String(b.createdAt || ""))); const availableBatches = pharmacyMode ? trackedBatches.filter((batch) => !batch.expiryDate || batch.expiryDate >= today) : trackedBatches; if (!allowNegativeSales && pharmacyMode && availableBatches.reduce((sum, batch) => sum + toNumber(batch.remainingQuantity), 0) + Math.max(0, toNumber(product.legacyQuantity)) < toNumber(line.quantity)) throw new Error(`لا توجد كميات صالحة كافية ضمن تشغيلات المنتج: ${product.name}`); const unitPrice = line.unitPrice === undefined || line.unitPrice === "" ? toNumber(product.salePrice) : Math.max(0, toNumber(line.unitPrice)); resolved.push({ line, product, availableBatches, unitPrice }); }
    const totals = calculateSaleTotals(resolved.map(({ line, product, unitPrice }) => ({ productId: product.id, unitPrice, quantity: line.quantity, discount: line.discount })), discount); const isCashierSeller = sellerRole === "cashier" || Boolean(cashierId); const cashierDiscountLimitPercent = normalizeCashierDiscountLimit(settings?.cashierDiscountLimitPercent, 10); const cashierDiscountCap = roundMoney(totals.subtotal * cashierDiscountLimitPercent / 100); if (isCashierSeller && totals.discount > cashierDiscountCap) throw new Error(`أقصى خصم للكاشير هو ${cashierDiscountLimitPercent}% من سعر البيع (${cashierDiscountCap}).`); const invoiceTotal = roundMoney(totals.total + (deliveryType === "customer" ? delivery : 0)); const isCredit = paymentType === "آجل"; const paid = isCredit ? 0 : Math.max(0, toNumber(paidAmount)); if (paid > invoiceTotal) throw new Error("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة."); if (!isCredit && paid < invoiceTotal) throw new Error("المبلغ المدفوع أقل من الإجمالي النهائي."); const customer = needsCustomer ? await requestAsPromise(transaction.objectStore("customers").get(customerId)) : null; if (needsCustomer && (!customerId || !customer || customer.isDeleted)) throw new Error("اختر عميلًا نشطًا للبيع الآجل."); const generalCreditLimit = normalizeCreditLimit(settings?.customerCreditLimit, 0); const customerCreditLimit = normalizeCreditLimit(customer?.creditLimit, generalCreditLimit); if (needsCustomer && customerCreditLimit > 0 && toNumber(customer.balance) + remainingAmount(invoiceTotal, paid) > customerCreditLimit) throw new Error(`تجاوز سقف مديونية العميل. المتاح له ${roundMoney(Math.max(0, customerCreditLimit - toNumber(customer.balance)))} فقط.`);
    const remaining = remainingAmount(invoiceTotal, paid); const status = paymentStatus(invoiceTotal, paid); const meta = transaction.objectStore("meta"); const sequence = ((await requestAsPromise(meta.get("invoiceSequence")))?.value || 0) + 1; const date = nowIso(); const sale = { id: uid("sale"), invoiceNumber: invoiceNumber(sequence), date, subtotal: totals.subtotal, discount: totals.discount, lineDiscount: totals.lineDiscount, generalDiscount: totals.generalDiscount, discountInput: discount || "", total: invoiceTotal, paidAmount: paid, initialPaidAmount: paid, remainingAmount: remaining, paymentStatus: status, paymentType: isCredit ? "آجل" : "نقدي", customerId: customer?.id || "", customerName: customer?.name || "", dueDate: normalize(dueDate), paymentMethod, deliveryFee: delivery, deliveryChargeType: delivery > 0 ? deliveryType : "", cashierShiftId: normalize(cashierShiftId), cashierId: normalize(cashierId), cashierName: normalize(cashierName) };
    transaction.objectStore("sales").add(sale);
    for (const { line, product, availableBatches, unitPrice } of resolved) { const calculatedLine = totals.lines.find((item) => item.productId === product.id) || totals.lines.find((item) => item.unitPrice === product.salePrice && item.quantity === line.quantity); const quantity = toNumber(line.quantity); const previousQuantity = toNumber(product.quantity); const newQuantity = previousQuantity - quantity; const fallbackUnitCost = toNumber(product.purchasePrice); const legacyQuantityBefore = Math.max(0, toNumber(product.legacyQuantity)); const legacyUnitCost = toNumber(product.legacyUnitCost ?? product.purchasePrice); const legacyAllocated = Math.min(quantity, legacyQuantityBefore); let unallocatedQuantity = quantity; let allocatedCost = 0; const unitCost = fallbackUnitCost; const soldAsPackage = Boolean(line.soldAsPackage && toNumber(line.unitsPerPackage) > 1); const unitsPerPackage = soldAsPackage ? Math.max(1, Math.floor(toNumber(line.unitsPerPackage))) : 1; const packageQuantity = soldAsPackage ? Math.max(1, roundMoney(quantity / unitsPerPackage)) : 0; let remainingToAllocate = roundMoney(quantity - legacyAllocated); const batchAllocations = []; availableBatches.forEach((batch) => { const allocated = Math.min(remainingToAllocate, toNumber(batch.remainingQuantity)); if (allocated <= 0) return; const remainingQuantity = roundMoney(toNumber(batch.remainingQuantity) - allocated); batches.put({ ...batch, remainingQuantity, updatedAt: date }); batchAllocations.push({ batchId: batch.id, batchNumber: batch.batchNumber, productionDate: batch.productionDate, expiryDate: batch.expiryDate, quantity: allocated, unitCost: toNumber(batch.unitCost) }); allocatedCost = roundMoney(allocatedCost + allocated * toNumber(batch.unitCost)); remainingToAllocate = roundMoney(remainingToAllocate - allocated); }); unallocatedQuantity = remainingToAllocate; const newCostAllocated = Math.max(0, unallocatedQuantity); const costTotal = roundMoney(allocatedCost + legacyAllocated * legacyUnitCost + newCostAllocated * fallbackUnitCost); const nextExpiry = availableBatches.filter((batch) => toNumber(batch.remainingQuantity) - (batchAllocations.find((item) => item.batchId === batch.id)?.quantity || 0) > 0).map((batch) => batch.expiryDate).filter(Boolean).sort()[0] || ""; products.put({ ...product, quantity: newQuantity, nearestExpiryDate: nextExpiry || (availableBatches.length ? "" : product.nearestExpiryDate || ""), legacyQuantity: Math.max(0, legacyQuantityBefore - legacyAllocated), updatedAt: date }); transaction.objectStore("saleItems").add({ id: uid("sale-item"), saleId: sale.id, productId: product.id, productName: product.name, unit: product.unit, quantity, unitPrice, unitCost, discount: calculatedLine?.discount || 0, discountInput: line.discount || "", total: calculatedLine?.total ?? roundMoney(product.salePrice * quantity), costTotal, soldAsPackage, packageUnit: soldAsPackage ? normalize(line.packageUnit || product.purchasePackageUnit || "كرتون") : "", packageQuantity, unitsPerPackage, batchAllocations, returnedQuantity: 0 }); createStockMovement(transaction.objectStore("stockMovements"), { productId: product.id, type: "SALE", quantity: -quantity, previousQuantity, newQuantity, date, note: `بيع ضمن الفاتورة ${sale.invoiceNumber}`, referenceType: "SALE", referenceId: sale.id }); }
    if (needsCustomer) { const balanceAfter = roundMoney(toNumber(customer.balance) + remaining); transaction.objectStore("customerTransactions").add({ id: uid("customer-transaction"), customerId: customer.id, type: "CREDIT_SALE", date, amount: invoiceTotal, paidAmount: paid, remainingAmount: balanceAfter, referenceType: "SALE", referenceId: sale.id, invoiceNumber: sale.invoiceNumber, note: isCredit && sale.dueDate ? `بيع آجل (استحقاق ${sale.dueDate})` : "بيع آجل", createdAt: date }); transaction.objectStore("customers").put({ ...customer, balance: balanceAfter, updatedAt: date }); } if (deliveryType === "store" && delivery > 0) transaction.objectStore("expenses").add({ id: uid("expense"), amount: delivery, periodType: "daily", category: "توصيل", description: `توصيل للفاتورة ${sale.invoiceNumber}`, date: dateKey(date), notes: "على حساب المحل", referenceType: "SALE", referenceId: sale.id, createdAt: date, updatedAt: date });
    meta.put({ id: "invoiceSequence", value: sequence, updatedAt: date }); await transactionDone(transaction);
    void this.logActivity({ type: "مبيعات", details: `فاتورة مبيعات ${sale.invoiceNumber} بقيمة ${sale.total} (${sale.paymentType}${isCredit && sale.dueDate ? ` · استحقاق ${sale.dueDate}` : ""})`, accountId: cashierId, accountName: cashierName || "الأدمن", entityId: sale.id });
    return sale;
  },
  async listSales() { const database = await this.open(); const sales = await requestAsPromise(database.transaction("sales", "readonly").objectStore("sales").getAll()); return sales.sort((a, b) => new Date(b.date) - new Date(a.date)); },
  async listSaleItems() { const database = await this.open(); return requestAsPromise(database.transaction("saleItems", "readonly").objectStore("saleItems").getAll()); },
  async getInvoice(saleId) { const database = await this.open(); const transaction = database.transaction(["sales", "saleItems", "saleReturns"], "readonly"); const sale = await requestAsPromise(transaction.objectStore("sales").get(saleId)); const items = await requestAsPromise(transaction.objectStore("saleItems").index("saleId").getAll(saleId)); const returns = await requestAsPromise(transaction.objectStore("saleReturns").index("saleId").getAll(saleId)); return sale ? { ...sale, items, returns } : null; },

  async createPurchase({ supplierId = "", items, notes = "", paymentType = "نقدي", paidAmount = "", paymentMethod = "نقدي" }) {
    if (!items.length) throw new Error("أضف منتجًا واحدًا على الأقل إلى فاتورة الشراء.");
    const database = await this.open(); const transaction = database.transaction(["settings", "suppliers", "supplierTransactions", "products", "purchases", "purchaseItems", "productBatches", "stockMovements", "meta"], "readwrite"); const settings = await requestAsPromise(transaction.objectStore("settings").get("app")); const pharmacyMode = settings?.businessType === "صيدلية"; const resolvedSupplierId = normalize(supplierId); const supplier = resolvedSupplierId ? await requestAsPromise(transaction.objectStore("suppliers").get(resolvedSupplierId)) : null; if (resolvedSupplierId && (!supplier || supplier.isDeleted)) throw new Error("المورد غير متاح."); const products = transaction.objectStore("products"); const batches = transaction.objectStore("productBatches"); const resolved = [];
    for (const line of items) {
      const product = await requestAsPromise(products.get(line.productId));
      if (!product || product.isDeleted) throw new Error("أحد المنتجات غير متاح.");
      const packageQuantity = line.packageQuantity === undefined ? toNumber(line.quantity) : toNumber(line.packageQuantity);
      const unitsPerPackage = line.unitsPerPackage === undefined ? 1 : toNumber(line.unitsPerPackage);
      const packageCost = line.packageCost === undefined ? toNumber(line.unitCost) : toNumber(line.packageCost);
      const packaging = calculatePackagePurchase({ packageQuantity, unitsPerPackage, packageCost });
      if (packaging.packageQuantity <= 0 || packaging.unitsPerPackage <= 0 || packaging.packageCost < 0) throw new Error("أدخل عدد العبوات والحبات وسعر العبوة بصورة صحيحة.");
      const batchNumber = normalize(line.batchNumber); const productionDate = normalize(line.productionDate); const expiryDate = normalize(line.expiryDate);
      if (pharmacyMode && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) throw new Error(`أدخل تاريخ انتهاء صالحًا للمنتج: ${product.name}`);
      if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) throw new Error(`أدخل تاريخ انتهاء صالحًا للمنتج: ${product.name}`);
      if (productionDate && !/^\d{4}-\d{2}-\d{2}$/.test(productionDate)) throw new Error(`أدخل تاريخ إنتاج صالحًا للمنتج: ${product.name}`);
      if (productionDate && expiryDate && productionDate > expiryDate) throw new Error(`تاريخ الإنتاج يجب أن يسبق تاريخ الانتهاء للمنتج: ${product.name}`);
      if (expiryDate && expiryDate <= dateKey()) throw new Error(`لا يمكن حفظ منتج منتهٍ أو ينتهي اليوم: ${product.name}`);
      const salePrice = line.salePrice === undefined || line.salePrice === "" ? toNumber(product.salePrice) : Math.max(0, toNumber(line.salePrice));
      resolved.push({ product, ...packaging, packageUnit: normalize(line.packageUnit || product.purchasePackageUnit || "حبة") || "حبة", salePrice, batchNumber, productionDate, expiryDate });
    }
    const total = calculatePurchaseTotals(resolved); const requestedCredit = paymentType === "آجل"; const paid = roundMoney(paidAmount === "" ? (requestedCredit ? 0 : total) : toNumber(paidAmount)); if (paid < 0 || paid > total) throw new Error("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي فاتورة الشراء."); const remaining = remainingAmount(total, paid); const isCredit = requestedCredit || remaining > 0; if (isCredit && !supplier) throw new Error("اختر موردًا نشطًا عند وجود مبلغ متبقي."); const status = paymentStatus(total, paid); const meta = transaction.objectStore("meta"); const sequence = ((await requestAsPromise(meta.get("purchaseSequence")))?.value || 0) + 1; const date = nowIso(); const purchase = { id: uid("purchase"), invoiceNumber: purchaseNumber(sequence), supplierId: supplier?.id || "", supplierName: supplier?.name || "بدون مورد", date, notes: normalize(notes), total, paymentType: isCredit ? "آجل" : "نقدي", paymentMethod, paidAmount: paid, initialPaidAmount: paid, remainingAmount: remaining, paymentStatus: status, returnedTotal: 0 };
    transaction.objectStore("purchases").add(purchase);
    for (const { product, quantity, unitCost, total: itemTotal, packageQuantity, unitsPerPackage, packageCost, packageUnit, salePrice, batchNumber, productionDate, expiryDate } of resolved) {
      const previousQuantity = toNumber(product.quantity); const newQuantity = previousQuantity + quantity;
      const nearestExpiryDate = expiryDate && (!product.nearestExpiryDate || expiryDate < product.nearestExpiryDate) ? expiryDate : product.nearestExpiryDate || "";
      products.put({ ...product, quantity: newQuantity, purchasePrice: unitCost, salePrice, purchasePackageUnit: packageUnit, unitsPerPackage, lastPackageCost: packageCost, lastSupplierId: supplier?.id || product.lastSupplierId || "", lastSupplierPurchaseId: supplier ? purchase.id : product.lastSupplierPurchaseId || "", nearestProductionDate: productionDate || product.nearestProductionDate || "", lastSupplierAt: supplier ? date : product.lastSupplierAt || "", latestBatchNumber: batchNumber || product.latestBatchNumber || "", nearestExpiryDate, updatedAt: date });
      const batchId = uid("batch");
      transaction.objectStore("purchaseItems").add({ id: uid("purchase-item"), purchaseId: purchase.id, productId: product.id, productName: product.name, unit: product.unit, quantity, unitCost, total: itemTotal, packageUnit, packageQuantity, unitsPerPackage, packageCost, salePrice, batchNumber, productionDate, expiryDate, batchId, returnedQuantity: 0 });
      batches.add({ id: batchId, productId: product.id, productName: product.name, purchaseId: purchase.id, batchNumber, productionDate, expiryDate, quantity, remainingQuantity: quantity, unitCost, createdAt: date, updatedAt: date });
      createStockMovement(transaction.objectStore("stockMovements"), { productId: product.id, type: "PURCHASE", quantity, previousQuantity, newQuantity, date, note: `شراء ${packageQuantity} ${packageUnit} ضمن الفاتورة ${purchase.invoiceNumber}`, referenceType: "PURCHASE", referenceId: purchase.id });
    }
    if (supplier) { const balanceAfter = roundMoney(toNumber(supplier.balance) + remaining); transaction.objectStore("suppliers").put({ ...supplier, balance: balanceAfter, updatedAt: date }); transaction.objectStore("supplierTransactions").add({ id: uid("supplier-transaction"), supplierId: supplier.id, type: "PURCHASE", date, amount: total, paidAmount: paid, remainingAmount: balanceAfter, referenceType: "PURCHASE", referenceId: purchase.id, invoiceNumber: purchase.invoiceNumber, note: isCredit ? "شراء آجل" : "شراء نقدي", createdAt: date }); }
    meta.put({ id: "purchaseSequence", value: sequence, updatedAt: date }); await transactionDone(transaction); return purchase;
  },
  async listPurchases() { const database = await this.open(); const purchases = await requestAsPromise(database.transaction("purchases", "readonly").objectStore("purchases").getAll()); return purchases.sort((a, b) => new Date(b.date) - new Date(a.date)); },
  async listPurchaseItems() { const database = await this.open(); return requestAsPromise(database.transaction("purchaseItems", "readonly").objectStore("purchaseItems").getAll()); },
  async getPurchase(purchaseId) { const database = await this.open(); const transaction = database.transaction(["purchases", "purchaseItems", "purchaseReturns"], "readonly"); const purchase = await requestAsPromise(transaction.objectStore("purchases").get(purchaseId)); const items = await requestAsPromise(transaction.objectStore("purchaseItems").index("purchaseId").getAll(purchaseId)); const returns = await requestAsPromise(transaction.objectStore("purchaseReturns").index("purchaseId").getAll(purchaseId)); return purchase ? { ...purchase, items, returns } : null; },
  async createPurchaseReturn({ purchaseId, items, notes = "" }) {
    const selected = items.filter((item) => toNumber(item.quantity) > 0); if (!selected.length) throw new Error("حدد كمية مرتجعة واحدة على الأقل."); const database = await this.open(); const transaction = database.transaction(["purchases", "purchaseItems", "purchaseReturns", "purchaseReturnItems", "products", "productBatches", "stockMovements", "meta", "suppliers", "supplierTransactions"], "readwrite"); const purchase = await requestAsPromise(transaction.objectStore("purchases").get(purchaseId)); if (!purchase) throw new Error("فاتورة الشراء غير موجودة."); const purchaseItems = transaction.objectStore("purchaseItems"); const products = transaction.objectStore("products"); const batches = transaction.objectStore("productBatches"); const resolved = [];
    for (const line of selected) { const purchaseItem = await requestAsPromise(purchaseItems.get(line.purchaseItemId)); const product = purchaseItem && await requestAsPromise(products.get(purchaseItem.productId)); const batch = purchaseItem?.batchId ? await requestAsPromise(batches.get(purchaseItem.batchId)) : null; if (!purchaseItem || !product || !canReturn(purchaseItem.quantity, purchaseItem.returnedQuantity, line.quantity)) throw new Error("كمية مرتجع الشراء تتجاوز المسموح."); if (toNumber(line.quantity) > toNumber(product.quantity)) throw new Error(`لا يمكن إرجاع كمية أكبر من المخزون الحالي للمنتج: ${product.name}`); if (purchaseItem.batchId && (!batch || toNumber(line.quantity) > toNumber(batch.remainingQuantity))) throw new Error(`لا يمكن إرجاع كمية تجاوزت المتبقي في تشغيلة المنتج: ${product.name}`); resolved.push({ purchaseItem, product, batch, quantity: toNumber(line.quantity) }); }
    const meta = transaction.objectStore("meta"); const sequence = ((await requestAsPromise(meta.get("purchaseReturnSequence")))?.value || 0) + 1; const date = nowIso(); const total = roundMoney(resolved.reduce((sum, item) => sum + itemReturnTotal(item.purchaseItem, item.quantity), 0)); const returned = { id: uid("purchase-return"), returnNumber: purchaseReturnNumber(sequence), purchaseId, date, notes: normalize(notes), total };
    transaction.objectStore("purchaseReturns").add(returned);
    for (const { purchaseItem, product, batch, quantity } of resolved) { const previousQuantity = toNumber(product.quantity); const newQuantity = previousQuantity - quantity; if (batch) batches.put({ ...batch, remainingQuantity: roundMoney(toNumber(batch.remainingQuantity) - quantity), updatedAt: date }); const remainingBatches = batch ? (await requestAsPromise(batches.index("productId").getAll(product.id))).map((item) => item.id === batch.id ? { ...item, remainingQuantity: roundMoney(toNumber(item.remainingQuantity) - quantity) } : item) : []; const nearestExpiryDate = batch ? remainingBatches.filter((item) => toNumber(item.remainingQuantity) > 0).map((item) => item.expiryDate).filter(Boolean).sort()[0] || "" : product.nearestExpiryDate || ""; products.put({ ...product, quantity: newQuantity, nearestExpiryDate, updatedAt: date }); purchaseItems.put({ ...purchaseItem, returnedQuantity: toNumber(purchaseItem.returnedQuantity) + quantity }); transaction.objectStore("purchaseReturnItems").add({ id: uid("purchase-return-item"), purchaseReturnId: returned.id, purchaseItemId: purchaseItem.id, productId: product.id, productName: product.name, quantity, unitCost: purchaseItem.unitCost, total: itemReturnTotal(purchaseItem, quantity) }); createStockMovement(transaction.objectStore("stockMovements"), { productId: product.id, type: "PURCHASE_RETURN", quantity: -quantity, previousQuantity, newQuantity, date, note: `مرتجع شراء ${returned.returnNumber}`, referenceType: "PURCHASE_RETURN", referenceId: returned.id }); }
    const reduction = Math.min(total, toNumber(purchase.remainingAmount)); const remainingAmountAfterReturn = roundMoney(Math.max(0, toNumber(purchase.remainingAmount) - reduction)); transaction.objectStore("purchases").put({ ...purchase, returnedTotal: roundMoney(toNumber(purchase.returnedTotal) + total), remainingAmount: remainingAmountAfterReturn, paymentStatus: remainingAmountAfterReturn === 0 ? "مدفوعة" : purchase.paymentStatus }); if (purchase.supplierId) { const suppliers = transaction.objectStore("suppliers"); const supplier = await requestAsPromise(suppliers.get(purchase.supplierId)); if (supplier) { const balanceAfter = roundMoney(Math.max(0, toNumber(supplier.balance) - reduction)); suppliers.put({ ...supplier, balance: balanceAfter, updatedAt: date }); transaction.objectStore("supplierTransactions").add({ id: uid("supplier-transaction"), supplierId: supplier.id, type: "PURCHASE_RETURN", date, amount: -total, paidAmount: 0, remainingAmount: balanceAfter, referenceType: "PURCHASE_RETURN", referenceId: returned.id, invoiceNumber: purchase.invoiceNumber, note: normalize(notes), createdAt: date }); } } meta.put({ id: "purchaseReturnSequence", value: sequence, updatedAt: date }); await transactionDone(transaction); return returned;
  },
  async createSaleReturn({ saleId, items, notes = "" }) {
    const selected = items.filter((item) => toNumber(item.quantity) > 0); if (!selected.length) throw new Error("حدد كمية مرتجعة واحدة على الأقل."); const database = await this.open(); const transaction = database.transaction(["sales", "saleItems", "saleReturns", "saleReturnItems", "products", "productBatches", "stockMovements", "meta", "customers", "customerTransactions"], "readwrite"); const sale = await requestAsPromise(transaction.objectStore("sales").get(saleId)); if (!sale) throw new Error("فاتورة البيع غير موجودة."); const saleItems = transaction.objectStore("saleItems"); const products = transaction.objectStore("products"); const batches = transaction.objectStore("productBatches"); const resolved = [];
    for (const line of selected) { const saleItem = await requestAsPromise(saleItems.get(line.saleItemId)); const product = saleItem && await requestAsPromise(products.get(saleItem.productId)); if (!saleItem || !product || !canReturn(saleItem.quantity, saleItem.returnedQuantity, line.quantity)) throw new Error("كمية مرتجع البيع تتجاوز الكمية المباعة."); let alreadyReturned = toNumber(saleItem.returnedQuantity); let quantityToRestore = toNumber(line.quantity); const batchAllocations = []; for (const allocation of saleItem.batchAllocations || []) { const available = Math.max(0, toNumber(allocation.quantity) - Math.min(alreadyReturned, toNumber(allocation.quantity))); alreadyReturned = Math.max(0, alreadyReturned - toNumber(allocation.quantity)); const restoredQuantity = Math.min(quantityToRestore, available); if (restoredQuantity > 0) { const batch = await requestAsPromise(batches.get(allocation.batchId)); if (!batch) throw new Error(`تعذر العثور على تشغيلة مرتجع المنتج: ${product.name}`); batchAllocations.push({ ...allocation, quantity: restoredQuantity }); quantityToRestore = roundMoney(quantityToRestore - restoredQuantity); } } if (quantityToRestore > 0 && (saleItem.batchAllocations || []).length) throw new Error(`تعذر إعادة كامل كمية المرتجع إلى تشغيلات المنتج: ${product.name}`); resolved.push({ saleItem, product, batchAllocations, quantity: toNumber(line.quantity) }); }
    const meta = transaction.objectStore("meta"); const sequence = ((await requestAsPromise(meta.get("saleReturnSequence")))?.value || 0) + 1; const date = nowIso(); const total = roundMoney(resolved.reduce((sum, item) => sum + itemReturnTotal(item.saleItem, item.quantity), 0)); const returned = { id: uid("sale-return"), returnNumber: saleReturnNumber(sequence), saleId, date, notes: normalize(notes), total };
    transaction.objectStore("saleReturns").add(returned);
    for (const { saleItem, product, batchAllocations, quantity } of resolved) { const previousQuantity = toNumber(product.quantity); const newQuantity = previousQuantity + quantity; for (const allocation of batchAllocations) { const batch = await requestAsPromise(batches.get(allocation.batchId)); batches.put({ ...batch, remainingQuantity: roundMoney(toNumber(batch.remainingQuantity) + toNumber(allocation.quantity)), updatedAt: date }); } const remainingBatches = batchAllocations.length ? await requestAsPromise(batches.index("productId").getAll(product.id)) : []; const nearestExpiryDate = remainingBatches.filter((item) => toNumber(item.remainingQuantity) > 0).map((item) => item.expiryDate).filter(Boolean).sort()[0] || product.nearestExpiryDate || ""; products.put({ ...product, quantity: newQuantity, nearestExpiryDate, updatedAt: date }); saleItems.put({ ...saleItem, returnedQuantity: toNumber(saleItem.returnedQuantity) + quantity }); transaction.objectStore("saleReturnItems").add({ id: uid("sale-return-item"), saleReturnId: returned.id, saleItemId: saleItem.id, productId: product.id, productName: saleItem.productName, quantity, unitPrice: saleItem.unitPrice, unitCost: saleItem.unitCost, total: itemReturnTotal(saleItem, quantity), costTotal: roundMoney(toNumber(saleItem.unitCost) * quantity), batchAllocations }); createStockMovement(transaction.objectStore("stockMovements"), { productId: product.id, type: "SALE_RETURN", quantity, previousQuantity, newQuantity, date, note: `مرتجع بيع ${returned.returnNumber}`, referenceType: "SALE_RETURN", referenceId: returned.id }); }
    if (sale.customerId) { const customers = transaction.objectStore("customers"); const customer = await requestAsPromise(customers.get(sale.customerId)); if (customer) { const reduction = Math.min(total, toNumber(sale.remainingAmount)); const nextRemaining = roundMoney(Math.max(0, toNumber(sale.remainingAmount) - reduction)); const nextBalance = roundMoney(Math.max(0, toNumber(customer.balance) - reduction)); transaction.objectStore("sales").put({ ...sale, returnedTotal: roundMoney(toNumber(sale.returnedTotal) + total), remainingAmount: nextRemaining, paymentStatus: nextRemaining === 0 ? "مدفوعة" : sale.paymentStatus }); customers.put({ ...customer, balance: nextBalance, updatedAt: date }); transaction.objectStore("customerTransactions").add({ id: uid("customer-transaction"), customerId: customer.id, type: "SALE_RETURN", date, amount: -total, paidAmount: 0, remainingAmount: nextBalance, referenceType: "SALE_RETURN", referenceId: returned.id, invoiceNumber: sale.invoiceNumber, note: normalize(notes), createdAt: date }); } }
    meta.put({ id: "saleReturnSequence", value: sequence, updatedAt: date }); await transactionDone(transaction); return returned;
  },

  async recordStockCount({ productId, actualQuantity, notes = "" }) { const database = await this.open(); const transaction = database.transaction(["products", "stockMovements", "stockCounts"], "readwrite"); const products = transaction.objectStore("products"); const product = await requestAsPromise(products.get(productId)); if (!product || product.isDeleted) throw new Error("المنتج غير متاح للجرد."); const previousQuantity = toNumber(product.quantity); const newQuantity = toNumber(actualQuantity); if (newQuantity < 0) throw new Error("الكمية الفعلية لا يمكن أن تكون سالبة."); const date = nowIso(); const count = { id: uid("stock-count"), productId, productName: product.name, previousQuantity, actualQuantity: newQuantity, difference: adjustmentDelta(previousQuantity, newQuantity), date, notes: normalize(notes) }; products.put({ ...product, quantity: newQuantity, updatedAt: date }); transaction.objectStore("stockCounts").add(count); createStockMovement(transaction.objectStore("stockMovements"), { productId, type: "COUNT", quantity: count.difference, previousQuantity, newQuantity, date, note: normalize(notes) || "تسوية جرد", referenceType: "STOCK_COUNT", referenceId: count.id }); await transactionDone(transaction); return count; },
  async listStockCounts({ productId = "" } = {}) { const database = await this.open(); const store = database.transaction("stockCounts", "readonly").objectStore("stockCounts"); const items = productId ? await requestAsPromise(store.index("productId").getAll(productId)) : await requestAsPromise(store.getAll()); return items.sort((a, b) => new Date(b.date) - new Date(a.date)); },

  async getPeriodicInventorySummary({ from = "", to = "" } = {}) {
    const periodFrom = normalize(from); const periodTo = normalize(to); const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!validDate(periodFrom) || !validDate(periodTo) || periodFrom > periodTo) throw new Error("حدد بداية ونهاية صحيحتين لفترة الجرد.");
    const database = await this.open();
    const names = ["products", "customers", "suppliers", "sales", "customerPayments", "cashMovements"];
    const transaction = database.transaction(names, "readonly");
    const [products, customers, suppliers, sales, customerPayments, cashMovements] = await Promise.all(names.map((name) => requestAsPromise(transaction.objectStore(name).getAll())));
    await transactionDone(transaction);
    const [analytics, cashbox, vault] = await Promise.all([this.getAnalytics({ from: periodFrom, to: periodTo }), this.getCashbox(), this.getVault()]);
    const activeProducts = products.filter((product) => !product.isDeleted);
    const batchDatabase = await this.open(); const batchItems = await requestAsPromise(batchDatabase.transaction("productBatches", "readonly").objectStore("productBatches").getAll());
    const inventoryCost = calculateInventoryCost(activeProducts, batchItems);
    const inventoryUnits = roundMoney(activeProducts.reduce((sum, product) => sum + toNumber(product.quantity), 0));
    const customerDebt = roundMoney(customers.filter((customer) => !customer.isDeleted).reduce((sum, customer) => sum + Math.max(0, toNumber(customer.balance)), 0));
    const supplierPayables = roundMoney(suppliers.filter((supplier) => !supplier.isDeleted).reduce((sum, supplier) => sum + Math.max(0, toNumber(supplier.balance)), 0));
    const depositedByTransfer = new Map();
    cashMovements.filter((movement) => movement.sourceType === "TRANSFER_TO_VAULT").forEach((movement) => {
      const key = `${movement.transferSourceType}:${movement.transferSourceId}`;
      depositedByTransfer.set(key, roundMoney((depositedByTransfer.get(key) || 0) + toNumber(movement.amount)));
    });
    const transferSources = [
      ...sales.filter((sale) => sale.paymentMethod === "تحويل" && toNumber(sale.initialPaidAmount ?? sale.paidAmount) > 0).map((sale) => ({ key: `SALE_TRANSFER:${sale.id}`, amount: toNumber(sale.initialPaidAmount ?? sale.paidAmount) })),
      ...customerPayments.filter((payment) => payment.paymentMethod === "تحويل" && toNumber(payment.amount) > 0).map((payment) => ({ key: `CUSTOMER_PAYMENT_TRANSFER:${payment.id}`, amount: toNumber(payment.amount) })),
    ];
    const incomingTransfersNotDeposited = roundMoney(transferSources.reduce((sum, source) => sum + Math.max(0, source.amount - toNumber(depositedByTransfer.get(source.key))), 0));
    const damage = { amount: 0, count: 0, status: "not-recorded", source: "لا يوجد في التطبيق سجل مستقل للتالف؛ لا يحوّل جرد الكميات أو التعديلات العادية إلى تالف تلقائيًا." };
    const netPosition = roundMoney(inventoryCost + toNumber(vault.vaultBalance) + toNumber(vault.cashierCashHeld) + customerDebt + incomingTransfersNotDeposited - supplierPayables);
    return {
      sourceVersion: 1,
      generatedAt: nowIso(),
      period: { from: periodFrom, to: periodTo },
      inventory: { productCount: activeProducts.length, units: inventoryUnits, cost: inventoryCost },
      cash: { vaultBalance: roundMoney(vault.vaultBalance), cashierCashHeld: roundMoney(vault.cashierCashHeld), totalRegisteredCash: roundMoney(cashbox.closingBalance), untransferredShiftCount: toNumber(vault.untransferredShiftCount) },
      receivables: { customerDebt },
      payables: { supplierPayables },
      transfers: { incomingNotDeposited: incomingTransfersNotDeposited },
      performance: { sales: analytics.sales.total, netSales: analytics.profit.netSales, costOfGoods: analytics.profit.netCostOfGoods, grossProfit: analytics.profit.grossProfit, expenses: analytics.expenses.total, netProfit: analytics.profit.netProfit, salesReturns: analytics.sales.returns, purchaseReturns: analytics.purchases.returns, purchaseNet: analytics.purchases.net },
      damage,
      netPosition,
    };
  },
  async createPeriodicInventory({ cycle, from, to, notes = "", approvedByAccountId = "", approvedByName = "" } = {}) {
    const normalizedCycle = ["monthly", "semiannual", "annual"].includes(cycle) ? cycle : "";
    if (!normalizedCycle) throw new Error("نوع دورة الجرد غير صالح.");
    const summary = await this.getPeriodicInventorySummary({ from, to });
    const database = await this.open(); const transaction = database.transaction("periodicInventories", "readwrite"); const store = transaction.objectStore("periodicInventories");
    const existing = await requestAsPromise(store.getAll());
    const previous = existing.filter((item) => item.cycle === normalizedCycle).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
    const comparison = previous?.metrics ? {
      previousAuditId: previous.id,
      previousCreatedAt: previous.createdAt,
      inventoryCostDelta: roundMoney(summary.inventory.cost - toNumber(previous.metrics.inventory?.cost)),
      vaultBalanceDelta: roundMoney(summary.cash.vaultBalance - toNumber(previous.metrics.cash?.vaultBalance)),
      customerDebtDelta: roundMoney(summary.receivables.customerDebt - toNumber(previous.metrics.receivables?.customerDebt)),
      supplierPayablesDelta: roundMoney(summary.payables.supplierPayables - toNumber(previous.metrics.payables?.supplierPayables)),
      netProfitDelta: roundMoney(summary.performance.netProfit - toNumber(previous.metrics.performance?.netProfit)),
      netPositionDelta: roundMoney(summary.netPosition - toNumber(previous.metrics.netPosition)),
    } : null;
    const createdAt = nowIso(); const audit = { id: uid("periodic-inventory"), cycle: normalizedCycle, periodFrom: summary.period.from, periodTo: summary.period.to, notes: normalize(notes).slice(0, 240), approvedByAccountId: normalize(approvedByAccountId), approvedByName: normalize(approvedByName), createdAt, metrics: summary, comparison };
    store.add(audit); await transactionDone(transaction); return audit;
  },
  async listPeriodicInventories() { const database = await this.open(); const items = await requestAsPromise(database.transaction("periodicInventories", "readonly").objectStore("periodicInventories").getAll()); return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); },

  async listCashMovements({ from = "", to = "" } = {}) { const database = await this.open(); const items = await requestAsPromise(database.transaction("cashMovements", "readonly").objectStore("cashMovements").getAll()); return items.filter((item) => isWithinDateRange(item.date, from, to)).sort((a, b) => new Date(b.date) - new Date(a.date)); },
  async listTransferVaultDeposits() { const database = await this.open(); const items = await requestAsPromise(database.transaction("cashMovements", "readonly").objectStore("cashMovements").getAll()); return items.filter((item) => item.sourceType === "TRANSFER_TO_VAULT").sort((a, b) => new Date(b.date) - new Date(a.date)); },
  async createCashMovement({ type, amount, date = dateKey(), notes = "" }) { const movementType = normalize(type); if (!["DEPOSIT", "WITHDRAWAL"].includes(movementType)) throw new Error("نوع حركة الصندوق غير صالح."); const value = roundMoney(toNumber(amount)); if (value <= 0) throw new Error("أدخل مبلغًا أكبر من صفر."); const database = await this.open(); const transaction = database.transaction("cashMovements", "readwrite"); const movement = { id: uid("cash-movement"), type: movementType, amount: value, date, notes: normalize(notes), createdAt: nowIso() }; transaction.objectStore("cashMovements").add(movement); await transactionDone(transaction); return movement; },
  async depositIncomingTransferToVault({ sourceType, sourceId, amount, date = dateKey(), notes = "" } = {}) {
    const normalizedType = normalize(sourceType); const normalizedId = normalize(sourceId); const value = roundMoney(toNumber(amount));
    if (!normalizedId || !["SALE_TRANSFER", "CUSTOMER_PAYMENT_TRANSFER"].includes(normalizedType)) throw new Error("مصدر التحويل غير صالح للتوريد.");
    if (value <= 0) throw new Error("أدخل مبلغ توريد أكبر من صفر.");
    const database = await this.open(); const transaction = database.transaction(["sales", "customerPayments", "cashMovements"], "readwrite");
    const source = await requestAsPromise(transaction.objectStore(normalizedType === "SALE_TRANSFER" ? "sales" : "customerPayments").get(normalizedId));
    const sourceAmount = normalizedType === "SALE_TRANSFER" ? toNumber(source?.initialPaidAmount ?? source?.paidAmount) : toNumber(source?.amount);
    if (!source || source.paymentMethod !== "تحويل" || sourceAmount <= 0) throw new Error("التحويل الوارد غير متاح للتوريد.");
    const movements = await requestAsPromise(transaction.objectStore("cashMovements").getAll()); const deposited = roundMoney(movements.filter((movement) => movement.sourceType === "TRANSFER_TO_VAULT" && movement.transferSourceType === normalizedType && movement.transferSourceId === normalizedId).reduce((sum, movement) => sum + toNumber(movement.amount), 0)); const remaining = roundMoney(sourceAmount - deposited);
    if (value > remaining) throw new Error(`مبلغ التوريد أكبر من المتبقي من هذا التحويل (${remaining}).`);
    const now = nowIso(); const label = normalizedType === "SALE_TRANSFER" ? `تحصيل تحويل فاتورة ${source.invoiceNumber || "بيع"}` : `تحويل دفعة عميل ${source.customerName || ""}`.trim(); const movement = { id: uid("cash-movement"), type: "DEPOSIT", sourceType: "TRANSFER_TO_VAULT", amount: value, date: date || dateKey(now), notes: normalize(notes || `توريد من ${label}`), transferSourceType: normalizedType, transferSourceId: normalizedId, transferSourceAmount: sourceAmount, transferSourceLabel: label, createdAt: now };
    transaction.objectStore("cashMovements").add(movement); await transactionDone(transaction); return { ...movement, depositedBefore: deposited, remainingAfter: roundMoney(remaining - value) };
  },
  async getActiveCashierShift(accountId) { const database = await this.open(); const shifts = await requestAsPromise(database.transaction("cashierShifts", "readonly").objectStore("cashierShifts").index("accountId").getAll(accountId)); return shifts.filter((shift) => shift.status === "OPEN").sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0] || null; },
  async startCashierShift({ accountId, accountName, receivedCash }) {
    const received = roundMoney(toNumber(receivedCash)); if (received < 0) throw new Error("المبلغ المستلم لا يمكن أن يكون سالبًا.");
    const database = await this.open(); const transaction = database.transaction(["accounts", "cashierShifts"], "readwrite"); const accounts = transaction.objectStore("accounts"); const shifts = transaction.objectStore("cashierShifts"); const account = await requestAsPromise(accounts.get(accountId));
    if (!account || !account.isActive || account.role !== "cashier") throw new Error("وردية الصندوق متاحة لحساب كاشير نشط فقط.");
    const all = await requestAsPromise(shifts.getAll()); const existing = all.filter((shift) => shift.accountId === accountId && shift.status === "OPEN").sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0]; if (existing) { await transactionDone(transaction); return existing; }
    const startedAt = nowIso(); const shift = { id: uid("cashier-shift"), accountId, accountName: normalize(accountName || account.name), date: dateKey(startedAt), startedAt, status: "OPEN", receivedCash: received, expectedCash: received, countedCash: null, difference: null, cashSales: 0, closedAt: "", receivedFromShiftId: "" };
    const previous = all.filter((item) => item.status === "CLOSED" && !item.receivedByShiftId && !item.vaultTransferredAt && item.date === shift.date).sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt))[0]; if (previous) { shifts.put({ ...previous, receivedByShiftId: shift.id, receivedByAccountId: accountId, receivedAt: startedAt }); shift.receivedFromShiftId = previous.id; }
    shifts.add(shift); await transactionDone(transaction); return shift;
  },
  async closeCashierShift({ shiftId, countedCash }) {
    const counted = roundMoney(toNumber(countedCash)); if (counted < 0) throw new Error("مبلغ جرد الصندوق لا يمكن أن يكون سالبًا.");
    const database = await this.open(); const transaction = database.transaction(["cashierShifts", "sales"], "readwrite"); const shifts = transaction.objectStore("cashierShifts"); const shift = await requestAsPromise(shifts.get(shiftId)); if (!shift || shift.status !== "OPEN") throw new Error("لا توجد وردية صندوق مفتوحة لإغلاقها.");
    const sales = await requestAsPromise(transaction.objectStore("sales").getAll()); const cashSales = roundMoney(sales.filter((sale) => sale.cashierShiftId === shift.id && (!sale.paymentMethod || sale.paymentMethod === "نقدي")).reduce((sum, sale) => sum + toNumber(sale.initialPaidAmount ?? sale.paidAmount), 0)); const expectedCash = roundMoney(toNumber(shift.receivedCash) + cashSales); const closedAt = nowIso(); const closed = { ...shift, status: "CLOSED", cashSales, expectedCash, countedCash: counted, difference: roundMoney(counted - expectedCash), closedAt };
    shifts.put(closed); await transactionDone(transaction); return closed;
  },
  async listCashierShifts({ date = dateKey() } = {}) { const database = await this.open(); const shifts = await requestAsPromise(database.transaction("cashierShifts", "readonly").objectStore("cashierShifts").getAll()); return shifts.filter((shift) => !date || shift.date === date).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)); },
  async transferCashierShiftToVault({ shiftId, transferredByAccountId = "" } = {}) {
    const database = await this.open(); const transaction = database.transaction(["cashierShifts", "cashMovements"], "readwrite"); const shifts = transaction.objectStore("cashierShifts"); const shift = await requestAsPromise(shifts.get(shiftId));
    if (!shift || shift.status !== "CLOSED" || shift.countedCash === null || shift.countedCash === undefined) throw new Error("أغلق وردية الكاشير وجردها قبل ترحيلها إلى الخزنة.");
    if (shift.vaultTransferredAt) throw new Error("تم ترحيل صندوق هذه الوردية إلى الخزنة مسبقًا.");
    const difference = roundMoney(toNumber(shift.difference)); const now = nowIso();
    // العجز يُسوّى في الخزنة مباشرة. أما الفائض فلا يُضاف إلى حساب الكاشير إلا بموافقة المدير.
    if (difference < 0) transaction.objectStore("cashMovements").add({ id: uid("cash-movement"), type: "WITHDRAWAL", sourceType: "CASHIER_SHORTAGE", amount: Math.abs(difference), date: dateKey(now), notes: `تسوية عجز وردية ${shift.accountName || "كاشير"}`, cashierShiftId: shift.id, cashierId: shift.accountId, cashierName: shift.accountName || "", createdAt: now });
    const hasSurplus = difference > 0;
    const updated = { ...shift, vaultTransferredAt: now, vaultTransferredAmount: roundMoney(toNumber(shift.countedCash)), vaultTransferredByAccountId: normalize(transferredByAccountId), cashDifferencePosted: !hasSurplus, surplusApprovalStatus: hasSurplus ? "PENDING" : "", surplusAmount: hasSurplus ? difference : 0, updatedAt: now };
    shifts.put(updated); await transactionDone(transaction); return updated;
  },
  async listPendingCashierSurpluses({ from = "", to = "" } = {}) {
    const database = await this.open(); const shifts = await requestAsPromise(database.transaction("cashierShifts", "readonly").objectStore("cashierShifts").getAll());
    return shifts
      .filter((shift) => shift.surplusApprovalStatus === "PENDING" && toNumber(shift.difference) > 0 && (!from || shift.date >= from) && (!to || shift.date <= to))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  },
  async resolveCashierSurplus({ shiftId, decision = "APPROVED", approvedByAccountId = "", notes = "" } = {}) {
    if (!["APPROVED", "REJECTED"].includes(decision)) throw new Error("قرار غير صالح لفائض الوردية.");
    const database = await this.open(); const transaction = database.transaction(["cashierShifts", "cashMovements"], "readwrite"); const shifts = transaction.objectStore("cashierShifts"); const shift = await requestAsPromise(shifts.get(shiftId));
    if (!shift) throw new Error("لم يتم العثور على وردية الكاشير.");
    if (shift.surplusApprovalStatus !== "PENDING") throw new Error("لا يوجد فائض بانتظار موافقة المدير في هذه الوردية.");
    const surplus = roundMoney(toNumber(shift.difference));
    if (surplus <= 0) throw new Error("لا يوجد فائض في هذه الوردية.");
    const now = nowIso();
    if (decision === "APPROVED") {
      transaction.objectStore("cashMovements").add({ id: uid("cash-movement"), type: "DEPOSIT", sourceType: "CASHIER_SURPLUS", amount: surplus, date: dateKey(now), notes: normalize(notes) || `فائض معتمد من المدير · وردية ${shift.accountName || "كاشير"}`, cashierShiftId: shift.id, cashierId: shift.accountId, cashierName: shift.accountName || "", createdAt: now });
    }
    const updated = { ...shift, surplusApprovalStatus: decision, surplusResolvedAt: now, surplusApprovedByAccountId: normalize(approvedByAccountId), surplusApprovalNotes: normalize(notes), cashDifferencePosted: decision === "APPROVED", updatedAt: now };
    shifts.put(updated); await transactionDone(transaction); return updated;
  },
  async getVault({ from = "", to = "" } = {}) {
    const database = await this.open(); const transaction = database.transaction(["cashierShifts", "sales"], "readonly"); const [shifts, sales] = await Promise.all([requestAsPromise(transaction.objectStore("cashierShifts").getAll()), requestAsPromise(transaction.objectStore("sales").getAll())]); await transactionDone(transaction);
    const matches = (shift) => (!from || shift.date >= from) && (!to || shift.date <= to); const cashSalesForShift = (shift) => roundMoney(sales.filter((sale) => sale.cashierShiftId === shift.id && (!sale.paymentMethod || sale.paymentMethod === "نقدي")).reduce((sum, sale) => sum + toNumber(sale.initialPaidAmount ?? sale.paidAmount), 0));
    const pendingShifts = shifts.filter((shift) => matches(shift) && !shift.vaultTransferredAt); const cashierCashHeld = roundMoney(pendingShifts.reduce((sum, shift) => sum + (shift.status === "CLOSED" ? toNumber(shift.countedCash) : roundMoney(toNumber(shift.receivedCash) + cashSalesForShift(shift))), 0)); const unpostedDifference = roundMoney(pendingShifts.filter((shift) => shift.status === "CLOSED").reduce((sum, shift) => sum + toNumber(shift.difference), 0)); const cashbox = await this.getCashbox({ from, to });
    return { ...cashbox, cashierCashHeld, vaultBalance: roundMoney(cashbox.closingBalance + unpostedDifference - cashierCashHeld), untransferredShiftCount: pendingShifts.filter((shift) => shift.status === "CLOSED").length };
  },
  async listCashierShiftStatistics({ from = "", to = "" } = {}) {
    const database = await this.open(); const transaction = database.transaction(["cashierShifts", "cashierSalaryDeductions"], "readonly"); const [shifts, deductions] = await Promise.all([requestAsPromise(transaction.objectStore("cashierShifts").getAll()), requestAsPromise(transaction.objectStore("cashierSalaryDeductions").getAll())]); await transactionDone(transaction);
    const matches = (shift) => (!from || shift.date >= from) && (!to || shift.date <= to); const grouped = new Map(); shifts.filter((shift) => matches(shift)).forEach((shift) => { const current = grouped.get(shift.accountId) || { accountId: shift.accountId, accountName: shift.accountName || "كاشير", shifts: 0, shortages: 0, surpluses: 0, pendingSurpluses: 0, approvedSurpluses: 0, rejectedSurpluses: 0, netDifference: 0, untransferred: 0, pendingShortages: 0, pendingShiftIds: [] }; const difference = toNumber(shift.difference); current.shifts += 1; if (difference < 0) current.shortages = roundMoney(current.shortages + Math.abs(difference)); if (difference > 0) { current.surpluses = roundMoney(current.surpluses + difference); if (shift.surplusApprovalStatus === "PENDING") current.pendingSurpluses = roundMoney(current.pendingSurpluses + difference); else if (shift.surplusApprovalStatus === "APPROVED") current.approvedSurpluses = roundMoney(current.approvedSurpluses + difference); else if (shift.surplusApprovalStatus === "REJECTED") current.rejectedSurpluses = roundMoney(current.rejectedSurpluses + difference); } // الفائض لا يُحتسب في الصافي إلا بعد اعتماد المدير
      const countsToward = difference < 0 || shift.surplusApprovalStatus === "APPROVED"; if (countsToward) current.netDifference = roundMoney(current.netDifference + difference); if (shift.status === "CLOSED" && !shift.vaultTransferredAt) current.untransferred += 1; if (shift.status === "CLOSED" && shift.vaultTransferredAt && difference < 0 && !shift.salaryDeductionId) { current.pendingShortages = roundMoney(current.pendingShortages + Math.abs(difference)); current.pendingShiftIds.push(shift.id); } grouped.set(shift.accountId, current); });
    return [...grouped.values()].sort((a, b) => a.accountName.localeCompare(b.accountName, "ar"));
  },
  async listCashierShortageCandidates({ accountId, month = dateKey().slice(0, 7) } = {}) { const database = await this.open(); const shifts = await requestAsPromise(database.transaction("cashierShifts", "readonly").objectStore("cashierShifts").index("accountId").getAll(accountId)); return shifts.filter((shift) => shift.status === "CLOSED" && shift.vaultTransferredAt && toNumber(shift.difference) < 0 && !shift.salaryDeductionId && String(shift.date || "").slice(0, 7) === month).sort((a, b) => String(a.date).localeCompare(String(b.date))); },
  async deductCashierShortagesFromSalary({ accountId, shiftIds = [] } = {}) {
    const ids = [...new Set((shiftIds || []).filter(Boolean))]; if (!accountId || !ids.length) throw new Error("اختر وردية عجز واحدة على الأقل لخصمها من الراتب."); const database = await this.open(); const transaction = database.transaction(["accounts", "expenses", "cashierShifts", "cashierSalaryDeductions"], "readwrite"); const accounts = transaction.objectStore("accounts"); const account = await requestAsPromise(accounts.get(accountId)); if (!account || account.role !== "cashier") throw new Error("اختر كاشيرًا صالحًا.");
    const shifts = transaction.objectStore("cashierShifts"); const selected = []; for (const id of ids) { const shift = await requestAsPromise(shifts.get(id)); if (!shift || shift.accountId !== accountId || shift.status !== "CLOSED" || !shift.vaultTransferredAt || toNumber(shift.difference) >= 0 || shift.salaryDeductionId) throw new Error("تتضمن القائمة وردية لا تصلح لخصم الراتب."); selected.push(shift); }
    const month = String(selected[0].date || dateKey()).slice(0, 7); if (selected.some((shift) => String(shift.date || "").slice(0, 7) !== month)) throw new Error("اختر ورديات من الشهر نفسه عند خصم الراتب."); const expenses = await requestAsPromise(transaction.objectStore("expenses").getAll()); const deductions = await requestAsPromise(transaction.objectStore("cashierSalaryDeductions").index("accountId").getAll(accountId)); const advances = roundMoney(expenses.filter((expense) => expense.cashierSalaryAdvance && expense.cashierId === accountId && String(expense.date || "").slice(0, 7) === month).reduce((sum, expense) => sum + toNumber(expense.amount), 0)); const priorDeductions = roundMoney(deductions.filter((deduction) => deduction.month === month).reduce((sum, deduction) => sum + toNumber(deduction.amount), 0)); const amount = roundMoney(selected.reduce((sum, shift) => sum + Math.abs(toNumber(shift.difference)), 0)); const remainingSalary = roundMoney(Math.max(0, toNumber(account.monthlySalary) - advances - priorDeductions)); if (amount > remainingSalary) throw new Error(`مجموع العجز (${amount}) أكبر من الراتب المتبقي (${remainingSalary}). اختر ورديات أقل أو سوِّ الفرق خارج الراتب.`);
    const now = nowIso(); const deductionsStore = transaction.objectStore("cashierSalaryDeductions"); selected.forEach((shift) => { const deduction = { id: uid("cashier-salary-deduction"), accountId, accountName: account.name, shiftId: shift.id, amount: Math.abs(toNumber(shift.difference)), month, date: dateKey(now), createdAt: now }; deductionsStore.add(deduction); shifts.put({ ...shift, salaryDeductionId: deduction.id, salaryDeductedAt: now, updatedAt: now }); }); await transactionDone(transaction); return { accountId, amount, month, shiftIds: selected.map((shift) => shift.id) };
  },
  async getCashbox({ from = "", to = "" } = {}) {
    const database = await this.open(); const names = ["settings", "sales", "purchases", "customerPayments", "supplierPayments", "saleReturns", "purchaseReturns", "expenses", "cashMovements"]; const transaction = database.transaction(names, "readonly"); const [settings, sales, purchases, customerPayments, supplierPayments, saleReturns, purchaseReturns, expenses, cashMovements] = await Promise.all([requestAsPromise(transaction.objectStore("settings").get("app")), ...names.slice(1).map((name) => requestAsPromise(transaction.objectStore(name).getAll()))]); const salesById = new Map(sales.map((sale) => [sale.id, sale])); const purchasesById = new Map(purchases.map((purchase) => [purchase.id, purchase])); const isCash = (method) => !method || method === "نقدي"; const isTransfer = (method) => method === "تحويل"; const summarize = (matches) => ({ cashSales: roundMoney(sales.filter((item) => matches(item) && isCash(item.paymentMethod)).reduce((sum, item) => sum + toNumber(item.initialPaidAmount ?? item.paidAmount), 0)), customerPayments: roundMoney(customerPayments.filter((item) => matches(item) && isCash(item.paymentMethod)).reduce((sum, item) => sum + toNumber(item.amount), 0)), purchaseReturns: roundMoney(purchaseReturns.filter((item) => { const purchase = purchasesById.get(item.purchaseId); return matches(item) && isCash(purchase?.paymentMethod) && purchase?.paymentType !== "آجل"; }).reduce((sum, item) => sum + toNumber(item.total), 0)), deposits: roundMoney(cashMovements.filter((item) => matches(item) && item.type === "DEPOSIT").reduce((sum, item) => sum + toNumber(item.amount), 0)), saleReturns: roundMoney(saleReturns.filter((item) => matches(item) && isCash(salesById.get(item.saleId)?.paymentMethod) && salesById.get(item.saleId)?.paymentType !== "آجل").reduce((sum, item) => sum + toNumber(item.total), 0)), cashPurchases: roundMoney(purchases.filter((item) => matches(item) && isCash(item.paymentMethod)).reduce((sum, item) => sum + toNumber(item.initialPaidAmount ?? item.paidAmount), 0)), supplierPayments: roundMoney(supplierPayments.filter((item) => matches(item) && isCash(item.paymentMethod)).reduce((sum, item) => sum + toNumber(item.amount), 0)), expenses: roundMoney(expenses.filter(matches).reduce((sum, item) => sum + toNumber(item.amount), 0)), withdrawals: roundMoney(cashMovements.filter((item) => matches(item) && item.type === "WITHDRAWAL").reduce((sum, item) => sum + toNumber(item.amount), 0)), transferSales: roundMoney(sales.filter((item) => matches(item) && isTransfer(item.paymentMethod)).reduce((sum, item) => sum + toNumber(item.initialPaidAmount ?? item.paidAmount), 0)), transferCustomerPayments: roundMoney(customerPayments.filter((item) => matches(item) && isTransfer(item.paymentMethod)).reduce((sum, item) => sum + toNumber(item.amount), 0)), transferPurchases: roundMoney(purchases.filter((item) => matches(item) && isTransfer(item.paymentMethod)).reduce((sum, item) => sum + toNumber(item.initialPaidAmount ?? item.paidAmount), 0)), transferSupplierPayments: roundMoney(supplierPayments.filter((item) => matches(item) && isTransfer(item.paymentMethod)).reduce((sum, item) => sum + toNumber(item.amount), 0)) }); const selected = summarize((item) => isWithinDateRange(item.date, from, to)); const prior = from ? summarize((item) => dateKey(item.date) < from) : {}; const openingBalance = calculateCashBalance({ openingBalance: toNumber(settings?.openingCash), ...prior }).closingBalance; return { from, to, openingBalance, ...selected, transferIncoming: roundMoney(selected.transferSales + selected.transferCustomerPayments), transferOutgoing: roundMoney(selected.transferPurchases + selected.transferSupplierPayments), ...calculateCashBalance({ openingBalance, ...selected }) };
  },

  async createLocalBackup() { const payload = await this.exportBackup(); const database = await this.open(); const transaction = database.transaction("localBackups", "readwrite"); const store = transaction.objectStore("localBackups"); const createdAt = nowIso(); store.add({ id: `local-backup-${createdAt.replace(/[:.]/g, "-")}-${randomId()}`, createdAt, payload }); const backups = await requestAsPromise(store.getAll()); backups.sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt))).slice(LOCAL_BACKUP_RETENTION_LIMIT).forEach((backup) => store.delete(backup.id)); await transactionDone(transaction); return { createdAt, count: Math.min(backups.length, LOCAL_BACKUP_RETENTION_LIMIT) }; },
  async listLocalBackups() { const database = await this.open(); const backups = await requestAsPromise(database.transaction("localBackups", "readonly").objectStore("localBackups").getAll()); return backups.sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt))); },
  async exportBackup() { const database = await this.open(); const storeNames = Array.from(database.objectStoreNames).filter((name) => name !== "localBackups"); const transaction = database.transaction(storeNames, "readonly"); const values = await Promise.all(storeNames.map((name) => requestAsPromise(transaction.objectStore(name).getAll()))); await transactionDone(transaction); return { schema: "hesabi-backup", version: 1, databaseVersion: DB_VERSION, exportedAt: nowIso(), stores: Object.fromEntries(storeNames.map((name, index) => [name, name === "meta" ? values[index].filter((item) => item.id !== ACTIVE_SESSION_META_ID) : values[index]])) }; },
  validateBackup(payload) { if (!payload || payload.schema !== "hesabi-backup" || !payload.stores || typeof payload.stores !== "object") throw new Error("ملف النسخة الاحتياطية غير صالح."); if (!Array.isArray(payload.stores.settings) || !Array.isArray(payload.stores.products)) throw new Error("ملف النسخة الاحتياطية لا يحتوي على البيانات الأساسية."); return true; },
  async restoreBackup(payload) { this.validateBackup(payload); const database = await this.open(); const storeNames = Array.from(database.objectStoreNames).filter((name) => name !== "localBackups"); const transaction = database.transaction(storeNames, "readwrite"); storeNames.forEach((name) => transaction.objectStore(name).clear()); storeNames.forEach((name) => (payload.stores[name] || []).filter((item) => name !== "meta" || item.id !== ACTIVE_SESSION_META_ID).forEach((item) => transaction.objectStore(name).put(item))); await transactionDone(transaction); return { restoredStores: storeNames.filter((name) => Array.isArray(payload.stores[name])).length }; },
  async applySyncChanges(changes = []) {
    const database = await this.open();
    const valid = (changes || []).filter((change) => change?.store && change.recordId && database.objectStoreNames.contains(change.store));
    if (!valid.length) return 0;
    const uniqueIndexes = { accounts: ["username"], sales: ["invoiceNumber"], purchases: ["invoiceNumber"], cashierSalaryDeductions: ["shiftId"] };
    const conflicts = new Map();
    for (const storeName of [...new Set(valid.map((change) => change.store))]) {
      const indexes = uniqueIndexes[storeName] || [];
      if (!indexes.length) continue;
      const existing = await requestAsPromise(database.transaction(storeName, "readonly").objectStore(storeName).getAll());
      const byKey = new Map();
      existing.forEach((record) => indexes.forEach((index) => { const value = record?.[index]; if (value !== undefined && value !== null && value !== "") byKey.set(`${storeName}:${index}:${value}`, record.id); }));
      valid.filter((change) => change.store === storeName && change.type !== "delete" && change.record).forEach((change) => indexes.forEach((index) => { const value = change.record?.[index]; const oldId = value !== undefined && value !== null && value !== "" ? byKey.get(`${storeName}:${index}:${value}`) : undefined; if (oldId && oldId !== change.recordId) conflicts.set(`${storeName}:${oldId}`, { storeName, id: oldId }); }));
    }
    const transaction = database.transaction([...new Set(valid.map((change) => change.store))], "readwrite");
    conflicts.forEach(({ storeName, id }) => transaction.objectStore(storeName).delete(id));
    valid.forEach((change) => { const store = transaction.objectStore(change.store); if (change.type === "delete") store.delete(change.recordId); else if (change.record && typeof change.record === "object") store.put(change.record); });
    await transactionDone(transaction);
    return valid.length;
  },
  async resetAllData() { const database = await this.open(); const storeNames = Array.from(database.objectStoreNames); const transaction = database.transaction(storeNames, "readwrite"); storeNames.forEach((name) => transaction.objectStore(name).clear()); await transactionDone(transaction); },

  async listExpenses() { const database = await this.open(); const items = await requestAsPromise(database.transaction("expenses", "readonly").objectStore("expenses").getAll()); return items.sort((a, b) => new Date(b.date) - new Date(a.date)); },
  async listCashierSalarySummaries({ month = dateKey().slice(0, 7) } = {}) {
    const database = await this.open(); const transaction = database.transaction(["accounts", "expenses", "cashierSalaryDeductions"], "readonly");
    const [accounts, expenses, deductions] = await Promise.all([requestAsPromise(transaction.objectStore("accounts").getAll()), requestAsPromise(transaction.objectStore("expenses").getAll()), requestAsPromise(transaction.objectStore("cashierSalaryDeductions").getAll())]);
    await transactionDone(transaction);
    const staffAccounts = accounts.filter((account) => ["admin", "cashier", "employee"].includes(account.role) && (account.role !== "admin" || toNumber(account.monthlySalary) > 0));
    return staffAccounts.sort((a, b) => a.name.localeCompare(b.name, "ar")).map((account) => {
      const monthlySalary = Math.max(0, toNumber(account.monthlySalary));
      const staffId = (expense) => expense.staffId || expense.cashierId;
      const advances = roundMoney(expenses.filter((expense) => expense.cashierSalaryAdvance && staffId(expense) === account.id && String(expense.date || "").slice(0, 7) === month).reduce((sum, expense) => sum + toNumber(expense.amount), 0));
      const salaryPayment = expenses.find((expense) => expense.salaryPayment && staffId(expense) === account.id && (expense.month || String(expense.date || "").slice(0, 7)) === month);
      const salaryPaid = roundMoney(expenses.filter((expense) => expense.salaryPayment && staffId(expense) === account.id && (expense.month || String(expense.date || "").slice(0, 7)) === month).reduce((sum, expense) => sum + toNumber(expense.amount), 0));
      const shortageDeductions = roundMoney(deductions.filter((deduction) => deduction.accountId === account.id && deduction.month === month).reduce((sum, deduction) => sum + toNumber(deduction.amount), 0));
      const remainingSalary = roundMoney(Math.max(0, monthlySalary - advances - shortageDeductions - salaryPaid));
      return { accountId: account.id, accountName: account.name, role: account.role, jobTitle: account.jobTitle || "", month, monthlySalary, advances, shortageDeductions, salaryPaid, remainingSalary, salaryDelivered: Boolean(salaryPayment) };
    });
  },
  async settleCashierSalary({ accountId, month = dateKey().slice(0, 7), date = dateKey(), notes = "" } = {}) {
    const normalizedMonth = String(month || "").slice(0, 7); if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) throw new Error("شهر الراتب غير صالح.");
    const database = await this.open(); const transaction = database.transaction(["accounts", "expenses", "cashierSalaryDeductions"], "readwrite"); const account = await requestAsPromise(transaction.objectStore("accounts").get(accountId));
    if (!account || !["admin", "cashier", "employee"].includes(account.role)) throw new Error("اختر حسابًا صالحًا لتسليم راتبه.");
    const monthlySalary = Math.max(0, toNumber(account.monthlySalary)); if (monthlySalary <= 0) throw new Error("سجّل راتبًا شهريًا للموظف أولًا.");
    const expensesStore = transaction.objectStore("expenses"); const expenses = await requestAsPromise(expensesStore.getAll()); const deductions = await requestAsPromise(transaction.objectStore("cashierSalaryDeductions").index("accountId").getAll(accountId));
    const belongsToMonth = (item) => (item.month || String(item.date || "").slice(0, 7)) === normalizedMonth && (item.staffId || item.cashierId) === accountId;
    if (expenses.some((expense) => expense.salaryPayment && belongsToMonth(expense))) throw new Error("تم تسليم راتب هذا الموظف لهذا الشهر مسبقًا.");
    const advances = roundMoney(expenses.filter((expense) => expense.cashierSalaryAdvance && belongsToMonth(expense)).reduce((sum, expense) => sum + toNumber(expense.amount), 0));
    const shortageDeductions = roundMoney(deductions.filter((deduction) => deduction.month === normalizedMonth).reduce((sum, deduction) => sum + toNumber(deduction.amount), 0));
    const remaining = roundMoney(Math.max(0, monthlySalary - advances - shortageDeductions)); const now = nowIso();
    const payment = { id: uid("salary-payment"), amount: remaining, salaryExpenseAmount: monthlySalary, periodType: "monthly", category: "رواتب مسلمة", description: `راتب مسلم لـ ${account.name}`, date: date || dateKey(), month: normalizedMonth, notes: normalize(notes), salaryPayment: true, cashierMonthlySalary: true, staffId: account.id, staffName: account.name, cashierId: account.role === "cashier" ? account.id : "", cashierName: account.role === "cashier" ? account.name : "", advances, shortageDeductions, remainingSalary: 0, createdAt: now, updatedAt: now };
    expensesStore.add(payment); await transactionDone(transaction); return { payment, accountId: account.id, accountName: account.name, month: normalizedMonth, amount: remaining, salaryExpenseAmount: monthlySalary, advances, shortageDeductions };
  },
  async listCashierMonthlySalaryExpenses({ from = "", to = "" } = {}) {
    if (from && to && from > to) return [];
    const startMonth = String(from || to || dateKey()).slice(0, 7); const endMonth = String(to || from || dateKey()).slice(0, 7);
    const validMonth = (value) => /^\d{4}-\d{2}$/.test(value);
    if (!validMonth(startMonth) || !validMonth(endMonth) || startMonth > endMonth) return [];
    const [startYear, startMonthNumber] = startMonth.split("-").map(Number); const [endYear, endMonthNumber] = endMonth.split("-").map(Number); const startIndex = startYear * 12 + startMonthNumber; const endIndex = endYear * 12 + endMonthNumber;
    const months = Array.from({ length: endIndex - startIndex + 1 }, (_, index) => { const value = startIndex + index; const year = Math.floor((value - 1) / 12); const month = ((value - 1) % 12) + 1; return `${year}-${String(month).padStart(2, "0")}`; });
    const summaries = (await Promise.all(months.map((month) => this.listCashierSalarySummaries({ month })))).flat();
    return summaries.filter((summary) => summary.salaryDelivered).map((summary) => ({ id: `cashier-salary-${summary.accountId}-${summary.month}`, amount: summary.monthlySalary, periodType: "monthly", category: "رواتب مسلمة", description: `راتب مسلم لـ ${summary.accountName}`, date: `${summary.month}-01`, month: summary.month, notes: `الراتب الأساسي ${summary.monthlySalary} · السلف ${summary.advances} · خصم العجز ${summary.shortageDeductions} · المسلم ${summary.salaryPaid}`, cashierMonthlySalary: true, salaryPayment: true, staffId: summary.accountId, cashierId: summary.accountId, cashierName: summary.accountName, advances: summary.advances, shortageDeductions: summary.shortageDeductions, salaryPaid: summary.salaryPaid, remainingSalary: summary.remainingSalary, role: summary.role, jobTitle: summary.jobTitle }));
  },
  async createExpense(values) {
    const amount = Math.max(0, toNumber(values.amount)); if (amount <= 0) throw new Error("أدخل مبلغ مصروف أكبر من صفر.");
    const isStaffSalaryAdvance = values.cashierSalaryAdvance === true || values.cashierSalaryAdvance === "on" || values.salaryAdvance === true || values.salaryAdvance === "on";
    const periodType = isStaffSalaryAdvance ? "daily" : (values.periodType === "monthly" ? "monthly" : "daily"); const date = values.date || dateKey();
    const database = await this.open(); const transaction = database.transaction(isStaffSalaryAdvance ? ["accounts", "expenses", "cashierSalaryDeductions"] : ["expenses"], "readwrite");
    let staff = null;
    if (isStaffSalaryAdvance) {
      const staffId = normalize(values.staffId || values.cashierId); staff = await requestAsPromise(transaction.objectStore("accounts").get(staffId));
      if (!staff || !["admin", "cashier", "employee"].includes(staff.role)) throw new Error("اختر حسابًا صالحًا لسلفة الراتب.");
      const monthlySalary = Math.max(0, toNumber(staff.monthlySalary)); if (monthlySalary <= 0) throw new Error("سجّل راتبًا شهريًا للموظف أولًا.");
      const month = String(date).slice(0, 7); const expenses = await requestAsPromise(transaction.objectStore("expenses").getAll()); const deductions = await requestAsPromise(transaction.objectStore("cashierSalaryDeductions").index("accountId").getAll(staffId));
      const priorAdvances = roundMoney(expenses.filter((expense) => expense.cashierSalaryAdvance && (expense.staffId || expense.cashierId) === staffId && String(expense.date || "").slice(0, 7) === month).reduce((sum, expense) => sum + toNumber(expense.amount), 0));
      const priorSalaryPaid = roundMoney(expenses.filter((expense) => expense.salaryPayment && (expense.staffId || expense.cashierId) === staffId && (expense.month || String(expense.date || "").slice(0, 7)) === month).reduce((sum, expense) => sum + toNumber(expense.amount), 0));
      const priorDeductions = roundMoney(deductions.filter((deduction) => deduction.month === month).reduce((sum, deduction) => sum + toNumber(deduction.amount), 0));
      if (roundMoney(priorAdvances + priorDeductions + priorSalaryPaid + amount) > monthlySalary) throw new Error(`السلفة تتجاوز المتبقي من راتب ${staff.name} لهذا الشهر (${roundMoney(monthlySalary - priorAdvances - priorDeductions - priorSalaryPaid)}).`);
    }
    const expense = { id: uid("expense"), amount, periodType, category: isStaffSalaryAdvance ? "سلفة موظف" : normalize(values.category || (periodType === "monthly" ? "مصروفات شهرية أخرى" : "مصروفات يومية أخرى")), description: isStaffSalaryAdvance ? normalize(values.description || `سلفة من راتب ${staff.name}`) : normalize(values.description), date, notes: normalize(values.notes), cashierSalaryAdvance: isStaffSalaryAdvance, salaryAdvance: isStaffSalaryAdvance, staffId: isStaffSalaryAdvance ? staff.id : "", staffName: isStaffSalaryAdvance ? staff.name : "", cashierId: isStaffSalaryAdvance && staff.role === "cashier" ? staff.id : "", cashierName: isStaffSalaryAdvance && staff.role === "cashier" ? staff.name : "", createdAt: nowIso(), updatedAt: nowIso() }; transaction.objectStore("expenses").add(expense); await transactionDone(transaction); return expense;
  },
  async updateExpense(expenseId, values) {
    const amount = Math.max(0, toNumber(values.amount)); if (amount <= 0) throw new Error("أدخل مبلغ مصروف أكبر من صفر.");
    const database = await this.open(); const current = await requestAsPromise(database.transaction("expenses", "readonly").objectStore("expenses").get(expenseId)); if (!current) throw new Error("المصروف غير موجود.");
    const transaction = database.transaction(current.cashierSalaryAdvance ? ["accounts", "expenses", "cashierSalaryDeductions"] : ["expenses"], "readwrite"); const store = transaction.objectStore("expenses");
    if (current.cashierSalaryAdvance) {
      const staffId = current.staffId || current.cashierId; const account = await requestAsPromise(transaction.objectStore("accounts").get(staffId)); if (!account || !["admin", "cashier", "employee"].includes(account.role)) throw new Error("حساب الراتب المرتبط بالسلفة غير متاح.");
      const date = values.date || current.date; const month = String(date).slice(0, 7); const expenses = await requestAsPromise(store.getAll()); const deductions = await requestAsPromise(transaction.objectStore("cashierSalaryDeductions").index("accountId").getAll(staffId));
      const otherAdvances = roundMoney(expenses.filter((expense) => expense.id !== expenseId && expense.cashierSalaryAdvance && (expense.staffId || expense.cashierId) === staffId && String(expense.date || "").slice(0, 7) === month).reduce((sum, expense) => sum + toNumber(expense.amount), 0));
      const salaryPaid = roundMoney(expenses.filter((expense) => expense.salaryPayment && (expense.staffId || expense.cashierId) === staffId && (expense.month || String(expense.date || "").slice(0, 7)) === month).reduce((sum, expense) => sum + toNumber(expense.amount), 0));
      const priorDeductions = roundMoney(deductions.filter((deduction) => deduction.month === month).reduce((sum, deduction) => sum + toNumber(deduction.amount), 0)); const remaining = roundMoney(Math.max(0, toNumber(account.monthlySalary) - otherAdvances - priorDeductions - salaryPaid));
      if (amount > remaining) throw new Error(`السلفة تتجاوز المتبقي من راتب ${account.name} لهذا الشهر (${remaining}).`);
    }
    const periodType = current.cashierSalaryAdvance ? "daily" : (values.periodType === "monthly" ? "monthly" : "daily"); const staffId = current.staffId || current.cashierId || ""; const updated = { ...current, amount, periodType, category: current.cashierSalaryAdvance ? "سلفة موظف" : normalize(values.category || current.category), description: current.cashierSalaryAdvance ? normalize(values.description || current.description) : normalize(values.description), date: values.date || current.date, notes: normalize(values.notes), staffId, staffName: current.staffName || current.cashierName || "", updatedAt: nowIso() }; store.put(updated); await transactionDone(transaction); return updated;
  },
  async deleteExpense(expenseId) { const database = await this.open(); const transaction = database.transaction("expenses", "readwrite"); transaction.objectStore("expenses").delete(expenseId); await transactionDone(transaction); },

  async listStockMovements() { const database = await this.open(); const movements = await requestAsPromise(database.transaction("stockMovements", "readonly").objectStore("stockMovements").getAll()); return movements.sort((a, b) => new Date(b.date) - new Date(a.date)); },
  async getAnalytics({ from = "", to = "" } = {}) {
    const database = await this.open(); const transaction = database.transaction(["sales", "saleItems", "saleReturns", "saleReturnItems", "purchases", "purchaseItems", "purchaseReturns", "purchaseReturnItems", "expenses", "products"], "readonly");
    const [sales, saleItems, saleReturns, saleReturnItems, purchases, purchaseItems, purchaseReturns, purchaseReturnItems, expenses, products] = await Promise.all(["sales", "saleItems", "saleReturns", "saleReturnItems", "purchases", "purchaseItems", "purchaseReturns", "purchaseReturnItems", "expenses", "products"].map((name) => requestAsPromise(transaction.objectStore(name).getAll())));
    const filter = (items) => items.filter((item) => isWithinDateRange(item.date, from, to)); const filteredSales = filter(sales); const saleIds = new Set(filteredSales.map((item) => item.id)); const filteredSaleItems = saleItems.filter((item) => saleIds.has(item.saleId)); const filteredReturns = filter(saleReturns); const returnIds = new Set(filteredReturns.map((item) => item.id)); const filteredReturnItems = saleReturnItems.filter((item) => returnIds.has(item.saleReturnId)); const filteredPurchases = filter(purchases); const purchaseIds = new Set(filteredPurchases.map((item) => item.id)); const filteredPurchaseItems = purchaseItems.filter((item) => purchaseIds.has(item.purchaseId)); const filteredPurchaseReturns = filter(purchaseReturns); const purchaseReturnIds = new Set(filteredPurchaseReturns.map((item) => item.id)); const filteredPurchaseReturnItems = purchaseReturnItems.filter((item) => purchaseReturnIds.has(item.purchaseReturnId));     const salaryPayments = expenses.filter((item) => item.salaryPayment && toNumber(item.salaryExpenseAmount) > 0).map((item) => ({ ...item, amount: toNumber(item.salaryExpenseAmount), periodType: "monthly" }));
    const operationalExpenses = expenses.filter((item) => !item.cashierSalaryAdvance && !item.salaryAdvance && !item.salaryPayment);
    const recognizedExpenses = [...operationalExpenses, ...salaryPayments].map((item) => ({ ...item, recognizedAmount: item.periodType === "monthly" ? calculateMonthlyExpenseAllocation({ amount: item.amount, date: item.date, from, to }) : (isWithinDateRange(item.date, from, to) ? toNumber(item.amount) : 0) })).filter((item) => item.recognizedAmount > 0);
    const salesTotal = roundMoney(filteredSales.reduce((sum, item) => sum + toNumber(item.total), 0)); const discounts = roundMoney(filteredSales.reduce((sum, item) => sum + toNumber(item.discount), 0)); const costOfGoods = roundMoney(filteredSaleItems.reduce((sum, item) => sum + toNumber(item.costTotal ?? toNumber(item.unitCost) * toNumber(item.quantity)), 0)); const salesReturnsTotal = roundMoney(filteredReturnItems.reduce((sum, item) => sum + toNumber(item.total), 0)); const returnCosts = roundMoney(filteredReturnItems.reduce((sum, item) => sum + toNumber(item.costTotal ?? toNumber(item.unitCost) * toNumber(item.quantity)), 0)); const expensesTotal = roundMoney(recognizedExpenses.reduce((sum, item) => sum + toNumber(item.recognizedAmount), 0)); const profit = calculateProfit({ sales: salesTotal, costOfGoods, expenses: expensesTotal, salesReturns: salesReturnsTotal, returnCosts }); const purchasesTotal = roundMoney(filteredPurchases.reduce((sum, item) => sum + toNumber(item.total), 0)); const purchasesReturnsTotal = roundMoney(filteredPurchaseReturnItems.reduce((sum, item) => sum + toNumber(item.total), 0)); const expensesByCategory = recognizedExpenses.reduce((groups, item) => ({ ...groups, [item.category]: roundMoney((groups[item.category] || 0) + toNumber(item.recognizedAmount)) }), {});

    const productStatsMap = new Map();
    filteredSaleItems.forEach((item) => {
      const pid = item.productId || item.productName;
      const current = productStatsMap.get(pid) || { productId: item.productId, name: item.productName, quantity: 0, revenue: 0, cost: 0, profit: 0 };
      const q = toNumber(item.quantity);
      const rev = toNumber(item.total);
      const c = toNumber(item.costTotal ?? (toNumber(item.unitCost) * q));
      current.quantity = roundMoney(current.quantity + q);
      current.revenue = roundMoney(current.revenue + rev);
      current.cost = roundMoney(current.cost + c);
      current.profit = roundMoney(current.profit + (rev - c));
      productStatsMap.set(pid, current);
    });
    const allProductStats = Array.from(productStatsMap.values());
    const topByVolume = [...allProductStats].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const topByProfit = [...allProductStats].sort((a, b) => b.profit - a.profit).slice(0, 5);

    const hourlyDistribution = Array(24).fill(0).map((_, hour) => ({ hour, count: 0, total: 0 }));
    filteredSales.forEach((sale) => {
      if (sale.date) {
        const hour = new Date(sale.date).getHours();
        if (hour >= 0 && hour < 24) {
          hourlyDistribution[hour].count += 1;
          hourlyDistribution[hour].total = roundMoney(hourlyDistribution[hour].total + toNumber(sale.total));
        }
      }
    });

    const soldProductIds = new Set(filteredSaleItems.map((item) => item.productId));
    const deadStockProducts = (products || []).filter((p) => !p.isDeleted && toNumber(p.quantity) > 0 && !soldProductIds.has(p.id));
    const deadStockValue = roundMoney(deadStockProducts.reduce((sum, p) => sum + (toNumber(p.quantity) * toNumber(p.purchasePrice)), 0));

    return { from, to, sales: { invoices: filteredSales.length, total: salesTotal, discounts, net: profit.netSales, costOfGoods: profit.netCostOfGoods, profit: profit.grossProfit, returns: salesReturnsTotal, items: filteredSales }, purchases: { invoices: filteredPurchases.length, total: purchasesTotal, net: roundMoney(purchasesTotal - purchasesReturnsTotal), products: filteredPurchaseItems.reduce((sum, item) => sum + toNumber(item.quantity), 0), returns: purchasesReturnsTotal, items: filteredPurchases }, expenses: { total: expensesTotal, byCategory: expensesByCategory, items: recognizedExpenses }, profit, saleReturns: filteredReturns, purchaseReturns: filteredPurchaseReturns, topByVolume, topByProfit, hourlyDistribution, deadStock: { count: deadStockProducts.length, value: deadStockValue, products: deadStockProducts.slice(0, 8) } };
  },
  async getDashboard() {
    const today = dateKey(); const [products, sales, purchases, expenses, analytics, customers, suppliers, todayPayments, todaySupplierPayments, cashbox, todayCashbox, productBatches] = await Promise.all([this.listProducts(), this.listSales(), this.listPurchases(), this.listExpenses(), this.getAnalytics(), this.listCustomers(), this.listSuppliers(), this.listCustomerPayments({ from: today, to: today }), this.listSupplierPayments({ from: today, to: today }), this.getCashbox(), this.getCashbox({ from: today, to: today }), this.listProductBatches()]); const todaySales = sales.filter((item) => dateKey(item.date) === today); const todayPurchases = purchases.filter((item) => dateKey(item.date) === today); const todayExpenses = expenses.filter((item) => dateKey(item.date) === today); const todayAnalytics = await this.getAnalytics({ from: today, to: today }); const debtors = customers.filter((customer) => toNumber(customer.balance) > 0).sort((a, b) => toNumber(b.balance) - toNumber(a.balance)); const creditors = suppliers.filter((supplier) => toNumber(supplier.balance) > 0).sort((a, b) => toNumber(b.balance) - toNumber(a.balance)); const productsById = new Map(products.map((product) => [product.id, product])); const expiringBatches = productBatches.filter((batch) => { if (toNumber(batch.remainingQuantity) <= 0 || !batch.expiryDate) return false; const progress = expiryProgress({ productionDate: batch.productionDate, expiryDate: batch.expiryDate, today }); return progress ? progress.ratio >= 0.85 : Math.ceil((new Date(`${batch.expiryDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000) <= 90; }).map((batch) => ({ ...batch, product: productsById.get(batch.productId) })).filter((batch) => batch.product);
    return { productCount: products.length, expiringBatches, inventoryValue: calculateInventoryCost(products, productBatches), lowStock: products.filter((product) => toNumber(product.quantity) <= toNumber(product.minimumStock)), todaySales: roundMoney(todaySales.reduce((sum, item) => sum + toNumber(item.total), 0)), todayPurchases: roundMoney(todayPurchases.reduce((sum, item) => sum + toNumber(item.total), 0)), todayExpenses: todayAnalytics.expenses.total, todayProfit: todayAnalytics.profit.netProfit, todayInvoiceCount: todaySales.length, customerCount: customers.length, supplierCount: suppliers.length, customerDebt: roundMoney(debtors.reduce((sum, customer) => sum + toNumber(customer.balance), 0)), supplierDebt: roundMoney(creditors.reduce((sum, customer) => sum + toNumber(customer.balance), 0)), todayCustomerPayments: roundMoney(todayPayments.reduce((sum, item) => sum + toNumber(item.amount), 0)), todaySupplierPayments: roundMoney(todaySupplierPayments.reduce((sum, item) => sum + toNumber(item.amount), 0)), todayCashIn: todayCashbox.inflows, cashBalance: cashbox.closingBalance, debtors: debtors.slice(0, 5), creditors: creditors.slice(0, 5), analytics };
  },
};
