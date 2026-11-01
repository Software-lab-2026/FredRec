import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";

const POPULAR_TOPICS = [
  "Operating Systems",
  "Machine Learning",
  "Computer Networks",
  "System Design",
  "Database Management Systems",
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl pt-12 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Search Computer Science Topics for Free
      </h1>
      <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
        Search any CS topic and find free videos, courses, textbooks, research
        papers and more — all in one place.
      </p>
      <div className="mt-8">
        <SearchBar large />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Popular:
        </span>
        {POPULAR_TOPICS.map((topic) => (
          <Link
            key={topic}
            to={`/search?q=${encodeURIComponent(topic)}`}
            className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-900 dark:hover:text-indigo-300"
          >
            {topic}
          </Link>
        ))}
      </div>
    </div>
  );
}
