import type { ModelProfile } from '@shared/types'
import { DASHSCOPE_IMAGE_MODELS } from '@shared/presets'
import {
  assertHttpUrl,
  bytesFromPayload,
  httpFailure,
  ProviderRequestError,
  readErrorMessage,
  request
} from '../http'

type ImageRef = {
  bytes: Buffer
  mime: string
}

const POLL_INTERVAL_MS = 1_500
const POLL_BUDGET_MS = 180_000
const IN_PROGRESS = new Set(['PENDING', 'RUNNING'])

export async function dashscopeGenerate(
  profile: ModelProfile,
  prompt: string,
  reference: ImageRef | null
): Promise<Buffer> {
  if (reference) {
    throw new ProviderRequestError('万相文生图不接受参考图', null, true)
  }
  const origin = dashscopeOrigin(profile.baseUrl)
  const model = modelName(profile.model)
  const taskId = await submit(origin, profile.apiKey, model, prompt)
  return pollImage(origin, profile.apiKey, taskId)
}

export async function testDashscope(profile: ModelProfile): Promise<string> {
  const origin = dashscopeOrigin(profile.baseUrl)
  const model = modelName(profile.model)
  const response = await request(
    `${origin}/compatible-mode/v1/models`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${profile.apiKey}` }
    },
    20_000
  )
  if (response.status === 401 || response.status === 403) {
    throw httpFailure(response, await readErrorMessage(response), false)
  }
  if (!response.ok && response.status !== 404) {
    throw httpFailure(response, await readErrorMessage(response), false)
  }
  return `密钥可用。将调用 ${model}`
}

async function submit(origin: string, apiKey: string, model: string, prompt: string): Promise<string> {
  const newer = model.startsWith('wan2.6')
  const response = await request(
    `${origin}/api/v1/services/aigc/${newer ? 'image-generation/generation' : 'text2image/image-synthesis'}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify(requestBody(model, prompt, newer))
    },
    60_000
  )
  const json = await readJson(response)
  if (!response.ok) {
    const detail = failureText(json)
    const fallback =
      response.status === 404 ? '万相生图接口不存在，请确认 Base URL 属于当前密钥的地域' : `请求失败（HTTP ${response.status}）`
    throw httpFailure(response, detail || fallback, false)
  }
  const taskId = outputOf(json).task_id
  if (typeof taskId !== 'string' || !taskId.trim()) {
    throw new Error(failureText(json) || '接口没有返回任务')
  }
  return taskId.trim()
}

async function pollImage(origin: string, apiKey: string, taskId: string): Promise<Buffer> {
  const deadline = Date.now() + POLL_BUDGET_MS
  const url = `${origin}/api/v1/tasks/${encodeURIComponent(taskId)}`
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    const response = await request(
      url,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` }
      },
      30_000
    )
    const json = await readJson(response)
    if (!response.ok) throw new Error(failureText(json) || `请求失败（HTTP ${response.status}）`)
    const output = outputOf(json)
    const status = typeof output.task_status === 'string' ? output.task_status : ''
    if (status === 'SUCCEEDED') return bytesFromPayload({ url: sampleUrl(output) })
    if (IN_PROGRESS.has(status) || !status) continue
    throw new Error(failureText(json) || `生图失败（${status}）`)
  }
  throw new Error('生图超时，请稍后再试')
}

function requestBody(model: string, prompt: string, newer: boolean): Record<string, unknown> {
  const size = newer || model.startsWith('wan2.5') ? '1280*1280' : '1024*1024'
  const text = prompt.slice(0, promptLimit(model))
  if (newer) {
    return {
      model,
      input: { messages: [{ role: 'user', content: [{ text }] }] },
      parameters: { size, n: 1, watermark: false }
    }
  }
  return {
    model,
    input: { prompt: text },
    parameters: { size, n: 1, prompt_extend: false, watermark: false }
  }
}

function promptLimit(model: string): number {
  if (model.startsWith('wan2.6')) return 2100
  if (model.startsWith('wan2.5')) return 2000
  if (model.startsWith('wanx2.0')) return 800
  return 500
}

function dashscopeOrigin(baseUrl: string): string {
  return assertHttpUrl(baseUrl)
    .replace(/\/compatible-mode\/v1$/, '')
    .replace(/\/api\/v1$/, '')
}

function modelName(model: string): string {
  const name = model.trim()
  const known = DASHSCOPE_IMAGE_MODELS.some((item) => item.id === name)
  if (!known && !/^wan[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    throw new Error('请从列表中选择万相模型')
  }
  return name
}

function sampleUrl(output: Record<string, unknown>): string {
  const results = Array.isArray(output.results) ? output.results : []
  for (const result of results) {
    if (!result || typeof result !== 'object') continue
    const url = (result as { url?: unknown }).url
    if (typeof url === 'string' && url.startsWith('https://')) return url
  }
  const choices = Array.isArray(output.choices) ? output.choices : []
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue
    const message = (choice as { message?: { content?: unknown } }).message
    const content = Array.isArray(message?.content) ? message.content : []
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const image = (part as { image?: unknown }).image
      if (typeof image === 'string' && image.startsWith('https://')) return image
    }
  }
  throw new Error('接口没有返回图片')
}

function outputOf(json: Record<string, unknown>): Record<string, unknown> {
  const output = json.output
  if (output && typeof output === 'object') return output as Record<string, unknown>
  return json
}

function failureText(json: Record<string, unknown>): string {
  const output = outputOf(json)
  const message = firstText(output.message, json.message)
  const code = firstText(output.code, json.code)
  if (message && code) return `${code}：${message}`
  return message || code
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    const json = JSON.parse(text) as unknown
    if (json && typeof json === 'object') return json as Record<string, unknown>
  } catch {
    return { message: text.replace(/\s+/g, ' ').trim().slice(0, 800) }
  }
  return {}
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
