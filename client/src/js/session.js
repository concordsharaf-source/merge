export const ACTIVE_SESSION_META_ID = "active-account-session";
export const ACTIVE_SESSION_STORAGE_KEY = "hesabi-active-account-session";

export function toPersistentSessionUser(account) {
  if (!account?.id || !account.isActive) return null;
  const user = {
    id: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
    mustChangePin: Boolean(account.mustChangePin),
  };
  if (Array.isArray(account.allowedViews)) {
    user.allowedViews = [...account.allowedViews];
  }
  return user;
}
