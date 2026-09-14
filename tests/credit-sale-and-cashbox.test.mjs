import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../client/src/js/database.js";
import { BUSINESS_PROFILES } from "../client/src/js/constants.js";
import { createCloudBackupPackage, decodeCloudBackupPackage } from "../client/src/js/cloud-backup-codec.js";

test("البيع الآجل يفرض صفرًا كدفعة أولى وتبقى الحوالة خارج رصيد الصندوق", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج بيع آجل", unit: "حبة", purchasePrice: 40, salePrice: 100, quantity: 4, minimumStock: 1 });
  const customer = await db.createCustomer({ name: "عميل آجل" });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 100, paymentMethod: "تحويل", paymentType: "آجل", customerId: customer.id });

  assert.equal(sale.paidAmount, 0);
  assert.equal(sale.initialPaidAmount, 0);
  assert.equal(sale.remainingAmount, 100);
  assert.equal(sale.paymentStatus, "غير مدفوعة");
  const payment = await db.registerCustomerPayment({ customerId: customer.id, amount: 30, paymentMethod: "تحويل" });
  assert.equal(payment.paymentMethod, "تحويل");

  const cashbox = await db.getCashbox();
  assert.equal(cashbox.transferIncoming, 30);
  assert.equal(cashbox.closingBalance, 0);
  await db.resetAllData();
});

test("تعرض لوحة التحكم الداخل النقدي اليومي بدل رصيد الصندوق التراكمي", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج نقدي", unit: "حبة", purchasePrice: 25, salePrice: 90, quantity: 2, minimumStock: 0 });
  await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 90, paymentMethod: "نقدي" });
  const dashboard = await db.getDashboard();
  assert.equal(dashboard.todayCashIn, 90);
  assert.equal(dashboard.cashBalance, 90);
  await db.resetAllData();
});

test("دفعة المورد تختار المورد المستحق وتسوّي فاتورته الآجلة وتنعكس مرة واحدة في الصندوق أو التحويل", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج توريد", unit: "حبة", purchasePrice: 80, salePrice: 130, quantity: 0, minimumStock: 0 });
  const supplier = await db.createSupplier({ name: "مورد آجل" });
  const purchase = await db.createPurchase({ supplierId: supplier.id, paymentType: "آجل", paidAmount: "", paymentMethod: "نقدي", items: [{ productId: product.id, packageQuantity: 1, unitsPerPackage: 1, packageCost: 120, packageUnit: "حبة", salePrice: 150 }] });
  const cashPayment = await db.registerSupplierPayment({ supplierId: supplier.id, amount: 50, paymentMethod: "نقدي", notes: "تسديد من الصندوق" });
  const firstAccount = await db.getSupplierAccount(supplier.id);
  const firstPurchase = await db.getPurchase(purchase.id);
  const firstCashbox = await db.getCashbox();
  assert.equal(cashPayment.supplierId, supplier.id);
  assert.equal(cashPayment.allocations[0].purchaseId, purchase.id);
  assert.equal(firstAccount.balance, 70);
  assert.equal(firstPurchase.remainingAmount, 70);
  assert.equal(firstCashbox.supplierPayments, 50);
  assert.equal(firstCashbox.closingBalance, -50);

  const transferPayment = await db.registerSupplierPayment({ supplierId: supplier.id, amount: 20, paymentMethod: "تحويل" });
  const secondAccount = await db.getSupplierAccount(supplier.id);
  const secondCashbox = await db.getCashbox();
  assert.equal(transferPayment.paymentMethod, "تحويل");
  assert.equal(secondAccount.balance, 50);
  assert.equal(secondCashbox.supplierPayments, 50);
  assert.equal(secondCashbox.transferOutgoing, 20);
  await db.resetAllData();
});

test("يربط المنتج بآخر مورد مورّد له ليظهر اختصار حسابه واتصاله في القوائم", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج مورد مرتبط", unit: "حبة", purchasePrice: 20, salePrice: 40, quantity: 0, minimumStock: 0 });
  const supplier = await db.createSupplier({ name: "مورد المنتج", phone: "777123456" });
  await db.createPurchase({ supplierId: supplier.id, paymentType: "نقدي", paymentMethod: "نقدي", items: [{ productId: product.id, packageQuantity: 1, unitsPerPackage: 1, packageCost: 25, packageUnit: "حبة", salePrice: 45 }] });
  const links = await db.listProductSupplierLinks();
  assert.equal(links[product.id].id, supplier.id);
  assert.equal(links[product.id].name, "مورد المنتج");
  assert.equal(links[product.id].phone, "777123456");
  assert.equal((await db.getProduct(product.id)).lastSupplierId, supplier.id);
  await db.resetAllData();
});

test("استعادة النسخة قبل الإعداد تعيد بيانات المتجر وحساب الدخول السابقين دون إنشاء حساب جديد", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر الاستعادة", businessType: "بقالة", currency: "YER" });
  const admin = await db.createAccount({ username: "restore-admin", name: "مدير الاستعادة", role: "admin", pin: "2468" });
  await db.createProduct({ name: "منتج محفوظ", unit: "حبة", purchasePrice: 25, salePrice: 50, quantity: 3, minimumStock: 1 });
  const backup = await db.exportBackup();
  const backupAccountCount = backup.stores.accounts.length;

  await db.resetAllData();
  assert.equal((await db.getSettings())?.setupCompleted, undefined);
  await db.restoreBackup(backup);

  assert.equal((await db.getSettings()).storeName, "متجر الاستعادة");
  assert.equal((await db.listProducts()).some((product) => product.name === "منتج محفوظ"), true);
  assert.equal((await db.listAccounts()).length, backupAccountCount);
  const restoredUser = await db.authenticateAccount({ username: admin.username, pin: "2468" });
  assert.equal(restoredUser.id, admin.id);
  await db.resetAllData();
});

