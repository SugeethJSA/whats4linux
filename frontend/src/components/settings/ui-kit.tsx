import { useEffect, useRef, useState } from "react"
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react"
import clsx from "clsx"
import ToggleButton from "./ToggleButton"

/* Modern settings design primitives used across every settings screen.
   Cards, rows, segmented/menu selects, inputs and buttons share the same
   WhatsApp-inspired tokens as the rest of the app (light/dark aware). */

const cardCls =
  "rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-dark-secondary shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"

export function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      className={clsx("transition-transform duration-200", className)}
    >
      <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
    </svg>
  )
}

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className={className}>
      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  )
}

export function SettingsCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={clsx(cardCls, className)}>{children}</div>
}

/** A card whose children are rows separated by subtle dividers. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <SettingsCard className={className}>
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">{children}</div>
    </SettingsCard>
  )
}

export function SettingRow({
  title,
  description,
  icon,
  control,
  onClick,
  danger,
}: {
  title: string
  description?: string
  icon?: ReactNode
  control?: ReactNode
  onClick?: () => void
  danger?: boolean
}) {
  const clickable = Boolean(onClick)
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? e => e.key === "Enter" && onClick?.() : undefined}
      className={clsx(
        "flex items-center gap-3 px-4 py-3.5",
        clickable && "cursor-pointer transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
      )}
    >
      {icon && (
        <div
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            danger
              ? "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
              : "bg-black/[0.04] text-light-muted dark:bg-white/[0.06] dark:text-dark-muted",
          )}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div
          className={clsx(
            "text-[15px] font-medium",
            danger ? "text-red-600 dark:text-red-400" : "text-light-text dark:text-dark-text",
          )}
        >
          {title}
        </div>
        {description && (
          <div className="mt-0.5 text-[13px] leading-snug text-light-muted dark:text-dark-muted">
            {description}
          </div>
        )}
      </div>
      {control && <div className="flex shrink-0 items-center">{control}</div>}
      {clickable && !control && <ChevronIcon className="text-light-muted/60 dark:text-dark-muted/60" />}
    </div>
  )
}

/** Convenience wrapper: a SettingRow bound to the app's toggle component. */
export function SwitchRow({
  title,
  description,
  icon,
  enabled,
  onToggle,
}: {
  title: string
  description?: string
  icon?: ReactNode
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <SettingRow
      title={title}
      description={description}
      icon={icon}
      control={<ToggleButton isEnabled={enabled} onToggle={onToggle} />}
    />
  )
}

/** WhatsApp-style menu button that opens a floating list of options. */
export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const current = options.find(o => o.value === value)

  return (
    <div ref={ref} className={clsx("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className={clsx(
          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
          "bg-black/[0.04] text-light-muted hover:bg-black/[0.08] hover:text-light-text",
          "dark:bg-white/[0.06] dark:text-dark-muted dark:hover:bg-white/[0.1] dark:hover:text-dark-text",
          disabled && "opacity-50",
        )}
      >
        <span className="max-w-48 truncate">{current?.label ?? ""}</span>
        <ChevronIcon className={clsx("fill-current", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={clsx(
            "absolute z-50 mt-1.5 min-w-40 overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.1]",
            "bg-white dark:bg-dark-elevated shadow-xl shadow-black/10",
            "animate-[menuFadeIn_0.16s_ease] origin-top",
          )}
        >
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={clsx(
                "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] transition-colors",
                "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
                o.value === value
                  ? "text-[#21c063]"
                  : "text-light-text dark:text-dark-text",
              )}
            >
              <span>{o.label}</span>
              {o.value === value && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  wrapperClassName?: string
}

export function TextField({
  label,
  wrapperClassName,
  className,
  ...props
}: TextFieldProps) {
  return (
    <label className={clsx("block min-w-0 flex-1", wrapperClassName)}>
      {label && (
        <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted">
          {label}
        </span>
      )}
      <input
        {...props}
        className={clsx(
          "w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-transparent",
          "px-3 py-2 text-sm text-light-text dark:text-dark-text placeholder:text-light-muted/70 dark:placeholder:text-dark-muted/60",
          "outline-none transition-all focus:border-[#21c063] focus:ring-2 focus:ring-[#21c063]/20",
          className,
        )}
      />
    </label>
  )
}

type ActionVariant = "primary" | "neutral" | "danger" | "ghost"

const actionVariants: Record<ActionVariant, string> = {
  primary:
    "bg-[#21c063] text-[#0a1014] hover:bg-[#1ea952] disabled:hover:bg-[#21c063]",
  neutral:
    "bg-black/[0.05] text-light-text hover:bg-black/[0.09] dark:bg-white/[0.08] dark:text-dark-text dark:hover:bg-white/[0.13]",
  danger: "bg-red-500 text-white hover:bg-red-600 disabled:hover:bg-red-500",
  ghost:
    "text-light-muted hover:text-light-text hover:bg-black/[0.04] dark:text-dark-muted dark:hover:text-dark-text dark:hover:bg-white/[0.06]",
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionVariant
}

export function ActionButton({
  variant = "primary",
  className,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        actionVariants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function StatusBanner({
  tone = "success",
  children,
}: {
  tone?: "success" | "error" | "info"
  children: ReactNode
}) {
  return (
    <div
      className={clsx(
        "rounded-xl px-3.5 py-2.5 text-[13px] font-medium animate-slide-up",
        tone === "success" && "bg-[#21c063]/10 text-[#1b9a58] dark:text-[#5fd385]",
        tone === "error" && "bg-red-500/10 text-red-600 dark:text-red-400",
        tone === "info" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description?: string
}) {
  return (
    <div className="mb-5 flex items-center gap-3.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#21c063]/10 text-[#21c063]">
        {icon}
      </div>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-light-text dark:text-dark-text">
          {title}
        </h1>
        {description && (
          <p className="truncate text-[13px] text-light-muted dark:text-dark-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}