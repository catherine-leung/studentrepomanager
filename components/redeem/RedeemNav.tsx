// components/redeem/RedeemNav.tsx
//
// Minimal branded header for the student-facing redeem flow —
// same logo badge and app name as the professor dashboard's
// Header, but with no actions (students have nothing to do up
// here), so the two halves of the app still read as one product.

import { LogoMark } from "@/components/ui/Logo";
import { COPY } from "@/lib/copy";

export function RedeemNav() {
  return (
    <header className="border-b border-primary-100 bg-white">
      <div className="mx-auto flex max-w-2xl items-center gap-3
                      px-4 py-3.5">
        <div
          className="flex h-8 w-8 items-center justify-center
                     rounded-md bg-gradient-to-br from-primary-600
                     to-accent-600 shadow-sm shadow-primary-600/20"
        >
          <LogoMark className="h-[18px] w-[18px] text-white" />
        </div>
        <span className="text-lg font-bold text-neutral-900">
          {COPY.appName}
        </span>
      </div>
    </header>
  );
}
