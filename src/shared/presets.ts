import type { ModelKind, Protocol } from './types'

export type ModelPreset = {
  id: string
  label: string
  kind: ModelKind
  protocol: Protocol
  baseUrl: string
  model: string
  hint: string
}

export type ModelChoice = {
  id: string
  label: string
}

export const DASHSCOPE_IMAGE_MODELS: ModelChoice[] = [
  { id: 'wan2.2-t2i-flash', label: '万相 2.2 极速 · wan2.2-t2i-flash' },
  { id: 'wan2.2-t2i-plus', label: '万相 2.2 专业 · wan2.2-t2i-plus' },
  { id: 'wan2.5-t2i-preview', label: '万相 2.5 · wan2.5-t2i-preview' },
  { id: 'wan2.6-t2i', label: '万相 2.6 · wan2.6-t2i' },
  { id: 'wanx2.1-t2i-turbo', label: '万相 2.1 极速 · wanx2.1-t2i-turbo' },
  { id: 'wanx2.1-t2i-plus', label: '万相 2.1 专业 · wanx2.1-t2i-plus' },
  { id: 'wanx2.0-t2i-turbo', label: '万相 2.0 极速 · wanx2.0-t2i-turbo' }
]

export function modelChoices(protocol: Protocol): ModelChoice[] | null {
  if (protocol === 'dashscope-image') return DASHSCOPE_IMAGE_MODELS
  return null
}

export function isDashscopeHost(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl.trim()).hostname.toLowerCase()
    return host === 'dashscope.aliyuncs.com' || host === 'dashscope-intl.aliyuncs.com' || host.endsWith('.maas.aliyuncs.com')
  } catch {
    return false
  }
}

export function dashscopeImageBase(baseUrl: string): string {
  const fallback = 'https://dashscope.aliyuncs.com'
  try {
    const url = new URL(baseUrl.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback
    let path = url.pathname.replace(/\/+$/, '')
    if (path.endsWith('/compatible-mode/v1')) path = path.slice(0, -'/compatible-mode/v1'.length)
    if (path.endsWith('/api/v1')) path = path.slice(0, -'/api/v1'.length)
    path = path.replace(/\/+$/, '')
    return path ? `${url.origin}${path}` : url.origin
  } catch {
    return fallback
  }
}

export function dashscopeImageModel(model: string): string {
  const name = model.trim()
  if (DASHSCOPE_IMAGE_MODELS.some((item) => item.id === name)) return name
  if (/^wan[a-z0-9][a-z0-9._-]*$/i.test(name)) return name
  return 'wan2.2-t2i-flash'
}

export function coerceDashscopeImage<T extends { kind: string; protocol: Protocol; baseUrl: string; model: string }>(
  profile: T
): T {
  if (profile.kind !== 'image') return profile
  if (profile.protocol !== 'openai-image' && profile.protocol !== 'dashscope-image') return profile
  const onDashscope = isDashscopeHost(profile.baseUrl)
  if (profile.protocol !== 'dashscope-image' && !onDashscope) return profile
  return {
    ...profile,
    protocol: 'dashscope-image',
    baseUrl: dashscopeImageBase(onDashscope ? profile.baseUrl : 'https://dashscope.aliyuncs.com'),
    model: dashscopeImageModel(profile.model)
  }
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'openai-chat',
    label: 'OpenAI',
    kind: 'chat',
    protocol: 'openai-chat',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1',
    hint: '聊天补全，兼容 /chat/completions'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'chat',
    protocol: 'openai-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    hint: 'OpenAI 兼容聊天'
  },
  {
    id: 'qwen',
    label: '通义千问',
    kind: 'chat',
    protocol: 'openai-chat',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    hint: 'DashScope 兼容模式'
  },
  {
    id: 'kimi',
    label: 'Kimi',
    kind: 'chat',
    protocol: 'openai-chat',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-128k',
    hint: 'Moonshot OpenAI 兼容'
  },
  {
    id: 'glm',
    label: '智谱 GLM',
    kind: 'chat',
    protocol: 'openai-chat',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    hint: 'BigModel 兼容接口'
  },
  {
    id: 'custom-chat',
    label: '自定义聊天',
    kind: 'chat',
    protocol: 'openai-chat',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    hint: '任何 OpenAI 兼容聊天接口'
  },
  {
    id: 'openai-image',
    label: 'OpenAI 图像',
    kind: 'image',
    protocol: 'openai-image',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-image-1',
    hint: '图像生成与带参考图的编辑'
  },
  {
    id: 'dashscope-image',
    label: '阿里云万相',
    kind: 'image',
    protocol: 'dashscope-image',
    baseUrl: 'https://dashscope.aliyuncs.com',
    model: 'wan2.2-t2i-flash',
    hint: '文生图。从列表选择，不依赖兼容模式的模型列表'
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow Flux',
    kind: 'image',
    protocol: 'openai-image',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'black-forest-labs/FLUX.1-schnell',
    hint: 'OpenAI 兼容生图。不支持参考图时会退回纯文本'
  },
  {
    id: 'bfl',
    label: 'Black Forest Labs',
    kind: 'image',
    protocol: 'bfl-image',
    baseUrl: 'https://api.bfl.ai',
    model: 'flux-3-image',
    hint: '官方 Flux。模型名即端点，提交后轮询取图'
  },
  {
    id: 'custom-image',
    label: '自定义图像',
    kind: 'image',
    protocol: 'openai-image',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    hint: '兼容 /images/generations 的接口'
  },
  {
    id: 'gemini-image',
    label: 'Gemini 图像',
    kind: 'image',
    protocol: 'gemini-image',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash-image',
    hint: 'generateContent，可带上一阶段参考图'
  }
]

export function protocolsForKind(kind: ModelKind): Protocol[] {
  if (kind === 'chat') return ['openai-chat']
  return ['openai-image', 'gemini-image', 'bfl-image', 'dashscope-image']
}

export function protocolLabel(protocol: Protocol): string {
  switch (protocol) {
    case 'openai-chat':
      return 'OpenAI 兼容聊天'
    case 'openai-image':
      return 'OpenAI 兼容图像'
    case 'gemini-image':
      return 'Gemini 图像'
    case 'bfl-image':
      return 'Black Forest Labs'
    case 'dashscope-image':
      return '阿里云万相'
  }
}
