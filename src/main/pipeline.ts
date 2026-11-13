import {
  fallbackPrompt,
  optimizeClosingMessage,
  OPTIMIZE_SYSTEM_PROMPT,
  referencePrompt,
  summaryFromOptimize
} from '@shared/prompt'
import { parseOptimizeResult } from '@shared/parse'
import { STAGES } from '@shared/stages'
import type { ConnectionTestResult, ModelProfile, ProfileInput, StageId } from '@shared/types'
import { completeChat, testChat, testOpenAiModels } from './providers/chat/openai'
import { generateImage } from './providers/image/generate'
import { testGemini } from './providers/image/gemini'
import {
  applyOptimizeResult,
  getPublicState,
  getSession,
  isBusy,
  markOptimizeFailure,
  markOptimizeStart,
  markStageResult,
  markStageStart,
  previousImagePath,
  readReference,
  requireProfile,
  resolveProfileInput,
  saveImageFile,
  setBoardError,
  setBusy
} from './store'

export async function runOptimize(sessionId: string, publish: () => void): Promise<void> {
  if (isBusy()) throw new Error('有任务正在进行，请稍候')
  const profile = requireProfile(getPublicState().activeChatProfileId, 'chat')
  const session = markOptimizeStart(sessionId)
  setBusy(sessionId, 'optimize')
  publish()
  try {
    const raw = await completeChat(profile, [
      { role: 'system', content: OPTIMIZE_SYSTEM_PROMPT },
      ...session.messages.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user', content: optimizeClosingMessage() }
    ])
    const parsed = parseOptimizeResult(raw)
    if (!parsed.ok) {
      markOptimizeFailure(sessionId, parsed.error, parsed.raw)
      return
    }
    applyOptimizeResult(sessionId, parsed.result, summaryFromOptimize(parsed.result))
  } catch (error) {
    markOptimizeFailure(sessionId, errorText(error), '')
  } finally {
    setBusy(null, null)
    publish()
  }
}

export async function runGenerateStage(sessionId: string, stageId: StageId, publish: () => void): Promise<void> {
  if (isBusy()) throw new Error('有任务正在进行，请稍候')
  setBusy(sessionId, 'generate')
  publish()
  try {
    await generateOne(sessionId, stageId, publish)
  } finally {
    setBusy(null, null)
    publish()
  }
}

export async function runGenerateAll(sessionId: string, publish: () => void): Promise<void> {
  if (isBusy()) throw new Error('有任务正在进行，请稍候')
  setBusy(sessionId, 'generate')
  publish()
  try {
    for (const stage of STAGES) {
      const failed = await generateOne(sessionId, stage.id, publish)
      if (failed) break
    }
  } finally {
    setBusy(null, null)
    publish()
  }
}

export async function runConnectionTest(input: ProfileInput): Promise<ConnectionTestResult> {
  try {
    const profile = resolveProfileInput(input)
    return { ok: true, message: await testProfile(profile) }
  } catch (error) {
    return { ok: false, message: errorText(error) }
  }
}

async function generateOne(sessionId: string, stageId: StageId, publish: () => void): Promise<boolean> {
  try {
    requireProfile(getPublicState().activeImageProfileId, 'image')
    markStageStart(sessionId, stageId)
  } catch (error) {
    const message = errorText(error)
    try {
      markStageResult(sessionId, stageId, null, message)
    } catch {
      setBoardError(sessionId, message)
    }
    publish()
    return true
  }

  publish()
  try {
    const profile = requireProfile(getPublicState().activeImageProfileId, 'image')
    const session = getSession(sessionId)
    const referencePath = previousImagePath(session, stageId)
    const reference = referencePath ? readReference(referencePath) : null
    const prompt = reference ? referencePrompt(session, stageId) : fallbackPrompt(session, stageId)
    const bytes = await generateImage(profile, prompt, fallbackPrompt(session, stageId), reference)
    markStageResult(sessionId, stageId, saveImageFile(bytes), null)
    publish()
    return false
  } catch (error) {
    markStageResult(sessionId, stageId, null, errorText(error))
    publish()
    return true
  }
}

async function testProfile(profile: ModelProfile): Promise<string> {
  if (profile.protocol === 'openai-chat') return testChat(profile)
  if (profile.protocol === 'openai-image') return testOpenAiModels(profile)
  if (profile.protocol === 'gemini-image') return testGemini(profile)
  throw new Error('不支持的协议')
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return '操作失败'
}
