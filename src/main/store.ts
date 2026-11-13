import { isAbsolute, join, relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { app } from 'electron'
import Store from 'electron-store'
import { isMaskedSecret, maskSecret } from '@shared/parse'
import { protocolsForKind } from '@shared/presets'
import { createEmptyStages, STAGES, stageIndex } from '@shared/stages'
import type {
  DesignSession,
  ModelKind,
  ModelProfile,
  PersistedState,
  ProfileInput,
  Protocol,
  PublicProfile,
  PublicState,
  StageId,
  StageState
} from '@shared/types'
import { sniffImage } from './providers/http'

type StoreShape = PersistedState

let store: Store<StoreShape> | null = null
let busySessionId: string | null = null
let busyAction: PublicState['busyAction'] = null

export function initStore(): void {
  store = new Store<StoreShape>({
    name: 'q-design',
    defaults: emptyPersisted()
  })
  const state = readState()
  let changed = false
  if (state.sessions.length === 0) {
    const session = blankSession()
    state.sessions = [session]
    state.activeSessionId = session.id
    changed = true
  }
  if (!state.sessions.some((session) => session.id === state.activeSessionId)) {
    state.activeSessionId = state.sessions[0]?.id ?? null
    changed = true
  }
  for (const session of state.sessions) {
    for (const stage of session.stages) {
      if (stage.status === 'generating') {
        stage.status = 'error'
        stage.error = '上次生成已中断'
        changed = true
      }
    }
  }
  if (changed) writeState(state)
}

export function getPublicState(): PublicState {
  const state = readState()
  return {
    profiles: state.profiles.map(toPublicProfile),
    activeChatProfileId: state.activeChatProfileId,
    activeImageProfileId: state.activeImageProfileId,
    sessions: state.sessions,
    activeSessionId: state.activeSessionId,
    busySessionId,
    busyAction
  }
}

export function isBusy(): boolean {
  return busySessionId !== null
}

export function setBusy(sessionId: string | null, action: PublicState['busyAction']): void {
  busySessionId = sessionId
  busyAction = action
}

export function saveProfile(input: ProfileInput): void {
  const state = readState()
  const normalized = normalizeProfile(input, state.profiles)
  const index = state.profiles.findIndex((profile) => profile.id === normalized.id)
  if (index >= 0) state.profiles[index] = normalized
  else state.profiles.push(normalized)
  if (normalized.kind === 'chat' && !state.activeChatProfileId) state.activeChatProfileId = normalized.id
  if (normalized.kind === 'image' && !state.activeImageProfileId) state.activeImageProfileId = normalized.id
  writeState(state)
}

export function deleteProfile(id: string): void {
  const state = readState()
  state.profiles = state.profiles.filter((profile) => profile.id !== id)
  if (state.activeChatProfileId === id) state.activeChatProfileId = null
  if (state.activeImageProfileId === id) state.activeImageProfileId = null
  writeState(state)
}

export function setActiveModels(chatProfileId: string | null, imageProfileId: string | null): void {
  const state = readState()
  state.activeChatProfileId = resolveActive(state.profiles, chatProfileId, 'chat')
  state.activeImageProfileId = resolveActive(state.profiles, imageProfileId, 'image')
  writeState(state)
}

export function requireProfile(id: string | null, kind: ModelKind): ModelProfile {
  const profile = readState().profiles.find((item) => item.id === id)
  if (!profile || profile.kind !== kind) {
    throw new Error(kind === 'chat' ? '请先选择一个聊天模型' : '请先选择一个生图模型')
  }
  if (!profile.apiKey.trim()) throw new Error(`「${profile.name}」还没有 API Key`)
  if (!profile.model.trim()) throw new Error(`「${profile.name}」还没有模型名`)
  return profile
}

export function resolveProfileInput(input: ProfileInput): ModelProfile {
  return normalizeProfile(input, readState().profiles)
}

export function createSession(): void {
  const state = readState()
  const session = blankSession()
  state.sessions.unshift(session)
  state.activeSessionId = session.id
  writeState(state)
}

export function selectSession(id: string): void {
  const state = readState()
  if (!state.sessions.some((session) => session.id === id)) throw new Error('找不到这个会话')
  state.activeSessionId = id
  writeState(state)
}

export function deleteSession(id: string): void {
  const state = readState()
  state.sessions = state.sessions.filter((session) => session.id !== id)
  if (state.sessions.length === 0) {
    const session = blankSession()
    state.sessions = [session]
    state.activeSessionId = session.id
  } else if (state.activeSessionId === id) {
    state.activeSessionId = state.sessions[0].id
  }
  writeState(state)
}

export function sendMessage(sessionId: string, content: string): void {
  const text = content.trim()
  if (!text) throw new Error('请先写一点产品描述')
  const state = readState()
  const session = mustSession(state, sessionId)
  session.messages.push({
    id: randomUUID(),
    role: 'user',
    content: text,
    createdAt: Date.now()
  })
  session.optimizeError = null
  session.title = deriveTitle(session)
  touch(session)
  writeState(state)
}

export function updateStagePrompt(sessionId: string, stageId: string, prompt: string): void {
  const state = readState()
  const session = mustSession(state, sessionId)
  const stage = mustStage(session, stageId)
  stage.prompt = prompt
  touch(session)
  writeState(state)
}

export function markOptimizeStart(sessionId: string): DesignSession {
  const state = readState()
  const session = mustSession(state, sessionId)
  if (!session.messages.some((message) => message.role === 'user')) {
    throw new Error('请先描述想设计的产品')
  }
  session.optimizeError = null
  session.boardError = null
  touch(session)
  writeState(state)
  return session
}

export function markOptimizeFailure(sessionId: string, error: string, raw: string): void {
  const state = readState()
  const session = mustSession(state, sessionId)
  session.optimizeError = error
  const body = raw.trim() ? `${error}\n\n模型原文：\n${raw.trim().slice(0, 20_000)}` : error
  session.messages.push({
    id: randomUUID(),
    role: 'assistant',
    content: body,
    createdAt: Date.now()
  })
  touch(session)
  writeState(state)
}

export function applyOptimizeResult(
  sessionId: string,
  result: { productName: string; designBrief: string; stages: Array<{ id: StageId; prompt: string }> },
  assistantText: string
): void {
  const state = readState()
  const session = mustSession(state, sessionId)
  session.productName = result.productName
  session.designBrief = result.designBrief
  session.optimizeError = null
  for (const incoming of result.stages) {
    const stage = session.stages.find((item) => item.id === incoming.id)
    if (!stage) continue
    stage.prompt = incoming.prompt
    stage.error = null
  }
  session.messages.push({
    id: randomUUID(),
    role: 'assistant',
    content: assistantText,
    createdAt: Date.now()
  })
  session.title = deriveTitle(session)
  touch(session)
  writeState(state)
}

export function markStageStart(sessionId: string, stageId: StageId): void {
  const state = readState()
  const session = mustSession(state, sessionId)
  const stage = mustStage(session, stageId)
  if (!stage.prompt.trim()) throw new Error(`请先填写「${stage.title}」的提示词`)
  stage.status = 'generating'
  stage.error = null
  session.boardError = null
  touch(session)
  writeState(state)
}

export function markStageResult(
  sessionId: string,
  stageId: StageId,
  imagePath: string | null,
  error: string | null
): void {
  const state = readState()
  const session = mustSession(state, sessionId)
  const stage = mustStage(session, stageId)
  if (error) {
    stage.status = 'error'
    stage.error = error
  } else {
    stage.status = 'done'
    stage.error = null
    stage.imagePath = imagePath
  }
  touch(session)
  writeState(state)
}

export function setBoardError(sessionId: string, message: string): void {
  const state = readState()
  const session = mustSession(state, sessionId)
  session.boardError = message
  touch(session)
  writeState(state)
}

export function getSession(sessionId: string): DesignSession {
  return mustSession(readState(), sessionId)
}

export function readImageDataUrl(relativePath: string): string {
  const bytes = readFileSync(resolveImagePath(relativePath))
  const { mime } = sniffImage(bytes)
  return `data:${mime};base64,${bytes.toString('base64')}`
}

export function saveImageFile(bytes: Buffer): string {
  const { ext } = sniffImage(bytes)
  const dir = imageDir()
  mkdirSync(dir, { recursive: true })
  const name = `${Date.now()}-${randomUUID()}.${ext}`
  writeFileSync(join(dir, name), bytes)
  return join('images', name)
}

export function readReference(relativePath: string): { bytes: Buffer; mime: string } {
  const bytes = readFileSync(resolveImagePath(relativePath))
  return { bytes, mime: sniffImage(bytes).mime }
}

export function previousImagePath(session: DesignSession, stageId: StageId): string | null {
  const index = stageIndex(stageId)
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const imagePath = session.stages[cursor]?.imagePath
    if (imagePath) return imagePath
  }
  return null
}

