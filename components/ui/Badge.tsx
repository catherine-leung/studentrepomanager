// components/ui/Badge.tsx

type BadgeColor =
  | 'blue'
  | 'green'
  | 'red'
  | 'yellow'
  | 'purple'
  | 'gray';

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  className?: string;
}

const colorStyles: Record<BadgeColor, string> = {
  blue: 'bg-primary-100 text-primary-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  purple: 'bg-accent-50 text-accent-600',
  gray: 'bg-neutral-100 text-neutral-700',
};

export function Badge({
  children,
  color = 'gray',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5
        rounded-full text-xs font-medium
        ${colorStyles[color]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
