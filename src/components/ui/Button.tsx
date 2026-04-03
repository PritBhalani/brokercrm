import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const variants = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-500/50 border border-blue-500/30',
  secondary:
    'bg-app-surface-hover text-app-text-active border border-app-border hover:bg-slate-700 focus-visible:ring-slate-500/40',
  ghost: 'bg-transparent text-app-text-muted border border-transparent hover:bg-app-surface-hover hover:text-app-text-active',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 border border-rose-500/40 focus-visible:ring-rose-500/40',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-500/30 focus-visible:ring-emerald-500/40',
  warning: 'bg-amber-600 text-white hover:bg-amber-500 border border-amber-500/30 focus-visible:ring-amber-500/40',
} as const;

type Variant = keyof typeof variants;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, type = 'button', ...props }, ref) => {
    const sizes = {
      sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg',
      md: 'px-4 py-2.5 text-sm font-semibold rounded-xl',
      lg: 'px-5 py-3 text-base font-semibold rounded-xl',
    };
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:opacity-45 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
