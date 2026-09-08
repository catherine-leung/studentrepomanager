// components/redeem/CoursedocsRedeemForm.tsx

"use client";

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
        Get Access to Course Documents
      </h3>

      <p className="text-gray-600 mb-6">
        Click below to join the course team and gain access
        to the shared repository.
      </p>

      <button
        onClick={() => onSubmit()}
        disabled={loading}
        className="w-full bg-blue-600 text-white px-6 py-3
                   rounded-lg hover:bg-blue-700 transition
                   font-medium disabled:bg-gray-400"
      >
        {loading ? "Granting access..." : "Get Access"}
      </button>
    </div>
  );
}
