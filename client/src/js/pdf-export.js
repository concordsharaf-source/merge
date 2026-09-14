/* ═══════════════════════════════════════════════════════════════════════════════
   وحدة تصدير وطباعة ملفات PDF والمستندات الرسمية — حسابي
   Official PDF & Document Export System
   - توليد مستندات PDF بدقة عالية ودعم كامل للغة العربية 100%
   - جداول رسمية بأعمدة وصفوف واضحة، بدون تقطيع لأسماء المتاجر أو بياناتها
   - توحيد التصميم بين المعاينة والطباعة وتصدير PDF
═══════════════════════════════════════════════════════════════════════════════ */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { renderThermalInvoiceHtml } from "./invoice-print.js";
import { renderCustomerAccountHtml } from "./customer-account-print.js";
import { renderPurchaseInvoiceHtml } from "./purchase-invoice-print.js";
import { renderOfficialReportHtml } from "./report-template.js";

const PDF_ARABIC_FONT_URL = "https://hesabipwa-2r9mmdzn.manus.space/manus-storage/NotoNaskhArabic-Regular_2c8d8205.ttf";
const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
let canvasArabicFontPromise;
const waitWithTimeout = (promise, timeout = 3_000) => Promise.race([promise, new Promise((resolve) => window.setTimeout(resolve, timeout))]);

async function loadCanvasArabicFont() {
  if (!canvasArabicFontPromise) {
    const loadFont = new FontFace("HesabiArabicPdf", `url(${PDF_ARABIC_FONT_URL})`, { style: "normal", weight: "100 900", display: "block" }).load().then((font) => {
      document.fonts.add(font);
      return font;
    }).catch(() => null);
    canvasArabicFontPromise = waitWithTimeout(loadFont);
  }
  return canvasArabicFontPromise;
}

function createPdfStage(html, page) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const isThermal = page === "thermal";
  const isLandscape = !isThermal && /@page\s*\{[^}]*size\s*:\s*A4\s+landscape/i.test(html);
  const stage = document.createElement("article");
  stage.dir = parsed.documentElement.dir || "rtl";
  stage.lang = parsed.documentElement.lang || "ar";
  stage.dataset.pdfStage = "true";
  stage.dataset.pdfOrientation = isLandscape ? "landscape" : "portrait";
  stage.style.cssText = `position:fixed;top:0;left:0;width:${isThermal ? "80mm" : isLandscape ? "297mm" : "210mm"};min-height:20mm;padding:0;margin:0;background:#fff;color:#172e27;z-index:2147483647;pointer-events:none;overflow:visible;direction:rtl;text-align:right;font-family:"HesabiArabicPdf","Noto Naskh Arabic","Cairo","Noto Sans Arabic",Tahoma,Arial,sans-serif;`;
  const printStyles = [...parsed.head.querySelectorAll("style")].map((style) => style.outerHTML).join("");
  const headLinks = [...parsed.head.querySelectorAll("link")].map((link) => link.outerHTML).join("");
  const pdfSafetyStyles = `<style data-pdf-safety>
    @font-face{font-family:"HesabiArabicPdf";src:url("${PDF_ARABIC_FONT_URL}") format("truetype");font-style:normal;font-weight:100 900;font-display:block}
    [data-pdf-stage], [data-pdf-stage] *{box-sizing:border-box !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;letter-spacing:0 !important;word-spacing:normal !important;}
    [data-pdf-stage] {
      font-family:"HesabiArabicPdf","Noto Naskh Arabic","Cairo","Noto Sans Arabic",Tahoma,Arial,sans-serif !important;
      direction:rtl !important;
      text-align:right !important;
      color:#172e27 !important;
      background:#ffffff !important;
      line-height:1.5 !important;
      -webkit-font-smoothing:antialiased !important;
      text-rendering:optimizeLegibility !important;
    }
    [data-pdf-stage] table { border-collapse:collapse !important; }
    [data-pdf-stage] h1, [data-pdf-stage] h2, [data-pdf-stage] p {
      max-width:100% !important;
      white-space:normal !important;
      overflow-wrap:break-word !important;
      word-break:normal !important;
      unicode-bidi:plaintext !important;
    }
  </style>`;
  stage.innerHTML = `${headLinks}${printStyles}${pdfSafetyStyles}${parsed.body.innerHTML}`;
  document.body.appendChild(stage);
  return stage;
}

async function waitForPdfStage(stage) {
  if (!stage.textContent.trim()) throw new Error("لا يوجد محتوى صالح لإنشاء ملف PDF.");
  if (document.fonts?.ready) await waitWithTimeout(document.fonts.ready);
  const images = [...stage.querySelectorAll("img")];
  if (images.length) {
    const imagePromises = images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        window.setTimeout(resolve, 2000);
      });
    });
    await Promise.all(imagePromises);
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (stage.getBoundingClientRect().height < 1 || stage.scrollHeight < 1) throw new Error("تعذر تجهيز محتوى الفاتورة للطباعة.");
}

function downloadPdfFile(file) {
  const url = URL.createObjectURL(file);
  const anchor = Object.assign(document.createElement("a"), { href: url, download: file.name });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function canSharePdfFile(file) {
  if (typeof navigator.share !== "function") return false;
  try { return typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }); } catch { return false; }
}

async function fileOrDownload(file, title) {
  if (canSharePdfFile(file)) {
    try {
      await navigator.share({ title, files: [file] });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") throw error;
    }
  }
  downloadPdfFile(file);
  return "downloaded";
}

