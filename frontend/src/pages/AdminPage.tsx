import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { getAdminQueue } from "../api/submissions";
import FilterChip from "../components/FilterChip";
import { primaryButton } from "../components/styles";
import { curationKeys } from "../hooks/curationKeys";
import ApprovalsTab from "./admin/ApprovalsTab";
import CuratedTab from "./admin/CuratedTab";
import DomainsTab from "./admin/DomainsTab";
import ExpertsTab from "./admin/ExpertsTab";
import Loader from "../components/Loader";

// Charts are large, so the overview loads on first visit.
const OverviewTab = lazy(() => import("./admin/OverviewTab"));

const TABS = {
  overview: "Overview",
  approvals: "Approvals",
  domains: "Domains & topics",
  experts: "Experts",
  curated: "Published resources",
} as const;

type Tab = keyof typeof TABS;

export default function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = (params.get("tab") as Tab) in TABS ? (params.get("tab") as Tab) : "overview";
  const queue = useQuery({ queryKey: curationKeys.adminQueue, queryFn: getAdminQueue });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <Link to="/suggest" className={primaryButton}>
          Add a resource
        </Link>
      </div>
      <div className="mt-6 flex flex-wrap gap-2 border-b border-ink-200 pb-3 dark:border-ink-800">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <FilterChip key={t} active={tab === t} onClick={() => setParams({ tab: t })}>
            {TABS[t]}
            {t === "approvals" && queue.data ? ` (${queue.data.length})` : ""}
          </FilterChip>
        ))}
      </div>
      <div className="mt-6">
        {tab === "overview" && (
          <Suspense fallback={<Loader />}>
            <OverviewTab />
          </Suspense>
        )}
        {tab === "approvals" && <ApprovalsTab />}
        {tab === "domains" && <DomainsTab />}
        {tab === "experts" && <ExpertsTab />}
        {tab === "curated" && <CuratedTab />}
      </div>
    </div>
  );
}
