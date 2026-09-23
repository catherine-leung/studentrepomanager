// components/LinkCard.tsx
//
// A single row in the links list. Collapsed by default — just
// enough to scan (name, type, access, status) plus the two most
// common actions (copy, delete) — so a semester with many
// redemption links stays a short scrollable list instead of a
// wall of cards. Click the row (or the chevron) to reveal the
// share URL, full metadata, and analytics.

"use client";

import { useState } from "react";
import { RepoCreationLink } from "@/lib/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LinkDetails } from "./LinkDetails";
import { COPY } from "@/lib/copy";

interface Props {
  link: RepoCreationLink;
  onDelete?: (linkId: string) => void;
  onStatusChange?: (linkId: string, newStatus: boolean) => void;
}

const TYPE_BADGE_COLOR: Record<
  RepoCreationLink["link_type"],
  "blue" | "purple" | "gray"
> = {
  solo: "blue",
  group: "purple",
  coursedocs: "gray",
};

const ICON_BUTTON_CLASSES =
  "inline-flex shrink-0 items-center justify-center " +
  "rounded-md text-neutral-500 hover:bg-neutral-100 " +
  "hover:text-neutral-900 focus:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-primary-500 " +
  "disabled:opacity-40 disabled:hover:bg-transparent";

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 text-neutral-400
                 transition-transform ${
                   expanded ? "rotate-90" : ""
                 }`}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 010-1.06L10.94
           10 7.21 6.29a.75.75 0 111.06-1.06l4.25
           4.25a.75.75 0 010 1.06l-4.25
           4.25a.75.75 0 01-1.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <rect x="6.5" y="3.5" width="9" height="11" rx="1.5" />
      <path
        d="M4 7v8a1.5 1.5 0 001.5 1.5H10"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4 text-success"
      aria-hidden="true"
    >
      <path
        d="M4.5 10.5l3.5 3.5 7.5-8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ToggleSwitchIcon({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-3.5 w-6 shrink-0
                 rounded-full transition-colors ${
                   on ? "bg-success" : "bg-neutral-300"
                 }`}
    >
      <span
        className={`absolute top-0.5 h-2.5 w-2.5 rounded-full
                   bg-white shadow-sm transition-transform ${
                     on ? "translate-x-3" : "translate-x-0.5"
                   }`}
      />
    </span>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5
           1.5 0 0112 4.5V6m-6.5 0 .6 9.4A1.5 1.5
           0 007.6 17h4.8a1.5 1.5 0 001.5-1.6L14.5 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LinkCard({
  link,
  onDelete,
  onStatusChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isExpired =
    link.expires_at !== null &&
    new Date(link.expires_at) < new Date();

  const isAdmin = link.access_level === "admin";
  const isActive = link.is_active;
  const isCoursedocs = link.link_type === "coursedocs";
  const isGroup = link.link_type === "group";
  const canShare = isActive && !isExpired;

  const typeLabel = {
    solo: COPY.linkForm.repositoryTypes.solo,
    group: COPY.linkForm.repositoryTypes.group,
    coursedocs: COPY.linkForm.repositoryTypes.coursedocs,
  }[link.link_type];

  const accessLevelLabel = {
    read: COPY.linkForm.accessLevels.read,
    write: COPY.linkForm.accessLevels.write,
    admin: COPY.linkForm.accessLevels.admin,
  }[link.access_level];

  async function handleToggleStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/links/${link.link_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: !isActive,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || COPY.errors.failedToUpdate
        );
      }

      onStatusChange?.(link.link_id, !isActive);
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

  async function handleDelete() {
    let message = COPY.linkCard.deleteConfirm;

    if (isCoursedocs) {
      message += "\n\n" + COPY.linkCard.deleteConfirmCoursedocs;
    }

    const confirmed = confirm(message);

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
          data.error || COPY.errors.failedToDelete
        );
      }

      onDelete?.(link.link_id);
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

  function copyToClipboard() {
    if (typeof window === "undefined" || !canShare) return;

    const url = `${window.location.origin}/redeem/${link.link_id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        setError(COPY.errors.failedToFetch);
      });
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/redeem/${link.link_id}`
      : `/redeem/${link.link_id}`;

  return (
    <div
      className={`border-l-4 ${
        isActive ? "border-l-primary-600" : "border-l-neutral-300"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex shrink-0 items-center gap-2
                     rounded-sm text-left focus:outline-none
                     focus-visible:ring-2
                     focus-visible:ring-primary-500"
        >
          <ChevronIcon expanded={expanded} />
          <span
            className="max-w-[220px] truncate text-sm
                       font-semibold text-neutral-900"
          >
            {link.assessment_name}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <Badge color={TYPE_BADGE_COLOR[link.link_type]}>
            {typeLabel}
          </Badge>
          {isAdmin && <Badge color="red">Admin</Badge>}
          {isExpired && (
            <Badge color="gray">{COPY.linkCard.expires}</Badge>
          )}
        </div>

        <div
          className={`flex min-w-0 flex-1 items-center gap-1.5
                     rounded-md border px-2 py-1 ${
                       canShare
                         ? "border-neutral-200 bg-white"
                         : "border-neutral-200 bg-neutral-50"
                     }`}
        >
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              canShare ? "text-neutral-900" : "text-neutral-400"
            }`}
          >
            {shareUrl}
          </span>
          <button
            type="button"
            onClick={copyToClipboard}
            disabled={!canShare}
            className={`${ICON_BUTTON_CLASSES} h-7 w-7`}
            aria-label={COPY.linkCard.copyUrl}
            title={
              canShare
                ? COPY.linkCard.copyUrl
                : "Reactivate this link to copy it"
            }
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>

        <button
          type="button"
          onClick={handleToggleStatus}
          disabled={loading || isExpired}
          className={`inline-flex shrink-0 items-center gap-1.5
                     rounded-full border px-2.5 py-1 text-xs
                     font-medium transition-colors
                     disabled:cursor-not-allowed
                     disabled:opacity-60 ${
                       isActive
                         ? "border-success/30 bg-success/10 " +
                           "text-success hover:border-success/50 " +
                           "hover:bg-success/20"
                         : "border-neutral-300 bg-neutral-100 " +
                           "text-neutral-500 " +
                           "hover:border-neutral-400 " +
                           "hover:bg-neutral-200"
                     }`}
          title={
            isActive
              ? COPY.linkCard.deactivate
              : COPY.linkCard.activate
          }
        >
          <ToggleSwitchIcon on={isActive} />
          {isActive ? COPY.linkCard.active : COPY.linkCard.inactive}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className={`${ICON_BUTTON_CLASSES} h-8 w-8
                     hover:bg-red-50 hover:text-error`}
          aria-label={COPY.linkCard.delete}
          title={COPY.linkCard.delete}
        >
          <TrashIcon />
        </button>
      </div>

      {expanded && (
        <div
          className="border-t border-neutral-100 bg-neutral-50/60
                     px-4 py-3 pl-9"
        >
          {error && (
            <div className="mb-3">
              <Alert type="error" message={error} />
            </div>
          )}

          <dl
            className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2
                       text-sm sm:grid-cols-4"
          >
            <div>
              <dt className="text-xs text-neutral-500">
                {COPY.linkCard.accessLevel}
              </dt>
              <dd
                className="font-medium capitalize
                           text-neutral-900"
              >
                {accessLevelLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">
                {COPY.linkCard.created}
              </dt>
              <dd className="font-medium text-neutral-900">
                {new Date(link.created_at).toLocaleDateString()}
              </dd>
            </div>
            {link.expires_at && (
              <div>
                <dt className="text-xs text-neutral-500">
                  {COPY.linkCard.expires}
                </dt>
                <dd
                  className={`font-medium ${
                    isExpired ? "text-warning" : "text-neutral-900"
                  }`}
                >
                  {new Date(
                    link.expires_at
                  ).toLocaleDateString()}
                </dd>
              </div>
            )}
            {isGroup && (
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-xs text-neutral-500">
                  {COPY.linkCard.maxTeamSize} /{" "}
                  {COPY.linkCard.maxGroups}
                </dt>
                <dd className="font-medium text-neutral-900">
                  {link.max_team_size || "Unlimited"} per team ·{" "}
                  {Number(link.current_groups) || 0} of{" "}
                  {link.max_groups || "Unlimited"} groups{" "}
                  {COPY.linkCard.created_count}
                </dd>
              </div>
            )}
            {isCoursedocs && (
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-xs text-neutral-500">
                  {COPY.linkCard.shareText}
                </dt>
                <dd className="font-medium text-neutral-900">
                  {COPY.linkCard.sharedAccess}
                </dd>
              </div>
            )}
          </dl>

          <div
            className="mb-3 flex flex-wrap items-center
                       justify-between gap-3"
          >
            <button
              type="button"
              onClick={() => setAnalyticsOpen(!analyticsOpen)}
              aria-expanded={analyticsOpen}
              className="text-sm font-medium text-primary-600
                         hover:text-primary-700
                         focus-visible:outline-none
                         focus-visible:ring-2
                         focus-visible:ring-primary-500
                         focus-visible:ring-offset-2 rounded-sm"
            >
              {analyticsOpen
                ? COPY.linkCard.hideAnalytics
                : COPY.linkCard.showAnalytics}
            </button>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleToggleStatus}
                disabled={loading || isExpired}
              >
                {isActive
                  ? COPY.linkCard.deactivate
                  : COPY.linkCard.activate}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
              >
                {COPY.linkCard.delete}
              </Button>
            </div>
          </div>

          {analyticsOpen && (
            <LinkDetails
              linkId={link.link_id}
              linkType={link.link_type}
            />
          )}
        </div>
      )}
    </div>
  );
}
