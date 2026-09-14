export const BARCODE_RELEASE_DELAY_MS = 650;
export const CAMERA_SCAN_INTERVAL_MS = 120;
export const DESKTOP_BARCODE_MIN_LENGTH = 4;
export const DESKTOP_BARCODE_MAX_KEY_INTERVAL_MS = 90;
export const DESKTOP_BARCODE_DUPLICATE_WINDOW_MS = 250;

const finiteNumber = (value) => Number.isFinite(Number(value));

export const getScannerCameraConstraints = () => ({
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 24, max: 30 },
  },
});

export const getCameraAssistOptions = (capabilities = {}, settings = {}) => {
  const zoom = capabilities?.zoom || {};
  const focusDistance = capabilities?.focusDistance || {};
  const zoomMin = Number(zoom.min);
  const zoomMax = Number(zoom.max);
  const focusMin = Number(focusDistance.min);
  const focusMax = Number(focusDistance.max);
  const canZoom = finiteNumber(zoomMin) && finiteNumber(zoomMax) && zoomMax > zoomMin;
  const canUseManualFocus = finiteNumber(focusMin) && finiteNumber(focusMax) && focusMax > focusMin;
  const focusModes = Array.isArray(capabilities?.focusMode) ? capabilities.focusMode : [capabilities?.focusMode].filter(Boolean);
  const currentZoom = Number(settings?.zoom);
  const currentFocus = Number(settings?.focusDistance);
  return {
    canZoom,
    zoomMin: canZoom ? zoomMin : null,
    zoomMax: canZoom ? zoomMax : null,
    zoomStep: canZoom && finiteNumber(zoom.step) && Number(zoom.step) > 0 ? Number(zoom.step) : 0.1,
    zoomValue: canZoom ? Math.min(zoomMax, Math.max(zoomMin, finiteNumber(currentZoom) ? currentZoom : zoomMin)) : null,
    canUseManualFocus,
    focusMin: canUseManualFocus ? focusMin : null,
    focusMax: canUseManualFocus ? focusMax : null,
    focusStep: canUseManualFocus && finiteNumber(focusDistance.step) && Number(focusDistance.step) > 0 ? Number(focusDistance.step) : (focusMax - focusMin) / 100,
    focusValue: canUseManualFocus ? Math.min(focusMax, Math.max(focusMin, finiteNumber(currentFocus) ? currentFocus : (focusMin + focusMax) / 2)) : null,
    canUseTorch: capabilities?.torch === true,
    canUseContinuousFocus: focusModes.includes("continuous"),
  };
};

export const isNewContinuousBarcode = (lastCode, rawCode) => {
  const code = String(rawCode || "").trim();
  return Boolean(code) && code !== String(lastCode || "").trim();
};

export const shouldReleaseContinuousBarcode = (lastCode, absentSince, now = Date.now()) => Boolean(lastCode) && Number(absentSince) > 0 && now - Number(absentSince) >= BARCODE_RELEASE_DELAY_MS;

/** قارئات USB/Bluetooth المعتادة تحاكي لوحة المفاتيح وتُرسل الرمز سريعًا ثم Enter أو Tab. */
export const isDesktopBarcodeWedge = ({ code = "", startedAt = 0, completedAt = 0 } = {}) => {
  const normalized = String(code || "").trim();
  const elapsed = Number(completedAt) - Number(startedAt);
  return normalized.length >= DESKTOP_BARCODE_MIN_LENGTH && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= Math.max(320, normalized.length * DESKTOP_BARCODE_MAX_KEY_INTERVAL_MS);
};

export const shouldAcceptDesktopBarcode = ({ code = "", lastCode = "", lastAcceptedAt = 0, now = Date.now() } = {}) => {
  const normalized = String(code || "").trim();
  return Boolean(normalized) && (normalized !== String(lastCode || "").trim() || Number(now) - Number(lastAcceptedAt) >= DESKTOP_BARCODE_DUPLICATE_WINDOW_MS);
};
