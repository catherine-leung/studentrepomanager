// components/ui/Alert.tsx

import type { ReactNode } from 'react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  type: AlertType;
  title?: string;
  message: string;
  onDismiss?: () => void;
  children?: ReactNode;
}

const typeStyles: Record<AlertType, string> = {
  success: 'bg-green-50 border-green-200 text-green-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  info: 'bg-primary-50 border-primary-200 text-primary-900',
};

const icons: Record<AlertType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function Alert({
  type,
  title,
  message,
  onDismiss,
  children,
}: AlertProps) {
  return (
    <div
      className={`
        border-l-4 rounded-md p-4
        ${typeStyles[type]}
      `}
    >
      <div className="flex items-start">
        <span className="mr-3 text-lg font-bold">
          {icons[type]}
        </span>
        <div className="flex-1">
          {title && (
            <h3 className="font-semibold mb-1">{title}</h3>
          )}
          {message && <p className="text-sm">{message}</p>}
          {children}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-4 text-lg opacity-50
                       hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
