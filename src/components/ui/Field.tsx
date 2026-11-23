'use client';
import { forwardRef } from 'react';

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-100';

interface WrapProps { label?: string; hint?: string; className?: string; children: React.ReactNode }
export function Field({ label, hint, className = '', children }: WrapProps) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; wrapClass?: string };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, wrapClass, className = '', ...p }, ref) {
  return <Field label={label} hint={hint} className={wrapClass}><input ref={ref} className={`${inputCls} ${className}`} {...p} /></Field>;
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string; wrapClass?: string };
export function Select({ label, hint, wrapClass, className = '', children, ...p }: SelectProps) {
  return <Field label={label} hint={hint} className={wrapClass}><select className={`${inputCls} ${className}`} {...p}>{children}</select></Field>;
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; wrapClass?: string };
export function Textarea({ label, wrapClass, className = '', ...p }: TextareaProps) {
  return <Field label={label} className={wrapClass}><textarea className={`${inputCls} ${className}`} rows={3} {...p} /></Field>;
}

export { inputCls };
