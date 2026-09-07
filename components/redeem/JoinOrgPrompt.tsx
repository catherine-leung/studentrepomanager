// components/redeem/JoinOrgPrompt.tsx

"use client";

import { useState } from "react";

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
  >(null);
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
          data.error || "Failed to send invitation"
        );
      }

      const data = await response.json();
      setInvitationUrl(data.invitationUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send invitation"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckMembership() {
    setChecking(true);

    try {
      const response = await fetch(
        `/api/redeem/${linkId}`
      );

      if (!response.ok) {
        throw new Error("Failed to check membership");
      }

      const data = await response.json();

      if (data.membership === "active") {
        onContinue();
      } else {
        setError(
          "You are still not a member. " +
          "Please accept the invitation on GitHub."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to check membership"
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">
            Student Repo Manager
          </h1>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">
            Join Organization
          </h2>

          <p className="text-gray-600 mb-6">
            You need to join the{" "}
            <span className="font-mono font-bold">
              {orgName}
            </span>{" "}
            organization on GitHub before you can redeem
            this assignment.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border
                            border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          {!invitationUrl ? (
            <>
              <p className="text-gray-600 mb-6">
                Click the button below to send yourself an
                invitation to join the organization.
              </p>

              <button
                onClick={handleSendInvitation}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6
                           py-3 rounded-lg hover:bg-blue-700
                           transition font-medium
                           disabled:bg-gray-400"
              >
                {loading
                  ? "Sending invitation..."
                  : "Send Invitation"}
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-600 mb-4">
                An invitation has been sent to your GitHub
                account. Click the link below to accept it:
              </p>

              <a
                href={invitationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-green-600 text-white
                           px-6 py-3 rounded-lg
                           hover:bg-green-700 transition
                           font-medium text-center mb-6"
              >
                Accept Invitation on GitHub →
              </a>

              <p className="text-gray-600 mb-6">
                After accepting the invitation, click the
                button below to continue.
              </p>

              <button
                onClick={handleCheckMembership}
                disabled={checking}
                className="w-full bg-blue-600 text-white px-6
                           py-3 rounded-lg hover:bg-blue-700
                           transition font-medium
                           disabled:bg-gray-400"
              >
                {checking
                  ? "Checking membership..."
                  : "Continue"}
              </button>
            </>
          )}

          <div className="mt-8 p-4 bg-blue-50 border
                          border-blue-200 rounded">
            <p className="text-sm text-blue-900">
              <span className="font-bold">Note:</span> You
              will only have access to repositories that
              your instructor explicitly adds you to. The
              organization will not give you any other
              permissions.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
