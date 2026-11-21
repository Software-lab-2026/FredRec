import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";

const POPULAR = [
  "Operating Systems",
  "Dynamic Programming",
  "Machine Learning",
  "Computer Netowrks",
  "System Design",
  "Database Management System",
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl pt-12 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-ink-900 dark:text-ink-100">
        Learn Computer Science for free
      </h1>
      <p className="mt-3 text-lg text-ink-600 dark:text-ink-400">
        Search any CS topic and find free videos, courses, textbooks, research
        papers and more — all in one place.
      </p>
      <div className="mt-8">
        <SearchBar large />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <span className="text-sm text-ink-500">Popular:</span>
        {POPULAR.map((t) => (
          <Link
            key={t}
            to={`/search?q=${encodeURIComponent(t)}`}
            className="rounded-full border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-1 text-sm text-ink-700 dark:text-ink-300 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          >
            {t}
          </Link>
        ))}
      </div>
      <p className="mt-10 text-sm text-ink-500">
        <Link
          to="/signup"
          className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
        >
          Create a free account
        </Link>{" "}
        to save resources, track your progress and study with your team.
      </p>
    </div>
  );
}
