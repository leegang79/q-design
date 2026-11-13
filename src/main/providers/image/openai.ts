import type { ModelProfile } from '@shared/types'
import { assertHttpUrl, bytesFromPayload, httpFailure, readErrorMessage, request } from '../http'

type ImageRef = {
  bytes: Buffer
  mime: string
}

export async function openAiGenerate(profile: ModelProfile, prompt: string): Promise<Buffer> {
  const base = assertHttpUrl(profile.baseUrl)
  const silicon = isSiliconFlow(profile.baseUrl)
  const body = silicon
    ? {
        model: profile.model,
        prompt,
        image_size: '1024x1024',
        batch_size: 1
      }
    : {
        model: profile.model,
        prompt,
        n: 1,
        size: '1024x1024'
      }
  const response = await request(
    `${base}/images/generations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    },
    180_000
  )
  if (!response.ok) {
    throw httpFailure(response, await readErrorMessage(response), false)
  }
  return bytesFromPayload(extractImage(await response.json()))
}

export async function openAiEdit(profile: ModelProfile, prompt: string, reference: ImageRef): Promise<Buffer> {
  const base = assertHttpUrl(profile.baseUrl)
  const form = new FormData()
  form.append('model', profile.model)
  form.append('prompt', prompt)
  form.append('size', '1024x1024')
  form.append('image', new Blob([new Uint8Array(reference.bytes)], { type: reference.mime }), 'reference.png')
  const response = await request(
    `${base}/images/edits`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${profile.apiKey}` },
      body: form
    },
    180_000
  )
  if (!response.ok) {
    throw httpFailure(response, await readErrorMessage(response), true)
  }
  return bytesFromPayload(extractImage(await response.json()))
}

function isSiliconFlow(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes('siliconflow')
}

function extractImage(json: unknown): { b64?: string; url?: string } {
  if (!json || typeof json !== 'object') {
    throw new Error('接口没有返回图片')
  }
  const record = json as {
    data?: Array<{ b64_json?: string; url?: string }>
    images?: Array<{ b64_json?: string; url?: string }>
  }
  const item = record.data?.[0] ?? record.images?.[0]
  if (!item) throw new Error('接口没有返回图片')
  if (item.b64_json) return { b64: item.b64_json }
  if (item.url) return { url: item.url }
  throw new Error('接口没有返回图片')
}
