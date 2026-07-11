// チャット添付画像の読み込み・縮小（docs/DESIGN.md §4.4）。
// Gemini へは常に縮小後の JPEG（inlineData）として送る。

import type { ChatImage } from '../types'

export const MAX_IMAGES_PER_MESSAGE = 4

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.85

/** 画像ファイルを縮小し、Gemini に渡せる ChatImage（base64 JPEG）に変換する */
export async function fileToChatImage(file: File): Promise<ChatImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`「${file.name}」は画像ファイルではありません。`)
  }
  const dataUrl = await downscaleToJpegDataUrl(file)
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/)
  if (!match) {
    throw new Error(`「${file.name}」の読み込みに失敗しました。`)
  }
  return { mimeType: match[1], data: match[2] }
}

function downscaleToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error(`「${file.name}」の処理に失敗しました。`))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`「${file.name}」を画像として読み込めませんでした。`))
    }
    img.src = objectUrl
  })
}
