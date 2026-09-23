// components/OrgWelcomeNote.tsx
//
// One-time confirmation, shown only for an organization that
// was just connected, of what the app already configured
// automatically (via the `installation.created` webhook — see
// lib/org-settings.ts#applyOrgSecuritySettings). Not a warning:
// a positive confirmation, shown once, dismissed and remembered
// via lib/org-welcome-tracker.

"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { getOrgSettingsUrl } from "@/lib/github-urls";
import {
  acknowledgeOrg,
  isAcknowledged,
  isNewlyConnected,
} from "@/lib/org-welcome-tracker";

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

// Synced from an external store (localStorage) rather than a
// useState+useEffect pair, so there's no setState-in-effect and
// no hydration mismatch: the server snapshot is "don't show"
// and the client snapshot reflects what's really there.
function useShouldShow(org: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isNewlyConnected(org) && !isAcknowledged(org),
    () => false
  );
}

const PROTECTIONS = [
  "Base repository permission set to “None” — " +
    "students can't see each other's repositories by default",
  "Members can't create new repositories, public or private",
  "Members can't fork private repositories",
];

interface Props {
  orgName: string;
}

export function OrgWelcomeNote({ orgName }: Props) {
  const shouldShow = useShouldShow(orgName);

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      className="mb-6 rounded-xl border border-primary-200
                 bg-primary-50 p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center
                     justify-center rounded-full bg-primary-600
                     text-white"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4
                 0l-3.5-3.5a1 1 0 011.4-1.4l2.8 2.8 6.8-6.8a1
                 1 0 011.4 0z"
            />
          </svg>
        </span>
        <div className="flex-1">
          <h3 className="mb-1 font-semibold text-primary-900">
            This organization is protected automatically
          </h3>
          <p className="mb-3 text-sm text-primary-800">
            Connecting {orgName} applied these settings right
            away, so there was nothing for you to configure:
          </p>
          <ul
            className="mb-4 space-y-1.5 text-sm text-primary-800"
          >
            {PROTECTIONS.map((item) => (
              <li key={item} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="text-primary-500"
                >
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mb-4 text-xs text-primary-700">
            Repo visibility and team creation aren&rsquo;t
            controlled by GitHub&rsquo;s API, so review those
            manually if you want to restrict them too.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                acknowledgeOrg(orgName);
                notifyListeners();
              }}
            >
              OK, got it
            </Button>
            <a
              href={getOrgSettingsUrl(orgName)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary-700
                         hover:text-primary-900
                         focus-visible:outline-none
                         focus-visible:ring-2
                         focus-visible:ring-primary-500
                         focus-visible:ring-offset-2
                         rounded-sm"
            >
              Open GitHub settings to customize →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
