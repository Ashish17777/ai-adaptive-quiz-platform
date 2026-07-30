import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../utils/cn';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    
    const variantStyles = {
      default: 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-sm',
      destructive: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-sm',
      outline: 'border border-gray-200 dark:border-gray-800 bg-transparent text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
      secondary: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98]',
      ghost: 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
      link: 'text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline bg-transparent p-0 h-auto'
    };

    const sizeStyles = {
      default: 'h-10 px-4 py-2 text-sm',
      sm: 'h-8 px-3 text-xs rounded-md',
      lg: 'h-12 px-8 text-base rounded-md',
      icon: 'h-9 w-9 p-0 flex items-center justify-center'
    };

    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
