/* ═══════════════════════════════════════════════════════════════════════════════
   قالب الفاتورة الحرارية 80 مم والفاتورة الرسمية — حسابي
   Official Thermal Receipt & Sales Invoice Template
═══════════════════════════════════════════════════════════════════════════════ */

export function renderThermalInvoiceHtml({
  invoice,
  customer = null,
  storeName,
  storeInfo = null,
  logoDataUrl = "",
  formatMoney,
  formatAmount,
  formatDateTime,
  escapeHtml,
  paymentLabel,
}) {
  const rows = invoice.items.map((item) => `<tr>
    <td>${escapeHtml(item.productName)}<br><small>${formatAmount(item.quantity)} ${escapeHtml(item.unit)} × ${formatMoney(item.unitPrice)}</small></td>
    <td>${formatMoney(item.total)}</td>
  </tr>`).join("");

  const remaining = invoice.paymentType === "آجل" ? `<div><span>المتبقي</span><strong>${formatMoney(invoice.remainingAmount)}</strong></div>` : "";
  const cashierDetails = `<section class="cashier-card"><div><span>الكاشير المنفذ</span><b>${escapeHtml(invoice.cashierName || "الأدمن")}</b></div></section>`;
  const customerDetails = invoice.customerName ? `<section class="customer-card"><strong>بيانات العميل</strong><div><span>الاسم</span><b>${escapeHtml(invoice.customerName)}</b></div>${customer?.phone ? `<div><span>الهاتف</span><b dir="ltr">${escapeHtml(customer.phone)}</b></div>` : ""}${customer?.address ? `<div><span>العنوان</span><b>${escapeHtml(customer.address)}</b></div>` : ""}</section>` : "";

  const storeDetails = [
    storeInfo?.storePhone ? `<span>هاتف: ${escapeHtml(storeInfo.storePhone)}</span>` : "",
    storeInfo?.storeAddress ? `<span>${escapeHtml(storeInfo.storeAddress)}</span>` : "",
    storeInfo?.taxNumber ? `<span>الرقم الضريبي: ${escapeHtml(storeInfo.taxNumber)}</span>` : "",
  ].filter(Boolean).join(" · ");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap");
    @page{size:80mm auto;margin:4mm}
    *, *::before, *::after{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body{
      width:72mm;
      margin:0 auto;
      color:#111;
      font-family:"HesabiArabicPdf","Noto Naskh Arabic","Cairo",Tahoma,Arial,sans-serif;
      font-size:12px;
      line-height:1.65;
      letter-spacing:0;
      word-spacing:normal;
      font-kerning:normal;
      font-variant-ligatures:common-ligatures contextual;
      font-feature-settings:"kern" 1,"liga" 1,"calt" 1;
      font-synthesis:none;
      text-rendering:optimizeLegibility;
      -webkit-font-smoothing:antialiased;
      direction:rtl;
    }
    h1,h2,p{margin:0;text-align:center;overflow-wrap:break-word;word-break:normal;white-space:normal;}
    h1{font-size:18px;font-weight:800;color:#174c3f}
    .invoice-logo{display:block;width:22mm;height:22mm;object-fit:contain;margin:0 auto 3px;border-radius:4px}
    h2{margin-top:5px;font-size:14px;color:#1f6b59}
    .muted{margin-top:4px;color:#555;font-size:10px}
    .store-details-muted{margin-top:2px;color:#555;font-size:9.5px}
    .rule{border:0;border-top:1px dashed #333;margin:8px 0}
    .customer-card{margin:8px 0;padding:7px;border:1px solid #111;background:#f7f7f7;border-radius:6px}
    .customer-card>strong{display:block;margin-bottom:5px;font-size:12px;color:#174c3f}
    .customer-card div{display:flex;justify-content:space-between;gap:7px;padding:2px 0}
    .customer-card span{color:#555}
    .customer-card b{font-size:12px;text-align:left}
    .cashier-card{margin:8px 0;padding:6px 7px;border:1px solid #111;background:#f7f7f7;border-radius:6px}
    .cashier-card div{display:flex;justify-content:space-between;gap:7px}
    .cashier-card span{color:#555}
    .cashier-card b{font-size:12px;text-align:left}
    table{width:100%;border-collapse:collapse}
    td{padding:6px 0;border-bottom:1px dashed #bbb;vertical-align:top;overflow-wrap:break-word;word-break:normal}
    td:last-child{text-align:left;white-space:nowrap;font-weight:700;direction:ltr;unicode-bidi:isolate}
    small{color:#444;font-size:10px}
    .summary div{display:flex;justify-content:space-between;gap:8px;padding:3px 0}
    .summary .final{margin-top:4px;padding-top:6px;border-top:1px solid #111;font-size:14px;font-weight:800;color:#174c3f}
    .footer{margin-top:11px;text-align:center;font-size:10px;color:#555}
    .footer-rule{border:0;border-top:1px solid #aaa;margin:8px 0 5px}
  </style>
</head>
<body>
  ${logoDataUrl ? `<img class="invoice-logo" src="${escapeHtml(logoDataUrl)}" alt="شعار المتجر" />` : ""}
  <h1>${escapeHtml(storeName || "حسابي")}</h1>
  ${storeDetails ? `<p class="store-details-muted">${storeDetails}</p>` : ""}
  <h2>فاتورة بيع ${escapeHtml(invoice.invoiceNumber)}</h2>
  <p class="muted">${escapeHtml(formatDateTime(invoice.date))}</p>
  ${cashierDetails}
  ${customerDetails}
  <hr class="rule">
  <table>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <hr class="rule">
  <section class="summary">
    <div><span>الإجمالي قبل الخصم</span><strong>${formatMoney(invoice.subtotal)}</strong></div>
    <div><span>الخصم</span><strong>${formatMoney(invoice.discount)}</strong></div>
    ${Number(invoice.deliveryFee) > 0 ? `<div><span>التوصيل · ${invoice.deliveryChargeType === "customer" ? "على العميل ضمن الفاتورة" : "حساب المحل"}</span><strong>${formatMoney(invoice.deliveryFee)}</strong></div>` : ""}
    <div class="final"><span>الإجمالي</span><strong>${formatMoney(invoice.total)}</strong></div>
    <div><span>طريقة السداد</span><strong>${escapeHtml(paymentLabel)}</strong></div>
    <div><span>حالة السداد</span><strong>${escapeHtml(invoice.paymentStatus || (invoice.paymentType === "آجل" ? "آجل" : "مدفوعة"))}</strong></div>
    <div><span>المدفوع</span><strong>${formatMoney(invoice.paidAmount)}</strong></div>
    ${remaining}
  </section>
  <p class="footer">شكرًا لتعاملكم معنا</p>
</body>
</html>`;
}
