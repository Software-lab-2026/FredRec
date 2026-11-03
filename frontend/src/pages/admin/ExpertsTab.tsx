import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { createExpert, listExperts, updateExpert } from "../../api/admin";
import DomainCheckboxes from "../../components/DomainCheckboxes";
import { cardClass, errorText, inputClass, labelClass, primaryButton, secondaryButton } from "../../components/styles";
import { curationKeys } from "../../hooks/curationKeys";
import { useDomains } from "../../hooks/useDomains";
import type { ExpertAccount } from "../../types/curation";
import Loader from "../../components/Loader";

export default function ExpertsTab() {
  const queryClient = useQueryClient();
  const { domains } = useDomains();
  const experts = useQuery({ queryKey: curationKeys.experts, queryFn: listExperts });
  const refresh = () => queryClient.invalidateQueries({ queryKey: curationKeys.all });

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [domainIds, setDomainIds] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () => createExpert({ username, email, password, domainIds }),
    onSuccess: () => {
      setUsername("");
      setEmail("");
      setPassword("");
      setDomainIds([]);
      return refresh();
    },
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div>
      <form onSubmit={onCreate} className={`space-y-4 ${cardClass}`}>
        <h2 className="font-semibold">Create an expert account</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={labelClass}>Username</span>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label>
            <span className={labelClass}>Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label>
            <span className={labelClass}>Temporary password</span>
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={`mt-1 ${inputClass}`}
            />
          </label>
        </div>
        <fieldset>
          <legend className={labelClass}>Domains they review</legend>
          <div className="mt-2">
            <DomainCheckboxes domains={domains} selected={domainIds} onChange={setDomainIds} />
          </div>
        </fieldset>
        {create.isError && <p className={errorText}>{create.error.message}</p>}
        {create.isSuccess && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Expert @{create.data.username} created. Share the temporary password with them privately; they’ll be asked
            to choose their own when they first log in.
          </p>
        )}
        <button type="submit" disabled={create.isPending} className={primaryButton}>
          Create expert
        </button>
      </form>

      {experts.isPending && <Loader className="mt-6" />}
      {experts.isSuccess && experts.data.length === 0 && (
        <p className="mt-6 text-ink-600 dark:text-ink-400">No experts yet.</p>
      )}
      <ul className="mt-6 space-y-3">
        {experts.data?.map((x) => (
          <ExpertRow key={x.id} expert={x} onChanged={refresh} />
        ))}
      </ul>
    </div>
  );
}

function ExpertRow({ expert: x, onChanged }: { expert: ExpertAccount; onChanged: () => Promise<void> }) {
  const { domains, domainName } = useDomains();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(x.domainIds);

  const update = useMutation({
    mutationFn: (changes: { domainIds?: string[]; isActive?: boolean }) => updateExpert(x.id, changes),
    onSuccess: () => {
      setEditing(false);
      return onChanged();
    },
  });

  return (
    <li className={cardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">@{x.username}</span>
        <span className="text-sm text-ink-500">{x.email}</span>
        {!x.isActive && (
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-400">
            Deactivated
          </span>
        )}
        {x.mustChangePassword && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Hasn’t logged in yet
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {!editing && (
            <button
              onClick={() => {
                setDraft(x.domainIds);
                update.reset();
                setEditing(true);
              }}
              className={secondaryButton}
            >
              Edit domains
            </button>
          )}
          <button
            onClick={() => update.mutate({ isActive: !x.isActive })}
            disabled={update.isPending}
            className={secondaryButton}
          >
            {x.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <DomainCheckboxes domains={domains} selected={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <button onClick={() => update.mutate({ domainIds: draft })} disabled={update.isPending} className={primaryButton}>
              Save domains
            </button>
            <button onClick={() => setEditing(false)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {x.domainIds.map((id) => (
            <li key={id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {domainName(id)}
            </li>
          ))}
        </ul>
      )}
      {update.isError && <p className={`mt-2 ${errorText}`}>{update.error.message}</p>}
    </li>
  );
}
