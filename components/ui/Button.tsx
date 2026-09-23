// components/ui/Button.tsx

import React from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 " +
    "active:bg-primary-800 disabled:bg-neutral-300",
  secondary:
    "bg-white text-neutral-900 border border-neutral-300 " +
    "hover:border-primary-300 hover:bg-primary-50 " +
    "active:bg-primary-100 disabled:bg-neutral-100 " +
    "disabled:text-neutral-400",
  danger:
    "bg-error text-white hover:bg-red-700 " +
    "active:bg-red-800 disabled:bg-neutral-300",
  ghost:
    "bg-transparent text-primary-600 hover:bg-primary-50 " +
    "active:bg-primary-100 disabled:text-neutral-400",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center gap-2",
    "rounded-md font-medium",
    "transition-colors duration-150",
    "focus:outline-none focus-visible:ring-2",
    "focus-visible:ring-primary-500 focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  ].join(" ");

  return (
    <button
      disabled={disabled || isLoading}
      className={classes}
      {...props}
    >
      {isLoading && (
        <svg
          className="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.25"
          />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0
               12h4zm2 5.291A7.962 7.962 0 014 12H0c0
               3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