async function loadStoreLogoImage(logoDataUrl) {
  const source = String(logoDataUrl || "");
  if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(source) && !/^https?:\/\//i.test(source)) return null;
  return new Promise((resolve) => {
    const image = new Image();
    if (/^https?:\/\//i.test(source)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function drawStoreLogo(context, image, centerX, centerY, boxSize) {
  if (!image?.naturalWidth || !image?.naturalHeight) return;
  const scale = Math.min(boxSize / image.naturalWidth, boxSize / image.naturalHeight);
  const width = image.naturalWidth * scale; const height = image.naturalHeight * scale;
  context.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
}

// ═══════════════════════════════════════════════════════════════════════════
//  لوحة تصميم PDF مطابقة لتصميم تطبيق شرفسوفت Inv1.170
//  A4, RTL, Noto Naskh Arabic / Cairo, formal table headers.
// ═══════════════════════════════════════════════════════════════════════════
const LUXURY_COLORS = {
  primary: "#174c3f",        // زمردي داكن رسمي للعناوين
  primaryLight: "#1f6b59",   // زمردي متوسط للإطارات
  accent: "#dfece4",         // رمادي مخضر خلفية رأس الجدول
  accentLight: "#f5faf7",    // رمادي فاتح
  bgLight: "#ffffff",        // ورق أبيض
  bgCard: "#f8fbf9",         // خلفية بطاقات محايدة
  textDark: "#172e27",       // نص داكن
  textMuted: "#52645b",      // نص رمادي
  border: "#b7cdbf",         // حدود رسمية
  white: "#ffffff",
  red: "#a74340",            // عنابي للمبالغ السالبة
};

const PDF_FOOTER_TITLE = "تم إصدار هذه الوثيقة رسميًا من نظام حسابي";
const PDF_FOOTER_DESIGN = "تصميم شرف غالب قحطان · الجمهورية اليمنية · +967770388100";
const PDF_FOOTER_EMAIL = "concordsharaf@gmail.com";

function drawStoreDetails(context, { storeInfo = {}, right, top, width = 210 * 12 }) {
  const details = [
    storeInfo.storePhone ? `هاتف: ${storeInfo.storePhone}` : "",
    storeInfo.storeAddress ? `العنوان: ${storeInfo.storeAddress}` : "",
    storeInfo.taxNumber ? `الضريبي/السجل: ${storeInfo.taxNumber}` : "",
    storeInfo.storeEmail ? `البريد: ${storeInfo.storeEmail}` : "",
  ].filter(Boolean);
  if (!details.length) return;
  context.save();
  context.direction = "rtl"; context.textAlign = "right"; context.textBaseline = "middle"; context.fillStyle = LUXURY_COLORS.textMuted;
  context.font = '600 22px "HesabiArabicPdf", Tahoma, Arial, sans-serif';
  details.slice(0, 4).forEach((value, index) => context.fillText(value, right, top + index * 8 * 12, width));
  context.restore();
}

function drawPdfFooter(context, { center, width, height, y = height - 22 * 12 }) {
  const left = 14 * 12;
  const right = width - left;
  const footerY = Math.min(y, height - 25 * 12);
  context.save();
  context.strokeStyle = LUXURY_COLORS.accent;
  context.lineWidth = 3;
  context.beginPath(); context.moveTo(left, footerY - 12 * 12); context.lineTo(right, footerY - 12 * 12); context.stroke();
  context.strokeStyle = LUXURY_COLORS.primary;
  context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(left, footerY - 11 * 12); context.lineTo(right, footerY - 11 * 12); context.stroke();

  context.direction = "rtl"; context.textAlign = "center"; context.textBaseline = "middle";
  context.fillStyle = LUXURY_COLORS.primary;
  context.font = '700 26px "HesabiArabicPdf", Tahoma, Arial, sans-serif';
  context.fillText(PDF_FOOTER_TITLE, center, footerY - 7 * 12);
  context.fillStyle = LUXURY_COLORS.textMuted;
  context.font = '500 20px "HesabiArabicPdf", Tahoma, Arial, sans-serif';
  context.fillText(PDF_FOOTER_DESIGN, center, footerY);
  context.direction = "ltr";
  context.font = '500 18px "HesabiArabicPdf", Tahoma, Arial, sans-serif';
  context.fillText(PDF_FOOTER_EMAIL, center, footerY + 6 * 12);
  context.restore();
}

function drawLuxuryText(context, value, x, y, options = {}) {
  const {
    align = "right",
    size = 28,
    weight = 400,
    color = LUXURY_COLORS.textDark,
    direction = "rtl",
    maxWidth = Infinity,
    fontFamily = '"HesabiArabicPdf", "Noto Naskh Arabic", Tahoma, Arial, sans-serif'
  } = options;

  context.save();
  context.direction = direction;
  context.textAlign = align;
  context.textBaseline = "middle";
  context.font = `${weight} ${size}px ${fontFamily}`;
  context.fillStyle = color;

  let output = String(value ?? "");

  if (Number.isFinite(maxWidth) && maxWidth > 0) {
    const measured = context.measureText(output).width;
    if (measured > maxWidth) {
      const suffix = "…";
      while (output.length > 1 && context.measureText(output + suffix).width > maxWidth) {
        output = output.slice(0, -1);
      }
      output += suffix;
    }
  }

  context.fillText(output, x, y);
  context.restore();
  return output;
}

function drawLuxuryGradientBg(context, x, y, width, height, colorStart, colorEnd, radius = 12) {
  context.fillStyle = colorStart || colorEnd || LUXURY_COLORS.bgLight;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawLuxuryBorder(context, x, y, width, height, color = LUXURY_COLORS.accent, lineWidth = 2.5, radius = 12) {
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.stroke();
}

// ═══════════════════════════════════════════════════════════════════════════
//  الفاتورة الحرارية - رسم Canvas احتياطي
// ═══════════════════════════════════════════════════════════════════════════
function drawThermalInvoiceCanvas({ invoice, customer, storeName, storeInfo, logoImage, formatMoney, formatAmount, formatDateTime, paymentLabel }) {
  const mm = 12;
  const width = 80 * mm;
  const details = invoice.customerName ? 1 + Number(Boolean(customer?.phone)) + Number(Boolean(customer?.address)) : 0;
  const height = Math.max(1750, (200 + details * 15 + Math.max(1, invoice.items?.length || 0) * 28 + (logoImage ? 20 : 0) + (toNumber(invoice.deliveryFee) > 0 ? 13 : 0)) * mm);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const right = 76 * mm;
  const left = 4 * mm;
  const center = 40 * mm;
  let y = 10 * mm;

  const thermalFontScale = 1.5;

  const text = (value, x, align = "right", size = 32, weight = 400, direction = "rtl", color = LUXURY_COLORS.textDark) => {
    drawLuxuryText(context, value, x, y, { align, size: Math.round(size * thermalFontScale), weight, color, direction, maxWidth: right - left });
  };

  const divider = (color = LUXURY_COLORS.primary) => {
    context.save();
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.setLineDash([8, 4]);
    context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
    context.restore();
  };

  const pair = (label, value, options = {}) => {
    const labelSize = options.labelSize || 30;
    const valueSize = options.valueSize || 30;
    const gap = options.gap || 9 * mm;
    const maxW = (right - left) / 2 - 2 * mm;

    drawLuxuryText(context, label, right - 2*mm, y, { align: "right", size: Math.round(labelSize * thermalFontScale), weight: options.bold ? 700 : 500, color: LUXURY_COLORS.textMuted, maxWidth: maxW });
    drawLuxuryText(context, value, left + 2*mm, y, { align: "left", size: Math.round(valueSize * thermalFontScale), weight: options.bold ? 700 : 600, color: options.color || LUXURY_COLORS.textDark, direction: options.ltr ? "ltr" : "rtl", maxWidth: maxW });
    y += gap;
  };

  if (logoImage) { 
    drawStoreLogo(context, logoImage, center, y + 8 * mm, 16 * mm); 
    y += 19 * mm; 
  }

  drawLuxuryText(context, storeName || "حسابي", center, y, { align: "center", size: Math.round(48 * thermalFontScale), weight: 800, color: LUXURY_COLORS.primary, maxWidth: right - left });
  y += 10 * mm;

  if (storeInfo?.storePhone || storeInfo?.storeAddress) {
    const contact = [storeInfo?.storePhone ? `هاتف: ${storeInfo.storePhone}` : "", storeInfo?.storeAddress].filter(Boolean).join(" · ");
    drawLuxuryText(context, contact, center, y, { align: "center", size: Math.round(20 * thermalFontScale), weight: 500, color: LUXURY_COLORS.textMuted, maxWidth: right - left });
    y += 7 * mm;
  }

  drawLuxuryText(context, "فاتورة بيع", right - 2*mm, y, { align: "right", size: Math.round(36 * thermalFontScale), weight: 700, color: LUXURY_COLORS.primary });
  drawLuxuryText(context, invoice.invoiceNumber, left + 2*mm, y, { align: "left", size: Math.round(32 * thermalFontScale), weight: 700, color: LUXURY_COLORS.textDark, direction: "ltr" });
  y += 7 * mm;

  drawLuxuryText(context, formatDateTime(invoice.date), center, y, { align: "center", size: Math.round(24 * thermalFontScale), weight: 400, color: LUXURY_COLORS.textMuted });
  y += 8 * mm;

  drawLuxuryGradientBg(context, left, y - 5*mm, right - left, 14*mm, LUXURY_COLORS.bgCard, LUXURY_COLORS.bgLight, 8);
  drawLuxuryBorder(context, left, y - 5*mm, right - left, 14*mm, LUXURY_COLORS.border, 1.5, 8);
  pair("الكاشير المنفذ", invoice.cashierName || "الأدمن", { gap: 7 * mm });
  y += 2 * mm;

  if (invoice.customerName) {
    const cardHeight = (9 + details * 9) * mm;
    drawLuxuryGradientBg(context, left, y - 5*mm, right - left, cardHeight, LUXURY_COLORS.bgCard, LUXURY_COLORS.bgLight, 8);
    drawLuxuryBorder(context, left, y - 5*mm, right - left, cardHeight, LUXURY_COLORS.primaryLight, 2, 8);
    drawLuxuryText(context, "بيانات العميل", right - 3*mm, y + 2*mm, { align: "right", size: Math.round(34 * thermalFontScale), weight: 700, color: LUXURY_COLORS.primary });
    y += 8 * mm;
    pair("الاسم", invoice.customerName, { gap: 7 * mm });
    if (customer?.phone) pair("الهاتف", customer.phone, { ltr: true, gap: 7 * mm });
    if (customer?.address) pair("العنوان", customer.address, { gap: 7 * mm });
    y += 2 * mm;
  }

  divider(); y += 8 * mm;

  for (const item of invoice.items || []) {
    const itemMaxW = right - left - 4*mm;
    drawLuxuryText(context, item.productName, right - 2*mm, y, { align: "right", size: Math.round(34 * thermalFontScale), weight: 700, color: LUXURY_COLORS.textDark, maxWidth: itemMaxW * 0.65 });
    drawLuxuryText(context, formatMoney(item.total), left + 2*mm, y, { align: "left", size: Math.round(32 * thermalFontScale), weight: 700, color: LUXURY_COLORS.primary, direction: "ltr", maxWidth: itemMaxW * 0.35 });
    y += 9 * mm;
    drawLuxuryText(context, `${formatAmount(item.quantity)} ${item.unit} × ${formatMoney(item.unitPrice)}`, right - 2*mm, y, { align: "right", size: Math.round(26 * thermalFontScale), weight: 400, color: LUXURY_COLORS.textMuted });
    y += 11 * mm;
  }

  divider(); y += 9 * mm;

  pair("الإجمالي قبل الخصم", formatMoney(invoice.subtotal));
  pair("الخصم", formatMoney(invoice.discount));
  if (toNumber(invoice.deliveryFee) > 0) pair(`التوصيل`, formatMoney(invoice.deliveryFee));

  context.strokeStyle = LUXURY_COLORS.primary;
  context.lineWidth = 2;
  context.beginPath(); context.moveTo(left, y - 4*mm); context.lineTo(right, y - 4*mm); context.stroke();
  context.strokeStyle = LUXURY_COLORS.accent;
  context.lineWidth = 1;
  context.beginPath(); context.moveTo(left, y - 3*mm); context.lineTo(right, y - 3*mm); context.stroke();

  pair("الإجمالي", formatMoney(invoice.total), { bold: true, labelSize: 38, valueSize: 38, color: LUXURY_COLORS.primary, gap: 8 * mm });
  pair("طريقة السداد", paymentLabel);
  pair("حالة السداد", invoice.paymentStatus || (invoice.paymentType === "آجل" ? "آجل" : "مدفوعة"));
  pair("المدفوع", formatMoney(invoice.paidAmount));
  if (invoice.paymentType === "آجل") pair("المتبقي", formatMoney(invoice.remainingAmount), { color: LUXURY_COLORS.red });

  y += 4 * mm;
  drawLuxuryText(context, "شكرًا لتعاملكم معنا", center, y, { align: "center", size: Math.round(28 * thermalFontScale), weight: 500, color: LUXURY_COLORS.textMuted });

  drawPdfFooter(context, { center, width, height, y: height - 18 * mm });
  return canvas;
}

// ═══════════════════════════════════════════════════════════════════════════
//  فاتورة الشراء - رسم Canvas احتياطي
// ═══════════════════════════════════════════════════════════════════════════
function drawPurchaseInvoiceCanvas({ purchase, supplier, storeName, storeInfo, logoImage, formatMoney, formatAmount, formatDateTime }) {
  const mm = 12;
  const width = 210 * mm;
  const left = 14 * mm;
  const right = 196 * mm;
  const center = width / 2;
  const fontScale = 3.2;
  const lineHeight = 9 * mm;
  const itemHeight = 52 * mm;
  const items = purchase.items || [];
  const height = Math.max(297 * mm, (80 + Math.max(1, items.length) * 52 + 115) * mm);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.textBaseline = "middle";

  const text = (value, x, y, align = "right", size = 30, weight = 400, direction = "rtl", color = LUXURY_COLORS.textDark, maxWidth = Infinity) => {
    return drawLuxuryText(context, value, x, y, { align, size: Math.round(size * fontScale / 3), weight, color, direction, maxWidth });
  };

  const wrapped = (value, x, y, maxWidth, options = {}) => {
    const words = String(value ?? "").split(/\s+/).filter(Boolean);
    const rows = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (current && context.measureText(next).width > maxWidth) { rows.push(current); current = word; } else current = next;
    });
    if (current || !rows.length) rows.push(current);
    rows.slice(0, options.maxRows || 3).forEach((row, index) => 
      text(row, x, y + index * (options.lineHeight || 7 * mm), options.align || "right", options.size || 26, options.weight || 400, options.direction || "rtl", options.color || LUXURY_COLORS.textDark)
    );
    return Math.min(rows.length, options.maxRows || 3);
  };

  const rule = (y, color = LUXURY_COLORS.primary) => { 
    context.strokeStyle = color; 
    context.lineWidth = 2.5; 
    context.beginPath(); 
    context.moveTo(left, y); 
    context.lineTo(right, y); 
    context.stroke(); 
  };

  const vline = (x, y1, y2, color = LUXURY_COLORS.border) => { 
    context.strokeStyle = color; 
    context.lineWidth = 1.5; 
    context.beginPath(); 
    context.moveTo(x, y1); 
    context.lineTo(x, y2); 
    context.stroke(); 
  };

  const luxuryBox = (top, boxHeight, fill = LUXURY_COLORS.bgCard) => { 
    drawLuxuryGradientBg(context, left, top, right - left, boxHeight, fill, LUXURY_COLORS.bgLight, 12);
    drawLuxuryBorder(context, left, top, right - left, boxHeight, LUXURY_COLORS.border, 2, 12);
  };

  const pair = (label, value, y, options = {}) => { 
    const maxW = (right - left) / 2 - 10 * mm;
    text(label, right - 6 * mm, y, "right", options.labelSize || 28, options.labelWeight || 600, "rtl", LUXURY_COLORS.textMuted, maxW); 
    text(value, left + 6 * mm, y, "left", options.valueSize || 30, options.valueWeight || 700, options.ltr ? "ltr" : "rtl", options.color || LUXURY_COLORS.textDark, maxW); 
  };

  let y = 20 * mm;
  drawLuxuryGradientBg(context, left - 4*mm, y - 8*mm, right - left + 8*mm, 50*mm, LUXURY_COLORS.primary, LUXURY_COLORS.primaryLight, 16);

  if (logoImage) drawStoreLogo(context, logoImage, center, y + 6 * mm, 24 * mm);

  drawLuxuryText(context, storeName || "حسابي", center, y + 22 * mm, { align: "center", size: 52, weight: 800, color: "#ffffff", maxWidth: right - left - 20*mm });

  context.strokeStyle = LUXURY_COLORS.accent;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(center - 40*mm, y + 28*mm);
  context.lineTo(center + 40*mm, y + 28*mm);
  context.stroke();

  drawStoreDetails(context, { storeInfo, right: right - 8*mm, top: y + 2 * mm, width: width - 16*mm });
  drawLuxuryText(context, "فاتورة شراء", center, y + 38 * mm, { align: "center", size: 36, weight: 700, color: LUXURY_COLORS.accentLight });

  text(`رقم الفاتورة: ${purchase.invoiceNumber || "—"}`, left + 6*mm, y + 8 * mm, "left", 28, 700, "ltr", "#ffffff");
  text(formatDateTime(purchase.date), left + 6*mm, y + 18 * mm, "left", 24, 400, "ltr", LUXURY_COLORS.accentLight);

  y += 55 * mm;

  const supplierLines = [
    ["اسم المورد", purchase.supplierName || supplier?.name || "بدون مورد", false],
    ["الهاتف", supplier?.phone || purchase.supplierPhone || "غير متوفر", true],
    ["العنوان", supplier?.address || purchase.supplierAddress || "غير متوفر", false],
  ];
  const supplierRows = supplierLines.filter(([, value], index) => index === 0 || value !== "غير متوفر");
  const supplierBoxHeight = (supplierRows.length * 9 + 12) * mm;
  luxuryBox(y, supplierBoxHeight);
  text("بيانات المورد", right - 6 * mm, y + 9 * mm, "right", 34, 700, "rtl", LUXURY_COLORS.primary);
  y += 18 * mm;
  supplierRows.forEach(([label, value, ltr]) => { pair(label, value, y, { ltr, valueSize: 28 }); y += lineHeight; });
  y += 8 * mm;

  const colBounds = [right, 138 * mm, 117 * mm, 85 * mm, 53 * mm, left];
  const tableTop = y;

  drawLuxuryGradientBg(context, left, tableTop, right - left, 14 * mm, LUXURY_COLORS.primary, LUXURY_COLORS.primaryLight, 0);

  const headerMaxW = [62*mm, 20*mm, 28*mm, 28*mm, 25*mm];
  text("الصنف", right - 5 * mm, tableTop + 7 * mm, "right", 28, 700, "rtl", "#ffffff", headerMaxW[0]);
  text("الكمية", 132 * mm, tableTop + 7 * mm, "right", 28, 700, "rtl", "#ffffff", headerMaxW[1]);
  text("سعر الشراء", 101 * mm, tableTop + 7 * mm, "right", 28, 700, "rtl", "#ffffff", headerMaxW[2]);
  text("سعر البيع", 69 * mm, tableTop + 7 * mm, "right", 28, 700, "rtl", "#ffffff", headerMaxW[3]);
  text("الإجمالي", left + 5 * mm, tableTop + 7 * mm, "left", 28, 700, "rtl", "#ffffff", headerMaxW[4]);

  colBounds.slice(1, -1).forEach((x) => vline(x, tableTop, tableTop + 14 * mm, "rgba(255,255,255,0.4)"));
  y += 14 * mm;

  items.forEach((item, index) => {
    if (index % 2 === 0) { 
      context.fillStyle = LUXURY_COLORS.bgLight; 
      context.fillRect(left, y, right - left, itemHeight); 
    }

    context.save();
    context.font = `700 ${Math.round(26 * fontScale / 3)}px "HesabiArabicPdf", "Noto Naskh Arabic", Tahoma, Arial, sans-serif`;
    const itemNameRows = wrapped(item.productName || "", right - 5 * mm, y + 8 * mm, 62 * mm, { size: 26, weight: 700, maxRows: 2 });
    context.restore();

    text(`${formatAmount(item.quantity)} ${item.unit || ""}`, 132 * mm, y + 9 * mm, "right", 25, 600, "rtl", LUXURY_COLORS.textDark, 20*mm);
    text(formatMoney(item.unitCost), 101 * mm, y + 9 * mm, "right", 25, 600, "ltr", LUXURY_COLORS.textDark, 28*mm);
    text(formatMoney(item.salePrice ?? 0), 69 * mm, y + 9 * mm, "right", 25, 700, "ltr", LUXURY_COLORS.primary, 28*mm);
    text(formatMoney(item.total), left + 5 * mm, y + 9 * mm, "left", 25, 700, "ltr", LUXURY_COLORS.textDark, 25*mm);

    let detailY = y + (itemNameRows > 1 ? 20 : 16) * mm;
    const purchaseDetails = [
      item.packageQuantity ? `العبوات: ${formatAmount(item.packageQuantity)} ${item.packageUnit || "عبوة"}` : "",
      item.unitsPerPackage ? `الوحدات/العبوة: ${formatAmount(item.unitsPerPackage)}` : "",
      item.packageCost !== undefined ? `سعر العبوة: ${formatMoney(item.packageCost)}` : "",
      item.batchNumber ? `التشغيلة: ${item.batchNumber}` : "",
      item.productionDate ? `الإنتاج: ${item.productionDate}` : "",
      item.expiryDate ? `الانتهاء: ${item.expiryDate}` : "",
      toNumber(item.returnedQuantity) ? `المرتجع: ${formatAmount(item.returnedQuantity)}` : "",
    ].filter(Boolean).join(" · ");

    if (purchaseDetails) { 
      context.font = `400 ${Math.round(22 * fontScale / 3)}px "HesabiArabicPdf", "Noto Naskh Arabic", Tahoma, Arial, sans-serif`; 
      wrapped(purchaseDetails, right - 5 * mm, detailY, right - left - 10 * mm, { size: 22, maxRows: 2, lineHeight: 8 * mm, color: LUXURY_COLORS.textMuted }); 
    }

    y += itemHeight;
    colBounds.slice(1, -1).forEach((x) => vline(x, y - itemHeight, y, LUXURY_COLORS.border));
    rule(y, LUXURY_COLORS.border);
  });

  colBounds.forEach((x) => vline(x, tableTop, y, LUXURY_COLORS.primaryLight));
  rule(tableTop, LUXURY_COLORS.primary);
  rule(y, LUXURY_COLORS.primary);

  y += 10 * mm;

  const summaryTop = y;
  const summaryRows = [
    ["الإجمالي قبل الخصم", formatMoney(purchase.subtotal ?? purchase.total), false],
    ["الخصم", formatMoney(purchase.discount || 0), false],
    ["إجمالي الفاتورة", formatMoney(purchase.total), true],
    ["إجمالي المرتجعات", formatMoney(purchase.returnedTotal || 0), false],
    ["طريقة الدفع", purchase.paymentType || "نقدي", false],
    ["وسيلة الدفع", purchase.paymentMethod || "نقدي", false],
    ["حالة السداد", purchase.paymentStatus || "مدفوعة", false],
    ["المبلغ المدفوع", formatMoney(purchase.paidAmount), false],
    ["المتبقي", formatMoney(purchase.remainingAmount), false],
  ];
  const summaryHeight = (summaryRows.length * 9 + 12) * mm;

  luxuryBox(summaryTop, summaryHeight, LUXURY_COLORS.bgCard);

  y += 12 * mm;
  summaryRows.forEach(([label, value, strong]) => { 
    pair(label, value, y, { 
      bold: strong, 
      labelSize: strong ? 32 : 26, 
      valueSize: strong ? 34 : 28, 
      ltr: !/[ء-ي]/.test(value),
      color: strong ? LUXURY_COLORS.primary : LUXURY_COLORS.textDark
    }); 
    y += lineHeight; 
    if (strong) {
      context.strokeStyle = LUXURY_COLORS.accent;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(left + 5*mm, y - 4 * mm);
      context.lineTo(right - 5*mm, y - 4 * mm);
      context.stroke();
    }
  });
  y += 6 * mm;

  if (purchase.notes) { 
    text("ملاحظات", right, y, "right", 28, 700, "rtl", LUXURY_COLORS.primary); 
    y += 8 * mm; 
    context.font = `400 ${Math.round(24 * fontScale / 3)}px "HesabiArabicPdf", "Noto Naskh Arabic", Tahoma, Arial, sans-serif`; 
    wrapped(purchase.notes, right, y, right - left, { size: 24, maxRows: 3, lineHeight: 8 * mm, color: LUXURY_COLORS.textMuted }); 
    y += 24 * mm; 
  }

  drawPdfFooter(context, { center, width, height, y: height - 18 * mm });
  return canvas;
}

// ═══════════════════════════════════════════════════════════════════════════
//  كشف حساب العميل - رسم Canvas احتياطي
// ═══════════════════════════════════════════════════════════════════════════
function drawCustomerAccountCanvas({ account, storeName, storeInfo, logoImage, formatMoney, formatDateTime }) {
  const mm = 12;
  const width = 210 * mm;
  const rows = account.transactions || [];
  const height = Math.max(297 * mm, (150 + Math.max(1, rows.length) * 18) * mm);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.textBaseline = "middle";

  const right = 196 * mm;
  const left = 14 * mm;
  const center = width / 2;

  const text = (value, x, y, align = "right", size = 34, weight = 400, direction = "rtl", color = LUXURY_COLORS.textDark, maxWidth = Infinity) => {
    return drawLuxuryText(context, value, x, y, { align, size, weight, color, direction, maxWidth });
  };

  const line = (fromX, fromY, toX, toY, color = LUXURY_COLORS.border, widthPx = 2) => { 
    context.strokeStyle = color; 
    context.lineWidth = widthPx; 
    context.beginPath(); 
    context.moveTo(fromX, fromY); 
    context.lineTo(toX, toY); 
    context.stroke(); 
  };

  let y = 22 * mm;
  drawLuxuryGradientBg(context, left - 4*mm, y - 10*mm, right - left + 8*mm, 45*mm, LUXURY_COLORS.primary, LUXURY_COLORS.primaryLight, 16);

  if (logoImage) drawStoreLogo(context, logoImage, center, y + 5 * mm, 26 * mm);

  drawLuxuryText(context, storeName || "حسابي", center, y + 20 * mm, { align: "center", size: 56, weight: 800, color: "#ffffff", maxWidth: right - left - 20*mm });

  context.strokeStyle = LUXURY_COLORS.accent;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(center - 45*mm, y + 26*mm);
  context.lineTo(center + 45*mm, y + 26*mm);
  context.stroke();

  drawStoreDetails(context, { storeInfo, right: right - 8*mm, top: y + 2 * mm, width: width - 16*mm });
  y += 50 * mm;

  drawLuxuryText(context, "كشف حساب مديونية عميل", center, y, { align: "center", size: 44, weight: 700, color: LUXURY_COLORS.primary });
  y += 12 * mm;
  text(`تاريخ الإنشاء: ${formatDateTime(new Date().toISOString())}`, right, y, "right", 28, 400, "rtl", LUXURY_COLORS.textMuted);
  y += 12 * mm;

  const cardTop = y - 6 * mm;
  const hasPhone = Boolean(account.customer?.phone);
  const hasAddress = Boolean(account.customer?.address);
  const cardHeight = (hasPhone && hasAddress ? 55 : hasPhone || hasAddress ? 43 : 33) * mm;

  drawLuxuryGradientBg(context, left, cardTop, right - left, cardHeight, "#e8f5f0", LUXURY_COLORS.bgLight, 14);
  drawLuxuryBorder(context, left, cardTop, right - left, cardHeight, LUXURY_COLORS.primaryLight, 3, 14);

  context.fillStyle = LUXURY_COLORS.accent;
  context.fillRect(right - 3*mm, cardTop + 5*mm, 3*mm, cardHeight - 10*mm);

  text("بيانات العميل", right - 8 * mm, y + 3 * mm, "right", 40, 700, "rtl", LUXURY_COLORS.primary);
  y += 14 * mm;

  const detail = (label, value, ltr = false) => { 
    const maxW = (right - left) / 2 - 15 * mm;
    text(label, right - 8 * mm, y, "right", 32, 600, "rtl", LUXURY_COLORS.textMuted, maxW); 
    text(value, left + 8 * mm, y, "left", 38, 700, ltr ? "ltr" : "rtl", LUXURY_COLORS.textDark, maxW); 
    y += 11 * mm; 
  };

  detail("الاسم", account.customer?.name || "");
  if (hasPhone) detail("الهاتف", account.customer.phone, true);
  if (hasAddress) detail("العنوان", account.customer.address);
  y = cardTop + cardHeight + 15 * mm;

  const summary = [
    ["إجمالي المبيعات الآجلة", formatMoney(account.totalSales), LUXURY_COLORS.bgCard, LUXURY_COLORS.textDark, LUXURY_COLORS.border],
    ["إجمالي المسدد", formatMoney(account.totalPaid), LUXURY_COLORS.bgCard, LUXURY_COLORS.textDark, LUXURY_COLORS.border],
    ["الرصيد المستحق", formatMoney(account.balance), LUXURY_COLORS.primary, "#ffffff", LUXURY_COLORS.primary],
  ];
  const boxGap = 5 * mm;
  const boxWidth = (right - left - boxGap * 2) / 3;

  summary.forEach(([label, value, background, color, borderColor], index) => {
    const x = right - (index + 1) * boxWidth - index * boxGap;
    drawLuxuryGradientBg(context, x, y, boxWidth, 32 * mm, background, background === LUXURY_COLORS.primary ? LUXURY_COLORS.primaryLight : "#ffffff", 12);
    drawLuxuryBorder(context, x, y, boxWidth, 32 * mm, borderColor, 2, 12);
    text(label, x + boxWidth - 5 * mm, y + 10 * mm, "right", 26, 600, "rtl", color, boxWidth - 10*mm);
    text(value, x + boxWidth - 5 * mm, y + 22 * mm, "right", 38, 700, "rtl", color, boxWidth - 10*mm);
  });
  y += 45 * mm;

  drawLuxuryText(context, "تفاصيل العمليات", right, y, "right", 44, 700, "rtl", LUXURY_COLORS.primary);
  y += 10 * mm;

  const columns = [right, 151 * mm, 105 * mm, 59 * mm, left];
  const colBoundsAcct = [right + 2 * mm, 165 * mm, 130 * mm, 85 * mm, 40 * mm, left - 2 * mm];
  const tableTopAcct = y - 8 * mm;
  const rowHeightAcct = 14 * mm;

  drawLuxuryGradientBg(context, left, tableTopAcct, right - left, rowHeightAcct, LUXURY_COLORS.primary, LUXURY_COLORS.primaryLight, 0);

  const acctHeaders = ["العملية", "التاريخ", "المرجع", "القيمة", "الرصيد بعد العملية"];
  const acctMaxW = [35*mm, 30*mm, 25*mm, 25*mm, 30*mm];
  acctHeaders.forEach((label, index) => 
    text(label, columns[index] - (index ? 3 * mm : 0), tableTopAcct + rowHeightAcct/2, index === 4 ? "left" : "right", 28, 700, "rtl", "#ffffff", acctMaxW[index])
  );

  colBoundsAcct.slice(1, -1).forEach((x) => line(x, tableTopAcct, x, tableTopAcct + rowHeightAcct, "rgba(255,255,255,0.4)", 1.5));
  y = tableTopAcct + rowHeightAcct;

  if (!rows.length) { 
    text("لا توجد عمليات مسجلة.", right, y + 10 * mm, "right", 34, 400, "rtl", LUXURY_COLORS.textMuted); 
    y += 22 * mm; 
  }

  rows.forEach((transaction, index) => {
    const rowTop = y;
    if (index % 2 === 1) { 
      context.fillStyle = LUXURY_COLORS.bgLight; 
      context.fillRect(left, rowTop, right - left, rowHeightAcct); 
    }
    const textY = rowTop + rowHeightAcct / 2;
    const maxCellW = 28 * mm;

    text(transaction.typeLabel || transaction.type || "", columns[0], textY, "right", 30, 700, "rtl", LUXURY_COLORS.textDark, maxCellW);
    text(formatDateTime(transaction.date), columns[1], textY, "right", 26, 400, "rtl", LUXURY_COLORS.textMuted, maxCellW);
    text(transaction.invoiceNumber || "—", columns[2], textY, "right", 28, 600, "ltr", LUXURY_COLORS.textMuted, maxCellW);
    text(formatMoney(transaction.amount), columns[3], textY, "right", 30, 700, "ltr", Number(transaction.amount) < 0 ? LUXURY_COLORS.red : LUXURY_COLORS.textDark, maxCellW);
    text(formatMoney(transaction.remainingAmount), columns[4], textY, "left", 30, 700, "ltr", LUXURY_COLORS.textDark, maxCellW);

    y += rowHeightAcct;
    line(left, y, right, y, LUXURY_COLORS.border, 1.5);
  });

  colBoundsAcct.forEach((x) => line(x, tableTopAcct, x, y, LUXURY_COLORS.primaryLight, 2));
  line(left, tableTopAcct, right, tableTopAcct, LUXURY_COLORS.primary, 2.5);
  line(left, y, right, y, LUXURY_COLORS.primary, 2.5);

  y += 8 * mm;
  drawPdfFooter(context, { center: width / 2, width, height, y: height - 18 * mm });
  return canvas;
}

// ═══════════════════════════════════════════════════════════════════════════
//  التقارير المالية - رسم Canvas احتياطي
// ═══════════════════════════════════════════════════════════════════════════
function drawReportCanvas({ rows, storeName, storeInfo, logoImage, from, to }) {
  const mm = 12, wide = rows[0]?.length > 6, width = (wide ? 297 : 210) * mm, pageHeight = (wide ? 210 : 297) * mm, left = 14 * mm, right = width - left, center = width / 2;
  const headerHeight = (wide ? 72 : 78) * mm, rowHeight = (wide ? 26 : 24) * mm;
  const tableFont = wide ? 20 : 30, bodyFont = wide ? 18 : 28;
  const footerReserve = 28 * mm;
  const rowsPerPage = Math.max(1, Math.floor((pageHeight - headerHeight - footerReserve - rowHeight) / rowHeight));
  const bodyRows = rows.slice(1), pageCount = Math.max(1, Math.ceil(bodyRows.length / rowsPerPage));
  const canvas = document.createElement('canvas'); 
  canvas.width = width; 
  canvas.height = pageCount * pageHeight;
  const context = canvas.getContext('2d'); 
  context.fillStyle = '#fff'; 
  context.fillRect(0, 0, width, canvas.height); 
  context.textBaseline = 'middle';

  const text = (value, x, y, align='right', size=34, weight=400, color=LUXURY_COLORS.textDark, direction='rtl', maxWidth=Infinity) => {
    return drawLuxuryText(context, value, x, y, { align, size, weight, color, direction, maxWidth });
  };

  const line = (x1,y1,x2,y2,color=LUXURY_COLORS.primary,w=2) => { 
    context.strokeStyle=color; 
    context.lineWidth=w; 
    context.beginPath(); 
    context.moveTo(x1,y1); 
    context.lineTo(x2,y2); 
    context.stroke(); 
  };

  const xFor = count => Array.from({length: Math.max(2,count)}, (_,i) => right - 5*mm - i*((right-left-10*mm)/Math.max(1,count-1)));

  const drawHeader = (page, xs) => {
    const top = page * pageHeight; 

    drawLuxuryGradientBg(context, left, top + 8*mm, right - left, 35*mm, LUXURY_COLORS.primary, LUXURY_COLORS.primaryLight, 14);
    drawLuxuryBorder(context, left, top + 8*mm, right - left, 35*mm, LUXURY_COLORS.accent, 2.5, 14);

    if (logoImage) drawStoreLogo(context, logoImage, center, top + 22*mm, 22*mm);

    text(storeName || 'حسابي', right - 8*mm, top + 16*mm, 'right', 40, 800, '#ffffff', 'rtl', right - left - 30*mm); 
    text('تقرير مالي وتحليلي', right - 8*mm, top + 27*mm, 'right', 28, 600, LUXURY_COLORS.accentLight, 'rtl', 100*mm);

    text('Hesabi · Store Report', left + 8*mm, top + 16*mm, 'left', 32, 700, '#ffffff', 'ltr', 80*mm); 
    text(`${from||'بداية السجل'} - ${to||'اليوم'}`, left + 8*mm, top + 27*mm, 'left', 26, 500, LUXURY_COLORS.accentLight, 'ltr', 80*mm);

    line(left, top + 48*mm, right, top + 48*mm, LUXURY_COLORS.accent, 2);
    text(`الفترة: ${from||'بداية السجل'} إلى ${to||'اليوم'}`, center, top + 55*mm, 'center', 34, 700, LUXURY_COLORS.primary, 'rtl', 170*mm); 
    text(`صفحة ${page+1} من ${pageCount}`, center, top + 66*mm, 'center', 24, 400, LUXURY_COLORS.textMuted, 'rtl', 170*mm);

    const tableTop = top + headerHeight, count = xs.length, bounds = [left, ...xs.slice(1).map((x,i)=>(x+xs[i])/2), right];
    drawLuxuryGradientBg(context, left, tableTop, right - left, rowHeight, LUXURY_COLORS.primary, LUXURY_COLORS.primaryLight, 0);

    rows[0].forEach((value, i) => { 
      const cellLeft = bounds[count-1-i], cellRight = bounds[count-i];
      const cellMaxW = Math.max(20, Math.abs(cellRight - cellLeft) - 4*mm);
      text(value, xs[i], tableTop + rowHeight/2, i === 0 ? 'right' : 'center', tableFont, 700, '#ffffff', i === 0 ? 'rtl' : 'ltr', cellMaxW); 
      if (i) line(cellLeft, tableTop, cellLeft, tableTop + rowHeight, 'rgba(255,255,255,0.4)', 1.5); 
    });

    return { y: tableTop + rowHeight, bounds };
  };

  for (let page = 0; page < pageCount; page++) { 
    const xs = xFor(rows[0].length), header = drawHeader(page, xs); 
    let y = header.y; 
    const bodyTop = y; 
    const pageRows = bodyRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage); 

    pageRows.forEach((row, i) => { 
      const count = xs.length; 
      if (i % 2) { 
        context.fillStyle = LUXURY_COLORS.bgLight; 
        context.fillRect(left, y, right - left, rowHeight); 
      } 
      line(left, y, right, y, LUXURY_COLORS.border, 1.5); 

      row.forEach((value, col) => { 
        const cellLeft = header.bounds[count-1-col], cellRight = header.bounds[count-col];
        const cellMaxW = Math.max(20, Math.abs(cellRight - cellLeft) - 4*mm);
        text(value, xs[col], y + rowHeight/2, col === 0 ? 'right' : 'center', bodyFont, col === 0 ? 600 : 700, /^[-−]/.test(String(value)) ? LUXURY_COLORS.red : LUXURY_COLORS.textDark, col === 0 ? 'rtl' : 'ltr', cellMaxW); 
      }); 
      y += rowHeight; 
    }); 

    line(left, y, right, y, LUXURY_COLORS.primary, 2.5); 
    header.bounds.forEach((x) => line(x, bodyTop, x, y, LUXURY_COLORS.primaryLight, 1.5)); 
    line(left, page * pageHeight + headerHeight, left, y, LUXURY_COLORS.primary, 2); 
    line(right, page * pageHeight + headerHeight, right, y, LUXURY_COLORS.primary, 2); 

    drawPdfFooter(context, { center, width, height: canvas.height, y: (page + 1) * pageHeight - 15 * mm }); 
  }

  return canvas;
}

function createA4PdfFromCanvas(canvas, orientation = "portrait") {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation, compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pixelsPerMm = canvas.width / pageWidth;
  const pageHeightPx = Math.max(1, Math.ceil(pageHeight * pixelsPerMm));
  for (let offsetY = 0; offsetY < canvas.height; offsetY += pageHeightPx) {
    if (offsetY) pdf.addPage();
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
    const slice = document.createElement("canvas");
    slice.width = canvas.width; slice.height = sliceHeight;
    slice.getContext("2d").drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageWidth, sliceHeight / pixelsPerMm, undefined, "FAST");
  }
  return pdf;
}

