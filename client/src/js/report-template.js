/* ═══════════════════════════════════════════════════════════════════════════════
   قالب التقارير المحاسبية والمستندات الرسمية الموحدة — حسابي
   Unified Official Accounting Report & Document Template System
   - دعم كامل للغة العربية 100% واتجاه RTL والتشكيل والخطوط المعتمدة
   - جداول رسمية بأعمدة وصفوف واضحة، حدود محاسبية، تمييز المجاميع والكسور
   - ترويسة متجر كاملة ومرنة تمنع تقطيع أو اختصار أسماء المتاجر وبياناتها
   - توحيد التصميم عبر جميع شاشات وتقارير وفواتير وكشوفات التطبيق
═══════════════════════════════════════════════════════════════════════════════ */

export const escapeHtml = (value = "") =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));

export function getStoreLogoDataUri(logoDataUrl, storeName = "حسابي") {
  const source = String(logoDataUrl || "").trim();
  if (source.startsWith("data:image/")) return source;
  if (/^https?:\/\//i.test(source) || source.startsWith("blob:")) return source;

  const initial = (storeName || "حسابي").trim().slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <circle cx="50" cy="50" r="48" fill="#f4faf6" stroke="#174c3f" stroke-width="3"/>
    <circle cx="50" cy="50" r="42" fill="#174c3f" stroke="#b7cdbf" stroke-width="1.5"/>
    <text x="50%" y="60%" text-anchor="middle" fill="#ffffff" font-family="Cairo, Tahoma, Arial, sans-serif" font-size="28" font-weight="900" direction="rtl">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getReportStyles(isLandscape = false) {
  return `
    @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap");
    @page {
      size: ${isLandscape ? "A4 landscape" : "A4 portrait"};
      margin: ${isLandscape ? "8mm 10mm" : "10mm 12mm"};
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      letter-spacing: 0 !important;
      word-spacing: normal !important;
    }
    body, [data-pdf-stage] {
      font-family: "HesabiArabicPdf", "Noto Naskh Arabic", "Cairo", "Noto Sans Arabic", Tahoma, "Segoe UI", Arial, sans-serif;
      color: #172e27;
      background: #ffffff;
      direction: rtl;
      text-align: right;
      margin: 0;
      padding: 0;
      font-size: ${isLandscape ? "11px" : "13px"};
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
    }
    .report-sheet {
      width: 100%;
      margin: 0 auto;
      background: #ffffff;
      direction: rtl;
      text-align: right;
    }

    /* ═══ Official Document Header (ترويسة ثلاثية منظمة: يمين، وسط، يسار) ═══ */
    .report-header {
      border: 2px solid #174c3f;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #f5faf7;
      direction: rtl;
      text-align: right;
      overflow: visible;
    }
    .report-header-layout-table {
      width: 100% !important;
      border-collapse: collapse !important;
      border: none !important;
      background: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .report-header-layout-table td {
      border: none !important;
      background: transparent !important;
      padding: 0 !important;
      vertical-align: middle !important;
    }
    .report-header__col-right {
      width: 38% !important;
      text-align: right !important;
      direction: rtl !important;
      padding-left: 8px !important;
    }
    .report-header__col-center {
      width: 24% !important;
      text-align: center !important;
      padding: 0 6px !important;
    }
    .report-header__col-left {
      width: 38% !important;
      text-align: left !important;
      direction: rtl !important;
      padding-right: 8px !important;
    }
    .report-header__logo-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      width: 76px;
      height: 76px;
      background: #ffffff;
      border: 2px solid #174c3f;
      border-radius: 50%;
      padding: 4px;
      box-shadow: 0 2px 6px rgba(23,76,63,0.12);
    }
    .report-header__logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 50%;
      display: block;
    }
    .report-header__store-name {
      margin: 0 0 4px 0;
      font-size: ${isLandscape ? "18px" : "21px"};
      font-weight: 800;
      color: #174c3f;
      line-height: 1.35;
      white-space: normal;
      overflow-wrap: break-word;
      word-break: normal;
      direction: rtl;
      text-align: right;
    }
    .report-header__title {
      margin: 0 0 4px 0;
      font-size: ${isLandscape ? "14px" : "16px"};
      font-weight: 800;
      color: #1f6b59;
      line-height: 1.35;
      white-space: normal;
      overflow-wrap: break-word;
      word-break: normal;
      direction: rtl;
      text-align: left;
    }
    .report-header__meta-item {
      margin: 0 0 3px 0;
      color: #52645b;
      font-size: ${isLandscape ? "10px" : "11.5px"};
      line-height: 1.45;
      white-space: normal;
      overflow-wrap: break-word;
      word-break: normal;
    }
    .report-header__meta-item.align-left {
      text-align: left !important;
      direction: rtl !important;
    }
    .report-header__meta-item.align-right {
      text-align: right !important;
      direction: rtl !important;
    }

    /* ═══ Party / Summary Info Cards ═══ */
    .party-card {
      border: 1.5px solid #1f6b59;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 12px 0;
      background: #edf6f0;
      direction: rtl;
      text-align: right;
    }
    .party-card strong {
      display: block;
      margin-bottom: 6px;
      color: #174c3f;
      font-size: 13px;
      font-weight: 700;
    }
    .party-card__grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 20px;
      font-size: 12px;
    }
    .party-card__item {
      display: inline-flex;
      gap: 6px;
      color: #172e27;
    }
    .party-card__item span {
      color: #52645b;
    }

    .kpi-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin: 14px 0;
      direction: rtl;
    }
    .kpi-card {
      background: #f4f6f1;
      border: 1.5px solid #d9e0d7;
      border-radius: 8px;
      padding: 10px 12px;
      text-align: right;
      direction: rtl;
    }
    .kpi-card span {
      display: block;
      color: #52645b;
      font-size: 10.5px;
      margin-bottom: 3px;
    }
    .kpi-card strong {
      display: block;
      font-size: 15px;
      font-weight: 800;
      color: #172e27;
      direction: ltr;
      text-align: right;
      unicode-bidi: isolate;
    }
    .kpi-card.is-highlight {
      background: #1f6b59;
      border-color: #174c3f;
      color: #ffffff;
    }
    .kpi-card.is-highlight span {
      color: #e2ede7;
    }
    .kpi-card.is-highlight strong {
      color: #ffffff;
    }

    /* ═══ Formal Accounting Table (أعمدة وصفوف رسمية) ═══ */
    .report-table-container {
      width: 100%;
      margin-top: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
      border: 1.5px solid #174c3f;
      font-size: ${isLandscape ? "10.5px" : "12.5px"};
      direction: rtl;
      page-break-inside: auto;
    }
    thead {
      display: table-header-group;
    }
    tbody tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th, td {
      padding: ${isLandscape ? "6px 6px" : "9px 8px"};
      border: 1.5px solid #52645b;
      text-align: right;
      vertical-align: middle;
      overflow-wrap: break-word;
      word-break: normal;
      white-space: normal;
      line-height: 1.45;
    }
    th {
      background: #dfece4;
      color: #172e27;
      font-size: ${isLandscape ? "11.5px" : "13.5px"};
      font-weight: 800;
      text-align: right;
    }
    td:not(:first-child), th:not(:first-child) {
      text-align: center;
    }
    td.align-right, th.align-right {
      text-align: right !important;
    }
    td.align-center, th.align-center {
      text-align: center !important;
    }
    td.align-left, th.align-left {
      text-align: left !important;
    }
    tbody tr:nth-child(even) {
      background: #f8fbf9;
    }
    tbody tr:nth-child(odd) {
      background: #ffffff;
    }
    td.amount, td.money, .amount, .money {
      font-weight: 700;
      white-space: nowrap;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .is-negative, .negative, td.negative {
      color: #a74340 !important;
      font-weight: 800;
    }
    tr.total-row td, tr.total td, tr.is-total td {
      background: #e7f1eb !important;
      font-weight: 800;
      font-size: 1.05em;
      color: #174c3f;
      border-top: 2px solid #174c3f;
      border-bottom: 2.5px double #174c3f;
    }

    /* ═══ Official Document Footer ═══ */
    .report-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #b7cdbf;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #52645b;
      direction: rtl;
    }
    .report-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 24px;
      padding: 0 16px;
      direction: rtl;
    }
    .report-signature-box {
      border-top: 1px dashed #174c3f;
      padding-top: 6px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      color: #174c3f;
    }
  `;
}

export function renderOfficialHeaderHtml({
  storeName = "حسابي",
  storeInfo = null,
  logoDataUrl = "",
  title = "التقرير المالي",
  from = "",
  to = "",
  generatedAt = "",
  cashierName = "",
}) {
  const periodText = from && to ? `من ${escapeHtml(from)} إلى ${escapeHtml(to)}` : from ? `من ${escapeHtml(from)}` : to ? `حتى ${escapeHtml(to)}` : "";
  const effectiveLogo = getStoreLogoDataUri(logoDataUrl, storeName);

  return `
    <header class="report-header">
      <table class="report-header-layout-table">
        <tr>
          <!-- الجانب الأيمن: معلومات المتجر والمنشأة -->
          <td class="report-header__col-right">
            <h1 class="report-header__store-name">${escapeHtml(storeName || "حسابي")}</h1>
            ${storeInfo?.businessType ? `<p class="report-header__meta-item align-right">النشاط: <b>${escapeHtml(storeInfo.businessType)}</b></p>` : ""}
            ${storeInfo?.storePhone ? `<p class="report-header__meta-item align-right">الهاتف: <b dir="ltr">${escapeHtml(storeInfo.storePhone)}</b></p>` : ""}
            ${storeInfo?.storeAddress ? `<p class="report-header__meta-item align-right">العنوان: <b>${escapeHtml(storeInfo.storeAddress)}</b></p>` : ""}
          </td>

          <!-- الوسط: شعار المتجر -->
          <td class="report-header__col-center">
            <div class="report-header__logo-container">
              <img class="report-header__logo" src="${escapeHtml(effectiveLogo)}" alt="شعار ${escapeHtml(storeName || "المتجر")}">
            </div>
          </td>

          <!-- الجانب الأيسر: معلومات التقرير والتوثيق -->
          <td class="report-header__col-left">
            <h2 class="report-header__title">${escapeHtml(title)}</h2>
            ${periodText ? `<p class="report-header__meta-item align-left">الفترة: <b>${escapeHtml(periodText)}</b></p>` : `<p class="report-header__meta-item align-left">من ${escapeHtml(from || "البداية")} إلى ${escapeHtml(to || "الآن")}</p>`}
            <p class="report-header__meta-item align-left">تاريخ الإنشاء: <b>${escapeHtml(generatedAt || new Date().toLocaleString("ar-YE"))}</b></p>
            ${storeInfo?.taxNumber ? `<p class="report-header__meta-item align-left">الرقم الضريبي/السجل: <b dir="ltr">${escapeHtml(storeInfo.taxNumber)}</b></p>` : ""}
            ${cashierName ? `<p class="report-header__meta-item align-left">المستخدم: <b>${escapeHtml(cashierName)}</b></p>` : ""}
          </td>
        </tr>
      </table>
    </header>
  `;
}

export function renderOfficialReportHtml({
  title = "التقرير المالي",
  rows = [],
  storeName = "حسابي",
  storeInfo = null,
  logoDataUrl = "",
  from = "",
  to = "",
  generatedAt = "",
  cashierName = "",
  summaryCards = [],
  footerNote = "صادر رسميًا من نظام حسابي لإدارة الأنشطة التجارية والمخزون.",
  includeSignatures = false,
}) {
  const headers = rows[0] || [];
  const bodyRows = rows.slice(1);
  const wide = headers.length > 6;

  const summaryHtml = Array.isArray(summaryCards) && summaryCards.length
    ? `<section class="kpi-summary-grid">${summaryCards.map((card) => `
        <div class="kpi-card ${card.isHighlight || card.isPrimary ? "is-highlight" : ""}">
          <span>${escapeHtml(card.label)}</span>
          <strong class="${card.isNegative ? "is-negative" : ""}">${escapeHtml(card.value)}</strong>
        </div>`).join("")}
      </section>`
    : "";

  const isTotalRow = (row) => {
    const first = String(row?.[0] ?? "").trim();
    const second = String(row?.[1] ?? "").trim();
    return /^الإجمالي|المجموع|الرصيد الختامي|صافي المركز/.test(first) || (first === "" && /^إجمالي|الرصيد/.test(second));
  };

  const isNegativeValue = (value) => /^[-−]/.test(String(value ?? "").trim()) || /\(دين\)/.test(String(value ?? ""));

  const cell = (value, colIndex, isHeader = false, isTotal = false) => {
    const valStr = String(value ?? "");
    const tag = isHeader ? "th" : "td";
    const negativeClass = !isHeader && isNegativeValue(valStr) ? " is-negative" : "";
    const alignClass = colIndex === 0 ? " align-right" : " align-center";
    return `<${tag} class="${alignClass}${negativeClass}">${escapeHtml(valStr)}</${tag}>`;
  };

  const tableHtml = `
    <div class="report-table-container">
      <table>
        <thead>
          <tr>${headers.map((val, idx) => cell(val, idx, true)).join("")}</tr>
        </thead>
        <tbody>
          ${bodyRows.map((row) => {
            const total = isTotalRow(row);
            const rowClass = total ? ' class="total-row"' : row.some((v) => isNegativeValue(v)) ? ' class="negative"' : "";
            return `<tr${rowClass}>${headers.map((_, idx) => cell(row[idx] ?? "", idx, false, total)).join("")}</tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  const signaturesHtml = includeSignatures ? `
    <section class="report-signatures">
      <div class="report-signature-box">المحاسب المسئول / المنفذ</div>
      <div class="report-signature-box">المدير العام / الاعتماد</div>
    </section>
  ` : "";

  const footerHtml = `
    <footer class="report-footer">
      <span>${escapeHtml(footerNote)}</span>
      <span>تاريخ الطباعة: ${escapeHtml(generatedAt || new Date().toLocaleString("ar-YE"))}</span>
    </footer>
  `;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${getReportStyles(wide)}</style>
</head>
<body>
  <div class="report-sheet">
    ${renderOfficialHeaderHtml({ storeName, storeInfo, logoDataUrl, title, from, to, generatedAt, cashierName })}
    ${summaryHtml}
    ${tableHtml}
    ${signaturesHtml}
    ${footerHtml}
  </div>
</body>
</html>`;
}
