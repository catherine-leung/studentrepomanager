// components/LinkCard.tsx

"use client";

import { useState } from "react";
import { RepoCreationLink } from "@/lib/types";
import { LinkDetails } from "./LinkDetails";

interface Props {
  link: RepoCreationLink;
  onDelete?: (linkId: string) => void;
  onStatusChange?: (
    linkId: string,
    isActive: boolean
  ) => void;
}

export function LinkCard({
  link,
  onDelete,
  onStatusChange,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkUrl = `/redeem/${link.link_id}`;
  const isActive = link.is_active;
  const isExpired =
    link.expires_at &&
    new Date(link.expires_at) < new Date();

  function copyToClipboard() {
    const fullUrl =
      `${window.location.origin}${linkUrl}`;

    navigator.clipboard.writeText(fullUrl);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  async function handleToggleStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/links/${link.link_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !isActive,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(
          data.error || "Failed to update link status"
        );
      }

      onStatusChange?.(
        link.link_id,
        !isActive
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = confirm(
      "Delete this link permanently? Links with " +
      "redemptions cannot be deleted and must be " +
      "deactivated instead."
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/links/${link.link_id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();

        throw new Error(
          data.error || "Failed to delete link"
        );
      }

      onDelete?.(link.link_id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={
        "bg-white rounded-lg shadow p-4 border-l-4 " +
        (
          isExpired
            ? "border-red-500"
            : isActive
              ? "border-green-500"
              : "border-gray-500"
        )
      }
    >
      {error && (
        <div
          className={
            "mb-3 p-3 bg-red-50 border border-red-200 " +
            "rounded text-red-700 text-sm"
          }
        >
          {error}
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg">
            {link.assessment_name}
          </h3>

          <p className="text-sm text-gray-600">
            {link.link_type === "solo"
              ? "Individual Assignment"
              : "Group Assignment"}{" "}
            • ID: {link.link_id}
          </p>
        </div>

        <span
          className={
            "px-3 py-1 rounded-full text-sm font-medium " +
            (
              isExpired
                ? "bg-red-100 text-red-800"
                : isActive
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
            )
          }
        >
          {isExpired
            ? "Expired"
            : isActive
              ? "Active"
              : "Inactive"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <p className="text-gray-600">Access Level</p>
          <p className="font-medium capitalize">
            {link.access_level}
          </p>
        </div>

        <div>
          <p className="text-gray-600">Created</p>
          <p className="font-medium">
            {new Date(
              link.created_at
            ).toLocaleDateString()}
          </p>
        </div>

        <div>
          <p className="text-gray-600">Expires</p>
          <p className="font-medium">
            {link.expires_at
              ? new Date(
                  link.expires_at
                ).toLocaleDateString()
              : "Never"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={linkUrl}
          readOnly
          className={
            "flex-1 px-3 py-2 border border-gray-300 " +
            "rounded text-sm bg-gray-50"
          }
        />

        <button
          onClick={copyToClipboard}
          className={
            "px-4 py-2 bg-gray-200 hover:bg-gray-300 " +
            "rounded transition text-sm font-medium"
          }
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setShowDetails(!showDetails);
          }}
          className={
            "px-4 py-2 bg-blue-600 text-white rounded " +
            "hover:bg-blue-700 transition text-sm " +
            "disabled:bg-gray-400"
          }
          disabled={loading}
        >
          {showDetails ? "Hide" : "View"} Details
        </button>

        <button
          onClick={handleToggleStatus}
          disabled={loading || (!isActive && !!isExpired)}
          className={
            "px-4 py-2 rounded transition text-sm " +
            "font-medium disabled:bg-gray-400 " +
            "disabled:cursor-not-allowed " +
            (
              isActive
                ? "bg-yellow-500 hover:bg-yellow-600 " +
                  "text-white"
                : "bg-green-500 hover:bg-green-600 " +
                  "text-white"
            )
          }
        >
          {loading
            ? "..."
            : isActive
              ? "Deactivate"
              : "Reactivate"}
        </button>

        <button
          onClick={handleDelete}
          disabled={loading}
          className={
            "px-4 py-2 bg-red-500 text-white rounded " +
            "hover:bg-red-600 transition text-sm " +
            "font-medium disabled:bg-gray-400 " +
            "disabled:cursor-not-allowed"
          }
        >
          {loading ? "..." : "Delete"}
        </button>
      </div>

      {showDetails && (
        <LinkDetails linkId={link.link_id} />
      )}
    </div>
  );
}
