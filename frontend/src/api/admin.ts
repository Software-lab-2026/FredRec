import type { Domain, Expert } from '../types/curation'
import { ApiError, USE_MOCKS, apiFetch, delay } from './client'
import { loadMockDomains, saveMockDomains, slugify } from './domains'

// ================= Domains =================

export async function createDomain(name: string, description = ''): Promise<Domain> {
  name = name.trim()
  if (!USE_MOCKS) {
    return apiFetch<Domain>('/admin/domains', { method: 'POST', body: JSON.stringify({ name, description }) })
  }
  await delay(150)
  if (!name) throw new ApiError(422, 'Domain name cannot be empty.')
  const domains = loadMockDomains()
  if (domains.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, `A domain called “${name}” already exists.`)
  }
  const domain: Domain = { id: slugify(name), name, description, topics: [] }
  saveMockDomains([...domains, domain])
  return domain
}

export async function renameDomain(id: string, name: string): Promise<Domain> {
  name = name.trim()
  if (!USE_MOCKS) {
    return apiFetch<Domain>(`/admin/domains/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
  }
  await delay(150)
  const domains = loadMockDomains()
  const domain = domains.find((d) => d.id === id)
  if (!domain) throw new ApiError(404, 'Domain not found.')
  if (domains.some((d) => d.id !== id && d.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, `A domain called “${name}” already exists.`)
  }
  domain.name = name
  saveMockDomains(domains)
  return domain
}

export async function deleteDomain(id: string): Promise<void> {
  if (!USE_MOCKS) {
    await apiFetch<void>(`/admin/domains/${id}`, { method: 'DELETE' })
    return
  }
  await delay(150)
  const domains = loadMockDomains()
  const domain = domains.find((d) => d.id === id)
  if (!domain) throw new ApiError(404, 'Domain not found.')
  // Same rule as the backend (ondelete="RESTRICT"): a domain with topics can't be deleted.
  if (domain.topics.length > 0) {
    throw new ApiError(409, `“${domain.name}” still has ${domain.topics.length} topics. Move or remove them first.`)
  }
  saveMockDomains(domains.filter((d) => d.id !== id))
}

// ================= Experts =================

const MOCK_EXPERTS_KEY = 'fredrec.mockExperts'
const MOCK_USERS_KEY = 'fredrec.mockUsers' // written by api/auth.ts on sign-up

function loadMockExperts(): Expert[] {
  return JSON.parse(localStorage.getItem(MOCK_EXPERTS_KEY) ?? '[]')
}
function saveMockExperts(experts: Expert[]) {
  localStorage.setItem(MOCK_EXPERTS_KEY, JSON.stringify(experts))
}

export async function listExperts(): Promise<Expert[]> {
  if (!USE_MOCKS) return apiFetch<Expert[]>('/admin/experts')
  await delay(150)
  return loadMockExperts()
}

/** Make a user an expert for exactly these domains (replaces their old list). */
export async function setExpertDomains(username: string, domainIds: string[]): Promise<Expert> {
  username = username.trim()
  if (!USE_MOCKS) {
    return apiFetch<Expert>(`/admin/experts/${encodeURIComponent(username)}`, {
      method: 'PUT',
      body: JSON.stringify({ domainIds }),
    })
  }
  await delay(150)
  const users: { id: string; username: string }[] = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) ?? '[]')
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase())
  if (!user) throw new ApiError(404, `No user called “${username}”.`)
  if (domainIds.length === 0) throw new ApiError(422, 'Pick at least one domain.')

  const expert: Expert = { userId: user.id, username: user.username, domainIds }
  const others = loadMockExperts().filter((e) => e.userId !== user.id)
  saveMockExperts([...others, expert])
  return expert
}

export async function removeExpert(userId: string): Promise<void> {
  if (!USE_MOCKS) {
    await apiFetch<void>(`/admin/experts/${userId}`, { method: 'DELETE' })
    return
  }
  await delay(150)
  saveMockExperts(loadMockExperts().filter((e) => e.userId !== userId))
}