test("يعيد الأدمن تعيين رمز الكاشير دون تخزين رمز دخول بديل", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر الاسترداد", businessType: "بقالة", currency: "YER" });
  const cashier = await db.createAccount({ username: "rescue-cashier", name: "كاشير الاسترداد", role: "cashier", pin: "1357" });
  const settings = await db.getSettings();
  assert.equal("adminRecoveryHash" in settings, false);

  await db.resetAccountPinByAdmin(cashier.id, "9876");
  await assert.rejects(() => db.authenticateAccount({ username: cashier.username, pin: "1357" }), /بيانات الدخول غير صحيحة/);
  assert.equal((await db.authenticateAccount({ username: cashier.username, pin: "9876" })).mustChangePin, true);
  await db.resetAllData();
});

test("تخصص الأنشطة وحداتها ولا تعرض عبوات البقالة غير المناسبة للملابس أو الجوالات", () => {
  assert.equal(BUSINESS_PROFILES["ملابس"].packageUnits.includes("جرام"), false);
  assert.equal(BUSINESS_PROFILES["ملابس"].units.includes("قطعة"), true);
  assert.equal(BUSINESS_PROFILES["جوالات"].units.includes("جهاز"), true);
  assert.equal(BUSINESS_PROFILES["صيدلية"].packageUnits.includes("شريط"), true);
});

test("شراء الصيدلية يجعل رقم التشغيلة اختياريًا ويفرض الصلاحية ويحفظ البيانات", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "صيدلية الاختبار", businessType: "صيدلية", currency: "YER" });
  const product = await db.createProduct({ name: "دواء تجريبي", unit: "حبة", purchasePrice: 0, salePrice: 0, quantity: 0, minimumStock: 1 });
  const purchaseWithoutBatch = await db.createPurchase({ items: [{ productId: product.id, packageQuantity: 1, unitsPerPackage: 10, packageCost: 1000, packageUnit: "علبة", salePrice: 150, expiryDate: "2026-12-31" }] });
  assert.equal((await db.getPurchase(purchaseWithoutBatch.id)).items[0].batchNumber, "");
  const purchase = await db.createPurchase({ items: [{ productId: product.id, packageQuantity: 1, unitsPerPackage: 10, packageCost: 1000, packageUnit: "علبة", salePrice: 150, batchNumber: "B-2026", expiryDate: "2026-12-31" }] });
  const storedProduct = await db.getProduct(product.id); const storedPurchase = await db.getPurchase(purchase.id);
  assert.equal(storedProduct.latestBatchNumber, "B-2026");
  assert.equal(storedProduct.nearestExpiryDate, "2026-12-31");
  assert.equal(storedPurchase.items[0].expiryDate, "2026-12-31");
  await db.resetAllData();
});

test("السماح بالبيع بالسالب يخصم الكمية ثم تعوضها فاتورة شراء لاحقة", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر السالب", businessType: "بقالة", currency: "YER", allowNegativeSales: true });
  const product = await db.createProduct({ name: "منتج مخزون سالب", unit: "حبة", purchasePrice: 10, salePrice: 25, quantity: 0, minimumStock: 1 });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 3, unitPrice: 30 }], paidAmount: 90, paymentType: "نقدي", paymentMethod: "نقدي" });
  assert.equal(sale.total, 90);
  assert.equal((await db.getProduct(product.id)).quantity, -3);
  await db.createPurchase({ items: [{ productId: product.id, packageQuantity: 5, unitsPerPackage: 1, packageCost: 10, packageUnit: "حبة", salePrice: 30 }] });
  assert.equal((await db.getProduct(product.id)).quantity, 2);
  await db.resetAllData();
});

test("شراء غير الصيدلية يقبل تاريخ انتهاء اختياريًا ويحفظه لتتبع المخزون", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "بقالة الاختبار", businessType: "بقالة", currency: "YER" });
  const product = await db.createProduct({ name: "عصير تجريبي", unit: "حبة", purchasePrice: 0, salePrice: 0, quantity: 0, minimumStock: 1 });
  const purchase = await db.createPurchase({ items: [{ productId: product.id, packageQuantity: 1, unitsPerPackage: 6, packageCost: 600, packageUnit: "علبة", salePrice: 150, expiryDate: "2026-12-31" }] });
  const storedProduct = await db.getProduct(product.id); const storedPurchase = await db.getPurchase(purchase.id); const batches = await db.listProductBatches(product.id);
  assert.equal(storedProduct.nearestExpiryDate, "2026-12-31");
  assert.equal(storedPurchase.items[0].expiryDate, "2026-12-31");
  assert.equal(batches[0].remainingQuantity, 6);
  await db.resetAllData();
});

test("يمكن تعديل تاريخ انتهاء المنتج مباشرة من صفحة المنتجات", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج بتاريخ يدوي", unit: "حبة", purchasePrice: 30, salePrice: 50, quantity: 5, minimumStock: 1, nearestExpiryDate: "2099-12-31" });
  assert.equal(product.nearestExpiryDate, "2099-12-31");
  const updated = await db.updateProduct(product.id, { name: product.name, barcode: "", internalCode: "", category: "عام", purchasePrice: 30, salePrice: 50, minimumStock: 1, unit: "حبة", nearestExpiryDate: "2100-01-31" });
  assert.equal(updated.nearestExpiryDate, "2100-01-31");
  await db.resetAllData();
});

