/* اتجاه التصميم: دفتر التاجر الهادئ — حسابات مالية ومخزنية صريحة قابلة للاختبار. */
export const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100;
export const invoiceNumber = (sequence) => `INV-${String(sequence).padStart(6, "0")}`;
export const purchaseNumber = (sequence) => `PUR-${String(sequence).padStart(6, "0")}`;
export const saleReturnNumber = (sequence) => `SRT-${String(sequence).padStart(6, "0")}`;
export const purchaseReturnNumber = (sequence) => `PRT-${String(sequence).padStart(6, "0")}`;

export const stockStatus = (quantity, minimumStock) => {
  if (toNumber(quantity) <= 0) return "نافد";
  if (toNumber(quantity) <= toNumber(minimumStock)) return "منخفض";
  return "متوفر";
};

export const canSell = (available, requested) => toNumber(requested) > 0 && toNumber(requested) <= toNumber(available);
export const canReturn = (original, alreadyReturned, requested) => toNumber(requested) > 0 && toNumber(requested) <= toNumber(original) - toNumber(alreadyReturned);
export const adjustmentDelta = (previousQuantity, newQuantity) => toNumber(newQuantity) - toNumber(previousQuantity);

export const calculateDiscountAmount = (value, base = 0) => {
  const raw = String(value ?? "").trim().replace(/٪/g, "%");
  const subtotal = Math.max(0, toNumber(base));
  if (!raw) return 0;
  const percentage = raw.endsWith("%") ? toNumber(raw.slice(0, -1)) : null;
  const amount = percentage === null ? toNumber(raw.replace(/,/g, "")) : subtotal * Math.max(0, percentage) / 100;
  return roundMoney(Math.min(Math.max(amount, 0), subtotal));
};

export const normalizeCashierDiscountLimit = (value, fallback = 10) => {
  const raw = String(value ?? "").trim().replace(/٪/g, "%").replace(/%$/, "");
  if (!raw) return roundMoney(fallback);
  return roundMoney(Math.min(100, Math.max(0, toNumber(raw))));
};

export const calculateSaleTotals = (items, discount = 0) => {
  const lines = items.map((item) => {
    const lineSubtotal = roundMoney(toNumber(item.unitPrice) * toNumber(item.quantity));
    const lineDiscount = calculateDiscountAmount(item.discount, lineSubtotal);
    return { ...item, lineSubtotal, discount: lineDiscount, total: roundMoney(lineSubtotal - lineDiscount) };
  });
  const subtotal = roundMoney(lines.reduce((sum, item) => sum + item.lineSubtotal, 0));
  const lineDiscount = roundMoney(lines.reduce((sum, item) => sum + item.discount, 0));
  const generalDiscount = calculateDiscountAmount(discount, roundMoney(subtotal - lineDiscount));
  return { subtotal, lineDiscount, generalDiscount, discount: roundMoney(lineDiscount + generalDiscount), total: roundMoney(subtotal - lineDiscount - generalDiscount), lines };
};

export const calculatePackagePurchase = ({ packageQuantity = 1, unitsPerPackage = 1, packageCost = 0 } = {}) => {
  const packages = Math.max(0, toNumber(packageQuantity));
  const units = Math.max(0, toNumber(unitsPerPackage));
  const cost = Math.max(0, toNumber(packageCost));
  const quantity = packages * units;
  return { packageQuantity: packages, unitsPerPackage: units, packageCost: cost, quantity, unitCost: units ? cost / units : 0, total: roundMoney(packages * cost) };
};

export const calculatePurchaseTotals = (items) => roundMoney(items.reduce((sum, item) => sum + (item.total === undefined ? toNumber(item.unitCost) * toNumber(item.quantity) : toNumber(item.total)), 0));

export const remainingAmount = (total, paid) => roundMoney(Math.max(0, toNumber(total) - Math.min(Math.max(0, toNumber(paid)), toNumber(total))));
export const paymentStatus = (total, paid) => {
  const remaining = remainingAmount(total, paid);
  if (remaining === 0) return "مدفوعة";
  return toNumber(paid) > 0 ? "مدفوعة جزئيًا" : "غير مدفوعة";
};
export const canRegisterPayment = (balance, paid) => toNumber(paid) > 0 && toNumber(paid) <= toNumber(balance);

