import type { SubmissionAction, SubmissionEvent } from "../types/curation";

const ACTION_LABELS: Record<SubmissionAction, string> = {
  suggested: "suggested this resource",
  requested: "requested this resource",
  added: "added this resource",
  expert_approved: "approved it as domain expert",
  expert_rejected: "rejected it as domain expert",
  admin_approved: "approved and published it",
  admin_rejected: "rejected it as admin",
  archived: "archived it",
};

export default function SubmissionTimeline({ events }: { events: SubmissionEvent[] }) {
  return (
    <ol className="space-y-2 border-l border-ink-200 pl-4 dark:border-ink-700">
      {events.map((e, i) => (
        <li key={i} className="text-sm">
          <span className="font-medium">@{e.actor}</span>{" "}
          <span className="text-ink-600 dark:text-ink-400">{ACTION_LABELS[e.action]}</span>
          <span className="ml-2 text-xs text-ink-500">{new Date(e.at).toLocaleString()}</span>
          {e.note && (
            <p className="mt-0.5 text-ink-600 italic dark:text-ink-400">“{e.note}”</p>
          )}
        </li>
      ))}
    </ol>
  );
}
