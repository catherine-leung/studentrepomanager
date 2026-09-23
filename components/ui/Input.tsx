// components/ui/Input.tsx

import React from 'react';

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Tighter label/field/hint spacing for dense layouts. */
  dense?: boolean;
}

export function Input({
  label,
  error,
  hint,
  dense = false,
  className = '',
  id,
  ...props
}: InputProps) {
  // A generated id (falls back to any id the caller passed in)
  // so the <label> is actually associated with this field --
  // without it, screen readers never announce the label and
  // clicking the label text doesn't focus the input.
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-sm font-medium
                      text-neutral-900
                      ${dense ? 'mb-1' : 'mb-2'}`}
        >
          {label}
          {props.required && (
            <span className="text-error ml-1">*</span>
          )}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`
          w-full px-4 rounded-md
          border border-neutral-300
          text-base font-normal
          placeholder:text-neutral-400
          focus:outline-none focus:ring-2
          focus:ring-primary-500 focus:border-transparent
          disabled:bg-neutral-50 disabled:text-neutral-500
          disabled:cursor-not-allowed
          transition-colors duration-fast
          ${dense ? 'py-1.5' : 'py-2'}
          ${error ? 'border-error focus:ring-error' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
      {hint && !error && (
        <p
          id={hintId}
          className={`text-sm text-neutral-500
                      ${dense ? 'mt-0.5' : 'mt-1'}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
