// components/redeem/SoloRedeemForm.tsx

"use client";

import { useState } from "react";
import { buildRepoName } from "@/lib/naming";
import { COPY } from "@/lib/copy";

interface Props {
  assessmentName: string;
  onSubmit: (customSlug?: string) => Promise<void>;
  loading: boolean;
}

export function SoloRedeemForm({
  assessmentName,
  onSubmit,
  loading,
}: Props) {
  const [customSlug, setCustomSlug] = useState("");

  const previewRepoName = buildRepoName(
    assessmentName,
    customSlug || "your-username"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(customSlug || undefined);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow p-6"
    >
      <h3 className="text-xl font-bold mb-4">
        {COPY.redeem.solo.title}
      </h3>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          {COPY.redeem.solo.slugLabel}
        </label>
        <input
          type="text"
          placeholder={COPY.redeem.solo.slugPlaceholder}
          value={customSlug}
          onChange={(e) => setCustomSlug(e.target.value)}
          maxLength={100}
          className="w-full px-4 py-2 border border-gray-300
                     rounded-lg focus:outline-none
                     focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-2">
          {COPY.redeem.solo.slugHelp}
          <span className="font-mono font-bold">
            {" "}
            {previewRepoName}
          </span>
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-6 py-3
                   rounded-lg hover:bg-blue-700 transition
                   font-medium disabled:bg-gray-400"
      >
        {loading
          ? COPY.redeem.solo.creating
          : COPY.redeem.solo.createButton}
      </button>
    </form>
  );
}