test("بيع الصيدلية يستهلك التشغيلة الأقرب انتهاءً أولًا ويترك الأحدث للمبيعات التالية", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "صيدلية التشغيلة", businessType: "صيدلية", currency: "YER" });
  const product = await db.createProduct({ name: "علاج تشغيلي", unit: "حبة", purchasePrice: 0, salePrice: 20, quantity: 0, minimumStock: 1 });
  const firstPurchase = await db.createPurchase({ items: [{ productId: product.id, packageQuantity: 1, unitsPerPackage: 10, packageCost: 100, packageUnit: "علبة", salePrice: 20, batchNumber: "EARLY", expiryDate: "2026-11-30" }] });
  await db.createPurchase({ items: [{ productId: product.id, packageQuantity: 1, unitsPerPackage: 10, packageCost: 100, packageUnit: "علبة", salePrice: 20, batchNumber: "LATER", expiryDate: "2026-12-31" }] });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 12 }], discount: 0, paidAmount: 240, paymentMethod: "نقدي" });
  const batches = await db.listProductBatches(product.id); const invoice = await db.getInvoice(sale.id);
  assert.deepEqual(batches.map((batch) => [batch.batchNumber, batch.remainingQuantity]), [["EARLY", 0], ["LATER", 8]]);
  assert.deepEqual(invoice.items[0].batchAllocations.map((item) => [item.batchNumber, item.quantity]), [["EARLY", 10], ["LATER", 2]]);
  assert.equal((await db.getProduct(product.id)).nearestExpiryDate, "2026-12-31");
  await db.createSaleReturn({ saleId: sale.id, items: [{ saleItemId: invoice.items[0].id, quantity: 4 }] });
  assert.deepEqual((await db.listProductBatches(product.id)).map((batch) => [batch.batchNumber, batch.remainingQuantity]), [["EARLY", 4], ["LATER", 8]]);
  const purchaseDetails = await db.getPurchase(firstPurchase.id);
  await db.createPurchaseReturn({ purchaseId: firstPurchase.id, items: [{ purchaseItemId: purchaseDetails.items[0].id, quantity: 2 }] });
  assert.deepEqual((await db.listProductBatches(product.id)).map((batch) => [batch.batchNumber, batch.remainingQuantity]), [["EARLY", 2], ["LATER", 8]]);
  const backup = await db.exportBackup(); await db.resetAllData(); await db.restoreBackup(backup);
  assert.deepEqual((await db.listProductBatches(product.id)).map((batch) => [batch.batchNumber, batch.remainingQuantity]), [["EARLY", 2], ["LATER", 8]]);
  await db.resetAllData();
});

test("تسجيل توصيل على حساب المحل يضيف مصروف توصيل ولا يضيفه إلى فاتورة البيع", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج مع توصيل محل", unit: "حبة", purchasePrice: 20, salePrice: 100, quantity: 2, minimumStock: 0 });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 100, paymentMethod: "نقدي", deliveryFee: 15, deliveryChargeType: "store" });
  const invoice = await db.getInvoice(sale.id); const expenses = await db.listExpenses(); const cashbox = await db.getCashbox();
  assert.equal(invoice.total, 100); assert.equal(invoice.deliveryFee, 15); assert.equal(invoice.deliveryChargeType, "store");
  assert.equal(expenses.some((item) => item.category === "توصيل" && item.referenceId === sale.id && item.amount === 15), true);
  assert.equal(cashbox.closingBalance, 85);
  await db.resetAllData();
});

test("تسجيل توصيل على العميل يضيفه إلى إجمالي الفاتورة دون عميل مسجل أو مديونية مستقلة", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج مع توصيل عميل", unit: "حبة", purchasePrice: 20, salePrice: 100, quantity: 2, minimumStock: 0 });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 115, paymentMethod: "نقدي", deliveryFee: 15, deliveryChargeType: "customer" });
  const invoice = await db.getInvoice(sale.id); const expenses = await db.listExpenses(); const cashbox = await db.getCashbox();
  assert.equal(invoice.customerId, ""); assert.equal(invoice.deliveryChargeType, "customer"); assert.equal(invoice.total, 115); assert.equal(invoice.paidAmount, 115);
  assert.equal(expenses.some((item) => item.referenceId === sale.id && item.category === "توصيل"), false); assert.equal(cashbox.closingBalance, 115);
  await db.resetAllData();
});

test("توصيل العميل ضمن فاتورة آجلة يدخل في إجمالي دين الفاتورة دون حركة توصيل مستقلة", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج تحقق التوصيل", unit: "حبة", purchasePrice: 20, salePrice: 100, quantity: 1, minimumStock: 0 });
  const customer = await db.createCustomer({ name: "عميل آجل مع توصيل" });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], paymentType: "آجل", paidAmount: 0, paymentMethod: "نقدي", deliveryFee: 10, deliveryChargeType: "customer", customerId: customer.id });
  const account = await db.getCustomerAccount(customer.id);
  assert.equal(sale.total, 110); assert.equal(account.balance, 110);
  assert.equal(account.transactions.filter((item) => item.referenceId === sale.id).length, 1); assert.equal(account.transactions.some((item) => item.type === "DELIVERY_CHARGE"), false);
  await db.resetAllData();
});

test("يحسب خصم البيع العام وخصم الصنف كنسب مئوية ويحفظهما في الفاتورة", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج خصم نسبي", unit: "حبة", purchasePrice: 40, salePrice: 100, quantity: 4, minimumStock: 0 });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 2, discount: "10%" }], discount: "20%", paidAmount: 144, paymentMethod: "نقدي" });
  assert.equal(sale.subtotal, 200);
  assert.equal(sale.lineDiscount, 20);
  assert.equal(sale.generalDiscount, 36);
  assert.equal(sale.discount, 56);
  assert.equal(sale.total, 144);
  const invoice = await db.getInvoice(sale.id);
  assert.equal(invoice.items[0].discount, 20);
  assert.equal(invoice.items[0].total, 180);
  await db.resetAllData();
});

