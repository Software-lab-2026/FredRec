import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { searchResources } from "../api/search";
import { getSavedIndex } from "../api/workspace";
import FilterChip from "../components/FilterChip";
import ResourceCard from "../components/ResourceCard";
import SaveToWorkspaceDialog from "../components/SaveToWorkspaceDialog";
import SearchBar from "../components/SearchBar";
import { useAuth } from "../context/useAuth";
import { workspaceKeys } from "../hooks/workspaceKeys";
import {
  FORMAT_LABELS,
  RESOURCE_FORMATS,
  type Resource,
  type ResourceFormat,
} from "../types/resource";

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  const [tab, setTab] = useState<ResourceFormat | "all">("all");
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
    queryFn: () => getSavedIndex(user!.id),
    enabled: !!user,
  });

  const requireLogin = () =>
    navigate(
      `/login?next=${encodeURIComponent(location.pathname + location.search)}`,
    );
  const onSave = (r: Resource) =>
    user ? setSavingResource(r) : requireLogin();

  const results = search.data?.results ?? [];
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
        <p className="mt-8 text-slate-500">
          Searching free resources for “{query}”…
        </p>
      )}

      {search.isError && (
        <div className="mt-8 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4">
          <p className="text-amber-800 dark:text-amber-200">
            {search.error.message}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Browse all topics on the{" "}
            <Link
              to="/topics"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
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
            <h1 className="text-2xl font-bold">{search.data.topic}</h1>
            <p className="text-sm text-slate-500">
              {results.length} free resources ·{" "}
              <Link
                to={
                  user
                    ? `/suggest?topic=${encodeURIComponent(search.data.topic)}`
                    : `/login?next=${encodeURIComponent(`/suggest?topic=${encodeURIComponent(search.data.topic)}`)}`
                }
                className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Suggest a resource
              </Link>
            </p>
          </div>
          {search.data.failedSources.length > 0 && (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              Some sources didn’t respond:{" "}
              {search.data.failedSources.join(", ")}. Results may be incomplete.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
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
              <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-200">
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
