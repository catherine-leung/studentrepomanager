// components/Header.tsx
//
// Shared site header: brand mark + name, "Add Organization",
// and the signed-in user with a sign-out action. Used on the
// dashboard, and any other authenticated page that needs the
// same top bar.

"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { COPY } from "@/lib/copy";

interface HeaderProps {
  userLogin?: string | null;
  userImage?: string | null;
  onAddOrganization: () => void;
}

export function Header({
  userLogin,
  userImage,
  onAddOrganization,
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-primary-100
                 bg-white"
    >
      <div
        className="mx-auto flex max-w-7xl items-center
                   justify-between px-6 py-3.5"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center
                       rounded-md bg-gradient-to-br from-primary-600
                       to-accent-600 shadow-sm
                       shadow-primary-600/20"
          >
            <LogoMark className="h-[18px] w-[18px] text-white" />
          </div>
          <span className="text-lg font-bold text-neutral-900">
            {COPY.appName}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onAddOrganization}
          >
            {COPY.nav.addOrganization}
          </Button>

          <div
            className="flex items-center gap-3 border-l
                       border-neutral-200 pl-4"
          >
            {userImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt=""
                className="h-8 w-8 rounded-full ring-1
                           ring-primary-200"
              />
            )}
            {userLogin && (
              <span className="text-sm font-medium
                               text-neutral-700">
                {userLogin}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
            >
              {COPY.nav.signOut}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
