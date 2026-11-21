import type { User } from '../types/resource'
import { ApiError,apiFetch, setToken } from './client'

interface AuthResponse {
  accessToken: string
  user: User
}

export interface SignupInput {
  username: string
  email: string
  password: string
}

function acceptLogin(res: AuthResponse): User {
  setToken(res.accessToken)
  return res.user
}

// to create signup accounts for endusers
export async function signup(input: SignupInput): Promise<User> {
  return acceptLogin(await apiFetch<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(input) }))
}

export async function login(username: string, password: string): Promise<User> {
  return acceptLogin(
    await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  )
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await apiFetch<User>('/auth/me')
  } catch (err) {
    // token dropped if server reachable.
    if (err instanceof ApiError && err.status === 401) logout()
    return null
  }
}

// new token for changing password
export async function changePassword(currentPassword: string, newPassword: string): Promise<User> {
  return acceptLogin(
    await apiFetch<AuthResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  )
}

export function logout() {
  setToken(null)
}