function getSafeStageBreakPoints(stage, canvas) {
  const stageRect = stage.getBoundingClientRect();
  if (!stageRect.height) return [];

  const scaleY = canvas.height / stageRect.height;
  const breakElements = stage.querySelectorAll("tr, tbody, thead, tfoot, .party-card, .supplier-card, .customer-card, .kpi-card, .summary, .payment-info, .notes, .report-signatures, .report-footer, .report-header, h1, h2, h3, section, article");

  const breakPoints = new Set();

  breakElements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const relativeTop = (rect.top - stageRect.top) * scaleY;
    const relativeBottom = (rect.bottom - stageRect.top) * scaleY;

    if (relativeTop > 10 && relativeTop < canvas.height - 10) {
      breakPoints.add(Math.round(relativeTop));
    }
    if (relativeBottom > 10 && relativeBottom < canvas.height - 10) {
      breakPoints.add(Math.round(relativeBottom));
    }
  });

  return Array.from(breakPoints).sort((a, b) => a - b);
}

function findBestSliceHeight(offsetY, maxUsableHeightPx, totalCanvasHeight, safeBreakPoints) {
  const remainingHeight = totalCanvasHeight - offsetY;
  if (remainingHeight <= maxUsableHeightPx) {
    return remainingHeight;
  }

  const targetLimitY = offsetY + maxUsableHeightPx;
  const minThresholdY = offsetY + maxUsableHeightPx * 0.65;

  let bestCutY = 0;
  for (let i = safeBreakPoints.length - 1; i >= 0; i--) {
    const breakY = safeBreakPoints[i];
    if (breakY <= targetLimitY && breakY >= minThresholdY) {
      bestCutY = breakY;
      break;
    }
  }

  if (bestCutY > offsetY) {
    return bestCutY - offsetY;
  }

  return maxUsableHeightPx;
}

