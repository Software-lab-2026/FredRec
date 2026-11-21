import { useState } from "react";
import type { Resource } from "../types/resource";
import ReviewForm from "./ReviewForm";

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr${hours > 1 ? "s" : ""}`;
}

const DIFFICULTY_STYLES = {
  beginner:
    "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
  intermediate:
    "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
  advanced: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300",
};

interface Props {
  resource: Resource;
  savedCount: number;
  onSave: (resource: Resource) => void;
  onRequireLogin: () => void;
  loggedIn: boolean;
}

export default function ResourceCard({
  resource,
  savedCount,
  onSave,
  onRequireLogin,
  loggedIn,
}: Props) {
  const [reviewing, setReviewing] = useState(false);
  const meta = [
    resource.source,
    resource.authors.join(", "),
    resource.durationMinutes && formatDuration(resource.durationMinutes),
    resource.pages && `${resource.pages} pages`,
    resource.publishedYear,
  ].filter(Boolean);

  return (
    <article className="flex flex-col rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {resource.origin === "curated" && (
          <span
            title="Suggested by a learner, reviewed by a domain expert and approved by the admin"
            className="rounded-full bg-brand-600 dark:bg-brand-400 px-2 py-0.5 font-medium text-brand-400 dark:text-brand-600"
          >
             Expert reviewed
          </span>
        )}
        {resource.difficulty && (
          <span
            className={`rounded-full px-2 py-0.5 font-medium capitalize ${DIFFICULTY_STYLES[resource.difficulty]}`}
          >
            {resource.difficulty}
          </span>
        )}
        {resource.avgRating != null && (
          <span className="text-amber-600 dark:text-amber-400">
            ★ {resource.avgRating.toFixed(1)}{" "}
            <span className="text-ink-500">({resource.reviewCount})</span>
          </span>
        )}
      </div>
      <a
        href={resource.url}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-ink-900 dark:text-ink-100 hover:text-brand-600 dark:hover:text-brand-400"
      >
        {resource.title}
      </a>
      <p className="mt-1 text-xs text-ink-500">{meta.join(" · ")}</p>
      <p className="mt-2 flex-1 text-sm text-ink-600 dark:text-ink-400">
        {resource.description}
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onSave(resource)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            savedCount > 0
              ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:ring-brand-900 dark:hover:bg-brand-900"
              : "bg-brand-600 dark:bg-brand-400 text-brand-400 dark:text-brand-600 hover:bg-brand-700 dark:hover:bg-brand-300"
          }`}
        >
          {savedCount > 0
            ? `✓ Saved${savedCount > 1 ? ` in ${savedCount}` : ""}`
            : "Save to workspace"}
        </button>
        <button
          onClick={() =>
            loggedIn ? setReviewing((r) => !r) : onRequireLogin()
          }
          className="rounded-md border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
        >
          Rate
        </button>
      </div>
      {reviewing && (
        <ReviewForm resource={resource} onDone={() => setReviewing(false)} />
      )}
    </article>
  );
}