function imageDir(): string {
  return join(app.getPath('userData'), 'images')
}

function resolveImagePath(relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath) || relativePath.includes('..')) {
    throw new Error('图片路径无效')
  }
  const root = imageDir()
  const file = join(app.getPath('userData'), relativePath)
  const fromRoot = relative(root, file)
  if (fromRoot.startsWith('..') || fromRoot === '') throw new Error('图片路径无效')
  return file
}

function toPublicProfile(profile: ModelProfile): PublicProfile {
  return {
    id: profile.id,
    name: profile.name,
    kind: profile.kind,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    apiKeyMasked: maskSecret(profile.apiKey),
    hasApiKey: Boolean(profile.apiKey.trim()),
    model: profile.model
  }
}

function normalizeProfile(input: ProfileInput, existing: ModelProfile[]): ModelProfile {
  const name = input.name.trim()
  const baseUrl = input.baseUrl.trim()
  const model = input.model.trim()
  if (!name) throw new Error('请填写配置名称')
  if (!baseUrl) throw new Error('请填写 Base URL')
  if (!model) throw new Error('请填写模型名')
  const kind: ModelKind = input.kind === 'image' ? 'image' : 'chat'
  const allowed = protocolsForKind(kind)
  const protocol: Protocol = allowed.includes(input.protocol) ? input.protocol : allowed[0]
  const previous = input.id ? existing.find((profile) => profile.id === input.id) : undefined
  const apiKey = resolveApiKey(input.apiKey, previous?.apiKey)
  if (!apiKey) throw new Error('请填写 API Key')
  return {
    id: previous?.id ?? randomUUID(),
    name,
    kind,
    protocol,
    baseUrl,
    apiKey,
    model
  }
}

