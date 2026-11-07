import { useState } from "react";
import type { Domain, ReviewInput, Submission } from "../types/curation";
import { FORMAT_LABELS, RESOURCE_FORMATS, type Difficulty, type ResourceFormat } from "../types/resource";
import DifficultyPicker from "./DifficultyPicker";
import StatusBadge from "./StatusBadge";
import SubmissionTimeline from "./SubmissionTimeline";
import {
  cardClass,
  dangerButton,
  errorText,
  inputClass,
  labelClass,
  primaryButton,
} from "./styles";

interface Props {
  submission: Submission;
  domain: Domain | undefined;
// on expert approval , queued to admin, on admin approval published.
  mode: "expert" | "admin";
  onApprove: (review: ReviewInput) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}

export default function ReviewCard({ submission: s, domain, mode, onApprove, onReject }: Props) {
  const [title, setTitle] = useState(s.title);
  const [format, setFormat] = useState<ResourceFormat>(s.format);
  const [topic, setTopic] = useState(s.topic);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(
    mode === "admin" ? s.difficulty : undefined,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const expertApproval = mode === "admin" ? s.events.findLast((e) => e.action === "expert_approved") : undefined;

  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function approve() {
    if (!difficulty) {
      setError("Choose a difficulty level before approving.");
      return;
    }
    run(() => onApprove({ title, format, topic, difficulty, note }));
  }

  function reject() {
    if (!note.trim()) {
      setError("Add a reason in the note so the submitter knows why it was rejected.");
      return;
    }
    run(() => onReject(note));
  }

  return (
    <article className={cardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={s.status} />
        {s.noActiveExperts && (
          <span className="text-xs text-amber-700 dark:text-amber-300">
            No active experts in this domain; you can review it directly.
          </span>
        )}
      </div>
      <a
        href={s.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block font-semibold hover:text-brand-600 dark:hover:text-brand-400"
      >
        {s.title}
      </a>
      <p className="text-xs break-all text-ink-500">{s.url}</p>
      <p className="mt-1 text-xs text-ink-500">
        {domain?.name ?? s.domainId} › {s.topic} · {FORMAT_LABELS[s.format]} · by @{s.submittedBy.username} ·{" "}
        {new Date(s.createdAt).toLocaleDateString()}
      </p>
      {s.description && <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">{s.description}</p>}
      {expertApproval && (
        <p className="mt-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          Approved by expert @{expertApproval.actor} as <span className="capitalize">{s.difficulty}</span>
          {expertApproval.note && <>: “{expertApproval.note}”</>}
        </p>
      )}
      {mode === "admin" && s.status === "pending_admin" && !expertApproval && (
        <p className="mt-2 text-sm text-ink-500">Requested directly by a domain expert.</p>
      )}
      {s.suggestedDifficulty && (
        <p className="mt-1 text-sm text-ink-500">
          Submitter thinks it’s <span className="capitalize">{s.suggestedDifficulty}</span>.
        </p>
      )}

      <div className="mt-4 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3 dark:border-ink-800">
        <label className="sm:col-span-3">
          <span className={labelClass}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={`mt-1 ${inputClass}`} />
        </label>
        <label>
          <span className={labelClass}>Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ResourceFormat)}
            className={`mt-1 ${inputClass}`}
          >
            {RESOURCE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Topic</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className={`mt-1 ${inputClass}`}>
            {(domain?.topics ?? [s.topic]).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-3">
          <DifficultyPicker
            label={mode === "admin" ? "Difficulty" : "Difficulty (required)"}
            value={difficulty}
            onChange={setDifficulty}
          />
        </div>
        <label className="sm:col-span-3">
          <span className={labelClass}>Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Optional when approving; required when rejecting"
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

      {error && <p className={`mt-2 ${errorText}`}>{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={approve} disabled={busy} className={primaryButton}>
          {mode === "admin" ? "Approve & publish" : "Approve → send to admin"}
        </button>
        <button onClick={reject} disabled={busy} className={dangerButton}>
          Reject
        </button>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="ml-auto text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white"
        >
          {showHistory ? "Hide history" : "Show history"}
        </button>
      </div>
      {showHistory && (
        <div className="mt-3">
          <SubmissionTimeline events={s.events} />
        </div>
      )}
    </article>
  );
}
