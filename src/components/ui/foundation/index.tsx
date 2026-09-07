"use client";

import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { foundationCopy, type UiLocale } from "@/lib/i18n/foundation";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  locale: UiLocale;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, locale, disabled, className = "", children, type = "button", ...props }, ref,
) {
  return (
    <button {...props} ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={`ui-button ui-button--${variant} ${className}`}>
      {loading ? foundationCopy[locale].loading : children}
    </button>
  );
});

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, hint, error, id, className = "", "aria-describedby": describedBy, ...props }, ref,
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const description = [describedBy, hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={inputId}>{label}</label>
      <input {...props} ref={ref} id={inputId} className={`ui-input ${className}`}
        aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={description || undefined} />
      {hint && <p className="ui-field__hint" id={`${inputId}-hint`}>{hint}</p>}
      {error && <p className="ui-field__error" id={`${inputId}-error`} role="alert">{error}</p>}
    </div>
  );
});

export function Panel({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-panel ${className}`} {...props} />;
}

export function StatusBadge({ tone = "neutral", children, className = "", ...props }: HTMLAttributes<HTMLSpanElement> & {
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  children: ReactNode;
}) {
  return <span {...props} className={`ui-badge ui-badge--${tone} ${className}`}>{children}</span>;
}

export function EmptyState({ title, description, icon, action }: {
  title: string; description: string; icon?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      {icon && <div className="ui-empty__icon" aria-hidden="true">{icon}</div>}
      <h3 className="ui-empty__title">{title}</h3>
      <p className="ui-empty__description">{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} aria-hidden="true" className={`ui-skeleton ${className}`} />;
}

export function LoadingState({ locale, children }: { locale: UiLocale; children?: ReactNode }) {
  return <div role="status" aria-busy="true"><span className="sr-only">{foundationCopy[locale].loading}</span>{children || <Skeleton />}</div>;
}
