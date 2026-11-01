import { Link } from "react-router-dom";
import { TOPIC_DOMAINS } from "../data/topics";

export default function TopicsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Browse Computer Science topics</h1>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TOPIC_DOMAINS.map((d) => (
          <section
            key={d.domain}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
          >
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">
              {d.domain}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {d.topics.map((t) => (
                <li key={t}>
                  <Link
                    to={`/search?q=${encodeURIComponent(t)}`}
                    className="inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
