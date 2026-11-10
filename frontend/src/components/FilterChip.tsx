import type { ReactNode } from "react";

export default function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${
        active
          ? "bg-brand-600 dark:bg-brand-400 text-brand-400 dark:text-brand-600"
          : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-700 dark:hover:bg-ink-800"
      }`}
    >
      {children}
    </button>
  );
}