export const calculateCashBalance = ({
  openingBalance = 0,
  cashSales = 0,
  customerPayments = 0,
  purchaseReturns = 0,
  deposits = 0,
  saleReturns = 0,
  cashPurchases = 0,
  supplierPayments = 0,
  expenses = 0,
  withdrawals = 0,
} = {}) => {
  const inflows = roundMoney(toNumber(openingBalance) + toNumber(cashSales) + toNumber(customerPayments) + toNumber(purchaseReturns) + toNumber(deposits));
  const outflows = roundMoney(toNumber(saleReturns) + toNumber(cashPurchases) + toNumber(supplierPayments) + toNumber(expenses) + toNumber(withdrawals));
  return { inflows, outflows, closingBalance: roundMoney(inflows - outflows) };
};

/** يلخّص التحصيلات المسجلة عبر التحويل فقط، منفصلًا عن رصيد الصندوق النقدي. */
export const calculateTransferCollections = ({ sales = [], customerPayments = [] } = {}) => {
  const transferSales = sales.filter((item) => item.paymentMethod === "تحويل");
  const transferDebtPayments = customerPayments.filter((item) => item.paymentMethod === "تحويل");
  const salesAmount = roundMoney(transferSales.reduce((sum, item) => sum + toNumber(item.initialPaidAmount ?? item.paidAmount), 0));
  const debtPaymentsAmount = roundMoney(transferDebtPayments.reduce((sum, item) => sum + toNumber(item.amount), 0));
  return {
    salesAmount,
    debtPaymentsAmount,
    total: roundMoney(salesAmount + debtPaymentsAmount),
    count: transferSales.length + transferDebtPayments.length,
  };
};

export const calculateProfit = ({ sales = 0, costOfGoods = 0, expenses = 0, salesReturns = 0, returnCosts = 0 }) => {
  const netSales = roundMoney(toNumber(sales) - toNumber(salesReturns));
  const netCostOfGoods = roundMoney(toNumber(costOfGoods) - toNumber(returnCosts));
  const grossProfit = roundMoney(netSales - netCostOfGoods);
  return { netSales, netCostOfGoods, grossProfit, netProfit: roundMoney(grossProfit - toNumber(expenses)) };
};

export const dateKey = (date = new Date()) => {
  const local = new Date(date);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
};

export const isWithinDateRange = (value, from, to) => {
  const key = dateKey(value);
  return (!from || key >= from) && (!to || key <= to);
};

export const normalizeCreditLimit = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return Math.max(0, toNumber(fallback));
  return Math.max(0, toNumber(value));
};

export const expiryProgress = ({ productionDate = "", expiryDate = "", today = dateKey() } = {}) => {
  const production = String(productionDate || "");
  const expiry = String(expiryDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(production) || !/^\d{4}-\d{2}-\d{2}$/.test(expiry) || expiry <= production) return null;
  const asDay = (value) => Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
  const totalDays = Math.max(1, Math.round((asDay(expiry) - asDay(production)) / 86400000));
  const elapsedDays = Math.round((asDay(String(today)) - asDay(production)) / 86400000);
  return { totalDays, elapsedDays, ratio: elapsedDays / totalDays, remainingDays: totalDays - elapsedDays };
};

/** يحسب الحصة المعترف بها من مصروف شهري في فترة محددة، دون إدخال الشهر نفسه مرتين. */
export const calculateMonthlyExpenseAllocation = ({ amount = 0, date = dateKey(), from = "", to = "" } = {}) => {
  const month = String(date || dateKey()).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return 0;
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const rangeStart = from && from > monthStart ? from : monthStart;
  const rangeEnd = to && to < monthEnd ? to : monthEnd;
  if (rangeStart > rangeEnd) return 0;
  const asDay = (key) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  const coveredDays = Math.round((asDay(rangeEnd) - asDay(rangeStart)) / 86400000) + 1;
  return roundMoney(Math.max(0, toNumber(amount)) * coveredDays / daysInMonth);
};

export const nowIso = () => new Date().toISOString();
