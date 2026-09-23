// components/ui/Card.tsx

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated';
}

export function Card({
  children,
  className = '',
  variant = 'default',
}: CardProps) {
  const variantStyles = {
    default: 'bg-white border border-neutral-200 shadow-sm',
    elevated: 'bg-white shadow-md',
  };

  return (
    <div
      className={`
        rounded-lg p-6
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