test("ينشئ النسخة السحابية المجزأة ثم يستعيدها فعليًا إلى IndexedDB", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر النسخة السحابية", businessType: "بقالة", currency: "YER" });
  const product = await db.createProduct({ name: "منتج النسخة السحابية", unit: "حبة", purchasePrice: 12, salePrice: 25, quantity: 7, minimumStock: 2 });
  const backup = await db.exportBackup();
  const packed = await createCloudBackupPackage(backup, { chunkCharLimit: 1024, preferCompression: false });
  assert.ok(packed.chunks.length > 1);
  await db.resetAllData();
  assert.equal((await db.getProduct(product.id)), undefined);
  const restoredPayload = await decodeCloudBackupPackage(packed.metadata, packed.chunks);
  await db.restoreBackup(restoredPayload);
  assert.equal((await db.getSettings()).storeName, "متجر النسخة السحابية");
  assert.equal((await db.getProduct(product.id)).quantity, 7);
  await db.resetAllData();
});

test("تسجل وردية الكاشير استلام الصندوق ومبيعاته النقدية والعجز عند التسليم", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر الورديات", businessType: "بقالة", currency: "YER" });
  const cashier = await db.createAccount({ username: "shift-cashier", name: "كاشير الوردية", role: "cashier", pin: "1357" });
  const product = await db.createProduct({ name: "منتج وردية", unit: "حبة", purchasePrice: 30, salePrice: 100, quantity: 3, minimumStock: 0 });
  const shift = await db.startCashierShift({ accountId: cashier.id, accountName: cashier.name, receivedCash: 500 });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 100, paymentMethod: "نقدي", cashierShiftId: shift.id, cashierId: cashier.id, cashierName: cashier.name });
  const closed = await db.closeCashierShift({ shiftId: shift.id, countedCash: 590 });
  assert.equal(sale.cashierShiftId, shift.id);
  assert.equal(closed.cashSales, 100);
  assert.equal(closed.expectedCash, 600);
  assert.equal(closed.countedCash, 590);
  assert.equal(closed.difference, -10);
  assert.equal(closed.status, "CLOSED");
  assert.equal((await db.listCashierShifts()).length, 1);
  await db.resetAllData();
});

test("تسجل سلفة الموظف كمصروف نقدي وتخصم من راتبه الشهري دون تجاوز المتبقي", async () => {
  await db.resetAllData();
  const legacyCashier = await db.createAccount({ username: "legacy-cashier", name: "كاشير قديم", role: "cashier", pin: "1111" });
  const cashier = await db.createAccount({ username: "salary-cashier", name: "كاشير الراتب", role: "cashier", pin: "2222", monthlySalary: 1000 });
  assert.equal(legacyCashier.monthlySalary, 0);
  assert.equal(cashier.monthlySalary, 1000);

  const advance = await db.createExpense({ cashierSalaryAdvance: true, cashierId: cashier.id, amount: 200, date: "2026-08-15", description: "سلفة منتصف الشهر" });
  assert.equal(advance.category, "سلفة موظف");
  assert.equal(advance.cashierId, cashier.id);
  assert.equal(advance.cashierName, "كاشير الراتب");
  assert.equal(advance.periodType, "daily");

  const summaries = await db.listCashierSalarySummaries({ month: "2026-08" });
  const salarySummary = summaries.find((item) => item.accountId === cashier.id);
  assert.deepEqual({ monthlySalary: salarySummary.monthlySalary, advances: salarySummary.advances, remainingSalary: salarySummary.remainingSalary }, { monthlySalary: 1000, advances: 200, remainingSalary: 800 });
  assert.equal(summaries.find((item) => item.accountId === legacyCashier.id).remainingSalary, 0);

  const cashbox = await db.getCashbox({ from: "2026-08-15", to: "2026-08-15" });
  assert.equal(cashbox.expenses, 200);
  assert.equal(cashbox.closingBalance, -200);
  await assert.rejects(() => db.createExpense({ cashierSalaryAdvance: true, cashierId: cashier.id, amount: 900, date: "2026-08-20" }), /تتجاوز المتبقي/);
  assert.equal((await db.listExpenses()).filter((item) => item.cashierSalaryAdvance).length, 1);
  await db.resetAllData();
});

test("يستطيع الأدمن تعديل اسمه وراتبه الشهري ورمز دخوله", async () => {
  await db.resetAllData();
  const admin = await db.createAccount({ username: "profile-admin", name: "الأدمن القديم", role: "admin", pin: "2468" });
  const updated = await db.updateAccount(admin.id, { name: "الأدمن الجديد", role: "admin", isActive: true, monthlySalary: 3000 });
  assert.deepEqual({ name: updated.name, role: updated.role, monthlySalary: updated.monthlySalary }, { name: "الأدمن الجديد", role: "admin", monthlySalary: 3000 });
  await db.changeAccountPin(admin.id, "9753");
  assert.equal((await db.authenticateAccount({ username: "profile-admin", pin: "9753" })).name, "الأدمن الجديد");
  await assert.rejects(() => db.authenticateAccount({ username: "profile-admin", pin: "2468" }), /بيانات الدخول غير صحيحة/);
  const summary = (await db.listCashierSalarySummaries({ month: "2026-08" })).find((item) => item.accountId === admin.id);
  assert.equal(summary.monthlySalary, 3000);
  await db.resetAllData();
});

