import { afterEach, describe, expect, it, vi } from 'vitest'
import { ANSWER_MODE_INSTRUCTIONS } from './answerMode'
import { generateEntryFromConversation, generateFollowUp, isGeneratedEntry } from './gemini'

function validEntry() {
  return {
    term: 'PWA',
    reading: 'ぴーだぶりゅーえー',
    definition: '## 概要\nPWAとは...',
    tags: ['ウェブ', '技術', 'モバイル'],
    quiz: {
      question: 'PWAとは何の略か？',
      choices: ['Progressive Web App', 'Public Web API', 'Personal Web Area', 'Private Web Access'],
      correctIndex: 0,
      explanation: '正解はProgressive Web Appです。',
    },
  }
}

describe('isGeneratedEntry', () => {
  it('全フィールドが揃っていれば true を返す', () => {
    expect(isGeneratedEntry(validEntry())).toBe(true)
  })

  it('reading を欠いた応答は false を返す（型ガードで拒否される）', () => {
    const entry = validEntry() as Record<string, unknown>
    delete entry.reading
    expect(isGeneratedEntry(entry)).toBe(false)
  })

  it('reading が空文字の応答は false を返す', () => {
    const entry = validEntry()
    expect(isGeneratedEntry({ ...entry, reading: '' })).toBe(false)
  })

  it('choices が4つでない応答は false を返す', () => {
    const entry = validEntry()
    entry.quiz.choices = entry.quiz.choices.slice(0, 3) as unknown as typeof entry.quiz.choices
    expect(isGeneratedEntry(entry)).toBe(false)
  })
})

describe('generateFollowUp', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('role付き履歴をそのまま contents に渡し、応答テキストを返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '追加の回答です' }] } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const history = [
      { role: 'model' as const, text: '初回のdefinition' },
      { role: 'user' as const, text: '追加の質問' },
    ]
    const answer = await generateFollowUp(history, 'dummy-key', 'standard')

    expect(answer).toBe('追加の回答です')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.contents).toEqual([
      { role: 'model', parts: [{ text: '初回のdefinition' }] },
      { role: 'user', parts: [{ text: '追加の質問' }] },
    ])
    expect(body.generationConfig).toBeUndefined()
  })

  it('回答モードの文体指示を systemInstruction に含める', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'せやで' }] } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await generateFollowUp([{ role: 'user', text: '質問' }], 'dummy-key', 'kansai')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.systemInstruction.parts[0].text).toContain(ANSWER_MODE_INSTRUCTIONS.kansai)
  })

  it('HTTPエラー時は日本語エラーを投げる（自動リトライしない）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' }),
    )
    await expect(
      generateFollowUp([{ role: 'user', text: '質問' }], 'dummy-key', 'standard'),
    ).rejects.toThrow('Gemini APIの呼び出しに失敗しました')
  })
})

describe('generateEntryFromConversation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('会話全文をプロンプトに含め、responseSchema 付きで構造化エントリを受け取る', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(validEntry()) }] } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const history = [
      { role: 'model' as const, text: '初回のdefinition' },
      { role: 'user' as const, text: 'Service Workerって何？' },
      { role: 'model' as const, text: 'Service Workerとは...' },
    ]
    const result = await generateEntryFromConversation(history, 'dummy-key', ['ウェブ'], 'standard')

    expect(result.term).toBe('PWA')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const prompt = body.contents[0].parts[0].text
    expect(prompt).toContain('ユーザー: Service Workerって何？')
    expect(prompt).toContain('AI: Service Workerとは...')
    expect(prompt).toContain('既存タグ一覧: ウェブ')
    expect(body.generationConfig.responseSchema).toBeDefined()
  })
})
