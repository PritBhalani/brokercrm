import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CardProps = {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
};

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-app-border bg-app-surface shadow-sm shadow-black/10',
        padding && 'p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4', className)}>
      <div>
        <h3 className="text-base font-bold text-app-text-active tracking-tight">{title}</h3>
        {description ? <p className="text-sm text-app-text-muted mt-1">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