test("لا يظهر راتب الموظف كمصروف إلا بعد تسليمه ويُسجل الراتب الكامل عند التسليم", async () => {
  await db.resetAllData();
  const cashier = await db.createAccount({ username: "monthly-expense-cashier", name: "كاشير المصروفات", role: "cashier", pin: "3333", monthlySalary: 1200 });
  assert.deepEqual(await db.listCashierMonthlySalaryExpenses({ from: "2026-08-15", to: "2026-08-20" }), []);
  const settled = await db.settleCashierSalary({ accountId: cashier.id, month: "2026-08", date: "2026-08-20" });
  assert.equal(settled.amount, 1200);
  const rows = await db.listCashierMonthlySalaryExpenses({ from: "2026-08-15", to: "2026-08-20" });
  assert.deepEqual(rows.map((row) => ({ category: row.category, amount: row.amount, month: row.month, cashierName: row.cashierName })), [{ category: "رواتب مسلمة", amount: 1200, month: "2026-08", cashierName: "كاشير المصروفات" }]);
  assert.equal(rows[0].cashierMonthlySalary, true);
  assert.equal(rows[0].salaryPayment, true);
  const updated = await db.updateAccount(cashier.id, { name: cashier.name, role: "cashier", isActive: true, monthlySalary: 1500 });
  assert.equal(updated.monthlySalary, 1500);
  assert.equal((await db.listCashierSalarySummaries({ month: "2026-08" })).find((item) => item.accountId === cashier.id).monthlySalary, 1500);
  await db.resetAllData();
});

test("يدعم الموظف لقبًا وظيفيًا وسلفة وتسليم المتبقي من راتبه", async () => {
  await db.resetAllData();
  const employee = await db.createAccount({ username: "cleaning-employee", name: "موظف النظافة", role: "employee", jobTitle: "موظف نظافة", pin: "4444", monthlySalary: 800 });
  assert.equal(employee.role, "employee");
  assert.equal(employee.jobTitle, "موظف نظافة");
  const advance = await db.createExpense({ salaryAdvance: true, staffId: employee.id, amount: 200, date: "2026-08-15" });
  assert.equal(advance.category, "سلفة موظف");
  assert.equal(advance.staffId, employee.id);
  const summary = (await db.listCashierSalarySummaries({ month: "2026-08" })).find((item) => item.accountId === employee.id);
  assert.deepEqual({ role: summary.role, jobTitle: summary.jobTitle, remainingSalary: summary.remainingSalary, salaryDelivered: summary.salaryDelivered }, { role: "employee", jobTitle: "موظف نظافة", remainingSalary: 600, salaryDelivered: false });
  const settled = await db.settleCashierSalary({ accountId: employee.id, month: "2026-08", date: "2026-08-20" });
  assert.equal(settled.amount, 600);
  const delivered = (await db.listCashierSalarySummaries({ month: "2026-08" })).find((item) => item.accountId === employee.id);
  assert.equal(delivered.salaryDelivered, true);
  assert.equal(delivered.remainingSalary, 0);
  assert.equal((await db.listCashierMonthlySalaryExpenses({ from: "2026-08-15", to: "2026-08-20" })).find((item) => item.staffId === employee.id).amount, 800);
  await db.resetAllData();
});

test("يرحّل صندوق الكاشير إلى الخزنة مرة واحدة ويخصم العجز المرحّل من الراتب دون تكرار حركة النقد", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر الخزنة", businessType: "بقالة", currency: "YER", openingCash: 500 });
  const cashier = await db.createAccount({ username: "vault-cashier", name: "كاشير الخزنة", role: "cashier", pin: "2468", monthlySalary: 1000 });
  const product = await db.createProduct({ name: "منتج الخزنة", unit: "حبة", purchasePrice: 30, salePrice: 100, quantity: 3, minimumStock: 0 });
  const shift = await db.startCashierShift({ accountId: cashier.id, accountName: cashier.name, receivedCash: 500 });
  await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 100, paymentMethod: "نقدي", cashierShiftId: shift.id, cashierId: cashier.id, cashierName: cashier.name });
  const closed = await db.closeCashierShift({ shiftId: shift.id, countedCash: 590 });
  assert.equal(closed.difference, -10);
  const beforeTransfer = await db.getVault();
  assert.equal(beforeTransfer.cashierCashHeld, 590);
  assert.equal(beforeTransfer.vaultBalance, 0);
  assert.equal(beforeTransfer.untransferredShiftCount, 1);

  const transferred = await db.transferCashierShiftToVault({ shiftId: closed.id, transferredByAccountId: "admin" });
  assert.ok(transferred.vaultTransferredAt);
  assert.equal(transferred.vaultTransferredAmount, 590);
  const afterTransfer = await db.getVault(); const cashbox = await db.getCashbox();
  assert.equal(afterTransfer.cashierCashHeld, 0);
  assert.equal(afterTransfer.vaultBalance, 590);
  assert.equal(cashbox.closingBalance, 590);
  assert.equal((await db.listCashMovements()).filter((movement) => movement.cashierShiftId === closed.id && movement.sourceType === "CASHIER_SHORTAGE").length, 1);
  await assert.rejects(() => db.transferCashierShiftToVault({ shiftId: closed.id }), /مسبقًا/);

  const statistics = await db.listCashierShiftStatistics();
  assert.deepEqual(statistics.find((item) => item.accountId === cashier.id).shortages, 10);
  assert.deepEqual(statistics.find((item) => item.accountId === cashier.id).pendingShortages, 10);
  const candidates = await db.listCashierShortageCandidates({ accountId: cashier.id });
  assert.deepEqual(candidates.map((item) => item.id), [closed.id]);
  const deduction = await db.deductCashierShortagesFromSalary({ accountId: cashier.id, shiftIds: [closed.id] });
  assert.equal(deduction.amount, 10);
  const salary = (await db.listCashierSalarySummaries()).find((item) => item.accountId === cashier.id);
  assert.deepEqual({ deductions: salary.shortageDeductions, remaining: salary.remainingSalary }, { deductions: 10, remaining: 990 });
  assert.equal((await db.listCashierShortageCandidates({ accountId: cashier.id })).length, 0);
  await assert.rejects(() => db.createExpense({ cashierSalaryAdvance: true, cashierId: cashier.id, amount: 991, date: closed.date }), /تتجاوز المتبقي/);
  await db.resetAllData();
});

