import { coerceDashscopeImage } from '@shared/presets'
import type { ModelProfile } from '@shared/types'
import { canFallback } from '../http'
import { bflGenerate } from './bfl'
import { dashscopeGenerate } from './dashscope'
import { geminiGenerate } from './gemini'
import { openAiEdit, openAiGenerate } from './openai'

export type ImageReference = {
  bytes: Buffer
  mime: string
}

export async function generateImage(
  profile: ModelProfile,
  prompt: string,
  fallback: string,
  reference: ImageReference | null
): Promise<Buffer> {
  profile = coerceDashscopeImage(profile)
  if (profile.protocol === 'gemini-image') {
    if (!reference) return geminiGenerate(profile, prompt, null)
    try {
      return await geminiGenerate(profile, prompt, reference)
    } catch (error) {
      if (!canFallback(error)) throw error
      return geminiGenerate(profile, fallback, null)
    }
  }

  if (profile.protocol === 'dashscope-image') {
    if (!reference) return dashscopeGenerate(profile, prompt, null)
    try {
      return await dashscopeGenerate(profile, prompt, reference)
    } catch (error) {
      if (!canFallback(error)) throw error
      return dashscopeGenerate(profile, fallback, null)
    }
  }

  if (profile.protocol === 'bfl-image') {
    if (!reference) return bflGenerate(profile, prompt, null)
    try {
      return await bflGenerate(profile, prompt, reference)
    } catch (error) {
      if (!canFallback(error)) throw error
      return bflGenerate(profile, fallback, null)
    }
  }

  if (profile.protocol === 'openai-image') {
    if (!reference) return openAiGenerate(profile, prompt)
    try {
      return await openAiEdit(profile, prompt, reference)
    } catch (error) {
      if (!canFallback(error)) throw error
      return openAiGenerate(profile, fallback)
    }
  }

  throw new Error(`当前配置不是生图模型：${profile.protocol}`)
}
