import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl ${className}`}
      {...props}
    />
  );
}
