/* كتالوج التقارير المرحّل من hesabi-hybrid-reports إلى Hesabi، مع أعمدة تفصيلية تعتمد على البيانات المحلية. */
export const APK_REPORT_TYPES = [
  ["itemBalance", "أرصدة المخزون"],
  ["itemMovement", "حركة الأصناف"],
  ["revenueItem", "المبيعات حسب الصنف"],
  ["revenueCustomer", "المبيعات حسب العميل"],
  ["dailyDocuments", "الوثائق اليومية"],
  ["dailyTransactions", "العمليات اليومية"],
  ["moneyBalance", "حركة الصندوق"],
  ["accountsTotal", "إجمالي الحسابات"],
  ["accountBalance", "أرصدة الحسابات"],
  ["currency", "حركة العملات والتحويلات"],
];

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const text = (value, fallback = "—") => String(value ?? "").trim() || fallback;
const money = (helpers, value) => helpers.money(value);
const amount = (helpers, value) => helpers.amount(value);
const date = (helpers, value) => helpers.dateTime(value);
const dateOnly = (value) => String(value || "").slice(0, 10);
const inRange = (value, from, to) => {
  const key = dateOnly(value);
  return (!from || key >= from) && (!to || key <= to);
};
const percent = (value) => `${n(value).toFixed(2)}%`;
const sum = (items, getter) => items.reduce((total, item) => total + n(getter(item)), 0);
const isInflow = (item) => ["DEPOSIT", "INFLOW", "inflow"].includes(item?.type) || item?.sourceType === "SALE_TRANSFER" || item?.sourceType === "CUSTOMER_PAYMENT_TRANSFER";

function productLookup(state) {
  return new Map((state.products || []).map((product) => [product.id, product]));
}

function salesContext(state, from, to) {
  const sales = (state.sales || []).filter((item) => inRange(item.date, from, to));
  const saleIds = new Set(sales.map((item) => item.id));
  const saleItems = (state.saleItems || []).filter((item) => saleIds.has(item.saleId));
  return { sales, saleItems };
}

