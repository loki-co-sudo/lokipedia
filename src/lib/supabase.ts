import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** env 未設定時に画面へ表示する日本語メッセージ。null なら設定は正常。 */
export const supabaseConfigError: string | null =
  !url || !anonKey
    ? 'Supabaseの接続情報が設定されていません。.env.local に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。'
    : null

export const supabase: SupabaseClient | null = supabaseConfigError ? null : createClient(url, anonKey)
