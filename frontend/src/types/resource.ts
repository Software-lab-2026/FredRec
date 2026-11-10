export const RESOURCE_FORMATS = ['video', 'course', 'paper', 'textbook', 'article','notes', 'repo'] as const

export type ResourceFormat = (typeof RESOURCE_FORMATS)[number]

export const FORMAT_LABELS: Record<ResourceFormat, string> = {
  video: 'Videos',
  course: 'Courses',
  paper: 'Research Papers',
  textbook: 'Textbooks',
  article: 'Articles',
  notes: 'Notes',
  repo: 'Repositories',
}


export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const

export type Difficulty = (typeof DIFFICULTIES)[number]

export interface Resource {
  url: string
  urlHash: string
  title: string
  format: ResourceFormat
  source: string
  description: string
  authors: string[]
  thumbnail?: string
  durationMinutes?: number
  pages?: number
  difficulty?: Difficulty
  publishedYear?: number
  avgRating?: number
  reviewCount?: number
  origin?: 'fetched' | 'curated'
}

export type MatchMethod = 'exact' | 'alias' | 'vector' | 'partial'

export interface SearchMatch {
  kind: 'topic' | 'concept'
  name: string
  method: MatchMethod
  path: string[]
}

export interface SearchResponse {
  query: string
  topic: string
  match: SearchMatch
  results: Resource[]
  related: Resource[]
  suggestions: string[]
  failedSources: string[] // timed out during access
  cached: boolean
}

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'

export interface Progress {
  status: ProgressStatus
  percent: number
}

export type WorkspaceAccess = 'owner' | 'editor' | 'viewer'

export interface Workspace {
  id: string
  name: string
  createdAt: string
  itemCount: number
  completedCount: number
  team?: { id: string; name: string } | null
  access: WorkspaceAccess
}


//tracked per usser per resource and common across all workspaces
export interface WorkspaceItem extends Progress {
  resource: Resource
  addedAt: string
}

export interface WorkspaceDetail {
  workspace: Workspace
  items: WorkspaceItem[]
}

export type Role = 'enduser' | 'expert' | 'admin'

export const ROLE_LABELS: Record<Role, string> = {
  enduser: 'Learner',
  expert: 'Domain expert',
  admin: 'Admin',
}
export interface User {
  id: string
  username: string
  email: string
  role : Role
  domainIds: string[]
  mustChangePassword: boolean
}

