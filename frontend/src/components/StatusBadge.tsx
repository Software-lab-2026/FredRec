import { STATUS_LABELS, type SubmissionStatus } from "../types/curation";

const STYLES: Record<SubmissionStatus, string> = {
  pending_expert: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  pending_admin: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  archived: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