export async function createPdfFileFromHtml({ html, filename, page = "a4" }) {
  await loadCanvasArabicFont();
  const stage = createPdfStage(html, page);
  try {
    await waitForPdfStage(stage);
    const canvas = await html2canvas(stage, { scale: Math.max(3, window.devicePixelRatio || 1), useCORS: true, backgroundColor: "#ffffff", logging: false, windowWidth: stage.scrollWidth, windowHeight: stage.scrollHeight });
    if (canvas.width < 2 || canvas.height < 2) throw new Error("تعذر رسم محتوى الفاتورة لملف PDF.");
    const isThermal = page === "thermal";
    const isLandscape = stage.dataset.pdfOrientation === "landscape";
    const thermalWidth = 80;
    const thermalHeight = Math.max(40, (canvas.height * thermalWidth) / canvas.width);
    const pdf = new jsPDF({ unit: "mm", format: isThermal ? [thermalWidth, thermalHeight] : "a4", orientation: isLandscape ? "landscape" : "portrait", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pixelsPerMm = canvas.width / pageWidth;

    if (isThermal) {
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = canvas.height;
      slice.getContext("2d").drawImage(canvas, 0, 0);
      pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageWidth, (canvas.height / pixelsPerMm), undefined, "FAST");
    } else {
      // هوامش علوية وسفلية تمنع تلاصق الصفحات وتضمن عدم ضياع البيانات عند الطباعة
      const topMarginMm = isLandscape ? 10 : 12;
      const bottomMarginMm = isLandscape ? 12 : 14;
      const usableHeightMm = pageHeight - topMarginMm - bottomMarginMm;
      const usableHeightPx = Math.max(1, Math.floor(usableHeightMm * pixelsPerMm));
      const safeBreakPoints = getSafeStageBreakPoints(stage, canvas);

      let currentOffsetY = 0;
      let pageIndex = 0;

      while (currentOffsetY < canvas.height) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const sliceHeightPx = findBestSliceHeight(currentOffsetY, usableHeightPx, canvas.height, safeBreakPoints);
        const sliceHeightMm = sliceHeightPx / pixelsPerMm;

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const sliceCtx = sliceCanvas.getContext("2d");
        sliceCtx.fillStyle = "#ffffff";
        sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sliceCtx.drawImage(canvas, 0, currentOffsetY, canvas.width, sliceHeightPx, 0, 0, sliceCanvas.width, sliceHeightPx);

        pdf.addImage(
          sliceCanvas.toDataURL("image/png"),
          "PNG",
          0,
          topMarginMm,
          pageWidth,
          sliceHeightMm,
          undefined,
          "FAST"
        );

        currentOffsetY += sliceHeightPx;
        pageIndex++;
      }
    }

    const blob = pdf.output("blob");
    if (!blob || blob.size < 800) throw new Error("تعذر إنشاء ملف PDF كامل المحتوى.");
    return new File([blob], filename, { type: "application/pdf" });
  } finally {
    stage.remove();
  }
}

