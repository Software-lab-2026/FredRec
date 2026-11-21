import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { listMySubmissions } from "../api/submissions";
import StatusBadge from "../components/StatusBadge";
import SubmissionTimeline from "../components/SubmissionTimeline";
import { cardClass, primaryButton } from "../components/styles";
import { useAuth } from "../context/useAuth";
import { curationKeys } from "../hooks/curationKeys";
import { useDomains } from "../hooks/useDomains";
import type { Submission } from "../types/curation";
import { FORMAT_LABELS } from "../types/resource";
import Loader from "../components/Loader";

export default function SuggestionsPage() {
  const { user } = useAuth();
  const { domainName } = useDomains();
  const mine = useQuery({ queryKey: curationKeys.mine(user!.id), queryFn: listMySubmissions });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Suggestions</h1>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
            Resources you’ve shared, and where each one is in review.
          </p>
        </div>
        <Link to="/suggest" className={primaryButton}>
          Suggest a resource
        </Link>
      </div>

      {mine.isPending && <Loader className="mt-8" />}

      {mine.isSuccess && mine.data.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-ink-600 dark:text-ink-400">You haven’t suggested anything yet.</p>
          <p className="mt-1 text-sm text-ink-500">
            Share a free study resource to display on Fredrec.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {mine.data?.map((s) => (
          <SuggestionRow key={s.id} submission={s} domainName={domainName(s.domainId)} />
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({ submission: s, domainName }: { submission: Submission; domainName: string }) {
  const [open, setOpen] = useState(false);
  const rejection = [...s.events].reverse().find((e) => e.action.endsWith("_rejected"));

  return (
    <li className={cardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={s.status} />
        <span className="text-xs text-ink-500">{new Date(s.createdAt).toLocaleDateString()}</span>
      </div>
      <a
        href={s.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block font-semibold hover:text-brand-600 dark:hover:text-brand-400"
      >
        {s.title}
      </a>
      <p className="mt-0.5 text-xs text-ink-500">
        {domainName} › {s.topic} · {FORMAT_LABELS[s.format]}
        {s.difficulty && <span className="capitalize"> · {s.difficulty}</span>}
      </p>
      {s.status === "rejected" && rejection?.note && (
        <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          Reason: {rejection.note}
        </p>
      )}
      <div className="mt-2 flex gap-4 text-sm">
        {s.status === "published" && (
          <Link
            to={`/search?q=${encodeURIComponent(s.topic)}`}
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            See it in search
          </Link>
        )}
        <button onClick={() => setOpen((v) => !v)} className="text-ink-500 hover:text-ink-900 dark:hover:text-white">
          {open ? "Hide history" : "Show history"}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <SubmissionTimeline events={s.events} />
        </div>
      )}
    </li>
  );
}
