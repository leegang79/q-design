import { BrowserWindow, ipcMain } from 'electron'
import type { ProfileInput, Protocol, PublicState, StageId } from '@shared/types'
import { runConnectionTest, runGenerateAll, runGenerateStage, runOptimize } from './pipeline'
import {
  createSession,
  deleteProfile,
  deleteSession,
  getPublicState,
  readImageDataUrl,
  saveProfile,
  selectSession,
  sendMessage,
  setActiveModels,
  updateStagePrompt
} from './store'

const PROTOCOLS = new Set<Protocol>(['openai-chat', 'openai-image', 'gemini-image'])
const STAGE_IDS = new Set<StageId>(['sketch', 'render', 'structure', 'exploded'])

export function registerIpc(): void {
  ipcMain.handle('state:get', () => getPublicState())
  ipcMain.handle('profile:save', (_event, input: unknown) => {
    saveProfile(asProfileInput(input))
    return publish()
  })
  ipcMain.handle('profile:delete', (_event, id: unknown) => {
    deleteProfile(asId(id))
    return publish()
  })
  ipcMain.handle('models:active', (_event, input: unknown) => {
    const record = asRecord(input)
    setActiveModels(asNullableId(record.chatProfileId), asNullableId(record.imageProfileId))
    return publish()
  })
  ipcMain.handle('profile:test', (_event, input: unknown) => runConnectionTest(asProfileInput(input)))
  ipcMain.handle('session:create', () => {
    createSession()
    return publish()
  })
  ipcMain.handle('session:select', (_event, id: unknown) => {
    selectSession(asId(id))
    return publish()
  })
  ipcMain.handle('session:delete', (_event, id: unknown) => {
    deleteSession(asId(id))
    return publish()
  })
  ipcMain.handle('chat:send', (_event, sessionId: unknown, content: unknown) => {
    sendMessage(asId(sessionId), asText(content))
    return publish()
  })
  ipcMain.handle('prompts:optimize', async (_event, sessionId: unknown) => {
    await runOptimize(asId(sessionId), publish)
    return getPublicState()
  })
  ipcMain.handle('stage:prompt', (_event, sessionId: unknown, stageId: unknown, prompt: unknown) => {
    updateStagePrompt(asId(sessionId), asStageId(stageId), asText(prompt, true))
    return publish()
  })
  ipcMain.handle('stage:generate', async (_event, sessionId: unknown, stageId: unknown) => {
    await runGenerateStage(asId(sessionId), asStageId(stageId), publish)
    return getPublicState()
  })
  ipcMain.handle('stage:generate-all', async (_event, sessionId: unknown) => {
    await runGenerateAll(asId(sessionId), publish)
    return getPublicState()
  })
  ipcMain.handle('image:read', (_event, relativePath: unknown) => readImageDataUrl(asText(relativePath)))
}

function publish(): PublicState {
  const state = getPublicState()
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('state:updated', state)
  }
  return state
}

function asProfileInput(value: unknown): ProfileInput {
  const record = asRecord(value)
  const kind = record.kind === 'image' ? 'image' : 'chat'
  const protocol = PROTOCOLS.has(record.protocol as Protocol)
    ? (record.protocol as Protocol)
    : kind === 'chat'
      ? 'openai-chat'
      : 'openai-image'
  return {
    id: typeof record.id === 'string' && record.id ? record.id : undefined,
    name: typeof record.name === 'string' ? record.name : '',
    kind,
    protocol,
    baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : '',
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : '',
    model: typeof record.model === 'string' ? record.model : ''
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('参数无效')
  return value as Record<string, unknown>
}

function asId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('参数无效')
  return value
}

function asNullableId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return asId(value)
}

function asStageId(value: unknown): StageId {
  if (typeof value === 'string' && STAGE_IDS.has(value as StageId)) return value as StageId
  throw new Error('找不到这个阶段')
}

function asText(value: unknown, allowEmpty = false): string {
  if (typeof value !== 'string') throw new Error('参数无效')
  if (!allowEmpty && !value.trim()) throw new Error('内容不能为空')
  return value
}
