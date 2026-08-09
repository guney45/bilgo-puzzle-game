import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-emerald-500 text-slate-950 hover:enabled:bg-emerald-400',
  secondary: 'bg-slate-700 text-slate-100 hover:enabled:bg-slate-600',
  ghost: 'border border-slate-700 bg-transparent text-slate-300 hover:enabled:bg-slate-800',
};

export function Button({ variant = 'primary', className = '', style, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`min-h-12 w-full rounded-lg px-4 py-3 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      style={{ touchAction: 'manipulation', ...style }}
      {...props}
    />
  );
}
