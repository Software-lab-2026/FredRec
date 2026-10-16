export const RESOURCE_FORMATS = ['video', 'course', 'paper', 'textbook', 'article', 'repo'] as const

export type ResourceFormat = (typeof RESOURCE_FORMATS)[number]

export const FORMAT_LABELS: Record<ResourceFormat, string> = {
  video: 'Videos',
  course: 'Courses',
  paper: 'Research Papers',
  textbook: 'Textbooks',
  article: 'Articles',
  repo: 'Repositories',
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

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
}

export interface SearchResponse {
  query: string
  topic: string
  results: Resource[]
  failedSources: string[]
  cached: boolean
}

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'

export interface Progress {
  status: ProgressStatus
  percent: number
}

export interface Workspace {
  id: string
  name: string
  createdAt: string
  itemCount: number
  completedCount: number
}

export interface WorkspaceItem extends Progress {
  resource: Resource
  addedAt: string
}

export interface WorkspaceDetail {
  workspace: Workspace
  items: WorkspaceItem[]
}

export interface User {
  id: string
  username: string
  email: string
}

