// components/redeem/CoursedocsRedeemForm.tsx

"use client";

import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";

interface Props {
  repoName: string;
  onSubmit: () => Promise<void>;
  loading: boolean;
}

export function CoursedocsRedeemForm({
  onSubmit,
  loading,
}: Props) {
  return (
    <div
      className="rounded-xl border border-neutral-200 bg-white
                 p-6 shadow-sm"
    >
      <h2 className="mb-3 text-lg font-bold text-neutral-900">
        {COPY.redeem.coursedocs.title}
      </h2>

      <p className="mb-5 text-sm text-neutral-600">
        {COPY.redeem.coursedocs.message}
      </p>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => onSubmit()}
        disabled={loading}
        isLoading={loading}
      >
        {loading
          ? COPY.redeem.coursedocs.granting
          : COPY.redeem.coursedocs.getAccessButton}
      </Button>
    </div>
  );
}
