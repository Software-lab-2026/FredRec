import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { acceptInvite, createTeam, declineInvite, listMyInvites, listTeams } from "../api/teams";
import { cardClass, errorText, inputClass, primaryButton, secondaryButton } from "../components/styles";
import { useAuth } from "../context/useAuth";
import { teamKeys } from "../hooks/teamKeys";
import { workspaceKeys } from "../hooks/workspaceKeys";
import { TEAM_ROLE_LABELS } from "../types/teams";
import Loader from "../components/Loader";

export default function TeamsPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: teamKeys.list(userId), queryFn: listTeams });
  const invites = useQuery({ queryKey: teamKeys.invites(userId), queryFn: listMyInvites });
  const [name, setName] = useState("");

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: teamKeys.all(userId) }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all(userId) }),
    ]);

  const create = useMutation({
    mutationFn: () => createTeam(name),
    onSuccess: async (team) => {
      await refresh();
      navigate(`/teams/${team.id}`);
    },
  });
  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (accept) await acceptInvite(id);
      else await declineInvite(id);
    },
    onSuccess: refresh,
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) create.mutate();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
            Study together: share workspaces with your group, each person tracking their own progress.
          </p>
        </div>
        <form onSubmit={onCreate} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New team name"
            aria-label="New team name"
            maxLength={60}
            className={`w-56 ${inputClass}`}
          />
          <button type="submit" disabled={!name.trim() || create.isPending} className={`shrink-0 whitespace-nowrap ${primaryButton}`}>
            Create team
          </button>
        </form>
      </div>
      {create.isError && <p className={`mt-2 text-right ${errorText}`}>{create.error.message}</p>}

      {invites.data && invites.data.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold">Invitations</h2>
          <ul className="mt-2 space-y-2">
            {invites.data.map((i) => (
              <li key={i.id} className={`flex flex-wrap items-center gap-3 ${cardClass}`}>
                <p className="flex-1 text-sm">
                  <span className="font-medium">@{i.invitedBy}</span> invited you to{" "}
                  <span className="font-medium">{i.teamName}</span> as {TEAM_ROLE_LABELS[i.role].toLowerCase()}.
                </p>
                <button
                  onClick={() => respond.mutate({ id: i.id, accept: true })}
                  disabled={respond.isPending}
                  className={primaryButton}
                >
                  Accept
                </button>
                <button
                  onClick={() => respond.mutate({ id: i.id, accept: false })}
                  disabled={respond.isPending}
                  className={secondaryButton}
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
          {respond.isError && <p className={`mt-2 ${errorText}`}>{respond.error.message}</p>}
        </section>
      )}

      {teams.isPending && <Loader className="mt-8" />}
      {teams.isError && <p className={`mt-8 ${errorText}`}>{teams.error.message}</p>}
      {teams.isSuccess && teams.data.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center dark:border-ink-700 dark:bg-ink-900">
          <p className="text-ink-600 dark:text-ink-400">You’re not in any teams yet.</p>
          <p className="mt-1 text-sm text-ink-500">Create one above, or ask a team owner to invite you.</p>
        </div>
      )}
      {teams.data && teams.data.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.data.map((t) => (
            <li key={t.id}>
              <Link
                to={`/teams/${t.id}`}
                className={`block hover:border-brand-300 dark:hover:border-brand-700 ${cardClass}`}
              >
                <h2 className="font-semibold">{t.name}</h2>
                <p className="mt-1 text-sm text-ink-500">
                  {t.memberCount} member{t.memberCount === 1 ? "" : "s"} · you’re {TEAM_ROLE_LABELS[t.myRole].toLowerCase()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
