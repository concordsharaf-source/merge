/* ═══════════════════════════════════════════════════════════════════════════════
   قالب طباعة ومشاركة فاتورة الشراء الرسمية — حسابي
   Official Purchase Invoice Template
═══════════════════════════════════════════════════════════════════════════════ */

import { getStoreLogoDataUri } from "./report-template.js";

export function renderPurchaseInvoiceHtml({
  purchase,
  supplier = null,
  storeName = "حسابي",
  storeInfo = null,
  logoDataUrl = "",
  formatMoney,
  formatAmount,
  formatDateTime,
  escapeHtml,
}) {
  const effectiveLogo = getStoreLogoDataUri(logoDataUrl, storeName);
  const items = purchase.items || [];
  const rows = items.map((item) => {
    const packageSummary = item.packageQuantity ? `${escapeHtml(String(formatAmount(item.packageQuantity)))} ${escapeHtml(item.packageUnit || "عبوة")} × ${escapeHtml(String(formatMoney(item.packageCost)))}` : "";
    const extras = [
      item.batchNumber ? `التشغيلة: ${escapeHtml(item.batchNumber)}` : "",
      item.productionDate ? `الإنتاج: ${escapeHtml(item.productionDate)}` : "",
      item.expiryDate ? `الانتهاء: ${escapeHtml(item.expiryDate)}` : "",
      Number(item.returnedQuantity) > 0 ? `مرتجع: ${escapeHtml(String(formatAmount(item.returnedQuantity)))}` : "",
    ].filter(Boolean).join(" · ");
    return `<tr>
      <td class="align-right">${escapeHtml(item.productName || "")}${packageSummary || extras ? `<br><small style="color:#52645b;font-size:10px;">${[packageSummary, extras].filter(Boolean).join(" · ")}</small>` : ""}</td>
      <td class="amount align-center">${escapeHtml(String(formatAmount(item.quantity)))} ${escapeHtml(item.unit || "")}</td>
      <td class="amount">${escapeHtml(String(formatMoney(item.unitCost)))}</td>
      <td class="amount">${escapeHtml(String(formatMoney(item.salePrice ?? 0)))}</td>
      <td class="amount">${escapeHtml(String(formatMoney(item.total)))}</td>
    </tr>`;
  }).join("");

  const supplierDetails = `<section class="supplier-card">
    <strong>بيانات المورد</strong>
    <div class="supplier-card__grid">
      <div><span>الاسم</span><b>${escapeHtml(purchase.supplierName || supplier?.name || "بدون مورد")}</b></div>
      ${supplier?.phone || purchase.supplierPhone ? `<div><span>الهاتف</span><b dir="ltr">${escapeHtml(supplier?.phone || purchase.supplierPhone)}</b></div>` : ""}
      ${supplier?.address || purchase.supplierAddress ? `<div><span>العنوان</span><b>${escapeHtml(supplier?.address || purchase.supplierAddress)}</b></div>` : ""}
    </div>
  </section>`;

  const summary = `<section class="summary">
    <div><span>إجمالي فاتورة الشراء</span><strong>${formatMoney(purchase.total || 0)}</strong></div>
    <div><span>المبلغ المدفوع</span><strong>${formatMoney(purchase.paidAmount || 0)}</strong></div>
    <div class="balance"><span>المتبقي للمورد</span><strong>${formatMoney(purchase.remainingAmount || 0)}</strong></div>
  </section>`;

  const paymentInfo = `<section class="payment-info">
    <div><span>طريقة الدفع</span><b>${escapeHtml(purchase.paymentType || "نقدي")}</b></div>
    <div><span>وسيلة الدفع</span><b>${escapeHtml(purchase.paymentMethod || "نقدي")}</b></div>
    <div><span>حالة السداد</span><b>${escapeHtml(purchase.paymentStatus || "مدفوعة")}</b></div>
  </section>`;

  const notes = purchase.notes ? `<section class="notes"><strong>ملاحظات</strong><p>${escapeHtml(purchase.notes)}</p></section>` : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(purchase.invoiceNumber || "فاتورة شراء")}</title>
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap");
    @page { size: A4 portrait; margin: 12mm; }
    *, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      color: #172e27;
      background: #ffffff;
      font-family: "HesabiArabicPdf", "Noto Naskh Arabic", "Cairo", "Noto Sans Arabic", Tahoma, "Segoe UI", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.65;
      direction: rtl;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
    }
    h1, h2, p { margin: 0; }
    .head {
      border: 2px solid #1f6b59;
      border-radius: 10px;
      background: #f5faf7;
      margin-bottom: 12px;
      padding: 12px 16px;
      direction: rtl;
      text-align: right;
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
    .head h1 { font-size: 22px; font-weight: 800; color: #174c3f; line-height: 1.35; white-space: normal; overflow-wrap: break-word; margin: 0 0 3px 0; direction: rtl; text-align: right; }
    .head .title { color: #1f6b59; font-size: 15px; font-weight: 700; margin: 0 0 4px 0; direction: rtl; text-align: right; }
    .head .meta { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 11px; color: #52645b; direction: rtl; text-align: right; }
    .head .store-info-line { margin-top: 4px; font-size: 10.5px; color: #43574e; direction: rtl; text-align: right; }
    .invoice-logo {
      width: 74px;
      height: 74px;
      object-fit: contain;
      background: #ffffff;
      border: 1.5px solid #b7cdbf;
      border-radius: 8px;
      padding: 3px;
      display: block;
    }
    .supplier-card {
      margin: 12px 0;
      padding: 12px 16px;
      border: 2px solid #1f6b59;
      border-radius: 10px;
      background: #edf6f0;
    }
    .supplier-card > strong { display: block; margin-bottom: 8px; color: #174c3f; font-size: 13.5px; font-weight: 700; }
    .supplier-card__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px 18px; }
    .supplier-card div { display: flex; justify-content: space-between; gap: 14px; padding: 3px 0; border-bottom: 1px solid rgba(31,107,89,.16); }
    .supplier-card div:last-child { border-bottom: 0; }
    .supplier-card span { color: #52645b; font-size: 11.5px; }
    .supplier-card b { font-size: 12px; text-align: left; color: #172e27; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
    .summary div { padding: 12px; background: #f4f6f1; border: 1.5px solid #d9e0d7; border-radius: 8px; text-align: right; }
    .summary span, .summary strong { display: block; }
    .summary span { color: #52645b; font-size: 11px; }
    .summary strong { margin-top: 4px; font-size: 15px; font-weight: 800; direction: ltr; text-align: right; unicode-bidi: isolate; }
    .summary .balance { color: #ffffff; background: #1f6b59; border-color: #174c3f; }
    .summary .balance span { color: #e2ede7; }
    .summary .balance strong { color: #ffffff; }
    .payment-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
    .payment-info div { padding: 10px 12px; background: #f4f6f1; border: 1px solid #d9e0d7; border-radius: 8px; }
    .payment-info span { display: block; color: #52645b; font-size: 10.5px; }
    .payment-info b { font-size: 12px; color: #172e27; }
    .notes { margin: 12px 0; padding: 12px 14px; border: 1px solid #d9e0d7; border-radius: 8px; background: #ffffff; }
    .notes strong { display: block; color: #174c3f; font-size: 12.5px; margin-bottom: 4px; }
    .notes p { margin: 0; color: #52645b; font-size: 11.5px; }
    h2.section-heading { font-size: 14px; font-weight: 800; color: #174c3f; margin: 14px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; border: 1.5px solid #174c3f; font-size: 11.5px; }
    thead { display: table-header-group; }
    tbody tr { page-break-inside: avoid; }
    th, td { padding: 8px 8px; border: 1.5px solid #52645b; text-align: center; vertical-align: middle; }
    th { color: #172e27; background: #dfece4; font-size: 12px; font-weight: 800; }
    th.align-right, td.align-right { text-align: right !important; }
    th.align-center, td.align-center { text-align: center !important; }
    tbody tr:nth-child(even) { background: #f8fbf9; }
    tbody tr:nth-child(odd) { background: #ffffff; }
    .amount { font-weight: 700; direction: ltr; unicode-bidi: isolate; }
    .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #b7cdbf; color: #52645b; text-align: center; font-size: 10px; }
  </style>
</head>
<body>
  <header class="head">
    <table class="report-header-layout-table" style="width:100%;border-collapse:collapse;border:none;margin:0;padding:0;background:transparent;">
      <tr style="border:none;background:transparent;">
        <!-- اليمين: بيانات المتجر -->
        <td style="width:38%;vertical-align:middle;text-align:right;border:none;padding:0 0 0 8px;direction:rtl;">
          <h1>${escapeHtml(storeName || "حسابي")}</h1>
          ${storeInfo?.businessType ? `<p class="store-info-line">النشاط: <b>${escapeHtml(storeInfo.businessType)}</b></p>` : ""}
          ${storeInfo?.storePhone ? `<p class="store-info-line">الهاتف: <b dir="ltr">${escapeHtml(storeInfo.storePhone)}</b></p>` : ""}
          ${storeInfo?.storeAddress ? `<p class="store-info-line">العنوان: <b>${escapeHtml(storeInfo.storeAddress)}</b></p>` : ""}
        </td>

        <!-- الوسط: الشعار -->
        <td style="width:24%;vertical-align:middle;text-align:center;border:none;padding:0 6px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:76px;height:76px;background:#ffffff;border:2px solid #1f6b59;border-radius:50%;padding:4px;box-shadow:0 2px 6px rgba(31,107,89,0.12);margin:0 auto;">
            <img class="invoice-logo" src="${escapeHtml(effectiveLogo)}" alt="شعار المتجر" style="width:100%;height:100%;object-fit:contain;border-radius:50%;border:none;">
          </div>
        </td>

        <!-- اليسار: بيانات الفاتورة -->
        <td style="width:38%;vertical-align:middle;text-align:left;border:none;padding:0 8px 0 0;direction:rtl;">
          <p class="title" style="text-align:left;font-size:16px;font-weight:800;color:#1f6b59;margin:0 0 4px 0;">فاتورة شراء ${escapeHtml(purchase.invoiceNumber || "")}</p>
          <p class="meta" style="text-align:left;margin:0 0 3px 0;">رقم الفاتورة: <b dir="ltr">${escapeHtml(purchase.invoiceNumber || "—")}</b></p>
          <p class="meta" style="text-align:left;margin:0 0 3px 0;">التاريخ: <b>${escapeHtml(formatDateTime(purchase.date))}</b></p>
          ${storeInfo?.taxNumber ? `<p class="store-info-line" style="text-align:left;margin:0 0 3px 0;">الرقم الضريبي/السجل: <b dir="ltr">${escapeHtml(storeInfo.taxNumber)}</b></p>` : ""}
        </td>
      </tr>
    </table>
  </header>
  ${supplierDetails}
  ${summary}
  <h2 class="section-heading">تفاصيل الأصناف</h2>
  <table>
    <thead>
      <tr>
        <th class="align-right">الصنف</th>
        <th class="align-center">الكمية</th>
        <th>سعر الشراء</th>
        <th>سعر البيع</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="5" style="text-align:center;padding:16px;">لا توجد أصناف مسجلة في هذه الفاتورة.</td></tr>`}
    </tbody>
  </table>
  ${paymentInfo}
  ${notes}
  <p class="footer">هذه الفاتورة صادرة من حسابي للاستخدام التشغيلي والمحاسبي المعتمد.</p>
</body>
</html>`;
}
