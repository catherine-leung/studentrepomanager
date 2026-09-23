// components/redeem/JoinOrgPrompt.tsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RedeemNav } from "./RedeemNav";
import { getOrgInvitationUrl } from "@/lib/github-urls";
import { COPY } from "@/lib/copy";

interface Props {
  linkId: string;
  orgName: string;
  membership: "pending" | "none";
  onContinue: () => void;
}

export function JoinOrgPrompt({
  linkId,
  orgName,
  membership,
  onContinue,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<
    string | null
  >(
    membership === "pending" ? getOrgInvitationUrl(orgName) : null
  );
  const [checking, setChecking] = useState(false);

  async function handleSendInvitation() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/redeem/${linkId}/invite`,
        { method: "POST" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || COPY.errors.failedToFetch
        );
      }

      const data = await response.json();
      setInvitationUrl(data.invitationUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : COPY.errors.serverError
      );
    } finally {
      setLoading(false);
    }
  }

  const handleCheckMembership = useCallback(async () => {
    setChecking(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/redeem/${linkId}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(COPY.errors.failedToFetch);
      }

      const data = await response.json();

      if (data.membership === "active") {
        onContinue();
      } else {
        setError(COPY.redeem.joinOrg.notMember);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : COPY.errors.serverError
      );
    } finally {
      setChecking(false);
    }
  }, [linkId, onContinue]);

  // Students often click "Accept Invitation," accept it on
  // GitHub in the new tab, and never come back to press
  // Continue. Once they've sent themselves to GitHub, re-check
  // membership automatically the moment they switch back to
  // this tab, so Continue becomes a fallback rather than a
  // required step.
  const checkingRef = useRef(checking);
  useEffect(() => {
    checkingRef.current = checking;
  }, [checking]);

  const hasLeftTabRef = useRef(false);
  useEffect(() => {
    if (!invitationUrl) {
      return;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hasLeftTabRef.current = true;
        return;
      }

      if (
        document.visibilityState === "visible" &&
        hasLeftTabRef.current &&
        !checkingRef.current
      ) {
        hasLeftTabRef.current = false;
        handleCheckMembership();
      }
    }

    function handleWindowFocus() {
      handleVisibilityChange();
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [invitationUrl, handleCheckMembership]);

  return (
    <div className="min-h-screen bg-canvas">
      <RedeemNav />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div
          className="rounded-xl border border-neutral-200
                     bg-white p-6 shadow-sm"
        >
          <h1
            className="mb-3 text-xl font-bold text-neutral-900"
          >
            {COPY.redeem.joinOrg.title}
          </h1>

          <p className="mb-5 text-sm text-neutral-600">
            {COPY.redeem.joinOrg.message}{" "}
            <span className="font-mono font-bold text-neutral-900">
              {orgName}
            </span>{" "}
            on GitHub before you can redeem this link.
          </p>

          {error && (
            <div className="mb-5">
              <Alert type="error" message={error} />
            </div>
          )}

          {!invitationUrl ? (
            <>
              <p className="mb-5 text-sm text-neutral-600">
                Click the button below to send yourself an
                invitation to join the organization.
              </p>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleSendInvitation}
                disabled={loading}
                isLoading={loading}
              >
                {loading
                  ? COPY.redeem.joinOrg.sendingInvitation
                  : COPY.redeem.joinOrg.sendInvitation}
              </Button>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-neutral-600">
                {membership === "pending"
                  ? COPY.redeem.joinOrg.alreadyPending
                  : "An invitation has been sent to your " +
                    "GitHub account. Click the link below " +
                    "to accept it:"}
              </p>

              <a
                href={invitationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2 block w-full rounded-md
                           bg-success px-6 py-3 text-center
                           text-base font-medium text-white
                           transition-colors
                           hover:bg-green-700
                           focus-visible:outline-none
                           focus-visible:ring-2
                           focus-visible:ring-success
                           focus-visible:ring-offset-2"
              >
                {COPY.redeem.joinOrg.acceptInvitation}
              </a>

              <p className="mb-5 text-xs text-neutral-500">
                We&apos;ll check automatically when you come
                back to this tab -- no need to click Continue
                unless it doesn&apos;t pick it up.
              </p>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleCheckMembership}
                disabled={checking}
                isLoading={checking}
              >
                {checking
                  ? COPY.redeem.joinOrg.checking
                  : COPY.redeem.joinOrg.continue}
              </Button>
            </>
          )}

          <div className="mt-6">
            <Alert
              type="info"
              message={COPY.redeem.joinOrg.note}
              title="Note"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
