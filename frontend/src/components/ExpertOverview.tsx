import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getExpertStats } from "../api/stats";
import { useAuth } from "../context/useAuth";
import { statsKeys } from "../hooks/curationKeys";
import { DIFFICULTIES } from "../types/resource";
import type { ExpertStats } from "../types/stats";
import { ChartCard, DaysPicker, RankedBars, SimpleTable, StatTile } from "./charts/ChartParts";
import { cardClass, errorText } from "./styles";
import Loader from "./Loader";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

//The experts dashboard only displaying their own domain
export default function ExpertOverview() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const stats = useQuery({
    queryKey: statsKeys.expert(user!.id, days),
    queryFn: () => getExpertStats(days),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600 dark:text-ink-400">
          What learners search for in your domains (anonymous), and how well it’s covered.
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

function Overview({ stats }: { stats: ExpertStats }) {
  const { totals } = stats;
  const difficulty = DIFFICULTIES.map((d) => ({
    name: DIFFICULTY_LABELS[d],
    count: stats.difficulty.find((x) => x.name === d)?.count ?? 0,
  }));
  const topics = [...stats.topics].sort((a, b) => a.published - b.published || a.topic.localeCompare(b.topic));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Waiting for your review" value={totals.waiting} />
        <StatTile label={`Your reviews, last ${stats.days} days`} value={totals.myReviews} />
        <StatTile label="Concepts in your maps" value={totals.concepts} />
        <StatTile label={`Searches, last ${stats.days} days`} value={totals.searches} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Most searched in your domains"
          table={<SimpleTable head={["Search", "Times"]} rows={stats.topSearches.map((t) => [t.name, t.count])} />}
        >
          <RankedBars data={stats.topSearches} unit="Searches" />
        </ChartCard>
        <ChartCard
          title="Difficulty of published resources"
          subtitle="As set by experts when approving."
          table={<SimpleTable head={["Difficulty", "Resources"]} rows={difficulty.map((d) => [d.name, d.count])} />}
        >
          <RankedBars data={difficulty} unit="Resources" />
        </ChartCard>
      </div>

      <section className={cardClass}>
        <h2 className="font-semibold">Coverage by topic</h2>
        <p className="mt-0.5 text-sm text-ink-500">Topics with the fewest published resources first.</p>
        <div className="mt-3">
          <SimpleTable
            head={["Topic", "Concepts", "Published resources"]}
            rows={topics.map((t) => [t.topic, t.concepts, t.published])}
          />
        </div>
      </section>
    </>
  );
}
