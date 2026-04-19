import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthResult = { error: string | null }

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  recovering: boolean
  clearRecovering: () => void
  providerToken: string | null
  signInWithGoogle: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  updatePassword: (newPassword: string) => Promise<AuthResult>
  updateProfile: (data: { displayName?: string; avatarUrl?: string }) => Promise<AuthResult>
  signOut: () => Promise<void>
  signOutEverywhere: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  recovering: false,
  clearRecovering: () => {},
  providerToken: null,
  signInWithGoogle: async () => {},
  signInWithGitHub: async () => {},
  signInWithEmail: async () => ({ error: 'AuthProvider not mounted' }),
  signUpWithEmail: async () => ({ error: 'AuthProvider not mounted' }),
  resetPassword: async () => ({ error: 'AuthProvider not mounted' }),
  updatePassword: async () => ({ error: 'AuthProvider not mounted' }),
  updateProfile: async () => ({ error: 'AuthProvider not mounted' }),
  signOut: async () => {},
  signOutEverywhere: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}
