import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { ApiError } from "../api/client";
import { searchResources } from "../api/search";
import { getSavedIndex } from "../api/workspace";
import FilterChip from "../components/FilterChip";
import ResourceCard from "../components/ResourceCard";
import SaveToWorkspaceDialog from "../components/SaveToWorkspaceDialog";
import SearchBar from "../components/SearchBar";
import { selectClass } from "../components/styles";
import { useAuth } from "../context/useAuth";
import { workspaceKeys } from "../hooks/workspaceKeys";
import {
  FORMAT_LABELS,
  RESOURCE_FORMATS,
  type Resource,
  type ResourceFormat,
} from "../types/resource";
import Loader from "../components/Loader";

const THIS_YEAR = new Date().getFullYear();

function SuggestionLinks({ names }: { names: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      {names.map((n) => (
        <Link
          key={n}
          to={`/search?q=${encodeURIComponent(n)}`}
          className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900"
        >
          {n}
        </Link>
      ))}
    </span>
  );
}

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  const [tab, setTab] = useState<ResourceFormat | "all">("all");
  const [source, setSource] = useState("");
  const [sinceYear, setSinceYear] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [savingResource, setSavingResource] = useState<Resource | null>(null);

  const search = useQuery({
    queryKey: ["search", query.toLowerCase()],
    queryFn: () => searchResources(query),
    enabled: !!query,
    retry: false,
  });

  const savedIndex = useQuery({
    queryKey: workspaceKeys.savedIndex(user?.id ?? ""),
    queryFn: getSavedIndex,
    enabled: !!user,
  });

  const requireLogin = () =>
    navigate(
      `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
    );
  const onSave = (r: Resource) =>
    user ? setSavingResource(r) : requireLogin();

  const allResults = search.data?.results ?? [];
  const sources = [...new Set(allResults.map((r) => r.source))].sort();
  const results = allResults.filter(
    (r) =>
      (!source || r.source === source) &&
      (!sinceYear || (r.publishedYear ?? 0) >= sinceYear),
  );
  const counts = Object.fromEntries(
    RESOURCE_FORMATS.map((f) => [
      f,
      results.filter((r) => r.format === f).length,
    ]),
  );
  const visibleFormats =
    tab === "all" ? RESOURCE_FORMATS.filter((f) => counts[f] > 0) : [tab];

  return (
    <div>
      <SearchBar key={query} initialQuery={query} />

      {search.isPending && query && (
        <Loader className="mt-8" />
      )}

      {search.isError && (
        <div className="mt-8 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4">
          <p className="text-amber-800 dark:text-amber-200">
            {search.error.message}
          </p>
          {search.error instanceof ApiError && search.error.suggestions.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
              Did you mean <SuggestionLinks names={search.error.suggestions} />
            </p>
          )}
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
            Browse all topics on the{" "}
            <Link
              to="/topics"
              className="text-brand-600 dark:text-brand-400 hover:underline"
            >
              Topics page
            </Link>
            .
          </p>
        </div>
      )}

      {search.data && (
        <>
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold">{search.data.match.name}</h1>
              {/* Domain › topic  so a concept match shows its location. */}
              <nav aria-label="Where this sits" className="mt-1 text-sm text-ink-500">
                {search.data.match.path.join(" › ")}
                {search.data.match.method !== "exact" &&
                  search.data.match.name.toLowerCase() !== query.trim().toLowerCase() && (
                    <> · showing results for this, from your search “{query}”</>
                  )}
              </nav>
            </div>
            <p className="text-sm text-ink-500">
              {results.length} free resources ·{" "}
              <Link
                to={
                  user
                    ? `/suggest?topic=${encodeURIComponent(search.data.topic)}`
                    : `/login?next=${encodeURIComponent(`/suggest?topic=${encodeURIComponent(search.data.topic)}`)}`
                }
                className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Suggest a resource
              </Link>
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-600 dark:text-ink-400">
            <label className="flex items-center gap-2">
              Source
              <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
                <option value="">All sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              Published
              <select
                value={sinceYear}
                onChange={(e) => setSinceYear(Number(e.target.value))}
                className={selectClass}
              >
                <option value={0}>Any time</option>
                {[2, 5, 10].map((n) => (
                  <option key={n} value={THIS_YEAR - n}>
                    In the last {n} years
                  </option>
                ))}
              </select>
            </label>
          </div>
          {search.data.suggestions.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-600 dark:text-ink-400">
              Did you mean <SuggestionLinks names={search.data.suggestions} />
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-b border-ink-200 dark:border-ink-800 pb-3">
            <FilterChip active={tab === "all"} onClick={() => setTab("all")}>
              All ({results.length})
            </FilterChip>
            {RESOURCE_FORMATS.filter((f) => counts[f] > 0).map((f) => (
              <FilterChip key={f} active={tab === f} onClick={() => setTab(f)}>
                {FORMAT_LABELS[f]} ({counts[f]})
              </FilterChip>
            ))}
          </div>

          {visibleFormats.map((format) => (
            <section key={format} className="mt-8">
              <h2 className="mb-3 text-lg font-semibold text-ink-800 dark:text-ink-200">
                {FORMAT_LABELS[format]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results
                  .filter((r) => r.format === format)
                  .map((r) => (
                    <ResourceCard
                      key={r.urlHash}
                      resource={r}
                      savedCount={savedIndex.data?.[r.urlHash]?.length ?? 0}
                      onSave={onSave}
                      onRequireLogin={requireLogin}
                      loggedIn={!!user}
                    />
                  ))}
              </div>
            </section>
          ))}

          {search.data.related.length > 0 && (
            <section className="mt-10 border-t border-ink-200 pt-6 dark:border-ink-800">
              <h2 className="text-lg font-semibold text-ink-800 dark:text-ink-200">
                Matching resources from FredRec
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Already saved, rated or curated by learners here, and close in meaning to your search.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {search.data.related.map((r) => (
                  <ResourceCard
                    key={r.urlHash}
                    resource={r}
                    savedCount={savedIndex.data?.[r.urlHash]?.length ?? 0}
                    onSave={onSave}
                    onRequireLogin={requireLogin}
                    loggedIn={!!user}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {savingResource && (
        <SaveToWorkspaceDialog
          resource={savingResource}
          suggestedName={search.data?.topic ?? query}
          onClose={() => setSavingResource(null)}
        />
      )}
    </div>
  );
}
