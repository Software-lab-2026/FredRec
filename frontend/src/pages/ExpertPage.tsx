import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { expertApprove, expertReject, getExpertQueue, getMyExpertDomains } from "../api/submissions";
import FilterChip from "../components/FilterChip";
import ReviewCard from "../components/ReviewCard";
import { primaryButton } from "../components/styles";
import { useAuth } from "../context/useAuth";
import { curationKeys, domainKeys } from "../hooks/curationKeys";
import Loader from "../components/Loader";

//Lazy Loading
const ExpertOverview = lazy(() => import("../components/ExpertOverview"));

export default function ExpertPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "overview" ? "overview" : "queue";

  const domains = useQuery({ queryKey: domainKeys.mine(userId), queryFn: getMyExpertDomains });
  const queue = useQuery({ queryKey: curationKeys.expertQueue(userId), queryFn: getExpertQueue });

  const refresh = () => queryClient.invalidateQueries({ queryKey: curationKeys.all });
  const items = (queue.data ?? []).filter((s) => filter === "all" || s.domainId === filter);
  const countFor = (domainId: string) => queue.data?.filter((s) => s.domainId === domainId).length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expert</h1>
          {domains.data && domains.data.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-600 dark:text-ink-400">
              Concept maps:
              {domains.data.map((d) => (
                <Link key={d.id} to={`/graph/${d.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                  {d.name}
                </Link>
              ))}
            </p>
          )}
        </div>
        <Link to="/suggest" className={primaryButton}>
          Request a resource
        </Link>
      </div>

      {domains.isSuccess && domains.data.length === 0 && (
        <p className="mt-8 text-ink-600 dark:text-ink-400">
          You aren’t assigned to any domains yet. Ask the admin to assign you.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={view === "queue"} onClick={() => setParams({})}>
          Review queue ({queue.data?.length ?? 0})
        </FilterChip>
        <FilterChip active={view === "overview"} onClick={() => setParams({ view: "overview" })}>
          Overview
        </FilterChip>
      </div>

      {view === "overview" && (
        <div className="mt-6">
          <Suspense fallback={<Loader />}>
            <ExpertOverview />
          </Suspense>
        </div>
      )}

      {view === "queue" && domains.data && domains.data.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 border-b border-ink-200 pb-3 dark:border-ink-800">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All my domains ({queue.data?.length ?? 0})
          </FilterChip>
          {domains.data.map((d) => (
            <FilterChip key={d.id} active={filter === d.id} onClick={() => setFilter(d.id)}>
              {d.name} ({countFor(d.id)})
            </FilterChip>
          ))}
        </div>
      )}

      {view === "queue" && queue.isPending && <Loader className="mt-8" />}
      {view === "queue" && queue.isSuccess && items.length === 0 && domains.data?.length !== 0 && (
        <p className="mt-8 text-ink-600 dark:text-ink-400">Nothing waiting for review. 🎉</p>
      )}

      <div className="mt-6 space-y-4">
        {view === "queue" && items.map((s) => (
          <ReviewCard
            key={s.id}
            submission={s}
            domain={domains.data?.find((d) => d.id === s.domainId)}
            mode="expert"
            onApprove={async (review) => {
              await expertApprove(s.id, review);
              await refresh();
            }}
            onReject={async (reason) => {
              await expertReject(s.id, reason);
              await refresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}