test("بيع الكرتون يخصم حباته من المخزون ويسمح للكاشير بخصم حتى 10% فقط بالقيمة أو النسبة", async () => {
  await db.resetAllData();
  const cashier = await db.createAccount({ username: "carton-cashier", name: "كاشير الكرتون", role: "cashier", pin: "1357" });
  const cartonProduct = await db.createProduct({ name: "مشروب كرتون", unit: "حبة", purchasePrice: 50, salePrice: 100, quantity: 0, minimumStock: 0 });
  await db.createPurchase({ items: [{ productId: cartonProduct.id, packageQuantity: 1, unitsPerPackage: 12, packageCost: 600, packageUnit: "كرتون", salePrice: 100 }] });
  const storedProduct = await db.getProduct(cartonProduct.id);
  assert.deepEqual({ quantity: storedProduct.quantity, package: storedProduct.purchasePackageUnit, units: storedProduct.unitsPerPackage }, { quantity: 12, package: "كرتون", units: 12 });

  const cartonSale = await db.completeSale({ items: [{ productId: cartonProduct.id, quantity: 12, discount: "10%", soldAsPackage: true, packageUnit: "كرتون", unitsPerPackage: 12 }], discount: "", paidAmount: 1080, paymentMethod: "نقدي", cashierId: cashier.id, cashierName: cashier.name, sellerRole: "cashier" });
  const cartonInvoice = await db.getInvoice(cartonSale.id);
  assert.deepEqual({ subtotal: cartonSale.subtotal, discount: cartonSale.discount, total: cartonSale.total }, { subtotal: 1200, discount: 120, total: 1080 });
  assert.deepEqual({ quantity: cartonInvoice.items[0].quantity, soldAsPackage: cartonInvoice.items[0].soldAsPackage, packageQuantity: cartonInvoice.items[0].packageQuantity, unitsPerPackage: cartonInvoice.items[0].unitsPerPackage, packageUnit: cartonInvoice.items[0].packageUnit }, { quantity: 12, soldAsPackage: true, packageQuantity: 1, unitsPerPackage: 12, packageUnit: "كرتون" });
  assert.equal((await db.getProduct(cartonProduct.id)).quantity, 0);

  const cappedProduct = await db.createProduct({ name: "منتج سقف الخصم", unit: "حبة", purchasePrice: 30, salePrice: 100, quantity: 10, minimumStock: 0 });
  await assert.rejects(() => db.completeSale({ items: [{ productId: cappedProduct.id, quantity: 1, discount: "11%" }], discount: "", paidAmount: 89, paymentMethod: "نقدي", cashierId: cashier.id, sellerRole: "cashier" }), /أقصى خصم للكاشير هو 10%/);
  await assert.rejects(() => db.completeSale({ items: [{ productId: cappedProduct.id, quantity: 1, discount: "101" }], discount: "", paidAmount: 0, paymentMethod: "نقدي", cashierId: cashier.id, sellerRole: "cashier" }), /أقصى خصم للكاشير هو 10%/);
  const adminSale = await db.completeSale({ items: [{ productId: cappedProduct.id, quantity: 1, discount: "20%" }], discount: "", paidAmount: 80, paymentMethod: "نقدي", sellerRole: "admin" });
  assert.equal(adminSale.total, 80);

  await db.saveSettings({ cashierDiscountLimitPercent: 15 });
  assert.equal((await db.getSettings()).cashierDiscountLimitPercent, 15);
  const raisedLimitSale = await db.completeSale({ items: [{ productId: cappedProduct.id, quantity: 1, discount: "15%" }], discount: "", paidAmount: 85, paymentMethod: "نقدي", cashierId: cashier.id, sellerRole: "cashier" });
  assert.equal(raisedLimitSale.total, 85);
  await db.saveSettings({ cashierDiscountLimitPercent: 150 });
  assert.equal((await db.getSettings()).cashierDiscountLimitPercent, 100);
  await db.resetAllData();
});

test("توريد الحوالة الواردة للخزنة يدعم الجزء المتبقي ولا يكرر التحصيل أو يتجاوز مصدره", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر توريد التحويل", businessType: "بقالة", currency: "YER", openingCash: 0 });
  const product = await db.createProduct({ name: "منتج تحويل وارد", unit: "حبة", purchasePrice: 80, salePrice: 200, quantity: 2, minimumStock: 0 });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], discount: 0, paidAmount: 200, paymentMethod: "تحويل", sellerRole: "admin" });
  const beforeDeposit = await db.getCashbox();
  assert.deepEqual({ transferIncoming: beforeDeposit.transferIncoming, deposits: beforeDeposit.deposits, closing: beforeDeposit.closingBalance }, { transferIncoming: 200, deposits: 0, closing: 0 });

  const firstDeposit = await db.depositIncomingTransferToVault({ sourceType: "SALE_TRANSFER", sourceId: sale.id, amount: 75, date: "2026-08-27", notes: "توريد جزئي" });
  assert.deepEqual({ amount: firstDeposit.amount, depositedBefore: firstDeposit.depositedBefore, remainingAfter: firstDeposit.remainingAfter }, { amount: 75, depositedBefore: 0, remainingAfter: 125 });
  const middleCashbox = await db.getCashbox();
  assert.deepEqual({ transferIncoming: middleCashbox.transferIncoming, deposits: middleCashbox.deposits, closing: middleCashbox.closingBalance }, { transferIncoming: 200, deposits: 75, closing: 75 });

  await assert.rejects(() => db.depositIncomingTransferToVault({ sourceType: "SALE_TRANSFER", sourceId: sale.id, amount: 126 }), /أكبر من المتبقي/);
  const finalDeposit = await db.depositIncomingTransferToVault({ sourceType: "SALE_TRANSFER", sourceId: sale.id, amount: 125, date: "2026-08-28" });
  assert.equal(finalDeposit.remainingAfter, 0);
  const vault = await db.getVault(); const cashbox = await db.getCashbox(); const deposits = await db.listTransferVaultDeposits();
  assert.equal(vault.vaultBalance, 200);
  assert.deepEqual({ transferIncoming: cashbox.transferIncoming, deposits: cashbox.deposits, closing: cashbox.closingBalance }, { transferIncoming: 200, deposits: 200, closing: 200 });
  assert.deepEqual(deposits.map((item) => item.amount), [125, 75]);
  await assert.rejects(() => db.depositIncomingTransferToVault({ sourceType: "SALE_TRANSFER", sourceId: sale.id, amount: 1 }), /أكبر من المتبقي/);
  await db.resetAllData();
});

