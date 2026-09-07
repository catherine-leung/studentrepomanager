// components/redeem/RedeemSuccess.tsx

"use client";

import { useState } from "react";

interface Props {
  repoName: string;
  repoUrl: string;
  cloneUrl: string;
  alreadyRedeemed: boolean;
}

export function RedeemSuccess({
  repoName,
  repoUrl,
  cloneUrl,
  alreadyRedeemed,
}: Props) {
  const [copied, setCopied] = useState(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(cloneUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            {alreadyRedeemed
              ? "Repository Access Confirmed"
              : "Repository Created!"}
          </h2>

          <p className="text-center text-gray-600 mb-6">
            {alreadyRedeemed
              ? "You already have access to this repository."
              : "Your repository has been created and you have been added as a collaborator."}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Repository Name
            </p>
            <p className="font-mono font-bold text-lg">
              {repoName}
            </p>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Clone Command
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
                {copied ? "Copied!" : "Copy"}
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
            <p className="text-sm text-blue-900">
              <span className="font-bold">Next steps:</span>
            </p>
            <ol className="text-sm text-blue-900 list-decimal
                           list-inside mt-2 space-y-1">
              <li>Clone the repository using the command above</li>
              <li>Complete the assignment</li>
              <li>Push your changes to GitHub</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}

