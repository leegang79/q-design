import { STAGES } from './stages'
import type { OptimizeResult, StageId } from './types'

const STAGE_IDS = new Set<StageId>(STAGES.map((stage) => stage.id))

export function parseOptimizeResult(
  raw: string
): { ok: true; result: OptimizeResult } | { ok: false; error: string; raw: string } {
  const text = raw.trim()
  if (!text) {
    return { ok: false, error: '模型没有返回内容', raw: text }
  }

  const parsed = parseJsonObject(text)
  if (!parsed) {
    return { ok: false, error: '模型返回的内容不是有效 JSON', raw: text }
  }

  const productName = readString(parsed.productName) || '未命名产品'
  const designBrief = readString(parsed.designBrief)
  const stagesRaw = Array.isArray(parsed.stages) ? parsed.stages : []
  const prompts = new Map<StageId, string>()

  for (const item of stagesRaw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const id = record.id
    if (typeof id !== 'string' || !STAGE_IDS.has(id as StageId)) continue
    prompts.set(id as StageId, readString(record.prompt))
  }

  if (prompts.size === 0) {
    return { ok: false, error: 'JSON 中没有可用的阶段提示词', raw: text }
  }

  return {
    ok: true,
    result: {
      productName,
      designBrief,
      stages: STAGES.map((stage) => ({
        id: stage.id,
        title: stage.title,
        prompt: prompts.get(stage.id) ?? ''
      }))
    }
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? text).trim()
  const direct = tryParse(candidate)
  if (direct) return direct
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) return tryParse(candidate.slice(start, end + 1))
  return null
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function maskSecret(secret: string): string {
  const trimmed = secret.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 8) return '••••••••'
  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`
}

export function isMaskedSecret(value: string): boolean {
  return value.includes('••••')
}
