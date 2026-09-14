import * as XLSX from "xlsx";

const normalizeHeader = (value) => String(value ?? "").trim().toLocaleLowerCase("ar").replace(/[\s_-]+/g, "");
const aliases = {
  name: ["name", "product", "productname", "item", "اسم", "اسم المنتج", "الصنف", "المنتج"],
  barcode: ["barcode", "bar code", "ean", "upc", "باركود", "الباركود", "رمز المنتج", "رمزالمنتج"],
  internalCode: ["internalcode", "code", "sku", "كود", "الكود الداخلي", "الكود"],
  purchasePrice: ["purchaseprice", "cost", "buyprice", "سعر الشراء", "سعرالشراء", "التكلفة"],
  salePrice: ["saleprice", "sellprice", "سعر البيع", "سعرالبيع"],
  quantity: ["quantity", "qty", "الكمية", "الكمية الحالية"],
  unit: ["unit", "الوحدة"],
  category: ["category", "categories", "الفئة", "الفئات", "التصنيف", "التصنيفات"],
};
const findColumn = (headers, field) => {
  const options = aliases[field].map(normalizeHeader);
  return headers.findIndex((header) => options.includes(normalizeHeader(header)));
};
const numberValue = (value) => {
  const normalized = String(value ?? "").replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[,،]/g, "").trim();
  const result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
};
const barcodeValue = (value) => { const text = String(value ?? "").trim(); return /^\d+\.0+$/.test(text) ? text.slice(0, text.indexOf(".")) : text; };

export async function parseBarcodeFile(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: false });
  if (!rows.length) throw new Error("ملف الباركود فارغ.");
  const headers = rows[0].map((value) => String(value ?? "").trim());
  const columns = Object.fromEntries(Object.keys(aliases).map((field) => [field, findColumn(headers, field)]));
  if (columns.barcode < 0) throw new Error("لم أجد عمود الباركود. استخدم اسم العمود «الباركود» أو «Barcode».");
  const providedFields = Object.keys(aliases).filter((field) => columns[field] >= 0);
  const records = rows.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    name: String(row[columns.name] ?? "").trim(),
    barcode: barcodeValue(row[columns.barcode]),
    internalCode: columns.internalCode >= 0 ? String(row[columns.internalCode] ?? "").trim() : "",
    purchasePrice: columns.purchasePrice >= 0 ? numberValue(row[columns.purchasePrice]) : 0,
    salePrice: columns.salePrice >= 0 ? numberValue(row[columns.salePrice]) : 0,
    quantity: columns.quantity >= 0 ? numberValue(row[columns.quantity]) : 0,
    unit: columns.unit >= 0 ? String(row[columns.unit] ?? "حبة").trim() || "حبة" : "حبة",
    category: columns.category >= 0 ? String(row[columns.category] ?? "").trim() : "",
    providedFields,
  })).filter((record) => record.barcode);
  if (!records.length) throw new Error("لم أجد أي صف يحتوي على باركود صالح.");
  return { records, headers };
}

export function createBarcodeWorkbook(products) {
  const rows = products.map((product) => ({
    "اسم المنتج": product.name,
    "الباركود": product.barcode || "",
    "الكود الداخلي": product.internalCode || "",
    "سعر الشراء": product.purchasePrice ?? 0,
    "سعر البيع": product.salePrice ?? 0,
    "الكمية": product.quantity ?? 0,
    "الوحدة": product.unit || "حبة",
    "الفئة": product.category || "",
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "الباركودات");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

export function createPurchaseWorkbook(purchase) {
  const rows = (purchase.items || []).map((item) => ({
    "رقم الفاتورة": purchase.invoiceNumber || "",
    "تاريخ الفاتورة": purchase.date || "",
    "المورد": purchase.supplierName || "بدون مورد",
    "هاتف المورد": purchase.supplierPhone || "",
    "عنوان المورد": purchase.supplierAddress || "",
    "اسم المنتج": item.productName || "",
    "الكمية": item.quantity ?? 0,
    "الوحدة": item.unit || "حبة",
    "عدد العبوات": item.packageQuantity ?? "",
    "نوع العبوة": item.packageUnit || "",
    "سعر العبوة": item.packageCost ?? "",
    "سعر الوحدة": item.unitCost ?? 0,
    "سعر البيع": item.salePrice ?? "",
    "الإجمالي": item.total ?? 0,
    "رقم التشغيلة": item.batchNumber || "",
    "تاريخ الإنتاج": item.productionDate || "",
    "تاريخ الانتهاء": item.expiryDate || "",
    "نوع الدفع": purchase.paymentType || "نقدي",
    "المبلغ المدفوع": purchase.paidAmount ?? 0,
    "المتبقي": purchase.remainingAmount ?? 0,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "رقم الفاتورة": purchase.invoiceNumber || "", "المورد": purchase.supplierName || "بدون مورد", "الإجمالي": purchase.total ?? 0 }]);
  sheet["!cols"] = [
    { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "فاتورة شراء");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}
