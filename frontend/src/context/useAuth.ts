import { createContext, useContext } from 'react'
import type { SignupInput } from '../api/auth'
import type { User } from '../types/resource'

export interface AuthState {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  signup: (input: SignupInput) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

