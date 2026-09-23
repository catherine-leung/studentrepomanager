// components/OrgSecurityBanner.tsx

"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
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
    let ignore = false;

    fetch(
      `/api/orgs/${encodeURIComponent(orgName)}/security`
    )
      .then((r) => {
        if (!r.ok) throw new Error(COPY.errors.failedToFetch);
        return r.json();
      })
      .then((data: Status) => {
        if (ignore) return;
        setStatus(data);
        setError(null);
      })
      .catch((err) => {
        if (ignore) return;
        console.error("Security check failed:", err);
        setStatus(null);
      });

    return () => {
      ignore = true;
    };
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
    <div className="mb-6">
      <Alert
        type="warning"
        title="Organization permissions have drifted"
        message={
          "It looks like this organization's permissions " +
          "have drifted from the automatic default. " +
          "Students can currently see each other's " +
          "repositories until this is fixed. (Base " +
          `permission is "${status.basePermission}"; it ` +
          `should be "none".)`
        }
      >
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={fix} isLoading={busy}>
            {busy ? "Applying…" : "Fix automatically"}
          </Button>
          <a
            href={status.settingsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary-600
                       hover:text-primary-700
                       focus-visible:outline-none
                       focus-visible:ring-2
                       focus-visible:ring-primary-500
                       focus-visible:ring-offset-2 rounded-sm"
          >
            Open GitHub settings →
          </a>
        </div>
        {error && (
          <p className="mt-2 text-sm text-error">
            Error: {error}
          </p>
        )}
      </Alert>
    </div>
  );
}