function resolveApiKey(incoming: string, previous?: string): string {
  const value = incoming.trim()
  if (!value || isMaskedSecret(value)) return previous?.trim() ?? ''
  return value
}

function resolveActive(profiles: ModelProfile[], id: string | null, kind: ModelKind): string | null {
  if (!id) return null
  return profiles.find((item) => item.id === id && item.kind === kind)?.id ?? null
}

function blankSession(): DesignSession {
  const now = Date.now()
  return {
    id: randomUUID(),
    title: '未命名设计',
    createdAt: now,
    updatedAt: now,
    messages: [],
    productName: '',
    designBrief: '',
    optimizeError: null,
    boardError: null,
    stages: createEmptyStages()
  }
}

function deriveTitle(session: DesignSession): string {
  if (session.productName.trim() && session.productName.trim() !== '未命名产品') {
    return session.productName.trim()
  }
  const first = session.messages.find((message) => message.role === 'user')
  if (!first) return '未命名设计'
  const line = first.content.trim().replace(/\s+/g, ' ')
  return line.length > 18 ? `${line.slice(0, 18)}…` : line || '未命名设计'
}

function mustSession(state: PersistedState, sessionId: string): DesignSession {
  const session = state.sessions.find((item) => item.id === sessionId)
  if (!session) throw new Error('找不到这个会话')
  return session
}

function mustStage(session: DesignSession, stageId: string): StageState {
  const stage = session.stages.find((item) => item.id === stageId)
  if (!stage || !STAGES.some((item) => item.id === stageId)) throw new Error('找不到这个阶段')
  return stage
}

function touch(session: DesignSession): void {
  session.updatedAt = Date.now()
}

function emptyPersisted(): PersistedState {
  return {
    profiles: [],
    activeChatProfileId: null,
    activeImageProfileId: null,
    sessions: [],
    activeSessionId: null
  }
}

function readState(): PersistedState {
  const current = mustStore()
  return {
    profiles: asArray<ModelProfile>(current.get('profiles')),
    activeChatProfileId: asNullableString(current.get('activeChatProfileId')),
    activeImageProfileId: asNullableString(current.get('activeImageProfileId')),
    sessions: asArray<DesignSession>(current.get('sessions')).map(repairSession),
    activeSessionId: asNullableString(current.get('activeSessionId'))
  }
}

function writeState(state: PersistedState): void {
  mustStore().store = state
}

function repairSession(session: DesignSession): DesignSession {
  const stages = createEmptyStages().map((stage) => {
    const existing = session.stages?.find((item) => item.id === stage.id)
    if (!existing) return stage
    return {
      ...stage,
      prompt: existing.prompt ?? '',
      imagePath: existing.imagePath ?? null,
      status: existing.status ?? 'idle',
      error: existing.error ?? null
    }
  })
  return {
    ...session,
    messages: Array.isArray(session.messages) ? session.messages : [],
    stages,
    productName: session.productName ?? '',
    designBrief: session.designBrief ?? '',
    optimizeError: session.optimizeError ?? null,
    boardError: session.boardError ?? null,
    title: session.title || '未命名设计'
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function mustStore(): Store<StoreShape> {
  if (!store) throw new Error('本地存储还没有准备好')
  return store
}
