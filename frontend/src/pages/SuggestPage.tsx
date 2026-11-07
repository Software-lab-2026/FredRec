import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createSubmission } from "../api/submissions";
import DifficultyPicker from "../components/DifficultyPicker";
import StatusBadge from "../components/StatusBadge";
import { cardClass, errorText, inputClass, labelClass, primaryButton, secondaryButton } from "../components/styles";
import { useAuth } from "../context/useAuth";
import { curationKeys } from "../hooks/curationKeys";
import { useDomains } from "../hooks/useDomains";
import { FORMAT_LABELS, RESOURCE_FORMATS, type Difficulty, type ResourceFormat } from "../types/resource";
import { Spinner } from "../components/Loader";

export default function SuggestPage() {
  const { user } = useAuth();
  const { domains } = useDomains();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();

  const paramTopic = params.get("topic") ?? "";
  const paramDomain = domains.find((d) => d.topics.includes(paramTopic));
  const [domainChoice, setDomainChoice] = useState<string | null>(null);
  const [topicChoice, setTopicChoice] = useState<string | null>(null);
  const domainId = domainChoice ?? paramDomain?.id ?? "";
  const domain = domains.find((d) => d.id === domainId);
  const topic = topicChoice ?? (domainChoice === null && paramDomain ? paramTopic : "");

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<ResourceFormat>("article");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();
  const [isFree, setIsFree] = useState(false);

  const isAdmin = user?.role === "admin";
  const isDomainExpert = user?.role === "expert" && user.domainIds.includes(domainId);
  const setsDifficulty = isAdmin || isDomainExpert;

  const submit = useMutation({
    mutationFn: createSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: curationKeys.all });
      return queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate({ url, title, description, format, domainId, topic, difficulty });
  }

  function reset() {
    setUrl("");
    setTitle("");
    setDescription("");
    setDifficulty(undefined);
    setIsFree(false);
    submit.reset();
  }

  if (submit.isSuccess) {
    const s = submit.data;
    return (
      <div className={`mx-auto max-w-xl ${cardClass}`}>
        <StatusBadge status={s.status} />
        <h1 className="mt-2 text-xl font-bold">
          {s.status === "published" ? "Resource published" : "Thanks! Your submission is in"}
        </h1>
        <p className="mt-1 text-ink-600 dark:text-ink-400">
          {s.status === "published"
            ? `“${s.title}” now appears in search results for ${s.topic}.`
            : s.status === "pending_admin"
              ? `“${s.title}” has gone to the admin for final approval.`
              : `An expert in ${domain?.name ?? "this domain"} will review “${s.title}”, then the admin gives final approval.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={reset} className={secondaryButton}>
            Submit another
          </button>
          {s.status === "published" ? (
            <Link to={`/search?q=${encodeURIComponent(s.topic)}`} className={primaryButton}>
              See it in search
            </Link>
          ) : (
            <Link to="/suggestions" className={primaryButton}>
              Track my suggestions
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">{isAdmin ? "Add a resource" : "Suggest a resource"}</h1>
      <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
        Suggest Free Resource
      </p>

      <form onSubmit={onSubmit} className={`mt-6 space-y-4 ${cardClass}`}>
        <label className="block">
          <span className={labelClass}>Link</span>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Title</span>
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={`mt-1 ${inputClass}`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
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
          <label className="block">
            <span className={labelClass}>Domain</span>
            <select
              required
              value={domainId}
              onChange={(e) => {
                setDomainChoice(e.target.value);
                setTopicChoice("");
              }}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Choose…</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Topic</span>
            <select
              required
              value={topic}
              disabled={!domain}
              onChange={(e) => setTopicChoice(e.target.value)}
              className={`mt-1 ${inputClass} disabled:opacity-50`}
            >
              <option value="">Choose…</option>
              {domain?.topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Why is it useful?</span>
          <textarea
            maxLength={500}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A sentence or two about what it covers"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <DifficultyPicker
          label={setsDifficulty ? "Difficulty (required)" : "How difficult is it? (optional)"}
          optional={!setsDifficulty}
          value={difficulty}
          onChange={setDifficulty}
        />
        <label className="flex items-start gap-2 text-sm text-ink-700 dark:text-ink-300">
          <input
            type="checkbox"
            required
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          This resource is free to access.
        </label>

        <p className="text-sm text-ink-500">
          {isAdmin
            ? "As admin, this will be published right away."
            : isDomainExpert
              ? "You’re an expert in this domain, so it goes straight to the admin for final approval."
              : "A domain expert reviews it first, then the admin gives final approval."}
        </p>
        {submit.isError && <p className={errorText}>{submit.error.message}</p>}
        <button type="submit" disabled={submit.isPending} className={primaryButton}>
          {submit.isPending ? (
            <Spinner />
          ) : isAdmin ? (
            "Publish"
          ) : (
            "Submit"
          )}
        </button>
      </form>
    </div>
  );
}
