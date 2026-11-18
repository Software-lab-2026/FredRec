import type { CuratedResource } from '../types/curation'
import type { Resource } from '../types/resource'
import { USE_MOCKS, apiFetch, delay } from './client'
import { slugify } from './domains'

// A few approved resources so the Curated tab and search have something to show.
const SEED: CuratedResource[] = [
  {
    topic: 'Operating Systems',
    domainId: slugify('Systems'),
    approvedAt: '2026-11-01T10:00:00Z',
    resource: {
      url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
      urlHash: 'curated-ostep',
      title: 'Operating Systems: Three Easy Pieces',
      format: 'textbook',
      source: 'OSTEP',
      description: 'Free OS textbook covering virtualization, concurrency and persistence.',
      authors: ['Remzi Arpaci-Dusseau', 'Andrea Arpaci-Dusseau'],
      difficulty: 'beginner',
    },
  },
  {
    topic: 'Computer Networks',
    domainId: slugify('Networks & Security'),
    approvedAt: '2026-11-02T10:00:00Z',
    resource: {
      url: 'https://book.systemsapproach.org/',
      urlHash: 'curated-systems-approach',
      title: 'Computer Networks: A Systems Approach',
      format: 'textbook',
      source: 'systemsapproach.org',
      description: 'Open-access networking textbook by Peterson and Davie.',
      authors: ['Larry Peterson', 'Bruce Davie'],
      difficulty: 'intermediate',
    },
  },
]

const MOCK_CURATED_KEY = 'fredrec.mockCurated'

function loadMockCurated(): CuratedResource[] {
  const saved = localStorage.getItem(MOCK_CURATED_KEY)
  return saved ? JSON.parse(saved) : SEED
}
function saveMockCurated(items: CuratedResource[]) {
  localStorage.setItem(MOCK_CURATED_KEY, JSON.stringify(items))
}

/** Used by search in mock mode: curated resources for one topic, shown before other results. */
export function mockCuratedForTopic(topic: string): Resource[] {
  return loadMockCurated()
    .filter((c) => c.topic.toLowerCase() === topic.toLowerCase())
    .map((c) => c.resource)
}

export async function listCurated(): Promise<CuratedResource[]> {
  if (!USE_MOCKS) return apiFetch<CuratedResource[]>('/admin/curated')
  await delay(150)
  return loadMockCurated()
}

export async function removeCurated(urlHash: string): Promise<void> {
  if (!USE_MOCKS) {
    await apiFetch<void>(`/admin/curated/${urlHash}`, { method: 'DELETE' })
    return
  }
  await delay(150)
  saveMockCurated(loadMockCurated().filter((c) => c.resource.urlHash !== urlHash))
}