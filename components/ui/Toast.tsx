// components/ui/Toast.tsx

import React, { useEffect, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose?: () => void;
  icon?: React.ReactNode;
}

const variantConfig: Record<
  ToastVariant,
  { bg: string; text: string; icon: string }
> = {
  success: {
    bg: 'bg-success-500',
    text: 'text-white',
    icon: 'text-success-200',
  },
  error: {
    bg: 'bg-error-500',
    text: 'text-white',
    icon: 'text-error-200',
  },
  info: {
    bg: 'bg-primary-500',
    text: 'text-white',
    icon: 'text-primary-200',
  },
  warning: {
    bg: 'bg-warning-500',
    text: 'text-white',
    icon: 'text-warning-200',
  },
};

export function Toast({
  message,
  variant = 'info',
  duration = 3000,
  onClose,
  icon,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const config = variantConfig[variant];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed bottom-4 right-4 px-6 py-4 rounded-lg
        shadow-lg animate-slide-up
        ${config.bg} ${config.text}
        flex items-center gap-3
      `}
    >
      {icon && <span className={config.icon}>{icon}</span>}
      <p className="font-medium">{message}</p>
    </div>
  );
}
