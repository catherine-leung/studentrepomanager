// lib/emu.ts

/**
 * Determine whether a GitHub login belongs to an Enterprise
 * Managed User (EMU) account rather than a normal, personal
 * github.com account.
 *
 * GitHub Enterprise Managed Users are provisioned through an
 * organization's identity provider (Okta, Entra ID, etc.) and
 * their usernames are always the identity's normalized name
 * plus an underscore plus the enterprise's short code, e.g.
 * "jsmith_acmeuniv".
 *
 * A normal, personal github.com username can never contain an
 * underscore -- GitHub only allows letters, digits, and single
 * hyphens (never at the start/end, never doubled) -- so the
 * presence of an underscore is a reliable signal that an
 * account is enterprise-managed, without an extra API call.
 *
 * EMU accounts can never join an organization outside their own
 * enterprise, and non-EMU accounts can never join an
 * EMU-managed organization from outside it, so this is used to
 * catch that mismatch before a student wastes time on GitHub's
 * own invite flow.
 *
 * See:
 * https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/iam-configuration-reference/username-considerations-for-external-authentication
 * https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/understanding-iam-for-enterprises/abilities-and-restrictions-of-managed-user-accounts
 */
export function isEmuLogin(login: string): boolean {
  return login.includes("_");
}
