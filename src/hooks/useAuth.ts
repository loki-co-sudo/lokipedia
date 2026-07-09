// 管理者セッションの購読・ログイン・ログアウト。docs/DESIGN.md §5.4 参照。

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigError } from '../lib/supabase'

interface UseAuthResult {
  session: Session | null
  /** 書き込み系 UI の出し分けに使う。実際の保護は RLS が担う（CLAUDE.md 絶対ルール2）。 */
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error(supabaseConfigError ?? 'Supabaseが設定されていません')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return { session, isAdmin: session !== null, loading, signIn, signOut }
}
