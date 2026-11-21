import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { listExperts } from "../../api/admin";
import { addTopic, createDomain, renameDomain } from "../../api/domains";
import { cardClass, errorText, inputClass, labelClass, primaryButton, secondaryButton } from "../../components/styles";
import { curationKeys, domainKeys } from "../../hooks/curationKeys";
import { useDomains } from "../../hooks/useDomains";
import type { Domain } from "../../types/curation";
import Loader from "../../components/Loader";

export default function DomainsTab() {
  const queryClient = useQueryClient();
  const { domains, isPending } = useDomains();
  const experts = useQuery({ queryKey: curationKeys.experts, queryFn: listExperts });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: domainKeys.all });
  const create = useMutation({
    mutationFn: () => createDomain(name, description),
    onSuccess: () => {
      setName("");
      setDescription("");
      return refresh();
    },
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) create.mutate();
  }

  const expertCount = (domainId: string) =>
    experts.data?.filter((x) => x.isActive && x.domainIds.includes(domainId)).length ?? 0;

  return (
    <div>
      <form onSubmit={onCreate} className={`grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end ${cardClass}`}>
        <label>
          <span className={labelClass}>New domain</span>
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Robotics"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label>
          <span className={labelClass}>Description (optional)</span>
          <input
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <button type="submit" disabled={create.isPending} className={primaryButton}>
          Add domain
        </button>
        {create.isError && <p className={`sm:col-span-3 ${errorText}`}>{create.error.message}</p>}
      </form>

      {isPending && <Loader className="mt-6" />}
      <ul className="mt-6 grid gap-4 lg:grid-cols-2">
        {domains.map((d) => (
          <DomainCard key={d.id} domain={d} expertCount={expertCount(d.id)} onChanged={refresh} />
        ))}
      </ul>
    </div>
  );
}

function DomainCard({ domain, expertCount, onChanged }: { domain: Domain; expertCount: number; onChanged: () => Promise<void> }) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(domain.name);
  const [topic, setTopic] = useState("");
  const [topicAbout, setTopicAbout] = useState("");

  const rename = useMutation({
    mutationFn: () => renameDomain(domain.id, draftName),
    onSuccess: () => {
      setRenaming(false);
      return onChanged();
    },
  });
  const add = useMutation({
    mutationFn: () => addTopic(domain.id, topic, topicAbout),
    onSuccess: () => {
      setTopic("");
      setTopicAbout("");
      return onChanged();
    },
  });

  return (
    <li className={cardClass}>
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draftName.trim()) rename.mutate();
          }}
          className="flex gap-2"
        >
          <input
            autoFocus
            onFocus={(e) => e.target.select()}
            aria-label="Domain name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className={inputClass}
          />
          <button type="submit" className={primaryButton}>
            Save
          </button>
          <button type="button" onClick={() => setRenaming(false)} className={secondaryButton}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-semibold">{domain.name}</h2>
          <button
            onClick={() => {
              setDraftName(domain.name);
              rename.reset();
              setRenaming(true);
            }}
            className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white"
          >
            Rename
          </button>
          <Link to={`/graph/${domain.id}`} className="text-sm text-brand-600 hover:underline dark:text-brand-400">
            Concept map
          </Link>
          <span
            className={`ml-auto text-xs ${expertCount ? "text-ink-500" : "font-medium text-amber-700 dark:text-amber-300"}`}
          >
            {expertCount ? `${expertCount} expert${expertCount > 1 ? "s" : ""}` : "No experts assigned"}
          </span>
        </div>
      )}
      {rename.isError && <p className={`mt-1 ${errorText}`}>{rename.error.message}</p>}
      {domain.description && <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">{domain.description}</p>}

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {domain.topics.map((t) => (
          <li key={t} className="rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-700 dark:bg-ink-800 dark:text-ink-300">
            {t}
          </li>
        ))}
        {domain.topics.length === 0 && <li className="text-sm text-ink-500">No topics yet.</li>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (topic.trim()) add.mutate();
        }}
        className="mt-3 space-y-2"
      >
        <div className="flex gap-2">
          <input
            aria-label={`New topic in ${domain.name}`}
            placeholder="Add a topic"
            maxLength={60}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={inputClass}
          />
          <button type="submit" disabled={!topic.trim() || add.isPending} className={secondaryButton}>
            Add
          </button>
        </div>
        {topic.trim() && (
          <textarea
            aria-label={`What ${topic.trim()} covers`}
            placeholder="What it covers, as a list: e.g. Processes and threads, CPU scheduling, deadlocks, paging. Searches for any of these will find this topic."
            maxLength={1000}
            rows={2}
            value={topicAbout}
            onChange={(e) => setTopicAbout(e.target.value)}
            className={inputClass}
          />
        )}
      </form>
      {add.isError && <p className={`mt-1 ${errorText}`}>{add.error.message}</p>}
    </li>
  );
}
