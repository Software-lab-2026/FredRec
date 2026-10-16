import { useState } from "react";
import type { Resource } from "../types/resource";
import ReviewForm from "./ReviewForm";

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} hrs`;
}

const difficulty_style = {
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
    <article className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {resource.difficulty && (
          <span
            className={`rounded-full px-2 py-0.5 font-medium capitalize ${DIFFICULTY_STYLES[resource.difficulty]}`}
          >
            {resource.difficulty}
          </span>
        )}
        {resource.avgRating !== undefined && (
          <span className="text-amber-600 dark:text-amber-400">
            ★ {resource.avgRating.toFixed(1)}{" "}
            <span className="text-slate-500">({resource.reviewCount})</span>
          </span>
        )}
      </div>
      <a
        href={resource.url}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        {resource.title}
      </a>
      <p className="mt-1 text-xs text-slate-500">{meta.join(" · ")}</p>
      <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-400">
        {resource.description}
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onSave(resource)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            savedCount > 0
              ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900 dark:hover:bg-indigo-900"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
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
          className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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
