import { resolveTopic, suggestTopics } from '../data/topics'
import { buildMockResults } from '../mocks/searchResults'
import type { SearchResponse } from '../types/resource'
import { ApiError, USE_MOCKS, apiFetch, delay } from './client'
import { listDomains } from './domains'
import { mockCuratedForTopic } from './submissions'

export async function searchResources(query: string): Promise<SearchResponse> {
  if (!USE_MOCKS) {
    return apiFetch<SearchResponse>(`/search?q=${encodeURIComponent(query)}`)
  }

  await delay(600)
  const topics = (await listDomains()).flatMap((d) => d.topics)
  const topic = resolveTopic(topics, query) ?? suggestTopics(topics, query, 1)[0]
  if (!topic) {
    throw new ApiError(422, `“${query}” doesn’t match a Computer Science topic we cover yet.`)
  }
  const results = [...mockCuratedForTopic(topic), ...buildMockResults(topic)]
  return { query, topic, results, failedSources: [], cached: false }
}

