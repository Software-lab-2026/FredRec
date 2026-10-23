import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createWorkspace, listWorkspaces } from "../api/workspace";
import { useAuth } from "../context/useAuth";
import { workspaceKeys } from "../hooks/workspaceKeys";

export default function WorkspacesPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const queryClient = useQueryClient();
  const workspaces = useQuery({
    queryKey: workspaceKeys.list(userId),
    queryFn: () => listWorkspaces(userId),
  });
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: (n: string) => createWorkspace(userId, n),
    onSuccess: () => {
      setName("");
      return queryClient.invalidateQueries({
        queryKey: workspaceKeys.all(userId),
      });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) create.mutate(name);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Workspaces</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Keep a workspace for each topic you’re learning.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New workspace name"
            aria-label="New workspace name"
            maxLength={60}
            className="w-56 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-900"
          />
          <button
            type="submit"
            disabled={!name.trim() || create.isPending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </div>
      {create.isError && (
        <p className="mt-2 text-right text-sm text-rose-600 dark:text-rose-400">
          {create.error.message}
        </p>
      )}

      {workspaces.isPending && <p className="mt-8 text-slate-500">Loading…</p>}

      {workspaces.isSuccess && workspaces.data.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            You don’t have any workspaces yet.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Create one above, or{" "}
            <Link
              to="/"
              className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              search for resources
            </Link>{" "}
            and save them into a new workspace.
          </p>
        </div>
      )}

      {workspaces.data && workspaces.data.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.data.map((w) => {
            const pct = w.itemCount
              ? Math.round((w.completedCount / w.itemCount) * 100)
              : 0;
            return (
              <li key={w.id}>
                <Link
                  to={`/workspaces/${w.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
                >
                  <h2 className="font-semibold">{w.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {w.itemCount} resource{w.itemCount === 1 ? "" : "s"} ·{" "}
                    {w.completedCount} completed
                  </p>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
