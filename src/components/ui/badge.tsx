import * as React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantStyles = {
    default: 'border-transparent bg-indigo-600 text-white shadow hover:bg-indigo-600/80',
    secondary: 'border-transparent bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 hover:bg-gray-100/80',
    destructive: 'border-transparent bg-red-500/10 text-red-500 border border-red-500/20',
    outline: 'text-gray-950 dark:text-gray-50 border border-gray-200 dark:border-gray-800',
    success: 'border-transparent bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    warning: 'border-transparent bg-amber-500/10 text-amber-500 border border-amber-500/20',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
