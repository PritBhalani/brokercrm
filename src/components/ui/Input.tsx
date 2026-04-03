import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-1.5">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl border border-app-border bg-app-root px-3 py-2.5 text-sm text-app-text-active placeholder:text-app-text-muted',
            'focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = 'Input';