const escapePdfValue = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

export async function createThermalInvoicePdfFile({ invoice, customer, storeName, logoDataUrl, storeInfo, formatMoney, formatAmount, formatDateTime, paymentLabel, filename }) {
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  const html = renderThermalInvoiceHtml({ invoice, customer, storeName, logoDataUrl, storeInfo, formatMoney, formatAmount, formatDateTime, escapeHtml, paymentLabel });
  return createPdfFileFromHtml({ html, filename, page: "thermal" });
}

export async function createPurchaseInvoicePdfFile({ purchase, supplier, storeName, storeInfo, logoDataUrl, formatMoney, formatAmount, formatDateTime, filename, html }) {
  if (html) return createPdfFileFromHtml({ html, filename, page: "a4" });
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  const generatedHtml = renderPurchaseInvoiceHtml({ purchase, supplier, storeName, storeInfo, logoDataUrl, formatMoney, formatAmount, formatDateTime, escapeHtml });
  return createPdfFileFromHtml({ html: generatedHtml, filename, page: "a4" });
}

export async function createCustomerAccountPdfFile({ account, storeName, storeInfo, logoDataUrl, formatMoney, formatDateTime, filename, html }) {
  if (html) return createPdfFileFromHtml({ html, filename, page: "a4" });
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  const generatedHtml = renderCustomerAccountHtml({ account, storeName, storeInfo, logoDataUrl, formatMoney, formatDateTime, escapeHtml });
  return createPdfFileFromHtml({ html: generatedHtml, filename, page: "a4" });
}