test("الجرد الدوري يحفظ لقطة محاسبية شهرية ونصف سنوية وسنوية بلا حركة نقدية أو تغيير للمخزون", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر الجرد", businessType: "بقالة", currency: "YER", openingCash: 0 });
  const sellable = await db.createProduct({ name: "منتج جرد", unit: "حبة", purchasePrice: 40, salePrice: 100, quantity: 10, minimumStock: 0 });
  const supplyProduct = await db.createProduct({ name: "منتج مستحق", unit: "حبة", purchasePrice: 60, salePrice: 90, quantity: 0, minimumStock: 0 });
  const customer = await db.createCustomer({ name: "عميل الجرد" });
  const supplier = await db.createSupplier({ name: "مورد الجرد" });
  await db.completeSale({ items: [{ productId: sellable.id, quantity: 2 }], discount: 0, paidAmount: 200, paymentMethod: "نقدي", sellerRole: "admin" });
  await db.completeSale({ items: [{ productId: sellable.id, quantity: 1 }], discount: 0, paidAmount: 0, paymentMethod: "نقدي", paymentType: "آجل", customerId: customer.id, sellerRole: "admin" });
  await db.completeSale({ items: [{ productId: sellable.id, quantity: 1 }], discount: 0, paidAmount: 100, paymentMethod: "تحويل", sellerRole: "admin" });
  await db.createPurchase({ supplierId: supplier.id, paymentType: "آجل", paymentMethod: "نقدي", items: [{ productId: supplyProduct.id, packageQuantity: 1, unitsPerPackage: 1, packageCost: 60, packageUnit: "حبة", salePrice: 90 }] });
  await db.createExpense({ amount: 30, category: "مواصلات", description: "مصروف اختبار", date: new Date().toISOString().slice(0, 10) });

  const today = new Date().toISOString().slice(0, 10);
  const monthFrom = `${today.slice(0, 7)}-01`;
  const summary = await db.getPeriodicInventorySummary({ from: monthFrom, to: today });
  assert.deepEqual({ inventory: summary.inventory.cost, vault: summary.cash.vaultBalance, customerDebt: summary.receivables.customerDebt, supplierPayables: summary.payables.supplierPayables, transferNotDeposited: summary.transfers.incomingNotDeposited }, { inventory: 300, vault: 170, customerDebt: 100, supplierPayables: 60, transferNotDeposited: 100 });
  assert.deepEqual({ sales: summary.performance.sales, cost: summary.performance.costOfGoods, gross: summary.performance.grossProfit, expenses: summary.performance.expenses, net: summary.performance.netProfit }, { sales: 400, cost: 160, gross: 240, expenses: 30, net: 210 });
  assert.deepEqual(summary.damage, { amount: 0, count: 0, status: "not-recorded", source: "لا يوجد في التطبيق سجل مستقل للتالف؛ لا يحوّل جرد الكميات أو التعديلات العادية إلى تالف تلقائيًا." });
  assert.equal(summary.netPosition, 610);

  const beforeQuantity = (await db.getProduct(sellable.id)).quantity;
  const beforeVault = (await db.getVault()).vaultBalance;
  const beforeMovementCount = (await db.listCashMovements()).length;
  const monthly = await db.createPeriodicInventory({ cycle: "monthly", from: monthFrom, to: today, notes: "إقفال شهر الاختبار", approvedByAccountId: "admin-test", approvedByName: "مدير الجرد" });
  const semiannual = await db.createPeriodicInventory({ cycle: "semiannual", from: `${today.slice(0, 4)}-01-01`, to: today });
  const annual = await db.createPeriodicInventory({ cycle: "annual", from: `${today.slice(0, 4)}-01-01`, to: today });
  assert.equal(monthly.metrics.performance.netProfit, 210);
  assert.equal(monthly.metrics.period.from, monthFrom);
  assert.equal(semiannual.cycle, "semiannual");
  assert.equal(annual.cycle, "annual");
  assert.equal((await db.getProduct(sellable.id)).quantity, beforeQuantity);
  assert.equal((await db.getVault()).vaultBalance, beforeVault);
  assert.equal((await db.listCashMovements()).length, beforeMovementCount);

  const revisedMonthly = await db.createPeriodicInventory({ cycle: "monthly", from: monthFrom, to: today });
  assert.equal(revisedMonthly.comparison.previousAuditId, monthly.id);
  assert.equal(revisedMonthly.comparison.netProfitDelta, 0);
  assert.equal((await db.listPeriodicInventories()).length, 4);
  const backup = await db.exportBackup();
  assert.equal(backup.databaseVersion, 13);
  assert.equal(backup.stores.periodicInventories.length, 4);
  await db.resetAllData();
  await db.restoreBackup(backup);
  assert.equal((await db.listPeriodicInventories()).length, 4);
  await assert.rejects(() => db.createPeriodicInventory({ cycle: "quarterly", from: monthFrom, to: today }), /نوع دورة الجرد غير صالح/);
  await db.resetAllData();
});

