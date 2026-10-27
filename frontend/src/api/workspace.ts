import type { Progress, ProgressStatus, Resource, Workspace, WorkspaceDetail } from '../types/resource'
import { ApiError, USE_MOCKS, apiFetch, delay } from './client'

interface MockWorkspace {
  id: string
  name: string
  createdAt: string
  items: { resource: Resource; addedAt: string }[]
}
interface MockData {
  workspaces: MockWorkspace[]
  progress: Record<string, Progress>
}
const key = (userId: string) => `fredrec.data.${userId}`
function load(userId: string): MockData {
  return JSON.parse(localStorage.getItem(key(userId)) ?? '{"workspaces":[],"progress":{}}')
}
function store(userId: string, data: MockData) {
  localStorage.setItem(key(userId), JSON.stringify(data))
}
const NOT_STARTED: Progress = { status: 'not_started', percent: 0 }

function summarize(ws: MockWorkspace, progress: MockData['progress']): Workspace {
  return {
    id: ws.id,
    name: ws.name,
    createdAt: ws.createdAt,
    itemCount: ws.items.length,
    completedCount: ws.items.filter((i) => progress[i.resource.urlHash]?.status === 'completed').length,
  }
}
function findWorkspace(data: MockData, id: string): MockWorkspace {
  const ws = data.workspaces.find((w) => w.id === id)
  if (!ws) throw new ApiError(404, 'Workspace not found.')
  return ws
}
function assertUniqueName(data: MockData, name: string, exceptId?: string) {
  if (data.workspaces.some((w) => w.id !== exceptId && w.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, `You already have a workspace called “${name}”.`)
  }
}


export async function listWorkspaces(userId: string): Promise<Workspace[]> {
  if (!USE_MOCKS) return apiFetch<Workspace[]>('/workspaces')
  await delay(150)
  const data = load(userId)
  return data.workspaces.map((w) => summarize(w, data.progress))
}

export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
  name = name.trim()
  if (!USE_MOCKS) return apiFetch<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify({ name }) })
  await delay(150)
  const data = load(userId)
  assertUniqueName(data, name)
  const ws: MockWorkspace = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), items: [] }
  data.workspaces.push(ws)
  store(userId, data)
  return summarize(ws, data.progress)
}

export async function renameWorkspace(userId: string, id: string, name: string): Promise<void> {
  name = name.trim()
  if (!USE_MOCKS) {
    await apiFetch(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
    return
  }
  const data = load(userId)
  assertUniqueName(data, name, id)
  findWorkspace(data, id).name = name
  store(userId, data)
}

export async function deleteWorkspace(userId: string, id: string): Promise<void> {
  if (!USE_MOCKS) {
    await apiFetch(`/workspaces/${id}`, { method: 'DELETE' })
    return
  }
  const data = load(userId)
  data.workspaces = data.workspaces.filter((w) => w.id !== id)
  store(userId, data)
}

export async function getWorkspace(userId: string, id: string): Promise<WorkspaceDetail> {
  if (!USE_MOCKS) return apiFetch<WorkspaceDetail>(`/workspaces/${id}`)
  await delay(150)
  const data = load(userId)
  const ws = findWorkspace(data, id)
  return {
    workspace: summarize(ws, data.progress),
    items: ws.items.map((i) => ({ ...i, ...(data.progress[i.resource.urlHash] ?? NOT_STARTED) })),
  }
}


export async function getSavedIndex(userId: string): Promise<Record<string, string[]>> {
  if (!USE_MOCKS) return apiFetch<Record<string, string[]>>('/workspaces/saved-index')
  const index: Record<string, string[]> = {}
  for (const ws of load(userId).workspaces) {
    for (const item of ws.items) (index[item.resource.urlHash] ??= []).push(ws.id)
  }
  return index
}

export async function addToWorkspace(userId: string, workspaceId: string, resource: Resource): Promise<void> {
  if (!USE_MOCKS) {
    await apiFetch(`/workspaces/${workspaceId}/items`, { method: 'POST', body: JSON.stringify({ resource }) })
    return
  }
  await delay(150)
  const data = load(userId)
  const ws = findWorkspace(data, workspaceId)
  if (ws.items.some((i) => i.resource.urlHash === resource.urlHash)) return
  ws.items.push({ resource, addedAt: new Date().toISOString() })
  store(userId, data)
}

export async function removeFromWorkspace(userId: string, workspaceId: string, urlHash: string): Promise<void> {
  if (!USE_MOCKS) {
    await apiFetch(`/workspaces/${workspaceId}/items/${urlHash}`, { method: 'DELETE' })
    return
  }
  const data = load(userId)
  const ws = findWorkspace(data, workspaceId)
  ws.items = ws.items.filter((i) => i.resource.urlHash !== urlHash)
  store(userId, data)
}


export async function updateProgress(userId: string, urlHash: string, status: ProgressStatus, percent: number): Promise<void> {
  if (!USE_MOCKS) {
    await apiFetch(`/progress/${urlHash}`, { method: 'PUT', body: JSON.stringify({ status, percent }) })
    return
  }
  const data = load(userId)
  data.progress[urlHash] = { status, percent }
  store(userId, data)
}

export async function submitReview(resource: Resource, rating: number, text: string): Promise<void> {
  if (!USE_MOCKS) {
    await apiFetch('/reviews', { method: 'POST', body: JSON.stringify({ resource, rating, text }) })
    return
  }
  await delay(300)
}

