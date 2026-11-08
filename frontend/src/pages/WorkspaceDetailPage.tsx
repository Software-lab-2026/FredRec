import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteWorkspace, getWorkspace, removeFromWorkspace, renameWorkspace, updateProgress } from '../api/workspace'
import WorkspaceItemRow from '../components/WorkspaceItemRow'
import { useAuth } from '../context/useAuth'
import { workspaceKeys } from '../hooks/workspaceKeys'
import type { ProgressStatus } from '../types/resource'
import Loader from "../components/Loader"

export default function WorkspaceDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const userId = user!.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: workspaceKeys.detail(userId, id), queryFn: () => getWorkspace(id), retry: false })
  const refresh = () => queryClient.invalidateQueries({ queryKey: workspaceKeys.all(userId) })

  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')

  const rename = useMutation({
    mutationFn: (name: string) => renameWorkspace(id, name),
    onSuccess: () => {
      setEditing(false)
      return refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async () => {
      await deleteWorkspace(id)
      await refresh()
    },
    onSuccess: () => navigate('/workspaces'),
  })
  const progress = useMutation({
    mutationFn: ({ hash, status, percent }: { hash: string; status: ProgressStatus; percent: number }) =>
      updateProgress(hash, status, percent),
    onSuccess: refresh,
  })
  const removeItem = useMutation({
    mutationFn: (hash: string) => removeFromWorkspace(id, hash),
    onSuccess: refresh,
  })

  if (detail.isPending) return <Loader />
  if (detail.isError) {
    return (
      <div className="pt-8 text-center">
        <p className="text-ink-600 dark:text-ink-400">{detail.error.message}</p>
        <Link to="/workspaces" className="mt-2 inline-block text-brand-600 dark:text-brand-400 hover:underline">Back to workspaces</Link>
      </div>
    )
  }

  const { workspace, items } = detail.data
  const canManage = workspace.access === 'owner'
  const canEdit = workspace.access !== 'viewer'
  const inProgress = items.filter((i) => i.status === 'in_progress').length

  function onRename(e: FormEvent) {
    e.preventDefault()
    if (draftName.trim()) rename.mutate(draftName)
  }

  function onDelete() {
    if (confirm(`Delete the workspace “${workspace.name}”? Saved resources in it will be removed from this workspace.`)) {
      remove.mutate()
    }
  }

  return (
    <div>
      {workspace.team ? (
        <Link to={`/teams/${workspace.team.id}`} className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white">
          ← {workspace.team.name}
        </Link>
      ) : (
        <Link to="/workspaces" className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white">← All workspaces</Link>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {editing ? (
          <form onSubmit={onRename} className="flex flex-wrap gap-2">
            <input
              autoFocus
              onFocus={(e) => e.target.select()}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              aria-label="Workspace name"
              maxLength={60}
              className="rounded-md border border-ink-300 bg-white px-3 py-1.5 text-lg font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-ink-700 dark:bg-ink-900 dark:focus:ring-brand-900"
            />
            <button type="submit" className="rounded-md bg-brand-600 dark:bg-brand-400 px-3 py-1.5 text-sm font-medium text-brand-400 dark:text-brand-600 hover:bg-brand-700 dark:hover:bg-brand-300">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-sm text-ink-600 dark:text-ink-400">Cancel</button>
          </form>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{workspace.name}</h1>
            {workspace.team && (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs capitalize text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                Team workspace · {workspace.access}
              </span>
            )}
            {canManage && (
              <>
                <button
                  onClick={() => {
                    setDraftName(workspace.name)
                    rename.reset()
                    setEditing(true)
                  }}
                  className="text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white"
                >
                  Rename
                </button>
                <button onClick={onDelete} className="text-sm text-rose-600 dark:text-rose-400 hover:underline">Delete</button>
              </>
            )}
          </>
        )}
      </div>
      {rename.isError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{rename.error.message}</p>}

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Resources" value={workspace.itemCount} />
        <Stat label="In progress" value={inProgress} />
        <Stat label="Completed" value={workspace.completedCount} />
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 p-8 text-center">
          <p className="text-ink-600 dark:text-ink-400">This workspace is empty.</p>
          <Link
            to={`/search?q=${encodeURIComponent(workspace.name)}`}
            className="mt-2 inline-block font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            Find resources for “{workspace.name}”
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 space-y-3">
            {items.map((item) => (
              <WorkspaceItemRow
                key={item.resource.urlHash}
                item={item}
                onProgress={(status, percent) => progress.mutate({ hash: item.resource.urlHash, status, percent })}
                onRemove={canEdit ? () => removeItem.mutate(item.resource.urlHash) : undefined}
              />
            ))}
          </ul>
          <Link
            to={`/search?q=${encodeURIComponent(workspace.name)}`}
            className="mt-4 inline-block text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            + Find more resources
          </Link>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4">
      <p className="text-2xl font-bold text-ink-900 dark:text-ink-100">{value}</p>
      <p className="text-sm text-ink-500">{label}</p>
    </div>
  )
}
