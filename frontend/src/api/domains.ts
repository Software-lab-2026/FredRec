import { TOPIC_DOMAINS } from '../data/topics'
import type { Domain } from '../types/curation'
import { USE_MOCKS, apiFetch, delay } from './client'

/**
 * List every domain with its topics.
 * - Mock mode: build the list from data/topics.ts.
 * - Real mode: call the FastAPI backend at GET /api/domains.
 */
export async function listDomains(): Promise<Domain[]> {
  if (!USE_MOCKS) return apiFetch<Domain[]>('/domains')

  await delay()
  return TOPIC_DOMAINS.map((d) => ({
    id: d.domain.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: d.domain,
    description: '',
    topics: d.topics,
  }))
}