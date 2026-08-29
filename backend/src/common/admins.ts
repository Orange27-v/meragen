/**
 * Who counts as the owner.
 *
 * The list lives in ADMIN_EMAILS and nowhere else — nothing a customer can
 * touch grants it. Both the guard on the metrics route and the `isAdmin` flag
 * on `/auth/me` read it through here, so the flag the UI trusts and the check
 * that actually protects the data can never disagree.
 */
export function isAdminEmail(email: string, adminEmails: string): boolean {
  const allowed = adminEmails
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
