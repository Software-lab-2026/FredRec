import type { User } from '../types/resource'
import { ApiError, USE_MOCKS, apiFetch, delay, setToken } from './client'

interface AuthResponse {
  accessToken: string
  user: User
}

export interface SignupInput {
  username: string
  email: string
  password: string
}

const MOCK_USERS_KEY = 'fredrec.mockUsers'
interface MockUser extends User {
  password: string
}
function loadMockUsers(): MockUser[] {
  return JSON.parse(localStorage.getItem(MOCK_USERS_KEY) ?? '[]')
}
function toAuth(u: MockUser): AuthResponse {
  return { accessToken: `mock-${u.id}`, user: { id: u.id, username: u.username, email: u.email } }
}

export async function signup(input: SignupInput): Promise<User> {
  let res: AuthResponse
  if (USE_MOCKS) {
    await delay()
    const users = loadMockUsers()
    if (users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
      throw new ApiError(409, 'That username is already taken.')
    }
    if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new ApiError(409, 'An account with that email already exists.')
    }
    const user: MockUser = { id: crypto.randomUUID(), ...input }
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify([...users, user]))
    res = toAuth(user)
  } else {
    res = await apiFetch<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(input) })
  }
  setToken(res.accessToken)
  return res.user
}

export async function login(username: string, password: string): Promise<User> {
  let res: AuthResponse
  if (USE_MOCKS) {
    await delay()
    const user = loadMockUsers().find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password,
    )
    if (!user) throw new ApiError(401, 'Incorrect username or password.')
    res = toAuth(user)
  } else {
    res = await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  }
  setToken(res.accessToken)
  return res.user
}

export async function fetchCurrentUser(token: string): Promise<User | null> {
  if (USE_MOCKS) {
    const user = loadMockUsers().find((u) => `mock-${u.id}` === token)
    return user ? toAuth(user).user : null
  }
  return apiFetch<User>('/auth/me').catch(() => null)
}

export function logout() {
  setToken(null)
}

