import type { Resource } from './resource'

/** A subject area like "Systems", grouping several topics. Matches the backend `domains` table. */
export interface Domain {
  id: string
  name: string
  description: string
  topics: string[]
}

/** A user who reviews suggestions for some domains. Matches the backend `domain_experts` table. */
export interface Expert {
  userId: string
  username: string
  domainIds: string[]
}

/** A resource an expert or admin has approved, shown first in search results. */
export interface CuratedResource {
  resource: Resource
  topic: string
  domainId: string
  approvedAt: string
}