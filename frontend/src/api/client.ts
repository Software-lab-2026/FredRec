const TOKEN_KEY = 'fredrec.token'

const SERVER_DOWN_MESSAGE = "Can't reach the FredRec server. Check that the backend is running, then try again."

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  // Close matches for given query
  suggestions: string[]
  constructor(status: number, message: string, suggestions: string[] = []) {
    super(message)
    this.status = status
    this.suggestions = suggestions
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`/api${path}`, { ...options, headers }).catch(() => {
    throw new ApiError(0, SERVER_DOWN_MESSAGE)
  })
  if (res.status >= 500) throw new ApiError(res.status, SERVER_DOWN_MESSAGE)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = body.detail
    // FastAPI sends a message
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      throw new ApiError(res.status, detail.message ?? res.statusText, detail.suggestions ?? [])
    }
    if (Array.isArray(detail)) throw new ApiError(res.status, detail[0]?.msg ?? res.statusText)
    throw new ApiError(res.status, detail ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
