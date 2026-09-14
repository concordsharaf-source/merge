import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { createBarcodeWorkbook, parseBarcodeFile } from "../client/src/js/barcode-file.js";

test("يقرأ ملف باركود Excel بأسماء أعمدة عربية ويصدر ملفًا قابلًا لإعادة القراءة", async () => {
  const sheet = XLSX.utils.aoa_to_sheet([["اسم المنتج", "الباركود", "سعر البيع"], ["قهوة", "628123", "150"]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "الباركودات");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const parsed = await parseBarcodeFile(new Blob([bytes]));
  assert.deepEqual(parsed.records[0], { rowNumber: 2, name: "قهوة", barcode: "628123", internalCode: "", purchasePrice: 0, salePrice: 150, quantity: 0, unit: "حبة", category: "", providedFields: ["name", "barcode", "salePrice"] });
  const exported = await parseBarcodeFile(new Blob([createBarcodeWorkbook([{ name: "قهوة", barcode: "628123", internalCode: "", purchasePrice: 100, salePrice: 150, quantity: 2, unit: "حبة" }])]));
  assert.equal(exported.records[0].barcode, "628123");
});

test("يحوّل الباركود الرقمي القادم من Excel من 628123.0 إلى 628123", async () => {
  const sheet = XLSX.utils.aoa_to_sheet([["اسم المنتج", "الباركود"], ["منتج", "628123.0"]]);
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "الباركودات");
  const parsed = await parseBarcodeFile(new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })]));
  assert.equal(parsed.records[0].barcode, "628123");
});
