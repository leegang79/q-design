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
    id: 'siliconflow',
    label: 'SiliconFlow Flux',
    kind: 'image',
    protocol: 'openai-image',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'black-forest-labs/FLUX.1-schnell',
    hint: 'OpenAI 兼容生图。不支持参考图时会退回纯文本'
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
  return ['openai-image', 'gemini-image']
}

export function protocolLabel(protocol: Protocol): string {
  switch (protocol) {
    case 'openai-chat':
      return 'OpenAI 兼容聊天'
    case 'openai-image':
      return 'OpenAI 兼容图像'
    case 'gemini-image':
      return 'Gemini 图像'
  }
}
