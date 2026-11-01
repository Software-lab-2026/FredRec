import { useState, type FormEvent } from "react";
import { submitReview } from "../api/workspace";
import type { Resource } from "../types/resource";

export default function ReviewForm({
  resource,
  onDone,
}: {
  resource: Resource;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setStatus("saving");
    await submitReview(resource, rating, text);
    setStatus("done");
    setTimeout(onDone, 1000);
  }

  if (status === "done")
    return (
      <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
        Thanks for your feedback!
      </p>
    );

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3"
    >
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className={`text-xl ${n <= rating ? "text-amber-500" : "text-slate-300 dark:text-slate-600"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did you think? (optional)"
        rows={2}
        className="w-full rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={!rating || status === "saving"}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
      >
        {status === "saving" ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
