// components/redeem/RedeemSuccess.tsx

"use client";

import { useState } from "react";
import { COPY } from "@/lib/copy";

interface Props {
  repoName: string;
  repoUrl: string;
  cloneUrl: string;
  alreadyRedeemed: boolean;
  linkType?: "solo" | "group" | "coursedocs";
}

export function RedeemSuccess({
  repoName,
  repoUrl,
  cloneUrl,
  alreadyRedeemed,
  linkType = "solo",
}: Props) {
  const [copied, setCopied] = useState(false);

  const isCoursedocs = linkType === "coursedocs";

  function copyToClipboard() {
    navigator.clipboard
      .writeText(cloneUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
      });
  }

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

  const nextStepsItems = isCoursedocs
    ? COPY.redeem.success.nextStepsCoursedocs
    : COPY.redeem.success.nextStepsItems;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">
            {COPY.appName}
          </h1>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full
                            flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center mb-2">
            {successTitle}
          </h2>

          <p className="text-center text-gray-600 mb-6">
            {successMessage}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">
              {COPY.redeem.success.repoName}
            </p>
            <p className="font-mono font-bold text-lg">
              {repoName}
            </p>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              {COPY.redeem.success.cloneCommand}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={cloneUrl}
                readOnly
                className="flex-1 px-4 py-2 border
                           border-gray-300 rounded-lg
                           bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-gray-200
                           hover:bg-gray-300 rounded-lg
                           transition font-medium text-sm"
              >
                {copied ? COPY.linkCard.copied : COPY.linkCard.copyUrl}
              </button>
            </div>
          </div>

          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-600 text-white px-6
                       py-3 rounded-lg hover:bg-blue-700
                       transition font-medium text-center mb-4"
          >
            View on GitHub →
          </a>

          <div className="p-4 bg-blue-50 border border-blue-200
                          rounded">
            <p className="text-sm text-blue-900 font-bold mb-2">
              {COPY.redeem.success.nextSteps}
            </p>
            <ol className="text-sm text-blue-900 list-decimal
                           list-inside space-y-1">
              {nextStepsItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
