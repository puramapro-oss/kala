'use client';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  circle?: boolean;
}

export default function Skeleton({ className = '', width, height, circle = false }: SkeletonProps) {
  const style = {
    width: width || '100%',
    height: height || '1rem',
  };

  return (
    <div
      className={`animate-pulse bg-background-soft/30 ${circle ? 'rounded-full' : 'rounded-lg'} ${className}`}
      style={style}
    />
  );
}
