// 回答モード（文体・深さの切り替え）。docs/DESIGN.md §4 / §5.1 参照。

export const ANSWER_MODES = ['standard', 'loki', 'gentle', 'kansai', 'expert'] as const

export type AnswerMode = (typeof ANSWER_MODES)[number]

export const ANSWER_MODE_LABELS: Record<AnswerMode, string> = {
  standard: '標準',
  loki: 'ロキ',
  gentle: '優しく',
  kansai: '関西弁',
  expert: 'エキスパート',
}

/** Gemini プロンプトに埋め込む文体・深さの指示。definition と quiz.explanation、継続質問の回答に適用する。 */
export const ANSWER_MODE_INSTRUCTIONS: Record<AnswerMode, string> = {
  standard: '中立で丁寧な解説文。初学者にもわかりやすく書く。',
  loki: '北欧神話のロキのような、狡猾で悪戯好きなトリックスター風。馴れ馴れしく近づいてくる「相棒」のノリで、調子が良くて憎めないが、どこか企んでいそうな含みや皮肉、悪知恵の匂いをにじませる。トラブルを引っ提げて笑顔で現れるようなテンションで軽口や冗談を交えつつも、内容そのものは正確に保つ。',
  gentle:
    'お姉さんが子どもに解説するような、語りかける優しい口調。「〜だよ」「〜してみようね」のように話しかけ、身近な例え話を交えてかみ砕いて説明する。',
  kansai:
    '元気でハキハキした関西弁のお兄さん風の口調。「〜やで」「〜やねん」のようにテンポよく明るく、ときどきツッコミを交えつつも、内容そのものは正確に保つ。',
  expert:
    'その道のエキスパートを読者として想定する。入門的な説明は最小限にし、内部の仕組み・歴史的経緯・周辺技術・エッジケースなど、より詳細でマニア向けの解説に踏み込む。',
}

export function isAnswerMode(value: unknown): value is AnswerMode {
  return typeof value === 'string' && (ANSWER_MODES as readonly string[]).includes(value)
}
