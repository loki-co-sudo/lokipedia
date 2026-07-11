import { useState, type ReactNode } from 'react'
import { ChatSessionContext } from '../hooks/useChatSession'
import type { AnswerMode } from '../lib/answerMode'
import type { ChatImage, ChatMessage, GeneratedEntry, Word } from '../types'

/** 会話スレッドの状態を App 直下で保持し、ページ遷移をまたいで維持する（docs/DESIGN.md §5.1）。 */
export default function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [lastQuery, setLastQuery] = useState('')
  const [lastQueryImages, setLastQueryImages] = useState<ChatImage[]>([])
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [entry, setEntry] = useState<GeneratedEntry | null>(null)
  const [entryTags, setEntryTags] = useState<string[]>([])
  const [duplicate, setDuplicate] = useState<Word | null>(null)
  const [conversation, setConversation] = useState<ChatMessage[]>([])
  const [conversationMode, setConversationMode] = useState<AnswerMode | null>(null)

  function reset() {
    setLastQuery('')
    setLastQueryImages([])
    setSourceUrl(null)
    setEntry(null)
    setEntryTags([])
    setDuplicate(null)
    setConversation([])
    setConversationMode(null)
  }

  return (
    <ChatSessionContext.Provider
      value={{
        lastQuery,
        setLastQuery,
        lastQueryImages,
        setLastQueryImages,
        sourceUrl,
        setSourceUrl,
        entry,
        setEntry,
        entryTags,
        setEntryTags,
        duplicate,
        setDuplicate,
        conversation,
        setConversation,
        conversationMode,
        setConversationMode,
        reset,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  )
}
