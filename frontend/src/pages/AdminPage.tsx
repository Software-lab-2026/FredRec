import { useState } from "react";
import { btnPrimary, btnSecondary } from "../components/styles";
import DomainsTab from "./admin/DomainsTab";

const TABS = [
  { id: "domains", label: "Domains" },
  { id: "experts", label: "Experts" },
  { id: "curated", label: "Curated" },
  { id: "approvals", label: "Approvals" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>("domains");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Admin</h1>

      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? btnPrimary : btnSecondary}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "domains" && <DomainsTab />}
      {tab !== "domains" && <p className="text-slate-500">Coming soon.</p>}
    </div>
  );
}