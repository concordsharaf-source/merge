export const getExitGuardAction = ({ exitAllowed = false, hasOpenOverlay = false } = {}) => {
  if (exitAllowed) return "allow-exit";
  if (hasOpenOverlay) return "close-overlay";
  return "confirm-exit";
};

export const leaveAfterExitConfirmation = (go, steps = -2) => {
  go(steps);
};

export const primeExitGuardHistory = (historyApi, href) => {
  const state = { ...(historyApi.state || {}), hesabiExitGuard: true };
  historyApi.replaceState(state, "", href);
  historyApi.pushState(state, "", href);
};
