import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

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
          className={`w-full rounded-lg border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200  ${large ? "py-4 text-lg" : "py-2"}`}
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-5 font-medium text-white hover:bg-indigo-700"
        >
          Search
        </button>
      </div>
    </form>
  );
}
