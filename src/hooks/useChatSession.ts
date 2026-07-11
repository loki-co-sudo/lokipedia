// 会話スレッド（検索・生成の1セッション）をページ遷移をまたいで保持する Context（docs/DESIGN.md §5.1）。
// タブ移動では消えず、「会話をリセット」「新しく調べる」で破棄される。リロードでは消える（メモリ上のみ）。

import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'
import type { AnswerMode } from '../lib/answerMode'
import type { ChatImage, ChatMessage, GeneratedEntry, Word } from '../types'

export interface ChatSessionValue {
  /** 最初に送信した検索ワード（user 吹き出しの表示に使う） */
  lastQuery: string
  setLastQuery: Dispatch<SetStateAction<string>>
  /** 最初の送信に添付した画像（docs/DESIGN.md §4.4。user 吹き出しの表示に使う） */
  lastQueryImages: ChatImage[]
  setLastQueryImages: Dispatch<SetStateAction<ChatImage[]>>
  /** /add（共有受け取り）から引き継いだ出典URL */
  sourceUrl: string | null
  setSourceUrl: Dispatch<SetStateAction<string | null>>
  entry: GeneratedEntry | null
  setEntry: Dispatch<SetStateAction<GeneratedEntry | null>>
  entryTags: string[]
  setEntryTags: Dispatch<SetStateAction<string[]>>
  duplicate: Word | null
  setDuplicate: Dispatch<SetStateAction<Word | null>>
  conversation: ChatMessage[]
  setConversation: Dispatch<SetStateAction<ChatMessage[]>>
  /** この会話に固定された回答モード（docs/DESIGN.md §4.2） */
  conversationMode: AnswerMode | null
  setConversationMode: Dispatch<SetStateAction<AnswerMode | null>>
  /** 会話を破棄して初期状態に戻す */
  reset: () => void
}

export const ChatSessionContext = createContext<ChatSessionValue | null>(null)

export function useChatSession(): ChatSessionValue {
  const ctx = useContext(ChatSessionContext)
  if (!ctx) throw new Error('useChatSession は ChatSessionProvider の内側でのみ使用できます')
  return ctx
}
