import type { ModelProfile } from '@shared/types'
import { assertHttpUrl, bytesFromPayload, httpFailure, readErrorMessage, request } from '../http'

type ImageRef = {
  bytes: Buffer
  mime: string
}

const POLL_INTERVAL_MS = 1_500
const POLL_BUDGET_MS = 180_000
const IN_PROGRESS = new Set(['Pending', 'Reasoning', 'Generating', 'Queued', 'Processing'])

export async function bflGenerate(
  profile: ModelProfile,
  prompt: string,
  reference: ImageRef | null
): Promise<Buffer> {
  const pollingUrl = await submit(profile, prompt, reference)
  return pollImage(profile.apiKey, pollingUrl)
}

export async function testBfl(profile: ModelProfile): Promise<string> {
  const base = bflOrigin(profile.baseUrl)
  const model = endpointName(profile.model)
  const response = await request(
    `${base}/v1/credits`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-key': profile.apiKey
      }
    },
    20_000
  )
  if (!response.ok) {
    throw httpFailure(response, await readErrorMessage(response), false)
  }
  const credits = readCredits(await response.json())
  const balance = credits === null ? '密钥可用' : `密钥可用，剩余额度 ${credits}`
  return `${balance}。将调用 ${model}`
}

async function submit(profile: ModelProfile, prompt: string, reference: ImageRef | null): Promise<string> {
  const base = bflOrigin(profile.baseUrl)
  const model = endpointName(profile.model)
  const response = await request(
    `${base}/v1/${model}`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'x-key': profile.apiKey
      },
      body: JSON.stringify(requestBody(model, prompt, reference))
    },
    60_000
  )
  if (!response.ok) {
    throw httpFailure(response, await readErrorMessage(response), reference !== null)
  }
  const json = (await response.json()) as { polling_url?: unknown }
  return assertPollUrl(json.polling_url)
}

async function pollImage(apiKey: string, pollingUrl: string): Promise<Buffer> {
  const deadline = Date.now() + POLL_BUDGET_MS
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    const response = await request(
      pollingUrl,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-key': apiKey
        }
      },
      30_000
    )
    const json = await readJson(response)
    const status = typeof json.status === 'string' ? json.status : ''
    if (!response.ok && !status) {
      throw new Error(json.errorText || `请求失败（HTTP ${response.status}）`)
    }
    if (status === 'Ready') {
      const sample = sampleUrl(json.result)
      return bytesFromPayload({ url: sample })
    }
    if (IN_PROGRESS.has(status) || !status) continue
    throw failureStatus(status, json)
  }
  throw new Error('生图超时，请稍后再试')
}

function requestBody(model: string, prompt: string, reference: ImageRef | null): Record<string, unknown> {
  const image = reference ? reference.bytes.toString('base64') : null
  if (model.startsWith('flux-3')) {
    const body: Record<string, unknown> = {
      prompt,
      aspect_ratio: '1:1',
      resolution: '1k'
    }
    if (!model.includes('klein')) body.grounding = false
    if (image) body.images = [image]
    return body
  }
  if (model.startsWith('flux-kontext')) {
    return {
      prompt,
      aspect_ratio: '1:1',
      output_format: 'png',
      ...(image ? { input_image: image } : {})
    }
  }
  if (model.includes('ultra')) {
    return {
      prompt,
      aspect_ratio: '1:1',
      output_format: 'png',
      ...(image ? { image_prompt: image } : {})
    }
  }
  if (model.startsWith('flux-pro') || model.startsWith('flux-dev')) {
    return {
      prompt,
      width: 1024,
      height: 1024,
      output_format: 'png',
      ...(image ? { image_prompt: image } : {})
    }
  }
  return {
    prompt,
    width: 1024,
    height: 1024,
    output_format: 'png',
    ...(image ? { input_image: image } : {})
  }
}

function bflOrigin(baseUrl: string): string {
  return assertHttpUrl(baseUrl).replace(/\/v1$/, '')
}

function endpointName(model: string): string {
  const name = model.trim().replace(/^\/+/, '').replace(/^v1\//, '')
  if (!/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)?$/i.test(name)) {
    throw new Error('模型名需要是 BFL 端点，例如 flux-3-image')
  }
  return name
}

function assertPollUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('接口没有返回轮询地址')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('轮询地址无效')
  }
  const host = url.hostname.toLowerCase()
  const allowed = host === 'bfl.ai' || host.endsWith('.bfl.ai') || host === 'bfl.ml' || host.endsWith('.bfl.ml')
  if (url.protocol !== 'https:' || !allowed) throw new Error('轮询地址不在 BFL 域名上')
  return url.toString()
}

function sampleUrl(result: unknown): string {
  if (!result || typeof result !== 'object') throw new Error('接口没有返回图片')
  const sample = (result as { sample?: unknown }).sample
  if (typeof sample !== 'string' || !sample.trim()) throw new Error('接口没有返回图片')
  let url: URL
  try {
    url = new URL(sample)
  } catch {
    throw new Error('图片地址无效')
  }
  if (url.protocol !== 'https:') throw new Error('图片地址无效')
  return url.toString()
}

function failureStatus(status: string, json: { details?: unknown }): Error {
  const detail = detailText(json.details)
  if (status === 'Request Moderated' || status === 'Content Moderated') {
    return new Error(detail ? `内容被拦截：${detail}` : '内容被拦截')
  }
  if (status === 'Task not found') return new Error('生图任务已过期，请重新生成')
  return new Error(detail ? `生图失败：${detail}` : `生图失败（${status}）`)
}

function detailText(details: unknown): string {
  if (typeof details === 'string') return details.trim()
  if (!details || typeof details !== 'object') return ''
  const record = details as { message?: unknown; error?: unknown }
  if (typeof record.message === 'string') return record.message.trim()
  if (typeof record.error === 'string') return record.error.trim()
  return ''
}

function readCredits(json: unknown): number | null {
  if (!json || typeof json !== 'object') return null
  const credits = (json as { credits?: unknown }).credits
  return typeof credits === 'number' && Number.isFinite(credits) ? credits : null
}

async function readJson(
  response: Response
): Promise<{ status?: unknown; result?: unknown; details?: unknown; errorText: string }> {
  const text = await response.text()
  try {
    const json = JSON.parse(text) as { status?: unknown; result?: unknown; details?: unknown }
    return { ...json, errorText: messageFromBody(text) }
  } catch {
    const compact = text.replace(/\s+/g, ' ').trim().slice(0, 800)
    if (!response.ok) return { errorText: compact || `请求失败（HTTP ${response.status}）` }
    throw new Error('接口没有返回结果')
  }
}

function messageFromBody(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim().slice(0, 800)
  try {
    const json = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown }
    if (typeof json.detail === 'string' && json.detail.trim()) return json.detail.trim()
    if (typeof json.message === 'string' && json.message.trim()) return json.message.trim()
    if (typeof json.error === 'string' && json.error.trim()) return json.error.trim()
  } catch {
    return compact
  }
  return compact
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
