import { TOPIC_DOMAINS } from '../data/topics'
import type { Domain } from '../types/curation'
import { USE_MOCKS, apiFetch, delay } from './client'

// ---- mock storage (browser localStorage) ----
const MOCK_DOMAINS_KEY = 'fredrec.mockDomains'

/** "Networks & Security" -> "networks-security" */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Read the mock domains. The first time, start from data/topics.ts. */
export function loadMockDomains(): Domain[] {
  const saved = localStorage.getItem(MOCK_DOMAINS_KEY)
  if (saved) return JSON.parse(saved)
  return TOPIC_DOMAINS.map((d) => ({
    id: slugify(d.domain),
    name: d.domain,
    description: '',
    topics: d.topics,
  }))
}

export function saveMockDomains(domains: Domain[]) {
  localStorage.setItem(MOCK_DOMAINS_KEY, JSON.stringify(domains))
}

/**
 * List every domain with its topics.
 * - Mock mode: read from localStorage (so admin changes show up).
 * - Real mode: call the FastAPI backend at GET /api/domains.
 */
export async function listDomains(): Promise<Domain[]> {
  if (!USE_MOCKS) return apiFetch<Domain[]>('/domains')
  await delay()
  return loadMockDomains()
}