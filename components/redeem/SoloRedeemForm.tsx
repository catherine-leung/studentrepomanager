// components/redeem/SoloRedeemForm.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
      className="rounded-xl border border-neutral-200 bg-white
                 p-6 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-bold text-neutral-900">
        {COPY.redeem.solo.title}
      </h2>

      <div className="mb-5">
        <Input
          label={COPY.redeem.solo.slugLabel}
          placeholder={COPY.redeem.solo.slugPlaceholder}
          value={customSlug}
          onChange={(e) => setCustomSlug(e.target.value)}
          maxLength={100}
        />
        <p className="mt-2 text-xs text-neutral-500">
          {COPY.redeem.solo.slugHelp}{" "}
          <span className="font-mono font-bold text-neutral-900">
            {previewRepoName}
          </span>
        </p>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading}
        isLoading={loading}
      >
        {loading
          ? COPY.redeem.solo.creating
          : COPY.redeem.solo.createButton}
      </Button>
    </form>
  );
}
