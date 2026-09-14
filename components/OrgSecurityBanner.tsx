// components/OrgSecurityBanner.tsx

"use client";

import { useEffect, useState } from "react";
import { COPY } from "@/lib/copy";

interface Status {
  basePermission: string;
  ok: boolean;
  settingsUrl: string;
}

interface Props {
  orgName: string;
}

export function OrgSecurityBanner({ orgName }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(null);
    setError(null);

    fetch(
      `/api/orgs/${encodeURIComponent(orgName)}/security`
    )
      .then((r) => {
        if (!r.ok) throw new Error(COPY.errors.failedToFetch);
        return r.json();
      })
      .then(setStatus)
      .catch((err) => {
        console.error("Security check failed:", err);
        setStatus(null);
      });
  }, [orgName]);

  if (!status || status.ok) {
    return null;
  }

  async function fix() {
    setBusy(true);
    setError(null);

    try {
      const r = await fetch(
        `/api/orgs/${encodeURIComponent(orgName)}/security`,
        { method: "POST" }
      );

      if (!r.ok) {
        throw new Error(COPY.errors.failedToUpdate);
      }

      setStatus(await r.json());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : COPY.errors.serverError
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-6 p-4 bg-yellow-50 border-l-4
                 border-yellow-400 rounded"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Organization security issue
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              Base repository permission is set to
              <span className="font-mono font-bold">
                {" "}
                {status.basePermission}
              </span>
              . Students can currently see every repository
              in this organization, including other
              students&rsquo; work.
            </p>
            <p className="mt-2">
              It must be set to
              <span className="font-mono font-bold">
                {" "}
                none
              </span>
              .
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={fix}
              disabled={busy}
              className="px-4 py-2 bg-yellow-600 text-white
                         rounded hover:bg-yellow-700
                         disabled:bg-gray-400 text-sm
                         font-medium transition"
            >
              {busy ? "Applying..." : "Fix automatically"}
            </button>
            <a
              href={status.settingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-yellow-800
                         hover:text-yellow-900 underline"
            >
              Open GitHub settings →
            </a>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-700">
              Error: {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
