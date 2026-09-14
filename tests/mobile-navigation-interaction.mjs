import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv[2] || "http://localhost:3000/";
const profile = await mkdtemp(join(tmpdir(), "hesabi-mobile-navigation-"));
const port = 9297;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=390,844", target], { stdio: "ignore" });

try {
  let page;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())).find((item) => item.type === "page"); } catch { /* Browser is starting. */ }
    if (page?.webSocketDebuggerUrl) break;
    await sleep(150);
  }
  assert.ok(page?.webSocketDebuggerUrl, "تعذر فتح متصفح اختبار التنقل.");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let commandId = 0;
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    const timer = setTimeout(() => reject(new Error(`انتهت مهلة ${method}.`)), 10_000);
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener("message", onMessage);
      clearTimeout(timer);
      if (message.error) { reject(new Error(message.error.message)); return; }
      if (message.result?.exceptionDetails) { reject(new Error(message.result.exceptionDetails.exception?.description || message.result.exceptionDetails.text)); return; }
      resolve(message.result);
    };
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => { try { return (await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value; } catch (error) { throw new Error(`${error.message}\nالتعبير المتعثر: ${expression}`); } };
  const waitFor = async (selector) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
      await sleep(150);
    }
    throw new Error(`لم يظهر العنصر ${selector}.`);
  };
  const waitForGone = async (selector) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (!await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
      await sleep(150);
    }
    throw new Error(`لم يختف العنصر ${selector}.`);
  };
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor('[data-action="open-setup-form"]');
  await evaluate(`(() => document.querySelector('[data-action="open-setup-form"]').click())()`);
  await waitFor("#setup-form");
  await evaluate(`(() => { const form = document.querySelector('#setup-form'); form.elements.storeName.value = 'متجر اختبار'; form.requestSubmit(); })()`);
  await waitFor("#login-form");
  await evaluate(`(() => { const form = document.querySelector('#login-form'); form.elements.username.value = 'admin'; form.elements.pin.value = '1234'; form.requestSubmit(); })()`);
  await waitFor("#required-pin-form");
  await evaluate(`(() => { const form = document.querySelector('#required-pin-form'); form.elements.pin.value = '1234'; form.elements.pinConfirm.value = '1234'; form.requestSubmit(); })()`);
  await waitFor('[data-bottom-nav] [data-view="products"]');
  const storeNameInHeader = await evaluate(`document.querySelector('.topbar .eyebrow')?.textContent?.trim()`);
  assert.equal(storeNameInHeader, 'بقالة متجر اختبار');
  await evaluate(`document.querySelector('[data-action="account-session"]').click()`);
  await waitFor('#open-local-logout-confirm');
  await evaluate(`document.querySelector('#open-local-logout-confirm').click()`);
  await waitFor('#confirm-local-logout');
  await evaluate(`document.querySelector('#confirm-local-logout').click()`);
  await waitFor('#login-form');
  await evaluate(`(() => { window.__recoveryRequests = []; const originalFetch = window.fetch.bind(window); window.fetch = async (input, init) => { if (String(input).includes('formsubmit.co/ajax/')) { window.__recoveryRequests.push({ url: String(input), data: Object.fromEntries(init.body.entries()) }); return new Response(JSON.stringify({ success: 'true' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); } return originalFetch(input, init); }; document.querySelector('[data-action="open-phone-recovery"]').click(); })()`);
  await waitFor('#phone-recovery-form');
  await evaluate(`(() => { const form = document.querySelector('#phone-recovery-form'); form.elements.phone.value = '777123456'; form.requestSubmit(); })()`);
  await waitFor('#login-form');
  const recoveryRequest = await evaluate(`window.__recoveryRequests[0]`);
  assert.equal(recoveryRequest.url, 'https://formsubmit.co/ajax/fc46f51ed31eb26af7d65edd8a313358');
  assert.equal(recoveryRequest.data.رقم_الجوال, '777123456');
  assert.match(recoveryRequest.data.التعليمات, /اتصل بصاحب الرقم/);
  await evaluate(`(() => { const form = document.querySelector('#login-form'); form.elements.username.value = 'admin'; form.elements.pin.value = '1234'; form.requestSubmit(); })()`);
  await waitFor('[data-bottom-nav] [data-view="products"]');
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="products"]').click()`);
  await waitFor('[data-action="new-product"]');
  await evaluate(`document.querySelector('[data-action="new-product"]').click()`);
  await waitFor('#product-form');
  await evaluate(`(() => { const date = new Date(); date.setDate(date.getDate() + 20); const expiry = date.toISOString().slice(0, 10); const form = document.querySelector('#product-form'); form.elements.name.value = 'منتج قريب الانتهاء'; form.elements.barcode.value = '628100000001'; form.elements.purchasePrice.value = '30'; form.elements.salePrice.value = '50'; form.elements.quantity.value = '5'; form.elements.minimumStock.value = '1'; form.elements.nearestExpiryDate.value = expiry; form.requestSubmit(); })()`);
  await waitFor('.product-card [data-action="open-product"]');
  await evaluate(`document.querySelector('.product-card [data-action="open-product"]').click()`);
  await waitFor('#product-form');
  await evaluate(`(() => { const date = new Date(); date.setDate(date.getDate() + 10); document.querySelector('#product-form').elements.nearestExpiryDate.value = date.toISOString().slice(0, 10); document.querySelector('#product-form').requestSubmit(); })()`);
  await waitFor('[data-bottom-nav] [data-view="products"]');
  let purchaseDialogOpened = false;
  for (let attempt = 0; attempt < 2 && !purchaseDialogOpened; attempt += 1) {
    await evaluate(`document.querySelector('[data-bottom-nav] [data-view="purchases"]')?.click()`);
    await waitFor('.topbar [data-action="new-purchase"]');
    await evaluate(`document.querySelector('.topbar [data-action="new-purchase"]').click()`);
    for (let check = 0; check < 20; check += 1) {
      if (await evaluate(`Boolean(document.querySelector('#purchase-product-search'))`)) { purchaseDialogOpened = true; break; }
      await sleep(150);
    }
  }
  assert.ok(purchaseDialogOpened, 'تعذر فتح فاتورة شراء جديدة لاختبار سعر بيع المنتج السابق.');
  let purchaseSearchEntered = false;
  for (let attempt = 0; attempt < 3 && !purchaseSearchEntered; attempt += 1) {
    if (!await evaluate(`Boolean(document.querySelector('#purchase-product-search'))`)) {
      await evaluate(`document.querySelector('[data-bottom-nav] [data-view="purchases"]')?.click()`);
      await waitFor('.topbar [data-action="new-purchase"]');
      await evaluate(`document.querySelector('.topbar [data-action="new-purchase"]').click()`);
      await sleep(180);
    }
    purchaseSearchEntered = await evaluate(`(() => { const search = document.querySelector('#purchase-product-search'); if (!search) return false; search.value = '628100000001'; search.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    if (!purchaseSearchEntered) await sleep(180);
  }
  assert.ok(purchaseSearchEntered, 'تعذر الوصول إلى حقل بحث الشراء بعد إعادة تحميل واجهة PWA.');
  let purchaseProductSelected = false;
  for (let attempt = 0; attempt < 8 && !purchaseProductSelected; attempt += 1) {
    const searchReady = await evaluate(`(() => { const search = document.querySelector('#purchase-product-search'); if (!search) return false; search.value = '628100000001'; search.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    if (searchReady) {
      await sleep(120);
      purchaseProductSelected = await evaluate(`(() => { const result = document.querySelector('#purchase-product-results [data-add-purchase-product]'); if (!result) return false; result.click(); return true; })()`);
    }
    if (!purchaseProductSelected) {
      if (!await evaluate(`Boolean(document.querySelector('#purchase-product-search'))`)) {
        await evaluate(`document.querySelector('[data-bottom-nav] [data-view="purchases"]')?.click()`);
        await waitFor('.topbar [data-action="new-purchase"]');
        await evaluate(`document.querySelector('.topbar [data-action="new-purchase"]').click()`);
        await waitFor('#purchase-product-search');
      }
      await sleep(180);
    }
  }
  assert.ok(purchaseProductSelected, 'تعذر اختيار نتيجة المنتج بعد إعادة عرض البحث.');
  await waitFor('#purchase-lines .purchase-line [data-purchase-sale-price]');
  const priorProductPurchaseLine = await evaluate(`(() => { const salePrice = document.querySelector('#purchase-lines .purchase-line [data-purchase-sale-price]'); const row = salePrice?.closest('.purchase-line'); const directPrice = row?.querySelector('[data-purchase-sale-price-visible="0"]'); const expiry = row?.querySelector('[data-purchase-expiry-date="0"]'); if (!salePrice || !row || !directPrice || !expiry) return null; const visibleStyle = getComputedStyle(directPrice); return { salePrice: salePrice.value, visiblePrice: directPrice.textContent.trim(), overlayVisibleBeforeFocus: visibleStyle.display === 'flex' && visibleStyle.opacity === '1' && visibleStyle.pointerEvents === 'none', rowDisplay: getComputedStyle(row).display, fieldCount: row.querySelectorAll('label').length, expiryType: expiry.type, expiryValue: expiry.value, expiryDirection: getComputedStyle(expiry).direction }; })()`);
  assert.ok(priorProductPurchaseLine, 'لم يستقر سطر شراء المنتج السابق بعد إعادة العرض.');
  assert.deepEqual(priorProductPurchaseLine, { salePrice: '50', visiblePrice: '50', overlayVisibleBeforeFocus: true, rowDisplay: 'grid', fieldCount: 8, expiryType: 'date', expiryValue: '', expiryDirection: 'ltr' });
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(120);
  const desktopDialogBounds = await evaluate(`(() => { const dialog = document.querySelector('.dialog'); const purchaseLine = document.querySelector('.purchase-line--pack'); const dialogBox = dialog.getBoundingClientRect(); const lineBox = purchaseLine.getBoundingClientRect(); return { dialogScrollFits: dialog.scrollWidth <= dialog.clientWidth, lineFitsDialog: lineBox.left >= dialogBox.left && lineBox.right <= dialogBox.right, formFitsDialog: document.querySelector('#purchase-form').scrollWidth <= dialog.clientWidth }; })()`);
  assert.deepEqual(desktopDialogBounds, { dialogScrollFits: true, lineFitsDialog: true, formFitsDialog: true });
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const purchaseInputsReady = await evaluate(`(() => ({ packageUnit: Boolean(document.querySelector('[data-purchase-package-unit="0"]')), packageQuantity: Boolean(document.querySelector('[data-purchase-package-quantity="0"]')), units: Boolean(document.querySelector('[data-purchase-units-per-package="0"]')), cost: Boolean(document.querySelector('[data-purchase-package-cost="0"]')), sale: Boolean(document.querySelector('[data-purchase-sale-price="0"]')) }))()`);
  assert.deepEqual(purchaseInputsReady, { packageUnit: true, packageQuantity: true, units: true, cost: true, sale: true });
  await evaluate(`(() => { const change = (selector, value, eventName = 'change') => { const input = document.querySelector(selector); input.value = value; input.dispatchEvent(new Event(eventName, { bubbles: true })); }; change('[data-purchase-package-unit="0"]', 'كرتون'); change('[data-purchase-package-quantity="0"]', '1'); change('[data-purchase-units-per-package="0"]', '12'); change('[data-purchase-package-cost="0"]', '360'); })()`);
  await evaluate(`(() => { const input = document.querySelector('[data-purchase-sale-price="0"]'); input.value = '50'; input.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#purchase-form').requestSubmit(); })()`);
  await waitForGone('#purchase-form');
  await waitFor('[data-action="new-purchase"]');
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="products"]').click()`);
  await waitFor('.topbar [data-action="navigate"][data-view="inventory"]');
  const result = await evaluate(`new Promise((resolve) => { const inventory = document.querySelector('.topbar [data-action="navigate"][data-view="inventory"]'); inventory.click(); setTimeout(() => resolve({ title: document.querySelector('.workspace h1')?.textContent?.trim(), inventoryVisible: Boolean(document.querySelector('.inventory-list')), expiryAlertVisible: Boolean(document.querySelector('.expiry-inventory-alert')), expiryStatusVisible: Boolean(document.querySelector('.expiry-status')) }), 350); })`);
  assert.deepEqual(result, { title: "المخزون", inventoryVisible: true, expiryAlertVisible: true, expiryStatusVisible: true });
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="settings"]').click()`);
  await waitFor('.settings-hub__grid');
  const settingsHub = await evaluate(`(() => ({ title: document.querySelector('.workspace h1')?.textContent.trim(), cards: [...document.querySelectorAll('.settings-hub__card')].map((card) => card.textContent.replace(/\s+/g, ' ').trim()), count: document.querySelectorAll('.settings-hub__icon').length, overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth }))()`);
  assert.equal(settingsHub.title, 'مركز الإعدادات');
  assert.equal(settingsHub.count, 6);
  assert.equal(settingsHub.overflow, true);
  assert.ok(settingsHub.cards.some((text) => text.includes('إعدادات عامة')));
  assert.ok(settingsHub.cards.some((text) => text.includes('شعار المتجر')));
  assert.ok(settingsHub.cards.some((text) => text.includes('الجرد المحاسبي')));
  assert.ok(settingsHub.cards.some((text) => text.includes('إدارة الحسابات')));
  assert.ok(settingsHub.cards.some((text) => text.includes('ترتيب الأيقونات')));
  assert.ok(settingsHub.cards.some((text) => text.includes('إدارة البيانات')));
  await evaluate(`document.querySelector('.settings-hub__card[data-view="general-settings"]').click()`);
  await waitFor('#settings-form');
  const darkSettingsButtonColors = await evaluate(`(() => { document.documentElement.setAttribute('data-theme', 'dark'); const primary = document.querySelector('#settings-form .button--primary'); const result = { primaryColor: getComputedStyle(primary).color, primaryBackground: getComputedStyle(primary).backgroundImage }; document.documentElement.removeAttribute('data-theme'); return result; })()`);
  assert.deepEqual(darkSettingsButtonColors, { primaryColor: 'rgb(255, 255, 255)', primaryBackground: 'linear-gradient(145deg, rgb(33, 117, 95), rgb(22, 71, 59))' });
  await evaluate(`document.querySelector('[data-action="navigate"][data-view="settings"]').click()`);
  await waitFor('.settings-hub__grid');
  await evaluate(`document.querySelector('.settings-hub__card[data-view="navigation-settings"]').click()`);
  await waitFor('[data-action="move-mobile-nav"][data-id="products"][data-direction="-1"]');
  const darkNavigationColors = await evaluate(`(() => { document.documentElement.setAttribute('data-theme', 'dark'); const row = document.querySelector('.mobile-nav-settings__item'); const arrow = document.querySelector('.mobile-nav-settings__actions .icon-button:not(:disabled)'); const result = { text: getComputedStyle(row.querySelector('strong')).color, arrow: getComputedStyle(arrow).color, arrowBackground: getComputedStyle(arrow).backgroundImage }; document.documentElement.removeAttribute('data-theme'); return result; })()`);
  assert.deepEqual(darkNavigationColors, { text: 'rgb(255, 255, 255)', arrow: 'rgb(255, 244, 246)', arrowBackground: 'linear-gradient(145deg, rgb(196, 42, 71), rgb(132, 19, 43))' });
  const arrowDirections = await evaluate(`(() => { const previous = document.querySelector('[data-action="move-mobile-nav"][data-id="products"][data-direction="-1"] svg'); const next = document.querySelector('[data-action="move-mobile-nav"][data-id="products"][data-direction="1"] svg'); return { previous: getComputedStyle(previous).transform, next: getComputedStyle(next).transform }; })()`);
  assert.deepEqual(arrowDirections, { previous: 'matrix(-1, 0, 0, -1, 0, 0)', next: 'none' });
  const reordered = await evaluate(`new Promise((resolve) => { document.querySelector('[data-action="move-mobile-nav"][data-id="products"][data-direction="-1"]').click(); setTimeout(() => resolve({ order: [...document.querySelectorAll('[data-bottom-nav] [data-view]')].map((item) => item.dataset.view), settingRows: document.querySelectorAll('.mobile-nav-settings__item').length }), 350); })`);
  assert.equal(reordered.settingRows, 9);
  assert.ok(reordered.order.indexOf("products") < reordered.order.indexOf("purchases"), "يجب أن ينتقل المنتجات خطوة للأمام بعد تغيير الترتيب.");
  await evaluate(`document.querySelector('[data-action="navigate"][data-view="settings"]').click()`);
  await waitFor('.settings-hub__grid');
  await evaluate(`document.querySelector('.settings-hub__card[data-view="data-management"]').click()`);
  await waitFor('#restore-file');
  const dataManagement = await evaluate(`({ title: document.querySelector('.workspace h1')?.textContent?.trim(), exportVisible: Boolean(document.querySelector('[data-action="export-backup"]')), restoreVisible: Boolean(document.querySelector('#restore-file')), cloudVisible: Boolean(document.querySelector('.cloud-backup-card')) })`);
  assert.deepEqual(dataManagement, { title: "إدارة البيانات", exportVisible: true, restoreVisible: true, cloudVisible: true });
  const darkDangerButton = await evaluate(`(() => { document.documentElement.setAttribute('data-theme', 'dark'); const button = document.querySelector('.data-management-page .button--danger'); const result = { color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundImage }; document.documentElement.removeAttribute('data-theme'); return result; })()`);
  assert.deepEqual(darkDangerButton, { color: 'rgb(255, 255, 255)', background: 'linear-gradient(145deg, rgb(196, 42, 71), rgb(132, 19, 43))' });
  const views = [["dashboard", "نظرة على يومك"], ["sales", "بيع جديد"], ["purchases", "المشتريات"]];
  for (const [view, title] of views) {
    const viewResult = await evaluate(`new Promise((resolve) => { document.querySelector('[data-bottom-nav] [data-view="${view}"]').click(); setTimeout(() => resolve({ active: document.querySelector('[data-bottom-nav] .is-active')?.dataset.view, title: document.querySelector('.workspace h1')?.textContent?.trim() }), 250); })`);
    assert.deepEqual(viewResult, { active: view, title });
  }
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="products"]').click()`);
  await waitFor('.topbar [data-action="navigate"][data-view="inventory"]');
  await evaluate(`document.querySelector('.topbar [data-action="navigate"][data-view="inventory"]').click()`);
  await waitFor('.inventory-list');
  assert.equal(await evaluate(`document.querySelector('.workspace h1')?.textContent?.trim()`), 'المخزون');
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="sales"]').click()`);
  await waitFor('.topbar [data-action="navigate"][data-view="invoices"]');
  await evaluate(`document.querySelector('.topbar [data-action="navigate"][data-view="invoices"]').click()`);
  await waitFor('.invoice-list');
  assert.equal(await evaluate(`document.querySelector('.workspace h1')?.textContent?.trim()`), 'الفواتير');
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="settings"]').click()`);
  await waitFor('.settings-hub__grid');
  await evaluate(`document.querySelector('.settings-hub__card[data-view="accounts"]').click()`);
  await waitFor('[data-action="new-account"]');
  await evaluate(`document.querySelector('[data-action="new-account"]').click()`);
  await waitFor('#account-form');
  await evaluate(`(() => { const form = document.querySelector('#account-form'); form.elements.name.value = 'كاشير اختبار الوردية'; form.elements.username.value = 'shift-cashier'; form.elements.pin.value = '1357'; form.elements.role.value = 'cashier'; form.elements.monthlySalary.value = '1000'; form.requestSubmit(); })()`);
  await waitForGone('#account-form');
  await waitFor('[data-action="account-session"]');
  await evaluate(`document.querySelector('[data-action="account-session"]').click()`);
  await waitFor('#switch-local-user');
  await evaluate(`document.querySelector('#switch-local-user').click()`);
  await waitFor('#login-form');
  await evaluate(`(() => { const form = document.querySelector('#login-form'); form.elements.username.value = 'shift-cashier'; form.elements.pin.value = '1357'; form.requestSubmit(); })()`);
  await waitFor('#cashier-shift-start-form');
  await evaluate(`(() => { const form = document.querySelector('#cashier-shift-start-form'); form.elements.receivedCash.value = '200'; form.requestSubmit(); })()`);
  await waitForGone('#cashier-shift-start-form');
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="sales"]').click()`);
  await waitFor('#sale-search');
  await evaluate(`(() => { const search = document.querySelector('#sale-search'); search.value = 'منتج قريب الانتهاء'; search.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor('[data-action="add-cart"]');
  await evaluate(`document.querySelector('[data-action="add-cart"]').click()`);
  await waitFor('[data-action="toggle-carton-sale"]');
  await evaluate(`document.querySelector('[data-action="toggle-carton-sale"]').click()`);
  await waitFor('[data-cart-carton-size]');
  const cartonSaleControls = await evaluate(`(() => { const size = document.querySelector('[data-cart-carton-size]'); const count = document.querySelector('[data-cart-carton-count]'); const quantity = document.querySelector('[data-cart-quantity]'); return { size: size?.value, count: count?.value, piecesInputHidden: !quantity, active: document.querySelector('[data-action="toggle-carton-sale"]')?.getAttribute('aria-pressed'), text: document.querySelector('.cart-line__detail small')?.textContent }; })()`);
  assert.deepEqual(cartonSaleControls, { size: '12', count: '1', piecesInputHidden: true, active: 'true', text: '50 ر.ي × 12 حبة · 1 كرتون' });
  await evaluate(`(() => { const input = document.querySelector('[data-cart-carton-size]'); input.value = '10'; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor('[data-cart-carton-size]');
  const editedCarton = await evaluate(`({ size: document.querySelector('[data-cart-carton-size]')?.value, quantity: document.querySelector('.cart-line__detail small')?.textContent, lineTotal: document.querySelector('[data-cart-line-total]')?.textContent })`);
  assert.deepEqual(editedCarton, { size: '10', quantity: '50 ر.ي × 10 حبة · 1 كرتون', lineTotal: '500 ر.ي' });
  await evaluate(`(() => { const input = document.querySelector('[data-cart-carton-size]'); input.value = '12'; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor('[data-cart-line-discount]');
  await evaluate(`(() => { const input = document.querySelector('[data-cart-line-discount]'); input.value = '11%'; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor('[data-cart-line-discount]');
  const cappedCashierDiscount = await evaluate(`({ value: document.querySelector('[data-cart-line-discount]')?.value, hint: document.querySelector('.cart-line__discount-note')?.textContent, total: document.querySelector('[data-cart-line-total]')?.textContent })`);
  assert.deepEqual(cappedCashierDiscount, { value: '10%', hint: 'حد الكاشير: 10% من قيمة السطر. · الخصم الحالي 60 ر.ي', total: '540 ر.ي' });
  await evaluate(`document.querySelector('[data-action="checkout"]').click()`);
  await waitFor('#checkout-form');
  const checkoutDiscountLimit = await evaluate(`({ note: document.querySelector('#cashier-discount-limit')?.textContent, total: document.querySelector('#checkout-total')?.textContent, submitDisabled: document.querySelector('.checkout-submit')?.disabled })`);
  assert.deepEqual(checkoutDiscountLimit, { note: 'خصم السطور والخصم العام: 60 ر.ي من سقف الكاشير 10% (60 ر.ي).', total: '540 ر.ي', submitDisabled: false });
  await evaluate(`document.querySelector('#checkout-form').requestSubmit()`);
  await waitFor('.invoice-list');
  await evaluate(`document.querySelector('[data-action="open-invoice"]').click()`);
  await waitFor('#share-invoice');
  if (new URL(target).hostname === 'localhost') {
    const generatedPdfs = await evaluate(`(async () => { const pdf = await import('/src/js/pdf-export.js'); const formatMoney = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0)) + ' ر.ي'; const formatAmount = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0)); const formatDateTime = () => '27 أغسطس 2026، 10:00 ص'; const invoice = { invoiceNumber: 'INV-000001', date: '2026-08-27T10:00:00.000Z', paymentType: 'نقدي', paymentStatus: 'مدفوعة', paymentMethod: 'كاش', items: [{ productName: 'منتج اختبار', unit: 'حبة', quantity: 12, unitPrice: 50, total: 540 }], subtotal: 600, discount: 60, deliveryFee: 0, total: 540, paidAmount: 540, remainingAmount: 0 }; const [invoiceFile, accountFile, reportFile] = await Promise.all([pdf.createThermalInvoicePdfFile({ invoice, customer: null, storeName: 'متجر اختبار', formatMoney, formatAmount, formatDateTime, paymentLabel: 'كاش', filename: 'invoice.pdf' }), pdf.createCustomerAccountPdfFile({ account: { customer: { name: 'عميل اختبار', phone: '777000000', address: 'صنعاء' }, totalSales: 1000, totalPaid: 200, balance: 800, transactions: [{ typeLabel: 'فاتورة آجل', date: '2026-08-27T10:00:00.000Z', invoiceNumber: 'INV-000001', amount: 1000, remainingAmount: 800 }] }, storeName: 'متجر اختبار', formatMoney, formatDateTime, filename: 'customer-account.pdf' }), pdf.createReportPdfFile({ rows: [['البند', 'القيمة'], ['المبيعات', formatMoney(1000)], ['المصروفات', formatMoney(120)]], storeName: 'متجر اختبار', from: '2026-08-01', to: '2026-08-27', filename: 'report.pdf' })]); return [invoiceFile, accountFile, reportFile].map((file) => ({ name: file.name, type: file.type, size: file.size })); })()`);
    assert.equal(generatedPdfs.length, 3);
    assert.ok(generatedPdfs.every((file) => file.type === 'application/pdf' && file.size > 800 && /\.pdf$/i.test(file.name)), 'تعذر إنشاء PDF الفاتورة أو كشف الحساب أو التقرير.');
  } else {
    await evaluate(`(() => { window.__pdfShares = []; Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true }); Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files = [] }) => { window.__pdfShares.push(files.map((file) => ({ name: file.name, type: file.type, size: file.size }))); } }); document.querySelector('#share-invoice').click(); })()`);
    for (let attempt = 0; attempt < 240 && !(await evaluate(`Boolean(window.__pdfShares?.[0]?.[0])`)); attempt += 1) await sleep(150);
    const invoicePdf = await evaluate(`window.__pdfShares?.[0]?.[0] || null`);
    assert.ok(invoicePdf && invoicePdf.type === 'application/pdf' && invoicePdf.size > 800 && /\.pdf$/i.test(invoicePdf.name), 'تعذر إنشاء PDF الفاتورة من رابط الإنتاج.');
  }
  await waitFor('[data-action="account-session"]');
  await evaluate(`document.querySelector('[data-action="account-session"]').click()`);
  await waitFor('#switch-local-user');
  await evaluate(`document.querySelector('#switch-local-user').click()`);
  await waitFor('#cashier-shift-close-form');
  await evaluate(`(() => { const form = document.querySelector('#cashier-shift-close-form'); form.elements.countedCash.value = '730'; form.requestSubmit(); })()`);
  await waitForGone('#cashier-shift-close-form');
  await waitFor('#login-form');
  await evaluate(`(() => { const form = document.querySelector('#login-form'); form.elements.username.value = 'admin'; form.elements.pin.value = '1234'; form.requestSubmit(); })()`);
  await waitFor('[data-bottom-nav] [data-view="cashbox"]');
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="sales"]').click()`);
  await waitFor('#sale-search');
  await evaluate(`(() => { const search = document.querySelector('#sale-search'); search.value = 'منتج قريب الانتهاء'; search.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor('[data-action="add-cart"]');
  await evaluate(`document.querySelector('[data-action="add-cart"]').click()`);
  await evaluate(`document.querySelector('[data-action="checkout"]').click()`);
  await waitFor('#checkout-form');
  await evaluate(`document.querySelector('[data-sale-payment-method="تحويل"]').click()`);
  const transferCheckout = await evaluate(`document.querySelector('#checkout-form [name="paymentMethod"]')?.value`);
  assert.equal(transferCheckout, 'تحويل');
  await evaluate(`document.querySelector('#checkout-form').requestSubmit()`);
  await waitFor('.invoice-list');
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="cashbox"]').click()`);
  await waitFor('[data-action="deposit-incoming-transfer"]');
  const transferPageBeforeDeposit = await evaluate(`(() => { const metrics = [...document.querySelectorAll('.metric-card')].map((card) => card.textContent.replace(/\s+/g, ' ').trim()); return { title: document.querySelector('.workspace h1')?.textContent?.trim(), actionVisible: Boolean(document.querySelector('[data-action="deposit-incoming-transfer"]')), hasTransferNote: Boolean(document.querySelector('.transfer-vault-note')), available: metrics.find((text) => text.includes('متاح للتوريد')) || '' }; })()`);
  assert.equal(transferPageBeforeDeposit.title, 'الخزنة والصناديق');
  assert.equal(transferPageBeforeDeposit.actionVisible, true);
  assert.equal(transferPageBeforeDeposit.hasTransferNote, true);
  assert.match(transferPageBeforeDeposit.available, /50/);
  await evaluate(`document.querySelector('[data-action="deposit-incoming-transfer"]').click()`);
  await waitFor('#incoming-transfer-deposit-form');
  await evaluate(`(() => { const form = document.querySelector('#incoming-transfer-deposit-form'); form.elements.amount.value = '20'; form.requestSubmit(); })()`);
  await waitForGone('#incoming-transfer-deposit-form');
  await waitFor('[data-action="deposit-incoming-transfer"]');
  const partialTransferDeposit = await evaluate(`(() => { const row = document.querySelector('.transfer-row'); return row?.textContent.replace(/\s+/g, ' ').trim() || ''; })()`);
  assert.match(partialTransferDeposit, /مُورّد للخزنة: 20/);
  assert.match(partialTransferDeposit, /المتبقي: 30/);
  await evaluate(`document.querySelector('[data-action="deposit-incoming-transfer"]').click()`);
  await waitFor('#incoming-transfer-deposit-form');
  await evaluate(`document.querySelector('#incoming-transfer-deposit-form').requestSubmit()`);
  await waitForGone('#incoming-transfer-deposit-form');
  const completeTransferDeposit = await evaluate(`(() => ({ pendingAction: Boolean(document.querySelector('[data-action="deposit-incoming-transfer"]')), completeMark: document.querySelector('.transfer-row')?.textContent.includes('وُرّد كاملًا') || false }))()`);
  assert.deepEqual(completeTransferDeposit, { pendingAction: false, completeMark: true });
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="cashbox"]').click()`);
  await waitFor('.cashier-shift-summary');
  const cashboxAfterTransferDeposit = await evaluate(`(() => ({ transferSummaryHidden: !document.querySelector('.cash-transfer-note'), transferMovementVisible: [...document.querySelectorAll('.report-card')].some((card) => card.textContent.includes('توريد من حوالة واردة')) }))()`);
  assert.deepEqual(cashboxAfterTransferDeposit, { transferSummaryHidden: true, transferMovementVisible: true });
  await waitFor('[data-action="new-cashier-salary-advance"]');
  await evaluate(`document.querySelector('[data-action="new-cashier-salary-advance"]').click()`);
  await waitFor('#cashier-salary-advance-form');
  await evaluate(`(() => { const form = document.querySelector('#cashier-salary-advance-form'); form.elements.amount.value = '200'; form.requestSubmit(); })()`);
  await waitForGone('#cashier-salary-advance-form');
  const advanceExpense = await evaluate(`(() => { const row = [...document.querySelectorAll('.entity-row')].find((item) => item.textContent.includes('سلفة موظف')); return { exists: Boolean(row), linksCashier: row?.textContent.includes('كاشير اختبار الوردية') || false, containsAmount: row?.textContent.includes('200') || false }; })()`);
  assert.deepEqual(advanceExpense, { exists: true, linksCashier: true, containsAmount: true });
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="settings"]').click()`);
  await waitFor('.settings-hub__grid');
  await evaluate(`document.querySelector('.settings-hub__card[data-view="accounts"]').click()`);
  await waitFor('.account-salary-note');
  const accountSalary = await evaluate(`document.querySelector('.account-salary-note')?.textContent.replace(/\s+/g, ' ').trim()`);
  assert.match(accountSalary, /راتب الشهر.*1,?000/);
  assert.match(accountSalary, /السلف.*200/);
  assert.match(accountSalary, /المتبقي.*800/);
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="cashbox"]').click()`);
  await waitFor('.cashier-shift-summary');
  await waitFor('.cashier-salary-summary');
  const shiftSummary = await evaluate(`(() => { const row = document.querySelector('.cashier-shift-row'); return { name: row.querySelector('strong')?.textContent.trim(), hasShortage: Boolean(row.querySelector('.is-negative')), hasLogin: row.textContent.includes('دخول:'), hasLogout: row.textContent.includes('خروج:') }; })()`);
  assert.deepEqual(shiftSummary, { name: 'كاشير اختبار الوردية', hasShortage: true, hasLogin: true, hasLogout: true });
  await evaluate(`document.querySelector('[data-action="transfer-cashier-shift"]').click()`);
  await waitFor('#confirm-cashier-shift-transfer');
  await evaluate(`document.querySelector('#confirm-cashier-shift-transfer').click()`);
  await waitForGone('#confirm-cashier-shift-transfer');
  await waitFor('.cashier-difference-summary [data-action="deduct-cashier-shortages"]');
  const vaultTransfer = await evaluate(`(() => { const vaultCard = [...document.querySelectorAll('.metric-card')].find((card) => card.textContent.includes('الخزنة الرئيسية')); const shiftRow = document.querySelector('.cashier-shift-row'); return { vaultVisible: Boolean(vaultCard), markedTransferred: shiftRow.textContent.includes('رُحّلت للخزنة'), transferActionGone: !shiftRow.querySelector('[data-action="transfer-cashier-shift"]') }; })()`);
  assert.deepEqual(vaultTransfer, { vaultVisible: true, markedTransferred: true, transferActionGone: true });
  await evaluate(`document.querySelector('.cashier-difference-summary [data-action="deduct-cashier-shortages"]').click()`);
  await waitFor('#cashier-shortage-deduction-form');
  const shortagePreview = await evaluate(`document.querySelector('#cashier-shortage-deduction-preview')?.textContent.replace(/\s+/g, ' ').trim()`);
  assert.match(shortagePreview, /10/);
  await evaluate(`document.querySelector('#cashier-shortage-deduction-form').requestSubmit()`);
  await waitForGone('#cashier-shortage-deduction-form');
  const cashierSalarySummary = await evaluate(`(() => { const row = document.querySelector('.cashier-salary-row'); return { name: row.querySelector('strong')?.textContent.trim(), text: row.textContent.replace(/\s+/g, ' ') }; })()`);
  assert.equal(cashierSalarySummary.name, 'كاشير اختبار الوردية');
  assert.match(cashierSalarySummary.text, /1,?000/);
  assert.match(cashierSalarySummary.text, /200/);
  assert.match(cashierSalarySummary.text, /10/);
  assert.match(cashierSalarySummary.text, /790/);
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="reports"]').click()`);
  await waitFor('.topbar [data-action="navigate"][data-view="periodic-inventory"]');
  await evaluate(`document.querySelector('.topbar [data-action="navigate"][data-view="periodic-inventory"]').click()`);
  await waitFor('#periodic-inventory-filter');
  const periodicInventoryPage = await evaluate(`(() => ({ title: document.querySelector('.workspace h1')?.textContent?.trim(), approveVisible: Boolean(document.querySelector('[data-action="save-periodic-inventory"]')), noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth, sourceNotice: document.querySelector('.periodic-inventory-notice')?.textContent.includes('اللقطة لا تنشئ حركة جديدة') || false, containsDamageDisclosure: document.querySelector('.report-grid')?.textContent.includes('لا يوجد في التطبيق سجل مستقل للتالف') || false, metricLabels: [...document.querySelectorAll('.metric-card')].map((card) => card.textContent.replace(/\s+/g, ' ').trim()) }))()`);
  assert.equal(periodicInventoryPage.title, 'الجرد المحاسبي الدوري');
  assert.equal(periodicInventoryPage.approveVisible, true);
  assert.equal(periodicInventoryPage.noOverflow, true);
  assert.equal(periodicInventoryPage.sourceNotice, true);
  assert.equal(periodicInventoryPage.containsDamageDisclosure, true);
  assert.ok(periodicInventoryPage.metricLabels.some((text) => text.includes('المخزون بالتكلفة')));
  assert.ok(periodicInventoryPage.metricLabels.some((text) => text.includes('الخزنة الرئيسية')));
  const selectAuditCycle = async (cycle, expectedFrom) => {
    await evaluate(`(() => { const form = document.querySelector('#periodic-inventory-filter'); form.elements.cycle.value = ${JSON.stringify(cycle)}; form.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const values = await evaluate(`(() => { const form = document.querySelector('#periodic-inventory-filter'); return { cycle: form.elements.cycle.value, from: form.elements.from.value, to: form.elements.to.value }; })()`);
      if (values.cycle === cycle && values.from === expectedFrom) return values;
      await sleep(150);
    }
    throw new Error(`لم يكتمل تحديث نطاق الجرد إلى ${cycle}.`);
  };
  const todayForAudit = new Date().toISOString().slice(0, 10);
  const [auditYear, auditMonth] = todayForAudit.split('-').map(Number);
  const expectedSemiannualFrom = `${auditYear}-${String(auditMonth <= 6 ? 1 : 7).padStart(2, '0')}-01`;
  assert.deepEqual(await selectAuditCycle('semiannual', expectedSemiannualFrom), { cycle: 'semiannual', from: expectedSemiannualFrom, to: todayForAudit });
  assert.deepEqual(await selectAuditCycle('annual', `${auditYear}-01-01`), { cycle: 'annual', from: `${auditYear}-01-01`, to: todayForAudit });
  assert.deepEqual(await selectAuditCycle('monthly', `${auditYear}-${String(auditMonth).padStart(2, '0')}-01`), { cycle: 'monthly', from: `${auditYear}-${String(auditMonth).padStart(2, '0')}-01`, to: todayForAudit });
  await evaluate(`document.querySelector('[data-action="save-periodic-inventory"]').click()`);
  await waitFor('#periodic-inventory-save-form');
  await evaluate(`(() => { const form = document.querySelector('#periodic-inventory-save-form'); form.elements.notes.value = 'جرد هاتف تجريبي'; form.requestSubmit(); })()`);
  await waitForGone('#periodic-inventory-save-form');
  await waitFor('.periodic-inventory-row');
  const savedPeriodicInventory = await evaluate(`(() => { const row = document.querySelector('.periodic-inventory-row'); return { title: row?.textContent.includes('جرد شهري') || false, hasNote: row?.textContent.includes('جرد هاتف تجريبي') || false, hasPosition: /[0-9]/.test(row?.querySelector('.periodic-inventory-row__amount')?.textContent || ''), overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; })()`);
  assert.deepEqual(savedPeriodicInventory, { title: true, hasNote: false, hasPosition: true, overflow: true });
  await evaluate(`document.querySelector('.periodic-inventory-row [data-action="open-periodic-inventory"]').click()`);
  await waitFor('.periodic-inventory-detail');
  const inventoryAuditDialog = await evaluate(`(() => ({ hasPerformance: document.querySelector('.periodic-inventory-detail')?.textContent.includes('صافي الربح') || false, hasNotes: document.querySelector('.periodic-inventory-detail__notes')?.textContent.includes('جرد هاتف تجريبي') || false, hasDamageDisclosure: document.querySelector('.periodic-inventory-detail')?.textContent.includes('لا يوجد في التطبيق سجل مستقل للتالف') || false }))()`);
  assert.deepEqual(inventoryAuditDialog, { hasPerformance: true, hasNotes: true, hasDamageDisclosure: true });
  await evaluate(`document.querySelector('[data-dialog-close]').click()`);
  await waitForGone('.periodic-inventory-detail');
  await evaluate(`document.querySelector('[data-bottom-nav] [data-view="settings"]').click()`);
  await waitFor('.settings-hub__grid');
  await evaluate(`document.querySelector('.settings-hub__card[data-view="brand-settings"]').click()`);
  await waitFor('#store-logo-file');
  await evaluate(`(() => { const input = document.querySelector('#store-logo-file'); const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLpbAAAAABJRU5ErkJggg=='), (character) => character.charCodeAt(0)); const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'store-logo.png', { type: 'image/png' })); Object.defineProperty(input, 'files', { configurable: true, value: transfer.files }); input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  for (let attempt = 0; attempt < 40 && !(await evaluate(`document.querySelector('.store-logo-preview strong')?.textContent.includes('شعار مخصص')`)); attempt += 1) await sleep(150);
  const localLogo = await evaluate(`(() => ({ preview: document.querySelector('.store-logo-preview img')?.src.startsWith('data:image/webp'), reset: Boolean(document.querySelector('[data-action="clear-store-logo"]')), favicon: document.querySelector('link[rel="icon"]')?.href.startsWith('data:image/webp'), overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth }))()`);
  assert.deepEqual(localLogo, { preview: true, reset: true, favicon: true, overflow: true });
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate(`document.querySelector('[data-action="clear-cart"]')?.click()`);
  await evaluate(`(() => { const send = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); for (const key of '628100000001') send(key); send('Enter'); for (const key of '628100000001') send(key); send('Enter'); })()`);
  await waitFor('#sale-search');
  for (let attempt = 0; attempt < 40 && !(await evaluate(`Boolean(document.querySelector('.cart-line'))`)); attempt += 1) await sleep(150);
  const desktopBarcodeReader = await evaluate(`(() => { const line = [...document.querySelectorAll('.cart-line')].find((item) => item.textContent.includes('منتج قريب الانتهاء')); return { desktopWidth: window.innerWidth >= 1000, salePage: document.querySelector('.workspace h1')?.textContent.trim(), count: document.querySelectorAll('.cart-line').length, quantity: line?.querySelector('[data-cart-quantity]')?.value, hasReaderNote: document.querySelector('.desktop-barcode-reader-note')?.textContent.includes('قارئ الباركود المتصل بالكمبيوتر') || false }; })()`);
  assert.deepEqual(desktopBarcodeReader, { desktopWidth: true, salePage: 'بيع جديد', count: 1, quantity: '1', hasReaderNote: true });
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  if (new URL(target).hostname === 'localhost') {
    const customLogoPdf = await evaluate(`(async () => { const pdf = await import('/src/js/pdf-export.js'); const logoDataUrl = document.querySelector('link[rel="icon"]')?.href; const invoice = { invoiceNumber: 'INV-LOGO', date: '2026-08-27T10:00:00.000Z', paymentType: 'نقدي', paymentStatus: 'مدفوعة', paymentMethod: 'نقدي', items: [{ productName: 'منتج اختبار', unit: 'حبة', quantity: 1, unitPrice: 50, total: 50 }], subtotal: 50, discount: 0, deliveryFee: 0, total: 50, paidAmount: 50, remainingAmount: 0 }; const file = await pdf.createThermalInvoicePdfFile({ invoice, customer: null, storeName: 'متجر اختبار', logoDataUrl, formatMoney: (value) => String(value), formatAmount: (value) => String(value), formatDateTime: () => '27 أغسطس 2026', paymentLabel: 'كاش', filename: 'logo-invoice.pdf' }); return { type: file.type, size: file.size }; })()`);
    assert.equal(customLogoPdf.type, 'application/pdf');
    assert.ok(customLogoPdf.size > 800, 'تعذر إنشاء PDF الفاتورة مع شعار المتجر المحلي.');
  }
  socket.close();
  console.log("اجتازت صفحات التطبيق وتبديل الكاشير وتسليم الصندوق اختبار التنقل التفاعلي.");
} finally {
  chrome.kill("SIGTERM");
  await new Promise((resolve) => chrome.once("exit", resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
