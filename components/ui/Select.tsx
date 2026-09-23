// components/ui/Select.tsx

import React from 'react';

interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  /** Tighter label/field/hint spacing for dense layouts. */
  dense?: boolean;
}

export function Select({
  label,
  error,
  hint,
  options,
  dense = false,
  className = '',
  id,
  ...props
}: SelectProps) {
  // Same association fix as Input: without htmlFor/id, screen
  // readers never announce this label and clicking it doesn't
  // focus the select.
  const generatedId = React.useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy =
    [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
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
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`
          w-full px-4 rounded-md
          border border-neutral-300
          text-base font-normal
          bg-white
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
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
