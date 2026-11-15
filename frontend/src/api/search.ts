import { resolveTopic } from '../data/topics'
import { MOCK_RESULTS } from '../mocks/searchResults'
import type { SearchResponse } from '../types/resource'
import { ApiError, USE_MOCKS, apiFetch, delay } from './client'

/**
 * Search free resources for a topic.
 * - Mock mode: look the topic up in MOCK_RESULTS.
 * - Real mode: call the FastAPI backend at GET /api/search?q=...
 * Throws ApiError(404) when the topic is unknown, so the page can show "suggest it".
 */
export async function searchResources(query: string): Promise<SearchResponse> {
  const q = query.trim()
  if (!USE_MOCKS) return apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(q)}`)

  await delay()
  const topic = resolveTopic(q)
  if (!topic) throw new ApiError(404, `We don't know the topic “${q}” yet.`)
  return {
    query: q,
    topic,
    results: MOCK_RESULTS[topic] ?? [],
    failedSources: [],
    cached: false,
  }
}