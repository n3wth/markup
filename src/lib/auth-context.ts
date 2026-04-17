import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  providerToken: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  providerToken: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}
