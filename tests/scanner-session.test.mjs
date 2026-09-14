import test from "node:test";
import assert from "node:assert/strict";
import { BARCODE_RELEASE_DELAY_MS, CAMERA_SCAN_INTERVAL_MS, DESKTOP_BARCODE_DUPLICATE_WINDOW_MS, getCameraAssistOptions, getScannerCameraConstraints, isDesktopBarcodeWedge, isNewContinuousBarcode, shouldAcceptDesktopBarcode, shouldReleaseContinuousBarcode } from "../client/src/js/scanner-session.js";

test("يطلب الماسح الكاميرا الخلفية بدقة وإيقاع مناسبين للهواتف الضعيفة", () => {
  const constraints = getScannerCameraConstraints();
  assert.equal(constraints.audio, false);
  assert.equal(constraints.video.facingMode.ideal, "environment");
  assert.equal(constraints.video.width.ideal, 1280);
  assert.equal(constraints.video.height.ideal, 720);
  assert.equal(constraints.video.frameRate.ideal, 24);
  assert.ok(CAMERA_SCAN_INTERVAL_MS >= 80 && CAMERA_SCAN_INTERVAL_MS <= 200);
});

test("لا تظهر أدوات التكبير والإضاءة إلا حين تدعمها الكاميرا", () => {
  const full = getCameraAssistOptions({ zoom: { min: 1, max: 4, step: 0.25 }, focusDistance: { min: 0, max: 10, step: 0.5 }, torch: true, focusMode: ["continuous", "single-shot"] }, { zoom: 2, focusDistance: 4 });
  assert.deepEqual(full, { canZoom: true, zoomMin: 1, zoomMax: 4, zoomStep: 0.25, zoomValue: 2, canUseManualFocus: true, focusMin: 0, focusMax: 10, focusStep: 0.5, focusValue: 4, canUseTorch: true, canUseContinuousFocus: true });
  const basic = getCameraAssistOptions({}, {});
  assert.equal(basic.canZoom, false);
  assert.equal(basic.canUseManualFocus, false);
  assert.equal(basic.canUseTorch, false);
  assert.equal(basic.canUseContinuousFocus, false);
});

test("يمنع المسح المتواصل من إضافة الباركود نفسه مرارًا قبل إبعاده عن إطار الكاميرا", () => {
  assert.equal(isNewContinuousBarcode("", "628100000001"), true);
  assert.equal(isNewContinuousBarcode("628100000001", "628100000001"), false);
  assert.equal(isNewContinuousBarcode("628100000001", "628100000002"), true);
  assert.equal(isNewContinuousBarcode("628100000001", ""), false);
});

test("لا يحرر رمز المسح المتواصل إلا بعد غيابه المستمر عن الكاميرا", () => {
  assert.equal(shouldReleaseContinuousBarcode("628100000001", 10_000, 10_000 + BARCODE_RELEASE_DELAY_MS - 1), false);
  assert.equal(shouldReleaseContinuousBarcode("628100000001", 10_000, 10_000 + BARCODE_RELEASE_DELAY_MS), true);
  assert.equal(shouldReleaseContinuousBarcode("", 10_000, 20_000), false);
});

test("يتعرف قارئ الباركود المكتبي السريع ويتجاهل الكتابة البطيئة والتكرار اللحظي", () => {
  assert.equal(isDesktopBarcodeWedge({ code: "628100000001", startedAt: 1_000, completedAt: 1_080 }), true);
  assert.equal(isDesktopBarcodeWedge({ code: "12", startedAt: 1_000, completedAt: 1_030 }), false);
  assert.equal(isDesktopBarcodeWedge({ code: "628100000001", startedAt: 1_000, completedAt: 2_200 }), false);
  assert.equal(shouldAcceptDesktopBarcode({ code: "628100000001", lastCode: "", lastAcceptedAt: 0, now: 1_000 }), true);
  assert.equal(shouldAcceptDesktopBarcode({ code: "628100000001", lastCode: "628100000001", lastAcceptedAt: 1_000, now: 1_000 + DESKTOP_BARCODE_DUPLICATE_WINDOW_MS - 1 }), false);
  assert.equal(shouldAcceptDesktopBarcode({ code: "628100000001", lastCode: "628100000001", lastAcceptedAt: 1_000, now: 1_000 + DESKTOP_BARCODE_DUPLICATE_WINDOW_MS }), true);
});
