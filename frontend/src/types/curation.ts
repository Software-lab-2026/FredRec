/** A subject area like "Systems", grouping several topics. Matches the backend `domains` table. */
export interface Domain {
  id: string
  name: string
  description: string
  topics: string[]
}