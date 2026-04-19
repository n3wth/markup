import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Session, User } from '@supabase/supabase-js'
import { AuthContext, type AuthResult } from './auth-context'

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Unknown error'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)
  const [providerToken, setProviderToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setProviderToken(session?.provider_token ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setProviderToken(session?.provider_token ?? null)
        setLoading(false)
        if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  const clearRecovering = () => setRecovering(false)

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/drive.file',
      },
    })
  }

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })
  }

  const signInWithEmail = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? formatError(error) : null }
  }

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string,
  ): Promise<AuthResult> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: displayName ? { full_name: displayName, name: displayName } : undefined,
      },
    })
    return { error: error ? formatError(error) : null }
  }

  const resetPassword = async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=1`,
    })
    return { error: error ? formatError(error) : null }
  }

  const updatePassword = async (newPassword: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error ? formatError(error) : null }
  }

  const updateProfile = async (data: {
    displayName?: string
    avatarUrl?: string
  }): Promise<AuthResult> => {
    const metadata: Record<string, string> = {}
    if (data.displayName) {
      metadata.full_name = data.displayName
      metadata.name = data.displayName
    }
    if (data.avatarUrl) metadata.avatar_url = data.avatarUrl
    const { error } = await supabase.auth.updateUser({ data: metadata })
    return { error: error ? formatError(error) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const signOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: 'global' })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        recovering,
        clearRecovering,
        providerToken,
        signInWithGoogle,
        signInWithGitHub,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        updatePassword,
        updateProfile,
        signOut,
        signOutEverywhere,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
