import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { suggestTopics } from "../data/topics";

export default function SearchBar({
  initialQuery = "",
  large = false,
}: {
  initialQuery?: string;
  large?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const suggestions = suggestTopics(query);

  function go(q: string) {
    if (!q.trim()) return;
    setOpen(false);
    setQuery(q);
    navigate(` /search?q=${encodeURIComponent(q.trim())}`);
  }
  function onSubmit(e: Formevent) {
    e.preventDefault();
    go(query);
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search a CS Topic"
          className={`w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900  ${large ? "py-4 text-lg" : "py-2"}`}
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-5 font-medium text-white hover:bg-indigo-700"
        >
          Search
        </button>
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={() => go(s)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-slate-800"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
