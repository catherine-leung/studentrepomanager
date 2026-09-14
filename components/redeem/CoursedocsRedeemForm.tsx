// components/redeem/CoursedocsRedeemForm.tsx

"use client";

import { COPY } from "@/lib/copy";

interface Props {
  repoName: string;
  onSubmit: () => Promise<void>;
  loading: boolean;
}

export function CoursedocsRedeemForm({
  repoName,
  onSubmit,
  loading,
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-4">
        {COPY.redeem.coursedocs.title}
      </h3>

      <p className="text-gray-600 mb-6">
        {COPY.redeem.coursedocs.message}
      </p>

      <button
        onClick={() => onSubmit()}
        disabled={loading}
        className="w-full bg-blue-600 text-white px-6 py-3
                   rounded-lg hover:bg-blue-700 transition
                   font-medium disabled:bg-gray-400"
      >
        {loading
          ? COPY.redeem.coursedocs.granting
          : COPY.redeem.coursedocs.getAccessButton}
      </button>
    </div>
  );
}
