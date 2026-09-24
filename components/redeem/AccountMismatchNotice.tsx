// components/redeem/AccountMismatchNotice.tsx
//
// Shown instead of the normal join-org flow when the signed-in
// student's GitHub account can never join this org: a personal
// account facing an Enterprise Managed Users (EMU) org, or an
// EMU account facing a normal org. GitHub itself would just
// bounce the invitation with a confusing error, so this explains
// what's wrong and how to fix it (sign in with the other kind of
// account, usually in a different browser).

"use client";

import { signOut } from "next-auth/react";
import { RedeemNav } from "./RedeemNav";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/copy";

interface Props {
  reason: "needs_personal_account" | "needs_enterprise_account";
  currentLogin: string;
}

export function AccountMismatchNotice({
  reason,
  currentLogin,
}: Props) {
  const copy =
    reason === "needs_personal_account"
      ? COPY.redeem.accountMismatch.needsPersonalAccount
      : COPY.redeem.accountMismatch.needsEnterpriseAccount;

  return (
    <div className="min-h-screen bg-canvas">
      <RedeemNav />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div
          className="rounded-xl border border-neutral-200
                     bg-white p-6 shadow-sm"
        >
          <h1
            className="mb-3 text-xl font-bold text-neutral-900"
          >
            {COPY.redeem.accountMismatch.title}
          </h1>

          <p className="mb-5 text-sm text-neutral-600">
            {COPY.redeem.accountMismatch.signedInAs}{" "}
            <span
              className="font-mono font-bold text-neutral-900"
            >
              {currentLogin}
            </span>
          </p>

          <div className="mb-5">
            <Alert type="warning" message={copy.message} />
          </div>

          <p className="mb-6 text-sm text-neutral-600">
            {copy.instructions}
          </p>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            {COPY.redeem.accountMismatch.switchAccount}
          </Button>
        </div>
      </main>
    </div>
  );
}
