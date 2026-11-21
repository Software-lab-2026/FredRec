import type { SearchResponse } from '../types/resource'
import { apiFetch } from './client'

export function searchResources(query: string): Promise<SearchResponse> {
  return apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(query)}`)
}
