import type { ProgressStatus, Resource, Workspace, WorkspaceDetail } from '../types/resource'
import { apiFetch } from './client'

export function listWorkspaces(): Promise<Workspace[]> {
  return apiFetch<Workspace[]>('/workspaces')
}

export function createWorkspace(name: string): Promise<Workspace> {
  return apiFetch<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
}

export function renameWorkspace(id: string, name: string): Promise<Workspace> {
  return apiFetch<Workspace>(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) })
}

export function deleteWorkspace(id: string): Promise<void> {
  return apiFetch<void>(`/workspaces/${id}`, { method: 'DELETE' })
}

export function getWorkspace(id: string): Promise<WorkspaceDetail> {
  return apiFetch<WorkspaceDetail>(`/workspaces/${id}`)
}

export function getSavedIndex(): Promise<Record<string, string[]>> {
  return apiFetch<Record<string, string[]>>('/workspaces/saved-index')
}

export function addToWorkspace(workspaceId: string, resource: Resource): Promise<Resource> {
  return apiFetch<Resource>(`/workspaces/${workspaceId}/items`, { method: 'POST', body: JSON.stringify({ resource }) })
}

export function removeFromWorkspace(workspaceId: string, urlHash: string): Promise<void> {
  return apiFetch<void>(`/workspaces/${workspaceId}/items/${urlHash}`, { method: 'DELETE' })
}

// Progress is per user per resource thus it appears same in all the workspaces.
export function updateProgress(urlHash: string, status: ProgressStatus, percent: number): Promise<void> {
  return apiFetch<void>(`/progress/${urlHash}`, { method: 'PUT', body: JSON.stringify({ status, percent }) })
}

export function submitReview(
  resource: Resource,
  rating: number,
  text: string,
): Promise<{ avgRating: number; reviewCount: number }> {
  return apiFetch('/reviews', { method: 'POST', body: JSON.stringify({ resource, rating, text }) })
}
