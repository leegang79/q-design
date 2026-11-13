export class ProviderRequestError extends Error {
  readonly status: number | null
  readonly retryWithoutReference: boolean

  constructor(message: string, status: number | null, retryWithoutReference: boolean) {
    super(message)
    this.name = 'ProviderRequestError'
    this.status = status
    this.retryWithoutReference = retryWithoutReference
  }
}

export function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function assertHttpUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new ProviderRequestError('Base URL 不是有效地址', null, false)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ProviderRequestError('Base URL 只支持 http 或 https', null, false)
  }
  return trimBase(parsed.toString())
}

export async function request(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知网络错误'
    throw new ProviderRequestError(`网络请求失败：${detail}`, null, false)
  }
}

export async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  const compact = text.replace(/\s+/g, ' ').trim().slice(0, 800)
  if (!compact) return `请求失败（HTTP ${response.status}）`
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string } | string
      message?: string
    }
    if (typeof json.error === 'string' && json.error.trim()) return json.error.trim()
    if (json.error && typeof json.error === 'object' && json.error.message) return json.error.message
    if (typeof json.message === 'string' && json.message.trim()) return json.message.trim()
  } catch {
    return compact
  }
  return compact
}

export function httpFailure(response: Response, message: string, allowReferenceFallback: boolean): ProviderRequestError {
  const retry =
    allowReferenceFallback &&
    response.status !== 401 &&
    response.status !== 403 &&
    response.status !== 429
  return new ProviderRequestError(`请求失败（HTTP ${response.status}）：${message}`, response.status, retry)
}

export function canFallback(error: unknown): boolean {
  return error instanceof ProviderRequestError && error.retryWithoutReference
}

export function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text
        }
        return ''
      })
      .join('')
  }
  return ''
}

export function sniffImage(bytes: Buffer): { ext: 'png' | 'jpg' | 'webp'; mime: string } {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return { ext: 'jpg', mime: 'image/jpeg' }
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' }
  }
  return { ext: 'png', mime: 'image/png' }
}

export async function bytesFromPayload(payload: { b64?: string; url?: string }): Promise<Buffer> {
  if (payload.b64) return Buffer.from(payload.b64, 'base64')
  if (!payload.url) throw new ProviderRequestError('接口没有返回图片', null, false)
  const response = await request(payload.url, { method: 'GET' }, 60_000)
  if (!response.ok) {
    throw new ProviderRequestError(`下载图片失败（HTTP ${response.status}）`, response.status, false)
  }
  return Buffer.from(await response.arrayBuffer())
}
