'use client';

import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`px-3 py-2 rounded-lg border bg-background-soft text-foreground placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed ${
          error
            ? 'border-alert'
            : 'border-border'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-alerte">{error}</span>}
    </div>
  );
}
