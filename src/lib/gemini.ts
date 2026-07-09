// Gemini API 連携。docs/DESIGN.md §4 が仕様の正。
// Gemini の呼び出しはこのモジュールのみが行う（CLAUDE.md 絶対ルール5）。

import { ANSWER_MODE_INSTRUCTIONS, type AnswerMode } from './answerMode'
import type { ChatMessage, ChoiceIndex, GeneratedEntry } from '../types'

const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const responseSchema = {
  type: 'OBJECT',
  properties: {
    term: { type: 'STRING' },
    reading: { type: 'STRING' },
    definition: { type: 'STRING' },
    tags: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 3, maxItems: 3 },
    quiz: {
      type: 'OBJECT',
      properties: {
        question: { type: 'STRING' },
        choices: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 4, maxItems: 4 },
        correctIndex: { type: 'INTEGER' },
        explanation: { type: 'STRING' },
      },
      required: ['question', 'choices', 'correctIndex', 'explanation'],
    },
  },
  required: ['term', 'reading', 'definition', 'tags', 'quiz'],
} as const

function entryRequirements(existingTags: string[], mode: AnswerMode): string {
  const existingTagsText = existingTags.length > 0 ? existingTags.join('、') : '（まだ登録されているタグはありません）'
  return `# 出力要件
- term: 調べたい主題を正規化した見出し語（日本語）。
- reading: term のよみがなを**ひらがな**で（例: term「冪等性」→「べきとうせい」、英字語は日本語での読み「PWA」→「ぴーだぶりゅーえー」）。
- definition: term について Markdown 形式で日本語の詳細な解説。見出し(##)や箇条書きを活用する。文体・深さは下記「回答モード」に従う。
- tags: term のジャンルを表す日本語タグをちょうど3つ。以下の既存タグ一覧に近いものがあれば表記揺れを防ぐため必ず再利用すること。
  既存タグ一覧: ${existingTagsText}
- quiz: 応用情報技術者試験の午前試験に似た、知識の理解を問う4択問題を1問。
  - question: 問題文
  - choices: もっともらしい誤答を含む4つの選択肢（ちょうど4つ）
  - correctIndex: 正解の choices 内での添字（0〜3の整数）
  - explanation: 正解の根拠と、誤答がそれぞれ誤りである理由を含む詳しい解説（Markdown）。文体は下記「回答モード」に従う。

# 回答モード（definition と quiz.explanation の文体にのみ適用する。term / reading / tags / question / choices は中立のまま）
${ANSWER_MODE_INSTRUCTIONS[mode]}
`
}

function buildPrompt(input: string, existingTags: string[], mode: AnswerMode): string {
  return `あなたは日本語の学習支援AIです。以下の入力から調べたい主題を特定し、共有辞書用のエントリを1件生成してください。
入力は単語そのものの場合も、「〜について教えて」のような文の場合も、URLやテキストの場合もあります。

# 入力
${input}

${entryRequirements(existingTags, mode)}`
}

