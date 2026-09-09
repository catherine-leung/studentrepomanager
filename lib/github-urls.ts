// lib/github-urls.ts

/**
 * Deep link to an organization's invitation page.
 * Used by students to accept org membership invitations.
 */
export function getOrgInvitationUrl(org: string): string {
  return (
    "https://github.com/orgs/" +
    `${encodeURIComponent(org)}/invitation`
  );
}

/**
 * Deep link to an organization's "Member privileges" settings.
 * Used by professors to configure base repository permissions.
 */
export function getOrgSettingsUrl(org: string): string {
  return (
    "https://github.com/organizations/" +
    `${encodeURIComponent(org)}/settings/member_privileges`
  );
}
