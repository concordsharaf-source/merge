import test from "node:test";
import assert from "node:assert/strict";
import { getExitGuardAction, leaveAfterExitConfirmation, primeExitGuardHistory } from "../client/src/js/navigation-guard.js";

test("يختار حارس الرجوع نافذة التأكيد أو إغلاق النافذة أو السماح بالخروج المقصود", () => {
  assert.equal(getExitGuardAction(), "confirm-exit");
  assert.equal(getExitGuardAction({ hasOpenOverlay: true }), "close-overlay");
  assert.equal(getExitGuardAction({ exitAllowed: true }), "allow-exit");
});

test("اختيار نعم للخروج يتجاوز نقطتي الحماية في قفزة واحدة لمغادرة التطبيق فورًا", () => {
  let receivedSteps;
  leaveAfterExitConfirmation((steps) => { receivedSteps = steps; });
  assert.equal(receivedSteps, -2);
});

test("يهيئ حارس الرجوع نقطتي تاريخ من أول شاشة لمنع الخروج المباشر", () => {
  const calls = [];
  const historyApi = {
    state: { source: "first-screen" },
    replaceState: (...args) => calls.push(["replace", ...args]),
    pushState: (...args) => calls.push(["push", ...args]),
  };
  primeExitGuardHistory(historyApi, "https://example.test/");
  assert.deepEqual(calls, [
    ["replace", { source: "first-screen", hesabiExitGuard: true }, "", "https://example.test/"],
    ["push", { source: "first-screen", hesabiExitGuard: true }, "", "https://example.test/"],
  ]);
});