export function getApkReportRows(type, state, helpers) {
  const from = state.reportFrom || "";
  const to = state.reportTo || "";
  const productsById = productLookup(state);
  const { sales, saleItems } = salesContext(state, from, to);
  const purchases = (state.purchases || []).filter((item) => inRange(item.date, from, to));
  const purchaseIds = new Set(purchases.map((item) => item.id));
  const purchaseItems = (state.purchaseItems || []).filter((item) => purchaseIds.has(item.purchaseId));
  const saleById = new Map(sales.map((item) => [item.id, item]));

  if (type === "itemBalance") {
    return [["الكود الداخلي", "الباركود", "اسم الصنف", "الفئة", "الوحدة", "الكمية الحالية", "الحد الأدنى", "حالة المخزون", "سعر الشراء", "سعر البيع", "قيمة المخزون", "تاريخ أقرب انتهاء", "آخر مورد", "آخر توريد"], ...(state.products || []).filter((item) => !item.isDeleted).map((item) => [
      text(item.internalCode), text(item.barcode), text(item.name), text(item.category), text(item.unit, "حبة"), `${amount(helpers, item.quantity)} ${text(item.unit, "حبة")}`,
      amount(helpers, item.minimumStock), helpers.stockStatus ? helpers.stockStatus(item.quantity, item.minimumStock) : text(item.quantity <= item.minimumStock ? "منخفض" : "متاح"), money(helpers, item.purchasePrice), money(helpers, item.salePrice), money(helpers, n(item.quantity) * n(item.purchasePrice)),
      text(item.nearestExpiryDate), text(item.lastSupplierName || item.lastSupplierId), text(item.lastSupplierAt),
    ])];
  }

  if (type === "itemMovement") {
    return [["التاريخ والوقت", "اسم الصنف", "الكود / الباركود", "نوع الحركة", "الكمية", "الرصيد قبل الحركة", "الرصيد بعد الحركة", "البيان", "نوع المرجع", "رقم المرجع"], ...(state.stockMovements || []).filter((item) => inRange(item.date, from, to)).map((item) => {
      const product = productsById.get(item.productId);
      return [date(helpers, item.date), text(product?.name || item.productName, "صنف محذوف"), text(product?.internalCode || product?.barcode), text(item.type || item.reason, "حركة مخزون"), amount(helpers, item.quantity ?? item.delta), amount(helpers, item.previousQuantity), amount(helpers, item.newQuantity), text(item.note || item.notes), text(item.referenceType), text(item.referenceId)];
    })];
  }

  if (type === "revenueItem") {
    const totals = new Map();
    saleItems.forEach((item) => {
      const product = productsById.get(item.productId);
      const key = item.productId || item.productName || "غير محدد";
      const row = totals.get(key) || { name: item.productName || product?.name || "غير محدد", barcode: product?.barcode || "", unit: item.unit || product?.unit || "حبة", invoices: new Set(), quantity: 0, gross: 0, discounts: 0, cost: 0 };
      const sale = saleById.get(item.saleId);
      row.invoices.add(item.saleId); row.quantity += n(item.quantity); row.gross += n(item.unitPrice) * n(item.quantity); row.discounts += n(item.discount); row.cost += n(item.costTotal ?? n(item.unitCost) * n(item.quantity));
      if (sale && n(item.total) === 0) row.gross += n(item.total);
      totals.set(key, row);
    });
    return [["الكود / الباركود", "الصنف", "الوحدة", "عدد الفواتير", "الكمية المباعة", "إجمالي قبل الخصم", "الخصومات", "صافي المبيعات", "تكلفة البضاعة", "مجمل الربح", "هامش الربح", "متوسط سعر البيع"], ...Array.from(totals.values()).map((row) => {
      const net = row.gross - row.discounts; const profit = net - row.cost;
      return [text(row.barcode), row.name, row.unit, String(row.invoices.size), amount(helpers, row.quantity), money(helpers, row.gross), money(helpers, row.discounts), money(helpers, net), money(helpers, row.cost), money(helpers, profit), percent(net ? profit / net * 100 : 0), money(helpers, row.quantity ? net / row.quantity : 0)];
    })];
  }

  if (type === "revenueCustomer") {
    const totals = new Map();
    sales.forEach((sale) => {
      const key = sale.customerId || sale.customerName || "cash";
      const row = totals.get(key) || { name: sale.customerName || "عميل نقدي", phone: sale.customerPhone || "", invoices: 0, gross: 0, discounts: 0, paid: 0, credit: 0 };
      const total = n(sale.total); const paid = n(sale.paidAmount ?? sale.initialPaidAmount); row.invoices += 1; row.gross += total + n(sale.discount); row.discounts += n(sale.discount); row.paid += paid; row.credit += Math.max(0, n(sale.remainingAmount ?? total - paid)); totals.set(key, row);
    });
    return [["العميل", "الهاتف", "عدد الفواتير", "إجمالي قبل الخصم", "الخصومات", "صافي المبيعات", "المدفوع", "الآجل / المتبقي", "متوسط الفاتورة"], ...Array.from(totals.values()).map((row) => { const net = row.gross - row.discounts; return [row.name, text(row.phone), String(row.invoices), money(helpers, row.gross), money(helpers, row.discounts), money(helpers, net), money(helpers, row.paid), money(helpers, row.credit), money(helpers, row.invoices ? net / row.invoices : 0)]; })];
  }

  if (type === "dailyDocuments") {
    const expenses = (state.expenses || []).filter((item) => inRange(item.date, from, to));
    const days = new Set([...sales, ...purchases, ...expenses].map((item) => dateOnly(item.date)).filter(Boolean));
    return [["التاريخ", "فواتير البيع", "قيمة البيع", "فواتير الشراء", "قيمة الشراء", "المصروفات", "صافي النشاط", "متوسط بيع الفاتورة"], ...Array.from(days).sort().map((day) => {
      const dailySales = sales.filter((item) => dateOnly(item.date) === day); const dailyPurchases = purchases.filter((item) => dateOnly(item.date) === day); const dailyExpenses = expenses.filter((item) => dateOnly(item.date) === day); const salesTotal = sum(dailySales, (item) => item.total); const purchaseTotal = sum(dailyPurchases, (item) => item.total); const expenseTotal = sum(dailyExpenses, (item) => item.recognizedAmount ?? item.amount);
      return [day, String(dailySales.length), money(helpers, salesTotal), String(dailyPurchases.length), money(helpers, purchaseTotal), money(helpers, expenseTotal), money(helpers, salesTotal - purchaseTotal - expenseTotal), money(helpers, dailySales.length ? salesTotal / dailySales.length : 0)];
    })];
  }

  if (type === "dailyTransactions") {
    const events = [
      ...sales.map((item) => ({ date: item.date, type: "بيع", description: `فاتورة بيع ${text(item.invoiceNumber)}`, reference: item.invoiceNumber, person: item.customerName || "عميل نقدي", method: item.paymentMethod || "—", inflow: n(item.paidAmount ?? item.initialPaidAmount), outflow: 0 })),
      ...purchases.map((item) => ({ date: item.date, type: "شراء", description: `فاتورة شراء ${text(item.invoiceNumber)}`, reference: item.invoiceNumber, person: item.supplierName || "بدون مورد", method: item.paymentMethod || "—", inflow: 0, outflow: n(item.paidAmount ?? item.initialPaidAmount) })),
      ...(state.customerPayments || []).filter((item) => inRange(item.date, from, to)).map((item) => ({ date: item.date, type: "تحصيل عميل", description: text(item.notes || item.invoiceNumber, "دفعة عميل"), reference: item.invoiceNumber, person: item.customerName, method: item.paymentMethod || "—", inflow: n(item.amount), outflow: 0 })),
      ...(state.supplierPayments || []).filter((item) => inRange(item.date, from, to)).map((item) => ({ date: item.date, type: "سداد مورد", description: text(item.notes || item.invoiceNumber, "دفعة مورد"), reference: item.invoiceNumber, person: item.supplierName, method: item.paymentMethod || "—", inflow: 0, outflow: n(item.amount) })),
      ...(state.cashMovements || []).filter((item) => inRange(item.date, from, to)).map((item) => ({ date: item.date, type: "حركة صندوق", description: text(item.notes, "حركة صندوق"), reference: item.referenceId, person: "الصندوق", method: item.paymentMethod || "—", inflow: isInflow(item) ? n(item.amount) : 0, outflow: isInflow(item) ? 0 : n(item.amount) })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    return [["التاريخ والوقت", "نوع العملية", "البيان", "رقم المرجع", "الطرف المرتبط", "طريقة الدفع", "وارد", "صادر", "الصافي"], ...events.map((item) => [date(helpers, item.date), item.type, item.description, text(item.reference), text(item.person), item.method, money(helpers, item.inflow), money(helpers, item.outflow), money(helpers, item.inflow - item.outflow)])];
  }

  if (type === "moneyBalance") {
    const movements = (state.cashMovements || []).filter((item) => inRange(item.date, from, to)).sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = n(state.cashbox?.openingBalance);
    return [["التاريخ والوقت", "مصدر الحركة", "البيان", "وارد", "صادر", "الصافي", "الرصيد التراكمي", "نوع المرجع", "رقم المرجع"], ...movements.map((item) => { const inflow = isInflow(item) ? n(item.amount) : 0; const outflow = inflow ? 0 : n(item.amount); running += inflow - outflow; return [date(helpers, item.date), text(item.sourceType, "الصندوق"), text(item.notes, "حركة صندوق"), money(helpers, inflow), money(helpers, outflow), money(helpers, inflow - outflow), money(helpers, running), text(item.referenceType), text(item.referenceId)]; }), ["", "", "الرصيد الختامي", "", "", "", money(helpers, state.cashbox?.closingBalance), "", ""]];
  }

  if (type === "accountsTotal") {
    const customers = state.customers || []; const suppliers = state.suppliers || []; const customerBalance = sum(customers, (item) => item.balance); const supplierBalance = sum(suppliers, (item) => item.balance);
    return [["نوع الحساب", "عدد الحسابات", "إجمالي الرصيد", "أرصدة مدينة", "أرصدة دائنة"], ["العملاء", String(customers.length), money(helpers, customerBalance), money(helpers, customers.filter((item) => n(item.balance) > 0).reduce((total, item) => total + n(item.balance), 0)), money(helpers, customers.filter((item) => n(item.balance) < 0).reduce((total, item) => total + Math.abs(n(item.balance)), 0))], ["الموردون", String(suppliers.length), money(helpers, supplierBalance), money(helpers, suppliers.filter((item) => n(item.balance) > 0).reduce((total, item) => total + n(item.balance), 0)), money(helpers, suppliers.filter((item) => n(item.balance) < 0).reduce((total, item) => total + Math.abs(n(item.balance)), 0))], ["الإجمالي", String(customers.length + suppliers.length), money(helpers, customerBalance + supplierBalance), "", ""]];
  }

  if (type === "accountBalance") {
    return [["نوع الحساب", "اسم الحساب", "الهاتف", "العنوان", "الرصيد", "حالة الحساب"], ...(state.customers || []).map((item) => ["عميل", text(item.name), text(item.phone), text(item.address), money(helpers, item.balance), n(item.balance) > 0 ? "له رصيد مستحق" : n(item.balance) < 0 ? "رصيده دائن" : "متزن"]), ...(state.suppliers || []).map((item) => ["مورد", text(item.name), text(item.phone), text(item.address), money(helpers, item.balance), n(item.balance) > 0 ? "مستحق له" : n(item.balance) < 0 ? "عليه رصيد" : "متزن"] )];
  }

  if (type === "currency") {
    return [["التاريخ والوقت", "نوع الحركة", "المصدر", "البيان", "المبلغ", "نوع المرجع", "رقم المرجع"], ...(state.transferVaultDeposits || []).filter((item) => inRange(item.date, from, to)).map((item) => [date(helpers, item.date), "تحويل", text(item.sourceType, "الصندوق إلى الخزينة"), text(item.notes, "تحويل نقدي"), money(helpers, item.amount), text(item.referenceType), text(item.referenceId)])];
  }
  return null;
}
