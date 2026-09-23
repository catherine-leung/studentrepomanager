// lib/org-welcome-tracker.ts
//
// Client-side bookkeeping for the "this org was just connected"
// welcome note. There's no GitHub install callback wired up
// yet, so this is deliberately conservative: the note is only
// ever eligible for an org that (a) is genuinely new to the
// installed-org list, AND (b) appeared right after the person
// clicked "+ Add Organization" in this tab. An org that was
// already installed — or one that shows up in the list for any
// other reason — never triggers it.
//
// markAddOrganizationClicked() sets a one-shot sessionStorage
// flag before the GitHub install tab opens. recordSeenOrgs()
// consumes that flag on the next org-list fetch: if it's set
// and new orgs appeared, they're marked eligible; either way the
// flag is cleared, so it never lingers into an unrelated fetch.

const KNOWN_KEY = "arm:knownOrgs";
const NEW_KEY = "arm:newOrgs";
const ACK_KEY = "arm:acknowledgedOrgs";
const ADD_CLICKED_KEY = "arm:addOrgClicked";

function rawGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readList(key: string): string[] {
  const raw = rawGet(key);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function writeList(key: string, value: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or blocked storage: nothing to persist.
  }
}

/** Call right before opening the GitHub install tab. */
export function markAddOrganizationClicked() {
  try {
    window.sessionStorage.setItem(ADD_CLICKED_KEY, "1");
  } catch {
    // Private browsing or blocked storage: the note just won't
    // be shown for the org that's about to be added — not
    // worth surfacing an error for.
  }
}

function consumeAddOrganizationClicked(): boolean {
  try {
    const wasClicked =
      window.sessionStorage.getItem(ADD_CLICKED_KEY) === "1";
    window.sessionStorage.removeItem(ADD_CLICKED_KEY);
    return wasClicked;
  } catch {
    return false;
  }
}

/**
 * Call whenever the installed-org list is fetched. Always
 * updates the known-orgs baseline (so nothing here is ever
 * treated as new later on its own). Only marks newly-appeared
 * orgs as eligible for the welcome note if the fetch followed a
 * "+ Add Organization" click in this tab.
 */
export function recordSeenOrgs(currentLogins: string[]) {
  const known = new Set(readList(KNOWN_KEY));
  const wasAddClicked = consumeAddOrganizationClicked();

  if (wasAddClicked) {
    const newlyAppeared = currentLogins.filter(
      (login) => !known.has(login)
    );
    if (newlyAppeared.length > 0) {
      const existingNew = new Set(readList(NEW_KEY));
      newlyAppeared.forEach((login) => existingNew.add(login));
      writeList(NEW_KEY, Array.from(existingNew));
    }
  }

  currentLogins.forEach((login) => known.add(login));
  writeList(KNOWN_KEY, Array.from(known));
}

export function isNewlyConnected(org: string): boolean {
  return readList(NEW_KEY).includes(org);
}

export function isAcknowledged(org: string): boolean {
  return readList(ACK_KEY).includes(org);
}

export function acknowledgeOrg(org: string) {
  const ack = new Set(readList(ACK_KEY));
  ack.add(org);
  writeList(ACK_KEY, Array.from(ack));
  writeList(
    NEW_KEY,
    readList(NEW_KEY).filter((login) => login !== org)
  );
}
