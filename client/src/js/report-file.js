import * as XLSX from "xlsx";

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const normalizeValue = (value) => String(value ?? "").trim();
const columnName = (index) => {
  let value = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
};

function styleReportSheet(sheet, rows, columnCount, headerRowIndex) {
  const lastColumn = columnName(columnCount - 1);
  const lastRow = rows.length;
  sheet["!cols"] = Array.from({ length: columnCount }, (_, columnIndex) => {
    const lengths = rows.map((row) => normalizeValue(row[columnIndex]).length).filter(Boolean);
    const suggestedWidth = Math.max(12, Math.min(34, Math.max(...lengths, 12) + 2));
    return { wch: columnIndex === 0 ? Math.max(22, suggestedWidth) : suggestedWidth };
  });
  sheet["!rows"] = rows.map((_, rowIndex) => ({ hpt: rowIndex === headerRowIndex ? 34 : rowIndex < headerRowIndex ? 26 : 30 }));
  sheet["!freeze"] = { xSplit: 0, ySplit: headerRowIndex + 1 };
  sheet["!autofilter"] = { ref: `A${headerRowIndex + 1}:${lastColumn}${lastRow}` };
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: columnCount - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: columnCount - 1 } },
  ];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const address = `${columnName(columnIndex)}${rowIndex + 1}`;
      const cell = sheet[address] || (sheet[address] = { t: "s", v: "" });
      const isTitle = rowIndex === 0;
      const isSubtitle = rowIndex === 1;
      const isPeriod = rowIndex === 2;
      const isGeneratedAt = rowIndex === 3;
      const isHeader = rowIndex === headerRowIndex;
      const isBody = rowIndex > headerRowIndex;
      cell.s = {
        alignment: {
          horizontal: isTitle || isSubtitle || isPeriod || isGeneratedAt ? "center" : columnIndex === 0 ? "right" : "center",
          vertical: "center",
          wrapText: true,
          shrinkToFit: false,
        },
        font: { name: "Arial", sz: isTitle ? 16 : isHeader ? 12 : 11, bold: isTitle || isHeader, color: isTitle ? "174C3F" : isGeneratedAt ? "52645B" : "172E27" },
        fill: isHeader ? { patternType: "solid", fgColor: { rgb: "DFE9E1" } } : isBody && rowIndex % 2 === 0 ? { patternType: "solid", fgColor: { rgb: "F7FAF8" } } : undefined,
        border: isHeader || isBody ? {
          top: { style: "thin", color: { rgb: "52645B" } },
          bottom: { style: "thin", color: { rgb: "52645B" } },
          left: { style: "thin", color: { rgb: "52645B" } },
          right: { style: "thin", color: { rgb: "52645B" } },
        } : undefined,
      };
    }
  }
}

export function createReportWorkbook(rows, { storeName = "حسابي", reportTitle = "التقرير المالي", from = "البداية", to = "غير محدد", generatedAt = "" } = {}) {
  const sourceRows = Array.isArray(rows) && rows.length ? rows : [["البند", "القيمة"]];
  const columnCount = Math.max(1, ...sourceRows.map((row) => Array.isArray(row) ? row.length : 0));
  const normalizedRows = sourceRows.map((row) => Array.from({ length: columnCount }, (_, index) => normalizeValue(row?.[index])));
  const sheetRows = [
    [storeName, ...Array(columnCount - 1).fill("")],
    [reportTitle, ...Array(columnCount - 1).fill("")],
    [`الفترة: ${from} إلى ${to}`, ...Array(columnCount - 1).fill("")],
    [`تاريخ ووقت الإنشاء: ${generatedAt}`, ...Array(columnCount - 1).fill("")],
    ...normalizedRows,
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  styleReportSheet(sheet, sheetRows, columnCount, 4);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "التقرير");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array", bookSST: true, cellStyles: true });
}

export function reportWorkbookMimeType() {
  return EXCEL_MIME;
}
