import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  changeMemberRole,
  createTeamWorkspace,
  deleteTeam,
  getTeam,
  inviteToTeam,
  removeMember,
  renameTeam,
  revokeInvite,
} from "../api/teams";
import { cardClass, errorText, inputClass, labelClass, primaryButton, secondaryButton, selectClass } from "../components/styles";
import { useAuth } from "../context/useAuth";
import { teamKeys } from "../hooks/teamKeys";
import { workspaceKeys } from "../hooks/workspaceKeys";
import { TEAM_ROLE_LABELS, type TeamRole } from "../types/teams";
import Loader from "../components/Loader";

const ROLES = Object.keys(TEAM_ROLE_LABELS) as TeamRole[];

export default function TeamDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const userId = user!.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const team = useQuery({ queryKey: teamKeys.detail(userId, id), queryFn: () => getTeam(id), retry: false });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: teamKeys.all(userId) }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all(userId) }),
    ]);

  // One mutation for every small team action, so errors show in one place.
  const act = useMutation({ mutationFn: (action: () => Promise<unknown>) => action(), onSuccess: refresh });

  const [invitee, setInvitee] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("viewer");
  const [workspaceName, setWorkspaceName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  if (team.isPending) return <Loader />;
  if (team.isError) {
    return (
      <div className="pt-8 text-center">
        <p className="text-ink-600 dark:text-ink-400">{team.error.message}</p>
        <Link to="/teams" className="mt-2 inline-block text-brand-600 hover:underline dark:text-brand-400">
          Back to teams
        </Link>
      </div>
    );
  }

  const t = team.data;
  const isOwner = t.myRole === "owner";

  function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!invitee.trim()) return;
    act.mutate(() => inviteToTeam(id, invitee.trim(), inviteRole), { onSuccess: () => setInvitee("") });
  }

  function onCreateWorkspace(e: FormEvent) {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    act.mutate(() => createTeamWorkspace(id, workspaceName), { onSuccess: () => setWorkspaceName("") });
  }

  function onRename(e: FormEvent) {
    e.preventDefault();
    if (draftName.trim()) act.mutate(() => renameTeam(id, draftName.trim()), { onSuccess: () => setRenaming(false) });
  }

  function leave() {
    if (!confirm(`Leave “${t.name}”? You’ll lose access to its workspaces.`)) return;
    act.mutate(() => removeMember(id, userId), { onSuccess: () => navigate("/teams") });
  }

  function remove() {
    if (!confirm(`Delete “${t.name}” and its shared workspaces? This can’t be undone.`)) return;
    act.mutate(() => deleteTeam(id), { onSuccess: () => navigate("/teams") });
  }

  return (
    <div>
      <Link to="/teams" className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white">
        ← All teams
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {renaming ? (
          <form onSubmit={onRename} className="flex gap-2">
            <input
              autoFocus
              onFocus={(e) => e.target.select()}
              aria-label="Team name"
              maxLength={60}
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
          <>
            <h1 className="text-2xl font-bold">{t.name}</h1>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-400">
              You’re {TEAM_ROLE_LABELS[t.myRole].toLowerCase()}
            </span>
            {isOwner && (
              <button
                onClick={() => {
                  setDraftName(t.name);
                  setRenaming(true);
                }}
                className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white"
              >
                Rename
              </button>
            )}
            <span className="ml-auto flex gap-3">
              <button onClick={leave} className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white">
                Leave team
              </button>
              {isOwner && (
                <button onClick={remove} className="text-sm text-rose-600 hover:underline dark:text-rose-400">
                  Delete team
                </button>
              )}
            </span>
          </>
        )}
      </div>
      {act.isError && <p className={`mt-3 ${errorText}`}>{act.error.message}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-semibold">Shared workspaces</h2>
          <p className="mt-1 text-sm text-ink-500">
            Owners create workspaces, editors add and remove resources, viewers read. Progress stays personal.
          </p>
          {isOwner && (
            <form onSubmit={onCreateWorkspace} className="mt-3 flex gap-2">
              <input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="New shared workspace"
                aria-label="New shared workspace name"
                maxLength={60}
                className={inputClass}
              />
              <button type="submit" disabled={!workspaceName.trim() || act.isPending} className={primaryButton}>
                Create
              </button>
            </form>
          )}
          {t.workspaces.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">No shared workspaces yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {t.workspaces.map((w) => (
                <li key={w.id}>
                  <Link
                    to={`/workspaces/${w.id}`}
                    className={`block hover:border-brand-300 dark:hover:border-brand-700 ${cardClass}`}
                  >
                    <span className="font-medium">{w.name}</span>
                    <span className="ml-2 text-sm text-ink-500">
                      {w.itemCount} resource{w.itemCount === 1 ? "" : "s"} · {w.completedCount} completed by you
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-semibold">Members</h2>
          <ul className="mt-3 space-y-2">
            {t.members.map((m) => (
              <li key={m.userId} className={`flex flex-wrap items-center gap-3 ${cardClass}`}>
                <span className="flex-1 font-medium">
                  @{m.username}
                  {m.userId === userId && <span className="ml-1 text-sm font-normal text-ink-500">(you)</span>}
                </span>
                {isOwner ? (
                  <select
                    aria-label={`Role of ${m.username}`}
                    value={m.role}
                    onChange={(e) => act.mutate(() => changeMemberRole(id, m.userId, e.target.value as TeamRole))}
                    className={selectClass}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {TEAM_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-ink-500">{TEAM_ROLE_LABELS[m.role]}</span>
                )}
                {isOwner && m.userId !== userId && (
                  <button
                    onClick={() => {
                      if (confirm(`Remove @${m.username} from the team?`)) act.mutate(() => removeMember(id, m.userId));
                    }}
                    className="text-sm text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          {isOwner && (
            <>
              <form onSubmit={onInvite} className={`mt-4 space-y-3 ${cardClass}`}>
                <label className="block">
                  <span className={labelClass}>Invite by username or email</span>
                  <input
                    value={invitee}
                    onChange={(e) => setInvitee(e.target.value)}
                    placeholder="e.g. priya or priya@example.com"
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <label>
                    <span className={labelClass}>Role</span>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                      className={`mt-1 ${selectClass}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {TEAM_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" disabled={!invitee.trim() || act.isPending} className={primaryButton}>
                    Send invite
                  </button>
                </div>
                <p className="text-xs text-ink-500">
                  Someone without an account can be invited by email; the invite waits until they sign up.
                </p>
              </form>
              {t.invites.length > 0 && (
                <>
                  <h3 className="mt-4 text-sm font-semibold">Pending invites</h3>
                  <ul className="mt-2 space-y-1">
                    {t.invites.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 text-sm">
                        <span className="flex-1">
                          {i.invitee.includes("@") ? i.invitee : `@${i.invitee}`} · {TEAM_ROLE_LABELS[i.role]}
                        </span>
                        <button
                          onClick={() => act.mutate(() => revokeInvite(id, i.id))}
                          className="text-ink-500 hover:text-ink-900 dark:hover:text-white"
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
