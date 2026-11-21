import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getAdminStats } from "../../api/stats";
import { ChartCard, DaysPicker, RankedBars, SearchesPerDay, SimpleTable, StatTile } from "../../components/charts/ChartParts";
import { cardClass, errorText } from "../../components/styles";
import { statsKeys } from "../../hooks/curationKeys";
import type { AdminStats } from "../../types/stats";
import Loader from "../../components/Loader";

function hours(h: number | null): string {
  if (h === null) return "–";
  if (h < 1) return "under 1 h";
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

export default function OverviewTab() {
  const [days, setDays] = useState(30);
  const stats = useQuery({
    queryKey: statsKeys.admin(days),
    queryFn: () => getAdminStats(days),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600 dark:text-ink-400">
          Search figures come from an anonymous log: queries only, nothing about who searched.
        </p>
        <DaysPicker days={days} onChange={setDays} />
      </div>
      {stats.isPending && <Loader className="mt-6" />}
      {stats.isError && <p className={`mt-6 ${errorText}`}>{stats.error.message}</p>}
      {stats.data && (
        <div className={`mt-4 space-y-4 transition-opacity ${stats.isPlaceholderData ? "opacity-60" : ""}`}>
          <Overview stats={stats.data} />
        </div>
      )}
    </div>
  );
}

function Overview({ stats }: { stats: AdminStats }) {
  const { totals, pipeline } = stats;
  const unmatchedShare = totals.searches ? Math.round((100 * totals.unmatchedSearches) / totals.searches) : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Learners" value={totals.learners} />
        <StatTile label="Active experts" value={totals.experts} />
        <StatTile label="Published resources" value={totals.publishedResources} />
        <StatTile
          label="Waiting for you"
          value={totals.waitingForAdmin}
          note={
            totals.waitingForAdmin > 0 ? (
              <Link to="/admin?tab=approvals" className="text-brand-600 hover:underline dark:text-brand-400">
                Open approvals →
              </Link>
            ) : undefined
          }
        />
        <StatTile
          label={`Searches, last ${stats.days} days`}
          value={totals.searches}
          note={totals.searches ? `${totals.unmatchedSearches} (${unmatchedShare}%) found no topic` : undefined}
        />
      </div>

      <ChartCard
        title="Searches per day"
        subtitle="“No match” searches are topics learners want that FredRec doesn’t cover yet."
        table={
          <SimpleTable
            head={["Day", "Found a topic", "No match"]}
            rows={stats.searchesPerDay.map((d) => [d.day, d.matched, d.unmatched])}
          />
        }
      >
        <SearchesPerDay data={stats.searchesPerDay} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Most searched topics"
          table={<SimpleTable head={["Topic", "Searches"]} rows={stats.topTopics.map((t) => [t.name, t.count])} />}
        >
          <RankedBars data={stats.topTopics} unit="Searches" />
        </ChartCard>

        <section className={cardClass}>
          <h2 className="font-semibold">Review pipeline</h2>
          <p className="mt-0.5 text-sm text-ink-500">Suggested resources, from learner to published.</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <PipelineRow label="Waiting for an expert" value={pipeline.waitingForExpert} />
            <PipelineRow label="Waiting for you" value={pipeline.waitingForAdmin} />
            <PipelineRow label="Published (all time)" value={pipeline.published} />
            <PipelineRow label="Rejected (all time)" value={pipeline.rejected} />
            <PipelineRow
              label={`Typical time to publish (last ${stats.days} days)`}
              value={hours(pipeline.medianHoursToPublish)}
            />
          </dl>
        </section>
      </div>
    </>
  );
}

function PipelineRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-xl font-semibold text-ink-900 dark:text-ink-100">{value}</dd>
    </div>
  );
}