test("يحفظ شعار المتجر محليًا ضمن النسخة الاحتياطية ويرفض البيانات غير الآمنة", async () => {
  await db.resetAllData();
  await db.saveSettings({ storeName: "متجر الشعار", businessType: "بقالة", currency: "YER" });
  const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLpbAAAAABJRU5ErkJggg==";
  await db.saveStoreLogoDataUrl(logo);
  assert.equal((await db.getSettings()).storeLogoDataUrl, logo);
  const backup = await db.exportBackup();
  assert.equal(backup.stores.settings[0].storeLogoDataUrl, logo);
  await db.resetAllData();
  await db.restoreBackup(backup);
  assert.equal((await db.getSettings()).storeLogoDataUrl, logo);
  await assert.rejects(() => db.saveStoreLogoDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), /غير صالح/);
  await assert.rejects(() => db.saveStoreLogoDataUrl(`data:image/png;base64,${"A".repeat(620_001)}`), /غير صالح/);
  await db.resetAllData();
});

test("يفصل تكلفة الكمية القديمة عن الدفعة الجديدة عند البيع والجرد", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج دفعات مختلفة", unit: "حبة", purchasePrice: 10, salePrice: 30, quantity: 10, minimumStock: 0 });
  await db.createPurchase({ items: [{ productId: product.id, packageQuantity: 1, unitsPerPackage: 10, packageCost: 200, packageUnit: "كرتون", salePrice: 35 }] });
  const sale = await db.completeSale({ items: [{ productId: product.id, quantity: 12 }], discount: 0, paidAmount: 420, paymentMethod: "نقدي" });
  const invoice = await db.getInvoice(sale.id);
  assert.equal(invoice.items[0].costTotal, 140);
  assert.equal((await db.getDashboard()).inventoryValue, 160);
  await db.resetAllData();
});

test("يفرض سقف المديونية العام مع إمكانية تخصيص سقف أعلى للعميل", async () => {
  await db.resetAllData();
  await db.saveSettings({ customerCreditLimit: 100 });
  const product = await db.createProduct({ name: "منتج سقف الدين", unit: "حبة", purchasePrice: 10, salePrice: 80, quantity: 5, minimumStock: 0 });
  const customer = await db.createCustomer({ name: "عميل بسقف عام" });
  await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], paymentType: "آجل", customerId: customer.id });
  await assert.rejects(() => db.completeSale({ items: [{ productId: product.id, quantity: 1 }], paymentType: "آجل", customerId: customer.id }), /سقف مديونية/);
  await db.updateCustomer(customer.id, { name: customer.name, creditLimit: 200 });
  const allowed = await db.completeSale({ items: [{ productId: product.id, quantity: 1 }], paymentType: "آجل", customerId: customer.id });
  assert.equal(allowed.total, 80);
  await db.resetAllData();
});

test("يحتفظ مخزن النسخ المحلية بآخر ثلاث نسخ فقط ولا يدخلها في النسخة المصدرة", async () => {
  await db.resetAllData();
  await db.createLocalBackup();
  await db.createLocalBackup();
  await db.createLocalBackup();
  await db.createLocalBackup();
  assert.equal((await db.listLocalBackups()).length, 3);
  const exported = await db.exportBackup();
  assert.equal(exported.stores.localBackups, undefined);
  await db.resetAllData();
});

test("فاتورة الشراء تسمح بدفع جزء من المبلغ وتضيف المتبقي إلى رصيد المورد", async () => {
  await db.resetAllData();
  const product = await db.createProduct({ name: "منتج شراء جزئي", unit: "حبة", purchasePrice: 0, salePrice: 150, quantity: 0, minimumStock: 0 });
  const supplier = await db.createSupplier({ name: "مورد شراء جزئي" });
  const purchase = await db.createPurchase({ supplierId: supplier.id, paymentType: "نقدي", paymentMethod: "نقدي", paidAmount: 40, items: [{ productId: product.id, packageQuantity: 1, unitsPerPackage: 1, packageCost: 100, packageUnit: "حبة", salePrice: 150 }] });
  const saved = await db.getPurchase(purchase.id);
  const account = await db.getSupplierAccount(supplier.id);
  assert.equal(saved.total, 100);
  assert.equal(saved.paidAmount, 40);
  assert.equal(saved.remainingAmount, 60);
  assert.equal(saved.paymentType, "آجل");
  assert.equal(account.balance, 60);
  await db.resetAllData();
});

test("ينشئ حساب الكاشير بصلاحيات افتراضية مبيعات وفواتيرها فقط ويتيح تعديلها بمفاتيح التبديل", async () => {
  await db.resetAllData();
  const defaultCashier = await db.createAccount({
    username: "pos-cashier",
    name: "كاشير المبيعات فقط",
    role: "cashier",
    pin: "1234",
  });
  assert.deepEqual(defaultCashier.allowedViews, ["sales", "invoices"]);

  const customCashier = await db.createAccount({
    username: "custom-cashier",
    name: "كاشير مخصص",
    role: "cashier",
    pin: "5678",
    allowedViews: ["sales", "invoices", "products", "inventory"],
  });
  assert.deepEqual(customCashier.allowedViews, ["sales", "invoices", "products", "inventory"]);

  const updatedCashier = await db.updateAccount(defaultCashier.id, {
    allowedViews: ["sales", "invoices", "customers"],
  });
  assert.deepEqual(updatedCashier.allowedViews, ["sales", "invoices", "customers"]);

  const fetched = (await db.listAccounts()).find((a) => a.id === defaultCashier.id);
  assert.deepEqual(fetched.allowedViews, ["sales", "invoices", "customers"]);

  await db.resetAllData();
});
