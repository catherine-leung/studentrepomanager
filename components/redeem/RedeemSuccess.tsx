// components/redeem/RedeemSuccess.tsx

"use client";

import { RedeemNav } from "./RedeemNav";
import { COPY } from "@/lib/copy";

interface Props {
  repoName: string;
  repoUrl: string;
  cloneUrl: string;
  alreadyRedeemed: boolean;
  linkType?: "solo" | "group" | "coursedocs";
}

// cloneUrl is still passed in (the API still returns it, and other
// integrations may want it) but isn't shown here: cloning is
// simpler to walk through from the repo's own GitHub page than
// from a bare command students would have to copy and paste, so
// we just send them straight there via "View on GitHub".
export function RedeemSuccess({
  repoName,
  repoUrl,
  alreadyRedeemed,
  linkType = "solo",
}: Props) {
  const isCoursedocs = linkType === "coursedocs";

  const successTitle = alreadyRedeemed
    ? COPY.redeem.success.alreadyRedeemed
    : isCoursedocs
      ? COPY.redeem.success.coursedocsTitle
      : COPY.redeem.success.title;

  const successMessage = alreadyRedeemed
    ? COPY.redeem.success.alreadyRedeemedMessage
    : isCoursedocs
      ? COPY.redeem.success.coursedocsMessage
      : COPY.redeem.success.message;

  return (
    <div className="min-h-screen bg-canvas">
      <RedeemNav />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div
          className="rounded-xl border border-neutral-200
                     bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-center">
            <div
              className="flex h-16 w-16 items-center
                         justify-center rounded-full
                         bg-success/10"
            >
              <svg
                className="h-8 w-8 text-success"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1
                     1 0 00-1.414-1.414L9 10.586 7.707 9.293a1
                     1 0 00-1.414 1.414l2 2a1 1 0 001.414
                     0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <h1
            className="mb-2 text-center text-xl font-bold
                       text-neutral-900"
          >
            {successTitle}
          </h1>

          <p className="mb-5 text-center text-sm text-neutral-600">
            {successMessage}
          </p>

          <div className="mb-5 rounded-lg bg-neutral-50 p-4">
            <p className="mb-1 text-xs text-neutral-500">
              {COPY.redeem.success.repoName}
            </p>
            <p className="font-mono text-base font-bold
                          text-neutral-900">
              {repoName}
            </p>
          </div>

          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-md
                       bg-gradient-to-r from-primary-600
                       to-primary-700 px-6 py-3 text-center
                       text-base font-medium text-white
                       transition-colors
                       hover:from-primary-700
                       hover:to-primary-800
                       focus-visible:outline-none
                       focus-visible:ring-2
                       focus-visible:ring-primary-500
                       focus-visible:ring-offset-2"
          >
            View on GitHub →
          </a>
        </div>
      </main>
    </div>
  );
}
