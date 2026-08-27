'use client';

import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glass?: boolean;
}

export default function Card({ children, glass = true, className = '', ...props }: CardProps) {
  const baseClasses = 'rounded-lg overflow-hidden';
  const glassClasses = glass ? 'glass' : 'bg-background-soft';

  return (
    <div className={`${baseClasses} ${glassClasses} ${className}`} {...props}>
      {children}
    </div>
  );
}
