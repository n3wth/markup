import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockResult { data: unknown; error: unknown }

let profileResult: MockResult = { data: null, error: null }
let referralsResult: MockResult = { data: [], error: null }
let rpcResult: MockResult = { data: false, error: null }
const rpcCalls: Array<{ fn: string; args: unknown }> = []

vi.mock('../lib/supabase', () => {
  const makeBuilder = (result: MockResult) => {
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.order = () => b
    b.maybeSingle = () => Promise.resolve(result)
    b.then = (fn: (v: MockResult) => unknown) => Promise.resolve(result).then(fn)
    return b
  }
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'profiles') return makeBuilder(profileResult)
        if (table === 'referrals') return makeBuilder(referralsResult)
        return makeBuilder({ data: null, error: null })
      },
      rpc: (fn: string, args: unknown) => {
        rpcCalls.push({ fn, args })
        return Promise.resolve(rpcResult)
      },
    },
  }
})

import {
  buildReferralLink,
  claimReferralCode,
  listMyReferrals,
  loadMyProfile,
  readRefParam,
} from '../lib/referrals'

beforeEach(() => {
  profileResult = { data: null, error: null }
  referralsResult = { data: [], error: null }
  rpcResult = { data: false, error: null }
  rpcCalls.length = 0
})

describe('readRefParam', () => {
  it('returns the code when ?ref= is present', () => {
    expect(readRefParam('?ref=ABC123')).toBe('ABC123')
  })
  it('returns null when ref is absent', () => {
    expect(readRefParam('?other=1')).toBeNull()
  })
  it('returns null when ref is empty or whitespace', () => {
    expect(readRefParam('?ref=')).toBeNull()
    expect(readRefParam('?ref=%20%20')).toBeNull()
  })
})

describe('buildReferralLink', () => {
  it('uses VITE_APP_URL when set', () => {
    const original = import.meta.env.VITE_APP_URL
    ;(import.meta.env as Record<string, string>).VITE_APP_URL = 'https://markup.so'
    try {
      const link = buildReferralLink('ABC123')
      expect(link).toContain('https://markup.so')
      expect(link).toContain('ref=ABC123')
    } finally {
      ;(import.meta.env as Record<string, string>).VITE_APP_URL = original ?? ''
    }
  })
  it('falls back to window.location.origin', () => {
    ;(import.meta.env as Record<string, string>).VITE_APP_URL = ''
    const link = buildReferralLink('CODE42')
    expect(link).toContain('ref=CODE42')
  })
})

describe('loadMyProfile', () => {
  it('returns the profile row when present', async () => {
    profileResult = {
      data: {
        user_id: 'u1',
        referral_code: 'ABCD1234',
        referred_by_user_id: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    }
    const p = await loadMyProfile()
    expect(p?.referral_code).toBe('ABCD1234')
  })
  it('returns null on error', async () => {
    profileResult = { data: null, error: { message: 'boom' } }
    expect(await loadMyProfile()).toBeNull()
  })
})

describe('claimReferralCode', () => {
  it('returns false on empty code without calling RPC', async () => {
    const ok = await claimReferralCode('   ')
    expect(ok).toBe(false)
    expect(rpcCalls).toHaveLength(0)
  })
  it('calls claim_referral RPC with the trimmed code', async () => {
    rpcResult = { data: true, error: null }
    const ok = await claimReferralCode('  CODE42  ')
    expect(ok).toBe(true)
    expect(rpcCalls).toEqual([{ fn: 'claim_referral', args: { p_code: 'CODE42' } }])
  })
  it('returns false when RPC errors', async () => {
    rpcResult = { data: null, error: { message: 'boom' } }
    expect(await claimReferralCode('CODE42')).toBe(false)
  })
  it('returns false when RPC returns false', async () => {
    rpcResult = { data: false, error: null }
    expect(await claimReferralCode('CODE42')).toBe(false)
  })
})

describe('listMyReferrals', () => {
  it('returns the rows on success', async () => {
    referralsResult = {
      data: [
        {
          id: 'r1', referrer_id: 'u1', referee_id: 'u2',
          status: 'pending', created_at: '2026-01-01T00:00:00Z', rewarded_at: null,
        },
      ],
      error: null,
    }
    const rows = await listMyReferrals()
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
  })
  it('returns [] on error', async () => {
    referralsResult = { data: null, error: { message: 'boom' } }
    expect(await listMyReferrals()).toEqual([])
  })
})
