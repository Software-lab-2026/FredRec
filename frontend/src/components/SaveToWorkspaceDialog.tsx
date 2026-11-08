import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { addToWorkspace, createWorkspace, getSavedIndex, listWorkspaces, removeFromWorkspace } from '../api/workspace'
import { useAuth } from '../context/useAuth'
import { workspaceKeys } from '../hooks/workspaceKeys'
import type { Resource } from '../types/resource'
import Loader from "./Loader"

interface Props {
  resource: Resource
  suggestedName: string
  onClose: () => void
}

export default function SaveToWorkspaceDialog({ resource, suggestedName, onClose }: Props) {
  const { user } = useAuth()
  const userId = user!.id
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const workspaces = useQuery({ queryKey: workspaceKeys.list(userId), queryFn: listWorkspaces })
  const editable = workspaces.data?.filter((w) => w.access !== 'viewer')
  const savedIndex = useQuery({ queryKey: workspaceKeys.savedIndex(userId), queryFn: getSavedIndex })
  const savedIn = new Set(savedIndex.data?.[resource.urlHash] ?? [])

  const nameTaken = (name: string) =>
    workspaces.data?.some((w) => !w.team && w.name.toLowerCase() === name.trim().toLowerCase()) ?? false
  const [newName, setNewName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const nameValue = nameTouched ? newName : workspaces.isSuccess && !nameTaken(suggestedName) ? suggestedName : ''

  const refresh = () => queryClient.invalidateQueries({ queryKey: workspaceKeys.all(userId) })

  const toggle = useMutation({
    mutationFn: async (workspaceId: string) => {
      if (savedIn.has(workspaceId)) await removeFromWorkspace(workspaceId, resource.urlHash)
      else await addToWorkspace(workspaceId, resource)
    },
    onSuccess: refresh,
  })

  const create = useMutation({
    mutationFn: async (name: string) => {
      const ws = await createWorkspace(name)
      await addToWorkspace(ws.id, resource)
    },
    onSuccess: () => {
      setNewName('')
      setNameTouched(true)
      return refresh()
    },
  })

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (nameValue.trim()) create.mutate(nameValue)
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl bg-white p-0 text-ink-900 shadow-xl ring-1 ring-ink-200 backdrop:bg-ink-900/50 dark:bg-ink-900 dark:text-ink-100 dark:ring-ink-700 dark:backdrop:bg-black/70"
    >
      <div className="p-5">
        <h2 className="text-lg font-semibold">Save to workspace</h2>
        <p className="mt-1 line-clamp-2 text-sm text-ink-600 dark:text-ink-400">{resource.title}</p>

        {workspaces.isPending && <Loader className="mt-4 text-sm" />}

        {editable && editable.length > 0 && (
          <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
            {editable.map((w) => {
              const checked = savedIn.has(w.id)
              return (
                <li key={w.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-800">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={toggle.isPending}
                      onChange={() => toggle.mutate(w.id)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="flex-1 text-sm font-medium">
                      {w.name}
                      {w.team && (
                        <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-normal text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                          {w.team.name}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-ink-500">
                      {w.itemCount} resource{w.itemCount === 1 ? '' : 's'}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}

        <form onSubmit={onCreate} className="mt-4 border-t border-ink-200 pt-4 dark:border-ink-800">
          <label className="text-sm font-medium text-ink-700 dark:text-ink-300" htmlFor="new-workspace-name">
            {editable?.length ? 'Or create a new workspace' : 'Create your first workspace'}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="new-workspace-name"
              value={nameValue}
              onChange={(e) => {
                setNameTouched(true)
                setNewName(e.target.value)
              }}
              placeholder="e.g. Machine Learning"
              maxLength={60}
              className="w-full rounded-md border border-ink-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-ink-700 dark:bg-ink-900 dark:focus:ring-brand-900"
            />
            <button
              type="submit"
              disabled={!nameValue.trim() || create.isPending}
              className="shrink-0 rounded-md bg-brand-600 dark:bg-brand-400 px-3 py-1.5 text-sm font-medium text-brand-400 dark:text-brand-600 hover:bg-brand-700 dark:hover:bg-brand-300 disabled:opacity-50"
            >
              Create & save
            </button>
          </div>
          {toggle.isError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{toggle.error.message}</p>}
          {create.isError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{create.error.message}</p>}
        </form>
      </div>
      <div className="flex justify-end border-t border-ink-200 px-5 py-3 dark:border-ink-800">
        <button
          onClick={() => dialogRef.current?.close()}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          Done
        </button>
      </div>
    </dialog>
  )
}
