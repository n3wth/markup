import { supabase } from './supabase'

export interface Profile {
  user_id: string
  referral_code: string
  referred_by_user_id: string | null
  created_at: string
}

export interface Referral {
  id: string
  referrer_id: string
  referee_id: string
  status: 'pending' | 'rewarded' | 'void'
  created_at: string
  rewarded_at: string | null
}

/** Load the caller's profile row. Returns null if not signed in or absent. */
export async function loadMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .maybeSingle()
  if (error) return null
  return (data as Profile | null) ?? null
}

/**
 * Attempt to claim a referral code for the current user. Resolves `true`
 * on success, `false` on any silent rejection (invalid code, self-ref,
 * already attributed). Never throws for validation failures — the server
 * RPC swallows them.
 */
export async function claimReferralCode(code: string): Promise<boolean> {
  const trimmed = code.trim()
  if (!trimmed) return false
  const { data, error } = await supabase.rpc('claim_referral', { p_code: trimmed })
  if (error) return false
  return data === true
}

/** List referrals where the caller is the referrer, newest first. */
export async function listMyReferrals(): Promise<Referral[]> {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return []
  return (data as Referral[] | null) ?? []
}

/**
 * Build a shareable referral URL. Prefers VITE_APP_URL so staging/prod
 * don't leak the current tab's localhost. Falls back to the current
 * origin. The ref is placed on `/` since the signup flow lives at the
 * root (see LoginPage).
 */
export function buildReferralLink(code: string): string {
  const envBase = import.meta.env.VITE_APP_URL as string | undefined
  const base = envBase?.trim() || (typeof window !== 'undefined' ? window.location.origin : '')
  const url = new URL('/', base || 'https://example.com')
  url.searchParams.set('ref', code)
  return url.toString()
}

/**
 * Pull a referral code from a URL's query string. Returns null when no
 * `?ref=` is present. Used at app bootstrap to defer a claim until the
 * user has completed sign-in.
 */
export function readRefParam(search: string = typeof window !== 'undefined' ? window.location.search : ''): string | null {
  const params = new URLSearchParams(search)
  const raw = params.get('ref')
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

/** localStorage key for a pending referral code awaiting a signed-in user. */
export const PENDING_REF_STORAGE_KEY = 'markup-pending-ref'
