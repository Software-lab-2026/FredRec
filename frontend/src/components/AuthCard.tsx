import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle: string
  error: string
  footer: ReactNode
  children: ReactNode
}

export default function AuthCard({ title, subtitle, error, footer, children }: Props) {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
      {error && <p className="mt-4 rounded-md bg-rose-50 dark:bg-rose-950 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <div className="mt-6">{children}</div>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</p>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
}

export function Field({ label, value, onChange, type = 'text', autoComplete }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="mt-1 w-full rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
      />
    </label>
  )
}
