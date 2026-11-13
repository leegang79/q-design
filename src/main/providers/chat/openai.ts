import type { ModelProfile } from '@shared/types'
import { assertHttpUrl, httpFailure, messageText, readErrorMessage, request } from '../http'

export type ChatTurn = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function completeChat(profile: ModelProfile, messages: ChatTurn[]): Promise<string> {
  const base = assertHttpUrl(profile.baseUrl)
  const response = await request(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: profile.model,
        temperature: 0.4,
        messages
      })
    },
    90_000
  )
  if (!response.ok) {
    throw httpFailure(response, await readErrorMessage(response), false)
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const text = messageText(json.choices?.[0]?.message?.content).trim()
  if (!text) throw new ProviderEmptyError()
  return text
}

export async function testChat(profile: ModelProfile): Promise<string> {
  const base = assertHttpUrl(profile.baseUrl)
  const response = await request(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: profile.model,
        temperature: 0,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word OK' }]
      })
    },
    30_000
  )
  if (!response.ok) {
    throw httpFailure(response, await readErrorMessage(response), false)
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  if (!json.choices?.length) throw new ProviderEmptyError()
  return '聊天接口可用'
}

export async function testOpenAiModels(profile: ModelProfile): Promise<string> {
  const base = assertHttpUrl(profile.baseUrl)
  const response = await request(
    `${base}/models`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${profile.apiKey}` }
    },
    20_000
  )
  if (!response.ok) {
    const detail = await readErrorMessage(response)
    if (response.status === 404) {
      throw httpFailure(response, `模型列表接口不可用。${detail}`, false)
    }
    throw httpFailure(response, detail, false)
  }
  const json = (await response.json()) as { data?: Array<{ id?: string }> }
  const ids = (json.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id))
  if (ids.length === 0) {
    return '密钥可用，但模型列表为空。请确认模型名填写正确'
  }
  if (!ids.includes(profile.model)) {
    return `密钥可用，但列表中没有模型 ${profile.model}`
  }
  return `模型 ${profile.model} 可访问`
}

class ProviderEmptyError extends Error {
  constructor() {
    super('接口没有返回可用内容')
    this.name = 'ProviderEmptyError'
  }
}