export async function createReportPdfFile({ rows, storeName, storeInfo, logoDataUrl, from, to, title = "التقرير المالي", filename, html }) {
  if (html) return createPdfFileFromHtml({ html, filename, page: "a4" });
  const generatedHtml = renderOfficialReportHtml({ title, rows, storeName, storeInfo, logoDataUrl, from, to, generatedAt: new Date().toLocaleString("ar-YE") });
  return createPdfFileFromHtml({ html: generatedHtml, filename, page: "a4" });
}

export async function shareOrDownloadPdf({ html, filename, title, page = "a4" }) { return fileOrDownload(await createPdfFileFromHtml({ html, filename, page }), title); }
export async function shareOrDownloadReportPdf(options) { return fileOrDownload(await createReportPdfFile(options), options.title); }
export async function shareOrDownloadInvoicePdf(options) { return fileOrDownload(await createThermalInvoicePdfFile(options), options.title); }
export async function shareOrDownloadPurchaseInvoicePdf(options) { return fileOrDownload(await createPurchaseInvoicePdfFile(options), options.title); }
export async function shareOrDownloadCustomerAccountPdf(options) { return fileOrDownload(await createCustomerAccountPdfFile(options), options.title); }

export function printHtmlDocument({ html, target, features }) {
  if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
    const frame = document.createElement("iframe");
    frame.title = target || "print";
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;";
    document.body.appendChild(frame);
    const printWindow = frame.contentWindow;
    const cleanup = () => window.setTimeout(() => frame.remove(), 500);
    frame.onload = () => { printWindow?.focus(); printWindow?.print(); cleanup(); };
    frame.srcdoc = html;
    return true;
  }
  const popup = window.open("", target, features);
  if (!popup) return false;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 180);
  return true;
}