function buildConversationEntryPrompt(history: ChatMessage[], existingTags: string[], mode: AnswerMode): string {
  const transcript = history.map((m) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.text}`).join('\n\n')
  return `あなたは日本語の学習支援AIです。以下はユーザーとAIの会話です。会話の**最後の質問とその回答**で扱われた主題を特定し、共有辞書用のエントリを1件生成してください。
definition は最後の回答の内容を核にしつつ、この会話を読んでいない人でも単体で理解できる解説に再構成してください。

# 会話
${transcript}

${entryRequirements(existingTags, mode)}`
}

function isChoiceIndex(value: unknown): value is ChoiceIndex {
  return value === 0 || value === 1 || value === 2 || value === 3
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isStringArrayOfLength(value: unknown, length: number): value is string[] {
  return Array.isArray(value) && value.length === length && value.every(isNonEmptyString)
}

export function isGeneratedEntry(value: unknown): value is GeneratedEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!isNonEmptyString(v.term)) return false
  if (!isNonEmptyString(v.reading)) return false
  if (!isNonEmptyString(v.definition)) return false
  if (!isStringArrayOfLength(v.tags, 3)) return false

  if (typeof v.quiz !== 'object' || v.quiz === null) return false
  const q = v.quiz as Record<string, unknown>
  if (!isNonEmptyString(q.question)) return false
  if (!isStringArrayOfLength(q.choices, 4)) return false
  if (!isChoiceIndex(q.correctIndex)) return false
  if (!isNonEmptyString(q.explanation)) return false

  return true
}

export async function generateEntry(
  input: string,
  apiKey: string,
  existingTags: string[],
  mode: AnswerMode,
): Promise<GeneratedEntry> {
  return requestGeneratedEntry(buildPrompt(input, existingTags, mode), apiKey)
}

/**
 * 継続質問の回答から辞書エントリを生成する（docs/DESIGN.md §4.3）。
 * history は会話の先頭から対象の model 回答までを渡す（末尾が対象の回答）。
 */
export async function generateEntryFromConversation(
  history: ChatMessage[],
  apiKey: string,
  existingTags: string[],
  mode: AnswerMode,
): Promise<GeneratedEntry> {
  return requestGeneratedEntry(buildConversationEntryPrompt(history, existingTags, mode), apiKey)
}

async function requestGeneratedEntry(promptText: string, apiKey: string): Promise<GeneratedEntry> {
  let response: Response
  try {
    response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    })
  } catch (e) {
    console.error('[gemini] ネットワークエラー', e)
    throw new Error('Gemini APIに接続できませんでした。ネットワーク接続を確認してください。', { cause: e })
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    console.error('[gemini] APIエラー', response.status, bodyText)
    if (response.status === 400 || response.status === 403) {
      throw new Error('Gemini APIキーが無効です。設定画面でキーを確認してください。')
    }
    throw new Error(`Gemini APIの呼び出しに失敗しました（HTTP ${response.status}）。`)
  }

  const json: unknown = await response.json()
  const text = extractResponseText(json)
  if (text === null) {
    console.error('[gemini] 応答にテキストが含まれていません', json)
    throw new Error('Gemini APIの応答が空でした。')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    console.error('[gemini] JSONパースに失敗', text, e)
    throw new Error('Gemini APIの応答をJSONとして解釈できませんでした。', { cause: e })
  }

  if (!isGeneratedEntry(parsed)) {
    console.error('[gemini] 応答が期待した形式ではありません', parsed)
    throw new Error('Gemini APIの応答が期待した形式ではありませんでした（選択肢が4つでない等）。')
  }

  return parsed
}

/**
 * 継続質問（docs/DESIGN.md §4.1）。history の末尾は必ず role: 'user'（今回の質問）。
 * 会話の最初の model ターンには definition の Markdown テキストを入れる想定（呼び出し側の責務）。
 * responseSchema は使わず、自由な Markdown テキストをそのまま返す。自動リトライはしない。
 */
export async function generateFollowUp(history: ChatMessage[], apiKey: string, mode: AnswerMode): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `直前までの解説の文脈を踏まえ、日本語の Markdown で簡潔に回答せよ。回答の文体: ${ANSWER_MODE_INSTRUCTIONS[mode]}`,
            },
          ],
        },
        contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      }),
    })
  } catch (e) {
    console.error('[gemini] ネットワークエラー', e)
    throw new Error('Gemini APIに接続できませんでした。ネットワーク接続を確認してください。', { cause: e })
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    console.error('[gemini] APIエラー', response.status, bodyText)
    if (response.status === 400 || response.status === 403) {
      throw new Error('Gemini APIキーが無効です。設定画面でキーを確認してください。')
    }
    throw new Error(`Gemini APIの呼び出しに失敗しました（HTTP ${response.status}）。`)
  }

  const json: unknown = await response.json()
  const text = extractResponseText(json)
  if (text === null) {
    console.error('[gemini] 応答にテキストが含まれていません', json)
    throw new Error('Gemini APIの応答が空でした。')
  }
  return text
}

function extractResponseText(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null
  const candidates = (json as Record<string, unknown>).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  const content = (candidates[0] as Record<string, unknown>)?.content
  const parts = (content as Record<string, unknown>)?.parts
  if (!Array.isArray(parts) || parts.length === 0) return null
  const text = (parts[0] as Record<string, unknown>)?.text
  return typeof text === 'string' ? text : null
}
