// components/ui/Logo.tsx
//
// The app's mark: a repo "branch" trunk growing up into a
// graduation cap — repository management, for coursework. Drawn
// as plain SVG primitives so it stays crisp at favicon sizes and
// costs nothing to render (no images, no fonts).

import React from "react";

interface LogoMarkProps {
  className?: string;
}

export function LogoMark({ className = "h-4 w-4" }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* trunk growing up from the repo node into the cap */}
      <path
        d="M14 22.6 L14 9.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* branch off the trunk */}
      <path
        d="M14 14.4 C18.5 14.4 18.5 19 20.8 19"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="14" cy="25" r="2.4" fill="currentColor" />
      <circle cx="23" cy="19" r="2.2" fill="currentColor" />

      {/* mortarboard */}
      <path
        d="M14 2.2 L19.6 6 L14 9.8 L8.4 6 Z"
        fill="currentColor"
      />
      <rect
        x="11.6"
        y="6.6"
        width="4.8"
        height="2.6"
        rx="0.8"
        fill="currentColor"
      />
      <path
        d="M19.6 6 L19.6 10.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="19.6" cy="10.9" r="0.9" fill="currentColor" />
    </svg>
  );
}
