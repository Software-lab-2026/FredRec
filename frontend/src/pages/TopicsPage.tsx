import { Link } from "react-router-dom";
import { useDomains } from "../hooks/useDomains";
import Loader from "../components/Loader";

export default function TopicsPage() {
  const { domains, error, isPending } = useDomains();

  return (
    <div>
      <h1 className="text-2xl font-bold">Browse Computer Science topics</h1>
      {isPending && <Loader className="mt-6" />}
      {error && <p className="mt-4 text-rose-600 dark:text-rose-400">{error.message}</p>}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {domains.map((d) => (
          <section
            key={d.id}
            className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4"
          >
            <h2 className="font-semibold text-ink-800 dark:text-ink-200">
              {d.name}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {d.topics.map((t) => (
                <li key={t}>
                  <Link
                    to={`/search?q=${encodeURIComponent(t)}`}
                    className="inline-block rounded-full bg-ink-100 dark:bg-ink-800 px-2.5 py-1 text-xs text-ink-700 dark:text-ink-300 hover:bg-brand-100 dark:hover:bg-brand-900 hover:text-brand-700 dark:hover:text-brand-300"
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
