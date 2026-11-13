import type { ModelProfile } from '@shared/types'
import { assertHttpUrl, httpFailure, readErrorMessage, request } from '../http'

type ImageRef = {
  bytes: Buffer
  mime: string
}

export async function geminiGenerate(
  profile: ModelProfile,
  prompt: string,
  reference: ImageRef | null
): Promise<Buffer> {
  const base = assertHttpUrl(profile.baseUrl)
  const model = profile.model.replace(/^models\//, '')
  const parts: Array<Record<string, unknown>> = [{ text: prompt }]
  if (reference) {
    parts.push({
      inlineData: {
        mimeType: reference.mime,
        data: reference.bytes.toString('base64')
      }
    })
  }
  const response = await request(
    `${base}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': profile.apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    },
    180_000
  )
  if (!response.ok) {
    throw httpFailure(response, await readErrorMessage(response), reference !== null)
  }
  return extractGeminiImage(await response.json())
}

export async function testGemini(profile: ModelProfile): Promise<string> {
  const base = assertHttpUrl(profile.baseUrl)
  const model = profile.model.replace(/^models\//, '')
  const response = await request(
    `${base}/models/${encodeURIComponent(model)}`,
    {
      method: 'GET',
      headers: { 'x-goog-api-key': profile.apiKey }
    },
    20_000
  )
  if (!response.ok) {
    throw httpFailure(response, await readErrorMessage(response), false)
  }
  return `模型 ${model} 可访问`
}

function extractGeminiImage(json: unknown): Buffer {
  if (!json || typeof json !== 'object') throw new Error('接口没有返回图片')
  const candidates = (json as { candidates?: Array<{ content?: { parts?: unknown[] } }> }).candidates ?? []
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      const bytes = inlineBytes(part)
      if (bytes) return bytes
    }
  }
  throw new Error('接口没有返回图片')
}

function inlineBytes(part: unknown): Buffer | null {
  if (!part || typeof part !== 'object') return null
  const record = part as {
    inlineData?: { data?: string }
    inline_data?: { data?: string }
  }
  const data = record.inlineData?.data ?? record.inline_data?.data
  if (!data) return null
  return Buffer.from(data, 'base64')
}
